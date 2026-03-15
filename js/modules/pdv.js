/**
 * ============================================================================
 * MÓDULO PDV (PONTO DE VENDA) - VERSÃO 2.3.0 (2026-03-14)
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
 * Correções v2.3.0:
 * - toast 'error' → 'danger' (tipo válido)
 * - saveCashierSession / saveSuspendedSales / saveFavoriteProducts sincronizados com window.state
 * - Fechar caixa limpa também window.state.setPdvSession(null)
 * - Pontos registrados no histórico de fidelidade (window.fidelidade_recordPoints)
 * - filterCategory corrigido para usar classes pdv-cat-tab
 * - updateCart com seletor de sumário estável (.pdv-cart-summary)
 * - Botões Finalizar/Suspender atualizados dinamicamente sem re-render completo
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.3.0
 * @date 2026-03-14
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
        loadCart(); // MELHORIA: restaura carrinho ativo se a aba foi fechada acidentalmente
        checkCashierStatus();
    }

    // MELHORIA: Persiste o carrinho ativo no localStorage para sobreviver a fechamentos acidentais
    function saveCart() {
        try {
            localStorage.setItem('pdv-cart', JSON.stringify({
                cart: cart,
                selectedClient: selectedClient,
                globalDiscount: globalDiscount
            }));
        } catch (error) {
            console.error('Erro ao salvar carrinho:', error);
        }
    }

    function loadCart() {
        try {
            const saved = localStorage.getItem('pdv-cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Só restaura se o caixa estiver aberto — carrinho sem caixa não faz sentido
                if (cashierSession && cashierSession.isOpen) {
                    cart           = parsed.cart           || [];
                    selectedClient = parsed.selectedClient || null;
                    globalDiscount = parsed.globalDiscount || 0;
                    if (cart.length > 0) {
                        console.log('[PDV] Carrinho restaurado:', cart.length, 'item(s)');
                    }
                } else {
                    // Caixa fechado — descarta o carrinho salvo
                    localStorage.removeItem('pdv-cart');
                }
            }
        } catch (error) {
            console.error('Erro ao restaurar carrinho:', error);
            cart = [];
        }
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
        
        // Injeta estilos do PDV uma única vez
        injectPDVStyles();

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
            <div class="pdv-header mb-3">
                <div class="pdv-header-top">
                    <div class="pdv-title-group">
                        <div class="pdv-icon-wrap">
                            <i class="bi bi-cash-register"></i>
                        </div>
                        <div>
                            <span class="pdv-title">Ponto de Venda</span>
                            <div class="pdv-breadcrumb">PDV &mdash; Gst Tech</div>
                        </div>
                    </div>

                    <div class="pdv-status-group">
                        ${sessionInfo.isOpen ? `
                            <span class="pdv-pill pdv-pill-open">
                                <span class="pdv-dot"></span>Caixa Aberto
                            </span>
                            <span class="pdv-pill pdv-pill-operator">
                                <i class="bi bi-person-badge"></i>${sessionInfo.operator || 'Sistema'}
                            </span>
                            <span class="pdv-pill pdv-pill-sales">
                                <i class="bi bi-graph-up-arrow"></i>R$ ${window.utils.formatCurrency(totalSalesSession)}
                            </span>
                        ` : `
                            <span class="pdv-pill pdv-pill-closed">
                                <span class="pdv-dot pdv-dot-danger"></span>Caixa Fechado
                            </span>
                        `}
                        ${suspendedCount > 0 ? `
                            <button class="pdv-pill pdv-pill-suspended" onclick="window.pdv.showSuspendedSales()">
                                <i class="bi bi-pause-circle-fill"></i>${suspendedCount} suspensa${suspendedCount > 1 ? 's' : ''}
                            </button>
                        ` : ''}
                    </div>

                    <div class="pdv-actions-group">
                        <button class="pdv-action-btn" onclick="window.pdv.showFavorites()" title="Favoritos (F1-F12)">
                            <i class="bi bi-star"></i>
                        </button>
                        <button class="pdv-action-btn" onclick="window.pdv.showCashMovements()" title="Sangria / Reforco">
                            <i class="bi bi-arrow-left-right"></i>
                        </button>
                        <button class="pdv-action-btn" onclick="window.pdv.showCashierReport()" title="Relatorio do Caixa">
                            <i class="bi bi-file-bar-graph"></i>
                        </button>
                        <div class="pdv-divider-v"></div>
                        ${sessionInfo.isOpen ? `
                            <button class="pdv-action-btn pdv-action-danger" onclick="window.pdv.closeCashier()">
                                <i class="bi bi-lock"></i><span>Fechar Caixa</span>
                            </button>
                        ` : `
                            <button class="pdv-action-btn pdv-action-success" onclick="window.pdv.openCashier()">
                                <i class="bi bi-unlock"></i><span>Abrir Caixa</span>
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    function renderAlerts() {
        // Apenas alerta de caixa fechado — info do scanner fica inline na busca
        if (!cashierSession || !cashierSession.isOpen) {
            return `
                <div class="pdv-alert-caixa mb-3">
                    <i class="bi bi-lock-fill"></i>
                    <span><strong>Caixa fechado.</strong> Abra o caixa para iniciar vendas.</span>
                    <button class="pdv-alert-cta" onclick="window.pdv.openCashier()">
                        Abrir Caixa <i class="bi bi-chevron-right"></i>
                    </button>
                </div>
            `;
        }
        return '';
    }

    function renderProductsArea(state) {
        const total = productsCache.length;
        const filtered = filterProducts(productsCache);
        return `
            <div class="pdv-products-panel">
                <div class="pdv-search-wrap">
                    <div class="pdv-search-inner">
                        <i class="bi bi-upc-scan pdv-search-icon-left"></i>
                        <input type="text"
                               id="pdv-search"
                               class="pdv-search-input"
                               placeholder="Codigo EAN, nome ou use o scanner..."
                               autocomplete="off"
                               autofocus>
                        <span class="pdv-search-hint">Enter</span>
                    </div>
                </div>

                <div class="pdv-category-tabs">
                    <button class="pdv-cat-tab ${currentFilter === 'all' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('all', this)">
                        <i class="bi bi-grid-3x3-gap-fill"></i> Todos
                        <span class="pdv-cat-count">${total}</span>
                    </button>
                    <button class="pdv-cat-tab ${currentFilter === 'Alimentos' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('Alimentos', this)">
                        Alimentos
                    </button>
                    <button class="pdv-cat-tab ${currentFilter === 'Bebidas' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('Bebidas', this)">
                        Bebidas
                    </button>
                    <button class="pdv-cat-tab ${currentFilter === 'Higiene' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('Higiene', this)">
                        Higiene
                    </button>
                    <button class="pdv-cat-tab ${currentFilter === 'Limpeza' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('Limpeza', this)">
                        Limpeza
                    </button>
                    <button class="pdv-cat-tab ${currentFilter === 'favorites' ? 'active' : ''}"
                            onclick="window.pdv.filterCategory('favorites', this)">
                        <i class="bi bi-star-fill" style="color:#f59e0b;"></i> Favoritos
                    </button>
                </div>

                <div id="product-grid" class="pdv-product-grid">
                    ${renderProductGrid(filtered)}
                </div>

                <div class="pdv-products-footer">
                    <i class="bi bi-keyboard"></i>
                    F1-F12 para favoritos &nbsp;|&nbsp; Enter para buscar por codigo
                </div>
            </div>
        `;
    }

    function renderProductGrid(products) {
        if (!products || products.length === 0) {
            return `
                <div class="pdv-empty-state">
                    <div class="pdv-empty-icon"><i class="bi bi-inbox"></i></div>
                    <p class="pdv-empty-title">Nenhum produto disponivel</p>
                    <p class="pdv-empty-sub">Ajuste o filtro ou cadastre produtos no estoque</p>
                    <button class="btn btn-sm btn-outline-success mt-2" onclick="window.modals?.openProductModal()">
                        <i class="bi bi-plus-lg"></i> Cadastrar Produto
                    </button>
                </div>
            `;
        }

        return products.map(p => {
            const inStock = p.qtd > 0 || CONFIG.allowNegativeStock;
            const isFavorite = Object.values(favoriteProducts).includes(p.id);
            const inCart = cart.find(item => item.id === p.id);
            const lowStock = p.qtd > 0 && p.qtd <= (p.minStock || 5);

            return `
                <div class="pdv-prod-card ${!inStock ? 'out-of-stock' : ''} ${inCart ? 'in-cart' : ''}"
                     onclick="${inStock ? `window.pdv.addToCart('${p.id}')` : ''}"
                     data-product-id="${p.id}">

                    <div class="pdv-prod-badges">
                        ${isFavorite ? `<span class="pdv-badge-fav"><i class="bi bi-star-fill"></i></span>` : ''}
                        ${inCart ? `<span class="pdv-badge-cart">${inCart.qty}</span>` : ''}
                        ${lowStock && inStock ? `<span class="pdv-badge-low">!</span>` : ''}
                    </div>

                    <div class="pdv-prod-name">${p.nome}</div>
                    ${p.categoria ? `<div class="pdv-prod-cat">${p.categoria}</div>` : ''}

                    <div class="pdv-prod-footer">
                        <span class="pdv-prod-price">R$ ${window.utils.formatCurrency(p.preco)}</span>
                        <span class="pdv-prod-stock ${lowStock ? 'low' : ''} ${!inStock ? 'zero' : ''}">
                            <i class="bi bi-box"></i> ${p.qtd}${p.unit ? ' ' + p.unit : ''}
                        </span>
                    </div>

                    ${p.code ? `<div class="pdv-prod-ean">${p.code}</div>` : ''}
                    ${!inStock ? `<div class="pdv-prod-overlay">SEM ESTOQUE</div>` : ''}
                </div>
            `;
        }).join('');
    }

    function renderCartArea(state) {
        const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
        const hasClient = selectedClient !== null;
        const cartTotal = calculateSubtotal() - calculateTotalDiscount();

        return `
            <div class="pdv-cart-panel">
                <div class="pdv-cart-header">
                    <div class="pdv-cart-title">
                        <i class="bi bi-cart3"></i>
                        <span>Carrinho</span>
                        <span class="pdv-cart-count" id="cart-count">${itemCount}</span>
                    </div>
                    <div class="pdv-cart-header-actions">
                        <button class="pdv-cart-icon-btn ${hasClient ? 'active' : ''}"
                                onclick="window.pdv.toggleClient()"
                                title="${hasClient ? 'Cliente vinculado' : 'Vincular cliente'}">
                            <i class="bi bi-person${hasClient ? '-check-fill' : ''}"></i>
                        </button>
                        <button class="pdv-cart-icon-btn"
                                onclick="window.pdv.applyGlobalDiscount()"
                                title="Desconto na venda">
                            <i class="bi bi-percent"></i>
                        </button>
                        <button class="pdv-cart-icon-btn warn"
                                onclick="window.pdv.suspendSale()"
                                title="Suspender venda"
                                ${cart.length === 0 ? 'disabled' : ''}>
                            <i class="bi bi-pause-circle"></i>
                        </button>
                        <button class="pdv-cart-icon-btn danger"
                                onclick="window.pdv.clearCart()"
                                title="Limpar carrinho">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>

                ${renderClientSelector(state.clients)}

                <div id="cart-items" class="pdv-cart-items">
                    ${renderCartItems()}
                </div>

                ${renderCartSummary()}

                <div class="pdv-cart-cta">
                    <button class="pdv-finalize-btn"
                            onclick="window.pdv.openCheckout()"
                            ${cart.length === 0 ? 'disabled' : ''}>
                        <span class="pdv-finalize-label">
                            <i class="bi bi-check-circle-fill"></i>
                            Finalizar Venda
                        </span>
                        ${cart.length > 0 ? `
                            <span class="pdv-finalize-total">
                                R$ ${window.utils.formatCurrency(cartTotal)}
                            </span>
                        ` : `<span class="pdv-finalize-hint">F9</span>`}
                    </button>
                    <button class="pdv-suspend-btn"
                            onclick="window.pdv.suspendSale()"
                            ${cart.length === 0 ? 'disabled' : ''}>
                        <i class="bi bi-pause"></i> Suspender
                    </button>
                </div>
            </div>
        `;
    }

    function renderClientSelector(clients) {
        // FIX BUG-CLIENT: o elemento #client-select-area DEVE sempre existir no DOM
        // para que toggleClient() consiga encontrá-lo via getElementById e fazer replaceWith().
        // Antes retornava '' quando selectedClient === null, tornando o botão inoperante
        // até um render() completo (ex: abrir/fechar atalhos).

        if (!selectedClient) {
            // Placeholder visível e clicável — não há lógica nova, apenas o container sempre presente
            return `
                <div id="client-select-area" class="pdv-client-area pdv-client-placeholder"
                     onclick="window.pdv.toggleClient()" title="Vincular cliente">
                    <i class="bi bi-person-plus"></i>
                    <span>Vincular cliente à venda</span>
                </div>
            `;
        }

        return `
            <div id="client-select-area" class="pdv-client-area">
                <div class="pdv-client-header">
                    <span class="pdv-client-label">
                        <i class="bi bi-person-circle"></i> Cliente
                    </span>
                    <button class="pdv-client-remove" onclick="window.pdv.removeClient()">
                        <i class="bi bi-x"></i> Remover
                    </button>
                </div>
                <select id="cart-client"
                        class="form-select form-select-sm pdv-client-select"
                        onchange="window.pdv.updateSelectedClient(this.value)">
                    <option value="">Selecione um cliente...</option>
                    ${clients.map(c => `
                        <option value="${c.id}" ${selectedClient && selectedClient.id === c.id ? 'selected' : ''}>
                            ${c.nome} - ${c.fid || 'Sem codigo'} (${c.points || 0} pts)
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
            <div class="pdv-client-info">
                <i class="bi bi-star-fill" style="color:#f59e0b;"></i>
                <span>${clientData.nome}</span>
                <span class="pdv-client-pts">${clientData.points || 0} pts</span>
            </div>
        `;
    }

    function renderCartItems() {
        if (cart.length === 0) {
            return `
                <div class="pdv-cart-empty">
                    <div class="pdv-cart-empty-icon"><i class="bi bi-cart-x"></i></div>
                    <p>Carrinho vazio</p>
                    <small>Clique em um produto para adicionar</small>
                </div>
            `;
        }

        return cart.map((item, index) => {
            const itemTotal = calculateItemTotal(item);
            return `
                <div class="pdv-cart-item" data-cart-index="${index}">
                    <div class="pdv-cart-item-main">
                        <div class="pdv-cart-item-info">
                            <span class="pdv-cart-item-name">${item.nome}</span>
                            <span class="pdv-cart-item-unit">
                                R$ ${window.utils.formatCurrency(item.preco)}
                                ${item.discount > 0 ? `<span class="pdv-cart-item-disc">-${item.discount.toFixed(0)}%</span>` : ''}
                            </span>
                        </div>
                        <div class="pdv-cart-item-total">
                            R$ ${window.utils.formatCurrency(itemTotal)}
                        </div>
                    </div>

                    <div class="pdv-cart-item-controls">
                        <div class="pdv-qty-control">
                            <button class="pdv-qty-btn" onclick="window.pdv.decreaseQuantity(${index})">
                                <i class="bi bi-dash"></i>
                            </button>
                            <span class="pdv-qty-val">${item.qty}</span>
                            <button class="pdv-qty-btn" onclick="window.pdv.increaseQuantity(${index})">
                                <i class="bi bi-plus"></i>
                            </button>
                        </div>
                        <div class="pdv-item-actions">
                            <button class="pdv-item-btn" onclick="window.pdv.applyItemDiscount(${index})" title="Desconto">
                                <i class="bi bi-percent"></i>
                            </button>
                            <button class="pdv-item-btn danger" onclick="window.pdv.removeFromCart(${index})" title="Remover">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderCartSummary() {
        const subtotal = calculateSubtotal();
        const discountAmount = calculateTotalDiscount();
        const total = subtotal - discountAmount;
        const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

        let pointsToEarn = 0;
        if (selectedClient) {
            const fidelity = window.state.getFidelity?.() || { rate: 1 };
            pointsToEarn = Math.floor(total / (fidelity.rate || 1));
        }

        if (cart.length === 0) return '<div class="pdv-cart-summary-empty"></div>';

        return `
            <div class="pdv-cart-summary">
                <div class="pdv-summary-row">
                    <span>Subtotal <small>(${itemCount} ${itemCount === 1 ? 'item' : 'itens'})</small></span>
                    <span id="cart-subtotal">R$ ${window.utils.formatCurrency(subtotal)}</span>
                </div>
                ${discountAmount > 0 ? `
                    <div class="pdv-summary-row discount">
                        <span>
                            <i class="bi bi-tag-fill"></i> Desconto
                            ${globalDiscount > 0 ? `
                                <button class="pdv-remove-disc" onclick="window.pdv.removeGlobalDiscount()">
                                    x${globalDiscount}%
                                </button>` : ''}
                        </span>
                        <span>- R$ ${window.utils.formatCurrency(discountAmount)}</span>
                    </div>
                ` : ''}
                <div class="pdv-summary-total">
                    <span>Total</span>
                    <span id="cart-total">R$ ${window.utils.formatCurrency(total)}</span>
                </div>
                ${pointsToEarn > 0 ? `
                    <div class="pdv-points-hint">
                        <i class="bi bi-star-fill"></i>
                        Cliente ganha <strong>${pointsToEarn} pontos</strong>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderQuickActions() {
        const hideQuickActions = localStorage.getItem('pdv-hide-quick-actions') === 'true';

        if (hideQuickActions) {
            return `
                <div class="pdv-kb-toggle-wrap">
                    <button class="pdv-kb-toggle-btn" onclick="window.pdv.toggleQuickActions()" title="Mostrar atalhos">
                        <i class="bi bi-keyboard"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="pdv-kb-panel">
                <div class="pdv-kb-header">
                    <i class="bi bi-keyboard"></i>
                    <span>Atalhos</span>
                    <button class="pdv-kb-close" onclick="window.pdv.hideQuickActions()">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
                <div class="pdv-kb-list">
                    <div class="pdv-kb-item"><kbd>F1-F12</kbd><span>Favoritos</span></div>
                    <div class="pdv-kb-item"><kbd>F9</kbd><span>Finalizar</span></div>
                    <div class="pdv-kb-item"><kbd>F8</kbd><span>Suspender</span></div>
                    <div class="pdv-kb-item"><kbd>Esc</kbd><span>Limpar</span></div>
                    <div class="pdv-kb-item"><kbd>Enter</kbd><span>Buscar codigo</span></div>
                </div>
            </div>
        `;
    }

    // ========================================
    // ESTILOS DO PDV (injetados uma vez no DOM)
    // ========================================

    function injectPDVStyles() {
        if (document.getElementById('pdv-styles')) return;
        const style = document.createElement('style');
        style.id = 'pdv-styles';
        style.textContent = `
            /* ====== HEADER ====== */
            .pdv-header { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:14px 20px; }
            .pdv-header-top { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
            .pdv-title-group { display:flex; align-items:center; gap:12px; flex:0 0 auto; }
            .pdv-icon-wrap { width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg,#059669,#10b981); display:flex; align-items:center; justify-content:center; color:#fff; font-size:1.2rem; }
            .pdv-title { font-size:1.15rem; font-weight:700; color:#111827; display:block; line-height:1.2; }
            .pdv-breadcrumb { font-size:0.72rem; color:#9ca3af; letter-spacing:0.03em; }
            .pdv-status-group { display:flex; align-items:center; gap:6px; flex:1; flex-wrap:wrap; }
            .pdv-pill { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:600; border:none; cursor:default; }
            .pdv-pill-open { background:#d1fae5; color:#065f46; }
            .pdv-pill-closed { background:#fee2e2; color:#991b1b; }
            .pdv-pill-operator { background:#eff6ff; color:#1d4ed8; }
            .pdv-pill-sales { background:#f0fdf4; color:#166534; }
            .pdv-pill-suspended { background:#fef3c7; color:#92400e; cursor:pointer; transition:opacity .15s; }
            .pdv-pill-suspended:hover { opacity:.8; }
            .pdv-dot { width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block; }
            .pdv-dot-danger { background:#ef4444; }
            .pdv-actions-group { display:flex; align-items:center; gap:6px; flex:0 0 auto; margin-left:auto; }
            .pdv-divider-v { width:1px; height:28px; background:#e5e7eb; margin:0 4px; }
            .pdv-action-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid #e5e7eb; background:#fff; color:#374151; font-size:0.82rem; font-weight:600; cursor:pointer; transition:all .15s; white-space:nowrap; }
            .pdv-action-btn:hover { background:#f9fafb; border-color:#d1d5db; }
            .pdv-action-btn.pdv-action-success { background:#059669; border-color:#059669; color:#fff; }
            .pdv-action-btn.pdv-action-success:hover { background:#047857; }
            .pdv-action-btn.pdv-action-danger { background:#dc2626; border-color:#dc2626; color:#fff; }
            .pdv-action-btn.pdv-action-danger:hover { background:#b91c1c; }

            /* ====== ALERT CAIXA ====== */
            .pdv-alert-caixa { display:flex; align-items:center; gap:10px; background:#fffbeb; border:1px solid #fcd34d; border-radius:10px; padding:10px 16px; color:#92400e; font-size:0.88rem; }
            .pdv-alert-cta { margin-left:auto; padding:5px 14px; background:#f59e0b; border:none; border-radius:7px; color:#fff; font-weight:700; font-size:0.8rem; cursor:pointer; display:flex; align-items:center; gap:4px; white-space:nowrap; transition:background .15s; }
            .pdv-alert-cta:hover { background:#d97706; }

            /* ====== PRODUCTS PANEL ====== */
            .pdv-products-panel { background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; }
            .pdv-search-wrap { margin-bottom:12px; }
            .pdv-search-inner { position:relative; display:flex; align-items:center; }
            .pdv-search-icon-left { position:absolute; left:12px; color:#6b7280; font-size:1rem; z-index:1; }
            .pdv-search-input { width:100%; padding:10px 72px 10px 38px; border:2px solid #e5e7eb; border-radius:10px; font-size:0.9rem; background:#f9fafb; transition:border-color .15s,background .15s; outline:none; }
            .pdv-search-input:focus { border-color:#10b981; background:#fff; box-shadow:0 0 0 3px rgba(16,185,129,.1); }
            .pdv-search-hint { position:absolute; right:10px; background:#e5e7eb; color:#6b7280; font-size:0.7rem; font-weight:700; padding:3px 8px; border-radius:5px; pointer-events:none; }
            .pdv-category-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:12px; scrollbar-width:none; }
            .pdv-category-tabs::-webkit-scrollbar { display:none; }
            .pdv-cat-tab { display:inline-flex; align-items:center; gap:5px; padding:5px 13px; border-radius:20px; border:1.5px solid #e5e7eb; background:#fff; color:#6b7280; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:all .15s; }
            .pdv-cat-tab:hover { border-color:#10b981; color:#059669; }
            .pdv-cat-tab.active { background:#059669; border-color:#059669; color:#fff; }
            .pdv-cat-count { background:rgba(255,255,255,.25); border-radius:10px; padding:0 6px; font-size:0.7rem; }
            .pdv-cat-tab.active .pdv-cat-count { background:rgba(255,255,255,.3); }

            /* ====== PRODUCT GRID ====== */
            .pdv-product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; max-height:520px; overflow-y:auto; padding-right:4px; scrollbar-width:thin; scrollbar-color:#e5e7eb transparent; }
            .pdv-product-grid::-webkit-scrollbar { width:4px; }
            .pdv-product-grid::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:4px; }
            .pdv-prod-card { position:relative; background:#fff; border:1.5px solid #e5e7eb; border-radius:10px; padding:12px 12px 10px; cursor:pointer; transition:all .15s; display:flex; flex-direction:column; gap:4px; user-select:none; }
            .pdv-prod-card:hover { border-color:#10b981; box-shadow:0 4px 12px rgba(16,185,129,.12); transform:translateY(-1px); }
            .pdv-prod-card:active { transform:translateY(0); box-shadow:none; }
            .pdv-prod-card.in-cart { border-color:#10b981; background:linear-gradient(135deg,#f0fdf4 0%,#fff 100%); }
            .pdv-prod-card.out-of-stock { opacity:.5; cursor:not-allowed; filter:grayscale(.5); }
            .pdv-prod-card.out-of-stock:hover { transform:none; box-shadow:none; border-color:#e5e7eb; }
            .pdv-prod-badges { position:absolute; top:8px; right:8px; display:flex; gap:3px; }
            .pdv-badge-fav { background:#fef3c7; color:#d97706; border-radius:5px; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; }
            .pdv-badge-cart { background:#059669; color:#fff; border-radius:5px; min-width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.68rem; font-weight:700; padding:0 4px; }
            .pdv-badge-low { background:#fef3c7; color:#d97706; border-radius:5px; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:0.68rem; font-weight:700; }
            .pdv-prod-name { font-size:0.83rem; font-weight:700; color:#111827; line-height:1.3; margin-top:2px; padding-right:26px; }
            .pdv-prod-cat { font-size:0.67rem; color:#9ca3af; font-weight:600; text-transform:uppercase; letter-spacing:.03em; }
            .pdv-prod-footer { display:flex; justify-content:space-between; align-items:baseline; margin-top:8px; }
            .pdv-prod-price { font-size:1rem; font-weight:800; color:#059669; font-variant-numeric:tabular-nums; }
            .pdv-prod-stock { font-size:0.7rem; color:#9ca3af; }
            .pdv-prod-stock.low { color:#d97706; }
            .pdv-prod-stock.zero { color:#dc2626; }
            .pdv-prod-ean { font-size:0.63rem; color:#d1d5db; margin-top:2px; font-family:monospace; letter-spacing:.04em; }
            .pdv-prod-overlay { position:absolute; inset:0; background:rgba(255,255,255,.85); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:800; color:#dc2626; letter-spacing:.08em; }
            .pdv-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; color:#9ca3af; }
            .pdv-empty-icon { font-size:2.8rem; margin-bottom:12px; }
            .pdv-empty-title { font-weight:700; color:#6b7280; margin:0; }
            .pdv-empty-sub { font-size:0.82rem; margin:4px 0 0; }
            .pdv-products-footer { margin-top:10px; font-size:0.73rem; color:#9ca3af; display:flex; align-items:center; gap:6px; }

            /* ====== CART PANEL ====== */
            .pdv-cart-panel { background:#0f172a; border-radius:12px; display:flex; flex-direction:column; min-height:600px; overflow:hidden; }
            .pdv-cart-header { padding:14px 16px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; }
            .pdv-cart-title { display:flex; align-items:center; gap:8px; color:#f9fafb; font-size:0.95rem; font-weight:700; }
            .pdv-cart-count { background:#10b981; color:#fff; border-radius:12px; min-width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:800; padding:0 5px; }
            .pdv-cart-header-actions { display:flex; gap:4px; }
            .pdv-cart-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:#94a3b8; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.85rem; transition:all .15s; }
            .pdv-cart-icon-btn:hover { background:rgba(255,255,255,.1); color:#f9fafb; }
            .pdv-cart-icon-btn:disabled { opacity:.3; cursor:not-allowed; }
            .pdv-cart-icon-btn.active { background:rgba(16,185,129,.2); border-color:rgba(16,185,129,.4); color:#10b981; }
            .pdv-cart-icon-btn.warn { color:#f59e0b; }
            .pdv-cart-icon-btn.warn:hover { background:rgba(245,158,11,.15); }
            .pdv-cart-icon-btn.danger { color:#f87171; }
            .pdv-cart-icon-btn.danger:hover { background:rgba(248,113,113,.15); }
            .pdv-client-area { border-bottom:1px solid rgba(255,255,255,.07); background:rgba(255,255,255,.03); }
            .pdv-client-area:not(.pdv-client-placeholder) { padding:10px 14px; }
            .pdv-client-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
            .pdv-client-label { font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; display:flex; align-items:center; gap:5px; }
            .pdv-client-remove { background:none; border:none; color:#f87171; font-size:0.75rem; cursor:pointer; padding:0; display:flex; align-items:center; gap:2px; }
            .pdv-client-select { background:#1e293b; border:1px solid rgba(255,255,255,.1); color:#e2e8f0; font-size:0.82rem; }
            .pdv-client-select option { background:#1e293b; }
            .pdv-client-info { display:flex; align-items:center; gap:8px; margin-top:8px; padding:6px 10px; background:rgba(16,185,129,.1); border-radius:8px; border:1px solid rgba(16,185,129,.2); color:#a7f3d0; font-size:0.8rem; font-weight:600; }
            .pdv-client-pts { margin-left:auto; background:rgba(16,185,129,.2); padding:2px 8px; border-radius:10px; font-size:0.72rem; }
            .pdv-cart-items { flex:1; overflow-y:auto; padding:8px 0; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,.08) transparent; }
            .pdv-cart-items::-webkit-scrollbar { width:3px; }
            .pdv-cart-items::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:3px; }
            .pdv-cart-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; color:#475569; }
            .pdv-cart-empty-icon { font-size:2.5rem; margin-bottom:12px; }
            .pdv-cart-empty p { margin:0; font-weight:600; font-size:0.9rem; }
            .pdv-cart-empty small { font-size:0.75rem; margin-top:4px; color:#334155; }
            .pdv-cart-item { padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.05); transition:background .12s; }
            .pdv-cart-item:hover { background:rgba(255,255,255,.02); }
            .pdv-cart-item-main { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px; }
            .pdv-cart-item-info { flex:1; }
            .pdv-cart-item-name { display:block; font-size:0.84rem; font-weight:700; color:#f1f5f9; line-height:1.3; }
            .pdv-cart-item-unit { display:flex; align-items:center; gap:5px; font-size:0.73rem; color:#64748b; margin-top:1px; }
            .pdv-cart-item-disc { background:rgba(245,158,11,.2); color:#fbbf24; border-radius:4px; padding:1px 5px; font-size:0.67rem; font-weight:700; }
            .pdv-cart-item-total { font-size:0.9rem; font-weight:800; color:#10b981; font-variant-numeric:tabular-nums; white-space:nowrap; }
            .pdv-cart-item-controls { display:flex; justify-content:space-between; align-items:center; }
            .pdv-qty-control { display:flex; align-items:center; background:rgba(255,255,255,.05); border-radius:8px; overflow:hidden; }
            .pdv-qty-btn { width:30px; height:28px; border:none; background:transparent; color:#94a3b8; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.85rem; transition:all .12s; }
            .pdv-qty-btn:hover { background:rgba(255,255,255,.1); color:#f9fafb; }
            .pdv-qty-val { min-width:28px; text-align:center; font-size:0.85rem; font-weight:700; color:#f1f5f9; padding:0 4px; }
            .pdv-item-actions { display:flex; gap:4px; }
            .pdv-item-btn { width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,.07); background:transparent; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.78rem; transition:all .12s; }
            .pdv-item-btn:hover { background:rgba(255,255,255,.08); color:#94a3b8; }
            .pdv-item-btn.danger { color:#f87171; }
            .pdv-item-btn.danger:hover { background:rgba(248,113,113,.12); }

            /* ====== CART SUMMARY ====== */
            .pdv-cart-summary { padding:12px 14px; border-top:1px solid rgba(255,255,255,.07); }
            .pdv-cart-summary-empty { height:0; }
            .pdv-summary-row { display:flex; justify-content:space-between; font-size:0.8rem; color:#64748b; margin-bottom:6px; }
            .pdv-summary-row span { display:flex; align-items:center; gap:5px; }
            .pdv-summary-row.discount { color:#86efac; }
            .pdv-remove-disc { background:rgba(248,113,113,.15); border:none; color:#f87171; font-size:0.68rem; font-weight:700; border-radius:5px; padding:1px 6px; cursor:pointer; margin-left:4px; }
            .pdv-summary-total { display:flex; justify-content:space-between; align-items:baseline; padding-top:10px; margin-top:4px; border-top:1px solid rgba(255,255,255,.08); }
            .pdv-summary-total span:first-child { font-size:0.85rem; font-weight:700; color:#94a3b8; }
            .pdv-summary-total span:last-child { font-size:1.4rem; font-weight:900; color:#10b981; font-variant-numeric:tabular-nums; }
            .pdv-points-hint { display:flex; align-items:center; gap:6px; margin-top:8px; font-size:0.75rem; color:#86efac; background:rgba(16,185,129,.08); border-radius:8px; padding:6px 10px; }

            /* ====== CTA FINALIZAR ====== */
            .pdv-cart-cta { padding:12px 14px; border-top:1px solid rgba(255,255,255,.07); display:flex; flex-direction:column; gap:8px; }
            .pdv-finalize-btn { display:flex; justify-content:space-between; align-items:center; padding:13px 16px; border-radius:10px; border:none; background:linear-gradient(135deg,#059669 0%,#10b981 100%); color:#fff; font-weight:800; cursor:pointer; transition:all .15s; box-shadow:0 4px 14px rgba(16,185,129,.3); }
            .pdv-finalize-btn:hover:not(:disabled) { box-shadow:0 6px 20px rgba(16,185,129,.4); transform:translateY(-1px); }
            .pdv-finalize-btn:disabled { background:#1e293b; color:#475569; cursor:not-allowed; box-shadow:none; transform:none; }
            .pdv-finalize-label { display:flex; align-items:center; gap:8px; font-size:0.92rem; }
            .pdv-finalize-total { font-size:0.95rem; font-variant-numeric:tabular-nums; }
            .pdv-finalize-hint { font-size:0.72rem; color:rgba(255,255,255,.5); }
            .pdv-suspend-btn { padding:7px 0; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#64748b; font-size:0.8rem; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all .12s; }
            .pdv-suspend-btn:hover:not(:disabled) { border-color:#f59e0b; color:#f59e0b; background:rgba(245,158,11,.07); }
            .pdv-suspend-btn:disabled { opacity:.3; cursor:not-allowed; }

            /* ====== KEYBOARD SHORTCUTS
               FIX BUG: kb-panel era position:fixed; right:20px sobrepondo o carrinho (col-lg-5).
               Movido para bottom-LEFT e z-index reduzido para não bloquear interações do cart.
            ====== */
            .pdv-kb-toggle-wrap { position:fixed; bottom:24px; left:24px; z-index:90; }
            .pdv-kb-toggle-btn { width:38px; height:38px; border-radius:50%; border:1px solid #e5e7eb; background:#fff; color:#6b7280; box-shadow:0 2px 8px rgba(0,0,0,.1); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.95rem; transition:all .15s; }
            .pdv-kb-toggle-btn:hover { border-color:#10b981; color:#059669; }
            .pdv-kb-panel { position:fixed; bottom:24px; left:24px; z-index:90; background:#1e293b; border-radius:12px; border:1px solid rgba(255,255,255,.08); box-shadow:0 8px 24px rgba(0,0,0,.3); width:200px; overflow:hidden; }
            .pdv-kb-header { display:flex; align-items:center; gap:7px; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.06); color:#94a3b8; font-size:0.78rem; font-weight:700; }
            .pdv-kb-header span { flex:1; }
            .pdv-kb-close { background:none; border:none; color:#64748b; cursor:pointer; padding:0; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border-radius:4px; font-size:0.9rem; }
            .pdv-kb-close:hover { color:#f9fafb; background:rgba(255,255,255,.06); }
            .pdv-kb-list { padding:8px 12px 12px; }
            .pdv-kb-item { display:flex; justify-content:space-between; align-items:center; padding:5px 0; font-size:0.75rem; color:#64748b; }
            .pdv-kb-item kbd { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:5px; padding:2px 7px; font-size:0.67rem; font-family:monospace; color:#e2e8f0; }

            /* ====== CLIENT PLACEHOLDER ====== */
            .pdv-client-placeholder { display:flex; align-items:center; gap:8px; cursor:pointer; color:#475569; font-size:0.78rem; font-weight:600; border:1.5px dashed rgba(255,255,255,.12); border-radius:8px; margin:8px 14px; padding:8px 12px; background:rgba(255,255,255,.02); transition:all .15s; }
            .pdv-client-placeholder:hover { background:rgba(16,185,129,.06); border-color:rgba(16,185,129,.3); color:#10b981; }
            .pdv-client-placeholder i { font-size:1rem; }
        `;
        document.head.appendChild(style);
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
            playSound(220, 200);
            window.utils.showToast('Produto não encontrado', 'danger');
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
                try { localStorage.removeItem('pdv-cart'); } catch (e) { /* seguro ignorar */ }
                updateCart();
                window.utils.showToast('Carrinho limpo', 'info');
            }
        });
    }
    
    function updateCart() {
        // Atualiza itens
        const cartItemsContainer = document.getElementById('cart-items');
        if (cartItemsContainer) {
            cartItemsContainer.innerHTML = renderCartItems();
        }
        
        // Atualiza sumário — usa classe estável em vez de seletor frágil
        const summaryContainer = document.querySelector('.pdv-cart-summary, .pdv-cart-summary-empty');
        if (summaryContainer) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = renderCartSummary();
            const newSummary = tempDiv.firstElementChild;
            if (newSummary) summaryContainer.replaceWith(newSummary);
        }
        
        // Atualiza contador
        const countBadge = document.getElementById('cart-count');
        if (countBadge) {
            const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
            countBadge.textContent = itemCount;
        }
        
        // Atualiza botões que dependem do estado do carrinho (Suspender / Finalizar)
        const finalizeBtn = document.querySelector('.pdv-finalize-btn');
        const suspendBtn  = document.querySelector('.pdv-suspend-btn');
        const suspendIcon = document.querySelector('.pdv-cart-icon-btn.warn');
        if (finalizeBtn) finalizeBtn.disabled = cart.length === 0;
        if (suspendBtn)  suspendBtn.disabled  = cart.length === 0;
        if (suspendIcon) suspendIcon.disabled  = cart.length === 0;

        // Atualiza currentSale
        currentSale = {
            subtotal: calculateSubtotal(),
            discount: calculateTotalDiscount(),
            total: calculateSubtotal() - calculateTotalDiscount(),
            items: cart.length,
            client: selectedClient
        };

        // Persiste carrinho ativo
        saveCart();
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" >
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
                    const amount = window.utils.parseCurrencyBR(amountStr);
                    
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
                const amount = window.utils.parseCurrencyBR(amountStr);
                
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

    // Atualizar apenas a área de seleção de cliente
    const clientArea = document.getElementById('client-select-area');
    if (clientArea) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderClientSelector(window.state.getClients());
        const newClientArea = tempDiv.firstElementChild;
        if (newClientArea) clientArea.replaceWith(newClientArea);
    }
    updateCart();
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" >
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
                const paid = window.utils.parseCurrencyBR(paidStr);
                
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
            const paid = window.utils.parseCurrencyBR(paidStr);
            
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
                    // Registra no histórico de fidelidade
                    if (typeof window.fidelidade_recordPoints === 'function') {
                        window.fidelidade_recordPoints(
                            client.id,
                            client.nome,
                            points,
                            `Venda #${sale.id.substring(0, 8)}`
                        );
                    }
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
        // Remove carrinho salvo — venda concluída com sucesso, não há o que restaurar
        try { localStorage.removeItem('pdv-cart'); } catch (e) { /* seguro ignorar */ }
        
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
    // Tenta abrir a janela de impressão
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    
    // Verifica se o pop-up foi bloqueado
    if (!printWindow) {
        window.utils.showAlert(
            'Pop-up bloqueado',
            'warning',
            'Permita pop-ups para imprimir o cupom ou utilize a opção "Salvar PDF".'
        );
        return;
    }
    
    // Escreve o conteúdo do cupom
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
                .manual-close {
                    display: none;
                    text-align: center;
                    margin-top: 20px;
                    font-family: Arial, sans-serif;
                }
                @media screen {
                    .manual-close {
                        display: block;
                    }
                }
            </style>
        </head>
        <body>
            ${html}
            <div class="manual-close">
                <p>Após imprimir, feche esta janela manualmente.</p>
                <button onclick="window.close()">Fechar Janela</button>
            </div>
            <script>
                window.onload = function() {
                    // Aguarda o carregamento completo e dispara a impressão
                    window.print();
                    
                    // Tenta fechar automaticamente após a impressão (se suportado)
                    if (window.matchMedia) {
                        var mediaQueryList = window.matchMedia('print');
                        mediaQueryList.addListener(function(mql) {
                            if (!mql.matches) {
                                // Saiu do modo de impressão – tenta fechar
                                setTimeout(function() {
                                    window.close();
                                }, 500);
                            }
                        });
                    }
                    
                    // Fallback: após 10 segundos, se a janela ainda estiver aberta,
                    // mantém o botão para fechamento manual (já incluso no HTML)
                };
            </script>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus(); // Traz a janela para frente
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
            // Sincroniza com o state central se disponível
            if (typeof window.state?.setSuspendedSales === 'function') {
                window.state.setSuspendedSales(suspendedSales);
            }
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" >
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
                const initialValue = window.utils.parseCurrencyBR(initialStr);
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" 
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
                    const actual = window.utils.parseCurrencyBR(actualStr);
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
                const actualValue = window.utils.parseCurrencyBR(actualStr);
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
                if (typeof window.state?.setPdvSession === 'function') {
                    window.state.setPdvSession(null);
                }
                
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" 
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
                const amount = window.utils.parseCurrencyBR(amountStr);
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
                               oninput="let _v=this.value.replace(/\D/g,'');_v=(Number(_v)/100).toFixed(2);this.value=_v.replace('.',',').replace(/(\d)(?=(\d{3})+(?!\d))/g,'$1.');" 
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
                const amount = window.utils.parseCurrencyBR(amountStr);
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
            // Sincroniza com o state central se disponível
            if (typeof window.state?.setPdvSession === 'function') {
                window.state.setPdvSession(cashierSession);
            }
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
            // Sincroniza com o state central se disponível
            if (typeof window.state?.setFavorites === 'function') {
                window.state.setFavorites(favoriteProducts);
            }
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
    
    function filterCategory(category, el) {
        currentFilter = category;
        
        // Atualiza UI — remove active de todos, aplica no clicado
        document.querySelectorAll('.pdv-cat-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        if (el) el.classList.add('active');
        
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
    
    function hideQuickActions() {
    localStorage.setItem('pdv-hide-quick-actions', 'true');
    render();
	}

	function toggleQuickActions() {
    localStorage.removeItem('pdv-hide-quick-actions');
    render();
}
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
	    hideQuickActions,
	    toggleQuickActions,
	    // Utilitários expostos (opcional)
	    parseCurrencyBR: window.utils.parseCurrencyBR,
	    formatCurrency: window.utils.formatCurrency
	};
})();