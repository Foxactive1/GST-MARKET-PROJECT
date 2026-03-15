/**
 * Módulo Dashboard
 * Responsável por métricas, gráficos e visão geral do negócio
 * 
 * INTERFACE: Atualizada — visual aprimorado, lógica 100% preservada
 */

window.dashboard = (function() {
    let charts = {};

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

    // Período selecionado nos botões "7 dias / 30 dias / 12 meses"
    // Mantido em módulo para que changePeriod recalcule os KPIs corretamente
    let currentPeriod = 'week';

    /**
     * Filtra vendas pelo período selecionado.
     * Replicado de relatorios.js para manter o módulo autossuficiente.
     */
    function filterSalesByPeriod(sales, period) {
        const now   = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let startDate;
        switch (period) {
            case 'week':    startDate = new Date(today); startDate.setDate(today.getDate() - 7);   break;
            case 'month':   startDate = new Date(today); startDate.setDate(today.getDate() - 30);  break;
            case 'year':    startDate = new Date(now.getFullYear(), 0, 1);                          break;
            default:        return sales; // 'all'
        }

        return sales.filter(s => new Date(s.date) >= startDate);
    }

    /* ─────────────────────────────────────────────
       CSS injetado uma única vez para classes custom
    ───────────────────────────────────────────── */
    function injectStyles() {
        if (document.getElementById('dashboard-styles')) return;
        const style = document.createElement('style');
        style.id = 'dashboard-styles';
        style.textContent = `
            /* ── Animação de entrada ── */
            @keyframes fadeSlideIn {
                from { opacity: 0; transform: translateY(16px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .fade-in {
                animation: fadeSlideIn 0.4s ease both;
            }

            /* ── Card base ── */
            .card-modern {
                background: #ffffff;
                border: 1px solid #e8edf3;
                border-radius: 14px;
                padding: 1.4rem 1.5rem;
                box-shadow: 0 2px 8px rgba(0,0,0,.055);
                height: 100%;
                transition: box-shadow .2s ease;
            }
            .card-modern:hover {
                box-shadow: 0 6px 20px rgba(0,0,0,.09);
            }

            /* ── Header interno do card ── */
            .card-header-modern {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 1rem;
                gap: .75rem;
                flex-wrap: wrap;
            }

            /* ── Título de seção ── */
            .card-title {
                font-size: .92rem;
                font-weight: 700;
                color: #1e293b;
                letter-spacing: .01em;
                margin: 0;
                display: flex;
                align-items: center;
                gap: .4rem;
            }

            /* ── Metric Cards ── */
            .metric-card {
                background: #ffffff;
                border: 1px solid #e8edf3;
                border-radius: 14px;
                padding: 1.3rem 1.4rem;
                box-shadow: 0 2px 8px rgba(0,0,0,.05);
                position: relative;
                overflow: hidden;
                transition: box-shadow .2s, transform .2s;
                height: 100%;
            }
            .metric-card:hover {
                box-shadow: 0 6px 20px rgba(0,0,0,.1);
                transform: translateY(-2px);
            }
            .metric-card::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0;
                height: 3px;
                border-radius: 14px 14px 0 0;
            }
            .metric-card.accent-green::before  { background: #10b981; }
            .metric-card.accent-blue::before   { background: #3b82f6; }
            .metric-card.accent-violet::before { background: #8b5cf6; }
            .metric-card.accent-red::before    { background: #ef4444; }
            .metric-card.accent-amber::before  { background: #f59e0b; }

            .metric-icon {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.1rem;
                margin-bottom: .75rem;
            }
            .metric-icon.icon-green  { background: #d1fae5; color: #059669; }
            .metric-icon.icon-blue   { background: #dbeafe; color: #2563eb; }
            .metric-icon.icon-violet { background: #ede9fe; color: #7c3aed; }
            .metric-icon.icon-red    { background: #fee2e2; color: #dc2626; }
            .metric-icon.icon-amber  { background: #fef3c7; color: #d97706; }

            .metric-label {
                font-size: .74rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: .07em;
                color: #94a3b8;
                margin-bottom: .3rem;
            }
            .metric-value {
                font-size: 1.65rem;
                font-weight: 800;
                color: #0f172a;
                line-height: 1.2;
                margin-bottom: .5rem;
            }
            .metric-trend {
                display: inline-flex;
                align-items: center;
                gap: .25rem;
                font-size: .72rem;
                font-weight: 600;
                padding: .2rem .55rem;
                border-radius: 20px;
            }
            .trend-up   { background: #d1fae5; color: #065f46; }
            .trend-down { background: #fee2e2; color: #991b1b; }
            .trend-info { background: #dbeafe; color: #1e40af; }

            /* ── Lista de produtos / clientes ── */
            .rank-list { display: flex; flex-direction: column; gap: .55rem; }
            .rank-item {
                display: flex;
                align-items: center;
                gap: .75rem;
                padding: .65rem .8rem;
                border-radius: 10px;
                background: #f8fafc;
                border: 1px solid #f1f5f9;
                transition: background .15s;
            }
            .rank-item:hover { background: #f1f5f9; }

            .rank-badge {
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: .72rem;
                font-weight: 800;
                flex-shrink: 0;
            }
            .rank-badge.gold   { background: #fef3c7; color: #92400e; }
            .rank-badge.silver { background: #f1f5f9; color: #475569; }
            .rank-badge.bronze { background: #fde8d8; color: #9a3412; }
            .rank-badge.std    { background: #ede9fe; color: #5b21b6; }

            .rank-info { flex: 1; min-width: 0; }
            .rank-name {
                font-size: .82rem;
                font-weight: 700;
                color: #1e293b;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .rank-sub {
                font-size: .7rem;
                color: #94a3b8;
                margin-top: .05rem;
            }
            .rank-price {
                font-size: .78rem;
                font-weight: 700;
                color: #10b981;
                background: #d1fae5;
                padding: .2rem .5rem;
                border-radius: 8px;
                white-space: nowrap;
            }

            /* ── Badge de pontos ── */
            .badge-points {
                font-size: .72rem;
                font-weight: 700;
                color: #7c3aed;
                background: #ede9fe;
                padding: .2rem .55rem;
                border-radius: 8px;
                white-space: nowrap;
            }

            /* ── Alertas de estoque ── */
            .stock-alert-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: .6rem .8rem;
                border-radius: 10px;
                margin-bottom: .45rem;
                gap: .5rem;
            }
            .stock-alert-item.critical {
                background: #fff1f2;
                border: 1px solid #fecdd3;
            }
            .stock-alert-item.warning {
                background: #fffbeb;
                border: 1px solid #fde68a;
            }
            .stock-name {
                font-size: .8rem;
                font-weight: 700;
                color: #1e293b;
            }
            .stock-min {
                font-size: .68rem;
                color: #94a3b8;
                margin-top: .05rem;
            }
            .stock-qty {
                font-size: .76rem;
                font-weight: 800;
                padding: .18rem .5rem;
                border-radius: 7px;
                white-space: nowrap;
            }
            .stock-qty.critical { background: #fecdd3; color: #be123c; }
            .stock-qty.warning  { background: #fde68a; color: #92400e; }

            /* ── Grupo de botões de período ── */
            .btn-group .btn-outline-primary.active,
            .btn-group .btn-outline-primary:active {
                background: #3b82f6;
                color: #fff;
                border-color: #3b82f6;
            }

            /* ── Estado vazio ── */
            .empty-state {
                text-align: center;
                padding: 1.5rem .5rem;
                color: #94a3b8;
                font-size: .82rem;
            }
            .empty-state i { font-size: 2rem; display: block; margin-bottom: .5rem; }
        `;
        document.head.appendChild(style);
    }

    // Renderiza dashboard completo
    function render() {
        injectStyles(); // Garante estilos antes do render

        const container = document.getElementById('mainContent');
        const state = window.state.get();

        container.innerHTML = `
            <div class="fade-in">

                <!-- ── Header ── -->
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="mb-1 fw-bold" style="color:#0f172a;font-size:1.5rem;">
                            Dashboard
                        </h2>
                        <p class="text-muted mb-0" style="font-size:.82rem;">
                            <i class="bi bi-calendar3 me-1"></i>
                            Visão geral do negócio &nbsp;·&nbsp; ${new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                        </p>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm px-3" onclick="window.dashboard.refresh()">
                            <i class="bi bi-arrow-clockwise me-1"></i> Atualizar
                        </button>
                        <button class="btn btn-primary btn-sm px-3" onclick="window.app.switchView('pdv')">
                            <i class="bi bi-cash-register me-1"></i> Nova Venda
                        </button>
                    </div>
                </div>

                <!-- ── Métricas Principais ── -->
                <div class="row g-3 mb-4" id="dashboard-kpis">
                    ${renderMetricCards(state)}
                </div>

                <!-- ── Gráficos e Análises ── -->
                <div class="row g-3 mb-4">
                    <div class="col-lg-8">
                        <div class="card-modern">
                            <div class="card-header-modern">
                                <h5 class="card-title">
                                    <i class="bi bi-graph-up text-primary"></i>
                                    Vendas por Período
                                </h5>
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary period-btn active" data-period="week"  onclick="window.dashboard.changePeriod('week')">7 dias</button>
                                    <button class="btn btn-outline-primary period-btn"        data-period="month" onclick="window.dashboard.changePeriod('month')">30 dias</button>
                                    <button class="btn btn-outline-primary period-btn"        data-period="year"  onclick="window.dashboard.changePeriod('year')">12 meses</button>
                                </div>
                            </div>
                            <div style="height:300px;">
                                <canvas id="salesChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="card-modern">
                            <div class="card-header-modern">
                                <h5 class="card-title">
                                    <i class="bi bi-pie-chart text-primary"></i>
                                    Vendas por Categoria
                                </h5>
                            </div>
                            <div style="height:250px;">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Top Produtos, Clientes VIP e Alertas ── -->
                <div class="row g-3">
                    <div class="col-lg-5">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-trophy text-warning"></i>
                                Top 5 Produtos Mais Vendidos
                            </h5>
                            ${renderTopProducts(state)}
                        </div>
                    </div>

                    <div class="col-lg-4">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-star-fill text-warning"></i>
                                Clientes VIP
                            </h5>
                            ${renderTopClients(state)}
                        </div>
                    </div>

                    <div class="col-lg-3">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-exclamation-triangle text-danger"></i>
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
        // BUG CORRIGIDO — antes usava state.sales inteiro (ALL-TIME) para todos os KPIs,
        // independente do período selecionado nos botões (7d / 30d / 12m).
        // Agora filtra pelo período atual, assim Ticket Médio e Vendas no Período
        // refletem o mesmo recorte temporal exibido no gráfico.
        const periodSales   = filterSalesByPeriod(state.sales, currentPeriod);
        const totalSales    = periodSales.reduce((sum, s) => sum + s.total, 0);
        const avgTicket     = periodSales.length > 0 ? totalSales / periodSales.length : 0;

        // "Vendas Hoje" é sempre relativo ao dia atual — não muda com o período
        const todaySales    = window.utils.calculateTodaySales(state.sales);
        const lowStockCount = state.products.filter(p => p.qtd <= (p.minStock || 5)).length;

        const periodLabel = { week: 'últimos 7 dias', month: 'últimos 30 dias', year: 'este ano', all: 'todo período' };
        const label = periodLabel[currentPeriod] || currentPeriod;

        return `
            <!-- Vendas no Período -->
            <div class="col-md-3">
                <div class="metric-card accent-green">
                    <div class="metric-icon icon-green">
                        <i class="bi bi-currency-dollar"></i>
                    </div>
                    <div class="metric-label">Vendas no Período</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(totalSales)}</div>
                    <span class="metric-trend trend-up">
                        <i class="bi bi-arrow-up"></i> ${periodSales.length} vendas (${label})
                    </span>
                </div>
            </div>

            <!-- Vendas Hoje -->
            <div class="col-md-3">
                <div class="metric-card accent-blue">
                    <div class="metric-icon icon-blue">
                        <i class="bi bi-calendar-check"></i>
                    </div>
                    <div class="metric-label">Vendas Hoje</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(todaySales)}</div>
                    <span class="metric-trend trend-info">
                        <i class="bi bi-calendar"></i> ${new Date().toLocaleDateString('pt-BR')}
                    </span>
                </div>
            </div>

            <!-- Ticket Médio -->
            <div class="col-md-3">
                <div class="metric-card accent-violet">
                    <div class="metric-icon icon-violet">
                        <i class="bi bi-receipt"></i>
                    </div>
                    <div class="metric-label">Ticket Médio</div>
                    <div class="metric-value">R$ ${window.utils.formatCurrency(avgTicket)}</div>
                    <span class="metric-trend trend-up">
                        <i class="bi bi-receipt"></i> por venda
                    </span>
                </div>
            </div>

            <!-- Estoque Crítico -->
            <div class="col-md-3">
                <div class="metric-card ${lowStockCount > 0 ? 'accent-red' : 'accent-green'}">
                    <div class="metric-icon ${lowStockCount > 0 ? 'icon-red' : 'icon-green'}">
                        <i class="bi bi-${lowStockCount > 0 ? 'exclamation-triangle' : 'check-circle'}"></i>
                    </div>
                    <div class="metric-label">Estoque Crítico</div>
                    <div class="metric-value" style="color:${lowStockCount > 0 ? '#ef4444' : '#10b981'}">
                        ${lowStockCount}
                    </div>
                    <span class="metric-trend ${lowStockCount > 0 ? 'trend-down' : 'trend-up'}">
                        <i class="bi bi-${lowStockCount > 0 ? 'exclamation-triangle' : 'check-circle'}"></i>
                        ${lowStockCount > 0 ? 'Atenção necessária' : 'Todos ok'}
                    </span>
                </div>
            </div>
        `;
    }

    function renderTopProducts(state) {
        const topProducts = [...state.products]
            .sort((a, b) => (b.sold || 0) - (a.sold || 0))
            .slice(0, 5);

        if (topProducts.length === 0) {
            return `
                <div class="empty-state">
                    <i class="bi bi-bag-x text-muted"></i>
                    Nenhuma venda registrada
                </div>
            `;
        }

        const badgeClass = i => ['gold','silver','bronze','std','std'][i] || 'std';

        let html = '<div class="rank-list">';
        topProducts.forEach((p, index) => {
            html += `
                <div class="rank-item">
                    <span class="rank-badge ${badgeClass(index)}">${index + 1}</span>
                    <div class="rank-info">
                        <div class="rank-name">${esc(p.nome)}</div>
                        <div class="rank-sub">${esc(p.sold || 0)} unidades vendidas</div>
                    </div>
                    <span class="rank-price">R$ ${window.utils.formatCurrency(p.preco)}</span>
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
            return `
                <div class="empty-state">
                    <i class="bi bi-person-x text-muted"></i>
                    Nenhum cliente cadastrado
                </div>
            `;
        }

        let html = '<div class="rank-list">';
        topClients.forEach(c => {
            html += `
                <div class="rank-item">
                    <div class="rank-info">
                        <div class="rank-name">${esc(c.nome)}</div>
                        <div class="rank-sub">${esc(c.fid) || 'Sem código'}</div>
                    </div>
                    <span class="badge-points">
                        <i class="bi bi-star-fill" style="font-size:.6rem;"></i> ${esc(c.points || 0)} pts
                    </span>
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
                <div class="empty-state">
                    <i class="bi bi-check-circle text-success"></i>
                    Estoque OK!
                </div>
            `;
        }

        let html = '';
        lowStock.forEach(p => {
            const critical = p.qtd === 0;
            const cls = critical ? 'critical' : 'warning';
            html += `
                <div class="stock-alert-item ${cls}">
                    <div>
                        <div class="stock-name">${esc(p.nome)}</div>
                        <div class="stock-min">Mínimo: ${esc(p.minStock || 5)} un</div>
                    </div>
                    <span class="stock-qty ${cls}">${esc(p.qtd)} uni</span>
                </div>
            `;
        });
        return html;
    }

    function initSalesChart(state) {
        const ctx = document.getElementById('salesChart')?.getContext('2d');
        if (!ctx) return;

        if (charts.sales) charts.sales.destroy();

        const labels   = [];
        const salesData = [];

        if (currentPeriod === 'year') {
            // ── 12 meses: um ponto por mês ──────────────────────────────────
            for (let i = 11; i >= 0; i--) {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - i);

                labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));

                const monthTotal = state.sales
                    .filter(s => {
                        const sd = new Date(s.date);
                        return sd.getFullYear() === d.getFullYear() &&
                               sd.getMonth()    === d.getMonth();
                    })
                    .reduce((sum, s) => sum + s.total, 0);

                salesData.push(monthTotal);
            }
        } else {
            // ── 7 ou 30 dias: um ponto por dia ──────────────────────────────
            const days = currentPeriod === 'month' ? 30 : 7;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);

                // Usa apenas dia/mês no label; para 30 dias mostra a cada 5 para não poluir
                const showLabel = days <= 7 || i % 5 === 0 || i === 0;
                labels.push(showLabel
                    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : '');

                const dayTotal = state.sales
                    .filter(s => new Date(s.date).toDateString() === d.toDateString())
                    .reduce((sum, s) => sum + s.total, 0);

                salesData.push(dayTotal);
            }
        }

        charts.sales = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: salesData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointRadius: currentPeriod === 'month' ? 2 : 4,
                    pointBackgroundColor: '#10b981',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        ticks: {
                            // Evita sobreposição de labels no período de 30 dias
                            maxRotation: currentPeriod === 'month' ? 45 : 0,
                            autoSkip: true
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => 'R$ ' + value.toFixed(2) }
                    }
                }
            }
        });
    }

    function initCategoryChart(state) {
        const ctx = document.getElementById('categoryChart')?.getContext('2d');
        if (!ctx) return;

        if (charts.category) charts.category.destroy();

        // Monta índice de categoria por produto para lookup eficiente
        // (evita buscar em state.products para cada item de cada venda)
        const productCategoryMap = {};
        state.products.forEach(p => {
            productCategoryMap[p.id] = p.categoria || 'Outros';
        });

        // Agrega receita por categoria APENAS dentro do período selecionado.
        // BUG ANTERIOR: usava p.sold (contador all-time), nunca respeitava o período.
        const periodSales  = filterSalesByPeriod(state.sales, currentPeriod);
        const categories   = {};

        periodSales.forEach(sale => {
            sale.items.forEach(item => {
                const cat = productCategoryMap[item.id] || 'Outros';
                // Acumula receita (qty × preço com desconto de item)
                const itemRevenue = item.preco * item.qty * (1 - (item.discount || 0) / 100);
                categories[cat] = (categories[cat] || 0) + itemRevenue;
            });
        });

        // Se não há vendas no período, exibe estado vazio em vez de gráfico vazio
        const hasData = Object.values(categories).some(v => v > 0);
        if (!hasData) {
            const container = ctx.canvas.parentElement;
            container.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:.82rem;flex-direction:column;gap:.5rem;">
                    <i class="bi bi-pie-chart" style="font-size:2rem;"></i>
                    Sem vendas no período
                </div>`;
            return;
        }

        const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

        charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories).map(v => parseFloat(v.toFixed(2))),
                    backgroundColor: COLORS.slice(0, Object.keys(categories).length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                return ` ${ctx.label}: R$ ${ctx.parsed.toFixed(2)} (${pct}%)`;
                            }
                        }
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
            // BUG CORRIGIDO — antes só atualizava o gráfico, ignorava os KPI cards
            currentPeriod = period;
            const state   = window.state.get();

            // Atualiza o KPI cards sem re-renderizar a tela inteira
            const kpiContainer = document.getElementById('dashboard-kpis');
            if (kpiContainer) {
                kpiContainer.innerHTML = renderMetricCards(state);
            } else {
                // Fallback: re-renderiza tudo se o container não existir
                render();
                return;
            }

            // Atualiza os botões de período (active)
            document.querySelectorAll('.period-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.period === period);
            });

            // Atualiza o gráfico de vendas e o de categorias com o novo período
            initSalesChart(state);
            initCategoryChart(state);

            const labels = { week: '7 dias', month: '30 dias', year: '12 meses', all: 'todo período' };
            window.utils.showToast(`Período: ${labels[period] || period}`, 'info');
        }
    };
})();
