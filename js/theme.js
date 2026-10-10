/**
 * Theme Manager - Supermercado Pro
 * Desenvolvido por: Dione Castro Alves - InNovaIdeia
 * 
 * Gerencia temas (light/dark) com suporte a:
 * - Preferência do sistema
 * - Persistência em localStorage
 * - Transições suaves
 * - Auto-switch baseado em horário
 */

class ThemeManager {
    constructor() {
        this.themes = ['light', 'dark'];
        this.currentTheme = this.getCurrentTheme();
        this.systemPreference = this.getSystemPreference();
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        this.init();
    }
    
    /**
     * Inicializa o gerenciador de temas
     */
    init() {
        // Aplicar tema inicial
        this.applyTheme(this.currentTheme, false);
        
        // Atualizar ícone do botão
        this.updateToggleIcon();
        
        // Escutar mudanças na preferência do sistema
        this.mediaQuery.addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                const newTheme = e.matches ? 'dark' : 'light';
                this.applyTheme(newTheme, true);
            }
        });
        
        // Verificar auto-switch baseado em horário (opcional)
        // this.checkAutoSwitch();
    }
    
    /**
     * Obtém o tema atual
     */
    getCurrentTheme() {
        const saved = localStorage.getItem('theme');
        if (saved && this.themes.includes(saved)) {
            return saved;
        }
        return this.getSystemPreference();
    }
    
    /**
     * Obtém a preferência do sistema
     */
    getSystemPreference() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    /**
     * Aplica o tema
     */
    applyTheme(theme, showNotification = true) {
        if (!this.themes.includes(theme)) {
            console.error(`Theme "${theme}" not found`);
            return;
        }
        
        const html = document.documentElement;
        const oldTheme = this.currentTheme;
        
        // Adicionar classe de transição
        html.classList.add('theme-transitioning');
        
        // Aplicar novo tema
        html.setAttribute('data-theme', theme);
        html.setAttribute('data-color-scheme', theme);
        
        // Atualizar meta theme-color
        this.updateMetaThemeColor(theme);
        
        // Salvar preferência
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;
        
        // Atualizar ícone
        this.updateToggleIcon();
        
        // Remover classe de transição após animação
        setTimeout(() => {
            html.classList.remove('theme-transitioning');
        }, 300);
        
        // Mostrar notificação
        if (showNotification && window.utils) {
            const themeName = theme === 'light' ? 'claro' : 'escuro';
            window.utils.showToast(`Tema ${themeName} ativado`, 'info');
        }
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('themechange', {
            detail: { oldTheme, newTheme: theme }
        }));
        
        // Log para analytics (opcional)
        if (window.analytics) {
            window.analytics.track('theme_change', { theme });
        }
    }
    
    /**
     * Alterna entre temas
     */
    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme, true);
    }
    
    /**
     * Atualiza o ícone do botão de toggle
     */
    updateToggleIcon() {
        const icon = document.querySelector('#themeToggle i');
        if (icon) {
            icon.className = this.currentTheme === 'light' ? 'bi bi-moon-stars' : 'bi bi-sun-fill';
        }
        
        const button = document.getElementById('themeToggle');
        if (button) {
            const label = this.currentTheme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro';
            button.setAttribute('aria-label', label);
            button.setAttribute('title', label);
        }
    }
    
    /**
     * Atualiza a meta tag theme-color
     */
    updateMetaThemeColor(theme) {
        const colors = {
            light: '#087f5b',
            dark: '#111b17'
        };
        
        let metaTag = document.querySelector('meta[name="theme-color"]');
        
        if (!metaTag) {
            metaTag = document.createElement('meta');
            metaTag.name = 'theme-color';
            document.head.appendChild(metaTag);
        }
        
        metaTag.content = colors[theme];
    }
    
    /**
     * Auto-switch baseado em horário (6h-18h = light, 18h-6h = dark)
     */
    checkAutoSwitch() {
        const autoSwitch = localStorage.getItem('autoSwitch');
        
        if (autoSwitch !== 'enabled') {
            return;
        }
        
        const hour = new Date().getHours();
        const shouldBeDark = hour < 6 || hour >= 18;
        const idealTheme = shouldBeDark ? 'dark' : 'light';
        
        if (this.currentTheme !== idealTheme) {
            this.applyTheme(idealTheme, false);
        }
        
        // Verificar novamente em 1 hora
        setTimeout(() => this.checkAutoSwitch(), 60 * 60 * 1000);
    }
    
    /**
     * Habilitar auto-switch
     */
    enableAutoSwitch() {
        localStorage.setItem('autoSwitch', 'enabled');
        this.checkAutoSwitch();
        if (window.utils) {
            window.utils.showToast('Auto-switch de tema ativado', 'success');
        }
    }
    
    /**
     * Desabilitar auto-switch
     */
    disableAutoSwitch() {
        localStorage.setItem('autoSwitch', 'disabled');
        if (window.utils) {
            window.utils.showToast('Auto-switch de tema desativado', 'info');
        }
    }
    
    /**
     * Resetar para preferência do sistema
     */
    reset() {
        localStorage.removeItem('theme');
        const systemTheme = this.getSystemPreference();
        this.applyTheme(systemTheme, true);
        if (window.utils) {
            window.utils.showToast('Tema resetado para preferência do sistema', 'info');
        }
    }
    
    /**
     * Obter informações do tema atual
     */
    getInfo() {
        return {
            current: this.currentTheme,
            system: this.systemPreference,
            saved: localStorage.getItem('theme'),
            autoSwitch: localStorage.getItem('autoSwitch') === 'enabled'
        };
    }
}

// Criar instância global
window.themeManager = new ThemeManager();

// Função global para compatibilidade com código existente
function toggleTheme() {
    window.themeManager.toggle();
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

console.log('✅ Theme Manager loaded');
console.log('📊 Theme info:', window.themeManager.getInfo());
