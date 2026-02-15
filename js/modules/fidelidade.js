/**
 * Módulo de Fidelidade
 * Responsável pelo programa de pontos, recompensas e benefícios
 * Versão revisada com integração aos utils aprimorados e verificação de dependências
 */

window.fidelidade = (function() {
    'use strict';

    // ========================================
    // VERIFICAÇÃO DE DEPENDÊNCIAS
    // ========================================
    function checkDependencies() {
        if (!window.state) {
            console.error('Erro no módulo Fidelidade: window.state não definido');
            return false;
        }
        if (!window.utils) {
            console.error('Erro no módulo Fidelidade: window.utils não definido');
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
                    Erro ao carregar módulo de fidelidade. Dependências não encontradas.
                </div>
            `;
            return;
        }

        const state = window.state.get() || {};
        const fidelity = state.fidelity || {};

        const container = document.getElementById('mainContent');
        if (!container) return;

        container.innerHTML = `
            <div class="fade-in">
                <!-- Header -->
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="mb-1">Programa de Fidelidade</h2>
                        <p class="text-muted mb-0">
                            <i class="bi bi-award"></i> 
                            Gerencie regras, pontuação e recompensas
                        </p>
                    </div>
                    <div>
                        <span class="badge-points me-2">
                            <i class="bi bi-star-fill"></i> Status: Ativo
                        </span>
                        <button class="btn btn-primary" onclick="window.fidelidade.saveRules()">
                            <i class="bi bi-save"></i> Salvar Configurações
                        </button>
                    </div>
                </div>
                
                <div class="row g-3 mb-4">
                    <!-- Configurações Gerais -->
                    <div class="col-lg-6">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-gear me-2"></i>
                                Configurações Gerais
                            </h5>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Status do Programa</label>
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="fid-enabled" 
                                           ${fidelity.enabled ? 'checked' : ''}>
                                    <label class="form-check-label" for="fid-enabled">
                                        Programa de fidelidade ativo
                                    </label>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Pontos por valor gasto</label>
                                <div class="input-group">
                                    <span class="input-group-text">1 ponto a cada R$</span>
                                    <input type="number" id="fid-rate" class="form-control" 
                                           value="${fidelity.rate ?? 1}" min="0.01" step="0.01">
                                </div>
                                <small class="text-muted">Ex: 1 = R$1,00 = 1 ponto</small>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Bônus de cadastro</label>
                                <div class="input-group">
                                    <span class="input-group-text">🎁</span>
                                    <input type="number" id="fid-bonus" class="form-control" 
                                           value="${fidelity.bonus ?? 0}" min="0" step="1">
                                    <span class="input-group-text">pontos</span>
                                </div>
                                <small class="text-muted">Pontos iniciais para novos clientes</small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Regras de Resgate -->
                    <div class="col-lg-6">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-gift me-2"></i>
                                Regras de Resgate
                            </h5>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Conversão em desconto</label>
                                <div class="input-group mb-2">
                                    <span class="input-group-text">🔹</span>
                                    <input type="number" id="fid-discount-points" class="form-control" 
                                           value="${fidelity.discountPoints ?? 100}" min="1" step="1">
                                    <span class="input-group-text">pontos =</span>
                                    <input type="number" id="fid-discount-value" class="form-control" 
                                           value="${fidelity.discountValue ?? 5}" min="0.1" step="0.1">
                                    <span class="input-group-text">%</span>
                                </div>
                                <small class="text-muted">Ex: 100 pontos = 5% de desconto</small>
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Validade dos pontos</label>
                                <div class="input-group">
                                    <span class="input-group-text">⏰</span>
                                    <input type="number" id="fid-expiry" class="form-control" 
                                           value="${fidelity.expiryDays ?? 365}" min="0" step="1">
                                    <span class="input-group-text">dias</span>
                                </div>
                                <small class="text-muted">0 = sem validade</small>
                            </div>
                            
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="fid-birthday" 
                                       ${fidelity.birthdayBonus ? 'checked' : ''}>
                                <label class="form-check-label" for="fid-birthday">
                                    Bônus de aniversário
                                </label>
                            </div>
                            
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fid-first-purchase" 
                                       ${fidelity.firstPurchaseBonus ? 'checked' : ''}>
                                <label class="form-check-label" for="fid-first-purchase">
                                    Pontos dobrados na primeira compra
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Métricas e Estatísticas -->
                <div class="row g-3 mb-4">
                    <div class="col-12">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-bar-chart me-2"></i>
                                Estatísticas do Programa
                            </h5>
                            
                            <div class="row g-3">
                                <div class="col-md-3">
                                    <div class="metric-card">
                                        <div class="metric-label">Total de Pontos</div>
                                        <div class="metric-value">${calculateTotalPoints()}</div>
                                        <small class="text-muted">pontos ativos</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="metric-card">
                                        <div class="metric-label">Clientes Participantes</div>
                                        <div class="metric-value">${countParticipants()}</div>
                                        <small class="text-muted">com pelo menos 1 ponto</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="metric-card">
                                        <div class="metric-label">Média por Cliente</div>
                                        <div class="metric-value">${calculateAveragePoints()}</div>
                                        <small class="text-muted">pontos em média</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="metric-card">
                                        <div class="metric-label">Maior Pontuação</div>
                                        <div class="metric-value">${calculateMaxPoints()}</div>
                                        <small class="text-muted">cliente top</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Ranking e Histórico -->
                <div class="row g-3">
                    <div class="col-lg-7">
                        <div class="card-modern">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title mb-0">
                                    <i class="bi bi-trophy me-2"></i>
                                    Ranking de Pontos
                                </h5>
                                <button class="btn btn-sm btn-outline-primary" onclick="window.fidelidade.exportRanking()">
                                    <i class="bi bi-download"></i> Exportar
                                </button>
                            </div>
                            
                            <div id="ranking-list">
                                ${renderRanking()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-lg-5">
                        <div class="card-modern">
                            <h5 class="card-title mb-3">
                                <i class="bi bi-clock-history me-2"></i>
                                Últimas Movimentações
                            </h5>
                            
                            <div id="movements-list">
                                ${renderMovements()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ========================================
    // RENDERIZAÇÃO DOS COMPONENTES
    // ========================================
    function renderRanking() {
        const clients = (window.state.getClients?.() || [])
            .filter(c => (c.points || 0) > 0)
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 10);
        
        if (clients.length === 0) {
            return '<p class="text-muted text-center py-4">Nenhum cliente com pontos</p>';
        }
        
        let html = '<div class="list-group">';
        clients.forEach((c, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📌';
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <span class="me-2">${medal}</span>
                        <strong>${c.nome || 'Sem nome'}</strong>
                        <br>
                        <small class="text-muted">${c.fid || ''}</small>
                    </div>
                    <span class="badge-points">${c.points || 0} pts</span>
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }
    
    function renderMovements() {
        // Simulação de movimentações (idealmente teria um histórico real)
        const clients = (window.state.getClients?.() || [])
            .filter(c => (c.points || 0) > 0)
            .sort((a, b) => (b.points || 0) - (a.points || 0))
            .slice(0, 5);
        
        if (clients.length === 0) {
            return '<p class="text-muted text-center py-4">Nenhuma movimentação recente</p>';
        }
        
        let html = '';
        clients.forEach(c => {
            html += `
                <div class="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                    <div>
                        <strong>${c.nome || 'Sem nome'}</strong>
                        <br>
                        <small class="text-muted">${c.points || 0} pontos atuais</small>
                    </div>
                    <span class="badge bg-success">
                        <i class="bi bi-plus-circle"></i> +${Math.floor((c.points || 0) * 0.1)} esta semana
                    </span>
                </div>
            `;
        });
        
        return html;
    }
    
    // ========================================
    // CÁLCULOS AUXILIARES
    // ========================================
    function calculateTotalPoints() {
        return (window.state.getClients?.() || [])
            .reduce((sum, c) => sum + (c.points || 0), 0);
    }
    
    function countParticipants() {
        return (window.state.getClients?.() || [])
            .filter(c => (c.points || 0) > 0).length;
    }
    
    function calculateAveragePoints() {
        const participants = (window.state.getClients?.() || [])
            .filter(c => (c.points || 0) > 0);
        if (participants.length === 0) return 0;
        const total = participants.reduce((sum, c) => sum + (c.points || 0), 0);
        return Math.round(total / participants.length);
    }
    
    function calculateMaxPoints() {
        return (window.state.getClients?.() || [])
            .reduce((max, c) => Math.max(max, c.points || 0), 0);
    }
    
    // ========================================
    // AÇÕES
    // ========================================
    function saveRules() {
        if (!checkDependencies()) return;

        // Função auxiliar para obter valor de elemento com segurança
        function getElementValue(id, defaultValue = null) {
            const el = document.getElementById(id);
            return el ? el.value : defaultValue;
        }

        function getElementChecked(id, defaultValue = false) {
            const el = document.getElementById(id);
            return el ? el.checked : defaultValue;
        }

        const fidelity = {
            enabled: getElementChecked('fid-enabled', false),
            rate: parseFloat(getElementValue('fid-rate', '1')) || 1,
            bonus: parseInt(getElementValue('fid-bonus', '0')) || 0,
            discountPoints: parseInt(getElementValue('fid-discount-points', '100')) || 100,
            discountValue: parseFloat(getElementValue('fid-discount-value', '5')) || 5,
            expiryDays: parseInt(getElementValue('fid-expiry', '365')) || 365,
            birthdayBonus: getElementChecked('fid-birthday', false),
            firstPurchaseBonus: getElementChecked('fid-first-purchase', false)
        };
        
        window.state.updateFidelity?.(fidelity);
        window.utils.showToast?.('Configurações de fidelidade salvas!', 'success');
        
        // Atualiza bônus de novos clientes se necessário
        const currentBonus = window.state.getFidelity?.()?.bonus;
        if (fidelity.bonus !== currentBonus) {
            window.utils.showAlert?.('Novos clientes receberão o bônus atualizado', 'info');
        }
    }
    
    function exportRanking() {
        if (!checkDependencies()) return;

        const clients = (window.state.getClients?.() || [])
            .filter(c => (c.points || 0) > 0)
            .sort((a, b) => (b.points || 0) - (a.points || 0));
        
        const data = clients.map((c, index) => ({
            'Posição': index + 1,
            'Nome': c.nome || '',
            'Código Fidelidade': c.fid || '',
            'Pontos': c.points || 0,
            'Telefone': c.fone || '',
            'Email': c.email || ''
        }));
        
        window.utils.exportToCSV?.(data, `ranking-fidelidade-${new Date().toISOString().split('T')[0]}.csv`);
        window.utils.showToast?.('Ranking exportado com sucesso!', 'success');
    }
    
    // ========================================
    // API PÚBLICA
    // ========================================
    return {
        render,
        saveRules,
        exportRanking
    };
})();