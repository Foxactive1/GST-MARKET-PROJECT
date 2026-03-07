/**
 * init.js — Inicialização do Gst Tech / Supermercado Pro
 * Desenvolvido por: Dione Castro Alves - InNovaIdeia
 * Refatorado: Performance + PWA
 *
 * Responsabilidades deste módulo:
 * - Fallbacks de segurança para objetos globais
 * - Controle de progresso de carregamento
 * - Tratamento global de erros
 * - Atalhos de teclado
 * - Detecção online/offline
 * - Registro do Service Worker (PWA)
 * - Métricas de performance (API moderna)
 */

// ============================================
// Fallbacks para objetos globais
// Evita erros caso módulos ainda não tenham carregado
// ============================================
window.app      = window.app      || { switchView: () => {} };
window.commands = window.commands || { show: () => {} };
window.utils    = window.utils    || {
  showAlert:   () => {},
  showToast:   () => {},
  showConfirm: () => Promise.resolve(false),
};

// ============================================
// Progress bar de carregamento
// ============================================
const STAGES = [
  { percent: 20,  label: 'Carregando recursos...'    },
  { percent: 40,  label: 'Inicializando módulos...'  },
  { percent: 60,  label: 'Configurando interface...' },
  { percent: 80,  label: 'Preparando sistema...'     },
  { percent: 100, label: 'Pronto!'                   },
];

let _stageIndex    = 0;
let _progressTimer = null;

function updateLoadProgress(percent, label) {
  const bar    = document.getElementById('loadProgress');
  const status = document.getElementById('loadStatus');
  if (bar)    bar.style.width   = `${percent}%`;
  if (status) status.textContent = label;
}

function startProgressSimulation() {
  _progressTimer = setInterval(() => {
    if (_stageIndex < STAGES.length) {
      const { percent, label } = STAGES[_stageIndex++];
      updateLoadProgress(percent, label);
    } else {
      stopProgressSimulation();
    }
  }, 300);
}

function stopProgressSimulation() {
  if (_progressTimer) {
    clearInterval(_progressTimer);
    _progressTimer = null;
  }
}

// CORREÇÃO: timer limpo também em descarregamento — evita leak
window.addEventListener('pagehide', stopProgressSimulation, { once: true });

startProgressSimulation();

// ============================================
// Tratamento global de erros
// ============================================
window.addEventListener('error', ({ error }) => {
  if (!error) return;
  console.error('[Gst] Erro global:', error);

  // Exibe modal de erro apenas para falhas críticas não relacionadas a scripts CDN
  if (error.message && !error.message.includes('script')) {
    const body = document.getElementById('errorModalBody');
    if (body) body.textContent = `Erro: ${error.message}`;

    if (window.bootstrap?.Modal) {
      new bootstrap.Modal(document.getElementById('errorModal')).show();
    }
  }
});

window.addEventListener('unhandledrejection', ({ reason }) => {
  console.error('[Gst] Promise rejeitada sem tratamento:', reason);
});

// ============================================
// Esconde o loader e exibe o conteúdo
// ============================================
window.addEventListener('load', () => {
  setTimeout(() => {
    stopProgressSimulation();
    updateLoadProgress(100, 'Sistema carregado!');

    setTimeout(() => {
      const loader = document.getElementById('globalLoader');
      const main   = document.getElementById('mainContent');
      const crumb  = document.getElementById('breadcrumb');

      loader?.classList.add('hidden');
      setTimeout(() => { if (loader) loader.style.display = 'none'; }, 300);

      main?.classList.add('loaded');
      if (crumb) crumb.style.display = 'block';
    }, 300);
  }, 500);
}, { once: true });

// ============================================
// Atualiza item ativo na navbar e breadcrumb
// ============================================
const VIEW_NAMES = {
  dashboard:   'Dashboard',
  pdv:         'PDV',
  estoque:     'Estoque',
  clientes:    'Clientes',
  fidelidade:  'Fidelidade',
  relatorios:  'Relatórios',
  fornecedores:'Fornecedores',
};

function updateActiveNav(view) {
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    const isActive = link.dataset.view === view;
    link.classList.toggle('active', isActive);
    isActive
      ? link.setAttribute('aria-current', 'page')
      : link.removeAttribute('aria-current');
  });

  const crumbPage = document.getElementById('currentPage');
  if (crumbPage) crumbPage.textContent = VIEW_NAMES[view] ?? view;
}

window.updateActiveNav = updateActiveNav;

// ============================================
// Atalhos de teclado
// ============================================
const KEY_VIEW_MAP = {
  d: 'dashboard',
  p: 'pdv',
  e: 'estoque',
  c: 'clientes',
  f: 'fidelidade',
  r: 'relatorios',
  g: 'fornecedores',
};

document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;

  // Ctrl+K — Paleta de comandos
  if (ctrl && e.key === 'k') {
    e.preventDefault();
    window.commands?.show?.();
    return;
  }

  // Ctrl+Shift+? — Lista de atalhos
  if (ctrl && e.shiftKey && e.key === '?') {
    e.preventDefault();
    window.utils?.showAlert?.('Atalhos de Teclado', 'info', `
      <div class="text-start">
        <p><strong>Navegação:</strong></p>
        <ul>
          ${Object.entries(KEY_VIEW_MAP).map(([k, v]) =>
            `<li><kbd>Ctrl</kbd>+<kbd>${k.toUpperCase()}</kbd>: ${VIEW_NAMES[v]}</li>`
          ).join('')}
        </ul>
        <p><strong>Ações:</strong></p>
        <ul>
          <li><kbd>Ctrl</kbd>+<kbd>K</kbd>: Paleta de Comandos</li>
          <li><kbd>Esc</kbd>: Fechar modal/dropdown</li>
        </ul>
      </div>
    `);
    return;
  }

  // Ctrl+[letra] — Trocar de view
  if (ctrl && !e.shiftKey && !e.altKey) {
    const target = KEY_VIEW_MAP[e.key.toLowerCase()];
    if (target) {
      e.preventDefault();
      window.app?.switchView?.(target);
    }
    return;
  }

  // Escape — Fecha modais e dropdowns abertos
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.show').forEach(modal => {
      if (window.bootstrap?.Modal) {
        bootstrap.Modal.getInstance(modal)?.hide();
      } else {
        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        document.querySelector('.modal-backdrop')?.remove();
      }
    });

    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
      const toggle = menu.previousElementSibling;
      window.bootstrap?.Dropdown
        ? bootstrap.Dropdown.getInstance(toggle)?.hide()
        : menu.classList.remove('show');
    });
  }
});

// ============================================
// Detecção online / offline
// ============================================
function setOfflineUI(isOffline) {
  const indicator = document.getElementById('offlineIndicator');
  if (indicator) indicator.style.display = isOffline ? 'block' : 'none';

  window.utils?.showToast?.(
    isOffline ? 'Você está offline' : 'Conexão restaurada',
    isOffline ? 'warning' : 'success'
  );
}

window.addEventListener('online',  () => setOfflineUI(false));
window.addEventListener('offline', () => setOfflineUI(true));

// ============================================
// Registro do Service Worker (PWA)
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    /**
     * Deriva o caminho base a partir da URL atual.
     * Garante funcionamento tanto em root ("/") quanto em
     * subdiretórios ("/app/", "/supermercado-pro/", etc.)
     * e em servidores de dev com porta arbitrária.
     *
     * Exemplos:
     *   http://localhost:26543/          → swUrl = ./service-worker.js | scope = /
     *   http://localhost:26543/app/      → swUrl = ./service-worker.js | scope = /app/
     *   https://example.com/sistema/     → swUrl = ./service-worker.js | scope = /sistema/
     */
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/'); // diretório atual
    const swUrl    = './service-worker.js'; // relativo ao index.html — sempre correto

    navigator.serviceWorker.register(swUrl, { scope: basePath })
      .then(reg => {
        console.log('[SW] Registrado — escopo:', reg.scope);

        // Notifica quando nova versão estiver disponível
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', function () {
            if (this.state === 'installed' && navigator.serviceWorker.controller) {
              window.utils?.showToast?.(
                'Nova versão disponível! Recarregue a página para atualizar.',
                'info'
              );
            }
          });
        });
      })
      .catch(err => {
        // Log detalhado para facilitar diagnóstico
        console.error('[SW] Falha no registro:', err.message ?? err);
        console.info('[SW] Verifique se o arquivo service-worker.js está no mesmo diretório do index.html');
      });
  }, { once: true });
}

// ============================================
// Detecção de modo PWA (standalone)
// ============================================
const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
              navigator.standalone === true;

if (isPWA) {
  console.log('[Gst] Executando como PWA');
  document.documentElement.classList.add('pwa-mode');
}

// ============================================
// Métricas de Performance — API moderna
// CORREÇÃO: performance.timing é deprecated desde Chrome 60+
// Usa PerformanceNavigationTiming (PerformanceObserver)
// ============================================
if ('PerformanceObserver' in window) {
  try {
    const observer = new PerformanceObserver(list => {
      for (const entry of list.getEntriesByType('navigation')) {
        console.log('📊 Performance Metrics:');
        console.log(`  Page Load:       ${Math.round(entry.loadEventEnd - entry.startTime)}ms`);
        console.log(`  Server Response: ${Math.round(entry.responseEnd - entry.requestStart)}ms`);
        console.log(`  DOM Interactive: ${Math.round(entry.domInteractive - entry.startTime)}ms`);
        console.log(`  First Byte:      ${Math.round(entry.responseStart - entry.startTime)}ms`);
      }
      observer.disconnect();
    });
    observer.observe({ type: 'navigation', buffered: true });
  } catch (err) {
    console.warn('[Gst] PerformanceObserver indisponível:', err);
  }
}
