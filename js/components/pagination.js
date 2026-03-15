/**
 * ============================================================================
 * COMPONENTE DE PAGINAÇÃO GENÉRICO - VERSÃO 2.0.0
 * ============================================================================
 *
 * Melhorias em relação à v1.0.0:
 *  - Botões numéricos com janela deslizante + reticências inteligentes
 *  - Botões "Primeira" e "Última" página
 *  - Info de resultados: "Exibindo X–Y de Z itens"
 *  - Eliminado href="#" (usava <a>, causava scroll para o topo)
 *  - Múltiplas instâncias simultâneas (sem dependência de window.pagination)
 *  - Scroll suave ao topo da tabela ao trocar de página
 *  - Validação defensiva em setItems() e goToPage()
 *  - Método destroy() para limpeza de referências
 *  - Método getState() para snapshot/debug
 *
 * @author Dione Castro Alves - InNovaIdeia
 * @version 2.0.0
 * @date 2026
 */

window.Pagination = class {

    // =========================================================================
    // CONSTRUTOR
    // =========================================================================

    /**
     * @param {number}   itemsPerPage   - Itens exibidos por página (padrão: 20)
     * @param {Function} renderCallback - Função chamada com os itens da página atual
     * @param {Object}   options        - Opções adicionais (ver defaults abaixo)
     */
    constructor(itemsPerPage = 20, renderCallback = null, options = {}) {
        this.itemsPerPage   = Math.max(1, parseInt(itemsPerPage) || 20);
        this.currentPage    = 1;
        this.totalItems     = 0;
        this.items          = [];
        this.renderCallback = renderCallback;

        // Configurações com defaults
        const defaults = {
            containerId   : 'pagination-controls', // ID do container dos controles
            scrollTargetId: 'products-table',      // ID do elemento para scroll ao trocar página
            maxPageButtons: 5,                     // Máx. de botões numéricos visíveis (deve ser ímpar)
            showInfo      : true,                  // Exibir "Exibindo X–Y de Z itens"
            showFirstLast : true,                  // Exibir botões Primeira/Última
        };

        this._opts = { ...defaults, ...options };

        // ID único da instância: permite múltiplos paginadores na mesma página
        // sem conflito de referência global (window.pagination).
        this._instanceId = `pagination_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Registra a instância globalmente pelo ID único para que os botões
        // gerados via innerHTML possam chamá-la sem depender de window.pagination.
        window[this._instanceId] = this;
    }

    // =========================================================================
    // API PÚBLICA
    // =========================================================================

    /**
     * Define a lista completa de itens (já filtrados/ordenados) e reseta para página 1.
     * @param {Array} items
     */
    setItems(items) {
        // Validação defensiva: garante array mesmo com entrada inválida
        this.items      = Array.isArray(items) ? items : [];
        this.totalItems = this.items.length;
        this.currentPage = 1;
        this._updateDisplay();
    }

    /**
     * Navega para uma página específica (base 1).
     * @param {number} page
     */
    goToPage(page) {
        const parsed = parseInt(page);
        if (isNaN(parsed) || parsed < 1 || parsed > this.getTotalPages()) return;
        this.currentPage = parsed;
        this._updateDisplay();
        this._scrollToTable();
    }

    /** Avança para a próxima página. */
    nextPage() {
        this.goToPage(this.currentPage + 1);
    }

    /** Retrocede para a página anterior. */
    prevPage() {
        this.goToPage(this.currentPage - 1);
    }

    /** Vai para a primeira página. */
    firstPage() {
        this.goToPage(1);
    }

    /** Vai para a última página. */
    lastPage() {
        this.goToPage(this.getTotalPages());
    }

    /**
     * Troca o callback de renderização.
     * Útil quando a tabela é recriada no DOM (ex.: re-render completo do módulo).
     * @param {Function} callback
     */
    setRenderCallback(callback) {
        if (typeof callback !== 'function') {
            console.warn('[Pagination] setRenderCallback: argumento não é uma função.');
            return;
        }
        this.renderCallback = callback;
    }

    // =========================================================================
    // CONSULTAS
    // =========================================================================

    /** Retorna o total de páginas calculado. */
    getTotalPages() {
        if (this.totalItems === 0) return 1;
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }

    /** Retorna os itens da página atual. */
    getCurrentPageItems() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        return this.items.slice(start, start + this.itemsPerPage);
    }

    /**
     * Retorna um snapshot do estado atual (útil para debug).
     * @returns {Object}
     */
    getState() {
        return {
            currentPage : this.currentPage,
            totalPages  : this.getTotalPages(),
            totalItems  : this.totalItems,
            itemsPerPage: this.itemsPerPage,
            pageStart   : (this.currentPage - 1) * this.itemsPerPage + 1,
            pageEnd     : Math.min(this.currentPage * this.itemsPerPage, this.totalItems),
        };
    }

    /**
     * Remove a instância da referência global e limpa o container.
     * Chamar ao destruir o módulo pai para evitar memory leaks.
     */
    destroy() {
        const container = document.getElementById(this._opts.containerId);
        if (container) container.innerHTML = '';
        delete window[this._instanceId];
    }

    // =========================================================================
    // MÉTODOS PRIVADOS
    // =========================================================================

    /**
     * Chama o renderCallback com os itens da página e atualiza os controles.
     * @private
     */
    _updateDisplay() {
        if (typeof this.renderCallback === 'function') {
            this.renderCallback(this.getCurrentPageItems());
        }
        this._renderControls();
    }

    /**
     * Faz scroll suave até o topo da tabela (se o elemento existir no DOM).
     * @private
     */
    _scrollToTable() {
        const target = document.getElementById(this._opts.scrollTargetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Constrói e injeta os controles de paginação no container.
     * @private
     */
    _renderControls() {
        const container = document.getElementById(this._opts.containerId);
        if (!container) return;

        const totalPages = this.getTotalPages();

        // Oculta controles quando não há necessidade de paginar
        if (totalPages <= 1 && this.totalItems <= this.itemsPerPage) {
            container.innerHTML = this._opts.showInfo && this.totalItems > 0
                ? `<div class="text-muted small text-center mt-2">
                       ${this._buildInfoText()}
                   </div>`
                : '';
            return;
        }

        container.innerHTML = `
            <div class="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2 mt-3">

                ${this._opts.showInfo ? `
                <div class="text-muted small">
                    ${this._buildInfoText()}
                </div>` : '<div></div>'}

                <nav aria-label="Navegação de páginas">
                    <ul class="pagination pagination-sm mb-0">

                        ${this._opts.showFirstLast ? `
                        <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"
                            title="Primeira página">
                            <button class="page-link"
                                    onclick="window['${this._instanceId}'].firstPage()"
                                    aria-label="Primeira página"
                                    ${this.currentPage === 1 ? 'disabled' : ''}>
                                <i class="bi bi-chevron-double-left"></i>
                            </button>
                        </li>` : ''}

                        <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}"
                            title="Página anterior">
                            <button class="page-link"
                                    onclick="window['${this._instanceId}'].prevPage()"
                                    aria-label="Página anterior"
                                    ${this.currentPage === 1 ? 'disabled' : ''}>
                                <i class="bi bi-chevron-left"></i>
                            </button>
                        </li>

                        ${this._buildPageButtons()}

                        <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"
                            title="Próxima página">
                            <button class="page-link"
                                    onclick="window['${this._instanceId}'].nextPage()"
                                    aria-label="Próxima página"
                                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </li>

                        ${this._opts.showFirstLast ? `
                        <li class="page-item ${this.currentPage === totalPages ? 'disabled' : ''}"
                            title="Última página">
                            <button class="page-link"
                                    onclick="window['${this._instanceId}'].lastPage()"
                                    aria-label="Última página"
                                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                                <i class="bi bi-chevron-double-right"></i>
                            </button>
                        </li>` : ''}

                    </ul>
                </nav>
            </div>
        `;
    }

    /**
     * Gera os botões numéricos com janela deslizante e reticências.
     *
     * Exemplo com maxPageButtons=5, totalPages=10, currentPage=6:
     *   [1] … [4] [5] [6★] [7] [8] … [10]
     *
     * @private
     * @returns {string} HTML dos <li> de páginas numéricas
     */
    _buildPageButtons() {
        const totalPages = this.getTotalPages();
        const max        = this._opts.maxPageButtons;

        // Calcula a janela de páginas ao redor da atual
        let windowStart = Math.max(2, this.currentPage - Math.floor(max / 2));
        let windowEnd   = Math.min(totalPages - 1, windowStart + max - 1);

        // Ajusta a janela se estiver no final
        if (windowEnd === totalPages - 1) {
            windowStart = Math.max(2, windowEnd - max + 1);
        }

        const pages = [];

        // Sempre mostra a página 1
        pages.push(this._buildPageItem(1));

        // Reticências à esquerda
        if (windowStart > 2) {
            pages.push(`<li class="page-item disabled">
                            <span class="page-link border-0 bg-transparent">…</span>
                        </li>`);
        }

        // Janela central
        for (let p = windowStart; p <= windowEnd; p++) {
            pages.push(this._buildPageItem(p));
        }

        // Reticências à direita
        if (windowEnd < totalPages - 1) {
            pages.push(`<li class="page-item disabled">
                            <span class="page-link border-0 bg-transparent">…</span>
                        </li>`);
        }

        // Sempre mostra a última página (se > 1)
        if (totalPages > 1) {
            pages.push(this._buildPageItem(totalPages));
        }

        return pages.join('');
    }

    /**
     * Gera o <li> de um botão numérico individual.
     * @private
     * @param {number} page
     * @returns {string}
     */
    _buildPageItem(page) {
        const isActive = page === this.currentPage;
        return `
            <li class="page-item ${isActive ? 'active' : ''}"
                ${isActive ? 'aria-current="page"' : ''}>
                <button class="page-link"
                        onclick="window['${this._instanceId}'].goToPage(${page})"
                        ${isActive ? 'disabled' : ''}
                        aria-label="Página ${page}">
                    ${page}
                </button>
            </li>
        `;
    }

    /**
     * Monta o texto informativo "Exibindo X–Y de Z itens".
     * @private
     * @returns {string}
     */
    _buildInfoText() {
        if (this.totalItems === 0) return 'Nenhum item encontrado';
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end   = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
        return `Exibindo <strong>${start}–${end}</strong> de <strong>${this.totalItems}</strong> ${this.totalItems === 1 ? 'item' : 'itens'}`;
    }
};
