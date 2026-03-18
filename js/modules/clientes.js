/**
 * Módulo de Clientes
 * Responsável pela gestão de clientes, fidelidade e relacionamento
 * Versão revisada com integração aos utils aprimorados e verificação de dependências
 */

window.clientes = (function() {
    'use strict';

    // ========================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Clientes: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Clientes: window.utils não definido');
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
                    Erro ao carregar módulo Clientes. Dependências não encontradas.
                </div>
            `;
            return;
        }

        const container = document.getElementById('mainContent');
        const state = window.state.get();
        
        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">Gestão de Clientes</h2>
                        <p class="text-muted mb-0">
                            <i class="bi bi-people"></i> 
                            ${state.clients.length} clientes cadastrados •
                            <span class="text-warning">${state.clients.filter(c => (c.points || 0) > 100).length}</span> clientes VIP
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-success" onclick="window.modals.openClientModal()">
                            <i class="bi bi-person-plus"></i> Novo Cliente
                        </button>
                        <button class="btn btn-outline-secondary ms-2" onclick="window.clientes.exportClients()">
                            <i class="bi bi-download"></i> Exportar
                        </button>
                    </div>
                </div>
                
                <!-- Cards de Métricas -->
                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="metric-card">
                            <div class="metric-label">Total de Clientes</div>
                            <div class="metric-value">${state.clients.length}</div>
                            <small class="text-muted">+${state.clients.filter(c => {
                                const created = new Date(c.createdAt || 0);
                                const days = (new Date() - created) / (1000 * 60 * 60 * 24);
                                return days <= 30;
                            }).length} este mês</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="metric-card">
                            <div class="metric-label">Pontos Distribuídos</div>
                            <div class="metric-value">${state.clients.reduce((sum, c) => sum + (c.points || 0), 0)}</div>
                            <small class="text-muted">pts ativos</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="metric-card">
                            <div class="metric-label">Ticket Médio</div>
                            <div class="metric-value">R$ ${window.utils.formatCurrency(calculateAverageTicket(state))}</div>
                            <small class="text-muted">por cliente</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="metric-card">
                            <div class="metric-label">Aniversariantes</div>
                            <div class="metric-value">${getBirthdayCount(state.clients)}</div>
                            <small class="text-muted">este mês</small>
                        </div>
                    </div>
                </div>
                
                <!-- Busca e Filtros -->
                <div class="card-modern mb-4">
                    <div class="row g-3">
                        <div class="col-md-5">
                            <div class="search-box">
                                <i class="bi bi-search"></i>
                                <input type="text" id="clientes-search" class="form-control" 
                                       placeholder="Buscar por nome, CPF, telefone ou código..." 
                                       oninput="window.clientes.filter()">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <select id="clientes-filtro" class="form-select" onchange="window.clientes.filter()">
                                <option value="all">Todos os clientes</option>
                                <option value="vip">VIP (100+ pts)</option>
                                <option value="regular">Regulares</option>
                                <option value="new">Novos (30 dias)</option>
                                <option value="inactive">Inativos (90+ dias)</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-outline-primary w-100" onclick="window.clientes.showRanking()">
                                <i class="bi bi-trophy"></i> Ranking
                            </button>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-outline-secondary w-100" onclick="window.clientes.sendPromotion()">
                                <i class="bi bi-megaphone"></i> Promoção
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Grid de Clientes -->
                <div class="row g-3" id="clientes-grid">
                    ${renderClientCards(filterClients(state.clients))}
                </div>
            </div>
        `;
    }
    
    // ========================================
    // RENDERIZAÇÃO DOS CARDS
    // ========================================
    function renderClientCards(clients) {
        if (clients.length === 0) {
            return `
                <div class="col-12">
                    <div class="card-modern text-center py-5">
                        <i class="bi bi-people text-muted" style="font-size: 3rem;"></i>
                        <p class="text-muted mt-3 mb-0">Nenhum cliente encontrado</p>
                        <button class="btn btn-success mt-3" onclick="window.modals.openClientModal()">
                            <i class="bi bi-person-plus"></i> Cadastrar Primeiro Cliente
                        </button>
                    </div>
                </div>
            `;
        }
        
        const sales = window.state.getSales();
        
        return clients.map(c => {
            const totalSpent = calculateClientSpent(c.id, sales);
            const lastPurchase = getLastPurchaseDate(c.id, sales);
            const isVip = (c.points || 0) >= 100;
            
            return `
                <div class="col-md-6 col-lg-4">
                    <div class="card-modern h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="d-flex align-items-center">
                                <div class="avatar-circle bg-${isVip ? 'warning' : 'primary'} me-3">
                                    ${getInitials(c.nome)}
                                </div>
                                <div>
                                    <h6 class="mb-0">${c.nome}</h6>
                                    <small class="text-muted">
                                        <i class="bi bi-credit-card"></i> ${c.fid || 'Sem código'}
                                    </small>
                                </div>
                            </div>
                            <span class="badge-points">
                                <i class="bi bi-star-fill"></i> ${c.points || 0} pts
                            </span>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex mb-1">
                                <i class="bi bi-telephone text-muted me-2" style="width: 20px;"></i>
                                <span>${window.utils.formatPhone(c.fone)}</span>
                            </div>
                            ${c.email ? `
                                <div class="d-flex mb-1">
                                    <i class="bi bi-envelope text-muted me-2" style="width: 20px;"></i>
                                    <span>${c.email}</span>
                                </div>
                            ` : ''}
                            ${c.cpf ? `
                                <div class="d-flex mb-1">
                                    <i class="bi bi-person-badge text-muted me-2" style="width: 20px;"></i>
                                    <span>${c.cpf}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <hr class="my-2">
                        
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <small class="text-muted d-block">Total gasto</small>
                                <strong class="text-primary">R$ ${window.utils.formatCurrency(totalSpent)}</strong>
                            </div>
                            <div class="col-6">
                                <small class="text-muted d-block">Última compra</small>
                                <strong>${lastPurchase || 'Nunca'}</strong>
                            </div>
                        </div>
                        
                        <div class="btn-group w-100">
                            <button class="btn btn-outline-primary btn-sm" onclick="window.modals.openClientModal('${c.id}')">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="window.clientes.viewHistory('${c.id}')">
                                <i class="bi bi-clock-history"></i> Histórico
                            </button>
                            <button class="btn btn-outline-success btn-sm" onclick="window.clientes.addPoints('${c.id}')">
                                <i class="bi bi-plus-circle"></i> Pontos
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="window.clientes.deleteClient('${c.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // ========================================
    // FUNÇÕES AUXILIARES DE RENDERIZAÇÃO
    // ========================================
    function getInitials(name) {
        return name.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substr(0, 2);
    }
    
    // ========================================
    // FILTRAGEM DE CLIENTES
    // ========================================
    function filterClients(clients) {
        const search = document.getElementById('clientes-search')?.value?.toLowerCase() || '';
        const filtro = document.getElementById('clientes-filtro')?.value || 'all';
        
        let filtered = clients;
        
        // Busca
        if (search) {
            filtered = filtered.filter(c => 
                c.nome.toLowerCase().includes(search) ||
                (c.fid || '').toLowerCase().includes(search) ||
                (c.cpf || '').includes(search) ||
                (c.fone || '').includes(search) ||
                (c.email || '').toLowerCase().includes(search)
            );
        }
        
        // Filtros especiais
        const now = new Date();
        const sales = window.state.getSales();
        
        switch(filtro) {
            case 'vip':
                filtered = filtered.filter(c => (c.points || 0) >= 100);
                break;
            case 'regular':
                filtered = filtered.filter(c => (c.points || 0) < 100);
                break;
            case 'new':
                filtered = filtered.filter(c => {
                    const created = new Date(c.createdAt || 0);
                    const days = (now - created) / (1000 * 60 * 60 * 24);
                    return days <= 30;
                });
                break;
            case 'inactive':
                filtered = filtered.filter(c => {
                    const lastPurchase = getLastPurchaseDateObj(c.id, sales);
                    if (!lastPurchase) return true;
                    const days = (now - lastPurchase) / (1000 * 60 * 60 * 24);
                    return days >= 90;
                });
                break;
        }
        
        return filtered;
    }
    
    // ========================================
    // CÁLCULOS AUXILIARES
    // ========================================
    function calculateClientSpent(clientId, sales) {
        return sales
            .filter(s => s.clientId === clientId)
            .reduce((sum, s) => sum + s.total, 0);
    }
    
    function getLastPurchaseDate(clientId, sales) {
        const clientSales = sales.filter(s => s.clientId === clientId);
        if (clientSales.length === 0) return null;
        
        const last = clientSales.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        )[0];
        
        return window.utils.formatDate(last.date);
    }
    
    function getLastPurchaseDateObj(clientId, sales) {
        const clientSales = sales.filter(s => s.clientId === clientId);
        if (clientSales.length === 0) return null;
        
        const last = clientSales.sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        )[0];
        
        return new Date(last.date);
    }
    
    function calculateAverageTicket(state) {
        const clientsWithPurchase = state.clients.filter(c => 
            state.sales.some(s => s.clientId === c.id)
        );
        
        if (clientsWithPurchase.length === 0) return 0;
        
        const totalSpent = clientsWithPurchase.reduce((sum, c) => 
            sum + calculateClientSpent(c.id, state.sales), 0
        );
        
        return totalSpent / clientsWithPurchase.length;
    }
    
    function getBirthdayCount(clients) {
        const currentMonth = new Date().getMonth();
        return clients.filter(c => {
            if (!c.birthDate) return false;
            const birthMonth = new Date(c.birthDate).getMonth();
            return birthMonth === currentMonth;
        }).length;
    }
    
    // ========================================
    // AÇÕES
    // ========================================
    function viewHistory(clientId) {
        if (!checkDependencies()) return;
        
        const client = window.state.getClients().find(c => c.id === clientId);
        if (!client) return;
        
        const sales = window.state.getSales()
            .filter(s => s.clientId === clientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let historyHTML = `
            <div class="text-start">
                <h6>${client.nome}</h6>
                <p class="text-muted mb-3">Código: ${client.fid || 'Não informado'}</p>
                
                <div class="mb-3">
                    <strong>Pontos atuais:</strong> ${client.points || 0} pts
                    <br>
                    <strong>Total gasto:</strong> R$ ${window.utils.formatCurrency(calculateClientSpent(client.id, sales))}
                    <br>
                    <strong>Compras realizadas:</strong> ${sales.length}
                </div>
        `;
        
        if (sales.length > 0) {
            historyHTML += '<hr><h6>Últimas compras:</h6>';
            sales.slice(0, 5).forEach(s => {
                historyHTML += `
                    <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                        <div>
                            <small>${new Date(s.date).toLocaleDateString('pt-BR')}</small>
                            <br>
                            <small class="text-muted">${s.items.length} itens</small>
                        </div>
                        <div class="text-end">
                            <strong class="text-primary">R$ ${window.utils.formatCurrency(s.total)}</strong>
                            <br>
                            <span class="badge bg-secondary">${s.payment}</span>
                        </div>
                    </div>
                `;
            });
        } else {
            historyHTML += '<p class="text-muted">Nenhuma compra registrada</p>';
        }
        
        historyHTML += '</div>';
        
        Swal.fire({
            title: 'Histórico do Cliente',
            html: historyHTML,
            icon: 'info',
            width: '600px',
            confirmButtonText: 'Fechar'
        });
    }
    
    function addPoints(clientId) {
        if (!checkDependencies()) return;
        
        const client = window.state.getClients().find(c => c.id === clientId);
        if (!client) return;
        
        Swal.fire({
            title: 'Adicionar Pontos',
            html: `
                <div class="mb-3">
                    <label class="form-label">Cliente</label>
                    <input type="text" class="form-control" value="${client.nome}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">Pontos atuais</label>
                    <input type="text" class="form-control" value="${client.points || 0}" readonly>
                </div>
                <div class="mb-3">
                    <label class="form-label">Quantidade de pontos</label>
                    <input type="number" id="points-to-add" class="form-control" min="1" step="1">
                </div>
                <div class="mb-3">
                    <label class="form-label">Motivo</label>
                    <select id="points-reason" class="form-select">
                        <option value="purchase">Compra</option>
                        <option value="birthday">Aniversário</option>
                        <option value="promotion">Promoção</option>
                        <option value="adjustment">Ajuste manual</option>
                    </select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Adicionar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const points = parseInt(document.getElementById('points-to-add').value);
                const reason = document.getElementById('points-reason').value;
                
                if (isNaN(points) || points <= 0) {
                    Swal.showValidationMessage('Quantidade inválida');
                    return false;
                }
                
                return { points, reason };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Imutabilidade: cria novo objeto com pontos atualizados
                const updatedClient = { 
                    ...client, 
                    points: (client.points || 0) + result.value.points 
                };
                window.state.updateClient(client.id, updatedClient);
                
                window.utils.showToast(`${result.value.points} pontos adicionados para ${client.nome}`, 'success');
                window.clientes.render();
            }
        });
    }
    
    function deleteClient(id) {
        if (!checkDependencies()) return;
        
        window.utils.showConfirm(
            'Remover cliente?',
            'Esta ação não poderá ser desfeita. O histórico de compras será mantido, mas o cliente será desvinculado.'
        ).then((result) => {
            if (result.isConfirmed) {
                window.state.deleteClient(id);
                window.utils.showToast('Cliente removido', 'info');
                window.clientes.render();
            }
        });
    }
    
    function showRanking() {
        if (!checkDependencies()) return;
        
        const clients = window.state.getClients()
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 10);
        
        const sales = window.state.getSales();
        
        let rankingHTML = '<div class="text-start">';
        clients.forEach((c, index) => {
            const totalSpent = calculateClientSpent(c.id, sales);
            rankingHTML += `
                <div class="d-flex justify-content-between align-items-center mb-3 p-2 ${index === 0 ? 'bg-warning bg-opacity-10' : ''} rounded">
                    <div class="d-flex align-items-center">
                        <span class="badge ${index === 0 ? 'bg-warning' : index === 1 ? 'bg-secondary' : index === 2 ? 'bg-bronze' : 'bg-primary'} me-3" 
                              style="width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                            ${index + 1}
                        </span>
                        <div>
                            <strong>${c.nome}</strong>
                            <br>
                            <small class="text-muted">${c.fid || 'Sem código'}</small>
                        </div>
                    </div>
                    <div class="text-end">
                        <span class="badge-points">${c.points || 0} pts</span>
                        <br>
                        <small>R$ ${window.utils.formatCurrency(totalSpent)}</small>
                    </div>
                </div>
            `;
        });
        rankingHTML += '</div>';
        
        Swal.fire({
            title: '🏆 Ranking de Pontos',
            html: rankingHTML,
            icon: 'info',
            width: '500px',
            confirmButtonText: 'Fechar'
        });
    }
    
    function sendPromotion() {
        if (!checkDependencies()) return;
        
        const clients = window.state.getClients();
        
        Swal.fire({
            title: 'Enviar Promoção',
            html: `
                <div class="mb-3">
                    <label class="form-label">Selecionar clientes</label>
                    <select id="promotion-target" class="form-select">
                        <option value="all">Todos os clientes (${clients.length})</option>
                        <option value="vip">Clientes VIP (${clients.filter(c => (c.points || 0) >= 100).length})</option>
                        <option value="birthday">Aniversariantes do mês (${getBirthdayCount(clients)})</option>
                        <option value="inactive">Clientes inativos (90+ dias)</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Título da promoção</label>
                    <input type="text" id="promotion-title" class="form-control" value="Promoção exclusiva!">
                </div>
                <div class="mb-3">
                    <label class="form-label">Mensagem</label>
                    <textarea id="promotion-message" class="form-control" rows="3">Ganhe pontos em dobro nessa semana! 🎁</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Enviar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const target = document.getElementById('promotion-target').value;
                const title = document.getElementById('promotion-title').value;
                const message = document.getElementById('promotion-message').value;
                
                return { target, title, message };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                window.utils.showToast('Promoção enviada com sucesso! (simulação)', 'success');
            }
        });
    }
    
    function exportClients() {
        if (!checkDependencies()) return;
        
        const clients = window.state.getClients();
        const sales = window.state.getSales();
        
        const data = clients.map(c => ({
            'Código': c.fid || '',
            'Nome': c.nome,
            'CPF': c.cpf || '',
            'Telefone': c.fone,
            'Email': c.email || '',
            'Pontos': c.points || 0,
            'Total Gasto': window.utils.formatCurrency(calculateClientSpent(c.id, sales)),
            'Compras': sales.filter(s => s.clientId === c.id).length,
            'Data Cadastro': window.utils.formatDate(c.createdAt || new Date())
        }));
        
        window.utils.exportToCSV(data, `clientes-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast('Clientes exportados com sucesso!', 'success');
    }
    
    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        render,
        filter: () => {
            const grid = document.getElementById('clientes-grid');
            if (grid) {
                const filtered = filterClients(window.state.getClients());
                grid.innerHTML = renderClientCards(filtered);
            }
        },
        viewHistory,
        addPoints,
        deleteClient,
        showRanking,
        sendPromotion,
        exportClients
    };
})();

// Adiciona estilo para avatar (mantido como estava)
const style = document.createElement('style');
style.textContent = `
    .avatar-circle {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 1.1rem;
    }
    .bg-bronze {
        background: linear-gradient(135deg, #cd7f32, #b87333);
    }
`;
document.head.appendChild(style);