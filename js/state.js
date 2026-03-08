/**
 * Estado Centralizado — Versão com suporte a fornecedores e migração segura
 * Agora com campos para estoque inteligente (leadTime, safetyStock, etc.)
 */
window.state = (function() {
    'use strict';

    // ========================================
    // ESTADO INICIAL
    // ========================================
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
        }
    };

    // ========================================
    // CARREGAR ESTADO SALVO + MIGRAÇÃO
    // ========================================
    var savedState = localStorage.getItem('supermarket-state');
    var state = savedState ? JSON.parse(savedState) : JSON.parse(JSON.stringify(initialState));

    // Garantir que todas as propriedades do estado inicial existam (migração)
    state = {
        ...JSON.parse(JSON.stringify(initialState)),
        ...state,
        suppliers: state.suppliers || []
    };

    // Migração: garantir que cada produto tenha os novos campos de estoque inteligente
    const defaultProductFields = {
        leadTime: 3,                // dias para entrega do fornecedor
        safetyStock: 5,             // estoque de segurança (pode ser calculado depois)
        maxStock: 100,              // limite superior
        supplierId: null,           // referência ao fornecedor
        holdingCost: 0.1,           // custo de armazenagem por unidade/dia
        orderCost: 10.0             // custo fixo por pedido
    };

    state.products = (state.products || []).map(p => ({
        ...defaultProductFields,
        ...p
    }));

    var listeners = [];

    // ========================================
    // TIMEOUT PARA PERSISTÊNCIA COM DEBOUNCE
    // ========================================
    var saveTimeout = null;
    var PERSIST_DELAY = 200; // ms

    function persist() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            try {
                localStorage.setItem('supermarket-state', JSON.stringify(state));
                notifyListeners();
                autoBackup();
            } catch (e) {
                console.error('Erro ao persistir estado:', e);
            } finally {
                saveTimeout = null;
            }
        }, PERSIST_DELAY);
    }

    function notifyListeners() {
        for (var i = 0; i < listeners.length; i++) {
            try {
                listeners[i](getReadOnlyState());
            } catch (e) {
                console.error('Erro em listener:', e);
            }
        }
    }

    // ========================================
    // BACKUP AUTOMÁTICO
    // ========================================
    function autoBackup() {
        if (!state.backup.autoBackup) return;
        var today = new Date().toDateString();
        var lastBackup = state.backup.lastBackup ? new Date(state.backup.lastBackup).toDateString() : null;
        if (today !== lastBackup) {
            var backupKey = 'backup-' + new Date().toISOString().split('T')[0];
            localStorage.setItem(backupKey, JSON.stringify(state));
            state.backup.lastBackup = new Date().toISOString();
            persist();
        }
    }

    // ========================================
    // GERADORES DE ID
    // ========================================
    function generateId() {
        if (window.utils && typeof window.utils.generateId === 'function') {
            return window.utils.generateId();
        }
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function generateFidelityCode() {
        if (window.utils && typeof window.utils.generateFidelityCode === 'function') {
            return window.utils.generateFidelityCode();
        }
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var code = 'FID-';
        for (var i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ========================================
    // RETORNA UMA CÓPIA CONGELADA
    // ========================================
    function getReadOnlyState() {
        var copy = JSON.parse(JSON.stringify(state));
        return Object.freeze(copy);
    }

    // ========================================
    // MÉTODOS DE ACESSO (SEMPRE RETORNAM ARRAY)
    // ========================================
    function get() {
        return getReadOnlyState();
    }

    function getProducts() {
        return state.products ? state.products.slice() : [];
    }

    function getClients() {
        return state.clients ? state.clients.slice() : [];
    }

    function getSuppliers() {
        return state.suppliers ? state.suppliers.slice() : [];
    }

    function getSales() {
        return state.sales ? state.sales.slice() : [];
    }

    function getFidelity() {
        return JSON.parse(JSON.stringify(state.fidelity || {}));
    }

    function getSaldo() {
        return state.saldo || 0;
    }

    // ========================================
    // MÉTODOS DE MODIFICAÇÃO
    // ========================================
    function addProduct(product) {
        // Garantir que os novos campos existam
        const defaultFields = {
            leadTime: 3,
            safetyStock: 5,
            maxStock: 100,
            supplierId: null,
            holdingCost: 0.1,
            orderCost: 10.0
        };
        product.id = generateId();
        product.sold = 0;
        product.createdAt = new Date().toISOString();
        state.products.push({ ...defaultFields, ...product });
        persist();
        return product.id;
    }

    function updateProduct(id, updates) {
        var index = state.products.findIndex(function(p) { return p.id === id; });
        if (index !== -1) {
            state.products[index] = { ...state.products[index], ...updates };
            persist();
            return true;
        }
        return false;
    }

    function deleteProduct(id) {
        state.products = state.products.filter(function(p) { return p.id !== id; });
        persist();
    }

    function addClient(client) {
        client.id = generateId();
        client.fid = generateFidelityCode();
        client.points = state.fidelity.bonus || 0;
        client.createdAt = new Date().toISOString();
        client.totalPurchases = 0;
        state.clients.push(client);
        persist();
        return client.id;
    }

    function updateClient(id, updates) {
        var index = state.clients.findIndex(function(c) { return c.id === id; });
        if (index !== -1) {
            state.clients[index] = { ...state.clients[index], ...updates };
            persist();
            return true;
        }
        return false;
    }

    function deleteClient(id) {
        state.clients = state.clients.filter(function(c) { return c.id !== id; });
        persist();
    }

    // ========================================
    // MÉTODOS PARA FORNECEDORES
    // ========================================
    function addSupplier(supplier) {
        supplier.id = generateId();
        supplier.createdAt = new Date().toISOString();
        if (!state.suppliers) state.suppliers = [];
        state.suppliers.push(supplier);
        persist();
        return supplier.id;
    }

    function updateSupplier(id, updates) {
        var index = state.suppliers.findIndex(function(s) { return s.id === id; });
        if (index !== -1) {
            state.suppliers[index] = { ...state.suppliers[index], ...updates };
            persist();
            return true;
        }
        return false;
    }

    function deleteSupplier(id) {
        state.suppliers = state.suppliers.filter(function(s) { return s.id !== id; });
        persist();
    }

    // ========================================
    // VENDAS
    // ========================================
    function addSale(sale) {
        sale.id = generateId();
        sale.date = sale.date || new Date().toISOString();
        state.sales.push(sale);
        state.saldo += sale.total;
        persist();
        return sale.id;
    }

    function updateFidelity(rules) {
        state.fidelity = { ...state.fidelity, ...rules };
        persist();
    }

    // ========================================
    // RESET E DADOS INICIAIS
    // ========================================
    function resetToInitial() {
        if (confirm('Isso apagará todos os dados. Deseja continuar?')) {
            state = JSON.parse(JSON.stringify(initialState));
            persist();
            window.location.reload();
        }
    }

    function seedInitialData() {
        if (state.products.length === 0) {
            var produtos = [
                { nome: 'Arroz Tipo 1 5kg', qtd: 25, preco: 24.90, code: '789100001', categoria: 'Alimentos', minStock: 5, unit: 'KG' },
                { nome: 'Feijão Carioca 1kg', qtd: 12, preco: 8.50, code: '789100002', categoria: 'Alimentos', minStock: 5, unit: 'KG' },
                { nome: 'Óleo de Soja 900ml', qtd: 6, preco: 7.39, code: '789100003', categoria: 'Alimentos', minStock: 5, unit: 'UN' },
                { nome: 'Açúcar Cristal 1kg', qtd: 20, preco: 4.99, code: '789100004', categoria: 'Alimentos', minStock: 5, unit: 'KG' },
                { nome: 'Café Torrado 500g', qtd: 15, preco: 12.90, code: '789100005', categoria: 'Bebidas', minStock: 5, unit: 'UN' }
            ];
            for (var i = 0; i < produtos.length; i++) {
                this.addProduct(produtos[i]);
            }
        }
        if (state.clients.length === 0) {
            var clientes = [
                { nome: 'Maria Silva', fone: '(11) 99999-0001', email: 'maria@email.com', points: 120 },
                { nome: 'João Souza', fone: '(11) 99999-0002', points: 40 }
            ];
            for (var j = 0; j < clientes.length; j++) {
                this.addClient(clientes[j]);
            }
        }
        // Fornecedores de exemplo
        if (state.suppliers.length === 0) {
            var fornecedores = [
                { nome: 'Distribuidora Alimentos Ltda', cnpj: '12.345.678/0001-90', fone: '(11) 3333-4444', email: 'contato@distribuidora.com', contato: 'Carlos' },
                { nome: 'Bebidas Puras S.A.', cnpj: '98.765.432/0001-21', fone: '(11) 4444-5555', email: 'vendas@bebidas.com', contato: 'Ana' }
            ];
            for (var k = 0; k < fornecedores.length; k++) {
                this.addSupplier(fornecedores[k]);
            }
        }
    }

    // ========================================
    // SUBSCRIÇÃO
    // ========================================
    function subscribe(listener) {
        listeners.push(listener);
        return function() {
            var idx = listeners.indexOf(listener);
            if (idx !== -1) listeners.splice(idx, 1);
        };
    }

    // ========================================
    // API PÚBLICA
    // ========================================
    var api = {
        get: get,
        getProducts: getProducts,
        getClients: getClients,
        getSuppliers: getSuppliers,
        getSales: getSales,
        getFidelity: getFidelity,
        getSaldo: getSaldo,
        addProduct: addProduct,
        updateProduct: updateProduct,
        deleteProduct: deleteProduct,
        addClient: addClient,
        updateClient: updateClient,
        deleteClient: deleteClient,
        addSupplier: addSupplier,
        updateSupplier: updateSupplier,
        deleteSupplier: deleteSupplier,
        addSale: addSale,
        updateFidelity: updateFidelity,
        resetToInitial: resetToInitial,
        subscribe: subscribe,
        seedInitialData: seedInitialData
    };

    return api;
})();

// Só executa seed se o objeto foi criado com sucesso
if (window.state && typeof window.state.seedInitialData === 'function') {
    window.state.seedInitialData();
}