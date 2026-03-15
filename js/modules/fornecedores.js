/**
 * Módulo de Fornecedores
 * Responsável pela gestão de fornecedores e compras
 * Integrado com state, utils, modals e estoque inteligente
 *
 * MELHORIAS v1.2.0 (2026-03-13) — Dione Castro Alves - InNovaIdeia
 * - SEGURANÇA: esc() em todos os dados de usuário inseridos via innerHTML (anti-XSS)
 * - BUG: showToast tipo 'error' corrigido para 'danger' (tipo válido em utils.js)
 * - BUG: ternário obsoleto de formatCNPJ removido (função existe em utils.js v2.2.0)
 * - QUALIDADE: updateTableInfo() removido de dentro de renderFornecedoresRows()
 *              Era side-effect em função de render; agora fica em filter() e render()
 * - QUALIDADE: verProdutos() e sugestaoPedido() com guard para Swal + fallback nativo
 * - ACESSIBILIDADE: aria-label adicionado em todos os botões de ação da tabela
 */

window.fornecedores = (function() {
    'use strict';

    // ========================================
    // SEGURANÇA — escape de HTML (anti-XSS)
    // Aplicado em QUALQUER dado vindo do usuário antes de inserir em innerHTML
    // ========================================
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ========================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Fornecedores: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Fornecedores: window.utils não definido');
            return false;
        }
        if (!window.modals) {
            console.error('Erro no módulo Fornecedores: window.modals não definido');
            return false;
        }
        return true;
    }

    // ========================================
    // UTILITÁRIOS
    // ========================================
    function countProductsBySupplier(supplierId) {
        const products = window.state.getProducts() || [];
        return products.filter(p => p.supplierId === supplierId).length;
    }

    // ========================================
    // RENDERIZAÇÃO PRINCIPAL
    // ========================================
    function render() {
        if (!checkDependencies()) {
            document.getElementById('mainContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    Erro ao carregar módulo Fornecedores. Dependências não encontradas.
                </div>
            `;
            return;
        }

        const container = document.getElementById('mainContent');
        const suppliers = window.state.getSuppliers() || [];
        const filtered  = filterFornecedores(suppliers);

        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">Gestão de Fornecedores</h2>
                        <p class="text-muted mb-0">
                            <i class="bi bi-truck"></i>
                            ${suppliers.length} fornecedor(es) cadastrado(s)
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-success"
                                onclick="window.modals.openSupplierModal()"
                                aria-label="Cadastrar novo fornecedor">
                            <i class="bi bi-plus-lg"></i> Novo Fornecedor
                        </button>
                        <button class="btn btn-outline-secondary ms-2"
                                onclick="window.fornecedores.exportFornecedores()"
                                aria-label="Exportar lista de fornecedores para CSV">
                            <i class="bi bi-download"></i> Exportar
                        </button>
                    </div>
                </div>

                <!-- Busca -->
                <div class="card-modern mb-4">
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="search-box">
                                <i class="bi bi-search"></i>
                                <input type="text" id="fornecedores-search" class="form-control"
                                       placeholder="Buscar por nome, CNPJ ou telefone..."
                                       oninput="window.fornecedores.filter()"
                                       aria-label="Buscar fornecedores">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabela -->
                <div class="card-modern">
                    <div class="table-responsive">
                        <table class="table-modern" id="fornecedores-table">
                            <thead>
                                <tr>
                                    <th>Razão Social</th>
                                    <th>CNPJ</th>
                                    <th>Telefone</th>
                                    <th>Email</th>
                                    <th>Contato</th>
                                    <th>Produtos</th>
                                    <th style="width: 160px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="fornecedores-table-body">
                                ${renderFornecedoresRows(filtered)}
                            </tbody>
                        </table>
                    </div>

                    <div class="mt-3 text-muted small" id="table-info">
                        ${buildTableInfoText(filtered.length, suppliers.length)}
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================
    // RENDERIZAÇÃO DAS LINHAS
    // Responsabilidade única: retornar string HTML.
    // Side-effects (atualizar DOM de rodapé) foram removidos daqui.
    // ========================================
    function renderFornecedoresRows(suppliers) {
        if (!suppliers || suppliers.length === 0) {
            return `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <i class="bi bi-truck text-muted" style="font-size: 3rem;"></i>
                        <p class="text-muted mt-3 mb-0">Nenhum fornecedor encontrado</p>
                        <button class="btn btn-success btn-sm mt-3"
                                onclick="window.modals.openSupplierModal()"
                                aria-label="Cadastrar primeiro fornecedor">
                            <i class="bi bi-plus-lg"></i> Cadastrar Fornecedor
                        </button>
                    </td>
                </tr>
            `;
        }

        return suppliers.map(s => {
            const productCount = countProductsBySupplier(s.id);
            // esc() em todos os campos que vêm do usuário — previne XSS
            const sid = esc(s.id);
            return `
                <tr>
                    <td><strong>${esc(s.nome)}</strong></td>
                    <td>${esc(window.utils.formatCNPJ(s.cnpj))}</td>
                    <td>${esc(window.utils.formatPhone(s.fone))}</td>
                    <td>${esc(s.email) || '-'}</td>
                    <td>${esc(s.contato) || '-'}</td>
                    <td>
                        <span class="badge bg-info">${productCount}</span>
                        <button class="btn btn-sm btn-link"
                                onclick="window.fornecedores.verProdutos('${sid}')"
                                title="Ver produtos vinculados"
                                aria-label="Ver produtos de ${esc(s.nome)}">
                            <i class="bi bi-eye" aria-hidden="true"></i>
                        </button>
                    </td>
                    <td>
                        <div class="btn-group btn-group-sm" role="group"
                             aria-label="Ações para ${esc(s.nome)}">
                            <button class="btn btn-outline-primary"
                                    onclick="window.modals.openSupplierModal('${sid}')"
                                    title="Editar fornecedor"
                                    aria-label="Editar ${esc(s.nome)}">
                                <i class="bi bi-pencil" aria-hidden="true"></i>
                            </button>
                            <button class="btn btn-outline-info"
                                    onclick="window.fornecedores.sugestaoPedido('${sid}')"
                                    title="Gerar sugestão de pedido"
                                    aria-label="Sugestão de pedido para ${esc(s.nome)}">
                                <i class="bi bi-cpu" aria-hidden="true"></i>
                            </button>
                            <button class="btn btn-outline-danger"
                                    onclick="window.fornecedores.excluir('${sid}')"
                                    title="Excluir fornecedor"
                                    aria-label="Excluir ${esc(s.nome)}">
                                <i class="bi bi-trash" aria-hidden="true"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // ========================================
    // FILTRAGEM
    // ========================================
    function filterFornecedores(suppliers) {
        const search = document.getElementById('fornecedores-search')?.value?.toLowerCase() || '';
        if (!search) return suppliers;

        return suppliers.filter(s =>
            (s.nome    || '').toLowerCase().includes(search) ||
            (s.cnpj    || '').includes(search)               ||
            (s.fone    || '').includes(search)               ||
            (s.email   || '').toLowerCase().includes(search) ||
            (s.contato || '').toLowerCase().includes(search)
        );
    }

    /**
     * Chamado pelo oninput da busca.
     * Re-renderiza o tbody E atualiza o rodapé de contagem.
     * Side-effects centralizados aqui, fora de renderFornecedoresRows().
     */
    function filter() {
        const tbody       = document.getElementById('fornecedores-table-body');
        const infoEl      = document.getElementById('table-info');
        if (!tbody) return;

        const all      = window.state.getSuppliers() || [];
        const filtered = filterFornecedores(all);

        tbody.innerHTML = renderFornecedoresRows(filtered);

        if (infoEl) {
            infoEl.innerHTML = buildTableInfoText(filtered.length, all.length);
        }
    }

    /** Texto do rodapé de contagem — sem tocar no DOM diretamente. */
    function buildTableInfoText(shown, total) {
        return `<i class="bi bi-info-circle"></i> Exibindo ${shown} de ${total} fornecedor(es)`;
    }

    // ========================================
    // AÇÕES ESPECÍFICAS
    // ========================================

    /**
     * Exibe modal com todos os produtos vinculados a um fornecedor.
     * Guard para Swal + fallback nativo garantem que a função nunca quebra.
     */
    function verProdutos(supplierId) {
        const supplier = (window.state.getSuppliers() || []).find(s => s.id === supplierId);
        if (!supplier) return;

        const products = (window.state.getProducts() || []).filter(p => p.supplierId === supplierId);

        let html = `
            <div class="text-start">
                <h5 class="mb-3">Produtos fornecidos por ${esc(supplier.nome)}</h5>
        `;

        if (products.length === 0) {
            html += `<p class="text-muted">Nenhum produto vinculado a este fornecedor.</p>`;
        } else {
            html += `
                <table class="table table-sm table-hover">
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Código</th>
                            <th>Estoque</th>
                            <th>Preço</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            products.forEach(p => {
                html += `
                    <tr>
                        <td>${esc(p.nome)}</td>
                        <td>${esc(p.code) || '-'}</td>
                        <td>${esc(p.qtd)} ${esc(p.unit) || 'un'}</td>
                        <td>R$ ${esc(window.utils.formatCurrency(p.preco))}</td>
                    </tr>
                `;
            });
            html += `</tbody></table>`;
        }

        html += `</div>`;

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Produtos do Fornecedor',
                html,
                width: '700px',
                showCloseButton: true,
                showCancelButton: false,
                confirmButtonText: 'Fechar'
            });
        } else {
            // Fallback texto simples
            const list = products.length > 0
                ? products.map(p => `• ${p.nome} — ${p.qtd} ${p.unit || 'un'}`).join('\n')
                : 'Nenhum produto vinculado.';
            alert(`Produtos de ${supplier.nome}:\n\n${list}`);
        }
    }

    /**
     * Gera e exporta CSV com a sugestão de pedido para este fornecedor.
     */
    function sugestaoPedido(supplierId) {
        if (!window.estoque || typeof window.estoque.generateSmartReplenishment !== 'function') {
            // BUG CORRIGIDO: era 'error' (tipo inválido); correto é 'danger'
            window.utils.showToast('Módulo de estoque não disponível', 'danger');
            return;
        }

        const supplier = (window.state.getSuppliers() || []).find(s => s.id === supplierId);
        if (!supplier) return;

        const allSuggestions = window.estoque.generateSmartReplenishment();
        const items          = allSuggestions[supplierId] || [];

        if (items.length === 0) {
            window.utils.showAlert(
                'Sem sugestões',
                'info',
                `Não há produtos do fornecedor ${supplier.nome} que necessitem reposição no momento.`
            );
            return;
        }

        const data = items.map(p => ({
            'Código':              p.code || '',
            'Produto':             p.nome,
            'Estoque Atual':       p.qtd,
            'Ponto de Reposição':  p.rop,
            'Média Diária':        p.avgDaily.toFixed(2),
            'Sugestão de Compra':  p.suggested,
            'Unidade':             p.unit || 'UN',
            'Preço Unitário (R$)': p.cost ? p.cost.toFixed(2) : p.preco.toFixed(2),
            'Valor Total (R$)':    ((p.cost || p.preco) * p.suggested).toFixed(2)
        }));

        window.utils.exportToCSV(
            data,
            `pedido-${supplier.nome.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.csv`
        );

        window.utils.showToast(`Pedido para ${supplier.nome} exportado!`, 'success');
    }

    // ========================================
    // AÇÕES PADRÃO
    // ========================================
    function excluir(id) {
        if (!checkDependencies()) return;

        const supplier = (window.state.getSuppliers() || []).find(s => s.id === id);
        if (!supplier) return;

        const productsCount = countProductsBySupplier(id);
        let message = `Tem certeza que deseja remover "${supplier.nome}"?`;
        if (productsCount > 0) {
            message += ` Este fornecedor possui ${productsCount} produto(s) vinculado(s). Os produtos não serão deletados, mas perderão o vínculo.`;
        }

        window.utils.showConfirm('Remover fornecedor?', message).then(result => {
            if (result.isConfirmed) {
                window.state.deleteSupplier(id);
                window.utils.showToast('Fornecedor removido', 'info');
                render();
            }
        });
    }

    function exportFornecedores() {
        if (!checkDependencies()) return;

        const suppliers = window.state.getSuppliers() || [];
        if (suppliers.length === 0) {
            window.utils.showToast('Nenhum fornecedor para exportar', 'warning');
            return;
        }

        const data = suppliers.map(s => ({
            'Razão Social':       s.nome,
            'CNPJ':               s.cnpj       || '',
            'Inscrição Estadual': s.ie         || '',
            'Telefone':           s.fone       || '',
            'Email':              s.email      || '',
            'Endereço':           s.endereco   || '',
            'Contato':            s.contato    || '',
            'Observações':        s.obs        || '',
            'Data Cadastro':      window.utils.formatDate(s.createdAt),
            'Total de Produtos':  countProductsBySupplier(s.id)
        }));

        window.utils.exportToCSV(data, `fornecedores-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast('Fornecedores exportados!', 'success');
    }

    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        render,
        filter,
        excluir,
        exportFornecedores,
        verProdutos,
        sugestaoPedido
    };
})();
