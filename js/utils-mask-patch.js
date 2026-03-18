/**
 * utils-mask-patch.js — v3
 *
 * Problema raiz: dois arquivos utils coexistem no projeto.
 *   - js/utils.js          (v5.0) — tem formatCNPJ, formatCurrencyBR, parseCurrencyBR etc.
 *   - js/modules/utils.js  (v2.0) — NÃO tem essas funções; sobrescreve window.utils
 *
 * Este patch usa setInterval para ser aplicado SEMPRE COMO ÚLTIMO,
 * após o DOMContentLoaded, garantindo que sobrescreva qualquer versão anterior.
 */

(function () {
    'use strict';

    /* ----------------------------------------------------------------
       Helpers internos (sem depender de nada externo)
    ---------------------------------------------------------------- */

    function _formatPhone(cleaned) {
        if (!cleaned) return '';
        if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        return cleaned;
    }

    function _parseCurrencyBR(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        var s = value.toString().trim().replace(/[^\d,.-]/g, '');
        if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.indexOf(',') > -1) {
            s = s.replace(',', '.');
        }
        var n = Number(s);
        return isNaN(n) ? 0 : n;
    }

    function _formatCurrencyBR(value) {
        var n = Number(value) || 0;
        return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function _formatCNPJ(value) {
        if (!value) return '';
        var v = value.toString().replace(/\D/g, '').slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        return v;
    }

    function _formatCPF(value) {
        if (!value) return '';
        var v = value.toString().replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
        return v;
    }

    function _maskCurrencyInput(input) {
        if (input && typeof input.addEventListener === 'function') {
            input.addEventListener('input', function () {
                var raw = input.value.replace(/\D/g, '');
                input.value = (Number(raw) / 100).toFixed(2)
                    .replace('.', ',')
                    .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            });
            return;
        }
        var raw = String(input || '').replace(/\D/g, '');
        if (!raw) return '';
        return (Number(raw) / 100).toFixed(2)
            .replace('.', ',')
            .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    }

    function _maskPhoneInput(input) {
        if (input && typeof input.addEventListener === 'function') {
            input.addEventListener('input', function () {
                input.value = _formatPhone(input.value.replace(/\D/g, '').slice(0, 11));
            });
            return;
        }
        return _formatPhone(String(input || '').replace(/\D/g, '').slice(0, 11));
    }

    function _maskCNPJInput(input) {
        function mask(raw) {
            var v = raw.replace(/\D/g, '').slice(0, 14);
            v = v.replace(/^(\d{2})(\d)/, '$1.$2');
            v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
            v = v.replace(/(\d{4})(\d)/, '$1-$2');
            return v;
        }
        if (input && typeof input.addEventListener === 'function') {
            input.addEventListener('input', function () { input.value = mask(input.value); });
            return;
        }
        return mask(String(input || ''));
    }

    function _maskCPFInput(input) {
        function mask(raw) {
            var v = raw.replace(/\D/g, '').slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
            v = v.replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
            return v;
        }
        if (input && typeof input.addEventListener === 'function') {
            input.addEventListener('input', function () { input.value = mask(input.value); });
            return;
        }
        return mask(String(input || ''));
    }

    /* ----------------------------------------------------------------
       Aplica o patch em window.utils
    ---------------------------------------------------------------- */
    function _patch() {
        var u = window.utils;
        if (!u) return false;

        // Máscaras (dual-mode)
        u.maskCurrencyInput = _maskCurrencyInput;
        u.maskPhoneInput    = _maskPhoneInput;
        u.maskCNPJInput     = _maskCNPJInput;
        u.maskCPFInput      = _maskCPFInput;

        // Formatadores ausentes na v2.0
        if (typeof u.formatCNPJ !== 'function')       u.formatCNPJ       = _formatCNPJ;
        if (typeof u.formatCPF  !== 'function')       u.formatCPF        = _formatCPF;
        if (typeof u.formatCurrencyBR !== 'function') u.formatCurrencyBR = _formatCurrencyBR;
        if (typeof u.parseCurrencyBR  !== 'function') u.parseCurrencyBR  = _parseCurrencyBR;
        if (typeof u.parseMonetaryValue !== 'function') u.parseMonetaryValue = _parseCurrencyBR;

        // generateId robusto (a v2.0 pode ter uma versão mais fraca)
        if (typeof u.generateId !== 'function') {
            u.generateId = function (prefix) {
                prefix = prefix || 'id';
                return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 99999);
            };
        }

        // generateFidelityCode
        if (typeof u.generateFidelityCode !== 'function') {
            u.generateFidelityCode = function () {
                var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                var code = 'FID-';
                for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
                return code;
            };
        }

        // showConfirm (v2.0 tem, mas garante fallback)
        if (typeof u.showConfirm !== 'function') {
            u.showConfirm = function (title, text) {
                if (typeof Swal !== 'undefined') {
                    return Swal.fire({ title: title, text: text || '', icon: 'question',
                        showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar' });
                }
                return Promise.resolve({ isConfirmed: confirm(title + (text ? '\n' + text : '')) });
            };
        }

        // exportToCSV (garante headers na primeira linha)
        if (typeof u.exportToCSV !== 'function') {
            u.exportToCSV = function (data, filename) {
                if (!data || !data.length) return;
                var headers = Object.keys(data[0]);
                var rows = [headers.join(',')].concat(data.map(function (row) {
                    return headers.map(function (k) {
                        var v = row[k];
                        if (v === null || v === undefined) return '';
                        if (typeof v === 'string') return '"' + v.replace(/"/g, '""') + '"';
                        return v;
                    }).join(',');
                }));
                var blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = filename || 'export.csv';
                a.click();
            };
        }

        // Marca patch aplicado
        u.__patched = true;
        u.__patchVersion = 3;

        console.log('%c✅ utils-mask-patch v3 aplicado — formatCNPJ, masks e extras OK', 'color:#10b981;font-weight:bold');
        return true;
    }

    /* ----------------------------------------------------------------
       Estratégia: tenta agora e também no DOMContentLoaded e no load.
       Isso garante que o patch rode DEPOIS de qualquer script que
       sobrescreva window.utils (como o utils. js v2.0).
    ---------------------------------------------------------------- */

    // Tentativa imediata
    _patch();

    // Após DOMContentLoaded (cobre maioria dos casos)
    document.addEventListener('DOMContentLoaded', function () {
        _patch();
    });

    // Após load total da página (garante que todos os scripts já rodaram)
    window.addEventListener('load', function () {
        _patch();
        // Re-aplica 200ms depois para cobrir scripts defer/async tardios
        setTimeout(_patch, 200);
        setTimeout(_patch, 500);
    });

})();