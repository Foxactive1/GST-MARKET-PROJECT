/**
 * Utilitários — VERSÃO CORRIGIDA
 * CORREÇÃO: showToast() agora verifica se Bootstrap está disponível
 * ADICIONADO: parseMonetaryValue() e maskCurrencyInput() para manipulação de valores monetários
 * ADICIONADO: máscaras para CPF, CNPJ e telefone
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.1.0 CORRIGIDA
 * @date 2026-03-06
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

    /**
     * Converte string no formato brasileiro (1.234,56) para número float
     */
    function parseMonetaryValue(str) {
        if (!str) return 0;
        // Remove pontos de milhar e substitui vírgula decimal por ponto
        var cleaned = str.replace(/\./g, '').replace(',', '.');
        var num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Aplica máscara de moeda enquanto o usuário digita
     * Ex: 1234,56 -> 1.234,56
     */
    function maskCurrencyInput(value) {
        // Remove tudo que não for dígito
        var digits = value.replace(/\D/g, '');
        if (!digits) return '';
        
        // Converte para centavos (número inteiro)
        var number = parseInt(digits) / 100;
        
        // Formata como moeda brasileira
        return number.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * Máscara para CPF (000.000.000-00)
     */
    function maskCPFInput(value) {
        var digits = value.replace(/\D/g, '');
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
        if (digits.length <= 9) return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    /**
     * Máscara para CNPJ (00.000.000/0000-00)
     */
    function maskCNPJInput(value) {
        var digits = value.replace(/\D/g, '');
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
        if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
        if (digits.length <= 12) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
        return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    /**
     * Máscara para telefone (aplica formatação enquanto digita)
     */
    function maskPhoneInput(value) {
        var digits = value.replace(/\D/g, '');
        if (digits.length <= 2) return '(' + digits;
        if (digits.length <= 6) return '(' + digits.substr(0,2) + ') ' + digits.substr(2);
        if (digits.length <= 10) return '(' + digits.substr(0,2) + ') ' + digits.substr(2,4) + '-' + digits.substr(6);
        return '(' + digits.substr(0,2) + ') ' + digits.substr(2,5) + '-' + digits.substr(7);
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

    // ----- Toast (VERSÃO CORRIGIDA) -----
    /**
     * Exibe uma notificação toast
     * CORREÇÃO: Agora verifica se Bootstrap está disponível antes de usar
     * @param {string} message - Mensagem a exibir
     * @param {string} type - Tipo: success, danger, warning, info
     */
    function showToast(message, type) {
        // Log para debug
        console.log('[Toast]', type || 'info', ':', message);
        
        // VALIDAÇÃO 1: Container existe?
        var container = document.getElementById('toastContainer');
        if (!container) {
            console.warn('⚠️ toastContainer não encontrado no DOM. Usando alert como fallback.');
            alert(message);
            return;
        }
        
        // VALIDAÇÃO 2: Bootstrap está disponível?
        if (typeof bootstrap === 'undefined') {
            console.warn('⚠️ Bootstrap não está carregado. Usando alert como fallback.');
            alert(message);
            return;
        }
        
        // VALIDAÇÃO 3: Bootstrap.Toast existe?
        if (!bootstrap.Toast) {
            console.warn('⚠️ Bootstrap.Toast não está disponível. Usando alert como fallback.');
            alert(message);
            return;
        }
        
        // Tudo OK, cria o toast
        try {
            var toastId = 'toast-' + Date.now();
            var toast = document.createElement('div');
            toast.id = toastId;
            
            // Determina cor do toast
            var bgClass = 'bg-success';
            if (type === 'danger') bgClass = 'bg-danger';
            else if (type === 'warning') bgClass = 'bg-warning';
            else if (type === 'info') bgClass = 'bg-info';
            
            toast.className = 'toast align-items-center text-white ' + bgClass + ' border-0 fade-in';
            toast.setAttribute('role', 'alert');
            toast.setAttribute('aria-live', 'assertive');
            toast.setAttribute('aria-atomic', 'true');
            
            toast.innerHTML = 
                '<div class="d-flex">' +
                '<div class="toast-body">' + message + '</div>' +
                '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
                '</div>';
            
            container.appendChild(toast);
            
            // Cria e exibe o toast
            var bsToast = new bootstrap.Toast(toast, { 
                autohide: true, 
                delay: 3000 
            });
            bsToast.show();
            
            // Remove o toast após o tempo
            setTimeout(function() { 
                toast.remove(); 
            }, 3500);
            
        } catch (error) {
            console.error('❌ Erro ao criar toast:', error);
            console.error('Detalhes:', error.message);
            // Fallback em caso de erro
            alert(message);
        }
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
            console.warn('⚠️ SweetAlert2 não disponível, usando alert nativo');
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
            console.warn('⚠️ SweetAlert2 não disponível, usando confirm nativo');
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
        if (!data || data.length === 0) {
            showToast('Nenhum dado para exportar', 'warning');
            return;
        }
        var csvRows = [];
        // Extrai cabeçalhos
        var headers = Object.keys(data[0]);
        csvRows.push(headers.join(','));
        
        // Linhas
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var values = [];
            for (var key in row) {
                if (row.hasOwnProperty(key)) {
                    var value = row[key];
                    if (typeof value === 'string' && value.includes(',')) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    values.push(value);
                }
            }
            csvRows.push(values.join(','));
        }
        
        var csv = csvRows.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ----- Verificação de Dependências -----
    /**
     * NOVA FUNÇÃO: Verifica se todas as dependências estão carregadas
     * @returns {object} Status das dependências
     */
    function checkDependencies() {
        var deps = {
            bootstrap: typeof bootstrap !== 'undefined',
            bootstrapToast: typeof bootstrap !== 'undefined' && !!bootstrap.Toast,
            swal: typeof Swal !== 'undefined',
            toastContainer: !!document.getElementById('toastContainer')
        };
        
        console.log('=== Verificação de Dependências ===');
        console.log('Bootstrap:', deps.bootstrap ? '✅' : '❌');
        console.log('Bootstrap.Toast:', deps.bootstrapToast ? '✅' : '❌');
        console.log('SweetAlert2:', deps.swal ? '✅' : '❌');
        console.log('Toast Container:', deps.toastContainer ? '✅' : '❌');
        
        return deps;
    }

    // API pública
    return {
        generateId: generateId,
        generateFidelityCode: generateFidelityCode,
        formatCurrency: formatCurrency,
        formatDate: formatDate,
        formatPhone: formatPhone,
        parseMonetaryValue: parseMonetaryValue,
        maskCurrencyInput: maskCurrencyInput,
        maskCPFInput: maskCPFInput,
        maskCNPJInput: maskCNPJInput,
        maskPhoneInput: maskPhoneInput,
        validateProduct: validateProduct,
        validateClient: validateClient,
        showToast: showToast,
        showAlert: showAlert,
        showConfirm: showConfirm,
        createBackup: createBackup,
        debounce: debounce,
        calculateTotalSales: calculateTotalSales,
        calculateTodaySales: calculateTodaySales,
        exportToCSV: exportToCSV,
        checkDependencies: checkDependencies
    };
})();

// Verificação automática ao carregar
console.log('%c✅ utils.js v2.1.0 (CORRIGIDO) carregado com sucesso!', 'color: #10b981; font-weight: bold');

// Verifica dependências após um delay para dar tempo das bibliotecas carregarem
setTimeout(function() {
    if (window.utils && typeof window.utils.checkDependencies === 'function') {
        window.utils.checkDependencies();
    }
}, 100);