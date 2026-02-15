/**
 * Utilitários — Versão Aprimorada
 * Inclui funções de formatação, validação, máscaras, parsing monetário e mais.
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.0.0
 */
window.utils = (function() {
    'use strict';

    // ========================================
    // GERAÇÃO DE IDs E CÓDIGOS
    // ========================================

    function generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function generateFidelityCode() {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var code = 'FID-';
        for (var i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // ========================================
    // FORMATAÇÃO
    // ========================================

    /**
     * Formata um valor numérico como moeda brasileira (R$)
     * @param {number} value - Valor a ser formatado
     * @returns {string} Valor formatado (ex: "1.234,56")
     */
    function formatCurrency(value) {
        if (value === null || value === undefined || isNaN(value)) value = 0;
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /**
     * Formata uma data no padrão brasileiro
     * @param {string|Date} date - Data a ser formatada
     * @param {string} format - 'short' (dd/mm/aaaa) ou 'long' (dd/mm/aaaa hh:mm)
     * @returns {string} Data formatada
     */
    function formatDate(date, format) {
        if (!date) return '';
        var d = new Date(date);
        if (isNaN(d.getTime())) return '';
        if (!format) format = 'short';
        if (format === 'short') {
            return d.toLocaleDateString('pt-BR');
        }
        return d.toLocaleString('pt-BR');
    }

    /**
     * Formata número de telefone brasileiro
     * @param {string} phone - Telefone (pode conter caracteres não numéricos)
     * @returns {string} Telefone formatado (ex: (11) 99999-9999)
     */
    function formatPhone(phone) {
        if (!phone) return '';
        var cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return phone; // retorna original se não conseguir formatar
    }

    /**
     * Formata CPF (000.000.000-00)
     * @param {string} cpf - CPF (apenas números)
     * @returns {string} CPF formatado
     */
    function formatCPF(cpf) {
        if (!cpf) return '';
        var cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return cpf;
    }

    // ========================================
    // PARSING DE VALORES MONETÁRIOS (string para número)
    // ========================================

    /**
     * Converte uma string monetária (ex: "12,34" ou "12.34") para número.
     * Remove símbolos de moeda e espaços, troca vírgula por ponto e lida com separadores de milhar.
     * @param {string|number} value - Valor a ser convertido
     * @returns {number} Valor numérico ou NaN se inválido
     */
    function parseMonetaryValue(value) {
        if (typeof value === 'number') return value;
        if (!value) return NaN;

        // Remove tudo que não for dígito, ponto, vírgula ou sinal negativo
        var cleaned = value.toString().replace(/[^\d,.-]/g, '');

        // Se tiver vírgula e ponto, decide qual é o decimal
        var hasComma = cleaned.includes(',');
        var hasDot = cleaned.includes('.');

        if (hasComma && hasDot) {
            // Se ambos existem, provavelmente o último é decimal
            var lastComma = cleaned.lastIndexOf(',');
            var lastDot = cleaned.lastIndexOf('.');
            if (lastComma > lastDot) {
                // Última vírgula é decimal: troca por ponto e remove pontos
                cleaned = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                // Último ponto é decimal: remove vírgulas
                cleaned = cleaned.replace(/,/g, '');
            }
        } else if (hasComma) {
            // Só vírgula: substitui por ponto
            cleaned = cleaned.replace(',', '.');
        } else if (hasDot) {
            // Só ponto: já está no formato americano, mas pode ter múltiplos pontos (milhar)
            // Se houver mais de um ponto, o último é decimal
            var parts = cleaned.split('.');
            if (parts.length > 2) {
                // Ex: 1.234.56 -> remove pontos exceto o último
                var last = parts.pop();
                cleaned = parts.join('') + '.' + last;
            }
        }

        var number = parseFloat(cleaned);
        return isNaN(number) ? NaN : number;
    }

    // ========================================
    // VALIDAÇÕES (retornam boolean, sem alertas)
    // ========================================

    function validateProduct(product) {
        if (!product) return false;
        if (!product.nome || product.nome.trim() === '') return false;
        if (product.qtd < 0) return false;
        if (product.preco <= 0) return false;
        return true;
    }

    function validateClient(client) {
        if (!client) return false;
        if (!client.nome || client.nome.trim() === '') return false;
        if (!client.fone || client.fone.trim() === '') return false;
        // CPF é opcional, mas se informado, deve ter 11 dígitos? (opcional)
        return true;
    }

    // ========================================
    // MÁSCARAS PARA INPUTS (úteis em modais)
    // ========================================

    /**
     * Aplica máscara de telefone enquanto o usuário digita.
     * Uso: input.addEventListener('input', (e) => e.target.value = maskPhoneInput(e.target.value));
     */
    function maskPhoneInput(value) {
        var cleaned = value.replace(/\D/g, '');
        if (cleaned.length <= 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
        } else {
            return cleaned.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
        }
    }

    /**
     * Aplica máscara de CPF enquanto o usuário digita.
     */
    function maskCPFInput(value) {
        var cleaned = value.replace(/\D/g, '');
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, '$1.$2.$3-$4').replace(/\.$/, '').replace(/-$/, '');
    }

    /**
     * Aplica máscara de moeda enquanto o usuário digita (formato brasileiro).
     * Ex: 1234 => "12,34" (depende da implementação)
     * Nota: É mais simples usar o parseMonetaryValue no final; essa função é para exibição.
     */
    function maskCurrencyInput(value) {
        var cleaned = value.replace(/\D/g, '');
        if (cleaned === '') return '';
        var number = parseInt(cleaned) / 100;
        return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ========================================
    // TOAST E ALERTAS (já existentes, mantidos)
    // ========================================

    function showToast(message, type) {
        var container = document.getElementById('toastContainer');
        if (!container) {
            alert(message);
            return;
        }
        var toastId = 'toast-' + Date.now();
        var toast = document.createElement('div');
        toast.id = toastId;
        var bgClass = 'bg-success';
        if (type === 'danger') bgClass = 'bg-danger';
        else if (type === 'warning') bgClass = 'bg-warning';
        else if (type === 'info') bgClass = 'bg-info';
        toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0 fade-in';
        toast.setAttribute('role', 'alert');
        toast.innerHTML = 
            '<div class="d-flex">' +
            '<div class="toast-body">' + message + '</div>' +
            '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
            '</div>';
        container.appendChild(toast);
        var bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 3000 });
        bsToast.show();
        setTimeout(function() { toast.remove(); }, 3500);
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
        } else {
            alert(title + (text ? ': ' + text : ''));
            return Promise.resolve({ isConfirmed: true });
        }
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
        } else {
            var result = confirm(title + (text ? '\n' + text : ''));
            return Promise.resolve({ isConfirmed: result });
        }
    }

    // ========================================
    // BACKUP
    // ========================================

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
        } catch (e) {
            console.error('Erro ao criar backup:', e);
            alert('Erro ao criar backup.');
        }
    }

    // ========================================
    // DEBOUNCE
    // ========================================

    function debounce(func, wait) {
        var timeout;
        return function() {
            var args = arguments;
            var later = function() {
                timeout = null;
                func.apply(null, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ========================================
    // CÁLCULOS AUXILIARES (podem ser expandidos)
    // ========================================

    function calculateTotalSales(sales) {
        var total = 0;
        for (var i = 0; i < sales.length; i++) {
            total += sales[i].total || 0;
        }
        return total;
    }

    function calculateTodaySales(sales) {
        var today = new Date().toDateString();
        var total = 0;
        for (var i = 0; i < sales.length; i++) {
            var saleDate = new Date(sales[i].date).toDateString();
            if (saleDate === today) {
                total += sales[i].total || 0;
            }
        }
        return total;
    }

    // ========================================
    // EXPORTAÇÃO CSV
    // ========================================

    function exportToCSV(data, filename) {
        if (!data || data.length === 0) {
            showToast('Nenhum dado para exportar', 'warning');
            return;
        }
        var csvRows = [];
        // cabeçalho
        var headers = Object.keys(data[0]);
        csvRows.push(headers.join(','));
        // linhas
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var values = headers.map(function(header) {
                var value = row[header] || '';
                if (typeof value === 'string') {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csvRows.push(values.join(','));
        }
        var csv = csvRows.join('\n');
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM para acentos
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ========================================
    // API PÚBLICA
    // ========================================

    return {
        generateId: generateId,
        generateFidelityCode: generateFidelityCode,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        formatPhone: formatPhone,
        formatCPF: formatCPF,
        parseMonetaryValue: parseMonetaryValue,
        validateProduct: validateProduct,
        validateClient: validateClient,
        maskPhoneInput: maskPhoneInput,
        maskCPFInput: maskCPFInput,
        maskCurrencyInput: maskCurrencyInput,
        showToast: showToast,
        showAlert: showAlert,
        showConfirm: showConfirm,
        createBackup: createBackup,
        debounce: debounce,
        calculateTotalSales: calculateTotalSales,
        calculateTodaySales: calculateTodaySales,
        exportToCSV: exportToCSV
    };
})();