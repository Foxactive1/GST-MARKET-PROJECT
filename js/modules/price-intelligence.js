/**
 * Módulo de Inteligência de Preços - Versão Profissional
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 5.1.0 (2026-03-15)
 *
 * Correções v5.1.0:
 * - [FIX CRÍTICO] saveManualPrice: variáveis 'utils' e 'input' indefinidas → corrigido
 * - [FIX CRÍTICO] maskCurrencyInput inline: recebe elemento DOM, não string → substituída
 * - [FIX] R$+formatCurrency() → formatCurrencyBR() em todo o módulo (compat. utils v5.0)
 * - [FIX] Chart scale ticks: formatCurrencyBR() com locale pt-BR
 * - [FIX] onMarketPriceInput: parsing manual → parseCurrencyBR()
 * - [FIX] exports CSV: preços como número puro (Excel-compatible)
 * - [FIX] checkDependencies: Chart ausente vira warning, não bloqueia o módulo
 * - [FIX] autoLinkFirstResult: dispara onMarketPriceInput após preencher input
 * - [REFACTOR] debounce local removido → usa dependencies.utils.debounce
 * - [REFACTOR] Chart e Swal resolvidos via getter (lazy)
 *
 * Características:
 * - Arquitetura modular (API, UI, Storage, Charts)
 * - Múltiplas fontes de dados com fallback inteligente
 * - Validação rigorosa de dados
 * - Gerenciamento de memória (destruição de gráficos)
 * - Acessibilidade aprimorada
 * - Preparado para internacionalização
 * - Código autodocumentado e de fácil manutenção
 */

window.priceIntelligence = (function() {
    'use strict';

    // =========================================================================
    // DEPENDÊNCIAS E VERIFICAÇÃO
    // =========================================================================
    // [FIX] Chart e Swal resolvidos no momento do uso (lazy) para suportar carregamento assíncrono
    const dependencies = {
        get state()  { return window.state; },
        get utils()  { return window.utils; },
        get Chart()  { return typeof Chart  !== 'undefined' ? Chart  : null; },
        get Swal()   { return typeof Swal   !== 'undefined' ? Swal   : null; }
    };

    function checkDependencies() {
        // state e utils são obrigatórios — sem eles o módulo não funciona
        const required = { state: dependencies.state, utils: dependencies.utils };
        const missing = Object.entries(required)
            .filter(([, v]) => !v)
            .map(([k]) => k);

        if (missing.length > 0) {
            console.error(`[PriceIntelligence] Dependências obrigatórias ausentes: ${missing.join(', ')}`);
            return false;
        }

        // [FIX] Chart e Swal são opcionais — avisam mas não bloqueiam
        if (!dependencies.Chart) {
            console.warn('[PriceIntelligence] Chart.js não encontrado — gráficos desabilitados');
        }
        if (!dependencies.Swal) {
            console.warn('[PriceIntelligence] SweetAlert2 não encontrado — dialogs usarão fallback nativo');
        }

        return true;
    }

    // =========================================================================
    // CONFIGURAÇÕES
    // =========================================================================
    const CONFIG = {
        api: {
            flaskProxy: '/api/price-search?q=',
            corsProxy: 'https://corsproxy.io/?https://api.mercadolibre.com/sites/MLB/search?q=',
            mlLimit: '&limit=10',
            timeout: 8000, // ms
            retries: 1
        },
        cache: {
            duration: 10 * 60 * 1000, // 10 minutos
            maxHistory: 200,
            storageKey: 'price_intelligence_cache'
        },
        ui: {
            maxResults: 10,
            defaultMarkup: 1.20,
            debounceDelay: 400 // ms
        },
        i18n: {
            // Preparado para internacionalização futura
            currency: 'R$',
            decimalSeparator: ',',
            thousandsSeparator: '.'
        }
    };

    // =========================================================================
    // MÓDULO DE ARMAZENAMENTO (Storage)
    // =========================================================================
    const Storage = {
        _history: null, // cache em memória

        getHistory() {
            if (this._history) return this._history.slice();

            try {
                if (dependencies.state && typeof dependencies.state.get === 'function') {
                    this._history = (dependencies.state.get().priceHistory || []).slice();
                } else {
                    const stored = localStorage.getItem('price_intelligence_history');
                    this._history = stored ? JSON.parse(stored) : [];
                }
            } catch (e) {
                console.error('[PriceIntelligence] Erro ao ler histórico:', e);
                this._history = [];
            }
            return this._history.slice();
        },

        saveHistory(history) {
            const trimmed = history.length > CONFIG.cache.maxHistory 
                ? history.slice(-CONFIG.cache.maxHistory) 
                : history;
            
            try {
                if (dependencies.state && typeof dependencies.state.setPriceHistory === 'function') {
                    dependencies.state.setPriceHistory(trimmed);
                } else {
                    localStorage.setItem('price_intelligence_history', JSON.stringify(trimmed));
                }
                this._history = trimmed.slice(); // atualiza cache
            } catch (e) {
                console.error('[PriceIntelligence] Erro ao salvar histórico:', e);
            }
        },

        getCache() {
            try {
                const cached = sessionStorage.getItem(CONFIG.cache.storageKey);
                return cached ? JSON.parse(cached) : {};
            } catch {
                return {};
            }
        },

        setCache(cache) {
            try {
                sessionStorage.setItem(CONFIG.cache.storageKey, JSON.stringify(cache));
            } catch {
                // Ignora erros de quota
            }
        },

        migrateLegacy() {
            try {
                const legacy = localStorage.getItem('price_intelligence_history');
                if (legacy) {
                    const parsed = JSON.parse(legacy) || [];
                    if (parsed.length > 0 && this.getHistory().length === 0) {
                        this.saveHistory(parsed);
                    }
                    localStorage.removeItem('price_intelligence_history');
                }
            } catch (e) {
                console.warn('[PriceIntelligence] Falha na migração legada:', e);
            }
        }
    };

    // =========================================================================
    // MÓDULO DE API (Fontes de dados)
    // =========================================================================
    const Api = {
        _abortControllers: new Set(),

        // Cancela todas as requisições pendentes
        abortAll() {
            this._abortControllers.forEach(controller => controller.abort());
            this._abortControllers.clear();
        },

        // Factory para criar fetch com timeout e abort
        _createFetch(url, options = {}) {
            const controller = new AbortController();
            this._abortControllers.add(controller);
            
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeout);
            
            return fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            })
            .finally(() => {
                clearTimeout(timeoutId);
                this._abortControllers.delete(controller);
            });
        },

        // Valida e normaliza resultados da API do Mercado Livre
        _normalizeMLResults(data) {
            if (!data || !Array.isArray(data.results)) return [];
            
            return data.results
                .filter(item => item.price && item.price > 0 && item.title)
                .map(item => ({
                    id: item.id,
                    title: item.title,
                    price: item.price,
                    seller: item.seller?.nickname || 'Mercado Livre',
                    permalink: item.permalink,
                    thumbnail: item.thumbnail,
                    currency_id: item.currency_id
                }))
                .slice(0, CONFIG.ui.maxResults);
        },

        // Fonte 1: Flask Proxy Local
        async fetchFromFlask(query) {
            const url = CONFIG.api.flaskProxy + encodeURIComponent(query);
            const response = await this._createFetch(url);
            
            if (!response.ok) {
                // Se for 404, significa que o endpoint Flask não existe -> fallback
                if (response.status === 404) {
                    throw new Error('FLASK_NOT_FOUND');
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            return this._normalizeMLResults(data);
        },

        // Fonte 2: Proxy CORS público
        async fetchFromCorsProxy(query) {
            const url = CONFIG.api.corsProxy + encodeURIComponent(query) + CONFIG.api.mlLimit;
            const response = await this._createFetch(url, {
                headers: { 'x-requested-with': 'XMLHttpRequest' }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            return this._normalizeMLResults(data);
        },

        // Pipeline de busca com fallback
        async search(query) {
            let lastError = null;
            
            // Tenta Flask primeiro
            try {
                const results = await this.fetchFromFlask(query);
                if (results.length > 0) {
                    return { results, source: 'Flask (local)' };
                }
            } catch (error) {
                lastError = error;
                // Se for 404 do Flask, continua; senão, loga mas continua
                if (error.message !== 'FLASK_NOT_FOUND') {
                    console.warn('[PriceIntelligence] Flask error:', error);
                }
            }
            
            // Fallback para proxy público
            try {
                const results = await this.fetchFromCorsProxy(query);
                if (results.length > 0) {
                    return { results, source: 'Proxy CORS público' };
                }
            } catch (error) {
                lastError = error;
                console.warn('[PriceIntelligence] CORS proxy error:', error);
            }
            
            // Se chegou aqui, ambos falharam ou retornaram vazio
            if (lastError) {
                throw new Error(`Todas as fontes falharam. Último erro: ${lastError.message}`);
            } else {
                return { results: [], source: 'nenhuma' };
            }
        }
    };

    // =========================================================================
    // MÓDULO DE GRÁFICOS (Charts)
    // =========================================================================
    const Charts = {
        instances: {},

        destroy(chartName) {
            if (this.instances[chartName]) {
                this.instances[chartName].destroy();
                delete this.instances[chartName];
            }
        },

        destroyAll() {
            Object.keys(this.instances).forEach(name => this.destroy(name));
        },

        createComparisonChart(ctx, ourPrice, marketAvg, suggested) {
            this.destroy('comparison');
            if (!ctx) return;
            
            this.instances.comparison = new dependencies.Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Nosso Preço', 'Média do Mercado', 'Preço Sugerido'],
                    datasets: [{
                        label: 'Preço (R$)',
                        data: [ourPrice, marketAvg, suggested],
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: ctx => dependencies.utils.formatCurrencyBR(ctx.raw)
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => dependencies.utils.formatCurrencyBR(v) }
                        }
                    }
                }
            });
        },

        createTrendChart(ctx, dates, prices) {
            this.destroy('trend');
            if (!ctx || dates.length === 0) return;
            
            this.instances.trend = new dependencies.Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Preço de Mercado (R$)',
                        data: prices,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: ctx => dependencies.utils.formatCurrencyBR(ctx.raw)
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => dependencies.utils.formatCurrencyBR(v) }
                        }
                    }
                }
            });
        },

        createStockComparisonChart(ctx, products) {
            this.destroy('stockComparison');
            if (!ctx || products.length === 0) return;
            
            const labels = products.map(p => 
                p.nome.length > 18 ? p.nome.substr(0, 18) + '…' : p.nome
            );
            
            this.instances.stockComparison = new dependencies.Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Nosso Preço',
                            data: products.map(p => p.preco),
                            backgroundColor: products.map(p =>
                                p.preco > p.market ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)'
                            ),
                            borderWidth: 0
                        },
                        {
                            label: 'Preço de Mercado',
                            data: products.map(p => p.market),
                            backgroundColor: 'rgba(59,130,246,0.5)',
                            borderWidth: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: ctx => `${ctx.dataset.label}: ${dependencies.utils.formatCurrencyBR(ctx.raw)}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => dependencies.utils.formatCurrencyBR(v) }
                        }
                    }
                }
            });
        }
    };

    // =========================================================================
    // MÓDULO DE UI (Interface do usuário)
    // =========================================================================
    const UI = {
        elements: {},
        state: {
            activeTab: 'search',
            currentResults: [],
            currentQuery: '',
            currentSource: ''
        },

        // Cache de elementos do DOM
        cacheElements() {
            const ids = [
                'mainContent', 'price-search-input', 'results-card', 'results-body',
                'results-count', 'source-badge', 'source-status', 'analysis-card',
                'analysis-our-price', 'analysis-market-avg', 'analysis-suggested',
                'analysis-no-history', 'comparisonChart', 'trendChart',
                'history-body', 'tab-search', 'tab-estoque', 'tab-search-btn',
                'tab-estoque-btn', 'stock-comparison-body', 'stock-chart-card',
                'stockComparisonChart'
            ];
            
            ids.forEach(id => {
                this.elements[id] = document.getElementById(id);
            });
        },

        // Utilitário para sanitizar HTML (anti-XSS)
        escapeHtml(str) {
            return String(str ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        // Atualiza status da fonte
        setSourceStatus(msg, type = 'info') {
            const el = this.elements['source-status'];
            if (!el) return;
            
            const colors = {
                success: 'text-success',
                warning: 'text-warning',
                danger: 'text-danger',
                info: 'text-muted'
            };
            
            el.innerHTML = `<small class="${colors[type] || 'text-muted'}">
                <i class="bi bi-circle-fill me-1" style="font-size:.5rem;"></i>${this.escapeHtml(msg)}
            </small>`;
        },

        // Mostra/esconde elementos
        show(elementId, show = true) {
            const el = this.elements[elementId];
            if (el) el.style.display = show ? '' : 'none';
        },

        // Renderiza a tela principal
        renderMain() {
            if (!checkDependencies()) {
                this.showError('Erro ao carregar Inteligência de Preços. Dependências não encontradas.');
                return;
            }

            const container = this.elements.mainContent;
            if (!container) return;

            container.innerHTML = `
                <div class="fade-in">
                    <!-- Header -->
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 class="mb-1">
                                <i class="bi bi-graph-up-arrow text-primary"></i>
                                Inteligência de Preços
                            </h2>
                            <p class="text-muted mb-0">
                                Pesquise preços do mercado e compare com seu estoque
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-outline-secondary" id="export-history-btn" aria-label="Exportar histórico">
                                <i class="bi bi-download"></i> Exportar
                            </button>
                            <button class="btn btn-outline-danger ms-2" id="clear-history-btn" aria-label="Limpar histórico">
                                <i class="bi bi-trash"></i> Limpar
                            </button>
                        </div>
                    </div>

                    <!-- Abas -->
                    <ul class="nav nav-tabs mb-4" id="price-tabs">
                        <li class="nav-item">
                            <button class="nav-link active" id="tab-search-btn" 
                                    data-tab="search" aria-controls="tab-search" aria-selected="true">
                                <i class="bi bi-search"></i> Pesquisar Preços
                            </button>
                        </li>
                        <li class="nav-item">
                            <button class="nav-link" id="tab-estoque-btn" 
                                    data-tab="estoque" aria-controls="tab-estoque" aria-selected="false">
                                <i class="bi bi-boxes"></i> Comparar com Estoque
                            </button>
                        </li>
                    </ul>

                    <!-- ABA: PESQUISA -->
                    <div id="tab-search" role="tabpanel" aria-labelledby="tab-search-btn">
                        ${this.renderSearchTab()}
                    </div>

                    <!-- ABA: ESTOQUE -->
                    <div id="tab-estoque" style="display:none;" role="tabpanel" aria-labelledby="tab-estoque-btn">
                        ${this.renderStockTab()}
                    </div>
                </div>
            `;

            // Recache após renderizar
            this.cacheElements();
            this.attachEvents();
            this.loadHistoryTable();
        },

        renderSearchTab() {
            return `
                <!-- Campo de busca -->
                <div class="card-modern mb-4">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-8">
                            <label for="price-search-input" class="form-label">Produto / Palavra-chave</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
                                <input type="text" id="price-search-input"
                                       class="form-control form-control-lg"
                                       placeholder="Ex: Arroz Tio João 5kg"
                                       autocomplete="off"
                                       aria-label="Produto para pesquisa">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <button class="btn btn-primary w-100 btn-lg" id="search-btn">
                                <i class="bi bi-search"></i> Pesquisar
                            </button>
                        </div>
                    </div>
                    <div class="mt-3" id="source-status">
                        <small class="text-muted">
                            <i class="bi bi-info-circle"></i>
                            Tentará primeiro o backend Flask local. Se indisponível, usará proxy público.
                        </small>
                    </div>
                </div>

                <!-- Resultados -->
                <div class="card-modern mb-4" id="results-card" style="display:none;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-list-ul"></i> Resultados
                            <span id="source-badge" class="badge bg-secondary ms-2 small"></span>
                        </h5>
                        <span class="badge bg-primary" id="results-count">0</span>
                    </div>
                    <div class="table-responsive">
                        <table class="table-modern">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Preço</th>
                                    <th>Vendedor</th>
                                    <th style="width:220px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="results-body">
                                <tr><td colspan="4" class="text-center text-muted py-4">
                                    Faça uma pesquisa para ver resultados
                                </td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Análise / Gráficos -->
                <div class="card-modern mt-4" id="analysis-card" style="display:none;">
                    <h5 class="card-title mb-3">
                        <i class="bi bi-bar-chart-steps"></i> Análise de Preços
                    </h5>
                    <div class="alert alert-warning d-none" id="analysis-no-history">
                        <i class="bi bi-exclamation-circle"></i>
                        Histórico insuficiente para calcular a média de mercado.
                        O preço sugerido foi calculado com base no preço atual pesquisado.
                    </div>
                    <div class="row g-4">
                        <div class="col-md-6">
                            <div class="metric-card">
                                <div class="metric-label">Nosso Preço</div>
                                <div class="metric-value" id="analysis-our-price">R$ 0,00</div>
                            </div>
                            <div class="metric-card mt-2">
                                <div class="metric-label">Média do Mercado (últimos 30 dias)</div>
                                <div class="metric-value text-primary" id="analysis-market-avg">R$ 0,00</div>
                            </div>
                            <div class="metric-card mt-2">
                                <div class="metric-label">Preço Sugerido (markup 20%)</div>
                                <div class="metric-value text-success" id="analysis-suggested">R$ 0,00</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div style="height:250px;">
                                <canvas id="comparisonChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <div style="height:250px;">
                                <canvas id="trendChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Histórico -->
                <div class="card-modern mt-4">
                    <h5 class="card-title mb-3">
                        <i class="bi bi-clock-history"></i> Histórico de Preços Pesquisados
                    </h5>
                    <div class="table-responsive" style="max-height:400px;overflow-y:auto;">
                        <table class="table-modern">
                            <thead style="position:sticky;top:0;background:var(--bs-body-bg);">
                                <tr>
                                    <th>Produto</th>
                                    <th>Preço</th>
                                    <th>Loja</th>
                                    <th>Data</th>
                                    <th>Vínculo</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="history-body"></tbody>
                        </table>
                    </div>
                </div>
            `;
        },

        renderStockTab() {
            return `
                <div class="card-modern mb-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-boxes"></i> Comparação: Estoque × Mercado
                        </h5>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" id="refresh-stock-btn">
                                <i class="bi bi-arrow-clockwise"></i> Atualizar
                            </button>
                            <button class="btn btn-sm btn-outline-secondary ms-2" id="export-stock-btn">
                                <i class="bi bi-download"></i> Exportar
                            </button>
                        </div>
                    </div>

                    <div class="alert alert-info mb-3">
                        <i class="bi bi-lightbulb"></i>
                        <strong>Como usar:</strong> Preencha o campo "Preço de Mercado" manualmente
                        ou pesquise o produto na aba "Pesquisar Preços" e clique em
                        <strong>Vincular</strong> para preencher automaticamente.
                    </div>

                    <div class="table-responsive">
                        <table class="table-modern" id="stock-comparison-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Nosso Preço</th>
                                    <th>Preço de Mercado</th>
                                    <th>Diferença</th>
                                    <th>Margem Sugerida</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="stock-comparison-body"></tbody>
                        </table>
                    </div>
                </div>

                <!-- Gráfico de comparação geral do estoque -->
                <div class="card-modern" id="stock-chart-card" style="display:none;">
                    <h5 class="card-title mb-3">
                        <i class="bi bi-bar-chart"></i> Visão Geral — Posicionamento de Preços
                    </h5>
                    <div style="height:350px;">
                        <canvas id="stockComparisonChart"></canvas>
                    </div>
                    <p class="text-muted small mt-2 text-center">
                        Verde = abaixo do mercado (oportunidade de margem) · Vermelho = acima do mercado (risco de perda de venda)
                    </p>
                </div>
            `;
        },

        attachEvents() {
            // Busca
            const searchInput = this.elements['price-search-input'];
            if (searchInput) {
                searchInput.addEventListener('input', this.debounce(() => {
                    if (searchInput.value.trim().length >= 3) {
                        this.triggerSearch();
                    }
                }, CONFIG.ui.debounceDelay));
                
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.triggerSearch();
                    }
                });
            }

            document.getElementById('search-btn')?.addEventListener('click', () => this.triggerSearch());

            // Abas
            document.querySelectorAll('[data-tab]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.currentTarget.dataset.tab;
                    this.switchTab(tab);
                });
            });

            // Botões de histórico
            document.getElementById('export-history-btn')?.addEventListener('click', () => this.exportHistory());
            document.getElementById('clear-history-btn')?.addEventListener('click', () => this.clearHistory());

            // Botões da aba estoque
            document.getElementById('refresh-stock-btn')?.addEventListener('click', () => this.refreshStockComparison());
            document.getElementById('export-stock-btn')?.addEventListener('click', () => this.exportStockComparison());

            // Delegação de eventos para botões dinâmicos (usando event delegation no mainContent)
            const mainContent = this.elements.mainContent;
            if (mainContent) {
                mainContent.addEventListener('click', (e) => {
                    const target = e.target.closest('button');
                    if (!target) return;

                    // Ações dos resultados de pesquisa
                    if (target.matches('[data-action="save"]')) {
                        const index = target.dataset.index;
                        if (index !== undefined) this.saveResult(parseInt(index));
                    }
                    else if (target.matches('[data-action="link"]')) {
                        const index = target.dataset.index;
                        if (index !== undefined) this.linkToProduct(parseInt(index));
                    }
                    else if (target.matches('[data-action="compare"]')) {
                        const index = target.dataset.index;
                        if (index !== undefined) this.compareWithProduct(parseInt(index));
                    }
                    else if (target.matches('[data-action="analyze"]')) {
                        const id = target.dataset.id;
                        if (id) this.analyzeProduct(id);
                    }
                    else if (target.matches('[data-action="apply-market"]')) {
                        const productId = target.dataset.productId;
                        if (productId) this.applyMarketPrice(productId);
                    }
                    else if (target.matches('[data-action="search-product"]')) {
                        const productId = target.dataset.productId;
                        const productName = target.dataset.productName;
                        if (productId && productName) this.searchForProduct(productId, productName);
                    }
                });

                // [FIX #2] Máscara monetária via delegação — substitui oninput inline removido do template.
                // maskCurrencyInput recebe elemento DOM, então aplicamos a lógica aqui diretamente.
                mainContent.addEventListener('input', (e) => {
                    if (e.target.matches('.market-price-input')) {
                        // Aplica máscara pt-BR: dígitos → "1.234,56"
                        let raw = e.target.value.replace(/\D/g, '');
                        if (raw.length === 0) { e.target.value = ''; return; }
                        let masked = (Number(raw) / 100).toFixed(2);
                        masked = masked.replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                        e.target.value = masked;

                        const productId = e.target.dataset.productId;
                        if (productId) this.onMarketPriceInput(productId);
                    }
                });
            }
        },

        // [REFACTOR] debounce delegado para dependencies.utils.debounce (evita duplicação)
        debounce: (...args) => dependencies.utils.debounce(...args),

        async triggerSearch() {
            const input = this.elements['price-search-input'];
            if (!input) return;
            
            const query = input.value.trim();
            if (!query) {
                dependencies.utils.showToast('Digite um produto para pesquisar', 'warning');
                return;
            }

            // Cancela requisições pendentes
            Api.abortAll();
            
            // Mostra spinner
            this.showSearchSpinner();
            
            // Verifica cache
            const cache = Storage.getCache();
            const cached = cache[query];
            if (cached && (Date.now() - cached.timestamp) < CONFIG.cache.duration) {
                this.state.currentResults = cached.results;
                this.state.currentSource = cached.source;
                this.renderResults(cached.results, query, cached.source);
                return;
            }

            try {
                const { results, source } = await Api.search(query);
                
                // Atualiza cache
                cache[query] = { timestamp: Date.now(), results, source };
                Storage.setCache(cache);
                
                this.state.currentResults = results;
                this.state.currentSource = source;
                
                if (results.length === 0) {
                    this.showEmptyResults(query);
                } else {
                    this.renderResults(results, query, source);
                }
                
                // Auto-vincular se veio da aba estoque
                const autoLinkId = input.dataset.autoLinkProductId;
                if (autoLinkId && results.length > 0) {
                    delete input.dataset.autoLinkProductId;
                    this.autoLinkFirstResult(autoLinkId, results);
                }
                
            } catch (error) {
                console.error('[PriceIntelligence] Erro na busca:', error);
                this.showOfflineFallback(query);
            }
        },

        showSearchSpinner() {
            this.show('results-card', true);
            const body = this.elements['results-body'];
            if (body) {
                body.innerHTML = `
                    <tr><td colspan="4" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Pesquisando...</span>
                        </div>
                        <div class="text-muted mt-2 small">Consultando Mercado Livre...</div>
                    </td></tr>`;
            }
            this.setSourceStatus('Pesquisando...', 'info');
        },

        showEmptyResults(query) {
            const body = this.elements['results-body'];
            if (body) {
                body.innerHTML = `
                    <tr><td colspan="4" class="text-center text-muted py-4">
                        Nenhum resultado encontrado para "${this.escapeHtml(query)}"
                    </td></tr>`;
            }
            const cnt = this.elements['results-count'];
            if (cnt) cnt.textContent = '0';
            this.setSourceStatus('Nenhum resultado encontrado', 'warning');
        },

        showOfflineFallback(query) {
            this.show('results-card', true);
            const body = this.elements['results-body'];
            if (!body) return;
            
            this.setSourceStatus('Backend e proxy indisponíveis — modo de entrada manual ativo', 'danger');
            
            body.innerHTML = `
                <tr>
                    <td colspan="4">
                        <div class="alert alert-warning mb-3">
                            <i class="bi bi-wifi-off"></i>
                            <strong>Sem acesso à API do Mercado Livre.</strong>
                            Isso ocorre quando o servidor Flask não está rodando
                            e o proxy público não está acessível.
                        </div>
                        <div class="card-modern">
                            <h6 class="mb-3">
                                <i class="bi bi-pencil-square"></i>
                                Cadastrar preço de mercado manualmente
                            </h6>
                            <div class="row g-3">
                                <div class="col-md-5">
                                    <label for="manual-name" class="form-label small">Nome do produto</label>
                                    <input type="text" id="manual-name" class="form-control"
                                           value="${this.escapeHtml(query)}" placeholder="Nome do produto">
                                </div>
                                <div class="col-md-3">
                                    <label for="manual-price" class="form-label small">Preço de mercado (R$)</label>
                                    <input type="text" id="manual-price" class="form-control market-price-input"
                                           placeholder="0,00"
                                           data-product-id=""
                                           aria-label="Preço de mercado manual">
                                </div>
                                <div class="col-md-3">
                                    <label for="manual-store" class="form-label small">Loja / Concorrente</label>
                                    <input type="text" id="manual-store" class="form-control"
                                           placeholder="Ex: Atacadão">
                                </div>
                                <div class="col-md-1 d-flex align-items-end">
                                    <button class="btn btn-success w-100" id="save-manual-btn">
                                        <i class="bi bi-save"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
            
            document.getElementById('save-manual-btn')?.addEventListener('click', () => this.saveManualPrice());
        },

        renderResults(results, query, source) {
            const body = this.elements['results-body'];
            const count = this.elements['results-count'];
            const badge = this.elements['source-badge'];
            
            if (!body) return;
            
            if (badge && source) {
                badge.textContent = source;
                badge.className = `badge ms-2 small ${source.includes('Flask') ? 'bg-success' : 'bg-secondary'}`;
            }
            
            this.setSourceStatus(`Fonte: ${source} — ${results.length} resultado(s) encontrado(s)`, 'success');
            
            if (results.length === 0) {
                this.showEmptyResults(query);
                return;
            }
            
            if (count) count.textContent = results.length;
            
            body.innerHTML = results.map((item, index) => {
                const price = item.price || 0;
                const title = this.escapeHtml(item.title);
                const store = this.escapeHtml(item.seller || 'Mercado Livre');
                const exists = this.checkIfExistsInHistory(item.title, price);
                
                return `
                    <tr>
                        <td>${title}</td>
                        <td class="text-primary fw-bold">${dependencies.utils.formatCurrencyBR(price)}</td>
                        <td>${store}</td>
                        <td>
                            <div class="btn-group btn-group-sm" role="group" aria-label="Ações do produto">
                                ${exists 
                                    ? '<span class="badge bg-secondary">Já salvo</span>'
                                    : `<button class="btn btn-outline-success" data-action="save" data-index="${index}" 
                                               aria-label="Salvar no histórico" title="Salvar no histórico">
                                         <i class="bi bi-save"></i>
                                       </button>`
                                }
                                <button class="btn btn-outline-primary" data-action="link" data-index="${index}"
                                        aria-label="Vincular a produto do estoque" title="Vincular ao estoque">
                                    <i class="bi bi-link"></i>
                                </button>
                                <button class="btn btn-outline-info" data-action="compare" data-index="${index}"
                                        aria-label="Comparar com produto do estoque" title="Comparar">
                                    <i class="bi bi-graph-up"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        checkIfExistsInHistory(productName, price) {
            const ago = new Date();
            ago.setDate(ago.getDate() - 1);
            const history = Storage.getHistory();
            return history.some(h =>
                h.productName === productName &&
                Math.abs(h.price - price) < 0.01 &&
                new Date(h.date) > ago
            );
        },

        loadHistoryTable() {
            const body = this.elements['history-body'];
            if (!body) return;
            
            const history = Storage.getHistory();
            if (history.length === 0) {
                body.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">
                    Nenhum preço pesquisado ainda
                </td></tr>`;
                return;
            }
            
            body.innerHTML = [...history]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 50)
                .map(item => {
                    const safeName = this.escapeHtml(item.productName);
                    const safeStore = this.escapeHtml(item.store || 'Mercado Livre');
                    const safeId = this.escapeHtml(item.id);
                    const productLink = item.productId
                        ? `<span class="badge bg-success" title="Vinculado a produto">${safeName}</span>`
                        : `<span class="text-muted">—</span>`;
                    
                    return `
                        <tr>
                            <td>${safeName}</td>
                            <td class="text-primary fw-bold">${dependencies.utils.formatCurrencyBR(item.price)}</td>
                            <td>${safeStore}</td>
                            <td>${dependencies.utils.formatDate(item.date)}</td>
                            <td>${productLink}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" data-action="analyze" data-id="${safeId}"
                                        aria-label="Analisar produto" title="Analisar">
                                    <i class="bi bi-graph-up"></i>
                                </button>
                            </td>
                        </tr>`;
                }).join('');
        },

        // =====================================================================
        // AÇÕES DOS RESULTADOS
        // =====================================================================
        saveResult(index) {
            const item = this.state.currentResults[index];
            if (!item) return;
            
            const history = Storage.getHistory();
            history.push({
                id: dependencies.utils.generateId(),
                productName: item.title,
                price: item.price,
                store: item.seller || 'Mercado Livre',
                date: new Date().toISOString(),
                productId: null
            });
            Storage.saveHistory(history);
            dependencies.utils.showToast('Preço salvo no histórico', 'success');
            this.loadHistoryTable();
            // Re-renderiza resultados para atualizar o botão "Já salvo"
            this.renderResults(this.state.currentResults, this.state.currentQuery, this.state.currentSource);
        },

        async linkToProduct(index) {
            const item = this.state.currentResults[index];
            if (!item) return;
            
            const products = dependencies.state.getProducts();
            if (products.length === 0) {
                dependencies.utils.showToast('Nenhum produto cadastrado para vincular', 'warning');
                return;
            }
            
            if (!dependencies.Swal) {
                dependencies.utils.showAlert('SweetAlert2 necessário', 'warning');
                return;
            }
            
            const options = '<option value="">Selecione...</option>' +
                products.map(p =>
                    `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.nome)} (${dependencies.utils.formatCurrencyBR(p.preco)})</option>`
                ).join('');
            
            const { value: productId } = await dependencies.Swal.fire({
                title: 'Vincular a Produto',
                html: `
                    <div class="text-start">
                        <p><strong>Produto pesquisado:</strong> ${this.escapeHtml(item.title)}</p>
                        <p><strong>Preço:</strong> ${dependencies.utils.formatCurrencyBR(item.price)}</p>
                        <hr>
                        <label for="link-product-select" class="form-label">Produto do sistema</label>
                        <select id="link-product-select" class="form-select">${options}</select>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Vincular',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const select = document.getElementById('link-product-select');
                    if (!select.value) {
                        dependencies.Swal.showValidationMessage('Selecione um produto');
                        return false;
                    }
                    return select.value;
                }
            });
            
            if (!productId) return;
            
            const history = Storage.getHistory();
            history.push({
                id: dependencies.utils.generateId(),
                productName: item.title,
                price: item.price,
                store: item.seller || 'Mercado Livre',
                date: new Date().toISOString(),
                productId
            });
            Storage.saveHistory(history);
            dependencies.utils.showToast('Preço vinculado e salvo!', 'success');
            this.loadHistoryTable();
            
            // Pergunta se quer atualizar o preço do produto
            const product = products.find(p => p.id === productId);
            if (product) {
                const { isConfirmed } = await dependencies.Swal.fire({
                    title: 'Atualizar preço do produto?',
                    text: `Preço atual: ${dependencies.utils.formatCurrencyBR(product.preco)} → Novo: ${dependencies.utils.formatCurrencyBR(item.price)}`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, atualizar',
                    cancelButtonText: 'Não'
                });
                
                if (isConfirmed) {
                    dependencies.state.updateProduct(productId, { preco: item.price });
                    dependencies.utils.showToast('Preço do produto atualizado!', 'success');
                }
            }
        },

        async compareWithProduct(index) {
            const item = this.state.currentResults[index];
            if (!item) return;
            
            const products = dependencies.state.getProducts();
            if (products.length === 0) {
                dependencies.utils.showToast('Nenhum produto cadastrado para comparar', 'warning');
                return;
            }
            
            if (!dependencies.Swal) {
                dependencies.utils.showAlert('SweetAlert2 necessário', 'warning');
                return;
            }
            
            const options = '<option value="">Selecione...</option>' +
                products.map(p =>
                    `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.nome)} (${dependencies.utils.formatCurrencyBR(p.preco)})</option>`
                ).join('');
            
            const { value: productId } = await dependencies.Swal.fire({
                title: 'Comparar Preços',
                html: `
                    <div class="text-start">
                        <p><strong>Produto pesquisado:</strong> ${this.escapeHtml(item.title)}</p>
                        <p><strong>Preço:</strong> ${dependencies.utils.formatCurrencyBR(item.price)}</p>
                        <hr>
                        <label for="compare-product-select" class="form-label">Produto do sistema</label>
                        <select id="compare-product-select" class="form-select">${options}</select>
                    </div>`,
                showCancelButton: true,
                confirmButtonText: 'Comparar',
                cancelButtonText: 'Cancelar',
                preConfirm: () => {
                    const select = document.getElementById('compare-product-select');
                    if (!select.value) {
                        dependencies.Swal.showValidationMessage('Selecione um produto');
                        return false;
                    }
                    return select.value;
                }
            });
            
            if (productId) {
                const product = products.find(p => p.id === productId);
                if (product) this.showComparisonGraph(product, item);
            }
        },

        showComparisonGraph(product, marketItem) {
            this.show('analysis-card', true);
            
            const ourPriceEl = this.elements['analysis-our-price'];
            const marketAvgEl = this.elements['analysis-market-avg'];
            const suggestedEl = this.elements['analysis-suggested'];
            const warningEl = this.elements['analysis-no-history'];
            
            if (ourPriceEl) ourPriceEl.textContent = dependencies.utils.formatCurrencyBR(product.preco);
            
            let marketAvg = this.getMarketAverage(product.nome);
            let noHistoryWarning = false;
            
            if (marketAvg === 0) {
                marketAvg = marketItem.price || 0;
                noHistoryWarning = true;
            }
            
            const suggested = marketAvg * CONFIG.ui.defaultMarkup;
            
            if (warningEl) warningEl.classList.toggle('d-none', !noHistoryWarning);
            if (marketAvgEl) marketAvgEl.textContent = dependencies.utils.formatCurrencyBR(marketAvg);
            if (suggestedEl) suggestedEl.textContent = dependencies.utils.formatCurrencyBR(suggested);
            
            // Gráfico de barras comparativo
            const ctxBar = this.elements['comparisonChart']?.getContext('2d');
            Charts.createComparisonChart(ctxBar, product.preco, marketAvg, suggested);
            
            // Gráfico de tendência
            const trend = this.getPriceTrend(product.nome);
            const ctxLine = this.elements['trendChart']?.getContext('2d');
            Charts.createTrendChart(ctxLine, trend.dates, trend.prices);
        },

        getMarketAverage(productName) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const relevant = Storage.getHistory().filter(h =>
                h.productName.toLowerCase().includes(productName.toLowerCase()) &&
                new Date(h.date) >= cutoff
            );
            if (relevant.length === 0) return 0;
            return relevant.reduce((s, h) => s + h.price, 0) / relevant.length;
        },

        getPriceTrend(productName) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);
            const filtered = Storage.getHistory()
                .filter(h =>
                    h.productName.toLowerCase().includes(productName.toLowerCase()) &&
                    new Date(h.date) >= cutoff
                )
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            return {
                dates: filtered.map(h => dependencies.utils.formatDate(h.date)),
                prices: filtered.map(h => h.price)
            };
        },

        saveManualPrice() {
            const name     = document.getElementById('manual-name')?.value.trim();
            const rawPrice = document.getElementById('manual-price')?.value || '';
            const store    = document.getElementById('manual-store')?.value.trim() || 'Manual';

            // [FIX CRÍTICO] era: utils.parseCurrencyBR(input.value) — 'utils' e 'input' indefinidos
            const price = dependencies.utils.parseCurrencyBR(rawPrice);

            if (!name || price <= 0) {
                dependencies.utils.showToast('Preencha nome e preço válidos', 'warning');
                return;
            }
            
            const history = Storage.getHistory();
            history.push({
                id: dependencies.utils.generateId(),
                productName: name,
                price,
                store,
                date: new Date().toISOString(),
                productId: null
            });
            Storage.saveHistory(history);
            this.loadHistoryTable();
            dependencies.utils.showToast('Preço salvo no histórico!', 'success');
        },

        autoLinkFirstResult(productId, results) {
            if (!results.length) return;
            const item = results[0];
            const product = dependencies.state.getProducts().find(p => p.id === productId);
            if (!product) return;
            
            const history = Storage.getHistory();
            history.push({
                id: dependencies.utils.generateId(),
                productName: item.title,
                price: item.price,
                store: item.seller || 'Mercado Livre',
                date: new Date().toISOString(),
                productId
            });
            Storage.saveHistory(history);
            dependencies.utils.showToast(`1º resultado vinculado automaticamente a "${product.nome}"`, 'info');
            
            // [FIX #9] Preenche input com formatCurrency (sem R$, padrão do campo) e dispara cálculo
            const input = document.getElementById(`market-input-${productId}`);
            if (input) {
                // O input tem prefixo "R$" fixo no input-group, então o valor deve ser apenas números
                input.value = dependencies.utils.formatCurrency(item.price); // "1.234,56"
                this.onMarketPriceInput(productId); // recalcula diff e sugerido imediatamente
            }
        },

        // =====================================================================
        // ABA ESTOQUE
        // =====================================================================
        renderStockComparisonRows() {
            const products = dependencies.state.getProducts() || [];
            if (products.length === 0) {
                return `<tr><td colspan="6" class="text-center text-muted py-4">
                    Nenhum produto cadastrado no estoque
                </td></tr>`;
            }
            
            return products.map(p => {
                const marketPrice = this.getLastLinkedMarketPrice(p.id);
                const hasMarket = marketPrice > 0;
                const diff = hasMarket ? p.preco - marketPrice : null;
                const diffPct = hasMarket ? ((p.preco / marketPrice) - 1) * 100 : null;
                const suggested = hasMarket ? marketPrice * CONFIG.ui.defaultMarkup : null;
                
                let diffBadge = '';
                if (diff !== null) {
                    const isAbove = diff > 0;
                    const cls = isAbove ? 'danger' : 'success';
                    const icon = isAbove ? '▲' : '▼';
                    diffBadge = `
                        <span class="badge bg-${cls}">
                            ${icon} ${dependencies.utils.formatCurrencyBR(Math.abs(diff))}
                            (${Math.abs(diffPct).toFixed(1)}%)
                        </span>`;
                }
                
                return `
                    <tr id="stock-row-${this.escapeHtml(p.id)}">
                        <td>
                            <strong>${this.escapeHtml(p.nome)}</strong>
                            <br>
                            <small class="text-muted">${this.escapeHtml(p.code || '')} · ${this.escapeHtml(p.categoria || '')}</small>
                        </td>
                        <td class="fw-bold">${dependencies.utils.formatCurrencyBR(p.preco)}</td>
                        <td>
                            <div class="input-group input-group-sm" style="min-width:140px;">
                                <span class="input-group-text">R$</span>
                                <input type="text"
                                       class="form-control market-price-input"
                                       id="market-input-${this.escapeHtml(p.id)}"
                                       placeholder="0,00"
                                       value="${hasMarket ? dependencies.utils.formatCurrency(marketPrice) : ''}"
                                       data-product-id="${this.escapeHtml(p.id)}"
                                       aria-label="Preço de mercado para ${this.escapeHtml(p.nome)}">
                            </div>
                        </td>
                        <td id="diff-cell-${this.escapeHtml(p.id)}">
                            ${diff !== null ? diffBadge : '<span class="text-muted small">—</span>'}
                        </td>
                        <td id="suggested-cell-${this.escapeHtml(p.id)}">
                            ${suggested !== null
                                ? `<span class="text-success fw-bold">${dependencies.utils.formatCurrencyBR(suggested)}</span>`
                                : '<span class="text-muted small">—</span>'}
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" 
                                    data-action="search-product"
                                    data-product-id="${this.escapeHtml(p.id)}"
                                    data-product-name="${this.escapeHtml(p.nome)}"
                                    title="Pesquisar este produto no mercado">
                                <i class="bi bi-search"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-success ms-1"
                                    data-action="apply-market"
                                    data-product-id="${this.escapeHtml(p.id)}"
                                    title="Salvar preço de mercado informado">
                                <i class="bi bi-save"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        },

        refreshStockComparison() {
            const body = this.elements['stock-comparison-body'];
            if (body) {
                body.innerHTML = this.renderStockComparisonRows();
            }
            this.renderStockComparisonChart();
        },

        getLastLinkedMarketPrice(productId) {
            const history = Storage.getHistory();
            const linked = history
                .filter(h => h.productId === productId)
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            return linked.length > 0 ? linked[0].price : 0;
        },

        onMarketPriceInput(productId) {
            const input = document.getElementById(`market-input-${productId}`);
            if (!input) return;
            
            // [FIX #5] usa parseCurrencyBR em vez de replace manual — suporta "1.234,56" e "1234.56"
            const marketPrice = dependencies.utils.parseCurrencyBR(input.value);
            
            const product = dependencies.state.getProducts().find(p => p.id === productId);
            if (!product) return;
            
            const diffCell      = document.getElementById(`diff-cell-${productId}`);
            const suggestedCell = document.getElementById(`suggested-cell-${productId}`);
            
            if (marketPrice > 0) {
                const diff      = product.preco - marketPrice;
                const diffPct   = ((product.preco / marketPrice) - 1) * 100;
                const suggested = marketPrice * CONFIG.ui.defaultMarkup;
                const isAbove   = diff > 0;
                const cls       = isAbove ? 'danger' : 'success';
                const icon      = isAbove ? '▲' : '▼';
                
                if (diffCell) {
                    diffCell.innerHTML = `
                        <span class="badge bg-${cls}">
                            ${icon} ${dependencies.utils.formatCurrencyBR(Math.abs(diff))} (${Math.abs(diffPct).toFixed(1)}%)
                        </span>`;
                }
                if (suggestedCell) {
                    suggestedCell.innerHTML = `<span class="text-success fw-bold">${dependencies.utils.formatCurrencyBR(suggested)}</span>`;
                }
            } else {
                if (diffCell)      diffCell.innerHTML      = '<span class="text-muted small">—</span>';
                if (suggestedCell) suggestedCell.innerHTML = '<span class="text-muted small">—</span>';
            }
        },

        async applyMarketPrice(productId) {
            const input = document.getElementById(`market-input-${productId}`);
            if (!input) return;
            
            // [FIX #5] usa parseCurrencyBR em vez de replace manual
            const marketPrice = dependencies.utils.parseCurrencyBR(input.value);
            
            if (marketPrice <= 0) {
                dependencies.utils.showToast('Informe um preço de mercado válido', 'warning');
                return;
            }
            
            const product = dependencies.state.getProducts().find(p => p.id === productId);
            if (!product) return;
            
            const history = Storage.getHistory();
            history.push({
                id: dependencies.utils.generateId(),
                productName: product.nome,
                price: marketPrice,
                store: 'Entrada manual',
                date: new Date().toISOString(),
                productId
            });
            Storage.saveHistory(history);

            dependencies.utils.showToast(`Preço de mercado salvo para ${product.nome}`, 'success');
            this.refreshStockComparison();

            // Pergunta se quer atualizar o preço de venda do produto no estoque
            if (dependencies.Swal) {
                const { isConfirmed } = await dependencies.Swal.fire({
                    title: 'Atualizar preço de venda?',
                    html: `
                        <p>Deseja atualizar o preço de venda de <strong>${this.escapeHtml(product.nome)}</strong> no estoque?</p>
                        <p class="text-muted">
                            Atual: <strong>${dependencies.utils.formatCurrencyBR(product.preco)}</strong>
                            &rarr; Novo: <strong>${dependencies.utils.formatCurrencyBR(marketPrice)}</strong>
                        </p>`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sim, atualizar',
                    cancelButtonText: 'Não'
                });

                if (isConfirmed) {
                    dependencies.state.updateProduct(productId, { preco: marketPrice });
                    dependencies.utils.showToast(`Preço de "${product.nome}" atualizado para ${dependencies.utils.formatCurrencyBR(marketPrice)}!`, 'success');
                    this.refreshStockComparison();
                }
            }
        },

        searchForProduct(productId, productName) {
            this.switchTab('search');
            const input = this.elements['price-search-input'];
            if (input) {
                input.value = productName;
                input.dataset.autoLinkProductId = productId;
            }
            this.triggerSearch();
        },

        renderStockComparisonChart() {
            const products = dependencies.state.getProducts() || [];
            const withMarket = products
                .map(p => ({ ...p, market: this.getLastLinkedMarketPrice(p.id) }))
                .filter(p => p.market > 0);
            
            const chartCard = this.elements['stock-chart-card'];
            if (withMarket.length === 0) {
                if (chartCard) chartCard.style.display = 'none';
                return;
            }
            if (chartCard) chartCard.style.display = '';
            
            const ctx = this.elements['stockComparisonChart']?.getContext('2d');
            Charts.createStockComparisonChart(ctx, withMarket);
        },

        exportStockComparison() {
            const products = dependencies.state.getProducts() || [];
            if (products.length === 0) {
                dependencies.utils.showToast('Nenhum produto para exportar', 'warning');
                return;
            }
            
            const data = products.map(p => {
                const market    = this.getLastLinkedMarketPrice(p.id);
                const diff      = market > 0 ? p.preco - market : null;
                const diffPct   = market > 0 ? ((p.preco / market) - 1) * 100 : null;
                const suggested = market > 0 ? market * CONFIG.ui.defaultMarkup : null;
                return {
                    'Produto':              p.nome,
                    'Código':               p.code || '',
                    // [FIX #6] valores numéricos puros — Excel processa diretamente
                    'Nosso Preço (R$)':          Number(p.preco.toFixed(2)),
                    'Preço de Mercado (R$)':      market  > 0   ? Number(market.toFixed(2))      : '',
                    'Diferença (R$)':             diff    !== null ? Number(diff.toFixed(2))     : '',
                    'Diferença (%)':              diffPct !== null ? Number(diffPct.toFixed(2))  : '',
                    'Preço Sugerido (R$)':        suggested !== null ? Number(suggested.toFixed(2)) : ''
                };
            });
            
            dependencies.utils.exportToCSV(data, `comparacao-estoque-${new Date().toISOString().split('T')[0]}.csv`);
            dependencies.utils.showToast('Comparação exportada!', 'success');
        },

        // =====================================================================
        // AÇÕES GLOBAIS
        // =====================================================================
        switchTab(tab) {
            this.state.activeTab = tab;
            
            this.show('tab-search', tab === 'search');
            this.show('tab-estoque', tab === 'estoque');
            
            const searchBtn = this.elements['tab-search-btn'];
            const estoqueBtn = this.elements['tab-estoque-btn'];
            
            if (searchBtn) {
                searchBtn.classList.toggle('active', tab === 'search');
                searchBtn.setAttribute('aria-selected', tab === 'search');
            }
            if (estoqueBtn) {
                estoqueBtn.classList.toggle('active', tab === 'estoque');
                estoqueBtn.setAttribute('aria-selected', tab === 'estoque');
            }
            
            if (tab === 'estoque') this.refreshStockComparison();
        },

        exportHistory() {
            const history = Storage.getHistory();
            if (history.length === 0) {
                dependencies.utils.showToast('Nenhum histórico para exportar', 'warning');
                return;
            }
            
            const data = history.map(h => ({
                'Produto':     h.productName,
                // [FIX #6] preço como número puro para o Excel processar
                'Preço (R$)':  Number((h.price || 0).toFixed(2)),
                'Loja':        h.store,
                'Data':        dependencies.utils.formatDate(h.date),
                'Vinculado a': h.productId
                    ? (dependencies.state.getProducts().find(p => p.id === h.productId)?.nome || 'Sim')
                    : 'Não'
            }));
            
            dependencies.utils.exportToCSV(data, `historico-precos-${new Date().toISOString().split('T')[0]}.csv`);
            dependencies.utils.showToast('Histórico exportado!', 'success');
        },

        async clearHistory() {
            const { isConfirmed } = await dependencies.utils.showConfirm(
                'Limpar histórico?', 
                'Todos os preços salvos serão apagados permanentemente.'
            );
            
            if (isConfirmed) {
                Storage.saveHistory([]);
                this.loadHistoryTable();
                dependencies.utils.showToast('Histórico limpo', 'info');
            }
        },

        analyzeProduct(historyId) {
            const item = Storage.getHistory().find(h => h.id === historyId);
            if (!item || !item.productId) {
                dependencies.utils.showToast('Este registro não está vinculado a um produto', 'warning');
                return;
            }
            const product = dependencies.state.getProducts().find(p => p.id === item.productId);
            if (product) this.showComparisonGraph(product, item);
        },

        showError(message) {
            const container = this.elements.mainContent;
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i>
                        ${this.escapeHtml(message)}
                    </div>`;
            }
        }
    };

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================
    function init() {
        Storage.migrateLegacy();
        UI.cacheElements();
        UI.renderMain();
    }

    // Auto-inicialização se o DOM já estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================================================
    // API PÚBLICA (exposta globalmente)
    // =========================================================================
    return {
        // Métodos principais
        render: () => UI.renderMain(),
        search: () => UI.triggerSearch(),
        switchTab: (tab) => UI.switchTab(tab),
        
        // Ações de resultados
        saveResult: (index) => UI.saveResult(index),
        linkToProduct: (index) => UI.linkToProduct(index),
        compareWithProduct: (index) => UI.compareWithProduct(index),
        
        // Ações de histórico
        analyzeProduct: (id) => UI.analyzeProduct(id),
        exportHistory: () => UI.exportHistory(),
        clearHistory: () => UI.clearHistory(),
        loadHistory: () => UI.loadHistoryTable(),
        
        // Ações da aba estoque
        onMarketPriceInput: (productId) => UI.onMarketPriceInput(productId),
        applyMarketPrice: (productId) => UI.applyMarketPrice(productId),
        searchForProduct: (productId, productName) => UI.searchForProduct(productId, productName),
        refreshStockComparison: () => UI.refreshStockComparison(),
        exportStockComparison: () => UI.exportStockComparison(),
        
        // Acesso ao histórico (para debug ou integração externa)
        getHistory: () => Storage.getHistory(),
        
        // Utilitários (para testes)
        _test: {
            UI,
            Storage,
            Api,
            Charts
        }
    };
})();