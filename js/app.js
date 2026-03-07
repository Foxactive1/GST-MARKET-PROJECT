window.app = (function() {
    'use strict';

    let currentView = 'dashboard';

    // Mapa de permissões: cada view e as roles que podem acessá-la
    const VIEW_PERMISSIONS = {
	    dashboard: ['admin'],
	    pdv: ['admin', 'operador'],
	    estoque: ['admin'],
	    clientes: ['admin'],
	    fornecedores: ['admin'],   // ← nova view (apenas admin)
	    fidelidade: ['admin'],
	    relatorios: ['admin']
	};

    function init() {
        console.log('🚀 Inicializando Supermercado Pro Modular...');

        if (!window.state) {
            console.error('❌ state.js não carregou corretamente!');
            document.body.innerHTML = '<div class="alert alert-danger m-5">Erro crítico: state.js não carregou. Verifique o console.</div>';
            return;
        }

        setupGlobalListeners();

        if (!window.auth || !window.auth.isAuthenticated()) {
            switchView('login');
        } else {
            // Redireciona para a view padrão baseada na role
            const user = window.auth.getUser();
            const defaultView = user.role === 'admin' ? 'dashboard' : 'pdv';
            switchView(defaultView);
        }
    }

    function setupGlobalListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                const actions = {
                    'd': 'dashboard',
                    'p': 'pdv',
                    'e': 'estoque',
                    'c': 'clientes',
                    'r': 'relatorios',
                    'f': 'fidelidade'
                };
                if (actions[e.key]) {
                    e.preventDefault();
                    if (window.auth && window.auth.isAuthenticated()) {
                        switchView(actions[e.key]);
                    } else {
                        switchView('login');
                    }
                }
            }
        });
    }

    function switchView(view) {
        if (!view) return;

        // Se não estiver autenticado, só pode ver login
        if (window.auth && !window.auth.isAuthenticated() && view !== 'login') {
            view = 'login';
        }

        // Verifica permissões se estiver autenticado
        if (window.auth && window.auth.isAuthenticated()) {
            const user = window.auth.getUser();
            const allowedRoles = VIEW_PERMISSIONS[view];
            if (!allowedRoles || !allowedRoles.includes(user.role)) {
                // Redireciona para a view padrão do perfil
                const defaultView = user.role === 'admin' ? 'dashboard' : 'pdv';
                window.utils?.showToast('Acesso negado a esta funcionalidade', 'warning');
                view = defaultView;
            }
        }

        currentView = view;

        const modules = {
		    dashboard: window.dashboard,
		    pdv: window.pdv,
		    estoque: window.estoque,
		    clientes: window.clientes,
		    fornecedores: window.fornecedores,   // ← novo
		    relatorios: window.relatorios,
		    fidelidade: window.fidelidade,
		    login: window.auth
		};

        const module = modules[view];
        if (module && typeof module.render === 'function') {
            module.render();
        } else {
            console.warn(`Módulo "${view}" não disponível ou sem método render.`);
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-warning">
                    <h4>Módulo em construção</h4>
                    <p>O módulo "${view}" não pôde ser carregado. Verifique se o arquivo correspondente está presente e sem erros.</p>
                </div>
            `;
        }

        const titles = {
            dashboard: 'Dashboard',
            pdv: 'PDV - Ponto de Venda',
            estoque: 'Gestão de Estoque',
            clientes: 'Gestão de Clientes',
            relatorios: 'Relatórios',
            fidelidade: 'Programa de Fidelidade',
            login: 'Login'
        };
        document.title = `Supermercado Pro - ${titles[view] || view}`;

        updateNavVisibility();
    }

    /**
     * Atualiza a visibilidade dos itens de navegação com base na role do usuário.
     */
    function updateNavVisibility() {
        const isAuth = window.auth && window.auth.isAuthenticated();
        const user = isAuth ? window.auth.getUser() : null;
        const role = user ? user.role : null;

        // Seleciona todos os links de navegação que possuem data-view (exceto login)
        const navLinks = document.querySelectorAll('.nav-link[data-view], .dropdown-item[data-view]');

        navLinks.forEach(link => {
            const view = link.dataset.view;
            if (!view) return;

            if (!isAuth) {
                // Se não autenticado, esconde todos os links (exceto login, mas login não tem data-view)
                link.style.display = 'none';
                return;
            }

            // Verifica se a view é permitida para a role atual
            const allowed = VIEW_PERMISSIONS[view] && VIEW_PERMISSIONS[view].includes(role);
            link.style.display = allowed ? '' : 'none';
        });

        // Gerencia botão de logout
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            let logoutBtn = document.getElementById('logoutBtn');
            if (!logoutBtn && isAuth) {
                logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutBtn';
                logoutBtn.className = 'nav-link btn btn-link';
                logoutBtn.setAttribute('aria-label', 'Sair');
                logoutBtn.setAttribute('title', 'Sair');
                logoutBtn.innerHTML = '<i class="bi bi-box-arrow-right"></i>';
                logoutBtn.onclick = () => window.auth.logout();
                themeToggle.parentNode.insertBefore(logoutBtn, themeToggle);
            } else if (logoutBtn && !isAuth) {
                logoutBtn.remove();
            }
        }

        // Atualiza breadcrumb (opcional)
        const currentPageEl = document.getElementById('currentPage');
        if (currentPageEl) {
            const viewNames = {
                dashboard: 'Dashboard',
                pdv: 'PDV',
                estoque: 'Estoque',
                clientes: 'Clientes',
                fidelidade: 'Fidelidade',
                relatorios: 'Relatórios'
            };
            currentPageEl.textContent = viewNames[currentView] || currentView;
        }
    }

    function getCurrentView() {
        return currentView;
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        init,
        switchView,
        getCurrentView
    };
})();