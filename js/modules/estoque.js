/**
 * ============================================================================
 * MÓDULO DE GESTÃO DE ESTOQUE - VERSÃO REVISADA 2.1.0 + INTELIGENTE
 * ============================================================================
 * 
 * Responsável por:
 * - Gestão completa de produtos e inventário
 * - Controle de movimentações com histórico detalhado
 * - Alertas automáticos de estoque baixo/crítico
 * - Importação/Exportação de dados
 * - Geração de códigos de barras
 * - Análise de giro de estoque
 * - Relatórios e dashboards
 * - **ESTOQUE INTELIGENTE** com previsão de demanda, ponto de reposição e EOQ
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.2.0
 * @date 2026
 */

window.estoque = (function() {
    'use strict';
    
    // ========================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Estoque: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Estoque: window.utils não definido');
            return false;
        }
        return true;
    }
    
    // ========================================
    // ESTADO E CONFIGURAÇÕES
    // ========================================
    
    let currentFilter = 'all';
    let currentSort = 'nome';
    let sortDirection = 'asc';
    let lastAlertCheck = null;
    let alertCheckInterval = null;
    
    // Cache para performance
    let filteredProductsCache = null;
    let lastFilterParams = null;
    
    // Configurações de alertas
    const ALERT_CONFIG = {
        checkInterval: 60000, // 1 minuto
        lowStockThreshold: 0.3, // 30% do mínimo
        criticalStockThreshold: 0 // 0 unidades
    };
    
    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    
    function init() {
        if (!checkDependencies()) return;
        // Inicia verificação automática de alertas
        startAlertMonitoring();
        
        // Carrega histórico de movimentações do localStorage
        loadMovementHistory();
    }
    
    // ========================================
    // RENDERIZAÇÃO PRINCIPAL
    // ========================================
    
    function render() {
        if (!checkDependencies()) {
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Erro ao carregar módulo Estoque. Dependências não encontradas.
                </div>
            `;
            return;
        }
        
        const container = document.getElementById('mainContent');
        const state = window.state.get();
        
        // Verifica alertas antes de renderizar
        checkStockAlerts(state.products);
        
        container.innerHTML = `
            <div class="fade-in">
                <!-- Header com ações -->
                ${renderHeader(state)}
                
                <!-- Filtros e busca avançada -->
                ${renderFilters()}
                
                <!-- Cards de métricas -->
                ${renderMetricsCards(state)}
                
                <!-- Alertas de estoque -->
                ${renderStockAlerts(state.products)}
                
                <!-- Gráfico de movimentações -->
                ${renderMovementChart()}
                
                <!-- Tabela de produtos -->
                ${renderProductsTable(state)}
            </div>
        `;
        
        // Inicializa componentes interativos
        initializeComponents();
    }
    
    // ========================================
    // RENDERIZAÇÃO DE COMPONENTES
    // ========================================
    
    function renderHeader(state) {
        const lowStockCount = state.products.filter(p => 
            p.qtd <= (p.minStock || 5) && p.qtd > 0
        ).length;
        
        const criticalStockCount = state.products.filter(p => 
            p.qtd === 0
        ).length;
        
        return `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="mb-1">
                        <i class="bi bi-box-seam text-primary"></i>
                        Gestão de Estoque
                    </h2>
                    <p class="text-muted mb-0">
                        <i class="bi bi-archive"></i> 
                        ${state.products.length} produtos cadastrados
                        ${lowStockCount > 0 ? `• <span class="badge bg-warning text-dark">${lowStockCount} com estoque baixo</span>` : ''}
                        ${criticalStockCount > 0 ? `• <span class="badge bg-danger">${criticalStockCount} sem estoque</span>` : ''}
                    </p>
                </div>
                
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-info" 
                            onclick="window.estoque.showSmartReplenishment()"
                            title="Reposição inteligente baseada em demanda">
                        <i class="bi bi-cpu"></i> Reposição Inteligente
                    </button>
                    <button class="btn btn-success" 
                            onclick="window.estoque.importProducts()"
                            title="Importar produtos via CSV">
                        <i class="bi bi-upload"></i> Importar
                    </button>
                    
                    <button class="btn btn-outline-secondary" 
                            onclick="window.estoque.exportInventory()"
                            title="Exportar inventário">
                        <i class="bi bi-download"></i> Exportar
                    </button>
                    
                    <button class="btn btn-outline-info" 
                            onclick="window.estoque.viewMovementHistory()"
                            title="Ver histórico de movimentações">
                        <i class="bi bi-clock-history"></i> Histórico
                    </button>
                    
                    <button class="btn btn-primary" 
                            onclick="window.modals.openProductModal()"
                            title="Cadastrar novo produto">
                        <i class="bi bi-plus-lg"></i> Novo Produto
                    </button>
                </div>
            </div>
        `;
    }
    
    function renderFilters() {
        return `
            <div class="card-modern mb-4">
                <div class="row g-3">
                    <div class="col-md-4">
                        <div class="search-box">
                            <i class="bi bi-search"></i>
                            <input type="text" 
                                   id="estoque-search" 
                                   class="form-control" 
                                   placeholder="Buscar por nome, código ou categoria..."
                                   autocomplete="off"
                                   oninput="window.estoque.filterDebounced()">
                        </div>
                    </div>
                    
                    <div class="col-md-2">
                        <select id="estoque-categoria" 
                                class="form-select" 
                                onchange="window.estoque.filter()"
                                aria-label="Filtrar por categoria">
                            <option value="all">Todas as categorias</option>
                            <option value="Alimentos">Alimentos</option>
                            <option value="Bebidas">Bebidas</option>
                            <option value="Higiene">Higiene</option>
                            <option value="Limpeza">Limpeza</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>
                    
                    <div class="col-md-2">
                        <select id="estoque-status" 
                                class="form-select" 
                                onchange="window.estoque.filter()"
                                aria-label="Filtrar por status">
                            <option value="all">Todos os status</option>
                            <option value="critical">⚠️ Sem estoque</option>
                            <option value="low">⚡ Estoque baixo</option>
                            <option value="ok">✅ Estoque OK</option>
                            <option value="excess">📦 Estoque alto</option>
                        </select>
                    </div>
                    
                    <div class="col-md-2">
                        <select id="estoque-sort" 
                                class="form-select" 
                                onchange="window.estoque.changeSort(this.value)"
                                aria-label="Ordenar por">
                            <option value="nome">Ordenar: Nome A-Z</option>
                            <option value="nome-desc">Ordenar: Nome Z-A</option>
                            <option value="qtd">Ordenar: Menor estoque</option>
                            <option value="qtd-desc">Ordenar: Maior estoque</option>
                            <option value="preco">Ordenar: Menor preço</option>
                            <option value="preco-desc">Ordenar: Maior preço</option>
                            <option value="sold">Ordenar: Mais vendidos</option>
                        </select>
                    </div>
                    
                    <div class="col-md-2">
                        <button class="btn btn-outline-primary w-100" 
                                onclick="window.estoque.resetFilters()"
                                title="Limpar todos os filtros">
                            <i class="bi bi-eraser"></i> Limpar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderMetricsCards(state) {
        const inventoryValue = calculateInventoryValue(state.products);
        const totalItems = calculateTotalItems(state.products);
        const lowStockCount = state.products.filter(p => 
            p.qtd <= (p.minStock || 5) && p.qtd > 0
        ).length;
        const outOfStockCount = state.products.filter(p => p.qtd === 0).length;
        const avgRotation = calculateAverageRotation(state.products);
        
        return `
            <div class="row g-3 mb-4">
                <div class="col-md-3 col-sm-6">
                    <div class="metric-card hover-lift">
                        <div class="metric-label">
                            <i class="bi bi-currency-dollar me-1"></i>
                            Valor em Estoque
                        </div>
                        <div class="metric-value">R$ ${window.utils.formatCurrency(inventoryValue)}</div>
                        <small class="text-muted">Valor total do inventário</small>
                    </div>
                </div>
                
                <div class="col-md-3 col-sm-6">
                    <div class="metric-card hover-lift">
                        <div class="metric-label">
                            <i class="bi bi-box me-1"></i>
                            Total de Itens
                        </div>
                        <div class="metric-value">${totalItems}</div>
                        <small class="text-muted">unidades em estoque</small>
                    </div>
                </div>
                
                <div class="col-md-3 col-sm-6">
                    <div class="metric-card hover-lift">
                        <div class="metric-label">
                            <i class="bi bi-exclamation-triangle me-1"></i>
                            Atenção Necessária
                        </div>
                        <div class="metric-value ${lowStockCount > 0 ? 'text-warning' : 'text-success'}">
                            ${lowStockCount}
                        </div>
                        <small class="text-muted">produtos com estoque baixo</small>
                    </div>
                </div>
                
                <div class="col-md-3 col-sm-6">
                    <div class="metric-card hover-lift">
                        <div class="metric-label">
                            <i class="bi bi-x-circle me-1"></i>
                            Sem Estoque
                        </div>
                        <div class="metric-value ${outOfStockCount > 0 ? 'text-danger' : 'text-success'}">
                            ${outOfStockCount}
                        </div>
                        <small class="text-muted">produtos indisponíveis</small>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderStockAlerts(products) {
        const criticalProducts = products.filter(p => p.qtd === 0);
        const lowStockProducts = products.filter(p => 
            p.qtd > 0 && p.qtd <= (p.minStock || 5)
        );
        
        if (criticalProducts.length === 0 && lowStockProducts.length === 0) {
            return '';
        }
        
        return `
            <div class="alert alert-warning border-warning mb-4" role="alert">
                <div class="d-flex align-items-start">
                    <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                    <div class="flex-grow-1">
                        <h5 class="alert-heading mb-2">
                            <i class="bi bi-bell"></i> Alertas de Estoque
                        </h5>
                        
                        ${criticalProducts.length > 0 ? `
                            <div class="mb-2">
                                <strong class="text-danger">
                                    <i class="bi bi-x-circle"></i> 
                                    ${criticalProducts.length} produto(s) sem estoque:
                                </strong>
                                <div class="mt-2">
                                    ${criticalProducts.slice(0, 5).map(p => `
                                        <span class="badge bg-danger me-1 mb-1">
                                            ${p.nome}
                                        </span>
                                    `).join('')}
                                    ${criticalProducts.length > 5 ? `
                                        <span class="badge bg-secondary">
                                            +${criticalProducts.length - 5} mais
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${lowStockProducts.length > 0 ? `
                            <div>
                                <strong class="text-warning">
                                    <i class="bi bi-exclamation-circle"></i> 
                                    ${lowStockProducts.length} produto(s) com estoque baixo:
                                </strong>
                                <div class="mt-2">
                                    ${lowStockProducts.slice(0, 5).map(p => `
                                        <span class="badge bg-warning text-dark me-1 mb-1">
                                            ${p.nome} (${p.qtd} ${p.unit || 'un'})
                                        </span>
                                    `).join('')}
                                    ${lowStockProducts.length > 5 ? `
                                        <span class="badge bg-secondary">
                                            +${lowStockProducts.length - 5} mais
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                        
                        <div class="mt-3">
                            <button class="btn btn-sm btn-warning" 
                                    onclick="window.estoque.generateReplenishmentOrder()">
                                <i class="bi bi-cart-plus"></i> Gerar Pedido de Reposição
                            </button>
                            <button class="btn btn-sm btn-info ms-2"
                                    onclick="window.estoque.showSmartReplenishment()">
                                <i class="bi bi-cpu"></i> Reposição Inteligente
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderMovementChart() {
        return `
            <div class="card-modern mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">
                        <i class="bi bi-graph-up text-primary"></i>
                        Movimentações dos Últimos 7 Dias
                    </h5>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="window.estoque.refreshMovementChart()">
                        <i class="bi bi-arrow-clockwise"></i> Atualizar
                    </button>
                </div>
                <div style="height: 250px;">
                    <canvas id="movementChart"></canvas>
                </div>
            </div>
        `;
    }
    
    function renderProductsTable(state) {
        return `
            <div class="card-modern">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="card-title mb-0">
                        <i class="bi bi-table"></i>
                        Produtos em Estoque
                    </h5>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-secondary" 
                                onclick="window.estoque.printInventory()"
                                title="Imprimir inventário">
                            <i class="bi bi-printer"></i> Imprimir
                        </button>
                        <button class="btn btn-sm btn-outline-info" 
                                onclick="window.estoque.generateBarcodes()"
                                title="Gerar códigos de barras">
                            <i class="bi bi-upc-scan"></i> Códigos
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="table-modern" id="products-table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">
                                    <span style="cursor: pointer;" onclick="window.estoque.sort('nome')">
                                        Produto ${getSortIcon('nome')}
                                    </span>
                                </th>
                                <th style="width: 12%;">Categoria</th>
                                <th style="width: 12%;">
                                    <span style="cursor: pointer;" onclick="window.estoque.sort('qtd')">
                                        Estoque ${getSortIcon('qtd')}
                                    </span>
                                </th>
                                <th style="width: 12%;">
                                    <span style="cursor: pointer;" onclick="window.estoque.sort('preco')">
                                        Preço ${getSortIcon('preco')}
                                    </span>
                                </th>
                                <th style="width: 10%;">Estoque Mín.</th>
                                <th style="width: 10%;">
                                    <span style="cursor: pointer;" onclick="window.estoque.sort('sold')">
                                        Vendidos ${getSortIcon('sold')}
                                    </span>
                                </th>
                                <th style="width: 10%;">Status</th>
                                <th style="width: 4%;">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="estoque-table-body">
                            ${renderProductRows(filterProducts(state.products))}
                        </tbody>
                    </table>
                </div>
                
                <div class="mt-3 text-muted small" id="table-info">
                    <!-- Info será atualizada dinamicamente -->
                </div>
            </div>
        `;
    }
    
    function renderProductRows(products) {
        if (products.length === 0) {
            return `
                <tr>
                    <td colspan="8" class="text-center py-5">
                        <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                        <p class="text-muted mt-3 mb-0">Nenhum produto encontrado</p>
                        <button class="btn btn-primary btn-sm mt-3" 
                                onclick="window.estoque.resetFilters()">
                            <i class="bi bi-arrow-counterclockwise"></i> Limpar Filtros
                        </button>
                    </td>
                </tr>
            `;
        }
        
        // Atualiza informação de resultados
        updateTableInfo(products.length);
        
        return products.map(p => {
            const status = getStockStatus(p);
            const rotationSpeed = calculateProductRotation(p);
            
            return `
                <tr class="product-row ${status.class}" data-product-id="${p.id}">
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="product-icon me-2">
                                ${getCategoryIcon(p.categoria)}
                            </div>
                            <div>
                                <strong class="product-name">${p.nome}</strong>
                                <div class="small text-muted">
                                    <i class="bi bi-upc-scan"></i> ${p.code || 'S/código'}
                                    ${rotationSpeed ? `• <span class="badge badge-sm bg-info">${rotationSpeed}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark">
                            ${p.categoria || 'Não definida'}
                        </span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <span class="${p.qtd === 0 ? 'text-danger fw-bold' : p.qtd <= (p.minStock || 5) ? 'text-warning fw-bold' : ''}">
                                ${p.qtd} ${p.unit || 'un'}
                            </span>
                            ${p.qtd > 0 ? `
                                <div class="progress ms-2" style="width: 60px; height: 6px;">
                                    <div class="progress-bar ${getProgressBarClass(p)}" 
                                         style="width: ${getStockPercentage(p)}%"
                                         title="${getStockPercentage(p)}% do mínimo"></div>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td class="text-primary fw-bold">
                        R$ ${window.utils.formatCurrency(p.preco)}
                        ${p.cost ? `
                            <div class="small text-muted">
                                Custo: R$ ${window.utils.formatCurrency(p.cost)}
                            </div>
                        ` : ''}
                    </td>
                    <td>${p.minStock || 5} ${p.unit || 'un'}</td>
                    <td>
                        <strong>${p.sold || 0}</strong>
                        ${p.sold > 0 ? `
                            <div class="small text-muted">
                                R$ ${window.utils.formatCurrency((p.sold || 0) * p.preco)}
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        <span class="badge ${status.badge}" title="${status.tooltip || ''}">
                            <i class="bi ${status.icon}"></i> ${status.text}
                        </span>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="btn btn-sm btn-outline-secondary dropdown-toggle" 
                                    type="button" 
                                    data-bs-toggle="dropdown"
                                    aria-label="Ações do produto">
                                <i class="bi bi-three-dots-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item" 
                                       href="#" 
                                       onclick="window.modals.openProductModal('${p.id}'); return false;">
                                        <i class="bi bi-pencil"></i> Editar
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" 
                                       href="#" 
                                       onclick="window.estoque.adjustStock('${p.id}'); return false;">
                                        <i class="bi bi-arrow-left-right"></i> Ajustar Estoque
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" 
                                       href="#" 
                                       onclick="window.estoque.viewHistory('${p.id}'); return false;">
                                        <i class="bi bi-clock-history"></i> Histórico
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item" 
                                       href="#" 
                                       onclick="window.estoque.generateBarcode('${p.id}'); return false;">
                                        <i class="bi bi-upc"></i> Código de Barras
                                    </a>
                                </li>
                                <li><hr class="dropdown-divider"></li>
                                <li>
                                    <a class="dropdown-item text-danger" 
                                       href="#" 
                                       onclick="window.estoque.deleteProduct('${p.id}'); return false;">
                                        <i class="bi bi-trash"></i> Remover
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // ========================================
    // FUNÇÕES AUXILIARES DE RENDERIZAÇÃO
    // ========================================
    
    function getSortIcon(field) {
        if (currentSort !== field) {
            return '<i class="bi bi-arrow-down-up text-muted" style="font-size: 0.8rem;"></i>';
        }
        return sortDirection === 'asc' 
            ? '<i class="bi bi-arrow-up text-primary"></i>' 
            : '<i class="bi bi-arrow-down text-primary"></i>';
    }
    
    function getCategoryIcon(category) {
        const icons = {
            'Alimentos': '🍞',
            'Bebidas': '🥤',
            'Higiene': '🧼',
            'Limpeza': '🧹',
            'Outros': '📦'
        };
        return `<span style="font-size: 1.5rem;">${icons[category] || '📦'}</span>`;
    }
    
    function getStockStatus(product) {
        const qty = product.qtd || 0;
        const minStock = product.minStock || 5;
        
        if (qty === 0) {
            return {
                class: 'row-critical',
                badge: 'bg-danger',
                icon: 'bi-x-circle-fill',
                text: 'Esgotado',
                tooltip: 'Produto sem estoque'
            };
        }
        
        if (qty <= minStock * 0.5) {
            return {
                class: 'row-warning',
                badge: 'bg-warning text-dark',
                icon: 'bi-exclamation-triangle-fill',
                text: 'Crítico',
                tooltip: 'Estoque crítico - menos de 50% do mínimo'
            };
        }
        
        if (qty <= minStock) {
            return {
                class: 'row-low',
                badge: 'bg-warning text-dark',
                icon: 'bi-exclamation-circle-fill',
                text: 'Baixo',
                tooltip: 'Estoque abaixo do mínimo'
            };
        }
        
        if (qty > minStock * 3) {
            return {
                class: '',
                badge: 'bg-info',
                icon: 'bi-boxes',
                text: 'Alto',
                tooltip: 'Estoque alto - mais de 3x o mínimo'
            };
        }
        
        return {
            class: '',
            badge: 'bg-success',
            icon: 'bi-check-circle-fill',
            text: 'OK',
            tooltip: 'Estoque adequado'
        };
    }
    
    function getProgressBarClass(product) {
        const percentage = getStockPercentage(product);
        if (percentage >= 100) return 'bg-success';
        if (percentage >= 50) return 'bg-warning';
        return 'bg-danger';
    }
    
    function getStockPercentage(product) {
        const minStock = product.minStock || 5;
        return Math.min(100, Math.round((product.qtd / minStock) * 100));
    }
    
    function updateTableInfo(count) {
        setTimeout(() => {
            const infoElement = document.getElementById('table-info');
            if (infoElement) {
                const total = window.state.getProducts().length;
                infoElement.innerHTML = `
                    <i class="bi bi-info-circle"></i>
                    Exibindo ${count} de ${total} produto(s)
                `;
            }
        }, 100);
    }
    
    // ========================================
    // FILTRAGEM E ORDENAÇÃO
    // ========================================
    
    function filterProducts(products) {
        const searchTerm = document.getElementById('estoque-search')?.value.toLowerCase() || '';
        const category = document.getElementById('estoque-categoria')?.value || 'all';
        const status = document.getElementById('estoque-status')?.value || 'all';
        
        // Verifica cache
        const filterKey = `${searchTerm}|${category}|${status}`;
        if (filteredProductsCache && lastFilterParams === filterKey) {
            return sortProducts(filteredProductsCache);
        }
        
        let filtered = products.filter(p => {
            // Filtro de busca
            if (searchTerm) {
                const matchName = p.nome.toLowerCase().includes(searchTerm);
                const matchCode = (p.code || '').toLowerCase().includes(searchTerm);
                const matchCategory = (p.categoria || '').toLowerCase().includes(searchTerm);
                
                if (!matchName && !matchCode && !matchCategory) {
                    return false;
                }
            }
            
            // Filtro de categoria
            if (category !== 'all' && p.categoria !== category) {
                return false;
            }
            
            // Filtro de status
            if (status !== 'all') {
                const minStock = p.minStock || 5;
                
                switch(status) {
                    case 'critical':
                        if (p.qtd !== 0) return false;
                        break;
                    case 'low':
                        if (p.qtd === 0 || p.qtd > minStock) return false;
                        break;
                    case 'ok':
                        if (p.qtd <= minStock || p.qtd > minStock * 3) return false;
                        break;
                    case 'excess':
                        if (p.qtd <= minStock * 3) return false;
                        break;
                }
            }
            
            return true;
        });
        
        // Atualiza cache
        filteredProductsCache = filtered;
        lastFilterParams = filterKey;
        
        return sortProducts(filtered);
    }
    
    function sortProducts(products) {
        const [field, direction] = currentSort.includes('-desc') 
            ? [currentSort.replace('-desc', ''), 'desc']
            : [currentSort, sortDirection];
        
        return [...products].sort((a, b) => {
            let aVal, bVal;
            
            switch(field) {
                case 'nome':
                    aVal = (a.nome || '').toLowerCase();
                    bVal = (b.nome || '').toLowerCase();
                    break;
                case 'qtd':
                    aVal = a.qtd || 0;
                    bVal = b.qtd || 0;
                    break;
                case 'preco':
                    aVal = a.preco || 0;
                    bVal = b.preco || 0;
                    break;
                case 'sold':
                    aVal = a.sold || 0;
                    bVal = b.sold || 0;
                    break;
                default:
                    return 0;
            }
            
            if (typeof aVal === 'string') {
                const comparison = aVal.localeCompare(bVal);
                return direction === 'desc' ? -comparison : comparison;
            }
            
            const comparison = aVal - bVal;
            return direction === 'desc' ? -comparison : comparison;
        });
    }
    
    // ========================================
    // CÁLCULOS E ANÁLISES
    // ========================================
    
    function calculateInventoryValue(products) {
        return products.reduce((sum, p) => {
            const value = (p.cost || p.preco) * p.qtd;
            return sum + value;
        }, 0);
    }
    
    function calculateTotalItems(products) {
        return products.reduce((sum, p) => sum + (p.qtd || 0), 0);
    }
    
    function calculateAverageRotation(products) {
        const withSales = products.filter(p => p.sold > 0);
        if (withSales.length === 0) return 0;
        
        const totalRotation = withSales.reduce((sum, p) => {
            const rotation = p.sold / ((p.qtd || 1) + p.sold);
            return sum + rotation;
        }, 0);
        
        return (totalRotation / withSales.length * 100).toFixed(1);
    }
    
    function calculateProductRotation(product) {
        if (!product.sold || product.sold === 0) return null;
        
        const totalQty = (product.qtd || 0) + product.sold;
        const rotationRate = (product.sold / totalQty) * 100;
        
        if (rotationRate >= 70) return 'Giro alto';
        if (rotationRate >= 40) return 'Giro médio';
        if (rotationRate >= 20) return 'Giro baixo';
        return 'Giro muito baixo';
    }
    
    // ========================================
    // MOVIMENTAÇÕES DE ESTOQUE
    // ========================================
    
    function adjustStock(productId) {
        if (!checkDependencies()) return;
        
        const product = window.state.getProducts().find(p => p.id === productId);
        if (!product) {
            window.utils.showToast('Produto não encontrado', 'error');
            return;
        }
        
        Swal.fire({
            title: '<i class="bi bi-arrow-left-right"></i> Ajustar Estoque',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>${product.nome}</strong><br>
                        <small class="text-muted">${product.code || 'Sem código'}</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Estoque Atual</label>
                        <input type="text" 
                               class="form-control form-control-lg text-center" 
                               value="${product.qtd} ${product.unit || 'un'}" 
                               readonly>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Tipo de Movimentação *</label>
                        <select id="movement-type" class="form-select">
                            <option value="add">➕ Entrada (Adicionar ao estoque)</option>
                            <option value="remove">➖ Saída (Remover do estoque)</option>
                            <option value="adjust">🔧 Ajuste (Definir quantidade exata)</option>
                            <option value="return">↩️ Devolução (Retorno de produto)</option>
                            <option value="loss">⚠️ Perda (Avaria, vencimento, etc)</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Quantidade *</label>
                        <input type="number" 
                               id="movement-qty" 
                               class="form-control form-control-lg" 
                               min="0" 
                               step="1"
                               placeholder="Digite a quantidade"
                               required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Motivo/Observação</label>
                        <textarea id="movement-obs" 
                                  class="form-control" 
                                  rows="2"
                                  placeholder="Ex: Reposição do fornecedor X, Avaria no transporte, Inventário..."></textarea>
                    </div>
                    
                    <div id="new-stock-preview" class="alert alert-secondary" style="display: none;">
                        <strong>Novo estoque após movimentação:</strong>
                        <div class="h4 mb-0 mt-2" id="preview-value"></div>
                    </div>
                </div>
            `,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-check-circle"></i> Confirmar Movimentação',
            cancelButtonText: '<i class="bi bi-x-circle"></i> Cancelar',
            didOpen: () => {
                const typeSelect = document.getElementById('movement-type');
                const qtyInput = document.getElementById('movement-qty');
                const preview = document.getElementById('new-stock-preview');
                const previewValue = document.getElementById('preview-value');
                
                function updatePreview() {
                    const type = typeSelect.value;
                    const qty = parseInt(qtyInput.value) || 0;
                    
                    if (qty > 0) {
                        let newQty = product.qtd;
                        
                        switch(type) {
                            case 'add':
                            case 'return':
                                newQty += qty;
                                break;
                            case 'remove':
                            case 'loss':
                                newQty = Math.max(0, newQty - qty);
                                break;
                            case 'adjust':
                                newQty = qty;
                                break;
                        }
                        
                        preview.style.display = 'block';
                        previewValue.textContent = `${newQty} ${product.unit || 'un'}`;
                        
                        if (newQty === 0) {
                            previewValue.className = 'h4 mb-0 mt-2 text-danger';
                        } else if (newQty <= (product.minStock || 5)) {
                            previewValue.className = 'h4 mb-0 mt-2 text-warning';
                        } else {
                            previewValue.className = 'h4 mb-0 mt-2 text-success';
                        }
                    } else {
                        preview.style.display = 'none';
                    }
                }
                
                typeSelect.addEventListener('change', updatePreview);
                qtyInput.addEventListener('input', updatePreview);
                qtyInput.focus();
            },
            preConfirm: () => {
                const type = document.getElementById('movement-type').value;
                const qty = parseInt(document.getElementById('movement-qty').value);
                const obs = document.getElementById('movement-obs').value.trim();
                
                if (isNaN(qty) || qty <= 0) {
                    Swal.showValidationMessage('Por favor, informe uma quantidade válida');
                    return false;
                }
                
                if (type === 'remove' && qty > product.qtd) {
                    Swal.showValidationMessage(
                        `Quantidade indisponível. Estoque atual: ${product.qtd} ${product.unit || 'un'}`
                    );
                    return false;
                }
                
                return { type, qty, obs };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                processStockMovement(product, result.value);
            }
        });
    }
    
    function processStockMovement(product, movement) {
        const { type, qty, obs } = movement;
        const oldQty = product.qtd;
        let newQty = oldQty;
        let movementType = '';
        
        switch(type) {
            case 'add':
                newQty += qty;
                movementType = 'entrada';
                break;
            case 'remove':
                newQty = Math.max(0, newQty - qty);
                movementType = 'saida';
                break;
            case 'adjust':
                newQty = qty;
                movementType = 'ajuste';
                break;
            case 'return':
                newQty += qty;
                movementType = 'devolucao';
                break;
            case 'loss':
                newQty = Math.max(0, newQty - qty);
                movementType = 'perda';
                break;
        }
        
        const updatedProduct = { ...product, qtd: newQty };
        window.state.updateProduct(product.id, updatedProduct);
        
        recordMovement({
            productId: product.id,
            productName: product.nome,
            type: movementType,
            quantity: qty,
            oldStock: oldQty,
            newStock: newQty,
            reason: obs || getDefaultReason(type),
            date: new Date().toISOString(),
            user: 'Sistema'
        });
        
        const difference = newQty - oldQty;
        const icon = difference > 0 ? 'arrow-up-circle' : difference < 0 ? 'arrow-down-circle' : 'dash-circle';
        const color = difference > 0 ? 'success' : difference < 0 ? 'warning' : 'info';
        
        window.utils.showToast(
            `Estoque atualizado: ${oldQty} → ${newQty} ${product.unit || 'un'}`,
            color
        );
        
        window.estoque.render();
    }
    
    function getDefaultReason(type) {
        const reasons = {
            'add': 'Entrada de mercadoria',
            'remove': 'Saída de mercadoria',
            'adjust': 'Ajuste de inventário',
            'return': 'Devolução de cliente',
            'loss': 'Perda de mercadoria'
        };
        return reasons[type] || 'Movimentação manual';
    }
    
    // ========================================
    // HISTÓRICO DE MOVIMENTAÇÕES
    // ========================================
    
    function recordMovement(movement) {
        try {
            const history = getMovementHistory();
            history.push(movement);
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }
            localStorage.setItem('stock-movements', JSON.stringify(history));
        } catch (error) {
            console.error('Erro ao registrar movimentação:', error);
        }
    }
    
    function getMovementHistory(productId = null) {
        try {
            const history = JSON.parse(localStorage.getItem('stock-movements') || '[]');
            if (productId) {
                return history.filter(m => m.productId === productId);
            }
            return history;
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            return [];
        }
    }
    
    function loadMovementHistory() {
        const history = getMovementHistory();
        console.log(`Histórico de movimentações carregado: ${history.length} registros`);
    }
    
    function viewHistory(productId) {
        if (!checkDependencies()) return;
        
        const product = window.state.getProducts().find(p => p.id === productId);
        if (!product) {
            window.utils.showToast('Produto não encontrado', 'error');
            return;
        }
        
        const movements = getMovementHistory(productId);
        const sales = window.state.getSales().filter(s => 
            s.items.some(i => i.id === productId)
        );
        
        let historyHTML = `
            <div class="text-start">
                <div class="alert alert-primary">
                    <h6 class="mb-2">${product.nome}</h6>
                    <div class="row g-2 small">
                        <div class="col-6">
                            <strong>Código:</strong> ${product.code || 'N/A'}
                        </div>
                        <div class="col-6">
                            <strong>Categoria:</strong> ${product.categoria || 'N/A'}
                        </div>
                        <div class="col-6">
                            <strong>Estoque atual:</strong> ${product.qtd} ${product.unit || 'un'}
                        </div>
                        <div class="col-6">
                            <strong>Estoque mínimo:</strong> ${product.minStock || 5} ${product.unit || 'un'}
                        </div>
                    </div>
                </div>
                
                <ul class="nav nav-tabs mb-3" role="tablist">
                    <li class="nav-item">
                        <a class="nav-link active" data-bs-toggle="tab" href="#movements-tab">
                            <i class="bi bi-arrow-left-right"></i> Movimentações (${movements.length})
                        </a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" data-bs-toggle="tab" href="#sales-tab">
                            <i class="bi bi-cart"></i> Vendas (${sales.length})
                        </a>
                    </li>
                </ul>
                
                <div class="tab-content">
                    <div class="tab-pane fade show active" id="movements-tab">
        `;
        
        if (movements.length > 0) {
            historyHTML += '<div class="timeline">';
            movements.slice(-10).reverse().forEach(m => {
                const typeIcons = {
                    'entrada': { icon: 'arrow-up-circle', color: 'success' },
                    'saida': { icon: 'arrow-down-circle', color: 'warning' },
                    'ajuste': { icon: 'dash-circle', color: 'info' },
                    'devolucao': { icon: 'arrow-counterclockwise', color: 'primary' },
                    'perda': { icon: 'x-circle', color: 'danger' }
                };
                const typeInfo = typeIcons[m.type] || { icon: 'circle', color: 'secondary' };
                
                historyHTML += `
                    <div class="timeline-item mb-3 pb-3 border-bottom">
                        <div class="d-flex align-items-start">
                            <i class="bi bi-${typeInfo.icon} text-${typeInfo.color} me-2 fs-5"></i>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div>
                                        <strong class="text-capitalize">${m.type}</strong>
                                        <span class="badge bg-${typeInfo.color} ms-2">
                                            ${m.quantity} ${product.unit || 'un'}
                                        </span>
                                    </div>
                                    <small class="text-muted">
                                        ${new Date(m.date).toLocaleString('pt-BR')}
                                    </small>
                                </div>
                                <div class="small text-muted mt-1">
                                    ${m.oldStock} → ${m.newStock} ${product.unit || 'un'}
                                </div>
                                ${m.reason ? `
                                    <div class="small mt-1">
                                        <i class="bi bi-chat-left-text"></i> ${m.reason}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            historyHTML += '</div>';
        } else {
            historyHTML += '<p class="text-muted text-center py-4">Nenhuma movimentação registrada</p>';
        }
        
        historyHTML += `
                    </div>
                    <div class="tab-pane fade" id="sales-tab">
        `;
        
        if (sales.length > 0) {
            sales.slice(-10).reverse().forEach(s => {
                const item = s.items.find(i => i.id === productId);
                historyHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom">
                        <div>
                            <div>
                                <i class="bi bi-calendar3"></i>
                                ${new Date(s.date).toLocaleString('pt-BR')}
                            </div>
                            <div class="small text-muted">
                                Pagamento: ${s.payment}
                            </div>
                        </div>
                        <div class="text-end">
                            <div>
                                <strong>${item.qty} ${product.unit || 'un'}</strong>
                            </div>
                            <div class="text-primary">
                                R$ ${window.utils.formatCurrency(item.preco * item.qty)}
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            historyHTML += '<p class="text-muted text-center py-4">Nenhuma venda registrada</p>';
        }
        
        historyHTML += `
                    </div>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: '<i class="bi bi-clock-history"></i> Histórico Completo',
            html: historyHTML,
            width: '700px',
            showCloseButton: true,
            showCancelButton: false,
            confirmButtonText: '<i class="bi bi-download"></i> Exportar Histórico',
            customClass: {
                confirmButton: 'btn btn-outline-primary'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                exportProductHistory(product, movements, sales);
            }
        });
    }
    
    function viewMovementHistory() {
        if (!checkDependencies()) return;
        
        const movements = getMovementHistory();
        
        if (movements.length === 0) {
            window.utils.showAlert(
                'Histórico Vazio',
                'info',
                'Nenhuma movimentação foi registrada ainda.'
            );
            return;
        }
        
        const groupedByProduct = {};
        movements.forEach(m => {
            if (!groupedByProduct[m.productId]) {
                groupedByProduct[m.productId] = [];
            }
            groupedByProduct[m.productId].push(m);
        });
        
        let html = `
            <div class="text-start">
                <div class="alert alert-info mb-3">
                    <i class="bi bi-info-circle"></i>
                    Total de <strong>${movements.length}</strong> movimentações registradas
                    para <strong>${Object.keys(groupedByProduct).length}</strong> produtos
                </div>
                
                <div class="table-responsive" style="max-height: 500px; overflow-y: auto;">
                    <table class="table table-sm table-hover">
                        <thead class="sticky-top bg-white">
                            <tr>
                                <th>Data/Hora</th>
                                <th>Produto</th>
                                <th>Tipo</th>
                                <th>Qtd</th>
                                <th>Estoque</th>
                                <th>Motivo</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        movements.slice(-100).reverse().forEach(m => {
            const typeColors = {
                'entrada': 'success',
                'saida': 'warning',
                'ajuste': 'info',
                'devolucao': 'primary',
                'perda': 'danger'
            };
            
            html += `
                <tr>
                    <td class="small">${new Date(m.date).toLocaleString('pt-BR', { 
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</td>
                    <td>${m.productName}</td>
                    <td>
                        <span class="badge bg-${typeColors[m.type] || 'secondary'} text-capitalize">
                            ${m.type}
                        </span>
                    </td>
                    <td>${m.quantity}</td>
                    <td class="small text-muted">${m.oldStock} → ${m.newStock}</td>
                    <td class="small">${m.reason || '-'}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: '<i class="bi bi-clock-history"></i> Histórico Geral de Movimentações',
            html: html,
            width: '900px',
            showCloseButton: true,
            showCancelButton: false,
            confirmButtonText: '<i class="bi bi-download"></i> Exportar CSV',
            customClass: {
                confirmButton: 'btn btn-outline-primary'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                exportMovementHistory(movements);
            }
        });
    }
    
    // ========================================
    // FUNÇÕES DE ESTOQUE INTELIGENTE
    // ========================================
    
    /**
     * Calcula a média de vendas diárias de um produto nos últimos 'days' dias.
     * @param {string} productId
     * @param {number} days - padrão 30
     * @returns {number}
     */
    function getAverageDailySales(productId, days = 30) {
        const sales = window.state.getSales();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        let totalQty = 0;
        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate >= cutoff) {
                sale.items.forEach(item => {
                    if (item.id === productId) totalQty += item.qty;
                });
            }
        });
        return totalQty / days;
    }

    /**
     * Calcula o ponto de reposição (ROP) para um produto.
     * ROP = (demanda média diária * leadTime) + estoqueSegurança
     * @param {Object} product
     * @returns {number}
     */
    function calculateReorderPoint(product) {
        const avgDaily = getAverageDailySales(product.id);
        const leadTime = product.leadTime || 3;
        const safety = product.safetyStock || (avgDaily * leadTime * 0.2); // 20% do consumo no lead time
        return Math.ceil(avgDaily * leadTime + safety);
    }

    /**
     * Calcula a quantidade econômica de pedido (EOQ) para um produto.
     * EOQ = √(2 * DemandaAnual * CustoPedido / CustoArmazenagemAnual)
     * @param {Object} product
     * @returns {number|null}
     */
    function calculateEOQ(product) {
        const annualDemand = getAverageDailySales(product.id) * 365;
        const orderCost = product.orderCost || 10;
        const holdingCost = (product.holdingCost || 0.1) * 365; // converte para anual
        if (holdingCost <= 0 || annualDemand <= 0) return null;
        return Math.sqrt((2 * annualDemand * orderCost) / holdingCost);
    }

    /**
     * Gera uma lista de produtos que precisam ser repostos, com sugestões de quantidade.
     * Agrupa por fornecedor.
     * @returns {Object} where keys are supplierIds (or 'sem-fornecedor') and values are arrays of products with suggested quantity.
     */
    function generateSmartReplenishment() {
        const products = window.state.getProducts();
        const result = {};

        products.forEach(p => {
            const rop = calculateReorderPoint(p);
            if (p.qtd <= rop) {
                const avgDaily = getAverageDailySales(p.id);
                const eoq = calculateEOQ(p);
                let suggested = eoq ? eoq : Math.ceil(rop - p.qtd + avgDaily * (p.leadTime || 3));
                suggested = Math.max(Math.round(suggested), 1);

                const supplierKey = p.supplierId || 'sem-fornecedor';
                if (!result[supplierKey]) result[supplierKey] = [];
                result[supplierKey].push({
                    ...p,
                    rop,
                    suggested,
                    avgDaily,
                    eoq: eoq ? Math.round(eoq) : null
                });
            }
        });

        return result;
    }

    /**
     * Exibe um modal com a lista de produtos a repor, permitindo exportar pedido.
     */
    function showSmartReplenishment() {
        const bySupplier = generateSmartReplenishment();
        const supplierCount = Object.keys(bySupplier).length;

        if (supplierCount === 0) {
            window.utils.showAlert('Estoque OK', 'success', 'Nenhum produto precisa de reposição no momento.');
            return;
        }

        let html = '<div class="text-start">';
        for (const [supplierId, items] of Object.entries(bySupplier)) {
            const supplierName = supplierId === 'sem-fornecedor' ? 'Sem fornecedor' : 
                (window.state.getSuppliers().find(s => s.id === supplierId)?.nome || supplierId);
            
            html += `
                <div class="card-modern mb-3 p-3">
                    <h6 class="mb-3"><i class="bi bi-truck"></i> ${supplierName}</h6>
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Estoque</th>
                                <th>Mínimo</th>
                                <th>ROP</th>
                                <th>Média/dia</th>
                                <th>Sugerido</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            items.forEach(p => {
                html += `
                    <tr>
                        <td>${p.nome}</td>
                        <td>${p.qtd} ${p.unit || 'un'}</td>
                        <td>${p.minStock || 5}</td>
                        <td>${p.rop}</td>
                        <td>${p.avgDaily.toFixed(2)}</td>
                        <td class="fw-bold text-success">${p.suggested}</td>
                    </tr>
                `;
            });
            html += '</tbody></table></div>';
        }
        html += '</div>';

        Swal.fire({
            title: '<i class="bi bi-cpu"></i> Reposição Inteligente',
            html: html,
            width: '800px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-download"></i> Exportar Pedidos',
            cancelButtonText: 'Fechar'
        }).then((result) => {
            if (result.isConfirmed) {
                exportPurchaseOrder(bySupplier);
            }
        });
    }

    /**
     * Exporta pedidos de compra agrupados por fornecedor em um arquivo CSV.
     * @param {Object} bySupplier - resultado de generateSmartReplenishment
     */
    function exportPurchaseOrder(bySupplier) {
        const data = [];
        for (const [supplierId, items] of Object.entries(bySupplier)) {
            const supplierName = supplierId === 'sem-fornecedor' ? 'Sem fornecedor' : 
                (window.state.getSuppliers().find(s => s.id === supplierId)?.nome || supplierId);
            
            items.forEach(p => {
                data.push({
                    'Fornecedor': supplierName,
                    'Código': p.code || '',
                    'Produto': p.nome,
                    'Quantidade Sugerida': p.suggested,
                    'Unidade': p.unit || 'UN',
                    'Estoque Atual': p.qtd,
                    'Ponto de Reposição': p.rop,
                    'Média Diária': p.avgDaily.toFixed(2),
                    'Preço Unitário (R$)': p.cost ? p.cost.toFixed(2) : p.preco.toFixed(2),
                    'Valor Total (R$)': ((p.cost || p.preco) * p.suggested).toFixed(2)
                });
            });
        }
        window.utils.exportToCSV(data, `pedido-inteligente-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast('Pedidos exportados!', 'success');
    }
    
    // ========================================
    // ALERTAS AUTOMÁTICOS
    // ========================================
    
    function startAlertMonitoring() {
        const products = window.state.getProducts();
        checkStockAlerts(products);
        
        if (alertCheckInterval) {
            clearInterval(alertCheckInterval);
        }
        
        alertCheckInterval = setInterval(() => {
            const currentProducts = window.state.getProducts();
            checkStockAlerts(currentProducts);
        }, ALERT_CONFIG.checkInterval);
    }
    
    function checkStockAlerts(products) {
        const now = Date.now();
        
        if (lastAlertCheck && (now - lastAlertCheck) < ALERT_CONFIG.checkInterval) {
            return;
        }
        
        lastAlertCheck = now;
        
        const criticalProducts = products.filter(p => p.qtd === 0);
        const lowStockProducts = products.filter(p => 
            p.qtd > 0 && p.qtd <= (p.minStock || 5)
        );
        
        const alerts = {
            timestamp: now,
            critical: criticalProducts.map(p => ({
                id: p.id,
                nome: p.nome,
                qtd: p.qtd
            })),
            lowStock: lowStockProducts.map(p => ({
                id: p.id,
                nome: p.nome,
                qtd: p.qtd,
                minStock: p.minStock || 5
            }))
        };
        
        localStorage.setItem('stock-alerts', JSON.stringify(alerts));
        
        const previousAlerts = JSON.parse(localStorage.getItem('stock-alerts-previous') || '{"critical":[],"lowStock":[]}');
        
        const newCritical = criticalProducts.filter(p => 
            !previousAlerts.critical.some(a => a.id === p.id)
        );
        
        if (newCritical.length > 0) {
            showStockAlert(newCritical, 'critical');
        }
        
        localStorage.setItem('stock-alerts-previous', JSON.stringify(alerts));
    }
    
    function showStockAlert(products, type) {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const title = type === 'critical' 
                ? '⚠️ Produtos sem estoque!'
                : '⚡ Estoque baixo!';
            
            const body = `${products.length} produto(s) necessitam atenção: ${products.slice(0, 3).map(p => p.nome).join(', ')}`;
            
            new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📦</text></svg>'
            });
        }
    }
    
    // ========================================
    // IMPORTAÇÃO E EXPORTAÇÃO
    // ========================================
    
    function importProducts() {
        if (!checkDependencies()) return;
        
        Swal.fire({
            title: '<i class="bi bi-upload"></i> Importar Produtos',
            html: `
                <div class="text-start">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        <strong>Formato esperado (CSV):</strong>
                        <pre class="mb-0 mt-2 small">nome,codigo,categoria,quantidade,preco,minimo,unidade</pre>
                        <small>Use ponto como separador decimal (ex: 10.50)</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Arquivo CSV</label>
                        <input type="file" 
                               id="import-file" 
                               class="form-control" 
                               accept=".csv,.txt"
                               required>
                    </div>
                    
                    <div class="form-check">
                        <input class="form-check-input" 
                               type="checkbox" 
                               id="import-update-existing"
                               checked>
                        <label class="form-check-label" for="import-update-existing">
                            Atualizar produtos existentes (mesmo código)
                        </label>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-upload"></i> Importar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const fileInput = document.getElementById('import-file');
                const updateExisting = document.getElementById('import-update-existing').checked;
                
                if (!fileInput.files || fileInput.files.length === 0) {
                    Swal.showValidationMessage('Por favor, selecione um arquivo');
                    return false;
                }
                
                return {
                    file: fileInput.files[0],
                    updateExisting
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                processImportFile(result.value.file, result.value.updateExisting);
            }
        });
    }
    
    function processImportFile(file, updateExisting) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n').filter(line => line.trim());
                
                if (lines.length < 2) {
                    window.utils.showAlert('Erro', 'error', 'Arquivo vazio ou inválido');
                    return;
                }
                
                const header = lines.shift();
                
                let imported = 0;
                let updated = 0;
                let errors = [];
                
                lines.forEach((line, index) => {
                    try {
                        const values = line.split(',').map(v => v.trim());
                        
                        if (values.length < 5) {
                            errors.push(`Linha ${index + 2}: Dados insuficientes`);
                            return;
                        }
                        
                        const [nome, code, categoria, qtd, preco, minStock, unit] = values;
                        
                        const existing = window.state.getProducts().find(p => 
                            p.code && code && p.code.toLowerCase() === code.toLowerCase()
                        );
                        
                        const productData = {
                            nome: nome,
                            code: code || '',
                            categoria: categoria || 'Outros',
                            qtd: parseInt(qtd) || 0,
                            preco: parseFloat(preco) || 0,
                            minStock: parseInt(minStock) || 5,
                            unit: unit || 'UN'
                        };
                        
                        if (existing && updateExisting) {
                            window.state.updateProduct(existing.id, productData);
                            updated++;
                        } else if (!existing) {
                            window.state.addProduct(productData);
                            imported++;
                        }
                        
                    } catch (error) {
                        errors.push(`Linha ${index + 2}: ${error.message}`);
                    }
                });
                
                let resultHTML = `
                    <div class="text-start">
                        <div class="alert alert-success">
                            <i class="bi bi-check-circle"></i>
                            <strong>${imported}</strong> produto(s) importado(s)
                            ${updated > 0 ? `<br><strong>${updated}</strong> produto(s) atualizado(s)` : ''}
                        </div>
                `;
                
                if (errors.length > 0) {
                    resultHTML += `
                        <div class="alert alert-warning">
                            <strong>Avisos (${errors.length}):</strong>
                            <ul class="mb-0 mt-2 small">
                                ${errors.slice(0, 10).map(e => `<li>${e}</li>`).join('')}
                                ${errors.length > 10 ? `<li>... e mais ${errors.length - 10} erros</li>` : ''}
                            </ul>
                        </div>
                    `;
                }
                
                resultHTML += '</div>';
                
                Swal.fire({
                    title: 'Importação Concluída',
                    html: resultHTML,
                    icon: errors.length > 0 ? 'warning' : 'success'
                });
                
                window.estoque.render();
                
            } catch (error) {
                console.error('Erro ao processar arquivo:', error);
                window.utils.showAlert('Erro', 'error', 'Falha ao processar arquivo CSV');
            }
        };
        
        reader.onerror = () => {
            window.utils.showAlert('Erro', 'error', 'Falha ao ler arquivo');
        };
        
        reader.readAsText(file);
    }
    
    function exportInventory() {
        if (!checkDependencies()) return;
        
        const products = window.state.getProducts();
        
        if (products.length === 0) {
            window.utils.showAlert('Aviso', 'warning', 'Não há produtos para exportar');
            return;
        }
        
        const data = products.map(p => ({
            'Código': p.code || '',
            'Produto': p.nome,
            'Categoria': p.categoria || '',
            'Quantidade': p.qtd,
            'Unidade': p.unit || 'UN',
            'Preço': window.utils.formatCurrency(p.preco),
            'Custo': p.cost ? window.utils.formatCurrency(p.cost) : '0,00',
            'Estoque Mínimo': p.minStock || 5,
            'Valor em Estoque': window.utils.formatCurrency((p.cost || p.preco) * p.qtd),
            'Vendidos': p.sold || 0,
            'Receita Total': window.utils.formatCurrency((p.sold || 0) * p.preco),
            'Status': getStockStatus(p).text
        }));
        
        window.utils.exportToCSV(
            data, 
            `inventario-${new Date().toISOString().split('T')[0]}.csv`
        );
        
        window.utils.showToast('Inventário exportado com sucesso!', 'success');
    }
    
    function exportProductHistory(product, movements, sales) {
        const data = [
            ...movements.map(m => ({
                'Data': new Date(m.date).toLocaleString('pt-BR'),
                'Tipo': 'Movimentação',
                'Operação': m.type,
                'Quantidade': m.quantity,
                'Estoque Anterior': m.oldStock,
                'Estoque Novo': m.newStock,
                'Motivo': m.reason || '',
                'Valor': '-'
            })),
            ...sales.map(s => {
                const item = s.items.find(i => i.id === product.id);
                return {
                    'Data': new Date(s.date).toLocaleString('pt-BR'),
                    'Tipo': 'Venda',
                    'Operação': 'venda',
                    'Quantidade': item.qty,
                    'Estoque Anterior': '-',
                    'Estoque Novo': '-',
                    'Motivo': `Venda - ${s.payment}`,
                    'Valor': window.utils.formatCurrency(item.preco * item.qty)
                };
            })
        ].sort((a, b) => new Date(b.Data) - new Date(a.Data));
        
        window.utils.exportToCSV(
            data,
            `historico-${product.code || product.id}-${new Date().toISOString().split('T')[0]}.csv`
        );
        
        window.utils.showToast('Histórico exportado!', 'success');
    }
    
    function exportMovementHistory(movements) {
        const data = movements.map(m => ({
            'Data/Hora': new Date(m.date).toLocaleString('pt-BR'),
            'Produto ID': m.productId,
            'Produto': m.productName,
            'Tipo': m.type,
            'Quantidade': m.quantity,
            'Estoque Anterior': m.oldStock,
            'Estoque Novo': m.newStock,
            'Diferença': m.newStock - m.oldStock,
            'Motivo': m.reason || '',
            'Usuário': m.user || 'Sistema'
        }));
        
        window.utils.exportToCSV(
            data,
            `historico-movimentacoes-${new Date().toISOString().split('T')[0]}.csv`
        );
        
        window.utils.showToast('Histórico exportado!', 'success');
    }
    
    // ========================================
    // CÓDIGOS DE BARRAS
    // ========================================
    
    function generateBarcode(productId) {
        if (!checkDependencies()) return;
        
        const product = window.state.getProducts().find(p => p.id === productId);
        if (!product) return;
        
        if (!product.code) {
            window.utils.showAlert(
                'Código não cadastrado',
                'warning',
                'Este produto não possui código de barras cadastrado.'
            );
            return;
        }
        
        const barcodeArt = generateBarcodeASCII(product.code);
        
        Swal.fire({
            title: `<i class="bi bi-upc-scan"></i> Código de Barras`,
            html: `
                <div class="text-center">
                    <h6 class="mb-3">${product.nome}</h6>
                    <div class="bg-white p-4 border rounded">
                        <pre class="mb-0" style="font-family: monospace; letter-spacing: -1px; line-height: 1.2;">
${barcodeArt}
                        </pre>
                        <div class="mt-3">
                            <strong style="font-size: 1.2rem; letter-spacing: 2px;">${product.code}</strong>
                        </div>
                    </div>
                    <div class="mt-3 small text-muted">
                        <i class="bi bi-info-circle"></i>
                        Para gerar códigos de barras reais, recomenda-se usar bibliotecas como JsBarcode
                    </div>
                </div>
            `,
            width: '500px',
            showCloseButton: true,
            showCancelButton: false,
            confirmButtonText: '<i class="bi bi-printer"></i> Imprimir',
        }).then((result) => {
            if (result.isConfirmed) {
                printBarcode(product);
            }
        });
    }
    
    function generateBarcodeASCII(code) {
        const lines = [];
        lines.push('█ █ ████ █ █ █ ██ ███ █ ██ █ █ ████');
        lines.push('█ █ ████ █ █ █ ██ ███ █ ██ █ █ ████');
        lines.push('█ █ ████ █ █ █ ██ ███ █ ██ █ █ ████');
        lines.push('█ █ ████ █ █ █ ██ ███ █ ██ █ █ ████');
        lines.push('█ █ ████ █ █ █ ██ ███ █ ██ █ █ ████');
        return lines.join('\n');
    }
    
    function generateBarcodes() {
        if (!checkDependencies()) return;
        
        const products = window.state.getProducts().filter(p => p.code);
        
        if (products.length === 0) {
            window.utils.showAlert(
                'Sem códigos',
                'warning',
                'Nenhum produto possui código de barras cadastrado.'
            );
            return;
        }
        
        let html = `
            <div class="text-start">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i>
                    ${products.length} produto(s) com código de barras
                </div>
                
                <div style="max-height: 400px; overflow-y: auto;">
        `;
        
        products.forEach(p => {
            html += `
                <div class="border rounded p-2 mb-2">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${p.nome}</strong>
                            <div class="small text-muted">${p.code}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-primary" 
                                onclick="window.estoque.generateBarcode('${p.id}')">
                            <i class="bi bi-upc-scan"></i> Ver
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        Swal.fire({
            title: '<i class="bi bi-upc-scan"></i> Códigos de Barras',
            html: html,
            width: '600px',
            showCloseButton: true,
            confirmButtonText: 'Fechar'
        });
    }
    
    function printBarcode(product) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Código de Barras - ${product.nome}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding: 20px;
                        }
                        .barcode {
                            margin: 20px 0;
                            font-family: monospace;
                            letter-spacing: -1px;
                            white-space: pre;
                        }
                        .code {
                            font-size: 18px;
                            font-weight: bold;
                            letter-spacing: 2px;
                            margin-top: 10px;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h3>${product.nome}</h3>
                    <div class="barcode">${generateBarcodeASCII(product.code)}</div>
                    <div class="code">${product.code}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    // ========================================
    // OUTRAS FUNCIONALIDADES
    // ========================================
    
    function generateReplenishmentOrder() {
        if (!checkDependencies()) return;
        
        const products = window.state.getProducts();
        const toReplenish = products.filter(p => p.qtd <= (p.minStock || 5));
        
        if (toReplenish.length === 0) {
            window.utils.showAlert(
                'Estoque OK',
                'success',
                'Nenhum produto necessita reposição no momento.'
            );
            return;
        }
        
        let html = `
            <div class="text-start">
                <div class="alert alert-info">
                    <i class="bi bi-cart-plus"></i>
                    <strong>${toReplenish.length}</strong> produto(s) necessitam reposição
                </div>
                
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-sm table-hover">
                        <thead class="sticky-top bg-white">
                            <tr>
                                <th>Produto</th>
                                <th>Atual</th>
                                <th>Mínimo</th>
                                <th>Sugerido</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        toReplenish.forEach(p => {
            const minStock = p.minStock || 5;
            const suggested = Math.max(minStock * 2, minStock - p.qtd + 10);
            
            html += `
                <tr>
                    <td>
                        <strong>${p.nome}</strong>
                        <div class="small text-muted">${p.code || 'S/código'}</div>
                    </td>
                    <td class="${p.qtd === 0 ? 'text-danger' : 'text-warning'} fw-bold">
                        ${p.qtd} ${p.unit || 'un'}
                    </td>
                    <td>${minStock} ${p.unit || 'un'}</td>
                    <td class="text-success fw-bold">${suggested} ${p.unit || 'un'}</td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: '<i class="bi bi-cart-plus"></i> Pedido de Reposição',
            html: html,
            width: '700px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-download"></i> Exportar Pedido',
            cancelButtonText: 'Fechar'
        }).then((result) => {
            if (result.isConfirmed) {
                exportReplenishmentOrder(toReplenish);
            }
        });
    }
    
    function exportReplenishmentOrder(products) {
        const data = products.map(p => {
            const minStock = p.minStock || 5;
            const suggested = Math.max(minStock * 2, minStock - p.qtd + 10);
            
            return {
                'Código': p.code || '',
                'Produto': p.nome,
                'Categoria': p.categoria || '',
                'Estoque Atual': p.qtd,
                'Estoque Mínimo': minStock,
                'Quantidade Sugerida': suggested,
                'Unidade': p.unit || 'UN',
                'Valor Unitário': p.cost ? window.utils.formatCurrency(p.cost) : window.utils.formatCurrency(p.preco),
                'Valor Total': window.utils.formatCurrency((p.cost || p.preco) * suggested)
            };
        });
        
        window.utils.exportToCSV(
            data,
            `pedido-reposicao-${new Date().toISOString().split('T')[0]}.csv`
        );
        
        window.utils.showToast('Pedido exportado!', 'success');
    }
    
    function printInventory() {
        if (!checkDependencies()) return;
        
        const products = filterProducts(window.state.getProducts());
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Inventário - ${new Date().toLocaleDateString('pt-BR')}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                        }
                        h1 {
                            text-align: center;
                            margin-bottom: 30px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 8px;
                            text-align: left;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                        .text-right {
                            text-align: right;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            font-size: 12px;
                            color: #666;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <h1>Inventário de Estoque</h1>
                    <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <p><strong>Total de produtos:</strong> ${products.length}</p>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Produto</th>
                                <th>Categoria</th>
                                <th class="text-right">Estoque</th>
                                <th class="text-right">Preço</th>
                                <th class="text-right">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => `
                                <tr>
                                    <td>${p.code || '-'}</td>
                                    <td>${p.nome}</td>
                                    <td>${p.categoria || '-'}</td>
                                    <td class="text-right">${p.qtd} ${p.unit || 'un'}</td>
                                    <td class="text-right">R$ ${window.utils.formatCurrency(p.preco)}</td>
                                    <td class="text-right">R$ ${window.utils.formatCurrency(p.preco * p.qtd)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="5"><strong>TOTAL</strong></td>
                                <td class="text-right"><strong>R$ ${window.utils.formatCurrency(calculateInventoryValue(products))}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div class="footer">
                        InNovaIdeia - Sistema de Gestão de Estoque
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
    
    function deleteProduct(id) {
        if (!checkDependencies()) return;
        
        const product = window.state.getProducts().find(p => p.id === id);
        if (!product) return;
        
        window.utils.showConfirm(
            'Remover produto?',
            `Tem certeza que deseja remover "${product.nome}"? Esta ação não poderá ser desfeita.`
        ).then((result) => {
            if (result.isConfirmed) {
                window.state.deleteProduct(id);
                window.utils.showToast('Produto removido com sucesso', 'success');
                window.estoque.render();
            }
        });
    }
    
    function initializeComponents() {
        setTimeout(() => {
            initMovementChart();
        }, 100);
        
        document.removeEventListener('keydown', handleKeyboardShortcuts);
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }
    
    function initMovementChart() {
        const ctx = document.getElementById('movementChart');
        if (!ctx) return;
        
        const movements = getMovementHistory();
        const last7Days = [];
        const entriesData = [];
        const exitsData = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            last7Days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            
            const dayMovements = movements.filter(m => 
                m.date.startsWith(dateStr)
            );
            
            const entries = dayMovements
                .filter(m => m.type === 'entrada' || m.type === 'devolucao')
                .reduce((sum, m) => sum + m.quantity, 0);
            
            const exits = dayMovements
                .filter(m => m.type === 'saida' || m.type === 'perda')
                .reduce((sum, m) => sum + m.quantity, 0);
            
            entriesData.push(entries);
            exitsData.push(exits);
        }
        
        if (window.movementChartInstance) {
            window.movementChartInstance.destroy();
        }
        
        window.movementChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: last7Days,
                datasets: [
                    {
                        label: 'Entradas',
                        data: entriesData,
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderColor: 'rgba(16, 185, 129, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Saídas',
                        data: exitsData,
                        backgroundColor: 'rgba(239, 68, 68, 0.6)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y} unidades`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }
    
    function refreshMovementChart() {
        initMovementChart();
        window.utils.showToast('Gráfico atualizado!', 'info');
    }
    
    function handleKeyboardShortcuts(e) {
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            window.modals.openProductModal();
        }
        
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            viewMovementHistory();
        }
    }
    
    function changeSort(value) {
        currentSort = value;
        filter();
    }
    
    function resetFilters() {
        document.getElementById('estoque-search').value = '';
        document.getElementById('estoque-categoria').value = 'all';
        document.getElementById('estoque-status').value = 'all';
        document.getElementById('estoque-sort').value = 'nome';
        
        currentSort = 'nome';
        sortDirection = 'asc';
        
        filteredProductsCache = null;
        lastFilterParams = null;
        
        filter();
        
        window.utils.showToast('Filtros limpos', 'info');
    }
    
    function filter() {
        const tbody = document.getElementById('estoque-table-body');
        if (tbody) {
            const filtered = filterProducts(window.state.getProducts());
            tbody.innerHTML = renderProductRows(filtered);
        }
    }
    
    const filterDebounced = window.utils.debounce(filter, 300);
    
    function sort(field) {
        if (currentSort === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort = field;
            sortDirection = 'asc';
        }
        
        filter();
    }
    
    // ========================================
    // INICIALIZAÇÃO DO MÓDULO
    // ========================================
    
    init();
    
    // ========================================
    // API PÚBLICA
    // ========================================
    
    return {
        render,
        filter,
        filterDebounced,
        sort,
        changeSort,
        resetFilters,
        adjustStock,
        viewHistory,
        viewMovementHistory,
        deleteProduct,
        exportInventory,
        importProducts,
        generateBarcode,
        generateBarcodes,
        generateReplenishmentOrder,
        printInventory,
        refreshMovementChart,
        // NOVAS FUNÇÕES
        showSmartReplenishment,
        getAverageDailySales,
        calculateReorderPoint,
        calculateEOQ,
        generateSmartReplenishment,
        exportPurchaseOrder
    };
})();