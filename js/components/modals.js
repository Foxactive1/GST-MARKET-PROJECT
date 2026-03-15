/**
 * Componentes de Modais
 * Responsável por gerenciar todos os modais do sistema
 * Versão integrada com utils aprimorados (máscaras, validações, formatação)
 * AGORA COM CAMPO DE FORNECEDOR NO MODAL DE PRODUTO
 */

window.modals = (function() {
    'use strict';

    // Verifica dependências
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Modals: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Modals: window.utils não definido');
            return false;
        }
        return true;
    }

    let currentProductId = null;
    let currentClientId = null;
    let currentSupplierId = null;

    // ========================================
    // MODAL DE PRODUTO (com fornecedor)
    // ========================================
    function openProductModal(productId = null) {
        if (!checkDependencies()) return;

        currentProductId = productId;

        if (productId) {
            const product = window.state.getProducts().find(p => p.id === productId);
            if (product) {
                showProductModal(product);
                return;
            }
        }

        showProductModal(null);
    }

    function showProductModal(product) {
        const isEditing = !!product;
        // Obter lista de fornecedores para o select
        const suppliers = window.state.getSuppliers() || [];

        Swal.fire({
            title: isEditing ? 'Editar Produto' : 'Novo Produto',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Nome do Produto *</label>
                        <input id="prod-nome" class="form-control" value="${product?.nome || ''}" placeholder="Ex: Arroz Tipo 1 5kg">
                    </div>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">Código/EAN</label>
                            <input id="prod-code" class="form-control" value="${product?.code || ''}" placeholder="789...">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Categoria</label>
                            <select id="prod-categoria" class="form-select">
                                <option value="Alimentos" ${product?.categoria === 'Alimentos' ? 'selected' : ''}>Alimentos</option>
                                <option value="Bebidas" ${product?.categoria === 'Bebidas' ? 'selected' : ''}>Bebidas</option>
                                <option value="Higiene" ${product?.categoria === 'Higiene' ? 'selected' : ''}>Higiene</option>
                                <option value="Limpeza" ${product?.categoria === 'Limpeza' ? 'selected' : ''}>Limpeza</option>
                                <option value="Outros" ${product?.categoria === 'Outros' ? 'selected' : ''}>Outros</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label class="form-label">Quantidade *</label>
                            <input type="number" id="prod-qtd" class="form-control" value="${product?.qtd || ''}" min="0">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Preço (R$) *</label>
                            <input type="text" id="prod-preco" class="form-control" 
                                   value="${product?.preco ? window.utils.formatCurrency(product.preco) : ''}" 
                                   placeholder="0,00"
                                   oninput="this.value = window.utils.maskCurrencyInput(this.value)">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label">Estoque Mín.</label>
                            <input type="number" id="prod-min" class="form-control" value="${product?.minStock || 5}" min="0">
                        </div>
                    </div>
                    
                    <div class="row g-3 mt-2">
                        <div class="col-md-6">
                            <label class="form-label">Unidade</label>
                            <select id="prod-unit" class="form-select">
                                <option value="UN" ${product?.unit === 'UN' ? 'selected' : ''}>Unidade (UN)</option>
                                <option value="KG" ${product?.unit === 'KG' ? 'selected' : ''}>Quilograma (KG)</option>
                                <option value="L" ${product?.unit === 'L' ? 'selected' : ''}>Litro (L)</option>
                                <option value="CX" ${product?.unit === 'CX' ? 'selected' : ''}>Caixa (CX)</option>
                                <option value="PCT" ${product?.unit === 'PCT' ? 'selected' : ''}>Pacote (PCT)</option>
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Preço de Custo (opcional)</label>
                            <input type="text" id="prod-cost" class="form-control" 
                                   value="${product?.cost ? window.utils.formatCurrency(product.cost) : ''}" 
                                   placeholder="0,00"
                                   oninput="this.value = window.utils.maskCurrencyInput(this.value)">
                        </div>
                    </div>
                    
                    <!-- NOVO: Campo de fornecedor -->
                    <div class="row g-3 mt-2">
                        <div class="col-md-12">
                            <label class="form-label">Fornecedor</label>
                            <select id="prod-supplier" class="form-select">
                                <option value="">Nenhum</option>
                                ${suppliers.map(s => 
                                    `<option value="${s.id}" ${product?.supplierId === s.id ? 'selected' : ''}>${s.nome}</option>`
                                ).join('')}
                            </select>
                            <small class="text-muted">Selecione o fornecedor para integração com o estoque inteligente.</small>
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Atualizar' : 'Cadastrar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const nome = document.getElementById('prod-nome').value.trim();
                const code = document.getElementById('prod-code').value.trim();
                const categoria = document.getElementById('prod-categoria').value;
                const qtd = parseInt(document.getElementById('prod-qtd').value) || 0;
                const precoStr = document.getElementById('prod-preco').value;
                const preco = window.utils.parseMonetaryValue(precoStr);
                const minStock = parseInt(document.getElementById('prod-min').value) || 5;
                const unit = document.getElementById('prod-unit').value;
                const costStr = document.getElementById('prod-cost').value;
                const cost = costStr ? window.utils.parseMonetaryValue(costStr) : null;
                const supplierId = document.getElementById('prod-supplier').value || null;

                const data = {
                    nome, code, categoria, qtd, preco, minStock, unit, cost, supplierId
                };

                if (!window.utils.validateProduct(data)) {
                    Swal.showValidationMessage('Preencha todos os campos obrigatórios corretamente.');
                    return false;
                }

                return data;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                if (isEditing) {
                    window.state.updateProduct(product.id, result.value);
                    window.utils.showToast('Produto atualizado!', 'success');
                } else {
                    window.state.addProduct(result.value);
                    window.utils.showToast('Produto cadastrado!', 'success');
                }

                refreshCurrentModule();
            }
        });
    }

    // ========================================
    // MODAL DE CLIENTE (mantido original)
    // ========================================
    function openClientModal(clientId = null) {
        if (!checkDependencies()) return;

        currentClientId = clientId;

        if (clientId) {
            const client = window.state.getClients().find(c => c.id === clientId);
            if (client) {
                showClientModal(client);
                return;
            }
        }

        showClientModal(null);
    }

    function showClientModal(client) {
        const isEditing = !!client;

        Swal.fire({
            title: isEditing ? 'Editar Cliente' : 'Novo Cliente',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Nome Completo *</label>
                        <input id="client-nome" class="form-control" value="${client?.nome || ''}" placeholder="Digite o nome completo">
                    </div>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">CPF</label>
                            <input id="client-cpf" class="form-control" 
                                   value="${client?.cpf || ''}" 
                                   placeholder="000.000.000-00"
                                   oninput="this.value = window.utils.maskCPFInput(this.value)">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Telefone *</label>
                            <input id="client-fone" class="form-control" 
                                   value="${client?.fone || ''}" 
                                   placeholder="(00) 00000-0000"
                                   oninput="this.value = window.utils.maskPhoneInput(this.value)">
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Email</label>
                        <input type="email" id="client-email" class="form-control" value="${client?.email || ''}" placeholder="cliente@email.com">
                    </div>
                    
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label class="form-label">Data de Nascimento</label>
                            <input type="date" id="client-birth" class="form-control" value="${client?.birthDate || ''}">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Gênero</label>
                            <select id="client-gender" class="form-select">
                                <option value="">Não informar</option>
                                <option value="M" ${client?.gender === 'M' ? 'selected' : ''}>Masculino</option>
                                <option value="F" ${client?.gender === 'F' ? 'selected' : ''}>Feminino</option>
                                <option value="O" ${client?.gender === 'O' ? 'selected' : ''}>Outro</option>
                            </select>
                        </div>
                    </div>
                    
                    ${!isEditing ? `
                        <div class="alert alert-info mt-3 mb-0 small">
                            <i class="bi bi-info-circle"></i> 
                            Um código de fidelidade será gerado automaticamente
                            ${window.state.getFidelity().bonus > 0 ? 
                                `e o cliente receberá ${window.state.getFidelity().bonus} pontos de bônus!` : ''}
                        </div>
                    ` : ''}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Atualizar' : 'Cadastrar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const nome = document.getElementById('client-nome').value.trim();
                const cpf = document.getElementById('client-cpf').value.trim();
                const fone = document.getElementById('client-fone').value.trim();
                const email = document.getElementById('client-email').value.trim();
                const birthDate = document.getElementById('client-birth').value;
                const gender = document.getElementById('client-gender').value;

                const data = { nome, cpf, fone, email, birthDate, gender };

                if (!window.utils.validateClient(data)) {
                    Swal.showValidationMessage('Preencha nome e telefone corretamente.');
                    return false;
                }

                return data;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                if (isEditing) {
                    window.state.updateClient(client.id, result.value);
                    window.utils.showToast('Cliente atualizado!', 'success');
                } else {
                    window.state.addClient(result.value);
                    window.utils.showToast('Cliente cadastrado!', 'success');
                }

                refreshCurrentModule();
            }
        });
    }

    // ========================================
    // MODAL DE FORNECEDOR (mantido original)
    // ========================================
    function openSupplierModal(supplierId = null) {
        if (!checkDependencies()) return;

        currentSupplierId = supplierId;

        if (supplierId) {
            const supplier = window.state.getSuppliers().find(s => s.id === supplierId);
            if (supplier) {
                showSupplierModal(supplier);
                return;
            }
        }

        showSupplierModal(null);
    }

    function showSupplierModal(supplier) {
        const isEditing = !!supplier;

        Swal.fire({
            title: isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor',
            html: `
                <div class="text-start">
                    <div class="mb-3">
                        <label class="form-label">Razão Social / Nome *</label>
                        <input id="supplier-nome" class="form-control" value="${supplier?.nome || ''}" placeholder="Ex: Distribuidora ABC">
                    </div>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">CNPJ</label>
                            <input id="supplier-cnpj" class="form-control" 
                                   value="${supplier?.cnpj || ''}" 
                                   placeholder="00.000.000/0000-00"
                                   oninput="this.value = window.utils.maskCNPJInput(this.value)">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Inscrição Estadual</label>
                            <input id="supplier-ie" class="form-control" value="${supplier?.ie || ''}" placeholder="Opcional">
                        </div>
                    </div>
                    
                    <div class="row g-3 mb-3">
                        <div class="col-md-6">
                            <label class="form-label">Telefone *</label>
                            <input id="supplier-fone" class="form-control" 
                                   value="${supplier?.fone || ''}" 
                                   placeholder="(00) 00000-0000"
                                   oninput="this.value = window.utils.maskPhoneInput(this.value)">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Email</label>
                            <input type="email" id="supplier-email" class="form-control" value="${supplier?.email || ''}" placeholder="contato@fornecedor.com">
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Endereço</label>
                        <input id="supplier-endereco" class="form-control" value="${supplier?.endereco || ''}" placeholder="Rua, número, bairro, cidade/UF">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Contato (pessoa de referência)</label>
                        <input id="supplier-contato" class="form-control" value="${supplier?.contato || ''}" placeholder="Nome do contato comercial">
                    </div>
                    
                    <div class="mb-3">
                        <label class="form-label">Observações</label>
                        <textarea id="supplier-obs" class="form-control" rows="2">${supplier?.obs || ''}</textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Atualizar' : 'Cadastrar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const nome = document.getElementById('supplier-nome').value.trim();
                const cnpj = document.getElementById('supplier-cnpj').value.trim();
                const ie = document.getElementById('supplier-ie').value.trim();
                const fone = document.getElementById('supplier-fone').value.trim();
                const email = document.getElementById('supplier-email').value.trim();
                const endereco = document.getElementById('supplier-endereco').value.trim();
                const contato = document.getElementById('supplier-contato').value.trim();
                const obs = document.getElementById('supplier-obs').value.trim();

                if (!nome) {
                    Swal.showValidationMessage('O nome/razão social é obrigatório');
                    return false;
                }
                if (!fone) {
                    Swal.showValidationMessage('O telefone é obrigatório');
                    return false;
                }

                return { nome, cnpj, ie, fone, email, endereco, contato, obs };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                if (isEditing) {
                    window.state.updateSupplier(supplier.id, result.value);
                    window.utils.showToast('Fornecedor atualizado!', 'success');
                } else {
                    window.state.addSupplier(result.value);
                    window.utils.showToast('Fornecedor cadastrado!', 'success');
                }

                const currentView = window.app?.getCurrentView();
                if (currentView === 'fornecedores') {
                    window.fornecedores?.render();
                } else {
                    refreshCurrentModule();
                }
            }
        });
    }

    // ========================================
    // FUNÇÃO AUXILIAR PARA RECARREGAR MÓDULO ATUAL
    // ========================================
    function refreshCurrentModule() {
        const currentView = window.app?.getCurrentView() || 'dashboard';

        switch(currentView) {
            case 'dashboard':
                window.dashboard?.render();
                break;
            case 'estoque':
                window.estoque?.render();
                break;
            case 'clientes':
                window.clientes?.render();
                break;
            case 'pdv':
                window.pdv?.render();
                break;
            case 'relatorios':
                window.relatorios?.render();
                break;
            case 'fidelidade':
                window.fidelidade?.render();
                break;
            case 'fornecedores':
                window.fornecedores?.render();
                break;
        }
    }

    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        openProductModal,
        openClientModal,
        openSupplierModal
    };
})();