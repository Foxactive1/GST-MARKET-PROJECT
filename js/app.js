/**
 * Aplicação Principal
 * Agora verifica se os módulos existem antes de chamá-los
 */
window.app = (function() {
    let currentView = 'dashboard';

    function init() {
        console.log('🚀 Inicializando Supermercado Pro Modular...');

        // Verifica dependências críticas
        if (!window.state) {
            console.error('❌ state.js não carregou corretamente!');
            document.body.innerHTML = '<div class="alert alert-danger m-5">Erro crítico: state.js não carregou. Verifique o console.</div>';
            return;
        }

        setupGlobalListeners();

        // Tenta carregar a view inicial
        try {
            switchView('dashboard');
            window.utils?.showToast('Sistema inicializado com sucesso!', 'success');
        } catch (e) {
            console.error('Erro ao iniciar dashboard:', e);
        }
    }

    function setupGlobalListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
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
                    switchView(actions[e.key]);
                }
            }
        });
    }

    function switchView(view) {
        if (!view) return;
        currentView = view;

        // Mapeia views para módulos
        const modules = {
            dashboard: window.dashboard,
            pdv: window.pdv,
            estoque: window.estoque,
            clientes: window.clientes,
            relatorios: window.relatorios,
            fidelidade: window.fidelidade
        };

        const module = modules[view];
        if (module && typeof module.render === 'function') {
            module.render();
        } else {
            console.warn(`Módulo "${view}" não disponível ou sem método render.`);
            // Fallback: exibe mensagem amigável
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-warning">
                    <h4>Módulo em construção</h4>
                    <p>O módulo "${view}" não pôde ser carregado. Verifique se o arquivo correspondente está presente e sem erros.</p>
                </div>
            `;
        }

        // Atualiza título da página
        const titles = {
            dashboard: 'Dashboard',
            pdv: 'PDV - Ponto de Venda',
            estoque: 'Gestão de Estoque',
            clientes: 'Gestão de Clientes',
            relatorios: 'Relatórios',
            fidelidade: 'Programa de Fidelidade'
        };
        document.title = `Supermercado Pro - ${titles[view] || view}`;
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