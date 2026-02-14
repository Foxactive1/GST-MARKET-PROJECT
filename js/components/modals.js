/**
 * Componentes de Modais
 * Responsável por gerenciar todos os modais do sistema
 */

window.modals = (function() {
    let currentProductId = null;
    let currentClientId = null;
    
    function openProductModal(productId = null) {
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
                            <input type="number" id="prod-preco" class="form-control" value="${product?.preco || ''}" min="0" step="0.01">
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
                            <input type="number" id="prod-cost" class="form-control" value="${product?.cost || ''}" min="0" step="0.01">
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEditing ? 'Atualizar' : 'Cadastrar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const data = {
                    nome: document.getElementById('prod-nome').value.trim(),
                    code: document.getElementById('prod-code').value.trim(),
                    categoria: document.getElementById('prod-categoria').value,
                    qtd: parseInt(document.getElementById('prod-qtd').value) || 0,
                    preco: parseFloat(document.getElementById('prod-preco').value) || 0,
                    minStock: parseInt(document.getElementById('prod-min').value) || 5,
                    unit: document.getElementById('prod-unit').value,
                    cost: parseFloat(document.getElementById('prod-cost').value) || null
                };
                
                if (!window.utils.validateProduct(data)) {
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
                
                // Recarrega módulo atual
                refreshCurrentModule();
            }
        });
    }
    
    function openClientModal(clientId = null) {
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
                            <input id="client-cpf" class="form-control" value="${client?.cpf || ''}" placeholder="000.000.000-00">
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Telefone *</label>
                            <input id="client-fone" class="form-control" value="${client?.fone || ''}" placeholder="(00) 00000-0000">
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
                const data = {
                    nome: document.getElementById('client-nome').value.trim(),
                    cpf: document.getElementById('client-cpf').value.trim(),
                    fone: document.getElementById('client-fone').value.trim(),
                    email: document.getElementById('client-email').value.trim(),
                    birthDate: document.getElementById('client-birth').value,
                    gender: document.getElementById('client-gender').value
                };
                
                if (!window.utils.validateClient(data)) {
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
    
    function refreshCurrentModule() {
        // Determina módulo atual baseado na view
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
        }
    }
    
    // API Pública
    return {
        openProductModal,
        openClientModal
    };
})();