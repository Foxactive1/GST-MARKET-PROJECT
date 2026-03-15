/**
 * StorageManager - Gerencia persistência com fallback automático
 * Usa localStorage por padrão; se indisponível, tenta IndexedDB.
 * Suporta compressão LZString para dados grandes.
 * 
 * @author Dione Castro Alves - InNovaIdeia
 * @version 1.0.0
 */
window.StorageManager = (function() {
    'use strict';

    const STORAGE_PREFIX = 'gst_';
    const COMPRESS_THRESHOLD = 5000; // caracteres

    let useIndexedDB = false;
    let dbPromise = null;

    // ==================== Inicialização ====================
    function init() {
        // Testa se localStorage está disponível e funciona
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            console.log('StorageManager: usando localStorage');
        } catch (e) {
            console.warn('StorageManager: localStorage indisponível, tentando IndexedDB');
            if (isIndexedDBSupported()) {
                useIndexedDB = true;
                console.log('StorageManager: usando IndexedDB');
            } else {
                console.error('StorageManager: nenhum mecanismo de armazenamento disponível');
            }
        }
    }

    function isIndexedDBSupported() {
        return 'indexedDB' in window;
    }

    // ==================== IndexedDB helpers ====================
    function getDB() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open('GstTechDB', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('storage')) {
                        db.createObjectStore('storage');
                    }
                };
                request.onsuccess = (e) => resolve(e.target.result);
                request.onerror = (e) => reject(e.target.error);
            });
        }
        return dbPromise;
    }

    async function idbSet(key, value) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('storage', 'readwrite');
            const store = tx.objectStore('storage');
            const request = store.put(value, STORAGE_PREFIX + key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbGet(key) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('storage', 'readonly');
            const store = tx.objectStore('storage');
            const request = store.get(STORAGE_PREFIX + key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbRemove(key) {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('storage', 'readwrite');
            const store = tx.objectStore('storage');
            const request = store.delete(STORAGE_PREFIX + key);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async function idbClear() {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('storage', 'readwrite');
            const store = tx.objectStore('storage');
            const keysRequest = store.getAllKeys();
            keysRequest.onsuccess = () => {
                const keys = keysRequest.result;
                keys.forEach(k => {
                    if (k.startsWith(STORAGE_PREFIX)) store.delete(k);
                });
                tx.oncomplete = () => resolve();
                tx.onerror = reject;
            };
        });
    }

    // ==================== localStorage helpers ====================
    function lsSet(key, value) {
        localStorage.setItem(STORAGE_PREFIX + key, value);
    }

    function lsGet(key) {
        return localStorage.getItem(STORAGE_PREFIX + key);
    }

    function lsRemove(key) {
        localStorage.removeItem(STORAGE_PREFIX + key);
    }

    function lsClear() {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
        });
    }

    // ==================== API pública unificada ====================
    /**
     * Salva um valor.
     * @param {string} key - Chave (sem prefixo)
     * @param {any} value - Valor (objeto será convertido para JSON)
     * @param {boolean} compress - Se deve comprimir (usado apenas se LZString existir)
     * @returns {Promise<void>}
     */
    function set(key, value, compress = false) {
        let data = value;
        if (typeof value === 'object') {
            data = JSON.stringify(value);
        }
        if (compress && data.length > COMPRESS_THRESHOLD && typeof LZString !== 'undefined') {
            data = LZString.compress(data);
        }
        if (useIndexedDB) {
            return idbSet(key, data);
        } else {
            lsSet(key, data);
            return Promise.resolve();
        }
    }

    /**
     * Recupera um valor.
     * @param {string} key - Chave
     * @param {boolean} decompress - Se deve descomprimir (usado se comprimido)
     * @returns {Promise<any>} - Valor (se for JSON, retorna objeto)
     */
    function get(key, decompress = false) {
        if (useIndexedDB) {
            return idbGet(key).then(data => {
                if (decompress && data && typeof LZString !== 'undefined') {
                    data = LZString.decompress(data);
                }
                try {
                    return JSON.parse(data);
                } catch {
                    return data;
                }
            });
        } else {
            let data = lsGet(key);
            if (decompress && data && typeof LZString !== 'undefined') {
                data = LZString.decompress(data);
            }
            try {
                return Promise.resolve(JSON.parse(data));
            } catch {
                return Promise.resolve(data);
            }
        }
    }

    /**
     * Remove uma chave.
     * @param {string} key
     * @returns {Promise<void>}
     */
    function remove(key) {
        if (useIndexedDB) {
            return idbRemove(key);
        } else {
            lsRemove(key);
            return Promise.resolve();
        }
    }

    /**
     * Remove todas as chaves com o prefixo do sistema.
     * @returns {Promise<void>}
     */
    function clear() {
        if (useIndexedDB) {
            return idbClear();
        } else {
            lsClear();
            return Promise.resolve();
        }
    }

    init();

    return {
        set,
        get,
        remove,
        clear
    };
})();