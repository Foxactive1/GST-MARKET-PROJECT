/**
 * Módulo Dashboard
 * Responsável por métricas, gráficos e visão geral do negócio
 */

window.dashboard = (function() {
    let charts = {};
    
    // Renderiza dashboard completo
    function render() {
        const container = document.getElementById('mainContent');
        const state = window.state.get();
        
        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">Dashboard</h2>
                        <p class="text-muted mb-0">Visão geral do negócio • ${new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                        <button class="btn btn-outline-primary me-2" onclick="window.dashboard.refresh()">
                            <i class="bi bi-arrow-clockwise"></i> Atualizar
                        </button>
                        <button class="btn btn-primary" onclick="window.app.switchView('pdv')">
                            <i class="bi bi-cash-register"></i> Nova Venda
                        </button>
                    </div>
                </div>
                
                <!-- Métricas Principais -->
                <div class="row g-3 mb-4">
                    ${renderMetricCards(state)}
                </div>
                
                <!-- Gráficos e Análises -->
                <div class="row g-3 mb-4">
                    <div class="col-lg-8">
                        <div class="card-modern">
                            <div class="card-header-modern">
                                <h5 class="card-title">
                                    <i class="bi bi-graph-up me-2 text-primary"></i>
                                    Vendas por Período
                                </h5>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary active" onclick="window.dashboard.changePeriod('week')">7 dias</button>
                                    <button class="btn btn-outline-primary" onclick="window.dashboard.changePeriod('month')">30 dias</button>
                                    <button class="btn btn-outline-primary" onclick="window.dashboard.changePeriod('year')">12 meses</button>
                                </div>
                            </div>
                            <div style="height: 300px;">
                                <canvas id="salesChart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-lg-4">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-pie-chart me-2 text-primary"></i>
                                Vendas por Categoria
                            </h5>
                            <div style="height: 250px;">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Top Produtos e Alertas -->
                <div class="row g-3">
                    <div class="col-lg-5">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-trophy me-2 text-warning"></i>
                                Top 5 Produtos Mais Vendidos
                            </h5>
                            ${renderTopProducts(state)}
                        </div>
                    </div>
                    
                    <div class="col-lg-4">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-star-fill me-2 text-warning"></i>
                                Clientes VIP
                            </h5>
                            ${renderTopClients(state)}
                        </div>
                    </div>
                    
                    <div class="col-lg-3">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-exclamation-triangle me-2 text-danger"></i>
                                Alertas de Estoque
                            </h5>
                            ${renderStockAlerts(state)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Inicializa gráficos
        setTimeout(() => {
            initSalesChart(state);
            initCategoryChart(state);
        }, 100);
    }
    
    function renderMetricCards(state) {
        const totalSales = window.utils.calculateTotalSales(state.sales);
        const todaySales = window.utils.calculateTodaySales(state.sales);
        const avgTicket = state.sales.length > 0 ? totalSales / state.sales.length : 0;
        const lowStockCount = state.products.filter(p => p.qtd <= (p.minStock || 5)).length;
        
        return `
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Vendas Totais</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(totalSales)}</div>
                    <div class="metric-trend trend-up mt-2">
                        <i class="bi bi-arrow-up"></i> ${state.sales.length} vendas
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Vendas Hoje</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(todaySales)}</div>
                    <div class="metric-trend mt-2" style="background: #e0f2fe; color: #0369a1;">
                        <i class="bi bi-calendar"></i> ${new Date().toLocaleDateString('pt-BR')}
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Ticket Médio</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(avgTicket)}</div>
                    <div class="metric-trend mt-2">
                        <i class="bi bi-receipt"></i> por venda
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card">
                    <div class="metric-label">Estoque Crítico</div>
                    <div class="metric-value" style="color: ${lowStockCount > 0 ? '#ef4444' : '#10b981'}">${lowStockCount}</div>
                    <div class="metric-trend mt-2 ${lowStockCount > 0 ? 'trend-down' : 'trend-up'}">
                        <i class="bi bi-${lowStockCount > 0 ? 'exclamation-triangle' : 'check-circle'}"></i>
                        ${lowStockCount > 0 ? 'Atenção necessária' : 'Todos ok'}
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderTopProducts(state) {
        const topProducts = [...state.products]
            .sort((a, b) => (b.sold || 0) - (a.sold || 0))
            .slice(0, 5);
        
        if (topProducts.length === 0) {
            return '<p class="text-muted mb-0">Nenhuma venda registrada</p>';
        }
        
        let html = '<div class="list-group">';
        topProducts.forEach((p, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-primary me-2">${index + 1}</span>
                        <strong>${p.nome}</strong>
                        <small class="text-muted d-block">${p.sold || 0} unidades</small>
                    </div>
                    <span class="badge bg-success">R$ ${window.utils.formatCurrency(p.preco)}</span>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    function renderTopClients(state) {
        const topClients = [...state.clients]
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 5);
        
        if (topClients.length === 0) {
            return '<p class="text-muted mb-0">Nenhum cliente cadastrado</p>';
        }
        
        let html = '<div class="list-group">';
        topClients.forEach(c => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${c.nome}</strong>
                        <small class="text-muted d-block">${c.fid || 'Sem código'}</small>
                    </div>
                    <span class="badge-points">${c.points || 0} pts</span>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    function renderStockAlerts(state) {
        const lowStock = state.products
            .filter(p => p.qtd <= (p.minStock || 5))
            .sort((a, b) => a.qtd - b.qtd)
            .slice(0, 5);
        
        if (lowStock.length === 0) {
            return `
                <div class="text-center py-4">
                    <i class="bi bi-check-circle text-success" style="font-size: 2rem;"></i>
                    <p class="text-muted mt-2 mb-0">Estoque OK!</p>
                </div>
            `;
        }
        
        let html = '';
        lowStock.forEach(p => {
            const critical = p.qtd === 0;
            html += `
                <div class="alert ${critical ? 'alert-danger' : 'alert-warning'} mb-2 py-2">
                    <div class="d-flex justify-content-between">
                        <div>
                            <strong>${p.nome}</strong>
                            <small class="d-block">Mínimo: ${p.minStock || 5}</small>
                        </div>
                        <span class="badge bg-${critical ? 'danger' : 'warning'} rounded-pill h-100">
                            ${p.qtd} uni
                        </span>
                    </div>
                </div>
            `;
        });
        
        return html;
    }
    
    function initSalesChart(state) {
        const ctx = document.getElementById('salesChart')?.getContext('2d');
        if (!ctx) return;
        
        // Destrói gráfico anterior
        if (charts.sales) charts.sales.destroy();
        
        // Dados dos últimos 7 dias
        const last7Days = [];
        const salesData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            last7Days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            
            const daySales = state.sales.filter(s => 
                new Date(s.date).toDateString() === date.toDateString()
            ).reduce((sum, s) => sum + s.total, 0);
            
            salesData.push(daySales);
        }
        
        charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: salesData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#10b981',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
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
    
    function initCategoryChart(state) {
        const ctx = document.getElementById('categoryChart')?.getContext('2d');
        if (!ctx) return;
        
        if (charts.category) charts.category.destroy();
        
        // Agrupa vendas por categoria
        const categories = {};
        state.products.forEach(p => {
            if (!categories[p.categoria]) categories[p.categoria] = 0;
            categories[p.categoria] += p.sold || 0;
        });
        
        charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    // API Pública
    return {
        render,
        refresh: render,
        changePeriod: (period) => {
            const state = window.state.get();
            initSalesChart(state);
            window.utils.showToast(`Período alterado: ${period}`, 'info');
        }
    };
})();