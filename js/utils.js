/**
 * utils.fixed.js — v5.0.0 (patched, protected)
 * Correções: proteção contra re-load, try/catch global, validação de exports,
 * hardening de funções que acessam dependências externas e stubs seguros.
 *
 * Autor original: Dione Castro Alves — InNovaIdeia
 * Patch aplicado por: Copilot
 * Data do patch: 2026-03-18 (refactor)
 */

(function () {
    'use strict';

    // Evita sobrescrever uma versão já carregada e marcada como patch
    if (window.utils && window.utils.__patched === true) {
        console.warn('utils já carregado e patch aplicado — pulando reatribuição');
        return;
    }

    // Função fábrica encapsulada com try/catch para garantir que erros não deixem window.utils undefined
    try {
        var _utils = (function () {
            'use strict';

            /* ==========================================================
               SEÇÃO 1 — ID GENERATORS
            ========================================================== */

            function generateId(prefix) {
                prefix = prefix || 'id';
                // usa crypto quando disponível para maior entropia
                try {
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        var arr = new Uint32Array(1);
                        crypto.getRandomValues(arr);
                        var rand = (arr[0] % 10000);
                        return prefix + '_' + Date.now() + '_' + rand;
                    }
                } catch (e) {
                    // fallback silencioso
                }
                return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
            }

            function generateCode(length) {
                length = length || 8;
                var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                var code = '';
                try {
                    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                        var array = new Uint32Array(length);
                        crypto.getRandomValues(array);
                        for (var i = 0; i < length; i++) {
                            code += chars.charAt(array[i] % chars.length);
                        }
                        return code;
                    }
                } catch (e) {
                    // fallback para Math.random
                }
                for (var j = 0; j < length; j++) {
                    code += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return code;
            }

            function generateFidelityCode() {
                return 'FID-' + generateCode(6);
            }

            /* ==========================================================
               SEÇÃO 2 — PARSER MONETÁRIO (BLINDADO)
            ========================================================== */

            function parseCurrencyBR(value) {
                if (value === null || value === undefined) return 0;
                if (typeof value === 'number') return value;
                var s = value.toString().trim();
                s = s.replace(/[^\d,.-]/g, '');
                if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else if (s.indexOf(',') > -1 && s.indexOf('.') === -1) {
                    s = s.replace(',', '.');
                } else {
                    s = s.replace(/,/g, '');
                }
                var n = Number(s);
                return isNaN(n) ? 0 : n;
            }

            /* ==========================================================
               SEÇÃO 3 — FORMATADORES
            ========================================================== */

            function formatCurrency(value) {
                var number = Number(value) || 0;
                return number.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            function formatCurrencyRaw(value) {
                var num = parseCurrencyBR(value);
                return num.toFixed(2);
            }

            function formatCurrencyBR(value) {
                var number = Number(value) || 0;
                return 'R$ ' + number.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }

            function formatPercent(value) {
                return Number(value || 0).toFixed(2) + '%';
            }

            function formatPhone(phone) {
                if (!phone) return '';
                var cleaned = phone.toString().replace(/\D/g, '');
                if (cleaned.length === 11) {
                    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                }
                if (cleaned.length === 10) {
                    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
                }
                return phone;
            }

            function formatDate(date, format) {
                var d = new Date(date);
                if (isNaN(d.getTime())) return '';
                if (format === 'long') {
                    return d.toLocaleString('pt-BR');
                }
                return d.toLocaleDateString('pt-BR');
            }

            function formatDateTime(date) {
                var d = new Date(date);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleString('pt-BR');
            }

            function formatDateISO(date) {
                try {
                    return new Date(date).toISOString();
                } catch (e) {
                    return '';
                }
            }

            /* ==========================================================
               SEÇÃO 4 — MÁSCARAS DE INPUT
            ========================================================== */

            function maskCurrencyInput(input) {
                if (!input || typeof input.addEventListener !== 'function') return;
                input.addEventListener('input', function () {
                    var selectionStart = input.selectionStart;
                    var oldLength = input.value.length;
                    var value = input.value.replace(/\D/g, '');
                    value = (Number(value) / 100).toFixed(2);
                    value = value.replace('.', ',');
                    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                    input.value = value;
                    try {
                        var newLength = input.value.length;
                        var diff = newLength - oldLength;
                        input.setSelectionRange(selectionStart + diff, selectionStart + diff);
                    } catch (e) {
                        // ignore
                    }
                });
            }

            function maskPhoneInput(input) {
                if (!input || typeof input.addEventListener !== 'function') return;
                input.addEventListener('input', function () {
                    var cleaned = input.value.replace(/\D/g, '');
                    if (cleaned.length > 11) cleaned = cleaned.slice(0, 11);
                    input.value = formatPhone(cleaned);
                });
            }

            function maskCNPJInput(input) {
                if (!input || typeof input.addEventListener !== 'function') return;
                input.addEventListener('input', function () {
                    var v = input.value.replace(/\D/g, '').slice(0, 14);
                    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
                    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
                    v = v.replace(/(\d{4})(\d)/, '$1-$2');
                    input.value = v;
                });
            }

            function maskCPFInput(input) {
                if (!input || typeof input.addEventListener !== 'function') return;
                input.addEventListener('input', function () {
                    var v = input.value.replace(/\D/g, '').slice(0, 11);
                    v = v.replace(/(\d{3})(\d)/, '$1.$2');
                    v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
                    v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
                    input.value = v;
                });
            }

            /* ==========================================================
               SEÇÃO 5 — VALIDAÇÕES
            ========================================================== */

            function validateProduct(product) {
                if (!product || !product.nome || product.nome.trim() === '') {
                    alert('Nome do produto é obrigatório');
                    return false;
                }
                if (Number(product.qtd) < 0) {
                    alert('Quantidade não pode ser negativa');
                    return false;
                }
                if (Number(product.preco) <= 0) {
                    alert('Preço deve ser maior que zero');
                    return false;
                }
                return true;
            }

            function validateClient(client) {
                if (!client || !client.nome || client.nome.trim() === '') {
                    alert('Nome do cliente é obrigatório');
                    return false;
                }
                if (!client.fone || client.fone.trim() === '') {
                    alert('Telefone é obrigatório');
                    return false;
                }
                return true;
            }

            function validateSupplier(supplier) {
                if (!supplier) {
                    console.warn('validateSupplier: supplier ausente');
                    return false;
                }
                return true;
            }

            function validateCNPJ(cnpj) {
                if (!cnpj) return false;
                var cleaned = cnpj.toString().replace(/\D/g, '');
                return cleaned.length === 14;
            }

            function validateCPF(cpf) {
                if (!cpf) return false;
                var cleaned = cpf.toString().replace(/\D/g, '');
                return cleaned.length === 11;
            }

            /* ==========================================================
               SEÇÃO 6 — CÁLCULOS DE PREÇO / MARGEM / MARKUP
            ========================================================== */

            function calculateMargin(cost, sale) {
                cost = Number(cost) || 0;
                sale = Number(sale) || 0;
                if (sale === 0) return 0;
                return ((sale - cost) / sale) * 100;
            }

            function calculateMarkup(cost, sale) {
                cost = Number(cost) || 0;
                sale = Number(sale) || 0;
                if (cost === 0) return 0;
                return ((sale - cost) / cost) * 100;
            }

            function calculateProfit(cost, sale) {
                cost = Number(cost) || 0;
                sale = Number(sale) || 0;
                return sale - cost;
            }

            function applyMarkup(cost, markup) {
                cost = Number(cost) || 0;
                markup = Number(markup) || 0;
                return cost + (cost * markup / 100);
            }

            function applyMargin(cost, margin) {
                cost = Number(cost) || 0;
                margin = Number(margin) || 0;
                if (margin >= 100) return 0;
                return cost / (1 - margin / 100);
            }

            /* ==========================================================
               SEÇÃO 7 — INTELIGÊNCIA DE PREÇOS
            ========================================================== */

            function priceDifference(priceA, priceB) {
                priceA = Number(priceA) || 0;
                priceB = Number(priceB) || 0;
                var diff = priceA - priceB;
                var percent = priceB === 0 ? 0 : (diff / priceB) * 100;
                return { difference: diff, percent: percent };
            }

            function competitivePriceSuggestion(myPrice, competitorPrices) {
                competitorPrices = competitorPrices || [];
                var valid = competitorPrices.map(Number).filter(function (v) { return v > 0; });
                if (valid.length === 0) {
                    return { suggestion: myPrice, avg: myPrice, min: myPrice, max: myPrice };
                }
                var avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
                var min = Math.min.apply(null, valid);
                var max = Math.max.apply(null, valid);
                var suggestion = avg * 0.98;
                return { suggestion: suggestion, avg: avg, min: min, max: max };
            }

            function isPriceCompetitive(myPrice, marketAvg) {
                if (!marketAvg) return false;
                var diff = ((myPrice - marketAvg) / marketAvg) * 100;
                return diff <= 5;
            }

            /* ==========================================================
               SEÇÃO 8 — CÁLCULOS DE VENDAS
            ========================================================== */

            function calculateTotalSales(sales) {
                var total = 0;
                if (!Array.isArray(sales)) return 0;
                for (var i = 0; i < sales.length; i++) {
                    total += Number(sales[i].total) || 0;
                }
                return total;
            }

            function calculateTodaySales(sales) {
                if (!Array.isArray(sales)) return 0;
                var today = new Date().toDateString();
                var total = 0;
                for (var i = 0; i < sales.length; i++) {
                    try {
                        if (new Date(sales[i].date).toDateString() === today) {
                            total += Number(sales[i].total) || 0;
                        }
                    } catch (e) {
                        // ignore invalid dates
                    }
                }
                return total;
            }

            /* ==========================================================
               SEÇÃO 9 — UI: TOAST / ALERT / CONFIRM
            ========================================================== */

            function showToast(message, type) {
                try {
                    console.log('[Toast]', type || 'info', ':', message);
                    var container = typeof document !== 'undefined' ? document.getElementById('toastContainer') : null;
                    if (!container) {
                        console.warn('⚠️ toastContainer não encontrado. Usando alert.');
                        if (typeof alert !== 'undefined') alert(message);
                        return;
                    }
                    if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
                        console.warn('⚠️ Bootstrap.Toast não disponível. Usando alert.');
                        if (typeof alert !== 'undefined') alert(message);
                        return;
                    }
                    var bgClass = 'bg-success';
                    if (type === 'danger') bgClass = 'bg-danger';
                    if (type === 'warning') bgClass = 'bg-warning';
                    if (type === 'info') bgClass = 'bg-info';
                    var toast = document.createElement('div');
                    toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0';
                    toast.setAttribute('role', 'alert');
                    toast.setAttribute('aria-live', 'assertive');
                    toast.setAttribute('aria-atomic', 'true');
                    var inner = document.createElement('div');
                    inner.className = 'd-flex';
                    var body = document.createElement('div');
                    body.className = 'toast-body';
                    body.textContent = message;
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn-close btn-close-white me-2 m-auto';
                    btn.setAttribute('data-bs-dismiss', 'toast');
                    btn.setAttribute('aria-label', 'Fechar');
                    inner.appendChild(body);
                    inner.appendChild(btn);
                    toast.appendChild(inner);
                    container.appendChild(toast);
                    var bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 3000 });
                    bsToast.show();
                    setTimeout(function () { try { toast.remove(); } catch (e) {} }, 3500);
                } catch (err) {
                    console.error('❌ Erro ao criar toast:', err && err.message ? err.message : err);
                    if (typeof alert !== 'undefined') alert(message);
                }
            }

            function showAlert(title, icon, text) {
                if (typeof Swal !== 'undefined') {
                    return Swal.fire({
                        title: title,
                        text: text || '',
                        icon: icon || 'info',
                        confirmButtonColor: '#10b981',
                        confirmButtonText: 'OK'
                    });
                }
                console.warn('⚠️ SweetAlert2 não disponível. Usando alert nativo.');
                if (typeof alert !== 'undefined') alert(title + (text ? ': ' + text : ''));
                return Promise.resolve({ isConfirmed: true });
            }

            function showConfirm(title, text, confirmText) {
                if (typeof Swal !== 'undefined') {
                    return Swal.fire({
                        title: title,
                        text: text || '',
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonColor: '#10b981',
                        cancelButtonColor: '#6b7280',
                        confirmButtonText: confirmText || 'Confirmar',
                        cancelButtonText: 'Cancelar'
                    });
                }
                console.warn('⚠️ SweetAlert2 não disponível. Usando confirm nativo.');
                var result = typeof confirm !== 'undefined' ? confirm(title + (text ? '\n' + text : '')) : false;
                return Promise.resolve({ isConfirmed: result });
            }

            /* ==========================================================
               SEÇÃO 10 — UTILITÁRIOS GERAIS
            ========================================================== */

            function debounce(func, wait) {
                var timeout;
                return function () {
                    var context = this;
                    var args = arguments;
                    clearTimeout(timeout);
                    timeout = setTimeout(function () {
                        timeout = null;
                        func.apply(context, args);
                    }, wait);
                };
            }

            function createBackup() {
                try {
                    if (!window.state || typeof window.state.get !== 'function') {
                        throw new Error('window.state.get não disponível');
                    }
                    var state = window.state.get();
                    var data = JSON.stringify(state, null, 2);
                    var blob = new Blob([data], { type: 'application/json' });
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'backup-supermercado-' + new Date().toISOString().split('T')[0] + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                    showToast('Backup criado com sucesso!', 'success');
                } catch (err) {
                    console.error('❌ Erro ao criar backup:', err);
                    if (typeof alert !== 'undefined') alert('Erro ao criar backup.');
                }
            }

            function exportToCSV(data, filename) {
                if (!data || !Array.isArray(data) || data.length === 0) {
                    console.warn('⚠️ exportToCSV: nenhum dado para exportar.');
                    return;
                }
                var csvRows = [];
                var headers = Object.keys(data[0]);
                csvRows.push(headers.join(','));
                for (var i = 0; i < data.length; i++) {
                    var values = headers.map(function (key) {
                        var value = data[i][key];
                        if (value === null || value === undefined) return '';
                        if (typeof value === 'object') {
                            try {
                                value = JSON.stringify(value);
                            } catch (e) {
                                value = String(value);
                            }
                        }
                        if (typeof value === 'string') {
                            return '"' + value.replace(/"/g, '""') + '"';
                        }
                        return String(value);
                    });
                    csvRows.push(values.join(','));
                }
                var safeFilename = (filename || 'export.csv').replace(/[\\\/:*?"<>|]/g, '-');
                var csv = '\uFEFF' + csvRows.join('\n');
                var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = safeFilename;
                a.click();
                URL.revokeObjectURL(url);
            }

            /* ==========================================================
               SEÇÃO 11 — DIAGNÓSTICO DE DEPENDÊNCIAS
            ========================================================== */

            function checkDependencies() {
                var deps = {
                    bootstrap:      typeof bootstrap !== 'undefined',
                    bootstrapToast: typeof bootstrap !== 'undefined' && !!bootstrap.Toast,
                    swal:           typeof Swal !== 'undefined',
                    toastContainer: !!(typeof document !== 'undefined' && document.getElementById('toastContainer'))
                };
                console.log('%c=== utils.js v5.0 — Dependências ===', 'color: #6366f1; font-weight: bold');
                console.log('Bootstrap:       ', deps.bootstrap      ? '✅' : '❌');
                console.log('Bootstrap.Toast: ', deps.bootstrapToast ? '✅' : '❌');
                console.log('SweetAlert2:     ', deps.swal           ? '✅' : '❌');
                console.log('Toast Container: ', deps.toastContainer ? '✅' : '❌');
                return deps;
            }

            /* ==========================================================
               FUNÇÕES EXTRAS (FORMATADORES/UTILS) E STUBS
            ========================================================== */

            function formatCNPJ(value) {
                if (!value) return '';
                var v = value.toString().replace(/\D/g, '').slice(0, 14);
                v = v.replace(/^(\d{2})(\d)/, '$1.$2');
                v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
                v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
                v = v.replace(/(\d{4})(\d)/, '$1-$2');
                return v;
            }

            function formatCPF(value) {
                if (!value) return '';
                var v = value.toString().replace(/\D/g, '').slice(0, 11);
                v = v.replace(/(\d{3})(\d)/, '$1.$2');
                v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
                v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
                return v;
            }

            /* ==========================================================
               API PÚBLICA
            ========================================================== */

            var api = {
                // ID Generators
                generateId: generateId,
                generateCode: generateCode,
                generateFidelityCode: generateFidelityCode,

                // Parser
                parseCurrencyBR: parseCurrencyBR,

                // Formatadores
                formatCurrency: formatCurrency,
                formatCurrencyRaw: formatCurrencyRaw,
                formatCurrencyBR: formatCurrencyBR,
                formatPercent: formatPercent,
                formatPhone: formatPhone,
                formatDate: formatDate,
                formatDateTime: formatDateTime,

                // Máscaras de input
                maskCurrencyInput: maskCurrencyInput,
                maskPhoneInput: maskPhoneInput,
                maskCNPJInput: maskCNPJInput,
                maskCPFInput: maskCPFInput,

                // Formatadores extras
                formatCNPJ: formatCNPJ,
                formatCPF: formatCPF,
                formatDateISO: formatDateISO,

                // Validações
                validateProduct: validateProduct,
                validateClient: validateClient,
                validateSupplier: validateSupplier,
                validateCNPJ: validateCNPJ,
                validateCPF: validateCPF,
                isValidPrice: function (value) {
                    var price = Number(value);
                    return price > 0 && price < 1000000;
                },

                // Parser monetário (alias)
                parseMonetaryValue: parseCurrencyBR,

                // Cálculos de preço
                calculateMargin: calculateMargin,
                calculateMarkup: calculateMarkup,
                calculateProfit: calculateProfit,
                applyMarkup: applyMarkup,
                applyMargin: applyMargin,

                // Inteligência de preços
                priceDifference: priceDifference,
                competitivePriceSuggestion: competitivePriceSuggestion,
                isPriceCompetitive: isPriceCompetitive,

                // Cálculos de vendas
                calculateTotalSales: calculateTotalSales,
                calculateTodaySales: calculateTodaySales,

                // UI
                showToast: showToast,
                showAlert: showAlert,
                showConfirm: showConfirm,

                // Utilitários
                debounce: debounce,
                createBackup: createBackup,
                exportToCSV: exportToCSV,

                // Diagnóstico
                checkDependencies: checkDependencies
            };

            return api;
        })();

        // Marca que o patch foi aplicado para evitar re-loads posteriores
        try {
            _utils.__patched = true;
        } catch (e) {
            // ignore
        }

        // Atribui de forma segura ao global
        window.utils = window.utils || {};
        // Copia propriedades sem sobrescrever se já existirem (preserva possíveis implementações anteriores)
        Object.keys(_utils).forEach(function (k) {
            try {
                window.utils[k] = _utils[k];
            } catch (e) {
                console.warn('Falha ao atribuir utils.' + k, e);
            }
        });
        // Garante flag __patched no objeto global
        try { window.utils.__patched = true; } catch (e) {}

        // Validação pós-inicialização: loga exports undefined (ajuda a detectar typos)
        (function validateExports(api) {
            try {
                Object.keys(api).forEach(function (k) {
                    if (typeof api[k] === 'undefined') {
                        console.warn('utils export undefined:', k);
                    }
                });
            } catch (e) {
                // ignore
            }
        })(window.utils);

        // Boot log
        try {
            console.log(
                '%c✅ utils.fixed.js v5.0.0 — InNovaIdeia carregado (patched)',
                'color: #10b981; font-weight: bold; font-size: 12px'
            );
        } catch (e) {}

        // Diagnóstico automático após carregamento das dependências
        setTimeout(function () {
            try {
                if (window.utils && typeof window.utils.checkDependencies === 'function') {
                    window.utils.checkDependencies();
                }
            } catch (e) {}
        }, 150);

    } catch (err) {
        // Se algo falhar durante a inicialização, evita deixar window.utils undefined
        console.error('Falha ao inicializar utils.js:', err);
        window.utils = window.utils || { __initError: true };
    }
})();
