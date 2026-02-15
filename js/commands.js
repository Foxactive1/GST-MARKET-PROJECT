/**
 * Command Palette - Supermercado Pro
 * Desenvolvido por: Dione Castro Alves - InNovaIdeia
 * 
 * Sistema de comandos rápidos acessível via Ctrl+K
 * Similar ao VS Code Command Palette
 */

class CommandPalette {
    constructor() {
        this.modal = null;
        this.input = null;
        this.list = null;
        this.commands = [];
        this.filteredCommands = [];
        this.selectedIndex = 0;
        this.isOpen = false;
        
        this.init();
    }
    
    /**
     * Inicializa o command palette
     */
    init() {
        this.modal = document.getElementById('commandPalette');
        this.input = document.getElementById('commandInput');
        this.list = document.getElementById('commandList');
        
        if (!this.modal || !this.input || !this.list) {
            console.error('Command Palette elements not found');
            return;
        }
        
        this.registerDefaultCommands();
        this.setupEventListeners();
    }
    
    /**
     * Registra comandos padrão
     */
    registerDefaultCommands() {
        this.commands = [
            // Navegação
            {
                id: 'nav-dashboard',
                label: 'Ir para Dashboard',
                icon: 'bi-speedometer2',
                category: 'Navegação',
                shortcut: 'Ctrl+D',
                action: () => window.app?.switchView('dashboard')
            },
            {
                id: 'nav-pdv',
                label: 'Ir para PDV',
                icon: 'bi-cash-register',
                category: 'Navegação',
                shortcut: 'Ctrl+P',
                action: () => window.app?.switchView('pdv')
            },
            {
                id: 'nav-estoque',
                label: 'Ir para Estoque',
                icon: 'bi-box-seam',
                category: 'Navegação',
                shortcut: 'Ctrl+E',
                action: () => window.app?.switchView('estoque')
            },
            {
                id: 'nav-clientes',
                label: 'Ir para Clientes',
                icon: 'bi-people',
                category: 'Navegação',
                shortcut: 'Ctrl+C',
                action: () => window.app?.switchView('clientes')
            },
            {
                id: 'nav-fidelidade',
                label: 'Ir para Fidelidade',
                icon: 'bi-star',
                category: 'Navegação',
                shortcut: 'Ctrl+F',
                action: () => window.app?.switchView('fidelidade')
            },
            {
                id: 'nav-relatorios',
                label: 'Ir para Relatórios',
                icon: 'bi-graph-up',
                category: 'Navegação',
                shortcut: 'Ctrl+R',
                action: () => window.app?.switchView('relatorios')
            },
            
            // Tema
            {
                id: 'theme-toggle',
                label: 'Alternar Tema Claro/Escuro',
                icon: 'bi-moon-stars',
                category: 'Aparência',
                action: () => window.themeManager?.toggle()
            },
            {
                id: 'theme-light',
                label: 'Ativar Tema Claro',
                icon: 'bi-sun',
                category: 'Aparência',
                action: () => window.themeManager?.applyTheme('light')
            },
            {
                id: 'theme-dark',
                label: 'Ativar Tema Escuro',
                icon: 'bi-moon',
                category: 'Aparência',
                action: () => window.themeManager?.applyTheme('dark')
            },
            {
                id: 'theme-auto',
                label: 'Resetar Tema (Seguir Sistema)',
                icon: 'bi-arrow-clockwise',
                category: 'Aparência',
                action: () => window.themeManager?.reset()
            },
            
            // Ações
            {
                id: 'action-refresh',
                label: 'Recarregar Página',
                icon: 'bi-arrow-clockwise',
                category: 'Ações',
                action: () => location.reload()
            },
            {
                id: 'action-clear-cache',
                label: 'Limpar Cache do Navegador',
                icon: 'bi-trash',
                category: 'Ações',
                action: () => this.clearCache()
            },
            {
                id: 'action-print',
                label: 'Imprimir Página',
                icon: 'bi-printer',
                category: 'Ações',
                shortcut: 'Ctrl+P',
                action: () => window.print()
            },
            
            // Ajuda
            {
                id: 'help-shortcuts',
                label: 'Ver Atalhos de Teclado',
                icon: 'bi-keyboard',
                category: 'Ajuda',
                shortcut: 'Ctrl+Shift+?',
                action: () => this.showKeyboardShortcuts()
            },
            {
                id: 'help-about',
                label: 'Sobre o Sistema',
                icon: 'bi-info-circle',
                category: 'Ajuda',
                action: () => this.showAbout()
            },
            {
                id: 'help-contact',
                label: 'Contato e Suporte',
                icon: 'bi-envelope',
                category: 'Ajuda',
                action: () => window.open('mailto:innovaideia2023@gmail.com')
            }
        ];
    }
    
    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Input change - filtrar comandos
        this.input.addEventListener('input', (e) => {
            this.filterCommands(e.target.value);
        });
        
        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectNext();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectPrevious();
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.executeSelected();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.hide();
                    break;
            }
        });
        
        // Modal events
        this.modal.addEventListener('shown.bs.modal', () => {
            this.isOpen = true;
            this.input.value = '';
            this.input.focus();
            this.filterCommands('');
        });
        
        this.modal.addEventListener('hidden.bs.modal', () => {
            this.isOpen = false;
            this.selectedIndex = 0;
        });
    }
    
    /**
     * Mostra o command palette
     */
    show() {
        const modal = new bootstrap.Modal(this.modal);
        modal.show();
    }
    
    /**
     * Esconde o command palette
     */
    hide() {
        const modal = bootstrap.Modal.getInstance(this.modal);
        if (modal) modal.hide();
    }
    
    /**
     * Filtra comandos baseado na busca
     */
    filterCommands(query) {
        query = query.toLowerCase().trim();
        
        if (!query) {
            this.filteredCommands = [...this.commands];
        } else {
            this.filteredCommands = this.commands.filter(cmd => {
                return cmd.label.toLowerCase().includes(query) ||
                       cmd.category.toLowerCase().includes(query) ||
                       (cmd.shortcut && cmd.shortcut.toLowerCase().includes(query));
            });
        }
        
        this.selectedIndex = 0;
        this.renderCommands();
    }
    
    /**
     * Renderiza lista de comandos
     */
    renderCommands() {
        if (this.filteredCommands.length === 0) {
            this.list.innerHTML = `
                <div class="p-4 text-center text-muted">
                    <i class="bi bi-search fs-3 d-block mb-2"></i>
                    Nenhum comando encontrado
                </div>
            `;
            return;
        }
        
        // Agrupar por categoria
        const grouped = this.groupByCategory(this.filteredCommands);
        
        let html = '';
        
        Object.keys(grouped).forEach(category => {
            html += `
                <div class="command-category">
                    <div class="command-category-label px-3 py-2 text-muted small fw-semibold">
                        ${category}
                    </div>
            `;
            
            grouped[category].forEach((cmd, index) => {
                const globalIndex = this.filteredCommands.indexOf(cmd);
                const isSelected = globalIndex === this.selectedIndex;
                
                html += `
                    <div class="command-item ${isSelected ? 'selected' : ''}" 
                         data-index="${globalIndex}"
                         role="option"
                         aria-selected="${isSelected}">
                        <div class="command-content">
                            <i class="bi ${cmd.icon} me-2"></i>
                            <span class="command-label">${cmd.label}</span>
                        </div>
                        ${cmd.shortcut ? `<kbd class="command-shortcut">${cmd.shortcut}</kbd>` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        this.list.innerHTML = html;
        
        // Add click listeners
        this.list.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectedIndex = index;
                this.executeSelected();
            });
        });
        
        // Scroll to selected
        this.scrollToSelected();
    }
    
    /**
     * Agrupa comandos por categoria
     */
    groupByCategory(commands) {
        return commands.reduce((acc, cmd) => {
            if (!acc[cmd.category]) {
                acc[cmd.category] = [];
            }
            acc[cmd.category].push(cmd);
            return acc;
        }, {});
    }
    
    /**
     * Seleciona próximo comando
     */
    selectNext() {
        if (this.selectedIndex < this.filteredCommands.length - 1) {
            this.selectedIndex++;
            this.renderCommands();
        }
    }
    
    /**
     * Seleciona comando anterior
     */
    selectPrevious() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.renderCommands();
        }
    }
    
    /**
     * Executa comando selecionado
     */
    executeSelected() {
        const command = this.filteredCommands[this.selectedIndex];
        
        if (command && command.action) {
            this.hide();
            
            // Pequeno delay para animação de fechamento
            setTimeout(() => {
                command.action();
            }, 100);
        }
    }
    
    /**
     * Scroll para item selecionado
     */
    scrollToSelected() {
        const selected = this.list.querySelector('.command-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    /**
     * Registra novo comando
     */
    registerCommand(command) {
        if (!command.id || !command.label || !command.action) {
            console.error('Invalid command', command);
            return;
        }
        
        // Remove comando com mesmo ID se existir
        this.commands = this.commands.filter(cmd => cmd.id !== command.id);
        
        // Adiciona novo comando
        this.commands.push({
            category: 'Custom',
            icon: 'bi-lightning',
            ...command
        });
        
        console.log(`✅ Command registered: ${command.label}`);
    }
    
    /**
     * Remove comando
     */
    unregisterCommand(commandId) {
        this.commands = this.commands.filter(cmd => cmd.id !== commandId);
    }
    
    /**
     * Limpa cache
     */
    async clearCache() {
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
            
            if (window.utils) {
                window.utils.showToast('Cache limpo com sucesso', 'success');
            }
            
            setTimeout(() => location.reload(), 1000);
        }
    }
    
    /**
     * Mostra atalhos de teclado
     */
    showKeyboardShortcuts() {
        if (window.utils && window.utils.showAlert) {
            window.utils.showAlert(
                'Atalhos de Teclado',
                'info',
                `
                <div class="text-start">
                    <h6 class="mb-3">Navegação</h6>
                    <ul class="list-unstyled">
                        <li><kbd>Ctrl</kbd> + <kbd>D</kbd> - Dashboard</li>
                        <li><kbd>Ctrl</kbd> + <kbd>P</kbd> - PDV</li>
                        <li><kbd>Ctrl</kbd> + <kbd>E</kbd> - Estoque</li>
                        <li><kbd>Ctrl</kbd> + <kbd>C</kbd> - Clientes</li>
                        <li><kbd>Ctrl</kbd> + <kbd>F</kbd> - Fidelidade</li>
                        <li><kbd>Ctrl</kbd> + <kbd>R</kbd> - Relatórios</li>
                    </ul>
                    
                    <h6 class="mb-3 mt-4">Comandos</h6>
                    <ul class="list-unstyled">
                        <li><kbd>Ctrl</kbd> + <kbd>K</kbd> - Abrir Paleta de Comandos</li>
                        <li><kbd>Esc</kbd> - Fechar modal/dropdown</li>
                        <li><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>?</kbd> - Mostrar atalhos</li>
                    </ul>
                </div>
                `
            );
        }
    }
    
    /**
     * Mostra informações sobre o sistema
     */
    showAbout() {
        if (window.utils && window.utils.showAlert) {
            window.utils.showAlert(
                'Sobre o Sistema',
                'info',
                `
                <div class="text-center">
                    <h4 class="mb-3">Supermercado Pro</h4>
                    <p class="text-muted mb-4">Sistema de Gestão Modular</p>
                    
                    <div class="text-start">
                        <p><strong>Versão:</strong> 1.0.0</p>
                        <p><strong>Desenvolvedor:</strong> Dione Castro Alves</p>
                        <p><strong>Empresa:</strong> InNovaIdeia</p>
                        <p><strong>Contato:</strong> innovaideia2023@gmail.com</p>
                    </div>
                    
                    <div class="mt-4">
                        <a href="https://www.linkedin.com/in/dione-castro-alves" target="_blank" class="btn btn-sm btn-outline-primary me-2">
                            <i class="bi bi-linkedin"></i> LinkedIn
                        </a>
                        <a href="https://github.com/Foxactive1" target="_blank" class="btn btn-sm btn-outline-dark">
                            <i class="bi bi-github"></i> GitHub
                        </a>
                    </div>
                </div>
                `
            );
        }
    }
}

// CSS para command palette (adicionar ao style.css ou inline)
const commandPaletteStyles = `
<style>
    .command-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .command-category {
        border-bottom: 1px solid var(--border-color);
    }
    
    .command-category:last-child {
        border-bottom: none;
    }
    
    .command-category-label {
        background: var(--bg-secondary);
        position: sticky;
        top: 0;
        z-index: 1;
    }
    
    .command-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }
    
    .command-item:hover,
    .command-item.selected {
        background: var(--primary);
        color: white;
    }
    
    .command-item.selected kbd {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border-color: rgba(255, 255, 255, 0.3);
    }
    
    .command-content {
        display: flex;
        align-items: center;
    }
    
    .command-label {
        font-weight: 500;
    }
    
    .command-shortcut {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-family: 'Courier New', monospace;
    }
    
    kbd {
        display: inline-block;
        padding: 0.2rem 0.4rem;
        font-size: 0.875rem;
        font-family: 'Courier New', monospace;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
</style>
`;

// Injetar estilos
if (!document.getElementById('command-palette-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'command-palette-styles';
    styleElement.innerHTML = commandPaletteStyles;
    document.head.appendChild(styleElement);
}

// Criar instância global
window.commands = new CommandPalette();

console.log('✅ Command Palette loaded');
console.log(`📋 ${window.commands.commands.length} commands registered`);
