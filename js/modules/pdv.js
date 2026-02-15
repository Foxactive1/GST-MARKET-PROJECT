/**
 * ============================================================================
 * MÓDULO PDV (PONTO DE VENDA) - VERSÃO REVISADA 2.2.0
 * ============================================================================
 * 
 * Responsável por:
 * - Operações completas de caixa (abertura/fechamento)
 * - Vendas com múltiplas formas de pagamento
 * - Gestão de carrinho avançada
 * - Vendas suspensas e recuperação
 * - Sangria e reforço de caixa
 * - Hot keys e atalhos de teclado
 * - Scanner de código de barras
 * - Cupom fiscal e comprovantes
 * - Descontos e cashback
 * - Relatórios de caixa
 * - Produtos favoritos
 * 
 * Melhorias v2.2.0:
 * - Integração com utils aprimorados (parseMonetaryValue, formatCurrency, máscaras)
 * - Uso correto dos métodos de atualização do state (imutabilidade)
 * - Verificação de dependências no início
 * - Parsing consistente de valores monetários em todos os inputs
 * - Máscaras de moeda nos campos de entrada
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.2.0
 * @date 2026
 */

window.pdv = (function() {
    'use strict';
    
    // ========================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo PDV: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo PDV: window.utils não definido');
            return false;
        }
        return true;
    }
    
    // ========================================
    // ESTADO DO PDV
    // ========================================
    
    let cart = [];
    let currentSale = null;
    let suspendedSales = [];
    let currentFilter = 'all';
    let selectedClient = null;
    let globalDiscount = 0;
    let cashierSession = null;
    
    // Scanner de código de barras
    let scannerBuffer = '';
    let scannerTimeout = null;
    
    // Produtos favoritos (F1-F12)
    let favoriteProducts = {};
    
    // Cache para performance
    let productsCache = [];
    let lastProductUpdate = null;
    
    // ========================================
    // CONFIGURAÇÕES
    // ========================================
    
    const CONFIG = {
        scannerTimeout: 100,
        autoFocusSearch: true,
        soundEnabled: true,
        autoPrintReceipt: false,
        allowNegativeStock: false,
        requireCashierLogin: false,
        minChangeAlert: 100, // Alerta se troco > R$100
        maxDiscountPercent: 20, // Máximo 20% de desconto
        pointsPerReal: 1, // 1 ponto a cada R$1
        enableSuggestProducts: true
    };
    
    // Sons do PDV
    const SOUNDS = {
        beep: () => playSound(440, 100),
        error: () => playSound(220, 200),
        success: () => playSound(880, 150)
    };
    
    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    
    function init() {
        if (!checkDependencies()) return;
        loadCashierSession();
        loadSuspendedSales();
        loadFavoriteProducts();
        checkCashierStatus();
    }
    
    function loadCashierSession() {
        try {
            const saved = localStorage.getItem('pdv-cashier-session');
            if (saved) {
                cashierSession = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar sessão do caixa:', error);
        }
    }
    
    function loadSuspendedSales() {
        try {
            const saved = localStorage.getItem('pdv-suspended-sales');
            if (saved) {
                suspendedSales = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar vendas suspensas:', error);
            suspendedSales = [];
        }
    }
    
    function loadFavoriteProducts() {
        try {
            const saved = localStorage.getItem('pdv-favorite-products');
            if (saved) {
                favoriteProducts = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Erro ao carregar produtos favoritos:', error);
            favoriteProducts = {};
        }
    }
    
    function checkCashierStatus() {
        if (!cashierSession || !cashierSession.isOpen) {
            // Caixa fechado - exibir tela de abertura
            if (CONFIG.requireCashierLogin) {
                showCashierLogin();
            }
        }
    }
    
    // ========================================
    // RENDERIZAÇÃO PRINCIPAL
    // ========================================
    
    function render() {
        if (!checkDependencies()) {
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Erro ao carregar módulo PDV. Dependências não encontradas.
                </div>
            `;
            return;
        }
        
        const container = document.getElementById('mainContent');
        const state = window.state.get();
        
        // Atualiza cache de produtos
        if (!lastProductUpdate || 
            (Date.now() - lastProductUpdate) > 30000) {
            productsCache = state.products.filter(p => p.qtd > 0 || CONFIG.allowNegativeStock);
            lastProductUpdate = Date.now();
        }
        
        container.innerHTML = `
            <div class="fade-in">
                <!-- Header do PDV -->
                ${renderPDVHeader(state)}
                
                <!-- Mensagens e alertas -->
                ${renderAlerts()}
                
                <div class="row g-3">
                    <!-- Coluna de Produtos -->
                    <div class="col-lg-7">
                        ${renderProductsArea(state)}
                    </div>
                    
                    <!-- Coluna do Carrinho -->
                    <div class="col-lg-5">
                        ${renderCartArea(state)}
                    </div>
                </div>
                
                <!-- Barra de ações rápidas -->
                ${renderQuickActions()}
            </div>
        `;
        
        // Inicializa componentes
        initializeComponents();
    }
    
    // ========================================
    // RENDERIZAÇÃO DE COMPONENTES
    // ========================================
    
    function renderPDVHeader(state) {
        const sessionInfo = cashierSession || {};
        const totalSalesSession = calculateSessionSales();
        const suspendedCount = suspendedSales.length;
        
        return `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="mb-1">
                        <i class="bi bi-cash-register text-success"></i>
                        Ponto de Venda
                    </h2>
                    <p class="text-muted mb-0">
                        ${sessionInfo.isOpen ? `
                            <i class="bi bi-circle-fill text-success" style="font-size: 0.5rem;"></i>
                            Caixa aberto •
                            Operador: <strong>${sessionInfo.operator || 'Sistema'}</strong> •
                            Vendas: <strong class="text-success">R$ ${window.utils.formatCurrency(totalSalesSession)}</strong>
                        ` : `
                            <i class="bi bi-circle-fill text-danger" style="font-size: 0.5rem;"></i>
                            <strong class="text-danger">Caixa fechado</strong>
                        `}
                    </p>
                </div>
                
                <div class="d-flex gap-2 flex-wrap">
                    ${suspendedCount > 0 ? `
                        <button class="btn btn-warning" onclick="window.pdv.showSuspendedSales()">
                            <i class="bi bi-clock-history"></i>
                            Vendas Suspensas (${suspendedCount})
                        </button>
                    ` : ''}
                    
                    <div class="btn-group">
                        <button class="btn btn-outline-secondary" 
                                onclick="window.pdv.showCashierReport()"
                                title="Relatório do caixa">
                            <i class="bi bi-file-text"></i>
                        </button>
                        
                        <button class="btn btn-outline-secondary" 
                                onclick="window.pdv.showCashMovements()"
                                title="Sangria/Reforço">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        
                        <button class="btn btn-outline-secondary" 
                                onclick="window.pdv.showFavorites()"
                                title="Produtos favoritos">
                            <i class="bi bi-star"></i>
                        </button>
                    </div>
                    
                    ${sessionInfo.isOpen ? `
                        <button class="btn btn-danger" onclick="window.pdv.closeCashier()">
                            <i class="bi bi-lock"></i> Fechar Caixa
                        </button>
                    ` : `
                        <button class="btn btn-success" onclick="window.pdv.openCashier()">
                            <i class="bi bi-unlock"></i> Abrir Caixa
                        </button>
                    `}
                    
                    <button class="btn btn-outline-danger" onclick="window.pdv.clearCart()">
                        <i class="bi bi-trash"></i> Limpar
                    </button>
                </div>
            </div>
        `;
    }
    
    function renderAlerts() {
        let alerts = '';
        
        // Alerta de caixa fechado
        if (!cashierSession || !cashierSession.isOpen) {
            alerts += `
                <div class="alert alert-warning mb-3">
                    <i class="bi bi-exclamation-triangle"></i>
                    <strong>Atenção:</strong> O caixa está fechado. Abra o caixa para realizar vendas.
                </div>
            `;
        }
        
        // Alerta de modo scanner
        alerts += `
            <div class="alert alert-info mb-3 d-flex justify-content-between align-items-center">
                <div>
                    <i class="bi bi-upc-scan"></i>
                    <strong>Modo Scanner Ativo</strong> - Use o leitor de código de barras ou digite o código e pressione Enter
                </div>
                <span class="badge bg-info">F8 para desativar</span>
            </div>
        `;
        
        return alerts;
    }
    
    function renderProductsArea(state) {
        return `
            <div class="card-modern">
                <div class="card-header-modern">
                    <h5 class="card-title mb-0">
                        <i class="bi bi-grid"></i> Produtos Disponíveis
                    </h5>
                    <div class="search-box" style="width: 350px;">
                        <i class="bi bi-search"></i>
                        <input type="text" 
                               id="pdv-search" 
                               class="form-control" 
                               placeholder="Digite código, nome ou use o scanner..."
                               autocomplete="off"
                               autofocus>
                    </div>
                </div>
                
                <!-- Filtros rápidos -->
                <div class="d-flex gap-2 mb-3 flex-wrap">
                    <button class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('all')">
                        <i class="bi bi-grid-3x3"></i> Todos
                    </button>
                    <button class="btn btn-sm ${currentFilter === 'Alimentos' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('Alimentos')">
                        🍞 Alimentos
                    </button>
                    <button class="btn btn-sm ${currentFilter === 'Bebidas' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('Bebidas')">
                        🥤 Bebidas
                    </button>
                    <button class="btn btn-sm ${currentFilter === 'Higiene' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('Higiene')">
                        🧼 Higiene
                    </button>
                    <button class="btn btn-sm ${currentFilter === 'Limpeza' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('Limpeza')">
                        🧹 Limpeza
                    </button>
                    <button class="btn btn-sm ${currentFilter === 'favorites' ? 'btn-primary' : 'btn-outline-primary'}" 
                            onclick="window.pdv.filterCategory('favorites')">
                        <i class="bi bi-star-fill"></i> Favoritos
                    </button>
                </div>
                
                <!-- Grid de Produtos -->
                <div id="product-grid" 
                     class="product-grid" 
                     style="max-height: 550px; overflow-y: auto;">
                    ${renderProductGrid(filterProducts(productsCache))}
                </div>
                
                <div class="mt-3 text-muted small">
                    <i class="bi bi-info-circle"></i>
                    Dica: Use F1-F12 para acessar produtos favoritos rapidamente
                </div>
            </div>
        `;
    }
    
    function renderProductGrid(products) {
        if (!products || products.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-inbox text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">Nenhum produto disponível</p>
                    <button class="btn btn-primary btn-sm mt-3" onclick="window.modals.openProductModal()">
                        <i class="bi bi-plus"></i> Cadastrar Produto
                    </button>
                </div>
            `;
        }
        
        return products.map(p => {
            const inStock = p.qtd > 0 || CONFIG.allowNegativeStock;
            const isFavorite = Object.values(favoriteProducts).includes(p.id);
            const inCart = cart.find(item => item.id === p.id);
            
            return `
                <div class="product-card ${!inStock ? 'out-of-stock' : ''} ${inCart ? 'in-cart' : ''}" 
                     onclick="${inStock ? `window.pdv.addToCart('${p.id}')` : ''}"
                     data-product-id="${p.id}">
                    ${isFavorite ? `
                        <div class="position-absolute top-0 end-0 p-2">
                            <i class="bi bi-star-fill text-warning"></i>
                        </div>
                    ` : ''}
                    
                    <div class="d-flex justify-content-between">
                        <div class="flex-grow-1">
                            <div class="product-name">${p.nome}</div>
                            <div class="product-code">
                                <i class="bi bi-upc-scan"></i> ${p.code || 'S/código'}
                            </div>
                            ${p.categoria ? `
                                <span class="badge bg-light text-dark mt-1">${p.categoria}</span>
                            ` : ''}
                        </div>
                        <div class="text-end">
                            <div class="product-price">R$ ${window.utils.formatCurrency(p.preco)}</div>
                            <div class="product-stock ${p.qtd <= (p.minStock || 5) ? 'text-warning' : ''}">
                                <i class="bi bi-box"></i> ${p.qtd} ${p.unit || 'un'}
                            </div>
                            ${inCart ? `
                                <div class="badge bg-success mt-1">
                                    No carrinho: ${inCart.qty}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${!inStock ? `
                        <div class="overlay">
                            <strong>SEM ESTOQUE</strong>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
    
    function renderCartArea(state) {
        const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
        const hasClient = selectedClient !== null;
        
        return `
            <div class="cart-container">
                <!-- Cabeçalho do Carrinho -->
                <div class="p-3 border-bottom bg-light">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">
                            <i class="bi bi-cart3"></i> Carrinho
                            <span class="badge bg-primary ms-2" id="cart-count">${itemCount}</span>
                        </h5>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm ${hasClient ? 'btn-success' : 'btn-outline-secondary'}" 
                                    onclick="window.pdv.toggleClient()"
                                    title="Vincular cliente">
                                <i class="bi bi-person${hasClient ? '-check' : ''}"></i>
                            </button>
                            
                            <button class="btn btn-sm btn-outline-info" 
                                    onclick="window.pdv.applyGlobalDiscount()"
                                    title="Desconto na venda">
                                <i class="bi bi-percent"></i>
                            </button>
                            
                            <button class="btn btn-sm btn-outline-warning" 
                                    onclick="window.pdv.suspendSale()"
                                    title="Suspender venda"
                                    ${cart.length === 0 ? 'disabled' : ''}>
                                <i class="bi bi-pause-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Seleção de Cliente -->
                ${renderClientSelector(state.clients)}
                
                <!-- Itens do Carrinho -->
                <div id="cart-items" class="cart-items">
                    ${renderCartItems()}
                </div>
                
                <!-- Resumo e Total -->
                ${renderCartSummary()}
                
                <!-- Botões de Ação -->
                <div class="cart-total">
                    <div class="d-grid gap-2">
                        <button class="btn btn-success btn-lg" 
                                onclick="window.pdv.openCheckout()"
                                ${cart.length === 0 ? 'disabled' : ''}>
                            <i class="bi bi-check-circle"></i> Finalizar Venda (F9)
                        </button>
                        
                        <div class="row g-2">
                            <div class="col-6">
                                <button class="btn btn-outline-warning w-100 btn-sm" 
                                        onclick="window.pdv.suspendSale()"
                                        ${cart.length === 0 ? 'disabled' : ''}>
                                    <i class="bi bi-pause"></i> Suspender
                                </button>
                            </div>
                            <div class="col-6">
                                <button class="btn btn-outline-danger w-100 btn-sm" 
                                        onclick="window.pdv.clearCart()">
                                    <i class="bi bi-trash"></i> Limpar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    function renderClientSelector(clients) {
        if (!selectedClient) return '';
        
        return `
            <div id="client-select-area" class="p-3 border-bottom bg-light">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <label class="form-label mb-0 small fw-bold">
                        <i class="bi bi-person-circle"></i> Cliente
                    </label>
                    <button class="btn btn-sm btn-link text-danger" onclick="window.pdv.removeClient()">
                        <i class="bi bi-x-circle"></i> Remover
                    </button>
                </div>
                
                <select id="cart-client" 
                        class="form-select form-select-sm mb-2" 
                        onchange="window.pdv.updateSelectedClient(this.value)">
                    <option value="">Selecione um cliente...</option>
                    ${clients.map(c => `
                        <option value="${c.id}" ${selectedClient && selectedClient.id === c.id ? 'selected' : ''}>
                            ${c.nome} - ${c.fid || 'Sem código'} (${c.points || 0} pts)
                        </option>
                    `).join('')}
                </select>
                
                ${selectedClient && selectedClient.id ? renderClientInfo(selectedClient) : ''}
            </div>
        `;
    }
    
    function renderClientInfo(client) {
        if (!client || !client.id) return '';
        
        const clientData = window.state.getClients().find(c => c.id === client.id);
        if (!clientData) return '';
        
        return `
            <div class="alert alert-success small mb-0 py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <i class="bi bi-star-fill text-warning"></i>
                        <strong>${clientData.nome}</strong>
                    </div>
                    <span class="badge bg-success">${clientData.points || 0} pontos</span>
                </div>
            </div>
        `;
    }
    
    function renderCartItems() {
        if (cart.length === 0) {
            return `
                <div class="text-center py-5">
                    <i class="bi bi-cart-x text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">Carrinho vazio</p>
                    <small class="text-muted">Adicione produtos para iniciar a venda</small>
                </div>
            `;
        }
        
        return cart.map((item, index) => `
            <div class="cart-item" data-cart-index="${index}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <strong class="cart-item-name">${item.nome}</strong>
                        <div class="small text-muted">
                            R$ ${window.utils.formatCurrency(item.preco)} × ${item.qty}
                            ${item.discount > 0 ? `
                                <span class="badge bg-warning text-dark ms-1">
                                    -${item.discount}%
                                </span>
                            ` : ''}
                        </div>
                        
                        <!-- Controles de quantidade -->
                        <div class="btn-group btn-group-sm mt-2">
                            <button class="btn btn-outline-secondary" 
                                    onclick="window.pdv.decreaseQuantity(${index})"
                                    title="Diminuir quantidade">
                                <i class="bi bi-dash"></i>
                            </button>
                            <button class="btn btn-outline-secondary" disabled>
                                ${item.qty}
                            </button>
                            <button class="btn btn-outline-secondary" 
                                    onclick="window.pdv.increaseQuantity(${index})"
                                    title="Aumentar quantidade">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                        
                        <!-- Ações do item -->
                        <div class="btn-group btn-group-sm mt-2 ms-2">
                            <button class="btn btn-outline-info" 
                                    onclick="window.pdv.applyItemDiscount(${index})"
                                    title="Desconto no item">
                                <i class="bi bi-percent"></i>
                            </button>
                            <button class="btn btn-outline-danger" 
                                    onclick="window.pdv.removeFromCart(${index})"
                                    title="Remover item">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="text-end ms-3">
                        <strong class="cart-item-total">
                            R$ ${window.utils.formatCurrency(calculateItemTotal(item))}
                        </strong>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function renderCartSummary() {
        const subtotal = calculateSubtotal();
        const discountAmount = calculateTotalDiscount();
        const total = subtotal - discountAmount;
        const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
        
        // Calcula pontos que o cliente vai ganhar
        let pointsToEarn = 0;
        if (selectedClient) {
            const fidelity = window.state.getFidelity?.() || { rate: 1 };
            const rate = fidelity.rate || 1;
            pointsToEarn = Math.floor(total / rate);
        }
        
        return `
            <div class="p-3 border-top bg-light">
                <div class="d-flex justify-content-between mb-2">
                    <span class="text-muted">Subtotal (${itemCount} ${itemCount === 1 ? 'item' : 'itens'}):</span>
                    <span class="fw-bold" id="cart-subtotal">
                        R$ ${window.utils.formatCurrency(subtotal)}
                    </span>
                </div>
                
                ${discountAmount > 0 ? `
                    <div class="d-flex justify-content-between mb-2 text-success">
                        <span>
                            <i class="bi bi-tag"></i> Desconto:
                        </span>
                        <span>- R$ ${window.utils.formatCurrency(discountAmount)}</span>
                    </div>
                ` : ''}
                
                ${globalDiscount > 0 ? `
                    <div class="d-flex justify-content-between mb-2">
                        <span class="small text-muted">
                            Desconto geral: ${globalDiscount}%
                        </span>
                        <button class="btn btn-sm btn-link text-danger p-0" 
                                onclick="window.pdv.removeGlobalDiscount()">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                ` : ''}
                
                <hr class="my-2">
                
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="h5 mb-0">Total:</span>
                    <span class="h3 mb-0 text-success" id="cart-total">
                        R$ ${window.utils.formatCurrency(total)}
                    </span>
                </div>
                
                ${pointsToEarn > 0 ? `
                    <div class="alert alert-success small py-2 mb-0">
                        <i class="bi bi-star-fill"></i>
                        Cliente vai ganhar <strong>${pointsToEarn} pontos</strong> nesta compra!
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    function renderQuickActions() {
        return `
            <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1000;">
                <div class="card shadow-lg" style="width: 250px;">
                    <div class="card-body p-2">
                        <div class="small fw-bold mb-2">
                            <i class="bi bi-keyboard"></i> Atalhos Rápidos
                        </div>
                        <div class="small text-muted">
                            <div><kbd>F1-F12</kbd> Favoritos</div>
                            <div><kbd>F9</kbd> Finalizar</div>
                            <div><kbd>F8</kbd> Suspender</div>
                            <div><kbd>Esc</kbd> Limpar</div>
                            <div><kbd>Enter</kbd> Buscar</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ========================================
    // GESTÃO DO CARRINHO
    // ========================================
    
    function addToCart(productId) {
        if (!checkDependencies()) return;
        
        if (!cashierSession || !cashierSession.isOpen) {
            window.utils.showAlert(
                'Caixa Fechado',
                'warning',
                'Abra o caixa antes de realizar vendas.'
            );
            return;
        }
        
        const product = window.state.getProducts().find(p => p.id === productId);
        if (!product) {
            playSound(220, 200); // Error beep
            window.utils.showToast('Produto não encontrado', 'error');
            return;
        }
        
        // Verifica estoque
        if (!CONFIG.allowNegativeStock && product.qtd <= 0) {
            playSound(220, 200);
            window.utils.showToast('Produto sem estoque', 'warning');
            return;
        }
        
        // Verifica se já está no carrinho
        const existingIndex = cart.findIndex(item => item.id === productId);
        
        if (existingIndex !== -1) {
            // Incrementa quantidade
            const currentQty = cart[existingIndex].qty;
            
            if (!CONFIG.allowNegativeStock && currentQty >= product.qtd) {
                playSound(220, 200);
                window.utils.showToast('Quantidade máxima atingida', 'warning');
                return;
            }
            
            cart[existingIndex].qty += 1;
        } else {
            // Adiciona novo item
            cart.push({
                id: product.id,
                nome: product.nome,
                code: product.code,
                preco: product.preco,
                qty: 1,
                discount: 0,
                unit: product.unit || 'un'
            });
        }
        
        playSound(440, 100); // Success beep
        updateCart();
    }
    
    function increaseQuantity(index) {
        if (index < 0 || index >= cart.length) return;
        
        const item = cart[index];
        const product = window.state.getProducts().find(p => p.id === item.id);
        
        if (!product) return;
        
        if (!CONFIG.allowNegativeStock && item.qty >= product.qtd) {
            window.utils.showToast('Estoque insuficiente', 'warning');
            return;
        }
        
        cart[index].qty += 1;
        playSound(440, 50);
        updateCart();
    }
    
    function decreaseQuantity(index) {
        if (index < 0 || index >= cart.length) return;
        
        if (cart[index].qty > 1) {
            cart[index].qty -= 1;
            playSound(440, 50);
            updateCart();
        } else {
            removeFromCart(index);
        }
    }
    
    function removeFromCart(index) {
        if (index < 0 || index >= cart.length) return;
        
        const item = cart[index];
        
        window.utils.showConfirm(
            'Remover item?',
            `Deseja remover "${item.nome}" do carrinho?`
        ).then((result) => {
            if (result.isConfirmed) {
                cart.splice(index, 1);
                playSound(440, 100);
                updateCart();
            }
        });
    }
    
    function clearCart() {
        if (cart.length === 0) return;
        
        window.utils.showConfirm(
            'Limpar carrinho?',
            'Todos os itens serão removidos. Deseja continuar?'
        ).then((result) => {
            if (result.isConfirmed) {
                cart = [];
                selectedClient = null;
                globalDiscount = 0;
                updateCart();
                window.utils.showToast('Carrinho limpo', 'info');
            }
        });
    }
    
    function updateCart() {
        // Atualiza visualização do carrinho
        const cartItemsContainer = document.getElementById('cart-items');
        if (cartItemsContainer) {
            cartItemsContainer.innerHTML = renderCartItems();
        }
        
        // Atualiza resumo
        const summaryContainer = cartItemsContainer?.parentElement?.querySelector('.border-top');
        if (summaryContainer) {
            summaryContainer.outerHTML = renderCartSummary();
        }
        
        // Atualiza contador
        const countBadge = document.getElementById('cart-count');
        if (countBadge) {
            const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
            countBadge.textContent = itemCount;
        }
        
        // Atualiza currentSale
        currentSale = {
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            total: calculateSubtotal() - calculateTotalDiscount(),
            items: cart.length,
            client: selectedClient
        };
    }
    
    // ========================================
    // DESCONTOS
    // ========================================
    
    function applyItemDiscount(index) {
        if (index < 0 || index >= cart.length) return;
        
        const item = cart[index];
        
        Swal.fire({
            title: 'Desconto no Item',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <strong>${item.nome}</strong><br>
                        Preço: R$ ${window.utils.formatCurrency(item.preco)}<br>
                        Quantidade: ${item.qty}
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Tipo de desconto</label>
                        <select id="discount-type" class="form-select">
                            <option value="percent">Percentual (%)</option>
                            <option value="value">Valor (R$)</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Valor do desconto</label>
                        <input type="text" 
                               id="discount-amount" 
                               class="form-control" 
                               placeholder="0,00"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)">
                    </div>
                    
                    <div id="discount-preview" class="alert alert-secondary d-none">
                        <strong>Preview:</strong>
                        <div id="preview-text"></div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                const typeSelect = document.getElementById('discount-type');
                const amountInput = document.getElementById('discount-amount');
                const preview = document.getElementById('discount-preview');
                const previewText = document.getElementById('preview-text');
                
                function updatePreview() {
                    const type = typeSelect.value;
                    const amountStr = amountInput.value;
                    const amount = window.utils.parseMonetaryValue(amountStr);
                    
                    if (amount > 0) {
                        let discountValue = 0;
                        let newPrice = item.preco;
                        
                        if (type === 'percent') {
                            if (amount > CONFIG.maxDiscountPercent) {
                                preview.className = 'alert alert-danger';
                                previewText.textContent = `Desconto máximo permitido: ${CONFIG.maxDiscountPercent}%`;
                                return;
                            }
                            discountValue = (item.preco * amount) / 100;
                            newPrice = item.preco - discountValue;
                        } else {
                            discountValue = amount;
                            newPrice = Math.max(0, item.preco - amount);
                        }
                        
                        preview.classList.remove('d-none', 'alert-danger');
                        preview.classList.add('alert-success');
                        previewText.innerHTML = `
                            De: <s>R$ ${window.utils.formatCurrency(item.preco)}</s><br>
                            Para: <strong>R$ ${window.utils.formatCurrency(newPrice)}</strong><br>
                            Economia: R$ ${window.utils.formatCurrency(discountValue)}
                        `;
                    } else {
                        preview.classList.add('d-none');
                    }
                }
                
                typeSelect.addEventListener('change', updatePreview);
                amountInput.addEventListener('input', updatePreview);
            },
            preConfirm: () => {
                const type = document.getElementById('discount-type').value;
                const amountStr = document.getElementById('discount-amount').value;
                const amount = window.utils.parseMonetaryValue(amountStr);
                
                if (isNaN(amount) || amount <= 0) {
                    Swal.showValidationMessage('Informe um valor válido');
                    return false;
                }
                
                if (type === 'percent' && amount > CONFIG.maxDiscountPercent) {
                    Swal.showValidationMessage(`Desconto máximo: ${CONFIG.maxDiscountPercent}%`);
                    return false;
                }
                
                return { type, amount };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const { type, amount } = result.value;
                
                if (type === 'percent') {
                    cart[index].discount = amount;
                    cart[index].discountType = 'percent';
                } else {
                    // Converte valor para percentual
                    const percentDiscount = (amount / item.preco) * 100;
                    cart[index].discount = percentDiscount;
                    cart[index].discountType = 'value';
                }
                
                updateCart();
                window.utils.showToast('Desconto aplicado!', 'success');
            }
        });
    }
    
    function applyGlobalDiscount() {
        if (cart.length === 0) {
            window.utils.showToast('Adicione produtos ao carrinho primeiro', 'warning');
            return;
        }
        
        Swal.fire({
            title: 'Desconto na Venda',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        Subtotal: <strong>R$ ${window.utils.formatCurrency(calculateSubtotal())}</strong>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Desconto (%)</label>
                        <input type="number" 
                               id="global-discount" 
                               class="form-control" 
                               min="0" 
                               max="${CONFIG.maxDiscountPercent}"
                               step="0.1"
                               placeholder="Ex: 10"
                               value="${globalDiscount}">
                        <small class="text-muted">Máximo: ${CONFIG.maxDiscountPercent}%</small>
                    </div>
                    
                    <div id="global-preview" class="alert alert-secondary d-none"></div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aplicar',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                const input = document.getElementById('global-discount');
                const preview = document.getElementById('global-preview');
                
                input.addEventListener('input', () => {
                    const discount = parseFloat(input.value) || 0;
                    const subtotal = calculateSubtotal();
                    const discountAmount = (subtotal * discount) / 100;
                    const newTotal = subtotal - discountAmount;
                    
                    if (discount > 0) {
                        preview.classList.remove('d-none');
                        preview.innerHTML = `
                            <strong>Preview:</strong><br>
                            Desconto: R$ ${window.utils.formatCurrency(discountAmount)}<br>
                            Novo total: <strong>R$ ${window.utils.formatCurrency(newTotal)}</strong>
                        `;
                    } else {
                        preview.classList.add('d-none');
                    }
                });
            },
            preConfirm: () => {
                const discount = parseFloat(document.getElementById('global-discount').value);
                
                if (isNaN(discount) || discount < 0) {
                    Swal.showValidationMessage('Informe um valor válido');
                    return false;
                }
                
                if (discount > CONFIG.maxDiscountPercent) {
                    Swal.showValidationMessage(`Desconto máximo: ${CONFIG.maxDiscountPercent}%`);
                    return false;
                }
                
                return discount;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                globalDiscount = result.value;
                updateCart();
                
                if (globalDiscount > 0) {
                    window.utils.showToast(`Desconto de ${globalDiscount}% aplicado!`, 'success');
                } else {
                    window.utils.showToast('Desconto removido', 'info');
                }
            }
        });
    }
    
    function removeGlobalDiscount() {
        globalDiscount = 0;
        updateCart();
        window.utils.showToast('Desconto geral removido', 'info');
    }
    
    // ========================================
    // CLIENTE
    // ========================================
    
    function toggleClient() {
        if (selectedClient) {
            selectedClient = null;
        } else {
            selectedClient = {};
        }
        
        // Re-renderiza área do carrinho
        const cartContainer = document.querySelector('.cart-container');
        if (cartContainer) {
            const state = window.state.get();
            cartContainer.outerHTML = renderCartArea(state);
        }
    }
    
    function updateSelectedClient(clientId) {
        if (!clientId) {
            selectedClient = null;
        } else {
            const client = window.state.getClients().find(c => c.id === clientId);
            selectedClient = client || null;
        }
        
        updateCart();
    }
    
    function removeClient() {
        selectedClient = null;
        toggleClient();
        window.utils.showToast('Cliente removido', 'info');
    }
    
    // ========================================
    // FINALIZAÇÃO DE VENDA
    // ========================================
    
    function openCheckout() {
        if (!checkDependencies()) return;
        
        if (!cashierSession || !cashierSession.isOpen) {
            window.utils.showAlert(
                'Caixa Fechado',
                'warning',
                'Abra o caixa antes de finalizar vendas.'
            );
            return;
        }
        
        if (cart.length === 0) {
            window.utils.showToast('Carrinho vazio', 'warning');
            return;
        }
        
        const total = calculateSubtotal() - calculateTotalDiscount();
        const clientId = selectedClient?.id || null;
        const client = clientId ? window.state.getClients().find(c => c.id === clientId) : null;
        
        Swal.fire({
            title: '<i class="bi bi-cash-coin"></i> Finalizar Venda',
            html: generateCheckoutHTML(total, client),
            width: '600px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-check-circle"></i> Confirmar Venda',
            cancelButtonText: 'Cancelar',
            didOpen: () => setupCheckoutListeners(total),
            preConfirm: () => validateCheckout(total)
        }).then((result) => {
            if (result.isConfirmed) {
                finalizeSale(result.value);
            }
        });
    }
    
    function generateCheckoutHTML(total, client) {
        return `
            <div class="text-start">
                <div class="alert alert-primary mb-3">
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Total da venda:</span>
                        <strong class="h4 mb-0">R$ ${window.utils.formatCurrency(total)}</strong>
                    </div>
                    <small class="text-muted">${cart.length} ${cart.length === 1 ? 'item' : 'itens'}</small>
                </div>
                
                <div class="mb-3">
                    <label class="form-label fw-bold">Forma de Pagamento *</label>
                    <select id="payment-method" class="form-select">
                        <option value="">Selecione...</option>
                        <option value="dinheiro">💵 Dinheiro</option>
                        <option value="debito">💳 Cartão de Débito</option>
                        <option value="credito">💳 Cartão de Crédito</option>
                        <option value="pix">📱 PIX</option>
                        <option value="vale">🎫 Vale/Voucher</option>
                        <option value="multiplo">🔀 Múltiplas formas</option>
                    </select>
                </div>
                
                <div id="cash-field" style="display: none;">
                    <div class="mb-3">
                        <label class="form-label">Valor Recebido (R$)</label>
                        <input type="text" 
                               id="amount-paid" 
                               class="form-control form-control-lg" 
                               placeholder="Ex: 50,00"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)">
                        <small class="text-muted">Digite o valor recebido</small>
                    </div>
                    
                    <div id="change-field" style="display: none;">
                        <div class="alert alert-success">
                            <div class="d-flex justify-content-between">
                                <strong>Troco:</strong>
                                <span id="change-amount" class="fw-bold"></span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="multiple-payment-field" style="display: none;">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        Configure os pagamentos clicando em "Configurar"
                    </div>
                </div>
                
                ${client ? `
                    <div class="alert alert-success">
                        <i class="bi bi-person-check"></i>
                        Cliente: <strong>${client.nome}</strong><br>
                        Pontos atuais: ${client.points || 0}<br>
                        Vai ganhar: <strong>${Math.floor(total / (window.state.getFidelity?.().rate || 1))} pontos</strong>
                    </div>
                ` : ''}
                
                <div class="mb-3">
                    <label class="form-label">Observações (opcional)</label>
                    <textarea id="sale-notes" class="form-control" rows="2" placeholder="Ex: Cliente pediu nota fiscal..."></textarea>
                </div>
            </div>
        `;
    }
    
    function setupCheckoutListeners(total) {
        const paymentSelect = document.getElementById('payment-method');
        const cashField = document.getElementById('cash-field');
        const amountPaid = document.getElementById('amount-paid');
        const changeField = document.getElementById('change-field');
        const changeAmount = document.getElementById('change-amount');
        const multipleField = document.getElementById('multiple-payment-field');
        
        paymentSelect.addEventListener('change', () => {
            const payment = paymentSelect.value;
            
            cashField.style.display = 'none';
            multipleField.style.display = 'none';
            changeField.style.display = 'none';
            
            if (payment === 'dinheiro') {
                cashField.style.display = 'block';
                amountPaid.focus();
            } else if (payment === 'multiplo') {
                multipleField.style.display = 'block';
            }
        });
        
        if (amountPaid) {
            amountPaid.addEventListener('input', () => {
                const paidStr = amountPaid.value;
                const paid = window.utils.parseMonetaryValue(paidStr);
                
                if (!isNaN(paid) && paid >= 0) {
                    const change = paid - total;
                    
                    if (change >= 0) {
                        changeAmount.textContent = `R$ ${window.utils.formatCurrency(change)}`;
                        changeField.style.display = 'block';
                        
                        if (change > CONFIG.minChangeAlert) {
                            changeField.classList.add('alert-warning');
                            changeField.classList.remove('alert-success');
                        } else {
                            changeField.classList.add('alert-success');
                            changeField.classList.remove('alert-warning');
                        }
                    } else {
                        changeField.style.display = 'none';
                    }
                } else {
                    changeField.style.display = 'none';
                }
            });
        }
    }
    
    function validateCheckout(total) {
        const payment = document.getElementById('payment-method').value;
        const notes = document.getElementById('sale-notes').value.trim();
        
        if (!payment) {
            Swal.showValidationMessage('Selecione a forma de pagamento');
            return false;
        }
        
        if (payment === 'dinheiro') {
            const paidStr = document.getElementById('amount-paid').value;
            const paid = window.utils.parseMonetaryValue(paidStr);
            
            if (isNaN(paid) || paid < total) {
                Swal.showValidationMessage('Valor recebido insuficiente ou inválido');
                return false;
            }
            
            return {
                payment: 'dinheiro',
                amountPaid: paid,
                change: paid - total,
                notes
            };
        }
        
        return {
            payment,
            notes
        };
    }
    
    function finalizeSale(paymentData) {
        const total = calculateSubtotal() - calculateTotalDiscount();
        
        const sale = {
            id: window.utils.generateId(),
            date: new Date().toISOString(),
            total: total,
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            payment: paymentData.payment,
            items: cart.map(item => ({...item})),
            clientId: selectedClient?.id || null,
            cashierSession: cashierSession?.id || null,
            operator: cashierSession?.operator || 'Sistema',
            notes: paymentData.notes || null
        };
        
        // Se foi dinheiro, adiciona info de troco
        if (paymentData.payment === 'dinheiro') {
            sale.amountPaid = paymentData.amountPaid;
            sale.change = paymentData.change;
        }
        
        // Adiciona venda ao estado
        window.state.addSale(sale);
        
        // Atualiza estoque (usando métodos do state)
        cart.forEach(item => {
            const product = window.state.getProducts().find(p => p.id === item.id);
            if (product) {
                const updatedProduct = { 
                    ...product, 
                    qtd: product.qtd - item.qty,
                    sold: (product.sold || 0) + item.qty 
                };
                window.state.updateProduct(product.id, updatedProduct);
            }
        });
        
        // Atualiza pontos do cliente
        if (selectedClient?.id) {
            const client = window.state.getClients().find(c => c.id === selectedClient.id);
            if (client) {
                const fidelity = window.state.getFidelity?.() || { rate: 1 };
                const rate = fidelity.rate || 1;
                const points = Math.floor(total / rate);
                const updatedClient = { 
                    ...client, 
                    points: (client.points || 0) + points,
                    totalPurchases: (client.totalPurchases || 0) + total 
                };
                window.state.updateClient(client.id, updatedClient);
                
                // Mensagem de pontos
                setTimeout(() => {
                    window.utils.showToast(
                        `${client.nome} ganhou ${points} pontos!`,
                        'success'
                    );
                }, 1500);
            }
        }
        
        // Atualiza sessão do caixa
        if (cashierSession) {
            cashierSession.totalSales = (cashierSession.totalSales || 0) + total;
            cashierSession.salesCount = (cashierSession.salesCount || 0) + 1;
            saveCashierSession();
        }
        
        // Limpa carrinho
        cart = [];
        selectedClient = null;
        globalDiscount = 0;
        
        // Som de sucesso
        playSound(880, 200);
        
        // Mostra comprovante
        showReceipt(sale);
        
        // Recarrega PDV
        setTimeout(() => {
            render();
        }, 100);
    }
    
    // ========================================
    // COMPROVANTE E IMPRESSÃO
    // ========================================
    
    function showReceipt(sale) {
        const client = sale.clientId ? 
            window.state.getClients().find(c => c.id === sale.clientId) : null;
        
        const receiptHTML = generateReceiptHTML(sale, client);
        
        Swal.fire({
            title: '<i class="bi bi-check-circle-fill text-success"></i> Venda Finalizada',
            html: receiptHTML,
            width: '500px',
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-printer"></i> Imprimir',
            cancelButtonText: 'Fechar',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-secondary'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                printReceipt(receiptHTML);
            }
        });
    }
    
    function generateReceiptHTML(sale, client) {
        const fidelity = window.state.getFidelity?.() || { rate: 1 };
        const rate = fidelity.rate || 1;
        
        return `
            <div class="receipt" style="font-family: 'Courier New', monospace; text-align: center; max-width: 300px; margin: 0 auto;">
                <div style="border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
                    <h5 style="margin: 0;">SUPERMERCADO PRO</h5>
                    <p style="margin: 5px 0; font-size: 0.9em;">InNovaIdeia - Gestão Smart Tech</p>
                    <small>CNPJ: 00.000.000/0000-00</small><br>
                    <small>Endereço: Rua Exemplo, 123</small>
                </div>
                
                <div style="text-align: left; margin: 15px 0;">
                    <strong>CUPOM NÃO FISCAL</strong><br>
                    <small>Data: ${new Date(sale.date).toLocaleString('pt-BR')}</small><br>
                    <small>Operador: ${sale.operator || 'Sistema'}</small>
                    ${client ? `<br><small>Cliente: ${client.nome}</small>` : ''}
                </div>
                
                <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0;">
                    <table style="width: 100%; font-size: 0.9em; text-align: left;">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th style="text-align: center;">Qtd</th>
                                <th style="text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td>${item.nome}</td>
                                    <td style="text-align: center;">${item.qty}</td>
                                    <td style="text-align: right;">
                                        ${window.utils.formatCurrency(calculateItemTotal(item))}
                                    </td>
                                </tr>
                                ${item.discount > 0 ? `
                                    <tr>
                                        <td colspan="3" style="font-size: 0.8em; color: #28a745;">
                                            └ Desconto: ${item.discount}%
                                        </td>
                                    </tr>
                                ` : ''}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div style="text-align: right; margin: 10px 0;">
                    ${sale.subtotal !== sale.total ? `
                        <div>Subtotal: R$ ${window.utils.formatCurrency(sale.subtotal)}</div>
                        <div style="color: #28a745;">Desconto: R$ ${window.utils.formatCurrency(sale.discount)}</div>
                    ` : ''}
                    <div style="font-size: 1.3em; font-weight: bold; margin-top: 5px;">
                        TOTAL: R$ ${window.utils.formatCurrency(sale.total)}
                    </div>
                </div>
                
                <div style="border-top: 1px dashed #000; padding-top: 10px; text-align: left; font-size: 0.9em;">
                    <strong>Pagamento:</strong> ${sale.payment.toUpperCase()}<br>
                    ${sale.payment === 'dinheiro' && sale.amountPaid ? `
                        Valor pago: R$ ${window.utils.formatCurrency(sale.amountPaid)}<br>
                        Troco: R$ ${window.utils.formatCurrency(sale.change || 0)}
                    ` : ''}
                    ${client ? `
                        <br><strong>Pontos ganhos:</strong> ${Math.floor(sale.total / rate)}
                        <br><strong>Pontos totais:</strong> ${client.points || 0}
                    ` : ''}
                </div>
                
                <div style="border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px;">
                    <p style="margin: 5px 0;">Obrigado pela preferência!</p>
                    <small>Volte sempre!</small>
                </div>
            </div>
        `;
    }
    
    function printReceipt(html) {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Comprovante de Venda</title>
                <style>
                    body {
                        font-family: 'Courier New', monospace;
                        padding: 20px;
                        margin: 0;
                    }
                    @media print {
                        body {
                            margin: 0;
                            padding: 10px;
                        }
                    }
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                ${html}
                <script>
                    window.onload = () => {
                        window.print();
                        setTimeout(() => window.close(), 100);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
    
    // ========================================
    // VENDAS SUSPENSAS
    // ========================================
    
    function suspendSale() {
        if (cart.length === 0) {
            window.utils.showToast('Carrinho vazio', 'warning');
            return;
        }
        
        Swal.fire({
            title: 'Suspender Venda',
            input: 'text',
            inputLabel: 'Motivo da suspensão (opcional)',
            inputPlaceholder: 'Ex: Cliente esqueceu o cartão...',
            showCancelButton: true,
            confirmButtonText: 'Suspender',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                const suspended = {
                    id: window.utils.generateId(),
                    date: new Date().toISOString(),
                    cart: [...cart],
                    client: selectedClient,
                    discount: globalDiscount,
                    reason: result.value || null,
                    operator: cashierSession?.operator || 'Sistema'
                };
                
                suspendedSales.push(suspended);
                saveSuspendedSales();
                
                // Limpa carrinho
                cart = [];
                selectedClient = null;
                globalDiscount = 0;
                
                window.utils.showToast('Venda suspensa com sucesso', 'success');
                render();
            }
        });
    }
    
    function showSuspendedSales() {
        if (suspendedSales.length === 0) {
            window.utils.showAlert(
                'Sem vendas suspensas',
                'info',
                'Não há vendas suspensas no momento.'
            );
            return;
        }
        
        let html = `
            <div class="text-start">
                <div class="alert alert-info mb-3">
                    <i class="bi bi-clock-history"></i>
                    ${suspendedSales.length} venda(s) suspensa(s)
                </div>
                
                <div class="list-group">
        `;
        
        suspendedSales.forEach((sale, index) => {
            const total = sale.cart.reduce((sum, item) => 
                sum + calculateItemTotal(item), 0);
            const discount = (total * sale.discount) / 100;
            const finalTotal = total - discount;
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${new Date(sale.date).toLocaleString('pt-BR')}</strong>
                            ${sale.client ? `<br><small class="text-muted">Cliente: ${sale.client.nome}</small>` : ''}
                            ${sale.reason ? `<br><small class="text-muted">Motivo: ${sale.reason}</small>` : ''}
                        </div>
                        <span class="badge bg-warning text-dark">
                            R$ ${window.utils.formatCurrency(finalTotal)}
                        </span>
                    </div>
                    
                    <div class="small text-muted mb-2">
                        ${sale.cart.length} ${sale.cart.length === 1 ? 'item' : 'itens'}
                    </div>
                    
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-success" 
                                onclick="window.pdv.recoverSale(${index})">
                            <i class="bi bi-play-circle"></i> Recuperar
                        </button>
                        <button class="btn btn-outline-secondary" 
                                onclick="window.pdv.viewSuspendedSale(${index})">
                            <i class="bi bi-eye"></i> Ver
                        </button>
                        <button class="btn btn-outline-danger" 
                                onclick="window.pdv.deleteSuspendedSale(${index})">
                            <i class="bi bi-trash"></i> Excluir
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
            title: '<i class="bi bi-clock-history"></i> Vendas Suspensas',
            html: html,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false
        });
    }
    
    function recoverSale(index) {
        if (index < 0 || index >= suspendedSales.length) return;
        
        const sale = suspendedSales[index];
        
        // Verifica se há carrinho atual
        if (cart.length > 0) {
            window.utils.showConfirm(
                'Substituir carrinho atual?',
                'Você tem itens no carrinho. Deseja suspender a venda atual e recuperar a venda selecionada?'
            ).then((result) => {
                if (result.isConfirmed) {
                    // Suspende a venda atual primeiro
                    suspendCurrentAndRecover(sale, index);
                }
            });
        } else {
            // Recupera direto
            loadSuspendedSale(sale, index);
        }
    }
    
    function suspendCurrentAndRecover(saleToRecover, indexToRemove) {
        // Suspende a venda atual
        const currentSuspended = {
            id: window.utils.generateId(),
            date: new Date().toISOString(),
            cart: [...cart],
            client: selectedClient,
            discount: globalDiscount,
            reason: 'Auto-suspensa para recuperar outra venda',
            operator: cashierSession?.operator || 'Sistema'
        };
        
        suspendedSales.push(currentSuspended);
        
        // Remove a venda que será recuperada
        suspendedSales.splice(indexToRemove, 1);
        saveSuspendedSales();
        
        // Carrega a venda recuperada
        cart = [...saleToRecover.cart];
        selectedClient = saleToRecover.client;
        globalDiscount = saleToRecover.discount || 0;
        
        Swal.close();
        window.utils.showToast('Venda recuperada!', 'success');
        render();
    }
    
    function loadSuspendedSale(sale, index) {
        cart = [...sale.cart];
        selectedClient = sale.client;
        globalDiscount = sale.discount || 0;
        
        // Remove da lista de suspensas
        suspendedSales.splice(index, 1);
        saveSuspendedSales();
        
        Swal.close();
        window.utils.showToast('Venda recuperada!', 'success');
        render();
    }
    
    function viewSuspendedSale(index) {
        if (index < 0 || index >= suspendedSales.length) return;
        
        const sale = suspendedSales[index];
        const total = sale.cart.reduce((sum, item) => 
            sum + calculateItemTotal(item), 0);
        const discount = (total * sale.discount) / 100;
        const finalTotal = total - discount;
        
        let html = `
            <div class="text-start">
                <div class="alert alert-info">
                    <strong>Data:</strong> ${new Date(sale.date).toLocaleString('pt-BR')}<br>
                    <strong>Operador:</strong> ${sale.operator}<br>
                    ${sale.client ? `<strong>Cliente:</strong> ${sale.client.nome}<br>` : ''}
                    ${sale.reason ? `<strong>Motivo:</strong> ${sale.reason}` : ''}
                </div>
                
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Qtd</th>
                            <th>Preço</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        sale.cart.forEach(item => {
            html += `
                <tr>
                    <td>${item.nome}</td>
                    <td>${item.qty}</td>
                    <td>R$ ${window.utils.formatCurrency(item.preco)}</td>
                    <td>R$ ${window.utils.formatCurrency(calculateItemTotal(item))}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3">Total</th>
                            <th>R$ ${window.utils.formatCurrency(finalTotal)}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
        Swal.fire({
            title: 'Detalhes da Venda Suspensa',
            html: html,
            width: '600px'
        });
    }
    
    function deleteSuspendedSale(index) {
        if (index < 0 || index >= suspendedSales.length) return;
        
        window.utils.showConfirm(
            'Excluir venda suspensa?',
            'Esta ação não pode ser desfeita.'
        ).then((result) => {
            if (result.isConfirmed) {
                suspendedSales.splice(index, 1);
                saveSuspendedSales();
                
                window.utils.showToast('Venda excluída', 'info');
                
                // Atualiza modal se ainda estiver aberto
                if (suspendedSales.length > 0) {
                    showSuspendedSales();
                } else {
                    Swal.close();
                }
            }
        });
    }
    
    function saveSuspendedSales() {
        try {
            localStorage.setItem('pdv-suspended-sales', JSON.stringify(suspendedSales));
        } catch (error) {
            console.error('Erro ao salvar vendas suspensas:', error);
        }
    }
    
    // ========================================
    // GESTÃO DE CAIXA
    // ========================================
    
    function openCashier() {
        Swal.fire({
            title: '<i class="bi bi-unlock"></i> Abrir Caixa',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Operador/Responsável *</label>
                        <input type="text" 
                               id="cashier-operator" 
                               class="form-control" 
                               placeholder="Nome do operador"
                               required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Valor inicial no caixa (R$)</label>
                        <input type="text" 
                               id="cashier-initial-value" 
                               class="form-control" 
                               placeholder="0,00"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)">
                        <small class="text-muted">Informe o valor em dinheiro disponível</small>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Observações</label>
                        <textarea id="cashier-notes" 
                                  class="form-control" 
                                  rows="2"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Abrir Caixa',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const operator = document.getElementById('cashier-operator').value.trim();
                const initialStr = document.getElementById('cashier-initial-value').value;
                const initialValue = window.utils.parseMonetaryValue(initialStr);
                const notes = document.getElementById('cashier-notes').value.trim();
                
                if (!operator) {
                    Swal.showValidationMessage('Informe o nome do operador');
                    return false;
                }
                
                if (isNaN(initialValue) || initialValue < 0) {
                    Swal.showValidationMessage('Informe um valor inicial válido');
                    return false;
                }
                
                return { operator, initialValue, notes };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                cashierSession = {
                    id: window.utils.generateId(),
                    operator: result.value.operator,
                    openedAt: new Date().toISOString(),
                    initialValue: result.value.initialValue,
                    notes: result.value.notes || null,
                    isOpen: true,
                    totalSales: 0,
                    salesCount: 0,
                    movements: []
                };
                
                saveCashierSession();
                window.utils.showToast('Caixa aberto com sucesso!', 'success');
                render();
            }
        });
    }
    
    function closeCashier() {
        if (!cashierSession || !cashierSession.isOpen) {
            window.utils.showAlert('Caixa já está fechado', 'info');
            return;
        }
        
        // Calcula valores
        const totalSales = cashierSession.totalSales || 0;
        const initialValue = cashierSession.initialValue || 0;
        const movements = cashierSession.movements || [];
        
        const withdrawals = movements
            .filter(m => m.type === 'withdrawal')
            .reduce((sum, m) => sum + m.amount, 0);
        
        const reinforcements = movements
            .filter(m => m.type === 'reinforcement')
            .reduce((sum, m) => sum + m.amount, 0);
        
        const expectedValue = initialValue + totalSales + reinforcements - withdrawals;
        
        Swal.fire({
            title: '<i class="bi bi-lock"></i> Fechar Caixa',
            html: `
                <div class="text-start">
                    <div class="alert alert-primary mb-3">
                        <strong>Resumo do Caixa</strong><br>
                        <small>Operador: ${cashierSession.operator}</small><br>
                        <small>Abertura: ${new Date(cashierSession.openedAt).toLocaleString('pt-BR')}</small>
                    </div>
                    
                    <table class="table table-sm">
                        <tr>
                            <td>Valor inicial:</td>
                            <td class="text-end">R$ ${window.utils.formatCurrency(initialValue)}</td>
                        </tr>
                        <tr>
                            <td>Total de vendas:</td>
                            <td class="text-end text-success fw-bold">
                                R$ ${window.utils.formatCurrency(totalSales)}
                            </td>
                        </tr>
                        <tr>
                            <td>Nº de vendas:</td>
                            <td class="text-end">${cashierSession.salesCount || 0}</td>
                        </tr>
                        <tr>
                            <td>Sangrias:</td>
                            <td class="text-end text-danger">
                                - R$ ${window.utils.formatCurrency(withdrawals)}
                            </td>
                        </tr>
                        <tr>
                            <td>Reforços:</td>
                            <td class="text-end text-success">
                                + R$ ${window.utils.formatCurrency(reinforcements)}
                            </td>
                        </tr>
                        <tr class="fw-bold">
                            <td>Valor esperado:</td>
                            <td class="text-end">
                                R$ ${window.utils.formatCurrency(expectedValue)}
                            </td>
                        </tr>
                    </table>
                    
                    <div class="mb-3">
                        <label class="form-label fw-bold">Valor real contado (R$) *</label>
                        <input type="text" 
                               id="actual-value" 
                               class="form-control form-control-lg" 
                               placeholder="${window.utils.formatCurrency(expectedValue)}"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)"
                               value="${window.utils.formatCurrency(expectedValue)}">
                    </div>
                    
                    <div id="difference-alert" class="alert d-none"></div>
                    
                    <div class="mb-3">
                        <label class="form-label">Observações de fechamento</label>
                        <textarea id="closing-notes" 
                                  class="form-control" 
                                  rows="2"></textarea>
                    </div>
                </div>
            `,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: 'Fechar Caixa',
            cancelButtonText: 'Cancelar',
            didOpen: () => {
                const actualInput = document.getElementById('actual-value');
                const diffAlert = document.getElementById('difference-alert');
                
                actualInput.addEventListener('input', () => {
                    const actualStr = actualInput.value;
                    const actual = window.utils.parseMonetaryValue(actualStr);
                    const diff = actual - expectedValue;
                    
                    if (!isNaN(actual) && Math.abs(diff) > 0.01) {
                        diffAlert.classList.remove('d-none');
                        
                        if (diff > 0) {
                            diffAlert.className = 'alert alert-success';
                            diffAlert.innerHTML = `
                                <strong>Sobra:</strong> R$ ${window.utils.formatCurrency(diff)}
                            `;
                        } else {
                            diffAlert.className = 'alert alert-danger';
                            diffAlert.innerHTML = `
                                <strong>Falta:</strong> R$ ${window.utils.formatCurrency(Math.abs(diff))}
                            `;
                        }
                    } else {
                        diffAlert.classList.add('d-none');
                    }
                });
            },
            preConfirm: () => {
                const actualStr = document.getElementById('actual-value').value;
                const actualValue = window.utils.parseMonetaryValue(actualStr);
                const notes = document.getElementById('closing-notes').value.trim();
                
                if (isNaN(actualValue) || actualValue < 0) {
                    Swal.showValidationMessage('Informe o valor real contado');
                    return false;
                }
                
                return { actualValue, notes };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const difference = result.value.actualValue - expectedValue;
                
                cashierSession.closedAt = new Date().toISOString();
                cashierSession.isOpen = false;
                cashierSession.expectedValue = expectedValue;
                cashierSession.actualValue = result.value.actualValue;
                cashierSession.difference = difference;
                cashierSession.closingNotes = result.value.notes || null;
                
                // Salva histórico do caixa
                saveCashierHistory();
                
                // Limpa sessão atual
                cashierSession = null;
                localStorage.removeItem('pdv-cashier-session');
                
                window.utils.showToast('Caixa fechado com sucesso!', 'success');
                render();
            }
        });
    }
    
    function showCashMovements() {
        if (!cashierSession || !cashierSession.isOpen) {
            window.utils.showAlert(
                'Caixa Fechado',
                'warning',
                'Abra o caixa para registrar movimentações.'
            );
            return;
        }
        
        Swal.fire({
            title: 'Movimentações de Caixa',
            html: `
                <div class="text-start">
                    <div class="btn-group w-100 mb-3">
                        <button class="btn btn-danger" onclick="window.pdv.registerWithdrawal()">
                            <i class="bi bi-arrow-down-circle"></i> Sangria
                        </button>
                        <button class="btn btn-success" onclick="window.pdv.registerReinforcement()">
                            <i class="bi bi-arrow-up-circle"></i> Reforço
                        </button>
                    </div>
                    
                    ${renderCashMovementsHistory()}
                </div>
            `,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false
        });
    }
    
    function renderCashMovementsHistory() {
        const movements = cashierSession?.movements || [];
        
        if (movements.length === 0) {
            return '<p class="text-muted text-center py-4">Nenhuma movimentação registrada</p>';
        }
        
        let html = '<div class="list-group">';
        
        movements.forEach(m => {
            const isWithdrawal = m.type === 'withdrawal';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between">
                        <div>
                            <i class="bi bi-arrow-${isWithdrawal ? 'down' : 'up'}-circle text-${isWithdrawal ? 'danger' : 'success'}"></i>
                            <strong>${isWithdrawal ? 'Sangria' : 'Reforço'}</strong>
                            <div class="small text-muted">
                                ${new Date(m.date).toLocaleString('pt-BR')}<br>
                                ${m.reason || 'Sem motivo'}
                            </div>
                        </div>
                        <span class="h5 text-${isWithdrawal ? 'danger' : 'success'}">
                            ${isWithdrawal ? '-' : '+'} R$ ${window.utils.formatCurrency(m.amount)}
                        </span>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        return html;
    }
    
    function registerWithdrawal() {
        Swal.fire({
            title: '<i class="bi bi-arrow-down-circle text-danger"></i> Sangria',
            html: `
                <div class="text-start">
                    <div class="alert alert-warning">
                        <i class="bi bi-exclamation-triangle"></i>
                        Retirada de dinheiro do caixa
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Valor (R$) *</label>
                        <input type="text" 
                               id="withdrawal-amount" 
                               class="form-control form-control-lg" 
                               placeholder="0,00"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)"
                               required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Motivo *</label>
                        <select id="withdrawal-reason" class="form-select">
                            <option value="">Selecione...</option>
                            <option value="Depósito bancário">Depósito bancário</option>
                            <option value="Pagamento de fornecedor">Pagamento de fornecedor</option>
                            <option value="Despesa operacional">Despesa operacional</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Observações</label>
                        <textarea id="withdrawal-notes" 
                                  class="form-control" 
                                  rows="2"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Registrar Sangria',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const amountStr = document.getElementById('withdrawal-amount').value;
                const amount = window.utils.parseMonetaryValue(amountStr);
                const reason = document.getElementById('withdrawal-reason').value;
                const notes = document.getElementById('withdrawal-notes').value.trim();
                
                if (isNaN(amount) || amount <= 0) {
                    Swal.showValidationMessage('Informe um valor válido');
                    return false;
                }
                
                if (!reason) {
                    Swal.showValidationMessage('Selecione o motivo');
                    return false;
                }
                
                return { amount, reason, notes };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const movement = {
                    id: window.utils.generateId(),
                    type: 'withdrawal',
                    amount: result.value.amount,
                    reason: result.value.reason,
                    notes: result.value.notes || null,
                    date: new Date().toISOString(),
                    operator: cashierSession.operator
                };
                
                if (!cashierSession.movements) {
                    cashierSession.movements = [];
                }
                
                cashierSession.movements.push(movement);
                saveCashierSession();
                
                window.utils.showToast('Sangria registrada', 'success');
                showCashMovements();
            }
        });
    }
    
    function registerReinforcement() {
        Swal.fire({
            title: '<i class="bi bi-arrow-up-circle text-success"></i> Reforço de Caixa',
            html: `
                <div class="text-start">
                    <div class="alert alert-success">
                        <i class="bi bi-plus-circle"></i>
                        Entrada de dinheiro no caixa
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Valor (R$) *</label>
                        <input type="text" 
                               id="reinforcement-amount" 
                               class="form-control form-control-lg" 
                               placeholder="0,00"
                               oninput="this.value = window.utils.maskCurrencyInput(this.value)"
                               required>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Motivo *</label>
                        <select id="reinforcement-reason" class="form-select">
                            <option value="">Selecione...</option>
                            <option value="Troco adicional">Troco adicional</option>
                            <option value="Correção de sangria">Correção de sangria</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Observações</label>
                        <textarea id="reinforcement-notes" 
                                  class="form-control" 
                                  rows="2"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Registrar Reforço',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const amountStr = document.getElementById('reinforcement-amount').value;
                const amount = window.utils.parseMonetaryValue(amountStr);
                const reason = document.getElementById('reinforcement-reason').value;
                const notes = document.getElementById('reinforcement-notes').value.trim();
                
                if (isNaN(amount) || amount <= 0) {
                    Swal.showValidationMessage('Informe um valor válido');
                    return false;
                }
                
                if (!reason) {
                    Swal.showValidationMessage('Selecione o motivo');
                    return false;
                }
                
                return { amount, reason, notes };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const movement = {
                    id: window.utils.generateId(),
                    type: 'reinforcement',
                    amount: result.value.amount,
                    reason: result.value.reason,
                    notes: result.value.notes || null,
                    date: new Date().toISOString(),
                    operator: cashierSession.operator
                };
                
                if (!cashierSession.movements) {
                    cashierSession.movements = [];
                }
                
                cashierSession.movements.push(movement);
                saveCashierSession();
                
                window.utils.showToast('Reforço registrado', 'success');
                showCashMovements();
            }
        });
    }
    
    function showCashierReport() {
        if (!cashierSession) {
            // Mostra histórico de caixas fechados
            showCashierHistory();
            return;
        }
        
        const totalSales = cashierSession.totalSales || 0;
        const salesCount = cashierSession.salesCount || 0;
        const avgTicket = salesCount > 0 ? totalSales / salesCount : 0;
        
        const movements = cashierSession.movements || [];
        const withdrawals = movements
            .filter(m => m.type === 'withdrawal')
            .reduce((sum, m) => sum + m.amount, 0);
        const reinforcements = movements
            .filter(m => m.type === 'reinforcement')
            .reduce((sum, m) => sum + m.amount, 0);
        
        const initialValue = cashierSession.initialValue || 0;
        const currentValue = initialValue + totalSales + reinforcements - withdrawals;
        
        Swal.fire({
            title: '<i class="bi bi-file-text"></i> Relatório do Caixa',
            html: `
                <div class="text-start">
                    <div class="alert alert-${cashierSession.isOpen ? 'success' : 'secondary'}">
                        <strong>Status:</strong> ${cashierSession.isOpen ? 'Aberto' : 'Fechado'}<br>
                        <strong>Operador:</strong> ${cashierSession.operator}<br>
                        <strong>Abertura:</strong> ${new Date(cashierSession.openedAt).toLocaleString('pt-BR')}
                    </div>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-6">
                            <div class="card text-center">
                                <div class="card-body">
                                    <div class="text-muted small">Vendas</div>
                                    <div class="h3 text-success mb-0">
                                        R$ ${window.utils.formatCurrency(totalSales)}
                                    </div>
                                    <div class="small">${salesCount} vendas</div>
                                </div>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="card text-center">
                                <div class="card-body">
                                    <div class="text-muted small">Ticket Médio</div>
                                    <div class="h3 mb-0">
                                        R$ ${window.utils.formatCurrency(avgTicket)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <table class="table table-sm">
                        <tr>
                            <td>Valor inicial:</td>
                            <td class="text-end">R$ ${window.utils.formatCurrency(initialValue)}</td>
                        </tr>
                        <tr>
                            <td>Total de vendas:</td>
                            <td class="text-end text-success">
                                + R$ ${window.utils.formatCurrency(totalSales)}
                            </td>
                        </tr>
                        <tr>
                            <td>Sangrias:</td>
                            <td class="text-end text-danger">
                                - R$ ${window.utils.formatCurrency(withdrawals)}
                            </td>
                        </tr>
                        <tr>
                            <td>Reforços:</td>
                            <td class="text-end text-success">
                                + R$ ${window.utils.formatCurrency(reinforcements)}
                            </td>
                        </tr>
                        <tr class="fw-bold border-top">
                            <td>Valor atual no caixa:</td>
                            <td class="text-end">
                                R$ ${window.utils.formatCurrency(currentValue)}
                            </td>
                        </tr>
                    </table>
                </div>
            `,
            width: '600px',
            showCloseButton: true,
            showCancelButton: false,
            confirmButtonText: 'Exportar Relatório'
        }).then((result) => {
            if (result.isConfirmed) {
                exportCashierReport();
            }
        });
    }
    
    function showCashierHistory() {
        const history = JSON.parse(localStorage.getItem('pdv-cashier-history') || '[]');
        
        if (history.length === 0) {
            window.utils.showAlert(
                'Sem Histórico',
                'info',
                'Nenhum caixa foi fechado ainda.'
            );
            return;
        }
        
        let html = '<div class="text-start"><div class="list-group">';
        
        history.slice(-10).reverse().forEach((session, index) => {
            const diff = session.difference || 0;
            const diffClass = diff === 0 ? 'secondary' : diff > 0 ? 'success' : 'danger';
            
            html += `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${session.operator}</strong>
                            <div class="small text-muted">
                                ${new Date(session.closedAt).toLocaleString('pt-BR')}<br>
                                ${session.salesCount} vendas • 
                                R$ ${window.utils.formatCurrency(session.totalSales)}
                            </div>
                        </div>
                        <div class="text-end">
                            <span class="badge bg-${diffClass}">
                                ${diff >= 0 ? '+' : ''}${window.utils.formatCurrency(diff)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
        
        Swal.fire({
            title: '<i class="bi bi-clock-history"></i> Histórico de Caixas',
            html: html,
            width: '600px',
            showCloseButton: true,
            showConfirmButton: false
        });
    }
    
    function saveCashierSession() {
        try {
            localStorage.setItem('pdv-cashier-session', JSON.stringify(cashierSession));
        } catch (error) {
            console.error('Erro ao salvar sessão do caixa:', error);
        }
    }
    
    function saveCashierHistory() {
        try {
            const history = JSON.parse(localStorage.getItem('pdv-cashier-history') || '[]');
            history.push({...cashierSession});
            
            // Mantém apenas os últimos 30 registros
            if (history.length > 30) {
                history.splice(0, history.length - 30);
            }
            
            localStorage.setItem('pdv-cashier-history', JSON.stringify(history));
        } catch (error) {
            console.error('Erro ao salvar histórico do caixa:', error);
        }
    }
    
    function exportCashierReport() {
        if (!cashierSession) return;
        
        const data = {
            'Operador': cashierSession.operator,
            'Data Abertura': new Date(cashierSession.openedAt).toLocaleString('pt-BR'),
            'Valor Inicial': cashierSession.initialValue,
            'Total Vendas': cashierSession.totalSales,
            'Número de Vendas': cashierSession.salesCount,
            'Sangrias': cashierSession.movements?.filter(m => m.type === 'withdrawal')
                .reduce((sum, m) => sum + m.amount, 0) || 0,
            'Reforços': cashierSession.movements?.filter(m => m.type === 'reinforcement')
                .reduce((sum, m) => sum + m.amount, 0) || 0
        };
        
        if (!cashierSession.isOpen) {
            data['Data Fechamento'] = new Date(cashierSession.closedAt).toLocaleString('pt-BR');
            data['Valor Esperado'] = cashierSession.expectedValue;
            data['Valor Real'] = cashierSession.actualValue;
            data['Diferença'] = cashierSession.difference;
        }
        
        window.utils.exportToCSV(
            [data],
            `caixa-${new Date().toISOString().split('T')[0]}.csv`
        );
        
        window.utils.showToast('Relatório exportado!', 'success');
    }
    
    // ========================================
    // PRODUTOS FAVORITOS
    // ========================================
    
    function showFavorites() {
        const products = window.state.getProducts();
        const favIds = Object.values(favoriteProducts);
        
        Swal.fire({
            title: '<i class="bi bi-star"></i> Produtos Favoritos (F1-F12)',
            html: `
                <div class="text-start">
                    <div class="alert alert-info mb-3">
                        <i class="bi bi-info-circle"></i>
                        Configure produtos para acesso rápido via teclas F1-F12
                    </div>
                    
                    ${renderFavoritesConfig(products)}
                </div>
            `,
            width: '700px',
            showCloseButton: true,
            showCancelButton: false,
            confirmButtonText: 'Salvar'
        }).then((result) => {
            if (result.isConfirmed) {
                saveFavoriteProducts();
            }
        });
    }
    
    function renderFavoritesConfig(products) {
        let html = '<div class="row g-3">';
        
        for (let i = 1; i <= 12; i++) {
            const key = `F${i}`;
            const productId = favoriteProducts[key];
            const product = productId ? products.find(p => p.id === productId) : null;
            
            html += `
                <div class="col-md-6">
                    <label class="form-label small fw-bold">${key}</label>
                    <select class="form-select form-select-sm favorite-select" data-key="${key}">
                        <option value="">Nenhum produto</option>
                        ${products.map(p => `
                            <option value="${p.id}" ${p.id === productId ? 'selected' : ''}>
                                ${p.nome} - R$ ${window.utils.formatCurrency(p.preco)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }
    
    function saveFavoriteProducts() {
        const selects = document.querySelectorAll('.favorite-select');
        
        selects.forEach(select => {
            const key = select.dataset.key;
            const productId = select.value;
            
            if (productId) {
                favoriteProducts[key] = productId;
            } else {
                delete favoriteProducts[key];
            }
        });
        
        try {
            localStorage.setItem('pdv-favorite-products', JSON.stringify(favoriteProducts));
            window.utils.showToast('Favoritos salvos!', 'success');
        } catch (error) {
            console.error('Erro ao salvar favoritos:', error);
        }
    }
    
    // ========================================
    // FILTROS E BUSCA
    // ========================================
    
    function filterProducts(products) {
        if (!products || products.length === 0) return [];
        
        if (currentFilter === 'all') {
            return products;
        }
        
        if (currentFilter === 'favorites') {
            const favIds = Object.values(favoriteProducts);
            return products.filter(p => favIds.includes(p.id));
        }
        
        return products.filter(p => p.categoria === currentFilter);
    }
    
    function filterCategory(category) {
        currentFilter = category;
        
        // Atualiza UI
        const buttons = document.querySelectorAll('[onclick*="filterCategory"]');
        buttons.forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
        });
        
        event.target.classList.remove('btn-outline-primary');
        event.target.classList.add('btn-primary');
        
        // Atualiza grid
        const grid = document.getElementById('product-grid');
        if (grid) {
            grid.innerHTML = renderProductGrid(filterProducts(productsCache));
        }
    }
    
    // ========================================
    // CÁLCULOS
    // ========================================
    
    function calculateItemTotal(item) {
        const subtotal = item.preco * item.qty;
        const discountAmount = (subtotal * (item.discount || 0)) / 100;
        return subtotal - discountAmount;
    }
    
    function calculateSubtotal() {
        return cart.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    }
    
    function calculateTotalDiscount() {
        const subtotal = calculateSubtotal();
        const itemsDiscount = cart.reduce((sum, item) => {
            const itemSubtotal = item.preco * item.qty;
            const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
            return sum + itemDiscount;
        }, 0);
        
        const globalDiscountAmount = (subtotal * globalDiscount) / 100;
        
        return itemsDiscount + globalDiscountAmount;
    }
    
    function calculateSessionSales() {
        if (!cashierSession) return 0;
        return cashierSession.totalSales || 0;
    }
    
    // ========================================
    // INICIALIZAÇÃO DE COMPONENTES
    // ========================================
    
    function initializeComponents() {
        initSearchListener();
        initScannerListener();
        initKeyboardShortcuts();
        updateCart();
    }
    
    function initSearchListener() {
        const searchInput = document.getElementById('pdv-search');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', window.utils.debounce((e) => {
            const term = e.target.value.toLowerCase();
            
            if (term.length === 0) {
                // Mostra todos os produtos
                const grid = document.getElementById('product-grid');
                if (grid) {
                    grid.innerHTML = renderProductGrid(filterProducts(productsCache));
                }
                return;
            }
            
            // Filtra produtos
            const filtered = productsCache.filter(p => {
                const matchName = p.nome.toLowerCase().includes(term);
                const matchCode = (p.code || '').toLowerCase().includes(term);
                return matchName || matchCode;
            });
            
            const grid = document.getElementById('product-grid');
            if (grid) {
                grid.innerHTML = renderProductGrid(filtered);
            }
        }, 300));
        
        // Enter para buscar código exato
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = e.target.value.trim();
                const product = productsCache.find(p => p.code === code);
                
                if (product) {
                    addToCart(product.id);
                    e.target.value = '';
                } else {
                    playSound(220, 200);
                }
            }
        });
    }
    
    function initScannerListener() {
        document.addEventListener('keypress', (e) => {
            // Ignora se está digitando em um input
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable) {
                return;
            }
            
            // Acumula caracteres
            scannerBuffer += e.key;
            
            // Limpa timeout anterior
            if (scannerTimeout) {
                clearTimeout(scannerTimeout);
            }
            
            // Novo timeout
            scannerTimeout = setTimeout(() => {
                processScannedCode(scannerBuffer);
                scannerBuffer = '';
            }, CONFIG.scannerTimeout);
        });
    }
    
    function processScannedCode(code) {
        if (!code || code.length < 3) return;
        
        const product = productsCache.find(p => p.code === code);
        
        if (product) {
            addToCart(product.id);
            
            // Destaca o produto no grid
            const productCard = document.querySelector(`[data-product-id="${product.id}"]`);
            if (productCard) {
                productCard.classList.add('highlight');
                setTimeout(() => {
                    productCard.classList.remove('highlight');
                }, 1000);
            }
        } else {
            playSound(220, 200);
            console.log('Produto não encontrado:', code);
        }
    }
    
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ignora se está digitando
            if (e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // F1-F12 - Produtos favoritos
            if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                const productId = favoriteProducts[e.key];
                if (productId) {
                    addToCart(productId);
                }
            }
            
            // F9 - Finalizar venda
            if (e.key === 'F9') {
                e.preventDefault();
                openCheckout();
            }
            
            // F8 - Suspender venda
            if (e.key === 'F8') {
                e.preventDefault();
                suspendSale();
            }
            
            // Esc - Limpar carrinho
            if (e.key === 'Escape') {
                e.preventDefault();
                clearCart();
            }
        });
    }
    
    // ========================================
    // UTILIDADES
    // ========================================
    
    function playSound(frequency, duration) {
        if (!CONFIG.soundEnabled) return;
        
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const gainNode = context.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, context.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration / 1000);
            
            oscillator.start(context.currentTime);
            oscillator.stop(context.currentTime + duration / 1000);
        } catch (error) {
            // Ignora erros de áudio
        }
    }
    
    // ========================================
    // INICIALIZAÇÃO AUTOMÁTICA
    // ========================================
    
    init();
    
    // ========================================
    // API PÚBLICA
    // ========================================
    
    return {
        render,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
        updateCart,
        toggleClient,
        updateSelectedClient,
        removeClient,
        applyGlobalDiscount,
        removeGlobalDiscount,
        applyItemDiscount,
        filterCategory,
        openCheckout,
        suspendSale,
        showSuspendedSales,
        recoverSale,
        viewSuspendedSale,
        deleteSuspendedSale,
        openCashier,
        closeCashier,
        showCashMovements,
        registerWithdrawal,
        registerReinforcement,
        showCashierReport,
        showFavorites,
        CONFIG,
        // Utilitários expostos (opcional)
        parseMonetaryValue: window.utils.parseMonetaryValue,
        formatCurrency: window.utils.formatCurrency
    };
})();