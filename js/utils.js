/**
 * Utilitários — VERSÃO SEM ERROS DE SINTAXE
 * Copie e cole este código exatamente como está.
 */
window.utils = (function() {
    'use strict';

    // ----- Geração de IDs -----
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

    // ----- Formatação -----
    function formatCurrency(value) {
        return parseFloat(value || 0).toFixed(2);
    }

    function formatDate(date, format) {
        if (!format) format = 'short';
        var d = new Date(date);
        if (format === 'short') {
            return d.toLocaleDateString('pt-BR');
        }
        return d.toLocaleString('pt-BR');
    }

    function formatPhone(phone) {
        if (!phone) return '';
        var cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    // ----- Validações -----
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

    function validateClient(client) {
        if (!client || !client.nome || client.nome.trim() === '') {
            alert('Nome do cliente é obrigatório');
            return false;
        }
        if (!client || !client.fone || client.fone.trim() === '') {
            alert('Telefone é obrigatório');
            return false;
        }
        return true;
    }

    // ----- Toast (fallback seguro) -----
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

    // ----- Alertas (Swal ou fallback) -----
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

    // ----- Backup -----
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

    // ----- Debounce -----
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

    // ----- Cálculos -----
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

    // ----- Exportação CSV -----
    function exportToCSV(data, filename) {
        var csvRows = [];
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var values = [];
            for (var key in row) {
                if (row.hasOwnProperty(key)) {
                    var value = row[key];
                    if (typeof value === 'string') {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    values.push(value);
                }
            }
            csvRows.push(values.join(','));
        }
        var csv = csvRows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // API pública
    return {
        generateId: generateId,
        generateFidelityCode: generateFidelityCode,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        formatPhone: formatPhone,
        validateProduct: validateProduct,
        validateClient: validateClient,
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