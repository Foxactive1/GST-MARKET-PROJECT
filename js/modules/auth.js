/**
 * Módulo de Autenticação
 * Gerencia login, logout e proteção de rotas.
 * Integrado com utils.js (toasts) e commands.js (registro de comando opcional)
 */
window.auth = (function() {
    const AUTH_KEY = 'supermercado_auth';

    // Agora usamos um array de usuários (admin e operador)
    const MOCK_USERS = [
        {
            username: 'admin',
            password: 'admin',
            nome: 'Administrador',
            email: 'admin@supermercado.com',
            role: 'admin'
        },
        {
            username: 'operador',
            password: 'operador',
            nome: 'Operador',
            email: 'operador@supermercado.com',
            role: 'operador'
        }
    ];

    function isAuthenticated() {
        const authData = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
        if (!authData) return false;
        try {
            const parsed = JSON.parse(authData);
            return !!parsed.user && !!parsed.timestamp;
        } catch {
            return false;
        }
    }

    function getUser() {
        const authData = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
        if (!authData) return null;
        try {
            return JSON.parse(authData).user;
        } catch {
            return null;
        }
    }

    async function login(username, password, rememberMe = false) {
        if (window.gstApi?.isConfigured()) {
            const result = await window.gstApi.login(username, password);
            const user = result.user;
            const authData = { user, timestamp: Date.now(), token: result.access_token };
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem(AUTH_KEY, JSON.stringify(authData));
            await window.gstApi.restoreState();
            return { success: true, user };
        }
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const user = MOCK_USERS.find(u => u.username === username && u.password === password);
                if (!user) {
                    reject({ success: false, message: 'Usuário ou senha inválidos' });
                    return;
                }
                const authData = {
                    user: { username: user.username, nome: user.nome, email: user.email, role: user.role },
                    timestamp: Date.now(),
                    token: 'fake-jwt-token-' + Math.random().toString(36).substring(2)
                };
                const storage = rememberMe ? localStorage : sessionStorage;
                storage.setItem(AUTH_KEY, JSON.stringify(authData));
                resolve({ success: true, user: authData.user });
            }, 350);
        });
    }

    async function restoreSession() {
        if (!isAuthenticated()) return false;
        if (!window.gstApi?.isConfigured()) return true;
        try {
            const result = await window.gstApi.request('/auth/me');
            const stored = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
            const authData = JSON.parse(stored);
            authData.user = result.user;
            const storage = localStorage.getItem(AUTH_KEY) ? localStorage : sessionStorage;
            storage.setItem(AUTH_KEY, JSON.stringify(authData));
            await window.gstApi.restoreState();
            return true;
        } catch (error) {
            localStorage.removeItem(AUTH_KEY);
            sessionStorage.removeItem(AUTH_KEY);
            window.gstApi.clearSession();
            console.warn('[Auth] Sessão remota inválida:', error.message);
            return false;
        }
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);
        window.gstApi?.clearSession?.();

        // Remove referência no state (se tiver)
        // if (window.state) window.state.user = null;

        // Redireciona para login
        if (window.app && typeof window.app.switchView === 'function') {
            window.app.switchView('login');
        } else {
            window.location.reload();
        }
    }

    function renderLogin() {
        const main = document.getElementById('mainContent');
        if (!main) return;

        main.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-6 col-lg-5">
                    <div class="card shadow-lg border-0 rounded-lg mt-5">
                        <div class="card-header bg-primary text-white text-center py-4">
                            <h3 class="mb-0">
                                <i class="bi bi-shop me-2"></i>Supermercado Pro
                            </h3>
                            <p class="mb-0 mt-2 small">Faça login para acessar o sistema</p>
                        </div>
                        <div class="card-body p-4">
                            <form id="loginForm" novalidate>
                                <div class="mb-3">
                                    <label for="username" class="form-label">Usuário</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-person"></i></span>
                                        <input type="text" class="form-control" id="username" 
                                               placeholder="Digite seu usuário" required autofocus>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">Senha</label>
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-lock"></i></span>
                                        <input type="password" class="form-control" id="password" 
                                               placeholder="Digite sua senha" required>
                                    </div>
                                </div>
                                <div class="mb-3 form-check">
                                    <input type="checkbox" class="form-check-input" id="rememberMe">
                                    <label class="form-check-label" for="rememberMe">Manter-me conectado</label>
                                </div>
                                <div class="d-grid gap-2">
                                    <button type="submit" class="btn btn-primary btn-lg" id="loginBtn">
                                        <i class="bi bi-box-arrow-in-right me-2"></i>Entrar
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div class="card-footer text-center py-3">
                            <small class="text-muted">
                                ${window.gstApi?.isConfigured() ? 'Entre com um usuário cadastrado no backend.' : 'Use admin / admin ou operador / operador na demonstração local.'}
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const form = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!username || !password) {
                window.utils?.showToast('Preencha todos os campos', 'warning');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Entrando...';

            try {
                const result = await login(username, password, rememberMe);
                if (result.success) {
                    window.utils?.showToast(`Bem-vindo, ${result.user.nome}!`, 'success');
                    // Redireciona baseado na role (admin → dashboard, operador → pdv)
                    const defaultView = result.user.role === 'admin' ? 'dashboard' : 'pdv';
                    window.app.switchView(defaultView);
                }
            } catch (error) {
                window.utils?.showToast(error.message || 'Erro ao fazer login', 'danger');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Entrar';
            }
        });
    }

    function render() {
        if (isAuthenticated()) {
            // Se já autenticado, redireciona para a view padrão baseada na role
            const user = getUser();
            const defaultView = user.role === 'admin' ? 'dashboard' : 'pdv';
            window.app.switchView(defaultView);
            return;
        }
        renderLogin();
    }

    // Inicialização: se já estiver logado, atualiza o state (opcional)
    (function init() {
        if (isAuthenticated() && window.state) {
            // window.state.user = getUser(); // se desejar armazenar no state
        }
    })();

    // Registrar comando de logout na paleta (opcional)
    if (window.commands && window.commands.registerCommand) {
        window.commands.registerCommand({
            id: 'auth-logout',
            label: 'Sair do Sistema',
            icon: 'bi-box-arrow-right',
            category: 'Autenticação',
            action: () => logout()
        });
    }

    return {
        isAuthenticated,
        getUser,
        restoreSession,
        login,
        logout,
        render,
        renderLogin
    };
})();