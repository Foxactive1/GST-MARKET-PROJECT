/**
 * pedidos.js — Módulo de Pedidos de Compra
 * Supermercado Pro / GST Market
 *
 * Integrações:
 *   → Fornecedores : vincula pedido ao cadastro de fornecedores
 *   → Estoque      : receber pedido incrementa qtd e atualiza precoCusto
 *   → Price Intel. : sugere preço unitário baseado no histórico de mercado
 *   → State        : persiste pedidos via state.savePedido / updatePedido / receberPedidoItens
 *
 * Fluxo de status:
 *   rascunho → enviado → recebido_parcial → recebido
 *                    ↘ cancelado (de qualquer estado exceto recebido)
 *
 * Dependências:
 *   window.state   — com patch state-pedidos-patch.js aplicado
 *   window.utils   — utils.js v5.0+
 *   window.priceIntelligence (opcional) — para sugestão de preço
 *
 * @author Dione Castro Alves — InNovaIdeia
 * @version 1.0.0
 * @date 2026-03-15
 */

window.pedidos = (function () {
    'use strict';

    // =========================================================================
    // DEPENDÊNCIAS (lazy getters)
    // =========================================================================
    const dep = {
        get state()            { return window.state; },
        get utils()            { return window.utils; },
        get priceIntelligence(){ return window.priceIntelligence || null; },
        get Swal()             { return typeof Swal !== 'undefined' ? Swal : null; }
    };

    function checkDependencies() {
        if (!dep.state || !dep.utils) {
            console.error('[Pedidos] Dependências obrigatórias ausentes: state, utils');
            return false;
        }
        if (!dep.priceIntelligence) {
            console.warn('[Pedidos] priceIntelligence não disponível — sugestões de preço desabilitadas');
        }
        return true;
    }

    // =========================================================================
    // CONFIGURAÇÃO
    // =========================================================================
    const CONFIG = {
        estoqueMinimoPadrao: 5,   // usado quando produto não tem estoque_min definido
        statusLabels: {
            rascunho:          { label: 'Rascunho',          badge: 'bg-secondary' },
            enviado:           { label: 'Enviado',            badge: 'bg-primary'   },
            recebido_parcial:  { label: 'Recebido Parcial',   badge: 'bg-warning text-dark' },
            recebido:          { label: 'Recebido',           badge: 'bg-success'   },
            cancelado:         { label: 'Cancelado',          badge: 'bg-danger'    }
        },
        unidades: ['un', 'kg', 'cx', 'lt', 'pct', 'fardo', 'dz']
    };

    // =========================================================================
    // ESTADO INTERNO DA UI
    // =========================================================================
    const UI_STATE = {
        filtroStatus:   'todos',
        filtroFornec:   '',
        pedidoAtivo:    null,   // pedido em edição/recebimento
        itensDraft:     [],     // itens do pedido em criação
        fornecedorDraft: null
    };

    // =========================================================================
    // HELPERS — ESCAPE XSS
    // =========================================================================
    function esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // =========================================================================
    // HELPERS — STATE COM FALLBACK LOCALTORAGE
    // =========================================================================
    const Storage = {
        _key: 'pedidos_supermercado',

        getPedidos() {
            // Tenta state.js primeiro
            if (dep.state && typeof dep.state.getPedidos === 'function') {
                return dep.state.getPedidos();
            }
            // Fallback localStorage
            try {
                return JSON.parse(localStorage.getItem(this._key) || '[]');
            } catch { return []; }
        },

        savePedido(pedido) {
            if (dep.state && typeof dep.state.savePedido === 'function') {
                return dep.state.savePedido(pedido);
            }
            const list = this.getPedidos();
            list.push(pedido);
            localStorage.setItem(this._key, JSON.stringify(list));
            return true;
        },

        updatePedido(id, changes) {
            if (dep.state && typeof dep.state.updatePedido === 'function') {
                return dep.state.updatePedido(id, changes);
            }
            const list = this.getPedidos().map(p => p.id === id ? { ...p, ...changes } : p);
            localStorage.setItem(this._key, JSON.stringify(list));
            return true;
        },

        deletePedido(id) {
            if (dep.state && typeof dep.state.deletePedido === 'function') {
                return dep.state.deletePedido(id);
            }
            const list = this.getPedidos().filter(p => p.id !== id);
            localStorage.setItem(this._key, JSON.stringify(list));
            return true;
        },

        receberPedidoItens(pedidoId, itensRecebidos) {
            if (dep.state && typeof dep.state.receberPedidoItens === 'function') {
                return dep.state.receberPedidoItens(pedidoId, itensRecebidos);
            }
            // Fallback manual (sem atualizar estoque do state)
            console.warn('[Pedidos] receberPedidoItens: state.receberPedidoItens não encontrado — estoque não atualizado');
            return false;
        },

        getNextNumero() {
            if (dep.state && typeof dep.state.getNextPedidoNumero === 'function') {
                return dep.state.getNextPedidoNumero();
            }
            const year = new Date().getFullYear();
            const seq  = this.getPedidos().filter(p => p.numero?.startsWith(`PC-${year}-`)).length + 1;
            return `PC-${year}-${String(seq).padStart(4, '0')}`;
        }
    };

    // =========================================================================
    // HELPERS — INTEGRAÇÕES
    // =========================================================================

    /** Retorna lista de fornecedores do state */
    function getFornecedores() {
        try {
            if (typeof dep.state.getFornecedores === 'function') return dep.state.getFornecedores();
            return dep.state.get().fornecedores || [];
        } catch { return []; }
    }

    /** Retorna lista de produtos do state */
    function getProdutos() {
        try {
            if (typeof dep.state.getProducts === 'function') return dep.state.getProducts();
            return dep.state.get().products || [];
        } catch { return []; }
    }

    /** Retorna produtos abaixo do estoque mínimo */
    function getProdutosEstoqueCritico() {
        return getProdutos().filter(p => {
            const min = p.estoqueMin || p.estoque_min || CONFIG.estoqueMinimoPadrao;
            return (p.qtd || 0) <= min;
        });
    }

    /**
     * Sugere preço de compra para um produto via Price Intelligence.
     * Usa o último preço de mercado vinculado ao produto no histórico.
     * Aplica desconto de 20% (markup inverso: preço de venda → custo estimado).
     */
    function getPriceSuggestion(produtoId) {
        try {
            const pi = dep.priceIntelligence;
            if (!pi || typeof pi.getHistory !== 'function') return null;

            const history = pi.getHistory();
            const linked  = history
                .filter(h => h.productId === produtoId)
                .sort((a, b) => new Date(b.date) - new Date(a.date));

            if (linked.length === 0) return null;

            // Custo estimado = preço de mercado / 1.20 (markup 20%)
            const marketPrice = linked[0].price;
            return {
                precoSugerido: marketPrice / 1.20,
                precoMercado:  marketPrice,
                fonte:         linked[0].store || 'Mercado Livre',
                data:          linked[0].date
            };
        } catch { return null; }
    }

    // =========================================================================
    // RENDERIZAÇÃO PRINCIPAL
    // =========================================================================
    function render() {
        if (!checkDependencies()) {
            const c = document.getElementById('mainContent');
            if (c) c.innerHTML = `<div class="alert alert-danger m-4">
                <i class="bi bi-exclamation-triangle"></i> Erro ao carregar módulo Pedidos. Dependências ausentes.
            </div>`;
            return;
        }

        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="fade-in" id="pedidos-root">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">
                            <i class="bi bi-cart-plus text-primary"></i> Pedidos de Compra
                        </h2>
                        <p class="text-muted mb-0">Gerencie reposição de estoque junto aos fornecedores</p>
                    </div>
                    <button class="btn btn-primary" id="btn-novo-pedido">
                        <i class="bi bi-plus-lg"></i> Novo Pedido
                    </button>
                </div>

                <!-- Alertas de estoque crítico -->
                <div id="alerta-estoque-critico"></div>

                <!-- Filtros -->
                <div class="card-modern mb-4">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label small">Status</label>
                            <select id="filtro-status-pedido" class="form-select">
                                <option value="todos">Todos</option>
                                <option value="rascunho">Rascunho</option>
                                <option value="enviado">Enviado</option>
                                <option value="recebido_parcial">Recebido Parcial</option>
                                <option value="recebido">Recebido</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div class="col-md-5">
                            <label class="form-label small">Fornecedor</label>
                            <select id="filtro-fornec-pedido" class="form-select">
                                <option value="">Todos os fornecedores</option>
                                ${getFornecedores().map(f =>
                                    `<option value="${esc(f.id)}">${esc(f.nome)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <button class="btn btn-outline-secondary w-100" id="btn-atualizar-lista">
                                <i class="bi bi-arrow-clockwise"></i> Atualizar
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Lista de pedidos -->
                <div id="lista-pedidos-container"></div>
            </div>

            <!-- Modal: Novo / Editar Pedido -->
            <div class="modal fade" id="modal-pedido" tabindex="-1" aria-labelledby="modal-pedido-label" aria-hidden="true">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modal-pedido-label">
                                <i class="bi bi-cart-plus"></i> Novo Pedido de Compra
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="modal-pedido-body">
                            <!-- Preenchido dinamicamente -->
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-warning" id="btn-salvar-rascunho">
                                <i class="bi bi-save"></i> Salvar Rascunho
                            </button>
                            <button class="btn btn-primary" id="btn-salvar-enviar">
                                <i class="bi bi-send"></i> Salvar e Enviar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal: Receber Pedido -->
            <div class="modal fade" id="modal-receber" tabindex="-1" aria-labelledby="modal-receber-label" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title" id="modal-receber-label">
                                <i class="bi bi-box-seam"></i> Registrar Recebimento
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="modal-receber-body">
                            <!-- Preenchido dinamicamente -->
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button class="btn btn-success" id="btn-confirmar-recebimento">
                                <i class="bi bi-check-lg"></i> Confirmar Recebimento
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal: Visualizar Pedido / Imprimir -->
            <div class="modal fade" id="modal-visualizar" tabindex="-1" aria-labelledby="modal-visualizar-label" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="modal-visualizar-label">
                                <i class="bi bi-file-text"></i> Ordem de Compra
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="modal-visualizar-body"></div>
                        <div class="modal-footer">
                            <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>
                            <button class="btn btn-outline-primary" id="btn-imprimir-pedido">
                                <i class="bi bi-printer"></i> Imprimir / PDF
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderAlertaEstoqueCritico();
        renderListaPedidos();
        attachEventsDelegation();
    }

    // =========================================================================
    // ALERTA DE ESTOQUE CRÍTICO
    // =========================================================================
    function renderAlertaEstoqueCritico() {
        const criticos = getProdutosEstoqueCritico();
        const el = document.getElementById('alerta-estoque-critico');
        if (!el) return;

        if (criticos.length === 0) { el.innerHTML = ''; return; }

        el.innerHTML = `
            <div class="alert alert-warning alert-dismissible fade show mb-4" role="alert">
                <div class="d-flex align-items-start">
                    <i class="bi bi-exclamation-triangle-fill fs-5 me-3 mt-1 flex-shrink-0"></i>
                    <div class="flex-grow-1">
                        <strong>${criticos.length} produto(s) com estoque crítico</strong>
                        <div class="mt-2 d-flex flex-wrap gap-1">
                            ${criticos.slice(0, 8).map(p => `
                                <span class="badge bg-warning text-dark">
                                    ${esc(p.nome)} — ${p.qtd || 0} ${p.unidade || 'un'}
                                </span>
                            `).join('')}
                            ${criticos.length > 8 ? `<span class="badge bg-secondary">+${criticos.length - 8} mais</span>` : ''}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-warning ms-3" id="btn-pedido-estoque-critico">
                        <i class="bi bi-plus-lg"></i> Criar Pedido
                    </button>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }

    // =========================================================================
    // LISTA DE PEDIDOS
    // =========================================================================
    function renderListaPedidos() {
        const container = document.getElementById('lista-pedidos-container');
        if (!container) return;

        let pedidos = Storage.getPedidos();

        // Aplica filtros
        if (UI_STATE.filtroStatus !== 'todos') {
            pedidos = pedidos.filter(p => p.status === UI_STATE.filtroStatus);
        }
        if (UI_STATE.filtroFornec) {
            pedidos = pedidos.filter(p => p.fornecedorId === UI_STATE.filtroFornec);
        }

        // Ordena por data de criação decrescente
        pedidos = pedidos.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));

        if (pedidos.length === 0) {
            container.innerHTML = `
                <div class="card-modern text-center py-5">
                    <i class="bi bi-inbox text-muted" style="font-size:3rem;"></i>
                    <p class="text-muted mt-3 mb-0">Nenhum pedido encontrado</p>
                    <button class="btn btn-primary mt-3" id="btn-novo-pedido-vazio">
                        <i class="bi bi-plus-lg"></i> Criar Primeiro Pedido
                    </button>
                </div>
            `;
            document.getElementById('btn-novo-pedido-vazio')?.addEventListener('click', abrirModalNovoPedido);
            return;
        }

        // KPIs rápidos
        const todos       = Storage.getPedidos();
        const kpiEnviado  = todos.filter(p => p.status === 'enviado').length;
        const kpiParcial  = todos.filter(p => p.status === 'recebido_parcial').length;
        const kpiTotal    = todos.reduce((s, p) => s + (p.totalEstimado || 0), 0);

        container.innerHTML = `
            <!-- KPIs -->
            <div class="row g-3 mb-4">
                <div class="col-md-3">
                    <div class="metric-card">
                        <div class="metric-label">Total de Pedidos</div>
                        <div class="metric-value">${todos.length}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="metric-card">
                        <div class="metric-label">Aguardando Entrega</div>
                        <div class="metric-value text-primary">${kpiEnviado}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="metric-card">
                        <div class="metric-label">Recebimento Parcial</div>
                        <div class="metric-value text-warning">${kpiParcial}</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="metric-card">
                        <div class="metric-label">Volume Total (estimado)</div>
                        <div class="metric-value text-success">${dep.utils.formatCurrencyBR(kpiTotal)}</div>
                    </div>
                </div>
            </div>

            <!-- Tabela -->
            <div class="card-modern">
                <div class="table-responsive">
                    <table class="table-modern">
                        <thead>
                            <tr>
                                <th>Nº Pedido</th>
                                <th>Fornecedor</th>
                                <th>Itens</th>
                                <th>Total Estimado</th>
                                <th>Prazo</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedidos.map(p => renderLinhaPedido(p)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function renderLinhaPedido(p) {
        const st     = CONFIG.statusLabels[p.status] || { label: p.status, badge: 'bg-secondary' };
        const prazo  = p.prazoEntrega
            ? dep.utils.formatDate(p.prazoEntrega)
            : '<span class="text-muted">—</span>';
        const venceu = p.prazoEntrega && new Date(p.prazoEntrega) < new Date()
            && p.status !== 'recebido' && p.status !== 'cancelado';

        const acoes = (() => {
            const btns = [];
            btns.push(`<button class="btn btn-sm btn-outline-secondary" data-action="visualizar" data-id="${esc(p.id)}" title="Visualizar">
                <i class="bi bi-eye"></i>
            </button>`);
            if (p.status === 'rascunho') {
                btns.push(`<button class="btn btn-sm btn-outline-primary ms-1" data-action="editar" data-id="${esc(p.id)}" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>`);
                btns.push(`<button class="btn btn-sm btn-outline-success ms-1" data-action="enviar" data-id="${esc(p.id)}" title="Marcar como Enviado">
                    <i class="bi bi-send"></i>
                </button>`);
            }
            if (p.status === 'enviado' || p.status === 'recebido_parcial') {
                btns.push(`<button class="btn btn-sm btn-success ms-1" data-action="receber" data-id="${esc(p.id)}" title="Registrar Recebimento">
                    <i class="bi bi-box-seam"></i>
                </button>`);
            }
            if (p.status !== 'recebido' && p.status !== 'cancelado') {
                btns.push(`<button class="btn btn-sm btn-outline-danger ms-1" data-action="cancelar" data-id="${esc(p.id)}" title="Cancelar Pedido">
                    <i class="bi bi-x-lg"></i>
                </button>`);
            }
            if (p.status === 'rascunho') {
                btns.push(`<button class="btn btn-sm btn-outline-danger ms-1" data-action="excluir" data-id="${esc(p.id)}" title="Excluir">
                    <i class="bi bi-trash"></i>
                </button>`);
            }
            return btns.join('');
        })();

        return `
            <tr>
                <td>
                    <strong>${esc(p.numero)}</strong>
                    <br>
                    <small class="text-muted">${dep.utils.formatDate(p.dataCriacao)}</small>
                </td>
                <td>${esc(p.fornecedorNome)}</td>
                <td>
                    <span class="badge bg-info">${p.itens?.length || 0} produtos</span>
                    <br>
                    <small class="text-muted">${(p.itens || []).reduce((s, i) => s + (i.qtdSolicitada || 0), 0)} un total</small>
                </td>
                <td class="fw-bold">${dep.utils.formatCurrencyBR(p.totalEstimado || 0)}</td>
                <td class="${venceu ? 'text-danger fw-bold' : ''}">
                    ${venceu ? '<i class="bi bi-exclamation-circle me-1"></i>' : ''}${prazo}
                </td>
                <td><span class="badge ${st.badge}">${st.label}</span></td>
                <td>
                    <div class="d-flex flex-wrap gap-1">${acoes}</div>
                </td>
            </tr>
        `;
    }

    // =========================================================================
    // MODAL: NOVO / EDITAR PEDIDO
    // =========================================================================
    function abrirModalNovoPedido(pedidoExistente = null) {
        UI_STATE.itensDraft    = pedidoExistente ? JSON.parse(JSON.stringify(pedidoExistente.itens || [])) : [];
        UI_STATE.pedidoAtivo   = pedidoExistente;
        UI_STATE.fornecedorDraft = pedidoExistente?.fornecedorId || null;

        renderModalNovoPedido(pedidoExistente);

        const modal = bootstrap.Modal.getOrCreate(document.getElementById('modal-pedido'));
        modal.show();
    }

    function renderModalNovoPedido(pedido = null) {
        const body      = document.getElementById('modal-pedido-body');
        const title     = document.getElementById('modal-pedido-label');
        if (!body) return;

        title.innerHTML = pedido
            ? `<i class="bi bi-pencil"></i> Editar Pedido ${esc(pedido.numero)}`
            : `<i class="bi bi-cart-plus"></i> Novo Pedido de Compra`;

        const fornecedores = getFornecedores();
        const produtos     = getProdutos();
        const criticos     = getProdutosEstoqueCritico();

        // Pré-seleciona fornecedor se existente
        const fornecOpts = fornecedores.map(f => `
            <option value="${esc(f.id)}" ${pedido?.fornecedorId === f.id ? 'selected' : ''}>
                ${esc(f.nome)} ${f.fone ? '— ' + esc(f.fone) : ''}
            </option>
        `).join('');

        body.innerHTML = `
            <div class="row g-3 mb-4">
                <!-- Fornecedor -->
                <div class="col-md-6">
                    <label class="form-label">Fornecedor <span class="text-danger">*</span></label>
                    <select id="pedido-fornecedor" class="form-select">
                        <option value="">Selecione o fornecedor...</option>
                        ${fornecOpts}
                    </select>
                    <div id="info-fornecedor" class="mt-2"></div>
                </div>
                <!-- Prazo de entrega -->
                <div class="col-md-3">
                    <label class="form-label">Prazo de Entrega</label>
                    <input type="date" id="pedido-prazo" class="form-control"
                           value="${pedido?.prazoEntrega ? pedido.prazoEntrega.split('T')[0] : ''}">
                </div>
                <!-- Observações -->
                <div class="col-md-3">
                    <label class="form-label">Observações</label>
                    <input type="text" id="pedido-obs" class="form-control"
                           placeholder="Ex: entrega no período da manhã"
                           value="${esc(pedido?.observacoes || '')}">
                </div>
            </div>

            <!-- Adicionar item -->
            <div class="card-modern mb-3" style="background: var(--bs-tertiary-bg, #f8f9fa);">
                <h6 class="mb-3"><i class="bi bi-plus-circle text-primary me-2"></i>Adicionar Produto</h6>
                <div class="row g-2 align-items-end">
                    <div class="col-md-4">
                        <label class="form-label small">Produto</label>
                        <select id="add-produto-select" class="form-select">
                            <option value="">Selecione...</option>
                            ${produtos.map(p => {
                                const critico = criticos.some(c => c.id === p.id);
                                return `<option value="${esc(p.id)}" ${critico ? 'data-critico="1"' : ''}>
                                    ${critico ? '⚠️ ' : ''}${esc(p.nome)} (estoque: ${p.qtd || 0})
                                </option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Qtd Solicitada</label>
                        <input type="number" id="add-qtd" class="form-control" min="1" value="1" placeholder="Qtd">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label small">Unidade</label>
                        <select id="add-unidade" class="form-select">
                            ${CONFIG.unidades.map(u => `<option value="${u}">${u}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label small">
                            Preço Unit. (R$)
                            <span id="badge-preco-sugerido" class="badge bg-info ms-1" style="display:none;cursor:pointer;"
                                  title="Clique para aplicar o preço sugerido">💡 Sugerido</span>
                        </label>
                        <input type="text" id="add-preco" class="form-control" placeholder="0,00">
                    </div>
                    <div class="col-md-1">
                        <button class="btn btn-success w-100" id="btn-add-item-pedido" title="Adicionar item">
                            <i class="bi bi-plus-lg"></i>
                        </button>
                    </div>
                </div>
                <div id="info-preco-sugerido" class="mt-2"></div>
            </div>

            <!-- Lista de itens do pedido -->
            <div id="itens-pedido-lista"></div>

            <!-- Totalizador -->
            <div class="d-flex justify-content-end mt-3">
                <div class="card-modern text-end" style="min-width:220px;">
                    <small class="text-muted">Total Estimado</small>
                    <div class="h4 fw-bold text-success mb-0" id="total-estimado-pedido">
                        ${dep.utils.formatCurrencyBR(calcularTotal(UI_STATE.itensDraft))}
                    </div>
                </div>
            </div>
        `;

        renderItensDraft();
        attachModalPedidoEvents();

        // Se há itens críticos e é novo pedido, pré-sugere adicionar
        if (!pedido && criticos.length > 0) {
            const select = document.getElementById('add-produto-select');
            if (select && criticos[0]) select.value = criticos[0].id;
            onProdutoSelecionado(criticos[0].id);
        }

        // Preenche info do fornecedor se já selecionado
        if (pedido?.fornecedorId) onFornecedorSelecionado(pedido.fornecedorId);
    }

    function renderItensDraft() {
        const container = document.getElementById('itens-pedido-lista');
        if (!container) return;

        if (UI_STATE.itensDraft.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-3 border rounded">
                    <i class="bi bi-cart text-muted" style="font-size:2rem;"></i>
                    <p class="mt-2 mb-0">Nenhum item adicionado ainda</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="table-responsive">
                <table class="table table-sm align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Produto</th>
                            <th>Qtd</th>
                            <th>Un.</th>
                            <th>Preço Unit.</th>
                            <th>Subtotal</th>
                            <th>Est. Atual</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${UI_STATE.itensDraft.map((item, idx) => `
                            <tr>
                                <td>
                                    <strong>${esc(item.produtoNome)}</strong>
                                    ${item.precoSugerido > 0 && item.precoUnitario > 0
                                        ? `<br><small class="text-muted">Sugerido: ${dep.utils.formatCurrencyBR(item.precoSugerido)}</small>`
                                        : ''}
                                </td>
                                <td>
                                    <input type="number" class="form-control form-control-sm"
                                           style="width:75px;" min="1"
                                           value="${item.qtdSolicitada}"
                                           data-action="update-qtd" data-idx="${idx}">
                                </td>
                                <td>${esc(item.unidade || 'un')}</td>
                                <td>
                                    <input type="text" class="form-control form-control-sm"
                                           style="width:100px;"
                                           value="${dep.utils.formatCurrency(item.precoUnitario || 0)}"
                                           data-action="update-preco" data-idx="${idx}">
                                </td>
                                <td class="fw-bold text-success">
                                    ${dep.utils.formatCurrencyBR((item.qtdSolicitada || 0) * (item.precoUnitario || 0))}
                                </td>
                                <td>
                                    <span class="badge ${(item.estoqueAtual || 0) <= (item.estoqueMinimo || CONFIG.estoqueMinimoPadrao) ? 'bg-warning text-dark' : 'bg-light text-dark'}">
                                        ${item.estoqueAtual || 0}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-sm btn-outline-danger"
                                            data-action="remover-item" data-idx="${idx}">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        atualizarTotalEstimado();
    }

    function attachModalPedidoEvents() {
        // Seleção de fornecedor
        document.getElementById('pedido-fornecedor')?.addEventListener('change', e => {
            UI_STATE.fornecedorDraft = e.target.value;
            onFornecedorSelecionado(e.target.value);
        });

        // Seleção de produto — carrega sugestão de preço
        document.getElementById('add-produto-select')?.addEventListener('change', e => {
            onProdutoSelecionado(e.target.value);
        });

        // Badge "Sugerido" — aplica preço sugerido ao campo
        document.getElementById('badge-preco-sugerido')?.addEventListener('click', () => {
            const produtoId  = document.getElementById('add-produto-select')?.value;
            if (!produtoId) return;
            const suggestion = getPriceSuggestion(produtoId);
            if (suggestion) {
                const campo = document.getElementById('add-preco');
                if (campo) {
                    campo.value = dep.utils.formatCurrency(suggestion.precoSugerido);
                }
            }
        });

        // Botão adicionar item
        document.getElementById('btn-add-item-pedido')?.addEventListener('click', adicionarItemDraft);

        // Delegação na tabela de itens
        const listaEl = document.getElementById('itens-pedido-lista');
        if (listaEl) {
            listaEl.addEventListener('change', e => {
                const idx = parseInt(e.target.dataset.idx);
                if (isNaN(idx)) return;

                if (e.target.dataset.action === 'update-qtd') {
                    UI_STATE.itensDraft[idx].qtdSolicitada = parseInt(e.target.value) || 1;
                    atualizarTotalEstimado();
                    renderItensDraft();
                }
                if (e.target.dataset.action === 'update-preco') {
                    UI_STATE.itensDraft[idx].precoUnitario = dep.utils.parseCurrencyBR(e.target.value);
                    atualizarTotalEstimado();
                    renderItensDraft();
                }
            });

            listaEl.addEventListener('click', e => {
                const btn = e.target.closest('[data-action="remover-item"]');
                if (btn) {
                    const idx = parseInt(btn.dataset.idx);
                    UI_STATE.itensDraft.splice(idx, 1);
                    renderItensDraft();
                }
            });
        }

        // Botões do footer do modal
        document.getElementById('btn-salvar-rascunho')?.addEventListener('click', () => salvarPedidoModal('rascunho'));
        document.getElementById('btn-salvar-enviar')?.addEventListener('click',   () => salvarPedidoModal('enviado'));
    }

    function onFornecedorSelecionado(fornecedorId) {
        const infoEl = document.getElementById('info-fornecedor');
        if (!infoEl) return;

        if (!fornecedorId) { infoEl.innerHTML = ''; return; }

        const forn = getFornecedores().find(f => f.id === fornecedorId);
        if (!forn) { infoEl.innerHTML = ''; return; }

        infoEl.innerHTML = `
            <div class="p-2 rounded" style="background:var(--bs-tertiary-bg, #f0f0f0); font-size:.85rem;">
                ${forn.fone ? `<i class="bi bi-telephone me-1"></i>${esc(forn.fone)}` : ''}
                ${forn.email ? ` &nbsp;·&nbsp; <i class="bi bi-envelope me-1"></i>${esc(forn.email)}` : ''}
                ${forn.contato ? ` &nbsp;·&nbsp; <i class="bi bi-person me-1"></i>${esc(forn.contato)}` : ''}
            </div>
        `;
    }

    function onProdutoSelecionado(produtoId) {
        if (!produtoId) return;

        const badgeEl = document.getElementById('badge-preco-sugerido');
        const infoEl  = document.getElementById('info-preco-sugerido');
        if (badgeEl) badgeEl.style.display = 'none';
        if (infoEl)  infoEl.innerHTML = '';

        const suggestion = getPriceSuggestion(produtoId);
        if (!suggestion) return;

        if (badgeEl) badgeEl.style.display = 'inline';
        if (infoEl) {
            infoEl.innerHTML = `
                <small class="text-info">
                    <i class="bi bi-lightbulb me-1"></i>
                    Price Intelligence: último preço de mercado
                    <strong>${dep.utils.formatCurrencyBR(suggestion.precoMercado)}</strong>
                    (${esc(suggestion.fonte)}, ${dep.utils.formatDate(suggestion.data)}) →
                    preço de compra sugerido: <strong>${dep.utils.formatCurrencyBR(suggestion.precoSugerido)}</strong>
                </small>
            `;
        }
    }

    function adicionarItemDraft() {
        const produtoId = document.getElementById('add-produto-select')?.value;
        const qtd       = parseInt(document.getElementById('add-qtd')?.value) || 1;
        const unidade   = document.getElementById('add-unidade')?.value || 'un';
        const precoRaw  = document.getElementById('add-preco')?.value || '0';
        const preco     = dep.utils.parseCurrencyBR(precoRaw);

        if (!produtoId) {
            dep.utils.showToast('Selecione um produto', 'warning');
            return;
        }

        // Não duplicar
        if (UI_STATE.itensDraft.some(i => i.produtoId === produtoId)) {
            dep.utils.showToast('Produto já adicionado — edite a quantidade na tabela', 'warning');
            return;
        }

        const produto    = getProdutos().find(p => p.id === produtoId);
        if (!produto) return;

        const suggestion = getPriceSuggestion(produtoId);

        UI_STATE.itensDraft.push({
            produtoId,
            produtoNome:    produto.nome,
            unidade,
            qtdSolicitada:  qtd,
            qtdRecebida:    0,
            precoUnitario:  preco,
            precoSugerido:  suggestion?.precoSugerido || 0,
            estoqueAtual:   produto.qtd || 0,
            estoqueMinimo:  produto.estoqueMin || produto.estoque_min || CONFIG.estoqueMinimoPadrao
        });

        renderItensDraft();

        // Limpa campos de adição
        const selectEl = document.getElementById('add-produto-select');
        const qtdEl    = document.getElementById('add-qtd');
        const precoEl  = document.getElementById('add-preco');
        const badgeEl  = document.getElementById('badge-preco-sugerido');
        const infoEl   = document.getElementById('info-preco-sugerido');
        if (selectEl) selectEl.value = '';
        if (qtdEl)    qtdEl.value    = '1';
        if (precoEl)  precoEl.value  = '';
        if (badgeEl)  badgeEl.style.display = 'none';
        if (infoEl)   infoEl.innerHTML = '';
    }

    function calcularTotal(itens) {
        return (itens || []).reduce((s, i) => s + ((i.qtdSolicitada || 0) * (i.precoUnitario || 0)), 0);
    }

    function atualizarTotalEstimado() {
        const el = document.getElementById('total-estimado-pedido');
        if (el) el.textContent = dep.utils.formatCurrencyBR(calcularTotal(UI_STATE.itensDraft));
    }

    function salvarPedidoModal(status) {
        const fornecedorId = document.getElementById('pedido-fornecedor')?.value;
        const prazo        = document.getElementById('pedido-prazo')?.value;
        const obs          = document.getElementById('pedido-obs')?.value.trim();

        if (!fornecedorId) {
            dep.utils.showToast('Selecione um fornecedor', 'warning');
            return;
        }
        if (UI_STATE.itensDraft.length === 0) {
            dep.utils.showToast('Adicione ao menos um produto ao pedido', 'warning');
            return;
        }

        const fornecedor    = getFornecedores().find(f => f.id === fornecedorId);
        const totalEstimado = calcularTotal(UI_STATE.itensDraft);
        const isEdicao      = !!UI_STATE.pedidoAtivo;

        if (isEdicao) {
            Storage.updatePedido(UI_STATE.pedidoAtivo.id, {
                fornecedorId,
                fornecedorNome: fornecedor?.nome || fornecedorId,
                status,
                prazoEntrega:   prazo ? new Date(prazo).toISOString() : null,
                dataEnvio:      status === 'enviado' ? new Date().toISOString() : UI_STATE.pedidoAtivo.dataEnvio,
                itens:          UI_STATE.itensDraft,
                observacoes:    obs,
                totalEstimado
            });
            dep.utils.showToast(`Pedido ${UI_STATE.pedidoAtivo.numero} atualizado`, 'success');
        } else {
            const novoPedido = {
                id:              dep.utils.generateId('ped'),
                numero:          Storage.getNextNumero(),
                fornecedorId,
                fornecedorNome:  fornecedor?.nome || fornecedorId,
                status,
                dataCriacao:     new Date().toISOString(),
                dataEnvio:       status === 'enviado' ? new Date().toISOString() : null,
                prazoEntrega:    prazo ? new Date(prazo).toISOString() : null,
                dataRecebimento: null,
                itens:           UI_STATE.itensDraft,
                observacoes:     obs,
                totalEstimado,
                totalRecebido:   0
            };
            Storage.savePedido(novoPedido);
            dep.utils.showToast(`Pedido ${novoPedido.numero} criado`, 'success');
        }

        bootstrap.Modal.getInstance(document.getElementById('modal-pedido'))?.hide();
        UI_STATE.itensDraft  = [];
        UI_STATE.pedidoAtivo = null;
        renderListaPedidos();
    }

    // =========================================================================
    // MODAL: RECEBER PEDIDO
    // =========================================================================
    function abrirModalReceber(pedidoId) {
        const pedido = Storage.getPedidos().find(p => p.id === pedidoId);
        if (!pedido) return;

        UI_STATE.pedidoAtivo = pedido;

        const body = document.getElementById('modal-receber-body');
        if (!body) return;

        body.innerHTML = `
            <div class="alert alert-info mb-3">
                <strong>${esc(pedido.numero)}</strong> —
                Fornecedor: <strong>${esc(pedido.fornecedorNome)}</strong>
                ${pedido.prazoEntrega ? ` · Prazo: ${dep.utils.formatDate(pedido.prazoEntrega)}` : ''}
            </div>

            <p class="text-muted small mb-3">
                Informe as quantidades efetivamente recebidas. O estoque será atualizado automaticamente.
                Deixe 0 para itens não recebidos.
            </p>

            <div class="table-responsive">
                <table class="table table-sm align-middle">
                    <thead class="table-light">
                        <tr>
                            <th>Produto</th>
                            <th>Solicitado</th>
                            <th>Qtd Recebida</th>
                            <th>Preço Unit. (R$)</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedido.itens.map((item, idx) => `
                            <tr>
                                <td>
                                    <strong>${esc(item.produtoNome)}</strong>
                                    <br>
                                    <small class="text-muted">Estoque atual: ${item.estoqueAtual || 0} ${item.unidade || 'un'}</small>
                                </td>
                                <td>
                                    <span class="badge bg-secondary">${item.qtdSolicitada} ${item.unidade || 'un'}</span>
                                </td>
                                <td>
                                    <input type="number" class="form-control form-control-sm receber-qtd"
                                           style="width:90px;" min="0"
                                           max="${item.qtdSolicitada * 2}"
                                           value="${item.qtdSolicitada}"
                                           data-produto-id="${esc(item.produtoId)}"
                                           data-idx="${idx}">
                                </td>
                                <td>
                                    <input type="text" class="form-control form-control-sm receber-preco"
                                           style="width:110px;"
                                           value="${dep.utils.formatCurrency(item.precoUnitario || 0)}"
                                           data-produto-id="${esc(item.produtoId)}"
                                           data-idx="${idx}">
                                </td>
                                <td class="fw-bold receber-subtotal" data-idx="${idx}">
                                    ${dep.utils.formatCurrencyBR((item.qtdSolicitada || 0) * (item.precoUnitario || 0))}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" class="text-end fw-bold">Total Recebido:</td>
                            <td class="fw-bold text-success" id="total-recebimento">
                                ${dep.utils.formatCurrencyBR(pedido.itens.reduce((s, i) => s + i.qtdSolicitada * i.precoUnitario, 0))}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="mt-3">
                <label class="form-label small">Observações do Recebimento</label>
                <input type="text" id="obs-recebimento" class="form-control"
                       placeholder="Ex: faltaram 2 caixas de arroz, entregue com avaria...">
            </div>
        `;

        // Atualiza subtotais ao editar
        body.addEventListener('input', e => {
            if (e.target.classList.contains('receber-qtd') || e.target.classList.contains('receber-preco')) {
                atualizarTotalRecebimento();
            }
        });

        document.getElementById('btn-confirmar-recebimento').onclick = () => confirmarRecebimento(pedidoId);

        bootstrap.Modal.getOrCreate(document.getElementById('modal-receber')).show();
    }

    function atualizarTotalRecebimento() {
        let total = 0;
        const rows = document.querySelectorAll('#modal-receber-body tbody tr');
        rows.forEach((row, idx) => {
            const qtdEl   = row.querySelector('.receber-qtd');
            const precoEl = row.querySelector('.receber-preco');
            if (!qtdEl || !precoEl) return;

            const qtd   = parseFloat(qtdEl.value) || 0;
            const preco = dep.utils.parseCurrencyBR(precoEl.value);
            const sub   = qtd * preco;
            total += sub;

            const subEl = row.querySelector('.receber-subtotal');
            if (subEl) subEl.textContent = dep.utils.formatCurrencyBR(sub);
        });

        const totalEl = document.getElementById('total-recebimento');
        if (totalEl) totalEl.textContent = dep.utils.formatCurrencyBR(total);
    }

    function confirmarRecebimento(pedidoId) {
        const pedido = Storage.getPedidos().find(p => p.id === pedidoId);
        if (!pedido) return;

        const itensRecebidos = [];
        const rows = document.querySelectorAll('#modal-receber-body tbody tr');
        rows.forEach(row => {
            const qtdEl   = row.querySelector('.receber-qtd');
            const precoEl = row.querySelector('.receber-preco');
            if (!qtdEl) return;

            itensRecebidos.push({
                produtoId:    qtdEl.dataset.produtoId,
                qtdRecebida:  parseFloat(qtdEl.value) || 0,
                precoUnitario: dep.utils.parseCurrencyBR(precoEl?.value || '0')
            });
        });

        const obs = document.getElementById('obs-recebimento')?.value.trim();

        const ok = Storage.receberPedidoItens(pedidoId, itensRecebidos);

        if (ok) {
            // Salva observação de recebimento se preenchida
            if (obs) {
                Storage.updatePedido(pedidoId, {
                    observacoesRecebimento: obs
                });
            }
            dep.utils.showToast('Recebimento registrado e estoque atualizado!', 'success');
        } else {
            // Se receberPedidoItens falhou (patch não aplicado), ao menos atualiza status
            const totalRecebido = itensRecebidos.reduce((s, i) => s + i.qtdRecebida * i.precoUnitario, 0);
            const pedidoAtual   = Storage.getPedidos().find(p => p.id === pedidoId);
            const itensAtualizados = (pedidoAtual?.itens || []).map(item => {
                const recv = itensRecebidos.find(r => r.produtoId === item.produtoId);
                return recv ? { ...item, qtdRecebida: recv.qtdRecebida, precoUnitario: recv.precoUnitario } : item;
            });
            const alguemParcial = itensAtualizados.some(i => i.qtdRecebida < i.qtdSolicitada);
            Storage.updatePedido(pedidoId, {
                itens:           itensAtualizados,
                totalRecebido,
                status:          alguemParcial ? 'recebido_parcial' : 'recebido',
                dataRecebimento: new Date().toISOString()
            });
            dep.utils.showToast('Recebimento registrado. Integre o state-pedidos-patch.js para atualizar o estoque automaticamente.', 'warning');
        }

        bootstrap.Modal.getInstance(document.getElementById('modal-receber'))?.hide();
        renderListaPedidos();
    }

    // =========================================================================
    // MODAL: VISUALIZAR / IMPRIMIR
    // =========================================================================
    function abrirModalVisualizar(pedidoId) {
        const pedido = Storage.getPedidos().find(p => p.id === pedidoId);
        if (!pedido) return;

        const body = document.getElementById('modal-visualizar-body');
        if (!body) return;

        const st = CONFIG.statusLabels[pedido.status] || { label: pedido.status, badge: 'bg-secondary' };
        const fornecedor = getFornecedores().find(f => f.id === pedido.fornecedorId);

        body.innerHTML = `
            <div id="print-area">
                <!-- Cabeçalho -->
                <div class="d-flex justify-content-between align-items-start mb-4">
                    <div>
                        <h4 class="mb-1">Ordem de Compra</h4>
                        <h3 class="text-primary mb-0">${esc(pedido.numero)}</h3>
                    </div>
                    <span class="badge ${st.badge} fs-6">${st.label}</span>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-6">
                        <small class="text-muted d-block">Fornecedor</small>
                        <strong>${esc(pedido.fornecedorNome)}</strong>
                        ${fornecedor?.fone ? `<br><small>${esc(fornecedor.fone)}</small>` : ''}
                        ${fornecedor?.email ? `<br><small>${esc(fornecedor.email)}</small>` : ''}
                    </div>
                    <div class="col-3">
                        <small class="text-muted d-block">Data do Pedido</small>
                        <strong>${dep.utils.formatDate(pedido.dataCriacao)}</strong>
                    </div>
                    <div class="col-3">
                        <small class="text-muted d-block">Prazo de Entrega</small>
                        <strong>${pedido.prazoEntrega ? dep.utils.formatDate(pedido.prazoEntrega) : '—'}</strong>
                    </div>
                </div>

                <hr>

                <table class="table table-sm table-bordered mb-3">
                    <thead class="table-light">
                        <tr>
                            <th>#</th>
                            <th>Produto</th>
                            <th class="text-center">Qtd Sol.</th>
                            <th class="text-center">Qtd Rec.</th>
                            <th class="text-end">Preço Unit.</th>
                            <th class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pedido.itens.map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${esc(item.produtoNome)}</td>
                                <td class="text-center">${item.qtdSolicitada} ${esc(item.unidade || 'un')}</td>
                                <td class="text-center">${item.qtdRecebida || 0} ${esc(item.unidade || 'un')}</td>
                                <td class="text-end">${dep.utils.formatCurrencyBR(item.precoUnitario || 0)}</td>
                                <td class="text-end fw-bold">${dep.utils.formatCurrencyBR((item.qtdSolicitada || 0) * (item.precoUnitario || 0))}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="table-light">
                            <td colspan="5" class="text-end fw-bold">Total Estimado:</td>
                            <td class="text-end fw-bold text-success">${dep.utils.formatCurrencyBR(pedido.totalEstimado || 0)}</td>
                        </tr>
                        ${pedido.totalRecebido > 0 ? `
                            <tr>
                                <td colspan="5" class="text-end fw-bold">Total Recebido:</td>
                                <td class="text-end fw-bold text-primary">${dep.utils.formatCurrencyBR(pedido.totalRecebido)}</td>
                            </tr>
                        ` : ''}
                    </tfoot>
                </table>

                ${pedido.observacoes ? `
                    <div class="alert alert-light border mb-0">
                        <small class="text-muted d-block">Observações</small>
                        ${esc(pedido.observacoes)}
                    </div>
                ` : ''}
                ${pedido.observacoesRecebimento ? `
                    <div class="alert alert-info border mt-2 mb-0">
                        <small class="text-muted d-block">Obs. Recebimento</small>
                        ${esc(pedido.observacoesRecebimento)}
                    </div>
                ` : ''}
            </div>
        `;

        document.getElementById('btn-imprimir-pedido').onclick = () => {
            const printContent = document.getElementById('print-area')?.innerHTML;
            const win = window.open('', '_blank', 'width=800,height=600');
            if (win) {
                win.document.write(`<!doctype html><html><head>
                    <meta charset="utf-8">
                    <title>${pedido.numero}</title>
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
                    <style>@media print { body { margin: 20px; } }</style>
                    </head><body class="p-4">${printContent}
                    <script>window.onload = function(){ window.print(); }<\/script>
                    </body></html>`);
                win.document.close();
            }
        };

        bootstrap.Modal.getOrCreate(document.getElementById('modal-visualizar')).show();
    }

    // =========================================================================
    // AÇÕES: ENVIAR / CANCELAR / EXCLUIR
    // =========================================================================
    async function enviarPedido(pedidoId) {
        const { isConfirmed } = await dep.utils.showConfirm(
            'Marcar como Enviado?',
            'O pedido será marcado como enviado ao fornecedor.'
        );
        if (!isConfirmed) return;

        Storage.updatePedido(pedidoId, {
            status:    'enviado',
            dataEnvio: new Date().toISOString()
        });
        dep.utils.showToast('Pedido marcado como enviado', 'success');
        renderListaPedidos();
    }

    async function cancelarPedido(pedidoId) {
        const { isConfirmed } = await dep.utils.showConfirm(
            'Cancelar Pedido?',
            'Esta ação não pode ser desfeita.',
            'Sim, cancelar'
        );
        if (!isConfirmed) return;

        Storage.updatePedido(pedidoId, { status: 'cancelado' });
        dep.utils.showToast('Pedido cancelado', 'info');
        renderListaPedidos();
    }

    async function excluirPedido(pedidoId) {
        const pedido = Storage.getPedidos().find(p => p.id === pedidoId);
        if (pedido?.status !== 'rascunho') {
            dep.utils.showToast('Apenas rascunhos podem ser excluídos', 'warning');
            return;
        }
        const { isConfirmed } = await dep.utils.showConfirm(
            'Excluir Rascunho?',
            `O rascunho ${pedido.numero} será removido permanentemente.`,
            'Excluir'
        );
        if (!isConfirmed) return;

        Storage.deletePedido(pedidoId);
        dep.utils.showToast('Rascunho excluído', 'info');
        renderListaPedidos();
    }

    // =========================================================================
    // DELEGAÇÃO DE EVENTOS PRINCIPAL
    // =========================================================================
    function attachEventsDelegation() {
        // Botão "Novo Pedido" no header
        document.getElementById('btn-novo-pedido')?.addEventListener('click', () => abrirModalNovoPedido());

        // Botão "Criar Pedido" no alerta de estoque crítico
        document.getElementById('btn-pedido-estoque-critico')?.addEventListener('click', () => abrirModalNovoPedido());

        // Filtros
        document.getElementById('filtro-status-pedido')?.addEventListener('change', e => {
            UI_STATE.filtroStatus = e.target.value;
            renderListaPedidos();
        });
        document.getElementById('filtro-fornec-pedido')?.addEventListener('change', e => {
            UI_STATE.filtroFornec = e.target.value;
            renderListaPedidos();
        });
        document.getElementById('btn-atualizar-lista')?.addEventListener('click', () => {
            renderAlertaEstoqueCritico();
            renderListaPedidos();
        });

        // Ações da tabela (delegação no root)
        const root = document.getElementById('pedidos-root');
        if (!root) return;

        root.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;
            const id     = btn.dataset.id;

            switch (action) {
                case 'visualizar': abrirModalVisualizar(id); break;
                case 'editar': {
                    const ped = Storage.getPedidos().find(p => p.id === id);
                    if (ped) abrirModalNovoPedido(ped);
                    break;
                }
                case 'enviar':   enviarPedido(id);   break;
                case 'receber':  abrirModalReceber(id); break;
                case 'cancelar': cancelarPedido(id); break;
                case 'excluir':  excluirPedido(id);  break;
            }
        });
    }

    // =========================================================================
    // API PÚBLICA
    // =========================================================================
    return {
        render,
        // Acesso externo para integração com outros módulos
        getPedidos:   () => Storage.getPedidos(),
        abrirNovoPedido: () => abrirModalNovoPedido()
    };

})();

console.log('%c📋 pedidos.js v1.0.0 — InNovaIdeia carregado', 'color: #10b981; font-weight: bold; font-size: 12px');
