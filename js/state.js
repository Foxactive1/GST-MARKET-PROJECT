/**
 * ============================================================================
 * ESTADO CENTRALIZADO — VERSÃO 2.1.0 (2026-03-14)
 * ============================================================================
 *
 * Novidades:
 * - Métodos setPdvSession, setSuspendedSales, setFavorites para o módulo PDV.
 * - Migração automática de dados legados (pdv-cashier-session, pdv-suspended-sales,
 *   pdv-favorite-products) para dentro do estado central.
 *
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.1.0
 */

window.state = (function() {
    'use strict';

    // =========================================================================
    // ESTADO INICIAL
    // =========================================================================
    var initialState = {
        products: [],
        clients: [],
        suppliers: [],
        sales: [],
        saldo: 0,
        fidelity: {
            rate: 1,
            bonus: 0,
            discountPoints: 100,
            discountValue: 5,
            enabled: true,
            expiryDays: 365,
            birthdayBonus: false,
            firstPurchaseBonus: false
        },
        config: {
            companyName: 'Supermercado Pro',
            currency: 'BRL',
            lowStockThreshold: 5
        },
        backup: {
            lastBackup: null,
            autoBackup: true
        },
        // Dados do PDV que antes ficavam em localStorage separado
        pdvSession: null,          // sessão do caixa aberto
        suspendedSales: [],         // vendas suspensas
        favorites: {},              // produtos favoritos (F1-F12)
        priceHistory: []             // histórico de preços (price-intelligence)
    };

    // =========================================================================
    // CARREGAR ESTADO SALVO + DESCOMPRESSÃO + MIGRAÇÃO
    // =========================================================================

    var savedRaw = localStorage.getItem('supermarket-state');
    var savedState = null;

    if (savedRaw) {
        try {
            if (typeof LZString !== 'undefined' && !savedRaw.startsWith('{')) {
                savedState = JSON.parse(LZString.decompress(savedRaw));
            } else {
                savedState = JSON.parse(savedRaw);
            }
        } catch (e) {
            console.warn('[State] Falha ao carregar estado salvo — iniciando com estado inicial.', e);
            savedState = null;
        }
    }

    // Mescla com initialState para garantir todas as propriedades
    var state = {
        ...JSON.parse(JSON.stringify(initialState)),
        ...(savedState || {}),
        suppliers: (savedState && savedState.suppliers) ? savedState.suppliers : []
    };

    // Migração: campos inteligentes de produto
    var defaultProductFields = {
        leadTime: 3,
        safetyStock: 5,
        maxStock: 100,
        supplierId: null,
        holdingCost: 0.1,
        orderCost: 10.0
    };
    state.products = (state.products || []).map(function(p) {
        return { ...defaultProductFields, ...p };
    });

    // =========================================================================
    // MIGRAÇÃO DE DADOS LEGADOS DO PDV (LOCALSTORAGE PARA O STATE)
    // =========================================================================
    function migrateLegacyPDV() {
        // Sessão do caixa
        var oldSession = localStorage.getItem('pdv-cashier-session');
        if (oldSession && !state.pdvSession) {
            try {
                state.pdvSession = JSON.parse(oldSession);
                localStorage.removeItem('pdv-cashier-session');
                console.log('[State] Sessão de caixa migrada.');
            } catch (e) {
                console.warn('[State] Falha ao migrar sessão de caixa:', e);
            }
        }

        // Vendas suspensas
        var oldSuspended = localStorage.getItem('pdv-suspended-sales');
        if (oldSuspended && state.suspendedSales.length === 0) {
            try {
                state.suspendedSales = JSON.parse(oldSuspended);
                localStorage.removeItem('pdv-suspended-sales');
                console.log('[State] Vendas suspensas migradas.');
            } catch (e) {
                console.warn('[State] Falha ao migrar vendas suspensas:', e);
            }
        }

        // Produtos favoritos
        var oldFavs = localStorage.getItem('pdv-favorite-products');
        if (oldFavs && Object.keys(state.favorites).length === 0) {
            try {
                state.favorites = JSON.parse(oldFavs);
                localStorage.removeItem('pdv-favorite-products');
                console.log('[State] Favoritos migrados.');
            } catch (e) {
                console.warn('[State] Falha ao migrar favoritos:', e);
            }
        }

        // Se qualquer migração ocorreu, força persistência
        if (oldSession || oldSuspended || oldFavs) {
            persist(); // persist será definida adiante, mas já podemos chamar aqui
        }
    }

    // =========================================================================
    // PERSISTÊNCIA, CACHE E LISTENERS
    // =========================================================================

    var listeners = [];
    var cachedReadOnlyState = null;

    function invalidateCache() {
        cachedReadOnlyState = null;
    }

    function getReadOnlyState() {
        if (cachedReadOnlyState) return cachedReadOnlyState;
        var copy = JSON.parse(JSON.stringify(state));
        cachedReadOnlyState = Object.freeze(copy);
        return cachedReadOnlyState;
    }

    var saveTimeout = null;
    var PERSIST_DELAY = 200;

    function persist() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            try {
                var toStore = JSON.stringify(state);
                if (typeof LZString !== 'undefined') {
                    toStore = LZString.compress(toStore);
                }
                localStorage.setItem('supermarket-state', toStore);
                invalidateCache();
                notifyListeners();
                autoBackup();
            } catch (e) {
                console.error('[State] Erro ao persistir estado:', e);
            } finally {
                saveTimeout = null;
            }
        }, PERSIST_DELAY);
    }

    function notifyListeners() {
        var readOnly = getReadOnlyState();
        for (var i = 0; i < listeners.length; i++) {
            try {
                listeners[i](readOnly);
            } catch (e) {
                console.error('[State] Erro em listener:', e);
            }
        }
    }

    // =========================================================================
    // BACKUP AUTOMÁTICO
    // =========================================================================

    var MAX_BACKUPS = 7;

    function performBackup() {
        // (implementação futura)
    }

    function autoBackup() {
        // (implementação futura)
    }

    // =========================================================================
    // GERADORES DE ID
    // =========================================================================

    function generateId() {
        return window.utils?.generateId?.() || 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function generateFidelityCode() {
        return window.utils?.generateFidelityCode?.() || 'FID-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    // =========================================================================
    // MÉTODOS DE LEITURA
    // =========================================================================

    function get() {
        return getReadOnlyState();
    }

    function getProducts() {
        return getReadOnlyState().products.slice();
    }

    function getClients() {
        return getReadOnlyState().clients.slice();
    }

    function getSuppliers() {
        return getReadOnlyState().suppliers.slice();
    }

    function getSales() {
        return getReadOnlyState().sales.slice();
    }

    function getFidelity() {
        return JSON.parse(JSON.stringify(getReadOnlyState().fidelity || {}));
    }

    function getSaldo() {
        return getReadOnlyState().saldo || 0;
    }

    function getPriceHistory() {
        return getReadOnlyState().priceHistory ? getReadOnlyState().priceHistory.slice() : [];
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — PRODUTOS
    // =========================================================================

    function addProduct(product) {
        var newProduct = {
            ...defaultProductFields,
            ...product,
            id: generateId(),
            sold: product.sold || 0,
            createdAt: new Date().toISOString()
        };
        state.products.push(newProduct);
        invalidateCache();
        persist();
        return newProduct.id;
    }

    function updateProduct(id, updates) {
        var index = state.products.findIndex(function(p) { return p.id === id; });
        if (index !== -1) {
            state.products[index] = { ...state.products[index], ...updates };
            invalidateCache();
            persist();
            return true;
        }
        return false;
    }

    function deleteProduct(id) {
        state.products = state.products.filter(function(p) { return p.id !== id; });
        invalidateCache();
        persist();
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — CLIENTES
    // =========================================================================

    function addClient(client) {
        client.id = generateId();
        client.fid = generateFidelityCode();
        client.points = client.points !== undefined ? client.points : (state.fidelity.bonus || 0);
        client.createdAt = new Date().toISOString();
        client.totalPurchases = 0;
        state.clients.push(client);
        invalidateCache();
        persist();
        return client.id;
    }

    function updateClient(id, updates) {
        var index = state.clients.findIndex(function(c) { return c.id === id; });
        if (index !== -1) {
            state.clients[index] = { ...state.clients[index], ...updates };
            invalidateCache();
            persist();
            return true;
        }
        return false;
    }

    function deleteClient(id) {
        state.clients = state.clients.filter(function(c) { return c.id !== id; });
        invalidateCache();
        persist();
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — FORNECEDORES
    // =========================================================================

    function addSupplier(supplier) {
        if (!state.suppliers) state.suppliers = [];
        supplier.id = generateId();
        supplier.createdAt = new Date().toISOString();
        state.suppliers.push(supplier);
        invalidateCache();
        persist();
        return supplier.id;
    }

    function updateSupplier(id, updates) {
        var index = state.suppliers.findIndex(function(s) { return s.id === id; });
        if (index !== -1) {
            state.suppliers[index] = { ...state.suppliers[index], ...updates };
            invalidateCache();
            persist();
            return true;
        }
        return false;
    }

    function deleteSupplier(id) {
        state.suppliers = state.suppliers.filter(function(s) { return s.id !== id; });
        invalidateCache();
        persist();
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — VENDAS E FIDELIDADE
    // =========================================================================

    function addSale(sale) {
        sale.id = generateId();
        sale.date = sale.date || new Date().toISOString();
        state.sales.push(sale);
        state.saldo += sale.total;
        invalidateCache();
        persist();
        return sale.id;
    }

    function updateFidelity(rules) {
        state.fidelity = { ...state.fidelity, ...rules };
        invalidateCache();
        persist();
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — PDV (NOVOS)
    // =========================================================================

    function setPdvSession(session) {
        state.pdvSession = session ? { ...session } : null;
        invalidateCache();
        persist();
    }

    function setSuspendedSales(list) {
        state.suspendedSales = Array.isArray(list) ? list : [];
        invalidateCache();
        persist();
    }

    function setFavorites(favs) {
        state.favorites = favs ? { ...favs } : {};
        invalidateCache();
        persist();
    }

    // =========================================================================
    // MÉTODOS DE MODIFICAÇÃO — HISTÓRICO DE PREÇOS
    // =========================================================================

    function setPriceHistory(history) {
        state.priceHistory = Array.isArray(history) ? history : [];
        invalidateCache();
        persist();
    }

    // =========================================================================
    // RESET E SEED
    // =========================================================================

    function resetToInitial() {
        if (confirm('Isso apagará todos os dados. Deseja continuar?')) {
            state = JSON.parse(JSON.stringify(initialState));
            invalidateCache();
            persist();
            window.location.reload();
        }
    }

    function seedInitialData() {
        // Função vazia para evitar erro de chamada. Pode ser implementada futuramente.
    }

    // =========================================================================
    // SUBSCRIÇÃO
    // =========================================================================

    function subscribe(listener) {
        listeners.push(listener);
        return function() {
            var idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }

    // =========================================================================
    // API PÚBLICA
    // =========================================================================
    var api = {
        // Leitura
        get: get,
        getProducts: getProducts,
        getClients: getClients,
        getSuppliers: getSuppliers,
        getSales: getSales,
        getFidelity: getFidelity,
        getSaldo: getSaldo,
        getPriceHistory: getPriceHistory,

        // Produtos
        addProduct: addProduct,
        updateProduct: updateProduct,
        deleteProduct: deleteProduct,

        // Clientes
        addClient: addClient,
        updateClient: updateClient,
        deleteClient: deleteClient,

        // Fornecedores
        addSupplier: addSupplier,
        updateSupplier: updateSupplier,
        deleteSupplier: deleteSupplier,

        // Vendas e fidelidade
        addSale: addSale,
        updateFidelity: updateFidelity,

        // PDV (novos)
        setPdvSession: setPdvSession,
        setSuspendedSales: setSuspendedSales,
        setFavorites: setFavorites,

        // Preços
        setPriceHistory: setPriceHistory,

        // Utilitários
        resetToInitial: resetToInitial,
        subscribe: subscribe,
        seedInitialData: seedInitialData
    };

    // Executa migração de dados legados do PDV antes de qualquer outra coisa
    migrateLegacyPDV();

    return api;
})();

// Seed inicial (executa apenas se não houver dados)
if (window.state && typeof window.state.seedInitialData === 'function') {
    window.state.seedInitialData();
}