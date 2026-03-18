/**
 * utils-mask-patch.js — v2
 * Corrige funções de máscara (dual-mode: DOM element e string inline).
 * Aguarda window.utils estar disponível antes de aplicar.
 */

(function applyPatch() {
    'use strict';

    function _formatPhone(cleaned) {
        if (!cleaned) return '';
        if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        return cleaned;
    }

    function _patch(utils) {

        utils.maskCurrencyInput = function (input) {
            if (input && typeof input.addEventListener === 'function') {
                input.addEventListener('input', function () {
                    var raw = input.value.replace(/\D/g, '');
                    var v = (Number(raw) / 100).toFixed(2)
                              .replace('.', ',')
                              .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                    input.value = v;
                });
                return;
            }
            var raw = String(input || '').replace(/\D/g, '');
            if (!raw) return '';
            return (Number(raw) / 100).toFixed(2)
                     .replace('.', ',')
                     .replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        };

        utils.maskPhoneInput = function (input) {
            if (input && typeof input.addEventListener === 'function') {
                input.addEventListener('input', function () {
                    input.value = _formatPhone(input.value.replace(/\D/g, '').slice(0, 11));
                });
                return;
            }
            return _formatPhone(String(input || '').replace(/\D/g, '').slice(0, 11));
        };

        utils.maskCNPJInput = function (input) {
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
        };

        utils.maskCPFInput = function (input) {
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
        };

        console.log('%c✅ utils-mask-patch aplicado com sucesso', 'color:#10b981;font-weight:bold');
    }

    if (window.utils) {
        _patch(window.utils);
        return;
    }

    var attempts = 0;
    var interval = setInterval(function () {
        attempts++;
        if (window.utils) {
            clearInterval(interval);
            _patch(window.utils);
        } else if (attempts >= 60) {
            clearInterval(interval);
            console.error('[utils-mask-patch] window.utils não ficou disponível em 3s. Verifique o utils.js.');
        }
    }, 50);

})();