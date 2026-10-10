window.gstApi = (function () {
  'use strict';

  const AUTH_KEY = 'supermercado_auth';
  let version = 0;
  let saveTimer = null;
  let lastConflictToast = false;

  function baseUrl() {
    const configured = String(window.GST_API_BASE_URL || '').trim().replace(/\/+$/, '');
    if (!configured) return '';
    return configured.endsWith('/api') ? configured : configured + '/api';
  }

  function isConfigured() {
    return !!baseUrl();
  }

  function readAuth() {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const value = JSON.parse(store.getItem(AUTH_KEY) || 'null');
        if (value && value.token && !String(value.token).startsWith('fake-')) return value;
      } catch (_) {}
    }
    return null;
  }

  async function request(path, options = {}) {
    const base = baseUrl();
    if (!base) throw new Error('GST_API_BASE_URL não está configurada.');
    const auth = readAuth();
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth?.token) headers.Authorization = 'Bearer ' + auth.token;

    let response;
    try {
      response = await fetch(base + path, { ...options, headers });
    } catch (_) {
      throw new Error('Não foi possível conectar à API. Verifique a conexão e tente novamente.');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error || 'Falha na comunicação com a API.');
      error.status = response.status;
      error.code = body.code;
      error.version = body.version;
      error.remoteState = body.state;
      throw error;
    }
    return body;
  }

  async function login(username, password) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  }

  async function restoreState() {
    try {
      const result = await request('/state');
      version = Number.isInteger(result.version) ? result.version : 0;
      if (result.state && window.state?.replaceFromServer) {
        window.state.replaceFromServer(result.state);
        return true;
      }
      queueStateSave(window.state?.get?.());
      return false;
    } catch (error) {
      if (!error.status) {
        console.warn('[GST API] Usando dados locais até a conexão voltar.');
        return false;
      }
      throw error;
    }
  }

  function queueStateSave(state) {
    if (!isConfigured() || !readAuth() || !state) return;
    const snapshot = JSON.parse(JSON.stringify(state));
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveSnapshot(snapshot);
    }, 700);
  }

  async function saveSnapshot(snapshot) {
    try {
      const result = await request('/state', {
        method: 'PUT',
        body: JSON.stringify({ state: snapshot, version })
      });
      version = result.version;
      lastConflictToast = false;
    } catch (error) {
      if (error.status === 409) {
        version = Number.isInteger(error.version) ? error.version : version;
        if (!lastConflictToast) {
          window.utils?.showToast?.('Os dados foram alterados em outra sessão. Recarregue antes de continuar.', 'warning');
          lastConflictToast = true;
        }
        return;
      }
      console.warn('[GST API] Sincronização pendente:', error.message);
    }
  }

  function clearSession() {
    version = 0;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    lastConflictToast = false;
  }

  window.addEventListener('online', () => {
    if (isConfigured() && readAuth()) queueStateSave(window.state?.get?.());
  });

  return { isConfigured, request, login, restoreState, queueStateSave, clearSession };
})();
