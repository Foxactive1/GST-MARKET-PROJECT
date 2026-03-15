/**
 * utils.js — v5.0.0
 * Utilitário unificado — Supermercado Pro / GST Market
 *
 * Histórico de versões:
 *   v2.0.0 — UI, toast, validação, backup, CSV, cálculos de vendas
 *   v4.0.0 — Engine financeira: parser monetário, margem, markup, inteligência de preços
 *   v5.0.0 — Merge completo. Toda função de v2 e v4 preservada.
 *             ⚠️ BREAKING CHANGE: formatCurrency() agora retorna pt-BR ("1,99")
 *             → Use formatCurrencyRaw() para obter o formato antigo ("1.99")
 *
 * @author Dione Castro Alves — InNovaIdeia
 * @version 5.0.0
 * @date 2026-03-15
 */

window.utils = (function () {
    'use strict';

    /* ==========================================================
       SEÇÃO 1 — ID GENERATORS
    ========================================================== */

    /**
     * Gera um ID único com prefixo opcional.
     * @param {string} [prefix="id"] — prefixo do ID
     * @returns {string} Ex: "id_1710000000000_4823"
     */
    function generateId(prefix) {
        prefix = prefix || 'id';
        return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    }

    /**
     * Gera um código alfanumérico aleatório de comprimento variável.
     * @param {number} [length=8] — quantidade de caracteres
     * @returns {string} Ex: "A3KZ91BT"
     */
    function generateCode(length) {
        length = length || 8;
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var code = '';
        for (var i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Gera um código de fidelidade com prefixo fixo "FID-".
     * @returns {string} Ex: "FID-3HK72A"
     */
    function generateFidelityCode() {
        return 'FID-' + generateCode(6);
    }

    /* ==========================================================
       SEÇÃO 2 — PARSER MONETÁRIO (BLINDADO)
    ========================================================== */

    /**
     * Converte string monetária brasileira em número float.
     * Suporta: "R$ 1.234,56" → 1234.56 | null/undefined → 0 | number → passthrough
     * @param {*} value
     * @returns {number}
     */
    function parseCurrencyBR(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        return Number(
            value
                .toString()
                .replace(/[^\d,.-]/g, '')  // remove R$, espaços, etc.
                .replace(/\./g, '')         // remove separador de milhar
                .replace(',', '.')          // troca vírgula decimal por ponto
        ) || 0;
    }

    /* ==========================================================
       SEÇÃO 3 — FORMATADORES
    ========================================================== */

    /**
     * Formata número no padrão pt-BR sem símbolo ("1.234,56").
     * ⚠️ v5.0: comportamento alterado de toFixed(2) para toLocaleString pt-BR.
     *    Use formatCurrencyRaw() para obter o formato antigo.
     * @param {number} value
     * @returns {string} Ex: "1.234,56"
     */
    function formatCurrency(value) {
        var number = Number(value) || 0;
        return number.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Formato legado de formatCurrency (v2.0.0).
     * Retorna string no padrão US com ponto decimal ("1234.56").
     * Útil para campos numéricos de input e cálculos internos.
     * @param {number} value
     * @returns {string} Ex: "1234.56"
     */
    function formatCurrencyRaw(value) {
        return parseFloat(value || 0).toFixed(2);
    }

    /**
     * Formata número com prefixo "R$ " no padrão pt-BR.
     * @param {number} value
     * @returns {string} Ex: "R$ 1.234,56"
     */
    function formatCurrencyBR(value) {
        var number = Number(value) || 0;
        return 'R$ ' + number.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Formata percentual com 2 casas decimais.
     * @param {number} value
     * @returns {string} Ex: "12.50%"
     */
    function formatPercent(value) {
        return Number(value || 0).toFixed(2) + '%';
    }

    /**
     * Formata número de telefone brasileiro (10 ou 11 dígitos).
     * @param {string} phone
     * @returns {string} Ex: "(16) 99999-9999"
     */
    function formatPhone(phone) {
        if (!phone) return '';
        var cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    /**
     * Formata data em pt-BR. Aceita formato 'short' (data) ou 'long' (data+hora).
     * @param {Date|string|number} date
     * @param {string} [format='short'] — 'short' | 'long'
     * @returns {string} Ex: "15/03/2026" ou "15/03/2026 14:30:00"
     */
    function formatDate(date, format) {
        var d = new Date(date);
        if (format === 'long') {
            return d.toLocaleString('pt-BR');
        }
        return d.toLocaleDateString('pt-BR');
    }

    /**
     * Formata data e hora completa em pt-BR.
     * Alias explícito de formatDate(date, 'long') para uso programático.
     * @param {Date|string|number} date
     * @returns {string} Ex: "15/03/2026 14:30:00"
     */
    function formatDateTime(date) {
        return new Date(date).toLocaleString('pt-BR');
    }

    /* ==========================================================
       SEÇÃO 4 — MÁSCARA MONETÁRIA
    ========================================================== */

    /**
     * Aplica máscara monetária pt-BR em tempo real a um elemento <input>.
     * Converte dígitos digitados para formato "1.234,56" automaticamente.
     * @param {HTMLInputElement} input — elemento de input DOM
     */
    function maskCurrencyInput(input) {
        input.addEventListener('input', function () {
            var value = input.value.replace(/\D/g, '');
            value = (Number(value) / 100).toFixed(2);
            value = value.replace('.', ',');
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            input.value = value;
        });
    }

    /* ==========================================================
       SEÇÃO 5 — VALIDAÇÕES
    ========================================================== */

    /**
     * Valida objeto de produto antes de salvar.
     * @param {object} product — { nome, qtd, preco }
     * @returns {boolean}
     */
    function validateProduct(product) {
        if (!product || !product.nome || product.nome.trim() === '') {
            alert('Nome do produto é obrigatório');
            return false;
        }
        if (product.qtd < 0) {
            alert('Quantidade não pode ser negativa');
            return false;
        }
        if (product.preco <= 0) {
            alert('Preço deve ser maior que zero');
            return false;
        }
        return true;
    }

    /**
     * Valida objeto de cliente antes de salvar.
     * @param {object} client — { nome, fone }
     * @returns {boolean}
     */
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

    /**
     * Verifica se um preço é válido (> 0 e < 1.000.000).
     * @param {number|string} value
     * @returns {boolean}
     */
    function isValidPrice(value) {
        var price = Number(value);
        return price > 0 && price < 1000000;
    }

    /* ==========================================================
       SEÇÃO 6 — CÁLCULOS DE PREÇO / MARGEM / MARKUP
    ========================================================== */

    /**
     * Calcula margem percentual sobre o preço de venda.
     * Fórmula: ((venda - custo) / venda) * 100
     * @param {number} cost — custo do produto
     * @param {number} sale — preço de venda
     * @returns {number} margem em %
     */
    function calculateMargin(cost, sale) {
        cost = Number(cost) || 0;
        sale = Number(sale) || 0;
        if (sale === 0) return 0;
        return ((sale - cost) / sale) * 100;
    }

    /**
     * Calcula markup percentual sobre o custo.
     * Fórmula: ((venda - custo) / custo) * 100
     * @param {number} cost — custo do produto
     * @param {number} sale — preço de venda
     * @returns {number} markup em %
     */
    function calculateMarkup(cost, sale) {
        cost = Number(cost) || 0;
        sale = Number(sale) || 0;
        if (cost === 0) return 0;
        return ((sale - cost) / cost) * 100;
    }

    /**
     * Calcula lucro bruto absoluto.
     * @param {number} cost
     * @param {number} sale
     * @returns {number} lucro em R$
     */
    function calculateProfit(cost, sale) {
        cost = Number(cost) || 0;
        sale = Number(sale) || 0;
        return sale - cost;
    }

    /**
     * Aplica markup percentual sobre o custo para obter preço de venda.
     * @param {number} cost
     * @param {number} markup — percentual ex: 30 = 30%
     * @returns {number} preço sugerido
     */
    function applyMarkup(cost, markup) {
        cost = Number(cost) || 0;
        markup = Number(markup) || 0;
        return cost + (cost * markup / 100);
    }

    /**
     * Calcula preço de venda a partir de custo e margem desejada.
     * Fórmula: custo / (1 - margem/100)
     * @param {number} cost
     * @param {number} margin — percentual ex: 40 = 40%
     * @returns {number} preço sugerido
     */
    function applyMargin(cost, margin) {
        cost = Number(cost) || 0;
        margin = Number(margin) || 0;
        if (margin >= 100) return 0; // margem inválida
        return cost / (1 - margin / 100);
    }

    /* ==========================================================
       SEÇÃO 7 — ENGINE DE COMPARAÇÃO DE PREÇOS
    ========================================================== */

    /**
     * Calcula diferença absoluta e percentual entre dois preços.
     * @param {number} priceA — preço de referência
     * @param {number} priceB — preço base de comparação
     * @returns {{ difference: number, percent: number }}
     */
    function priceDifference(priceA, priceB) {
        priceA = Number(priceA) || 0;
        priceB = Number(priceB) || 0;
        var diff = priceA - priceB;
        var percent = priceB === 0 ? 0 : (diff / priceB) * 100;
        return { difference: diff, percent: percent };
    }

    /**
     * Sugere preço competitivo baseado na média dos concorrentes (2% abaixo).
     * @param {number} myPrice — preço atual do produto
     * @param {number[]} [competitorPrices=[]] — array de preços dos concorrentes
     * @returns {{ suggestion: number, avg: number, min: number, max: number }}
     */
    function competitivePriceSuggestion(myPrice, competitorPrices) {
        competitorPrices = competitorPrices || [];
        var valid = competitorPrices.map(Number).filter(function (v) { return v > 0; });

        if (valid.length === 0) {
            return { suggestion: myPrice, avg: myPrice, min: myPrice, max: myPrice };
        }

        var avg = valid.reduce(function (a, b) { return a + b; }, 0) / valid.length;
        var min = Math.min.apply(null, valid);
        var max = Math.max.apply(null, valid);
        var suggestion = avg * 0.98; // 2% abaixo da média de mercado

        return { suggestion: suggestion, avg: avg, min: min, max: max };
    }

    /**
     * Verifica se o preço está competitivo (até 5% acima da média de mercado).
     * @param {number} myPrice
     * @param {number} marketAvg — média de mercado
     * @returns {boolean}
     */
    function isPriceCompetitive(myPrice, marketAvg) {
        if (!marketAvg) return false;
        var diff = ((myPrice - marketAvg) / marketAvg) * 100;
        return diff <= 5;
    }

    /* ==========================================================
       SEÇÃO 8 — CÁLCULOS DE VENDAS
    ========================================================== */

    /**
     * Soma o total de um array de vendas.
     * @param {Array<{total: number}>} sales
     * @returns {number}
     */
    function calculateTotalSales(sales) {
        var total = 0;
        for (var i = 0; i < sales.length; i++) {
            total += sales[i].total || 0;
        }
        return total;
    }

    /**
     * Soma apenas as vendas realizadas no dia atual.
     * @param {Array<{total: number, date: string|Date}>} sales
     * @returns {number}
     */
    function calculateTodaySales(sales) {
        var today = new Date().toDateString();
        var total = 0;
        for (var i = 0; i < sales.length; i++) {
            if (new Date(sales[i].date).toDateString() === today) {
                total += sales[i].total || 0;
            }
        }
        return total;
    }

    /* ==========================================================
       SEÇÃO 9 — UI: TOAST / ALERT / CONFIRM
    ========================================================== */

    /**
     * Exibe notificação toast (Bootstrap 5).
     * Fallback para alert() se Bootstrap ou container não estiver disponível.
     * @param {string} message — texto da notificação
     * @param {string} [type='success'] — 'success' | 'danger' | 'warning' | 'info'
     */
    function showToast(message, type) {
        console.log('[Toast]', type || 'info', ':', message);

        var container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('⚠️ toastContainer não encontrado. Usando alert.');
            alert(message);
            return;
        }

        if (typeof bootstrap === 'undefined' || !bootstrap.Toast) {
            console.warn('⚠️ Bootstrap.Toast não disponível. Usando alert.');
            alert(message);
            return;
        }

        try {
            var bgClass = 'bg-success';
            if (type === 'danger')  bgClass = 'bg-danger';
            if (type === 'warning') bgClass = 'bg-warning';
            if (type === 'info')    bgClass = 'bg-info';

            var toast = document.createElement('div');
            toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            toast.innerHTML =
                '<div class="d-flex">' +
                '<div class="toast-body">' + message + '</div>' +
                '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>' +
                '</div>';

            container.appendChild(toast);

            var bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 3000 });
            bsToast.show();

            setTimeout(function () { toast.remove(); }, 3500);

        } catch (err) {
            console.error('❌ Erro ao criar toast:', err.message);
            alert(message);
        }
    }

    /**
     * Exibe alerta modal (SweetAlert2 se disponível, alert() como fallback).
     * @param {string} title
     * @param {string} [icon='info'] — 'success' | 'error' | 'warning' | 'info' | 'question'
     * @param {string} [text]
     * @returns {Promise}
     */
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
        alert(title + (text ? ': ' + text : ''));
        return Promise.resolve({ isConfirmed: true });
    }

    /**
     * Exibe diálogo de confirmação (SweetAlert2 se disponível, confirm() como fallback).
     * @param {string} title
     * @param {string} [text]
     * @param {string} [confirmText='Confirmar']
     * @returns {Promise<{isConfirmed: boolean}>}
     */
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
        var result = confirm(title + (text ? '\n' + text : ''));
        return Promise.resolve({ isConfirmed: result });
    }

    /* ==========================================================
       SEÇÃO 10 — UTILIDADES GERAIS
    ========================================================== */

    /**
     * Retorna uma versão com debounce de uma função.
     * Útil para eventos de input que disparam pesquisas ou filtros.
     * @param {Function} func — função a limitar
     * @param {number} wait — delay em ms
     * @returns {Function}
     */
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

    /**
     * Gera backup completo do state do sistema e inicia download em .json.
     * Depende de window.state.get() estar disponível.
     */
    function createBackup() {
        try {
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
            alert('Erro ao criar backup.');
        }
    }

    /**
     * Exporta array de objetos para arquivo CSV e inicia download.
     * @param {object[]} data — array de objetos com as mesmas chaves
     * @param {string} filename — nome do arquivo com extensão .csv
     */
    function exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            console.warn('⚠️ exportToCSV: nenhum dado para exportar.');
            return;
        }

        var csvRows = [];

        // Header
        var headers = Object.keys(data[0]);
        csvRows.push(headers.join(','));

        // Rows
        for (var i = 0; i < data.length; i++) {
            var values = headers.map(function (key) {
                var value = data[i][key];
                if (typeof value === 'string') {
                    return '"' + value.replace(/"/g, '""') + '"';
                }
                return value !== undefined && value !== null ? value : '';
            });
            csvRows.push(values.join(','));
        }

        var csv = '\uFEFF' + csvRows.join('\n'); // BOM para Excel reconhecer UTF-8
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* ==========================================================
       SEÇÃO 11 — DIAGNÓSTICO DE DEPENDÊNCIAS
    ========================================================== */

    /**
     * Verifica e loga o status das dependências externas do sistema.
     * @returns {{ bootstrap: boolean, bootstrapToast: boolean, swal: boolean, toastContainer: boolean }}
     */
    function checkDependencies() {
        var deps = {
            bootstrap:      typeof bootstrap !== 'undefined',
            bootstrapToast: typeof bootstrap !== 'undefined' && !!bootstrap.Toast,
            swal:           typeof Swal !== 'undefined',
            toastContainer: !!document.getElementById('toastContainer')
        };

        console.log('%c=== utils.js v5.0 — Dependências ===', 'color: #6366f1; font-weight: bold');
        console.log('Bootstrap:       ', deps.bootstrap      ? '✅' : '❌');
        console.log('Bootstrap.Toast: ', deps.bootstrapToast ? '✅' : '❌');
        console.log('SweetAlert2:     ', deps.swal           ? '✅' : '❌');
        console.log('Toast Container: ', deps.toastContainer ? '✅' : '❌');

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

        // Formatadores
        formatCurrency,       // ⚠️ v5.0: agora retorna pt-BR "1.234,56"
        formatCurrencyRaw,    // legado v2: retorna "1234.56" (toFixed)
        formatCurrencyBR,     // retorna "R$ 1.234,56"
        formatPercent,
        formatPhone,
        formatDate,
        formatDateTime,

        // Máscara
        maskCurrencyInput,

        // Validações
        validateProduct,
        validateClient,
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

// ── Boot log ──────────────────────────────────────────────────────────────────
console.log(
    '%c✅ utils.js v5.0.0 — InNovaIdeia carregado',
    'color: #10b981; font-weight: bold; font-size: 12px'
);

// Diagnóstico automático após carregamento das dependências
setTimeout(function () {
    if (window.utils && typeof window.utils.checkDependencies === 'function') {
        window.utils.checkDependencies();
    }
}, 150);
