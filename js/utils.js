/**
 * utils.js — v5.1.0
 * Utilitário unificado — Supermercado Pro / GST Market
 *
 * v5.0.0 — Merge completo de v2 + v4
 * v5.1.0 — Adicionadas implementações faltantes:
 *           maskPhoneInput, maskCNPJInput, maskCPFInput,
 *           formatCNPJ, formatCPF, formatDateISO,
 *           validateSupplier, validateCNPJ, validateCPF
 *
 * @author Dione Castro Alves — InNovaIdeia
 * @version 5.1.0
 */

window.utils = (function () {
    'use strict';

    /* ==========================================================
       SEÇÃO 1 — ID GENERATORS
    ========================================================== */

    function generateId(prefix) {
        prefix = prefix || 'id';
        return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    }

    function generateCode(length) {
        length = length || 8;
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var code = '';
        for (var i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function generateFidelityCode() {
        return 'FID-' + generateCode(6);
    }

    /* ==========================================================
       SEÇÃO 2 — PARSER MONETÁRIO
    ========================================================== */

    function parseCurrencyBR(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        return Number(
            value
                .toString()
                .replace(/[^\d,.-]/g, '')
                .replace(/\./g, '')
                .replace(',', '.')
        ) || 0;
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
        return parseFloat(value || 0).toFixed(2);
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
        var cleaned = String(phone).replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return phone;
    }

    /**
     * Formata CNPJ: "00000000000000" → "00.000.000/0000-00"
     */
    function formatCNPJ(cnpj) {
        if (!cnpj) return '';
        var c = String(cnpj).replace(/\D/g, '');
        if (c.length !== 14) return cnpj;
        return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    /**
     * Formata CPF: "00000000000" → "000.000.000-00"
     */
    function formatCPF(cpf) {
        if (!cpf) return '';
        var c = String(cpf).replace(/\D/g, '');
        if (c.length !== 11) return cpf;
        return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    function formatDate(date, format) {
        if (!date) return '';
        var d = new Date(date);
        if (isNaN(d.getTime())) return String(date);
        if (format === 'long') return d.toLocaleString('pt-BR');
        return d.toLocaleDateString('pt-BR');
    }

    function formatDateTime(date) {
        return formatDate(date, 'long');
    }

    /**
     * Retorna data no formato "YYYY-MM-DD" para campos <input type="date">.
     */
    function formatDateISO(date) {
        if (!date) return '';
        var d = new Date(date);
        if (isNaN(d.getTime())) return '';
        var year  = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day   = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    /* ==========================================================
       SEÇÃO 4 — MÁSCARAS DE INPUT
    ========================================================== */

    /**
     * Máscara monetária pt-BR em tempo real.
     * Uso: maskCurrencyInput(inputElement)
     */
    function maskCurrencyInput(input) {
        if (!input) return;
        input.addEventListener('input', function () {
            var value = input.value.replace(/\D/g, '');
            value = (Number(value) / 100).toFixed(2);
            value = value.replace('.', ',');
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            input.value = value;
        });
    }

    /**
     * Máscara de telefone: (00) 00000-0000 ou (00) 0000-0000
     * Uso: maskPhoneInput(inputElement)  OU  oninput="window.utils.maskPhoneInput(this)"
     */
    function maskPhoneInput(input) {
        if (!input) return;
        function apply(el) {
            var v = el.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 10) {
                el.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
            } else if (v.length > 6) {
                el.value = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else if (v.length > 2) {
                el.value = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            } else {
                el.value = v.length ? '(' + v : v;
            }
        }
        // Suporte a dois modos: handler direto (this) ou listener
        if (input.tagName === 'INPUT') {
            apply(input);
            input.addEventListener('input', function () { apply(input); });
        }
    }

    /**
     * Máscara de CNPJ: 00.000.000/0000-00
     * Uso: maskCNPJInput(inputElement)  OU  oninput="window.utils.maskCNPJInput(this)"
     */
    function maskCNPJInput(input) {
        if (!input) return;
        function apply(el) {
            var v = el.value.replace(/\D/g, '').slice(0, 14);
            if (v.length > 12) {
                el.value = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, '$1.$2.$3/$4-$5');
            } else if (v.length > 8) {
                el.value = v.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, '$1.$2.$3/$4');
            } else if (v.length > 5) {
                el.value = v.replace(/(\d{2})(\d{3})(\d{0,3})/, '$1.$2.$3');
            } else if (v.length > 2) {
                el.value = v.replace(/(\d{2})(\d{0,3})/, '$1.$2');
            } else {
                el.value = v;
            }
        }
        if (input.tagName === 'INPUT') {
            apply(input);
            input.addEventListener('input', function () { apply(input); });
        }
    }

    /**
     * Máscara de CPF: 000.000.000-00
     * Uso: maskCPFInput(inputElement)  OU  oninput="window.utils.maskCPFInput(this)"
     */
    function maskCPFInput(input) {
        if (!input) return;
        function apply(el) {
            var v = el.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 9) {
                el.value = v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4');
            } else if (v.length > 6) {
                el.value = v.replace(/(\d{3})(\d{3})(\d{0,3})/, '$1.$2.$3');
            } else if (v.length > 3) {
                el.value = v.replace(/(\d{3})(\d{0,3})/, '$1.$2');
            } else {
                el.value = v;
            }
        }
        if (input.tagName === 'INPUT') {
            apply(input);
            input.addEventListener('input', function () { apply(input); });
        }
    }

    /* ==========================================================
       SEÇÃO 5 — VALIDAÇÕES
    ========================================================== */

    function validateProduct(product) {
        if (!product || !product.nome || product.nome.trim() === '') {
            alert('Nome do produto é obrigatório');
            return false;
        }
        if ((product.qtd || 0) < 0) {
            alert('Quantidade não pode ser negativa');
            return false;
        }
        if ((product.preco || 0) <= 0) {
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
        return true;
    }

    /**
     * Valida fornecedor — nome obrigatório.
     */
    function validateSupplier(supplier) {
        if (!supplier || !supplier.nome || supplier.nome.trim() === '') {
            alert('Nome/Razão social do fornecedor é obrigatório');
            return false;
        }
        return true;
    }

    /**
     * Valida dígitos verificadores do CNPJ.
     * @param {string} cnpj
     * @returns {boolean}
     */
    function validateCNPJ(cnpj) {
        if (!cnpj) return false;
        var c = String(cnpj).replace(/\D/g, '');
        if (c.length !== 14) return false;
        if (/^(\d)\1+$/.test(c)) return false; // todos iguais

        function calc(str, n) {
            var sum = 0;
            var weights = [];
            for (var i = n; i >= 2; i--) weights.push(i);
            for (var i = 0; i < str.length; i++) {
                sum += parseInt(str[i]) * weights[i % (n - 1)];
            }
            var rest = sum % 11;
            return rest < 2 ? 0 : 11 - rest;
        }

        var d1 = calc(c.slice(0, 12), 5);
        var d2 = calc(c.slice(0, 13), 6);
        return parseInt(c[12]) === d1 && parseInt(c[13]) === d2;
    }

    /**
     * Valida dígitos verificadores do CPF.
     * @param {string} cpf
     * @returns {boolean}
     */
    function validateCPF(cpf) {
        if (!cpf) return false;
        var c = String(cpf).replace(/\D/g, '');
        if (c.length !== 11) return false;
        if (/^(\d)\1+$/.test(c)) return false; // todos iguais

        function calcDig(base, pos) {
            var sum = 0;
            for (var i = 0; i < pos; i++) {
                sum += parseInt(base[i]) * (pos + 1 - i);
            }
            var rest = (sum * 10) % 11;
            return rest >= 10 ? 0 : rest;
        }

        var d1 = calcDig(c, 9);
        var d2 = calcDig(c, 10);
        return parseInt(c[9]) === d1 && parseInt(c[10]) === d2;
    }

    function isValidPrice(value) {
        var price = Number(value);
        return price > 0 && price < 1000000;
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
        return (Number(sale) || 0) - (Number(cost) || 0);
    }

    function applyMarkup(cost, markup) {
        cost   = Number(cost)   || 0;
        markup = Number(markup) || 0;
        return cost + (cost * markup / 100);
    }

    function applyMargin(cost, margin) {
        cost   = Number(cost)   || 0;
        margin = Number(margin) || 0;
        if (margin >= 100) return 0;
        return cost / (1 - margin / 100);
    }

    /* ==========================================================
       SEÇÃO 7 — ENGINE DE COMPARAÇÃO DE PREÇOS
    ========================================================== */

    function priceDifference(priceA, priceB) {
        priceA = Number(priceA) || 0;
        priceB = Number(priceB) || 0;
        var diff    = priceA - priceB;
        var percent = priceB === 0 ? 0 : (diff / priceB) * 100;
        return { difference: diff, percent: percent };
    }

    function competitivePriceSuggestion(myPrice, competitorPrices) {
        competitorPrices = competitorPrices || [];
        var valid = competitorPrices.map(Number).filter(function (v) { return v > 0; });
        if (valid.length === 0) {
            return { suggestion: myPrice, avg: myPrice, min: myPrice, max: myPrice };
        }
        var avg        = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
        var min        = Math.min.apply(null, valid);
        var max        = Math.max.apply(null, valid);
        var suggestion = avg * 0.98;
        return { suggestion: suggestion, avg: avg, min: min, max: max };
    }

    function isPriceCompetitive(myPrice, marketAvg) {
        if (!marketAvg) return false;
        return ((myPrice - marketAvg) / marketAvg) * 100 <= 5;
    }

    /* ==========================================================
       SEÇÃO 8 — CÁLCULOS DE VENDAS
    ========================================================== */

    function calculateTotalSales(sales) {
        var total = 0;
        for (var i = 0; i < sales.length; i++) total += sales[i].total || 0;
        return total;
    }

    function calculateTodaySales(sales) {
        var today = new Date().toDateString();
        var total = 0;
        for (var i = 0; i < sales.length; i++) {
            if (new Date(sales[i].date).toDateString() === today) total += sales[i].total || 0;
        }
        return total;
    }

    /* ==========================================================
       SEÇÃO 9 — UI: TOAST / ALERT / CONFIRM
    ========================================================== */

    function showToast(message, type) {
        console.log('[Toast]', type || 'info', ':', message);
        var container = document.getElementById('toastContainer');
        if (!container || typeof bootstrap === 'undefined' || !bootstrap.Toast) {
            alert(message);
            return;
        }
        try {
            var bgClass = { danger:'bg-danger', warning:'bg-warning', info:'bg-info' }[type] || 'bg-success';
            var toast = document.createElement('div');
            toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML =
                '<div class="d-flex">' +
                '<div class="toast-body">' + message + '</div>' +
                '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
                '</div>';
            container.appendChild(toast);
            new bootstrap.Toast(toast, { autohide: true, delay: 3000 }).show();
            setTimeout(function () { toast.remove(); }, 3500);
        } catch (err) { alert(message); }
    }

    function showAlert(title, icon, text) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire({ title: title, text: text || '', icon: icon || 'info',
                               confirmButtonColor: '#10b981', confirmButtonText: 'OK' });
        }
        alert(title + (text ? ': ' + text : ''));
        return Promise.resolve({ isConfirmed: true });
    }

    function showConfirm(title, text, confirmText) {
        if (typeof Swal !== 'undefined') {
            return Swal.fire({ title: title, text: text || '', icon: 'question',
                               showCancelButton: true, confirmButtonColor: '#10b981',
                               cancelButtonColor: '#6b7280',
                               confirmButtonText: confirmText || 'Confirmar',
                               cancelButtonText: 'Cancelar' });
        }
        var result = confirm(title + (text ? '\n' + text : ''));
        return Promise.resolve({ isConfirmed: result });
    }

    /* ==========================================================
       SEÇÃO 10 — UTILIDADES GERAIS
    ========================================================== */

    function debounce(func, wait) {
        var timeout;
        return function () {
            var args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                timeout = null;
                func.apply(null, args);
            }, wait);
        };
    }

    function createBackup() {
        try {
            var data = JSON.stringify(window.state ? window.state.get() : {}, null, 2);
            var blob = new Blob([data], { type: 'application/json' });
            var url  = URL.createObjectURL(blob);
            var a    = document.createElement('a');
            a.href = url;
            a.download = 'backup-supermercado-' + new Date().toISOString().split('T')[0] + '.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Backup criado com sucesso!', 'success');
        } catch (err) { alert('Erro ao criar backup.'); }
    }

    function exportToCSV(data, filename) {
        if (!data || data.length === 0) return;
        var headers = Object.keys(data[0]);
        var rows    = [headers.join(',')];
        for (var i = 0; i < data.length; i++) {
            var values = headers.map(function (k) {
                var v = data[i][k];
                return typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : (v != null ? v : '');
            });
            rows.push(values.join(','));
        }
        var blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ==========================================================
       SEÇÃO 11 — DIAGNÓSTICO
    ========================================================== */

    function checkDependencies() {
        var deps = {
            bootstrap:      typeof bootstrap !== 'undefined',
            bootstrapToast: typeof bootstrap !== 'undefined' && !!bootstrap.Toast,
            swal:           typeof Swal      !== 'undefined',
            toastContainer: !!document.getElementById('toastContainer'),
            state:          typeof window.state !== 'undefined'
        };
        console.log('%c=== utils.js v5.1 — Dependências ===', 'color:#6366f1;font-weight:bold');
        Object.entries(deps).forEach(function (e) {
            console.log(e[0] + ':', e[1] ? '✅' : '❌');
        });
        return deps;
    }

    /* ==========================================================
       API PÚBLICA
    ========================================================== */

    return {
        // ID Generators
        generateId,
        generateCode,
        generateFidelityCode,

        // Parser
        parseCurrencyBR,
        parseMonetaryValue: parseCurrencyBR,   // alias para modals.js

        // Formatadores
        formatCurrency,
        formatCurrencyRaw,
        formatCurrencyBR,
        formatPercent,
        formatPhone,
        formatCNPJ,
        formatCPF,
        formatDate,
        formatDateTime,
        formatDateISO,

        // Máscaras de input
        maskCurrencyInput,
        maskPhoneInput,
        maskCNPJInput,
        maskCPFInput,

        // Validações
        validateProduct,
        validateClient,
        validateSupplier,
        validateCNPJ,
        validateCPF,
        isValidPrice,

        // Cálculos de preço
        calculateMargin,
        calculateMarkup,
        calculateProfit,
        applyMarkup,
        applyMargin,

        // Inteligência de preços
        priceDifference,
        competitivePriceSuggestion,
        isPriceCompetitive,

        // Cálculos de vendas
        calculateTotalSales,
        calculateTodaySales,

        // UI
        showToast,
        showAlert,
        showConfirm,

        // Utilitários
        debounce,
        createBackup,
        exportToCSV,

        // Diagnóstico
        checkDependencies
    };

})();

console.log(
    '%c✅ utils.js v5.1.0 — InNovaIdeia carregado',
    'color:#10b981;font-weight:bold;font-size:12px'
);

setTimeout(function () {
    if (window.utils && typeof window.utils.checkDependencies === 'function') {
        window.utils.checkDependencies();
    }
}, 150);
