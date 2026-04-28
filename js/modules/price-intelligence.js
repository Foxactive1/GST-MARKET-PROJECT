/**
 * Módulo de Inteligência de Preços
 *
 * Melhorias aplicadas (v3.0.0 → v3.2.0):
 * - [SEGURANÇA]  XSS corrigido: ações nos resultados passam índice em vez de JSON inline.
 * - [SEGURANÇA]  Sanitização de dados externos da API (escapeHtml) em todo innerHTML.
 * - [BUG FIX]    Proxies CORS públicos substituídos por rota Flask local (/api/price-search).
 * - [BUG FIX]    searchDebounce movido do escopo global (window) para variável privada.
 * - [BUG FIX]    saveResult não chama mais search(); usa renderResults com currentResults.
 * - [BUG FIX]    getMarketAverage retornando 0 agora exibe aviso e usa fallback.
 * - [QUALIDADE]  Histórico limitado a MAX_HISTORY entradas (evita estourar localStorage).
 * - [QUALIDADE]  AbortSignal.timeout() substituído por AbortController (maior compatibilidade).
 * - [QUALIDADE]  saveToHistory() centraliza gravação no localStorage.
 * - [QUALIDADE]  Timeout elevado para 10s (adequado para rede móvel/Termux).
 *
 * Correções aplicadas (v3.2.0 → v3.3.0):
 * - [BUG FIX 1]  renderHistoryRows() protegida com try/catch: localStorage corrompido
 *                agora reseta a chave e exibe estado vazio em vez de quebrar render().
 * - [BUG FIX 2]  analyzeProduct() no histórico migrado de onclick inline com string
 *                para event delegation via data-id (evita quebra com IDs especiais).
 *                Adicionada initHistoryEvents() com flag _delegationAttached.
 * - [BUG FIX 3]  clearHistory() agora invalida searchCache (memória) e sessionStorage.
 *                Antes, dados antigos permaneciam visíveis após limpar o histórico.
 * - [BUG FIX 4]  Adicionada destroyCharts() chamada no início de render().
 *                Elimina memory leak e erro "Canvas is already in use" do Chart.js
 *                ao navegar entre módulos e retornar ao painel de preços.
 *
 * DEPENDÊNCIA BACKEND: adicionar ao app.py a rota /api/price-search
 * (ver comentário no bloco de constantes abaixo)
 *
 * @author Dione Castro Alves - InNovaIdeia
 * @version 3.3.0
 * @date 2026-04-27
 */

window.priceIntelligence = (function () {
    'use strict';

    // ========================================
    // DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo priceIntelligence: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo priceIntelligence: window.utils não definido');
            return false;
        }
        if (typeof Chart === 'undefined') {
            console.error('Erro no módulo priceIntelligence: Chart.js não encontrado');
            return false;
        }
        return true;
    }

    /**
     * [FIX 4] Destrói todas as instâncias Chart.js ativas antes de re-renderizar.
     * Sem isso, cada chamada a render() cria instâncias orphaned que vazam memória
     * e causam o aviso "Canvas is already in use" do Chart.js.
     */
    function destroyCharts() {
        Object.values(charts).forEach(chart => {
            try { chart?.destroy(); } catch (e) {}
        });
        charts = {};
    }

    // ========================================
    // CONSTANTES
    // ========================================

    /*
     * ROTA FLASK NECESSÁRIA — adicionar ao app.py:
     *
     * import requests
     * from flask import request, jsonify
     *
     * @app.route('/api/price-search')
     * def price_search():
     *     query = request.args.get('q', '').strip()
     *     if not query:
     *         return jsonify({'error': 'Parâmetro q obrigatório'}), 400
     *     try:
     *         url  = f'https://api.mercadolibre.com/sites/MLB/search?q={requests.utils.quote(query)}&limit=10'
     *         resp = requests.get(url, timeout=10)
     *         resp.raise_for_status()
     *         return jsonify(resp.json())
     *     except requests.exceptions.Timeout:
     *         return jsonify({'error': 'Timeout ao consultar Mercado Livre'}), 504
     *     except requests.exceptions.RequestException as e:
     *         return jsonify({'error': str(e)}), 502
     */
    const ML_PROXY_URL   = '/api/price-search?q='; // proxy local Flask — sem CORS
    const STORAGE_KEY    = 'price_intelligence_history';
    const MAX_RESULTS    = 10;
    const MAX_HISTORY    = 200;    // limite de entradas no localStorage
    const DEFAULT_MARKUP = 1.20;   // 20% sobre a média de mercado
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos em ms

    // ========================================
    // ESTADO INTERNO
    // ========================================
    let searchCache    = {};   // { termo: { timestamp, results[] } }
    let currentResults = [];   // referência segura para ações por índice (evita XSS)
    let charts         = {};   // instâncias ativas do Chart.js
    let searchDebounce = null; // era window.searchDebounce — agora privado ao módulo

    // ========================================
    // UTILITÁRIO: SANITIZAÇÃO DE HTML
    // ========================================
    /**
     * Escapa caracteres especiais para evitar injeção de HTML/XSS.
     * Aplicado em todos os dados externos antes de inserir no DOM.
     * @param {*} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#39;');
    }

    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    function init() {
        // Garante que o histórico existe no localStorage
        if (!localStorage.getItem(STORAGE_KEY)) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        }
        // Restaura cache da sessão (válido apenas enquanto a aba estiver aberta)
        try {
            const cached = sessionStorage.getItem('price_search_cache');
            if (cached) searchCache = JSON.parse(cached);
        } catch (e) {
            console.warn('Erro ao carregar cache da sessão:', e);
        }
    }

    // ========================================
    // RENDERIZAÇÃO PRINCIPAL
    // ========================================
    function render() {
        // [FIX 4] Destrói gráficos órfãos antes de reescrever o DOM.
        // Evita memory leak e o erro "Canvas is already in use" do Chart.js.
        destroyCharts();

        if (!checkDependencies()) {
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Erro ao carregar módulo de Inteligência de Preços. Dependências não encontradas.
                </div>
            `;
            return;
        }

        const container = document.getElementById('mainContent');
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
                            Pesquise preços da concorrência, compare e otimize sua precificação
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-outline-secondary" onclick="window.priceIntelligence.exportHistory()">
                            <i class="bi bi-download"></i> Exportar Histórico
                        </button>
                        <button class="btn btn-outline-danger ms-2" onclick="window.priceIntelligence.clearHistory()">
                            <i class="bi bi-trash"></i> Limpar Histórico
                        </button>
                    </div>
                </div>

                <!-- Área de Pesquisa -->
                <div class="card-modern mb-4">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-8">
                            <label class="form-label small-muted">Produto / Palavra-chave</label>
                            <div class="input-group">
                                <span class="input-group-text"><i class="bi bi-search"></i></span>
                                <input type="text"
                                       id="price-search-input"
                                       class="form-control form-control-lg"
                                       placeholder="Ex: Arroz Tio João 5kg"
                                       autocomplete="off">
                            </div>
                        </div>
                        <div class="col-md-4">
                            <button class="btn btn-primary w-100 btn-lg" onclick="window.priceIntelligence.search()">
                                <i class="bi bi-search"></i> Pesquisar
                            </button>
                        </div>
                    </div>
                    <small class="text-muted mt-2 d-block">
                        <i class="bi bi-info-circle"></i>
                        A pesquisa é feita na API do Mercado Livre. Resultados em cache por 10 minutos.
                    </small>
                </div>

                <!-- Resultados da Pesquisa -->
                <div class="card-modern mb-4" id="results-card" style="display: none;">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-list-ul"></i> Resultados
                        </h5>
                        <span class="badge bg-primary" id="results-count">0</span>
                    </div>
                    <div class="table-responsive">
                        <table class="table-modern" id="results-table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Preço</th>
                                    <th>Vendedor</th>
                                    <th style="width: 200px;">Ações</th>
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

                <!-- Área de Análise e Gráficos (aparece ao comparar/analisar) -->
                <div class="card-modern mt-4" id="analysis-card" style="display: none;">
                    <h5 class="card-title mb-3">
                        <i class="bi bi-bar-chart-steps"></i> Análise de Preços
                    </h5>
                    <!-- Aviso exibido quando não há histórico suficiente para média -->
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
                                <div class="metric-label">Preço Sugerido (com markup de 20%)</div>
                                <div class="metric-value text-success" id="analysis-suggested">R$ 0,00</div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div style="height: 250px;">
                                <canvas id="comparisonChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-12">
                            <div style="height: 250px;">
                                <canvas id="trendChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Histórico de Preços -->
                <div class="card-modern mt-4">
                    <h5 class="card-title mb-3">
                        <i class="bi bi-clock-history"></i> Histórico de Preços Pesquisados
                    </h5>
                    <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                        <table class="table-modern">
                            <thead style="position: sticky; top: 0; background: var(--bs-body-bg);">
                                <tr>
                                    <th>Produto</th>
                                    <th>Preço</th>
                                    <th>Loja</th>
                                    <th>Data</th>
                                    <th>Vínculo</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="history-body">
                                ${renderHistoryRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        initSearchEvents();
        loadHistory();
    }

    // ========================================
    // RENDERIZAÇÃO DO HISTÓRICO
    // ========================================
    function renderHistoryRows() {
        // [FIX 1] Protege contra localStorage corrompido — se getHistory() lançar,
        // reseta a chave e exibe estado vazio em vez de quebrar o render() inteiro.
        let history = [];
        try {
            history = getHistory();
        } catch (e) {
            console.error('[priceIntelligence] Histórico corrompido, resetando:', e);
            try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        }

        if (history.length === 0) {
            return `<tr><td colspan="6" class="text-center text-muted py-4">Nenhum preço pesquisado ainda</td></tr>`;
        }

        // Exibe os 50 mais recentes (localStorage preserva até MAX_HISTORY)
        const sorted = [...history]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 50);

        return sorted.map(item => {
            const safeName  = escapeHtml(item.productName);
            const safeStore = escapeHtml(item.store || 'Mercado Livre');
            const safeId    = escapeHtml(item.id);

            const productLink = item.productId
                ? `<span class="badge bg-success" title="Vinculado a produto do sistema">${safeName}</span>`
                : `<span class="text-muted">Não vinculado</span>`;

            // [FIX 2] onclick com string removido — usa data-id + event delegation
            // (evita quebra quando item.id contém aspas mesmo após escapeHtml)
            return `
                <tr>
                    <td>${safeName}</td>
                    <td class="text-primary fw-bold">R$ ${window.utils.formatCurrency(item.price)}</td>
                    <td>${safeStore}</td>
                    <td>${window.utils.formatDate(item.date)}</td>
                    <td>${productLink}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-analyze-history"
                                data-id="${safeId}">
                            <i class="bi bi-graph-up"></i> Analisar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * [FIX 2] Registra event delegation no history-body após inserir as linhas.
     * Chamado em loadHistory() — substitui onclick inline para analyzeProduct.
     */
    function initHistoryEvents() {
        const historyBody = document.getElementById('history-body');
        if (!historyBody || historyBody._delegationAttached) return;
        historyBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-analyze-history');
            if (btn) analyzeProduct(btn.dataset.id);
        });
        // Marca para não registrar o listener mais de uma vez por render()
        historyBody._delegationAttached = true;
    }

    // ========================================
    // EVENTOS DE PESQUISA
    // ========================================
    function initSearchEvents() {
        const input = document.getElementById('price-search-input');
        if (!input) return;

        input.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                if (input.value.trim().length >= 3) search();
            }, 500);
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                search();
            }
        });
    }

    // ========================================
    // PESQUISA VIA PROXY FLASK LOCAL
    // ========================================
    /**
     * Realiza a pesquisa via rota Flask local (/api/price-search).
     * Elimina dependência de proxies CORS públicos e funciona corretamente
     * em ambiente localhost (Termux/Android/Dcoder).
     */
    async function search() {
        const input = document.getElementById('price-search-input');
        const query = input?.value.trim();
        if (!query) {
            window.utils.showToast('Digite um produto para pesquisar', 'warning');
            return;
        }

        // Verifica cache antes de chamar o backend
        const cached = searchCache[query];
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            currentResults = cached.results;
            renderResults(cached.results, query);
            return;
        }

        // Exibe spinner de carregamento
        const resultsCard = document.getElementById('results-card');
        const resultsBody = document.getElementById('results-body');
        if (resultsCard) resultsCard.style.display = 'block';
        if (resultsBody) {
            resultsBody.innerHTML = `
                <tr><td colspan="4" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Pesquisando...</span>
                    </div>
                    <div class="text-muted mt-2 small">Consultando Mercado Livre...</div>
                </td></tr>
            `;
        }

        try {
            // AbortController para timeout — compatível com Chrome/Android antigo
            const controller = new AbortController();
            const timeoutId  = setTimeout(() => controller.abort(), 10000); // 10s

            const response = await fetch(ML_PROXY_URL + encodeURIComponent(query), {
                method:  'GET',
                headers: { 'Accept': 'application/json' },
                signal:  controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            // Trata erro estruturado retornado pelo Flask
            if (data.error) throw new Error(data.error);

            const results = (data.results || []).slice(0, MAX_RESULTS);

            // Persiste cache na sessão
            searchCache[query] = { timestamp: Date.now(), results };
            try {
                sessionStorage.setItem('price_search_cache', JSON.stringify(searchCache));
            } catch (e) {
                console.warn('Cache da sessão cheio, ignorando:', e);
            }

            currentResults = results;
            renderResults(results, query);

        } catch (error) {
            console.error('Erro na pesquisa de preços:', error);

            const isTimeout = error.name === 'AbortError';
            const msg = isTimeout
                ? 'Tempo limite excedido. Verifique sua conexão e tente novamente.'
                : `Falha ao pesquisar: ${error.message || 'erro desconhecido'}`;

            window.utils.showToast(msg, 'danger');

            if (resultsBody) {
                resultsBody.innerHTML = `
                    <tr><td colspan="4" class="text-center text-danger py-4">
                        <i class="bi bi-wifi-off"></i> ${escapeHtml(msg)}
                    </td></tr>
                `;
            }
        }
    }

    // ========================================
    // RENDERIZAÇÃO DOS RESULTADOS
    // ========================================
    function renderResults(results, query) {
        const resultsBody  = document.getElementById('results-body');
        const resultsCount = document.getElementById('results-count');
        if (!resultsBody) return;

        if (results.length === 0) {
            resultsBody.innerHTML = `
                <tr><td colspan="4" class="text-center text-muted py-4">
                    Nenhum resultado encontrado para "${escapeHtml(query)}"
                </td></tr>
            `;
            if (resultsCount) resultsCount.textContent = '0';
            return;
        }

        if (resultsCount) resultsCount.textContent = results.length;

        // [FIX XSS] onclick usa índice numérico — objeto recuperado de currentResults[index]
        resultsBody.innerHTML = results.map((item, index) => {
            const price  = item.price || 0;
            const title  = escapeHtml(item.title);
            const store  = escapeHtml(item.seller?.nickname || 'Mercado Livre');
            const exists = checkIfExistsInHistory(item.title, price);

            return `
                <tr>
                    <td>${title}</td>
                    <td class="text-primary fw-bold">R$ ${window.utils.formatCurrency(price)}</td>
                    <td>${store}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            ${exists
                                ? '<span class="badge bg-secondary">Já salvo</span>'
                                : `<button class="btn btn-outline-success"
                                           onclick="window.priceIntelligence.saveResult(${index})">
                                       <i class="bi bi-save"></i> Salvar
                                   </button>`
                            }
                            <button class="btn btn-outline-primary"
                                    onclick="window.priceIntelligence.linkToProduct(${index})">
                                <i class="bi bi-link"></i>
                            </button>
                            <button class="btn btn-outline-info"
                                    onclick="window.priceIntelligence.compareWithProduct(${index})">
                                <i class="bi bi-graph-up"></i> Comparar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ========================================
    // COMPARAÇÃO E GRÁFICOS
    // ========================================

    /**
     * Abre modal para comparar item dos resultados com produto do sistema.
     * @param {number} index - índice em currentResults
     */
    function compareWithProduct(index) {
        const item = currentResults[index];
        if (!item) return;

        const products = window.state.getProducts();
        if (products.length === 0) {
            window.utils.showToast('Nenhum produto cadastrado para comparar', 'warning');
            return;
        }

        let options = '<option value="">Selecione um produto...</option>';
        products.forEach(p => {
            options += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)} (R$ ${window.utils.formatCurrency(p.preco)})</option>`;
        });

        Swal.fire({
            title: 'Comparar Preços',
            html: `
                <div class="text-start">
                    <p><strong>Produto pesquisado:</strong> ${escapeHtml(item.title)}</p>
                    <p><strong>Preço:</strong> R$ ${window.utils.formatCurrency(item.price)}</p>
                    <hr>
                    <label class="form-label">Selecione o produto do sistema</label>
                    <select id="compare-product-select" class="form-select">${options}</select>
                </div>
            `,
            showCancelButton:  true,
            confirmButtonText: 'Comparar',
            cancelButtonText:  'Cancelar',
            preConfirm: () => {
                const productId = document.getElementById('compare-product-select').value;
                if (!productId) {
                    Swal.showValidationMessage('Selecione um produto');
                    return false;
                }
                return productId;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const product = products.find(p => p.id === result.value);
                if (product) showComparisonGraph(product, item);
            }
        });
    }

    function showComparisonGraph(product, marketItem) {
        document.getElementById('analysis-card').style.display = 'block';
        document.getElementById('analysis-our-price').textContent =
            `R$ ${window.utils.formatCurrency(product.preco)}`;

        // [FIX] Se não há histórico suficiente, usa preço atual como fallback e avisa
        let marketAvg        = getMarketAverage(product.nome);
        let noHistoryWarning = false;

        if (marketAvg === 0) {
            marketAvg        = marketItem.price || 0;
            noHistoryWarning = true;
        }

        const suggested = marketAvg * DEFAULT_MARKUP;

        const warningEl = document.getElementById('analysis-no-history');
        if (warningEl) warningEl.classList.toggle('d-none', !noHistoryWarning);

        document.getElementById('analysis-market-avg').textContent =
            `R$ ${window.utils.formatCurrency(marketAvg)}`;
        document.getElementById('analysis-suggested').textContent =
            `R$ ${window.utils.formatCurrency(suggested)}`;

        // Gráfico de barras comparativo
        const ctxBar = document.getElementById('comparisonChart').getContext('2d');
        if (charts.comparison) charts.comparison.destroy();

        charts.comparison = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: ['Nosso Preço', 'Média do Mercado', 'Preço Sugerido'],
                datasets: [{
                    label: 'Preço (R$)',
                    data: [product.preco, marketAvg, suggested],
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
                            label: ctx => `R$ ${window.utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: val => 'R$ ' + val.toFixed(2) }
                    }
                }
            }
        });

        // Gráfico de linha — tendência dos últimos 90 dias
        const trendData = getPriceTrend(product.nome);
        const ctxLine   = document.getElementById('trendChart').getContext('2d');
        if (charts.trend) charts.trend.destroy();

        charts.trend = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: trendData.dates,
                datasets: [{
                    label: 'Preço de Mercado (R$)',
                    data: trendData.prices,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
                            label: ctx => `R$ ${window.utils.formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: val => 'R$ ' + val.toFixed(2) }
                    }
                }
            }
        });
    }

    /**
     * Média dos preços de um produto nos últimos 30 dias.
     * Retorna 0 quando não há histórico suficiente.
     * @param {string} productName
     * @returns {number}
     */
    function getMarketAverage(productName) {
        const history = getHistory();
        const cutoff  = new Date();
        cutoff.setDate(cutoff.getDate() - 30);

        const relevant = history.filter(item =>
            item.productName.toLowerCase().includes(productName.toLowerCase()) &&
            new Date(item.date) >= cutoff
        );

        if (relevant.length === 0) return 0;
        return relevant.reduce((acc, cur) => acc + cur.price, 0) / relevant.length;
    }

    /**
     * Dados para gráfico de tendência (datas + preços, últimos 90 dias).
     * @param {string} productName
     * @returns {{ dates: string[], prices: number[] }}
     */
    function getPriceTrend(productName) {
        const history = getHistory();
        const cutoff  = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        const filtered = history
            .filter(item =>
                item.productName.toLowerCase().includes(productName.toLowerCase()) &&
                new Date(item.date) >= cutoff
            )
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return {
            dates:  filtered.map(item => window.utils.formatDate(item.date)),
            prices: filtered.map(item => item.price)
        };
    }

    // ========================================
    // HISTÓRICO E VÍNCULO
    // ========================================

    /**
     * Verifica se produto com mesmo preço foi salvo nas últimas 24h.
     */
    function checkIfExistsInHistory(productName, price) {
        const history   = getHistory();
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return history.some(item =>
            item.productName === productName &&
            Math.abs(item.price - price) < 0.01 &&
            new Date(item.date) > oneDayAgo
        );
    }

    /**
     * Salva resultado no histórico pelo índice de currentResults.
     * @param {number} index
     */
    function saveResult(index) {
        const item = currentResults[index];
        if (!item) return;

        const history = getHistory();
        history.push({
            id:          window.utils.generateId(),
            productName: item.title,
            price:       item.price,
            store:       item.seller?.nickname || 'Mercado Livre',
            date:        new Date().toISOString(),
            productId:   null
        });

        saveToHistory(history);
        window.utils.showToast('Preço salvo no histórico', 'success');
        loadHistory();

        // [FIX] Re-renderiza sem chamar search() — evita nova requisição à API
        const query = document.getElementById('price-search-input')?.value.trim() || '';
        renderResults(currentResults, query);
    }

    /**
     * Vincula item dos resultados a um produto do sistema.
     * @param {number} index
     */
    function linkToProduct(index) {
        const item     = currentResults[index];
        if (!item) return;

        const products = window.state.getProducts();
        if (products.length === 0) {
            window.utils.showToast('Nenhum produto cadastrado para vincular', 'warning');
            return;
        }

        let options = '<option value="">Selecione um produto...</option>';
        products.forEach(p => {
            options += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)} (R$ ${window.utils.formatCurrency(p.preco)})</option>`;
        });

        Swal.fire({
            title: 'Vincular a Produto',
            html: `
                <div class="text-start">
                    <p><strong>Produto pesquisado:</strong> ${escapeHtml(item.title)}</p>
                    <p><strong>Preço:</strong> R$ ${window.utils.formatCurrency(item.price)}</p>
                    <hr>
                    <label class="form-label">Selecione o produto do sistema</label>
                    <select id="link-product-select" class="form-select">${options}</select>
                </div>
            `,
            showCancelButton:  true,
            confirmButtonText: 'Vincular',
            cancelButtonText:  'Cancelar',
            preConfirm: () => {
                const productId = document.getElementById('link-product-select').value;
                if (!productId) {
                    Swal.showValidationMessage('Selecione um produto');
                    return false;
                }
                return productId;
            }
        }).then((result) => {
            if (!result.isConfirmed) return;

            const productId = result.value;
            const history   = getHistory();
            history.push({
                id:          window.utils.generateId(),
                productName: item.title,
                price:       item.price,
                store:       item.seller?.nickname || 'Mercado Livre',
                date:        new Date().toISOString(),
                productId:   productId
            });

            saveToHistory(history);
            window.utils.showToast('Preço vinculado e salvo!', 'success');
            loadHistory();

            const product = products.find(p => p.id === productId);
            if (product) {
                Swal.fire({
                    title: 'Atualizar preço do produto?',
                    text:  `O preço atual é R$ ${window.utils.formatCurrency(product.preco)}. Deseja alterar para R$ ${window.utils.formatCurrency(item.price)}?`,
                    icon:  'question',
                    showCancelButton:  true,
                    confirmButtonText: 'Sim, atualizar',
                    cancelButtonText:  'Não'
                }).then((updateResult) => {
                    if (updateResult.isConfirmed) {
                        window.state.updateProduct(productId, { preco: item.price });
                        window.utils.showToast('Preço do produto atualizado!', 'success');
                    }
                });
            }
        });
    }

    function loadHistory() {
        const historyBody = document.getElementById('history-body');
        if (!historyBody) return;
        historyBody._delegationAttached = false; // reseta flag para re-registrar
        historyBody.innerHTML = renderHistoryRows();
        initHistoryEvents(); // [FIX 2] registra delegation após DOM populado
    }

    /**
     * Lê o histórico do localStorage com tratamento de erro.
     * @returns {Array}
     */
    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch (e) {
            console.error('Erro ao ler histórico:', e);
            return [];
        }
    }

    /**
     * Centraliza gravação no localStorage com limite MAX_HISTORY.
     * Mantém sempre as entradas mais recentes.
     * @param {Array} history
     */
    function saveToHistory(history) {
        const trimmed = history.length > MAX_HISTORY
            ? history.slice(-MAX_HISTORY)
            : history;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }

    function exportHistory() {
        const history = getHistory();
        if (history.length === 0) {
            window.utils.showToast('Nenhum histórico para exportar', 'warning');
            return;
        }

        const data = history.map(item => ({
            'Produto':     item.productName,
            'Preço':       window.utils.formatCurrency(item.price),
            'Loja':        item.store,
            'Data':        window.utils.formatDate(item.date),
            'Vinculado a': item.productId
                ? window.state.getProducts().find(p => p.id === item.productId)?.nome || 'Sim'
                : 'Não'
        }));

        window.utils.exportToCSV(data, `historico-precos-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast('Histórico exportado!', 'success');
    }

    function clearHistory() {
        window.utils.showConfirm('Limpar histórico?', 'Todos os preços salvos serão apagados permanentemente.')
            .then((result) => {
                if (result.isConfirmed) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

                    // [FIX 3] Invalida cache em memória e sessionStorage ao limpar histórico.
                    // Sem isso, resultados antigos permaneciam visíveis na sessão atual.
                    searchCache = {};
                    try { sessionStorage.removeItem('price_search_cache'); } catch (e) {}

                    loadHistory();
                    window.utils.showToast('Histórico limpo', 'info');
                }
            });
    }

    function analyzeProduct(historyId) {
        const history = getHistory();
        const item    = history.find(h => h.id === historyId);
        if (!item || !item.productId) {
            window.utils.showToast('Este registro não está vinculado a um produto', 'warning');
            return;
        }
        const product = window.state.getProducts().find(p => p.id === item.productId);
        if (!product) return;
        showComparisonGraph(product, item);
    }

    // Inicialização do módulo
    init();

    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        render,
        search,
        saveResult,
        linkToProduct,
        compareWithProduct,
        analyzeProduct,
        exportHistory,
        clearHistory,
        getHistory,
        loadHistory
    };

})();
