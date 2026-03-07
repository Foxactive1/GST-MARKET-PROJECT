/**
 * Módulo de Fornecedores
 * Responsável pela gestão de fornecedores e compras
 * Integrado com state, utils e modals
 */

window.fornecedores = (function() {
    'use strict';

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
        // Garantir que state.suppliers seja um array (fallback)
        const suppliers = window.state.getSuppliers() || [];

        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">Gestão de Fornecedores</h2>
                        <p class="text-muted mb-0">
                            <i class="bi bi-truck"></i> 
                            ${suppliers.length} fornecedores cadastrados
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-success" onclick="window.modals.openSupplierModal()">
                            <i class="bi bi-plus-lg"></i> Novo Fornecedor
                        </button>
                        <button class="btn btn-outline-secondary ms-2" onclick="window.fornecedores.exportFornecedores()">
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
                                       oninput="window.fornecedores.filter()">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Tabela de Fornecedores -->
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
                                    <th style="width: 100px;">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="fornecedores-table-body">
                                ${renderFornecedoresRows(filterFornecedores(suppliers))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-3 text-muted small" id="table-info">
                        <!-- Info será atualizada dinamicamente -->
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================
    // RENDERIZAÇÃO DAS LINHAS
    // ========================================
    function renderFornecedoresRows(suppliers) {
        if (!suppliers || suppliers.length === 0) {
            return `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="bi bi-truck text-muted" style="font-size: 3rem;"></i>
                        <p class="text-muted mt-3 mb-0">Nenhum fornecedor encontrado</p>
                        <button class="btn btn-success btn-sm mt-3" onclick="window.modals.openSupplierModal()">
                            <i class="bi bi-plus-lg"></i> Cadastrar Fornecedor
                        </button>
                    </td>
                </tr>
            `;
        }

        updateTableInfo(suppliers.length);

        return suppliers.map(s => `
            <tr>
                <td><strong>${s.nome}</strong></td>
                <td>${window.utils.formatCNPJ ? window.utils.formatCNPJ(s.cnpj) : (s.cnpj || '-')}</td>
                <td>${window.utils.formatPhone ? window.utils.formatPhone(s.fone) : (s.fone || '-')}</td>
                <td>${s.email || '-'}</td>
                <td>${s.contato || '-'}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="window.modals.openSupplierModal('${s.id}')" title="Editar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="window.fornecedores.excluir('${s.id}')" title="Excluir">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // ========================================
    // FILTRAGEM
    // ========================================
    function filterFornecedores(suppliers) {
        const search = document.getElementById('fornecedores-search')?.value?.toLowerCase() || '';
        if (!search) return suppliers;

        return suppliers.filter(s => 
            (s.nome || '').toLowerCase().includes(search) ||
            (s.cnpj || '').includes(search) ||
            (s.fone || '').includes(search) ||
            (s.email || '').toLowerCase().includes(search) ||
            (s.contato || '').toLowerCase().includes(search)
        );
    }

    function filter() {
        const tbody = document.getElementById('fornecedores-table-body');
        if (tbody) {
            const allSuppliers = window.state.getSuppliers() || [];
            const filtered = filterFornecedores(allSuppliers);
            tbody.innerHTML = renderFornecedoresRows(filtered);
        }
    }

    function updateTableInfo(count) {
        const infoElement = document.getElementById('table-info');
        if (infoElement) {
            // Proteção contra undefined
            const total = (window.state.getSuppliers() || []).length;
            infoElement.innerHTML = `
                <i class="bi bi-info-circle"></i>
                Exibindo ${count} de ${total} fornecedor(es)
            `;
        }
    }

    // ========================================
    // AÇÕES
    // ========================================
    function excluir(id) {
        if (!checkDependencies()) return;

        const supplier = (window.state.getSuppliers() || []).find(s => s.id === id);
        if (!supplier) return;

        window.utils.showConfirm(
            'Remover fornecedor?',
            `Tem certeza que deseja remover "${supplier.nome}"? Esta ação não poderá ser desfeita.`
        ).then((result) => {
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
            'Razão Social': s.nome,
            'CNPJ': s.cnpj || '',
            'Inscrição Estadual': s.ie || '',
            'Telefone': s.fone || '',
            'Email': s.email || '',
            'Endereço': s.endereco || '',
            'Contato': s.contato || '',
            'Observações': s.obs || '',
            'Data Cadastro': window.utils.formatDate(s.createdAt)
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
        exportFornecedores
    };
})();