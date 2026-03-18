/**
 * StorageService — Camada de abstração de persistência
 * Gst Tech / Supermercado Pro
 *
 * @author Dione Castro Alves - InNovaIdeia
 * @version 1.0.0
 *
 * DESIGN:
 * Toda a aplicação interage apenas com esta interface pública:
 *   StorageService.set(key, value)
 *   StorageService.get(key)
 *   StorageService.delete(key)
 *   StorageService.clear(prefix?)
 *   StorageService.keys(prefix?)
 *
 * Para migrar para IndexedDB no futuro, basta trocar o objeto
 * _adapter abaixo — zero alterações no restante do código.
 *
 * NAMESPACE:
 * Todas as chaves são automaticamente prefixadas com "gst::" para
 * evitar colisões com outras libs que também usem localStorage.
 */

window.StorageService = (function () {
    'use strict';

    // -------------------------------------------
    // NAMESPACE — prefixo global de todas as chaves
    // -------------------------------------------
    const NS = 'gst::';

    // -------------------------------------------
    // ADAPTER: localStorage (padrão)
    // Para migrar para IndexedDB, substitua este objeto.
    // -------------------------------------------
    const _adapter = {

        /**
         * Grava um valor serializado.
         * @param {string} key
         * @param {*} value  — qualquer valor JSON-serializável
         * @returns {boolean} true se bem-sucedido
         */
        set(key, value) {
            try {
                const serialized = JSON.stringify({
                    v: value,
                    ts: Date.now()
                });
                localStorage.setItem(NS + key, serialized);
                return true;
            } catch (err) {
                // QuotaExceededError ou JSON circular
                console.error('[StorageService] set() falhou:', key, err);
                return false;
            }
        },

        /**
         * Recupera e desserializa um valor.
         * @param {string} key
         * @returns {*} valor original ou null se não encontrado
         */
        get(key) {
            try {
                const raw = localStorage.getItem(NS + key);
                if (raw === null) return null;
                const parsed = JSON.parse(raw);
                return parsed.v !== undefined ? parsed.v : parsed; // compatibilidade com chaves legadas
            } catch (err) {
                console.error('[StorageService] get() falhou:', key, err);
                return null;
            }
        },

        /**
         * Remove uma chave.
         * @param {string} key
         */
        delete(key) {
            localStorage.removeItem(NS + key);
        },

        /**
         * Remove todas as chaves do namespace (ou de um subprefixo).
         * @param {string} [prefix] — limpa apenas chaves com esse prefixo
         */
        clear(prefix) {
            const full = NS + (prefix || '');
            const toDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(full)) toDelete.push(k);
            }
            toDelete.forEach(k => localStorage.removeItem(k));
        },

        /**
         * Lista todas as chaves do namespace (sem o prefixo NS).
         * @param {string} [prefix]
         * @returns {string[]}
         */
        keys(prefix) {
            const full = NS + (prefix || '');
            const result = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(full)) {
                    result.push(k.slice(NS.length)); // retorna sem o NS
                }
            }
            return result;
        },

        /**
         * Verifica se o storage está disponível.
         * @returns {boolean}
         */
        isAvailable() {
            try {
                const probe = '__gst_probe__';
                localStorage.setItem(probe, '1');
                localStorage.removeItem(probe);
                return true;
            } catch {
                return false;
            }
        },

        /**
         * Retorna o uso estimado em bytes (somente chaves do namespace).
         * @returns {number}
         */
        getUsageBytes() {
            let total = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(NS)) {
                    total += k.length + (localStorage.getItem(k) || '').length;
                }
            }
            return total * 2; // UTF-16: 2 bytes por caractere
        }
    };

    // -------------------------------------------
    // MIGRAÇÃO DE CHAVES LEGADAS
    // Move dados antigos (sem prefixo NS) para o novo formato.
    // Executar apenas uma vez.
    // -------------------------------------------
    function migrateLegacyKeys() {
        const LEGACY_KEYS = [
            'supermarket-state',
            'theme',
            'autoSwitch',
            'supermercado_auth',
            'stock-movements',
            'stock-alerts',
            'stock-alerts-previous'
        ];

        let migrated = 0;

        LEGACY_KEYS.forEach(legacyKey => {
            const raw = localStorage.getItem(legacyKey);
            if (raw === null) return;

            // Só migra se ainda não existe no novo namespace
            const newKey = NS + legacyKey;
            if (localStorage.getItem(newKey) === null) {
                try {
                    // Envolve no envelope {v, ts} do novo formato
                    const value = JSON.parse(raw);
                    localStorage.setItem(newKey, JSON.stringify({ v: value, ts: Date.now() }));
                    migrated++;
                    console.log(`[StorageService] Migrada chave legada: ${legacyKey}`);
                } catch {
                    // Se não era JSON válido, migra como string
                    localStorage.setItem(newKey, JSON.stringify({ v: raw, ts: Date.now() }));
                    migrated++;
                }
            }
        });

        if (migrated > 0) {
            console.log(`[StorageService] ${migrated} chave(s) legada(s) migrada(s) para o namespace "${NS}"`);
            // Marca migração como concluída
            localStorage.setItem(NS + '__migrated__', JSON.stringify({ v: true, ts: Date.now() }));
        }
    }

    // -------------------------------------------
    // API PÚBLICA
    // -------------------------------------------

    /**
     * Grava um valor.
     * @param {string} key
     * @param {*} value
     * @returns {boolean}
     */
    function set(key, value) {
        if (!key) { console.warn('[StorageService] set(): chave inválida'); return false; }
        return _adapter.set(key, value);
    }

    /**
     * Recupera um valor (ou defaultValue se ausente).
     * @param {string} key
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    function get(key, defaultValue = null) {
        if (!key) return defaultValue;
        const value = _adapter.get(key);
        return value !== null ? value : defaultValue;
    }

    /**
     * Remove uma chave.
     * @param {string} key
     */
    function del(key) {
        if (!key) return;
        _adapter.delete(key);
    }

    /**
     * Apaga todas as chaves do namespace (ou de um subprefixo).
     * @param {string} [prefix]
     */
    function clear(prefix) {
        _adapter.clear(prefix);
    }

    /**
     * Lista chaves do namespace (ou de um subprefixo).
     * @param {string} [prefix]
     * @returns {string[]}
     */
    function keys(prefix) {
        return _adapter.keys(prefix);
    }

    /**
     * Diagnóstico do serviço.
     * @returns {Object}
     */
    function info() {
        const available = _adapter.isAvailable();
        const usage = available ? _adapter.getUsageBytes() : 0;
        const allKeys = available ? _adapter.keys() : [];

        return {
            available,
            adapter: 'localStorage',
            namespace: NS,
            totalKeys: allKeys.length,
            usageBytes: usage,
            usageKB: (usage / 1024).toFixed(2),
            keys: allKeys
        };
    }

    // -------------------------------------------
    // INICIALIZAÇÃO
    // -------------------------------------------
    (function init() {
        if (!_adapter.isAvailable()) {
            console.error('[StorageService] localStorage não disponível. Persistência desabilitada.');
            return;
        }

        // Migra chaves legadas apenas uma vez
        const alreadyMigrated = _adapter.get('__migrated__');
        if (!alreadyMigrated) {
            migrateLegacyKeys();
        }

        console.log('%c[StorageService] Iniciado', 'color:#0d6efd;font-weight:bold', info());
    })();

    return {
        set,
        get,
        delete: del,
        clear,
        keys,
        info,
        // Expõe o adapter para uso avançado (ex: migração futura)
        _adapter
    };

})();

/*
 * ============================================================
 * GUIA DE USO
 * ============================================================
 *
 * // Salvar estado principal
 * StorageService.set('supermarket-state', window.state.get());
 *
 * // Recuperar (com fallback)
 * const estado = StorageService.get('supermarket-state', {});
 *
 * // Remover
 * StorageService.delete('theme');
 *
 * // Limpar apenas os backups
 * StorageService.clear('backup-');
 *
 * // Listar todas as chaves
 * console.log(StorageService.keys());
 *
 * // Ver diagnóstico
 * console.log(StorageService.info());
 *
 * ============================================================
 * MIGRAÇÃO FUTURA PARA IndexedDB
 * ============================================================
 * Substitua apenas o objeto _adapter acima por uma
 * implementação assíncrona usando Promises (idb-keyval, Dexie.js,
 * ou vanilla IDBObjectStore) — toda a lógica de negócio continua
 * sem alterações.
 * ============================================================
 */
