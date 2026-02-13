/**
 * Estado Centralizado — VERSÃO SEM ERROS DE SINTAXE
 */
window.state = (function() {
    'use strict';

    var initialState = {
        products: [],
        clients: [],
        sales: [],
        saldo: 0,
        fidelity: {
            rate: 1,
            bonus: 0,
            discountPoints: 100,
            enabled: true
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

    var savedState = localStorage.getItem('supermarket-state');
    var state = savedState ? JSON.parse(savedState) : JSON.parse(JSON.stringify(initialState));
    var listeners = [];

    // ----- Internas -----
    function persist() {
        localStorage.setItem('supermarket-state', JSON.stringify(state));
        notifyListeners();
        autoBackup();
    }

    function notifyListeners() {
        for (var i = 0; i < listeners.length; i++) {
            listeners[i](state);
        }
    }

    function autoBackup() {
        if (!state.backup.autoBackup) return;
        var today = new Date().toDateString();
        var lastBackup = state.backup.lastBackup ? new Date(state.backup.lastBackup).toDateString() : null;
        if (today !== lastBackup) {
            var backupKey = 'backup-' + new Date().toISOString().split('T')[0];
            localStorage.setItem(backupKey, JSON.stringify(state));
            state.backup.lastBackup = new Date().toISOString();
            localStorage.setItem('supermarket-state', JSON.stringify(state));
        }
    }

    // ----- Geradores (fallback caso window.utils não exista) -----
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

    // ----- API -----
    var api = {
        get: function() {
            return JSON.parse(JSON.stringify(state));
        },
        getProducts: function() {
            return state.products.slice();
        },
        getClients: function() {
            return state.clients.slice();
        },
        getSales: function() {
            return state.sales.slice();
        },
        getFidelity: function() {
            return JSON.parse(JSON.stringify(state.fidelity));
        },
        getSaldo: function() {
            return state.saldo;
        },

        addProduct: function(product) {
            product.id = generateId();
            product.sold = 0;
            product.createdAt = new Date().toISOString();
            state.products.push(product);
            persist();
            return product.id;
        },

        updateProduct: function(id, updates) {
            var index = -1;
            for (var i = 0; i < state.products.length; i++) {
                if (state.products[i].id === id) {
                    index = i;
                    break;
                }
            }
            if (index !== -1) {
                for (var key in updates) {
                    if (updates.hasOwnProperty(key)) {
                        state.products[index][key] = updates[key];
                    }
                }
                persist();
                return true;
            }
            return false;
        },

        deleteProduct: function(id) {
            var newProducts = [];
            for (var i = 0; i < state.products.length; i++) {
                if (state.products[i].id !== id) {
                    newProducts.push(state.products[i]);
                }
            }
            state.products = newProducts;
            persist();
        },

        addClient: function(client) {
            client.id = generateId();
            client.fid = generateFidelityCode();
            client.points = state.fidelity.bonus || 0;
            client.createdAt = new Date().toISOString();
            client.totalPurchases = 0;
            state.clients.push(client);
            persist();
            return client.id;
        },

        updateClient: function(id, updates) {
            var index = -1;
            for (var i = 0; i < state.clients.length; i++) {
                if (state.clients[i].id === id) {
                    index = i;
                    break;
                }
            }
            if (index !== -1) {
                for (var key in updates) {
                    if (updates.hasOwnProperty(key)) {
                        state.clients[index][key] = updates[key];
                    }
                }
                persist();
                return true;
            }
            return false;
        },

        deleteClient: function(id) {
            var newClients = [];
            for (var i = 0; i < state.clients.length; i++) {
                if (state.clients[i].id !== id) {
                    newClients.push(state.clients[i]);
                }
            }
            state.clients = newClients;
            persist();
        },

        addSale: function(sale) {
            sale.id = generateId();
            sale.date = sale.date || new Date().toISOString();
            state.sales.push(sale);
            state.saldo += sale.total;
            persist();
            return sale.id;
        },

        updateFidelity: function(rules) {
            for (var key in rules) {
                if (rules.hasOwnProperty(key)) {
                    state.fidelity[key] = rules[key];
                }
            }
            persist();
        },

        resetToInitial: function() {
            if (confirm('Isso apagará todos os dados. Deseja continuar?')) {
                state = JSON.parse(JSON.stringify(initialState));
                persist();
                window.location.reload();
            }
        },

        subscribe: function(listener) {
            listeners.push(listener);
            return function() {
                var idx = listeners.indexOf(listener);
                if (idx !== -1) listeners.splice(idx, 1);
            };
        },

        seedInitialData: function() {
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
    };

    return api;
})();

// Só executa seed se o objeto foi criado com sucesso
if (window.state && typeof window.state.seedInitialData === 'function') {
    window.state.seedInitialData();
}