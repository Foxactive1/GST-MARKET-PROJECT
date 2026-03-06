window.app = (function() {
    let currentView = 'dashboard';

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
            switchView('dashboard');
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
        
        if (window.auth && !window.auth.isAuthenticated() && view !== 'login') {
            view = 'login';
        }

        currentView = view;

        const modules = {
            dashboard: window.dashboard,
            pdv: window.pdv,
            estoque: window.estoque,
            clientes: window.clientes,
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

    function updateNavVisibility() {
        const isAuth = window.auth && window.auth.isAuthenticated();
        const navbarLinks = document.querySelectorAll('.nav-link[data-view]');
        const dropdownItems = document.querySelectorAll('.dropdown-item[data-view]');
        
        navbarLinks.forEach(link => {
            if (link.dataset.view && link.dataset.view !== 'login') {
                link.style.display = isAuth ? '' : 'none';
            }
        });
        
        dropdownItems.forEach(item => {
            if (item.dataset.view && item.dataset.view !== 'login') {
                item.style.display = isAuth ? '' : 'none';
            }
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