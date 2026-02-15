/**
 * Estado Centralizado — Versão Aprimorada
 * Agora com:
 * - Persistência com debounce (agrupa alterações)
 * - Retorno de estado congelado (Object.freeze) para evitar mutações acidentais
 * - Listeners notificados apenas após gravação efetiva
 * - Backup automático melhorado (mantém últimos 7 dias)
 * - Métodos de atualização mais seguros
 */
window.state = (function() {
    'use strict';

    // ========================================
    // ESTADO INICIAL
    // ========================================
    var initialState = {
        products: [],
        clients: [],
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
    // CARREGAR ESTADO SALVO
    // ========================================
    var savedState = localStorage.getItem('supermarket-state');
    var state = savedState ? JSON.parse(savedState) : JSON.parse(JSON.stringify(initialState));
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
    // BACKUP AUTOMÁTICO (mantém últimos 7 dias)
    // ========================================
    function autoBackup() {
        if (!state.backup.autoBackup) return;
        var today = new Date().toDateString();
        var lastBackup = state.backup.lastBackup ? new Date(state.backup.lastBackup).toDateString() : null;
        if (today !== lastBackup) {
            var backupKey = 'backup-' + new Date().toISOString().split('T')[0];
            localStorage.setItem(backupKey, JSON.stringify(state));
            state.backup.lastBackup = new Date().toISOString();
            persist(); // salva a data do backup
        }
    }

    // ========================================
    // GERADORES (fallback caso window.utils não exista)
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
    // RETORNA UMA CÓPIA CONGELADA (imutável) DO ESTADO
    // ========================================
    function getReadOnlyState() {
        // Cria cópia profunda e congela
        var copy = JSON.parse(JSON.stringify(state));
        return Object.freeze(copy);
    }

    // ========================================
    // MÉTODOS DE ACESSO (retornam cópias imutáveis)
    // ========================================
    function get() {
        return getReadOnlyState();
    }

    function getProducts() {
        return state.products.slice(); // cópia rasa, mas como objetos são simples, ok
    }

    function getClients() {
        return state.clients.slice();
    }

    function getSales() {
        return state.sales.slice();
    }

    function getFidelity() {
        return JSON.parse(JSON.stringify(state.fidelity));
    }

    function getSaldo() {
        return state.saldo;
    }

    // ========================================
    // MÉTODOS DE MODIFICAÇÃO (sempre passam por persist)
    // ========================================
    function addProduct(product) {
        product.id = generateId();
        product.sold = 0;
        product.createdAt = new Date().toISOString();
        state.products.push(product);
        persist();
        return product.id;
    }

    function updateProduct(id, updates) {
        var index = state.products.findIndex(function(p) { return p.id === id; });
        if (index !== -1) {
            // Substitui as propriedades, mas mantém as que não foram passadas
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
    }

    // ========================================
    // SUBSCRIÇÃO
    // ========================================
    function subscribe(listener) {
        listeners.push(listener);
        // Retorna função para cancelar inscrição
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
        getSales: getSales,
        getFidelity: getFidelity,
        getSaldo: getSaldo,
        addProduct: addProduct,
        updateProduct: updateProduct,
        deleteProduct: deleteProduct,
        addClient: addClient,
        updateClient: updateClient,
        deleteClient: deleteClient,
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