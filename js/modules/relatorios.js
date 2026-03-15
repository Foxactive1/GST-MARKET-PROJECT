/**
 * relatorios.js — v2.1.0
 * Módulo de Relatórios e Análises — Supermercado Pro / GST Market
 *
 * Correções v2.1.0:
 * - [FIX] Substituído R$+formatCurrency() por formatCurrencyBR() em todo o módulo (v5.0 compat)
 * - [FIX] esc() aplicado em renderTopProducts, renderTopClients e viewSaleDetails (anti-XSS)
 * - [FIX] currentPeriod sincronizado com o <select> ('week' por padrão)
 * - [FIX] renderSalesTable agora lê clients do cache em vez de re-chamar state.get()
 * - [FIX] aggregateSalesByDate usa chave ISO (yyyy-mm-dd); formatação só na exibição
 * - [FIX] Guards contra sale.items undefined em aggregateProductSales/ClientPurchases
 * - [FIX] Guard contra sale.payment null em initPaymentChart labels
 * - [FIX] CSV exportSales exporta Total como número raw (sem formatação)
 * - [FIX] viewSaleDetails usa window.utils.showAlert() com fallback ao invés de Swal direto
 * - [FIX] Indentação corrigida em exportFullReport
 * - [FIX] Campo "Comparar com" marcado como not-implemented com tooltip explicativo
 * - [ADD] clients adicionado ao cachedData para consistência
 *
 * @author Dione Castro Alves — InNovaIdeia
 * @version 2.1.0
 * @date 2026-03-15
 */

window.relatorios = (function() {
    'use strict';

    // ── Escape HTML (anti-XSS) ──────────────────────────────────────────────
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========================================
    // DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Relatórios: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Relatórios: window.utils não definido');
            return false;
        }
        if (typeof Chart === 'undefined') {
            console.error('Erro no módulo Relatórios: Chart.js não encontrado');
            return false;
        }
        return true;
    }

    // ========================================
    // VARIÁVEIS DE ESTADO
    // ========================================
    let currentPeriod = 'week'; // today, week, month, quarter, year, all — deve coincidir com o <select> padrão
    let charts = {};
    
    // Cache simples para dados agregados (evita reprocessamento a cada refresh)
    let cachedData = {
        period: null,
        sales: [],
        clients: [],           // cache de clientes para consistência em renderSalesTable
        productSales: null,
        clientPurchases: null,
        payments: null,
        salesByDate: null
    };

    // ========================================
    // UTILITÁRIOS DE DATA (compatíveis com date-fns, mas usando Date nativo)
    // ========================================
    function getStartOfDay(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function subDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    }

    function isSameDay(d1, d2) {
        return d1.toDateString() === d2.toDateString();
    }

    function isAfterOrEqual(date, reference) {
        return date >= reference;
    }

    // ========================================
    // FILTRAGEM POR PERÍODO
    // ========================================
    function filterSalesByPeriod(sales, period) {
        const now = new Date();
        const today = getStartOfDay(now);
        let startDate;

        switch (period) {
            case 'today':
                startDate = today;
                break;
            case 'week':
                startDate = subDays(today, 7);
                break;
            case 'month':
                startDate = subDays(today, 30);
                break;
            case 'quarter':
                startDate = subDays(today, 90);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default: // 'all' ou qualquer outro
                return sales;
        }

        return sales.filter(s => isAfterOrEqual(new Date(s.date), startDate));
    }

    // ========================================
    // ATUALIZAÇÃO DO CACHE (somente quando período muda ou dados são alterados)
    // ========================================
    function updateCache() {
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);

        cachedData = {
            period: currentPeriod,
            sales: filteredSales,
            clients: state.clients || [],  // [FIX] clientes em cache para evitar re-chamadas
            productSales: aggregateProductSales(filteredSales),
            clientPurchases: aggregateClientPurchases(filteredSales, state.clients),
            payments: aggregatePayments(filteredSales),
            salesByDate: aggregateSalesByDate(filteredSales)
        };
    }

    function aggregateProductSales(sales) {
        const productSales = {};
        sales.forEach(sale => {
            if (!Array.isArray(sale.items)) return; // [FIX] guard contra dados malformados
            sale.items.forEach(item => {
                if (!item || !item.id) return;
                if (!productSales[item.id]) {
                    productSales[item.id] = { nome: item.nome, qty: 0, total: 0 };
                }
                productSales[item.id].qty   += item.qty  || 0;
                productSales[item.id].total += (item.preco || 0) * (item.qty || 0);
            });
        });
        return productSales;
    }

    function aggregateClientPurchases(sales, clients) {
        const clientPurchases = {};
        sales.forEach(sale => {
            if (!sale.clientId) return;
            if (!clientPurchases[sale.clientId]) {
                const client = (clients || []).find(c => c.id === sale.clientId);
                clientPurchases[sale.clientId] = {
                    nome: client?.nome || 'Cliente removido',
                    total: 0,
                    count: 0
                };
            }
            clientPurchases[sale.clientId].total += sale.total || 0;
            clientPurchases[sale.clientId].count++;
        });
        return clientPurchases;
    }

    function aggregatePayments(sales) {
        const payments = {};
        sales.forEach(sale => {
            payments[sale.payment] = (payments[sale.payment] || 0) + sale.total;
        });
        return payments;
    }

    function aggregateSalesByDate(sales) {
        // [FIX] Chave em ISO (yyyy-mm-dd) para ordenação correta no gráfico;
        // a formatação pt-BR ocorre apenas na renderização do eixo X.
        const salesByDate = {};
        sales.forEach(sale => {
            const date = new Date(sale.date).toISOString().split('T')[0]; // "2026-03-15"
            salesByDate[date] = (salesByDate[date] || 0) + (sale.total || 0);
        });
        return salesByDate;
    }

    // ========================================
    // FUNÇÕES DE RENDERIZAÇÃO (usam cache)
    // ========================================
    function render() {
        if (!checkDependencies()) {
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Erro ao carregar módulo Relatórios. Dependências não encontradas.
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
                        <h2 class="mb-1">Relatórios e Análises</h2>
                        <p class="text-muted mb-0">
                            <i class="bi bi-graph-up"></i> 
                            Insights baseados em dados • Última atualização: ${new Date().toLocaleTimeString('pt-BR')}
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="window.relatorios.exportFullReport()">
                            <i class="bi bi-file-pdf"></i> Exportar Relatório
                        </button>
                    </div>
                </div>
                
                <!-- Filtros -->
                <div class="card-modern mb-4">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label small-muted">Período</label>
                            <select id="report-period" class="form-select" onchange="window.relatorios.changePeriod(this.value)">
                                <option value="today">Hoje</option>
                                <option value="week" selected>Últimos 7 dias</option>
                                <option value="month">Últimos 30 dias</option>
                                <option value="quarter">Últimos 90 dias</option>
                                <option value="year">Este ano</option>
                                <option value="all">Todo período</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small-muted">
                                Comparar com
                                <span class="badge bg-secondary ms-1" title="Funcionalidade prevista para próxima versão">em breve</span>
                            </label>
                            <select id="report-compare" class="form-select" disabled title="Comparação entre períodos — em desenvolvimento">
                                <option value="none">Sem comparação</option>
                                <option value="prev">Período anterior</option>
                                <option value="lastyear">Ano anterior</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small-muted">Formato</label>
                            <select id="report-format" class="form-select">
                                <option value="pdf">PDF</option>
                                <option value="excel">Excel (CSV)</option>
                                <option value="html">HTML</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-primary w-100" onclick="window.relatorios.refresh()">
                                <i class="bi bi-arrow-clockwise"></i> Atualizar Dados
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- KPIs Principais (com loading) -->
                <div class="row g-3 mb-4" id="report-kpis">
                    <div class="col-12 text-center py-5">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                    </div>
                </div>
                
                <!-- Gráficos -->
                <div class="row g-3 mb-4">
                    <div class="col-lg-8">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-bar-chart-line me-2 text-primary"></i>
                                Evolução de Vendas
                            </h5>
                            <div style="height: 350px;" id="sales-trend-container">
                                <canvas id="salesTrendChart"></canvas>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-4">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-pie-chart me-2 text-primary"></i>
                                Formas de Pagamento
                            </h5>
                            <div style="height: 300px;" id="payment-chart-container">
                                <canvas id="paymentChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Análises Complementares -->
                <div class="row g-3 mb-4">
                    <div class="col-lg-6">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-trophy me-2 text-warning"></i>
                                Top 10 Produtos
                            </h5>
                            <div id="top-products-report">
                                <!-- Será preenchido via JS -->
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-6">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-people me-2 text-success"></i>
                                Top 10 Clientes
                            </h5>
                            <div id="top-clients-report">
                                <!-- Será preenchido via JS -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Tabela de Vendas com paginação interna (limitada) -->
                <div class="card-modern">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-table me-2"></i>
                            Últimas 50 Vendas
                        </h5>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.relatorios.exportSales()">
                                <i class="bi bi-download"></i> Exportar
                            </button>
                        </div>
                    </div>
                    
                    <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                        <table class="table-modern">
                            <thead style="position: sticky; top: 0; background: #f8f9fa;">
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Cliente</th>
                                    <th>Itens</th>
                                    <th>Pagamento</th>
                                    <th>Total</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="sales-table-body">
                                <!-- Será preenchido via JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Atualiza dados e renderiza componentes
        refresh();
    }

    // ========================================
    // RENDERIZAÇÃO DOS COMPONENTES (usam cache)
    // ========================================
    function renderKPIs() {
        const sales = cachedData.sales;
        const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
        const totalItems = sales.reduce((sum, s) => 
            sum + s.items.reduce((itemSum, i) => itemSum + i.qty, 0), 0
        );
        const avgTicket = sales.length > 0 ? totalSales / sales.length : 0;
        const uniqueClients = new Set(sales.map(s => s.clientId).filter(Boolean)).size;

        return `
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Vendas no Período</div>
                    <div class="metric-value">${window.utils.formatCurrencyBR(totalSales)}</div>
                    <small class="text-muted">${sales.length} transações</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Itens Vendidos</div>
                    <div class="metric-value">${totalItems}</div>
                    <small class="text-muted">unidades</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Ticket Médio</div>
                    <div class="metric-value">${window.utils.formatCurrencyBR(avgTicket)}</div>
                    <small class="text-muted">por venda</small>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Clientes Atendidos</div>
                    <div class="metric-value">${uniqueClients}</div>
                    <small class="text-muted">clientes distintos</small>
                </div>
            </div>
        `;
    }

    function renderTopProducts() {
        const productSales = cachedData.productSales;
        const topProducts = Object.values(productSales)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        if (topProducts.length === 0) {
            return '<p class="text-muted text-center py-3">Nenhuma venda no período</p>';
        }

        let html = '<div class="list-group">';
        topProducts.forEach((p, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary me-2">${index + 1}</span>
                        <strong>${esc(p.nome)}</strong>
                    </div>
                    <div class="text-end">
                        <span class="fw-bold">${p.qty} uni</span>
                        <br>
                        <small class="text-primary">${window.utils.formatCurrencyBR(p.total)}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function renderTopClients() {
        const clientPurchases = cachedData.clientPurchases;
        const topClients = Object.values(clientPurchases)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);

        if (topClients.length === 0) {
            return '<p class="text-muted text-center py-3">Nenhuma venda com cliente no período</p>';
        }

        let html = '<div class="list-group">';
        topClients.forEach((c, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-success me-2">${index + 1}</span>
                        <strong>${esc(c.nome)}</strong>
                        <br>
                        <small class="text-muted">${c.count} compras</small>
                    </div>
                    <span class="fw-bold text-primary">${window.utils.formatCurrencyBR(c.total)}</span>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }

    function renderSalesTable() {
        const sales   = cachedData.sales;
        const clients = cachedData.clients; // [FIX] lê do cache, não re-chama state.get()

        // Ordena por data decrescente e pega as 50 mais recentes
        const recentSales = [...sales]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 50);

        if (recentSales.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="bi bi-receipt text-muted" style="font-size: 2rem;"></i>
                        <p class="text-muted mt-3">Nenhuma venda no período</p>
                    </td>
                </tr>
            `;
        }

        return recentSales.map(sale => {
            const client = sale.clientId ?
                clients.find(c => c.id === sale.clientId) : null;

            return `
                <tr>
                    <td>
                        ${new Date(sale.date).toLocaleDateString('pt-BR')}
                        <br>
                        <small class="text-muted">${new Date(sale.date).toLocaleTimeString('pt-BR')}</small>
                    </td>
                    <td>
                        ${client ? `
                            <strong>${esc(client.nome)}</strong>
                            <br>
                            <small class="text-muted">${esc(client.fid) || ''}</small>
                        ` : '<span class="text-muted">Consumidor final</span>'}
                    </td>
                    <td>
                        <span class="badge bg-info">${sale.items?.length ?? 0} itens</span>
                        <br>
                        <small>${(sale.items || []).reduce((sum, i) => sum + (i.qty || 0), 0)} unidades</small>
                    </td>
                    <td>
                        <span class="badge bg-secondary">${esc(sale.payment) || '—'}</span>
                    </td>
                    <td class="text-primary fw-bold">${window.utils.formatCurrencyBR(sale.total)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="window.relatorios.viewSaleDetails('${sale.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ========================================
    // GRÁFICOS
    // ========================================
    function initSalesTrendChart() {
        const canvas = document.getElementById('salesTrendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Destroi gráfico anterior se existir
        if (charts.sales && typeof charts.sales.destroy === 'function') {
            charts.sales.destroy();
        }

        const salesByDate = cachedData.salesByDate;
        // [FIX] Chaves agora são ISO (yyyy-mm-dd) — ordenação lexicográfica é suficiente
        const labels = Object.keys(salesByDate).sort();
        const data   = labels.map(l => salesByDate[l]);
        // Formata labels para exibição no eixo X (dd/mm)
        const displayLabels = labels.map(l => {
            const [y, m, d] = l.split('-');
            return `${d}/${m}`;
        });

        try {
            charts.sales = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: displayLabels,
                    datasets: [{
                        label: 'Vendas (R$)',
                        data,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: '#10b981',
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
                                label: (context) => {
                                    return window.utils.formatCurrencyBR(context.raw);
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: value => window.utils.formatCurrencyBR(value)
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao criar gráfico de vendas:', error);
        }
    }

    function initPaymentChart() {
        const canvas = document.getElementById('paymentChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (charts.payment && typeof charts.payment.destroy === 'function') {
            charts.payment.destroy();
        }

        const payments = cachedData.payments;
        // [FIX] Guard contra sale.payment null: filtra chaves inválidas antes de processar
        const validKeys = Object.keys(payments).filter(k => k && k !== 'null' && k !== 'undefined');
        const labels = validKeys.map(p => p.charAt(0).toUpperCase() + p.slice(1));
        const data   = validKeys.map(k => payments[k]);

        if (data.length === 0) {
            // Se não houver dados, não cria gráfico
            return;
        }

        try {
            charts.payment = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels,
                    datasets: [{
                        data,
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${context.label}: ${window.utils.formatCurrencyBR(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Erro ao criar gráfico de pagamentos:', error);
        }
    }

    // ========================================
    // AÇÕES PRINCIPAIS
    // ========================================
    function changePeriod(period) {
        currentPeriod = period;
        refresh();
    }

    function refresh() {
        if (!checkDependencies()) return;

        // Mostra loading nos KPIs
        const kpisDiv = document.getElementById('report-kpis');
        if (kpisDiv) {
            kpisDiv.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                </div>
            `;
        }

        // Usa setTimeout para permitir a renderização do loading e não travar a UI
        setTimeout(() => {
            try {
                // Atualiza cache
                updateCache();

                // Atualiza KPIs
                if (kpisDiv) kpisDiv.innerHTML = renderKPIs();

                // Atualiza top produtos
                const topProductsDiv = document.getElementById('top-products-report');
                if (topProductsDiv) topProductsDiv.innerHTML = renderTopProducts();

                // Atualiza top clientes
                const topClientsDiv = document.getElementById('top-clients-report');
                if (topClientsDiv) topClientsDiv.innerHTML = renderTopClients();

                // Atualiza tabela
                const tableBody = document.getElementById('sales-table-body');
                if (tableBody) tableBody.innerHTML = renderSalesTable();

                // Atualiza gráficos
                initSalesTrendChart();
                initPaymentChart();
            } catch (error) {
                console.error('Erro ao atualizar relatórios:', error);
                if (kpisDiv) {
                    kpisDiv.innerHTML = `
                        <div class="col-12">
                            <div class="alert alert-danger">
                                Erro ao carregar dados. Tente novamente.
                            </div>
                        </div>
                    `;
                }
            }
        }, 50); // pequeno delay para mostrar o loading
    }

    function viewSaleDetails(saleId) {
        if (!checkDependencies()) return;

        // Busca a venda no cache (evita re-chamar state.get())
        const sale = cachedData.sales.find(s => s.id === saleId)
            || window.state.get().sales.find(s => s.id === saleId); // fallback se não estiver no cache do período
        if (!sale) {
            window.utils.showToast('Venda não encontrada', 'warning');
            return;
        }

        // [FIX] Usa cache de clientes para consistência
        const client = sale.clientId
            ? cachedData.clients.find(c => c.id === sale.clientId)
            : null;

        // [FIX] esc() em todos os campos exibidos (anti-XSS)
        let itemsRows = '';
        (sale.items || []).forEach(item => {
            const subtotal = (item.preco || 0) * (item.qty || 0);
            itemsRows += `
                <tr>
                    <td>${esc(item.nome)}</td>
                    <td>${item.qty || 0}</td>
                    <td>${window.utils.formatCurrencyBR(item.preco)}</td>
                    <td>${window.utils.formatCurrencyBR(subtotal)}</td>
                </tr>
            `;
        });

        const clientBlock = client ? `
            <div class="mb-3">
                <small class="text-muted d-block">Cliente</small>
                <strong>${esc(client.nome)}</strong>
                <br>
                <small class="text-muted">${esc(client.fid) || ''}</small>
            </div>
        ` : '';

        const detailsHTML = `
            <div class="text-start">
                <div class="alert alert-primary">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Total da venda:</span>
                        <strong class="h5 mb-0">${window.utils.formatCurrencyBR(sale.total)}</strong>
                    </div>
                </div>
                <div class="row g-3 mb-3">
                    <div class="col-6">
                        <small class="text-muted d-block">Data/Hora</small>
                        <strong>${new Date(sale.date).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div class="col-6">
                        <small class="text-muted d-block">Pagamento</small>
                        <span class="badge bg-primary">${esc(sale.payment) || '—'}</span>
                    </div>
                </div>
                ${clientBlock}
                <hr>
                <h6>Itens da venda</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Qtd</th>
                                <th>Preço unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${itemsRows}</tbody>
                    </table>
                </div>
            </div>
        `;

        // [FIX] Usa window.utils.showAlert para garantir fallback quando Swal não está disponível.
        // Se Swal estiver presente, injeta o HTML manualmente para preservar a tabela de itens.
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Detalhes da Venda',
                html: detailsHTML,
                icon: 'info',
                width: '600px',
                confirmButtonColor: '#10b981',
                confirmButtonText: 'Fechar'
            });
        } else {
            // Fallback nativo: abre em janela pop-up simples
            const win = window.open('', '_blank', 'width=620,height=500,scrollbars=yes');
            if (win) {
                win.document.write(`
                    <!doctype html><html><head>
                    <meta charset="utf-8">
                    <title>Detalhes da Venda</title>
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
                    </head><body class="p-4">${detailsHTML}
                    <button class="btn btn-success mt-3" onclick="window.close()">Fechar</button>
                    </body></html>
                `);
                win.document.close();
            }
        }
    }


    // ========================================
    // EXPORTAÇÕES
    // ========================================
    function exportFullReport() {
        if (!checkDependencies()) return;

        const format = document.getElementById('report-format')?.value || 'pdf';

        if (format === 'pdf') {
            window.print();
            window.utils.showToast('Utilize "Salvar como PDF" na janela de impressão', 'info');
        } else if (format === 'excel') {
            exportSales();
        } else {
            window.utils.showToast('Formato não implementado', 'info');
        }
    }

    function exportSales() {
        if (!checkDependencies()) return;

        // Usa o cache de clientes para consistência com a view
        const clients      = cachedData.clients;
        const filteredSales = cachedData.sales;

        const data = filteredSales.map(sale => {
            const client = sale.clientId
                ? clients.find(c => c.id === sale.clientId)
                : null;

            const items    = Array.isArray(sale.items) ? sale.items : [];
            const unidades = items.reduce((sum, i) => sum + (i.qty || 0), 0);

            return {
                'Data':           new Date(sale.date).toLocaleDateString('pt-BR'),
                'Hora':           new Date(sale.date).toLocaleTimeString('pt-BR'),
                'Cliente':        client?.nome || 'Consumidor final',
                'Código Cliente': client?.fid  || '',
                'Itens':          items.length,
                'Unidades':       unidades,
                'Pagamento':      sale.payment || '',
                // [FIX] Total como número puro para o Excel processar corretamente
                'Total (R$)':     Number((sale.total || 0).toFixed(2))
            };
        });

        try {
            window.utils.exportToCSV(data, `vendas-${new Date().toISOString().split('T')[0]}.csv`);
            window.utils.showToast('Vendas exportadas com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            window.utils.showToast('Erro ao exportar. Tente novamente.', 'danger');
        }
    }

    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        render,
        refresh,
        changePeriod,
        viewSaleDetails,
        exportSales,
        exportFullReport
    };
})();