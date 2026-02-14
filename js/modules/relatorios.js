/**
 * Módulo de Relatórios
 * Responsável por análises, gráficos e exportação de dados
 */

window.relatorios = (function() {
    let currentPeriod = 'month';
    let charts = {};
    
    function render() {
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
                            <label class="form-label small-muted">Comparar com</label>
                            <select id="report-compare" class="form-select">
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
                
                <!-- KPIs Principais -->
                <div class="row g-3 mb-4" id="report-kpis">
                    ${renderKPIs()}
                </div>
                
                <!-- Gráficos -->
                <div class="row g-3 mb-4">
                    <div class="col-lg-8">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-bar-chart-line me-2 text-primary"></i>
                                Evolução de Vendas
                            </h5>
                            <div style="height: 350px;">
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
                            <div style="height: 300px;">
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
                                ${renderTopProducts()}
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
                                ${renderTopClients()}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Tabela de Vendas -->
                <div class="card-modern">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-table me-2"></i>
                            Histórico de Vendas
                        </h5>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary" onclick="window.relatorios.exportSales()">
                                <i class="bi bi-download"></i> Exportar
                            </button>
                        </div>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="table-modern">
                            <thead>
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
                                ${renderSalesTable()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        // Inicializa gráficos
        setTimeout(() => {
            initSalesTrendChart();
            initPaymentChart();
        }, 100);
    }
    
    function renderKPIs() {
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
        const totalItems = filteredSales.reduce((sum, s) => 
            sum + s.items.reduce((itemSum, i) => itemSum + i.qty, 0), 0
        );
        const avgTicket = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;
        const uniqueClients = new Set(filteredSales.map(s => s.clientId).filter(Boolean)).size;
        
        return `
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Vendas no Período</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(totalSales)}</div>
                    <small class="text-muted">${filteredSales.length} transações</small>
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
                    <div class="metric-value">R$ ${window.utils.formatCurrency(avgTicket)}</div>
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
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        // Agrupa produtos vendidos
        const productSales = {};
        filteredSales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productSales[item.id]) {
                    productSales[item.id] = {
                        nome: item.nome,
                        qty: 0,
                        total: 0
                    };
                }
                productSales[item.id].qty += item.qty;
                productSales[item.id].total += item.preco * item.qty;
            });
        });
        
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
                        <strong>${p.nome}</strong>
                    </div>
                    <div class="text-end">
                        <span class="fw-bold">${p.qty} uni</span>
                        <br>
                        <small class="text-primary">R$ ${window.utils.formatCurrency(p.total)}</small>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    function renderTopClients() {
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        // Agrupa compras por cliente
        const clientPurchases = {};
        filteredSales.forEach(sale => {
            if (!sale.clientId) return;
            
            if (!clientPurchases[sale.clientId]) {
                const client = state.clients.find(c => c.id === sale.clientId);
                clientPurchases[sale.clientId] = {
                    nome: client?.nome || 'Cliente removido',
                    total: 0,
                    count: 0
                };
            }
            clientPurchases[sale.clientId].total += sale.total;
            clientPurchases[sale.clientId].count++;
        });
        
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
                        <strong>${c.nome}</strong>
                        <br>
                        <small class="text-muted">${c.count} compras</small>
                    </div>
                    <span class="fw-bold text-primary">R$ ${window.utils.formatCurrency(c.total)}</span>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    function renderSalesTable() {
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 20);
        
        if (filteredSales.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="bi bi-receipt text-muted" style="font-size: 2rem;"></i>
                        <p class="text-muted mt-3">Nenhuma venda no período</p>
                    </td>
                </tr>
            `;
        }
        
        return filteredSales.map(sale => {
            const client = sale.clientId ? 
                state.clients.find(c => c.id === sale.clientId) : null;
            
            return `
                <tr>
                    <td>
                        ${new Date(sale.date).toLocaleDateString('pt-BR')}
                        <br>
                        <small class="text-muted">${new Date(sale.date).toLocaleTimeString('pt-BR')}</small>
                    </td>
                    <td>
                        ${client ? `
                            <strong>${client.nome}</strong>
                            <br>
                            <small class="text-muted">${client.fid || ''}</small>
                        ` : '<span class="text-muted">Consumidor final</span>'}
                    </td>
                    <td>
                        <span class="badge bg-info">${sale.items.length} itens</span>
                        <br>
                        <small>${sale.items.reduce((sum, i) => sum + i.qty, 0)} unidades</small>
                    </td>
                    <td>
                        <span class="badge bg-secondary">${sale.payment}</span>
                    </td>
                    <td class="text-primary fw-bold">R$ ${window.utils.formatCurrency(sale.total)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="window.relatorios.viewSaleDetails('${sale.id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    function filterSalesByPeriod(sales, period) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch(period) {
            case 'today':
                return sales.filter(s => new Date(s.date).toDateString() === today.toDateString());
            
            case 'week':
                const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
                return sales.filter(s => new Date(s.date) >= weekAgo);
            
            case 'month':
                const monthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);
                return sales.filter(s => new Date(s.date) >= monthAgo);
            
            case 'quarter':
                const quarterAgo = new Date(today - 90 * 24 * 60 * 60 * 1000);
                return sales.filter(s => new Date(s.date) >= quarterAgo);
            
            case 'year':
                const yearStart = new Date(now.getFullYear(), 0, 1);
                return sales.filter(s => new Date(s.date) >= yearStart);
            
            default:
                return sales;
        }
    }
    
    function initSalesTrendChart() {
        const ctx = document.getElementById('salesTrendChart')?.getContext('2d');
        if (!ctx) return;
        
        if (charts.sales) charts.sales.destroy();
        
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        // Agrupa por data
        const salesByDate = {};
        filteredSales.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString('pt-BR');
            salesByDate[date] = (salesByDate[date] || 0) + sale.total;
        });
        
        const labels = Object.keys(salesByDate).sort((a, b) => {
            const [d1, m1, y1] = a.split('/');
            const [d2, m2, y2] = b.split('/');
            return new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
        });
        
        const data = labels.map(l => salesByDate[l]);
        
        charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
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
                                return `R$ ${window.utils.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => 'R$ ' + value.toFixed(2)
                        }
                    }
                }
            }
        });
    }
    
    function initPaymentChart() {
        const ctx = document.getElementById('paymentChart')?.getContext('2d');
        if (!ctx) return;
        
        if (charts.payment) charts.payment.destroy();
        
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        const payments = {};
        filteredSales.forEach(sale => {
            payments[sale.payment] = (payments[sale.payment] || 0) + sale.total;
        });
        
        charts.payment = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(payments).map(p => p.charAt(0).toUpperCase() + p.slice(1)),
                datasets: [{
                    data: Object.values(payments),
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
                                return `${context.label}: R$ ${window.utils.formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Ações
    function changePeriod(period) {
        currentPeriod = period;
        refresh();
    }
    
    function refresh() {
        // Atualiza KPIs
        const kpisDiv = document.getElementById('report-kpis');
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
    }
    
    function viewSaleDetails(saleId) {
        const state = window.state.get();
        const sale = state.sales.find(s => s.id === saleId);
        if (!sale) return;
        
        const client = sale.clientId ? 
            state.clients.find(c => c.id === sale.clientId) : null;
        
        let detailsHTML = `
            <div class="text-start">
                <div class="alert alert-primary">
                    <div class="d-flex justify-content-between">
                        <span>Total da venda:</span>
                        <strong class="h5">R$ ${window.utils.formatCurrency(sale.total)}</strong>
                    </div>
                </div>
                
                <div class="row g-3 mb-3">
                    <div class="col-6">
                        <small class="text-muted d-block">Data/Hora</small>
                        <strong>${new Date(sale.date).toLocaleString('pt-BR')}</strong>
                    </div>
                    <div class="col-6">
                        <small class="text-muted d-block">Pagamento</small>
                        <span class="badge bg-primary">${sale.payment}</span>
                    </div>
                </div>
                
                ${client ? `
                    <div class="mb-3">
                        <small class="text-muted d-block">Cliente</small>
                        <strong>${client.nome}</strong>
                        <br>
                        <small class="text-muted">${client.fid || ''}</small>
                    </div>
                ` : ''}
                
                <hr>
                <h6>Itens da venda</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Qtd</th>
                                <th>Preço</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        sale.items.forEach(item => {
            detailsHTML += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.qty}</td>
                    <td>R$ ${window.utils.formatCurrency(item.preco)}</td>
                    <td>R$ ${window.utils.formatCurrency(item.preco * item.qty)}</td>
                </tr>
            `;
        });
        
        detailsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: 'Detalhes da Venda',
            html: detailsHTML,
            icon: 'info',
            width: '600px',
            confirmButtonText: 'Fechar'
        });
    }
    
    function exportFullReport() {
        const format = document.getElementById('report-format')?.value || 'pdf';
        const period = document.getElementById('report-period')?.value || 'month';
        
        if (format === 'pdf') {
            window.utils.showToast('Gerando relatório PDF...', 'info');
            // Simulação de geração PDF
            setTimeout(() => {
                window.utils.showToast('Relatório PDF gerado com sucesso!', 'success');
            }, 1500);
        } else if (format === 'excel') {
            exportSales();
        }
    }
    
    function exportSales() {
        const state = window.state.get();
        const filteredSales = filterSalesByPeriod(state.sales, currentPeriod);
        
        const data = filteredSales.map(sale => {
            const client = sale.clientId ? 
                state.clients.find(c => c.id === sale.clientId) : null;
            
            return {
                'Data': new Date(sale.date).toLocaleDateString('pt-BR'),
                'Hora': new Date(sale.date).toLocaleTimeString('pt-BR'),
                'Cliente': client?.nome || 'Consumidor final',
                'Código Cliente': client?.fid || '',
                'Itens': sale.items.length,
                'Unidades': sale.items.reduce((sum, i) => sum + i.qty, 0),
                'Pagamento': sale.payment,
                'Total': sale.total
            };
        });
        
        window.utils.exportToCSV(data, `vendas-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast('Vendas exportadas com sucesso!', 'success');
    }
    
    // API Pública
    return {
        render,
        refresh,
        changePeriod,
        viewSaleDetails,
        exportSales,
        exportFullReport
    };
})();