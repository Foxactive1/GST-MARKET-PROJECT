/**
 * Módulo de Autenticação
 * Gerencia login, logout e proteção de rotas.
 * Integrado com utils.js (toasts) e commands.js (registro de comando opcional)
 */
window.auth = (function() {
    const AUTH_KEY = 'supermercado_auth';
    
    // Usuário simulado (substituir por chamada real à API)
    const MOCK_USER = {
        username: 'admin',
        password: 'admin',
        nome: 'Administrador',
        email: 'admin@supermercado.com',
        role: 'admin'
    };

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
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (username === MOCK_USER.username && password === MOCK_USER.password) {
                    const authData = {
                        user: {
                            username: MOCK_USER.username,
                            nome: MOCK_USER.nome,
                            email: MOCK_USER.email,
                            role: MOCK_USER.role
                        },
                        timestamp: Date.now(),
                        token: 'fake-jwt-token-' + Math.random().toString(36).substring(2)
                    };
                    
                    const storage = rememberMe ? localStorage : sessionStorage;
                    storage.setItem(AUTH_KEY, JSON.stringify(authData));
                    
                    // Se quiser armazenar no state (opcional), descomente:
                    // if (window.state) window.state.user = authData.user;
                    
                    resolve({ success: true, user: authData.user });
                } else {
                    reject({ success: false, message: 'Usuário ou senha inválidos' });
                }
            }, 500);
        });
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(AUTH_KEY);
        
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
                                Use <strong>admin / admin</strong> para teste
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
                    window.app.switchView('dashboard');
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
            window.app.switchView('dashboard');
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
        login,
        logout,
        render,
        renderLogin
    };
})();