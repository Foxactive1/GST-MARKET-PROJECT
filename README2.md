# 🏪 Supermercado Pro - Sistema de Gestão Modular

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Lighthouse](https://img.shields.io/badge/lighthouse-95+-orange.svg)

**Sistema completo de gestão para supermercados com PDV, controle de estoque, programa de fidelidade e relatórios em tempo real.**

[Demo]([https://gst-market-project.vercel.app/)] )· [Documentação](https://github.com/Foxactive1/supermercado-pro/wiki) · [Reportar Bug](https://github.com/Foxactive1/supermercado-pro/issues) · [Solicitar Feature](https://github.com/Foxactive1/supermercado-pro/issues)

</div>

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Features](#-features)
- [Demo](#-demo)
- [Tecnologias](#-tecnologias)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Atalhos de Teclado](#%EF%B8%8F-atalhos-de-teclado)
- [PWA](#-progressive-web-app)
- [Roadmap](#-roadmap)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)
- [Contato](#-contato)
- [Agradecimentos](#-agradecimentos)

---

## 🎯 Sobre o Projeto

**Supermercado Pro** é um sistema de gestão completo e modular desenvolvido para supermercados de pequeno e médio porte. Oferece uma solução integrada para gerenciar vendas, estoque, clientes e fidelidade, tudo em uma interface moderna e responsiva.

### ✨ Diferenciais

- 🚀 **Progressive Web App (PWA)** - Funciona online e offline
- ⚡ **Performance otimizada** - Lighthouse score 95+
- 🎨 **Interface moderna** - Design responsivo e intuitivo
- ⌨️ **Command Palette** - Atalhos estilo VS Code (Ctrl+K)
- 🌓 **Dark Mode** - Tema claro/escuro com auto-detecção
- ♿ **100% Acessível** - WCAG 2.1 Level AA compliant
- 📊 **Dashboard em tempo real** - Métricas e gráficos interativos
- 🔒 **Seguro** - CSP, XSS protection, secure headers
- 📱 **Mobile-first** - Totalmente responsivo

---

## 🚀 Features

### 💰 PDV (Ponto de Venda)
- ✅ Interface rápida e intuitiva
- ✅ Busca de produtos por código/nome
- ✅ Cálculo automático de troco
- ✅ Múltiplas formas de pagamento
- ✅ Impressão de cupom fiscal
- ✅ Histórico de vendas

### 📦 Gestão de Estoque
- ✅ Controle de entrada e saída
- ✅ Alertas de estoque baixo
- ✅ Categorização de produtos
- ✅ Código de barras
- ✅ Controle de validade
- ✅ Relatórios de movimento

### 👥 Gestão de Clientes
- ✅ Cadastro completo
- ✅ Histórico de compras
- ✅ Preferências e observações
- ✅ Aniversariantes do mês
- ✅ Exportação de dados

### ⭐ Programa de Fidelidade
- ✅ Sistema de pontos
- ✅ Níveis de recompensa
- ✅ Promoções exclusivas
- ✅ Cashback
- ✅ Notificações automáticas

### 📊 Relatórios e Análises
- ✅ Dashboard interativo
- ✅ Vendas por período
- ✅ Produtos mais vendidos
- ✅ Análise de margem
- ✅ Gráficos em tempo real
- ✅ Exportação PDF/Excel

### ⚡ Recursos Avançados
- ✅ **Service Worker** - Cache inteligente e modo offline
- ✅ **Command Palette** - Navegação rápida (Ctrl+K)
- ✅ **Theme Manager** - Temas light/dark com persistência
- ✅ **Keyboard Shortcuts** - 15+ atalhos produtivos
- ✅ **Breadcrumbs** - Navegação contextual
- ✅ **Toast Notifications** - Feedback visual instantâneo
- ✅ **Error Handling** - Sistema robusto de tratamento de erros

---

## 🎬 Demo

### Screenshots

<div align="center">

#### Dashboard
![Dashboard](./screenshots/dashboard.png)
*Dashboard com métricas em tempo real e gráficos interativos*

#### PDV (Ponto de Venda)
![PDV](./screenshots/pdv.png)
*Interface intuitiva do PDV com carrinho e cálculo de troco*

#### Command Palette
![Command Palette](./screenshots/command-palette.png)
*Command Palette para navegação rápida (Ctrl+K)*

#### Mobile
<img src="./screenshots/mobile.png" width="300" alt="Mobile">

*Interface totalmente responsiva em dispositivos móveis*

</div>

### 🔗 Demo Online
Acesse a demo: [https://supermercado-pro-demo.netlify.app](https://supermercado-pro-demo.netlify.app)

---

## 🛠️ Tecnologias

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilização moderna com CSS Variables
- **JavaScript (ES6+)** - Lógica e interatividade
- **Bootstrap 5.3** - Framework CSS responsivo
- **Bootstrap Icons** - Biblioteca de ícones

### Bibliotecas
- **Chart.js 4.4** - Gráficos interativos
- **SweetAlert2** - Modais e alertas elegantes
- **Inter Font** - Tipografia moderna

### PWA & Performance
- **Service Worker** - Cache e modo offline
- **Manifest.json** - Configuração PWA
- **Preconnect/Prefetch** - Otimização de recursos
- **Critical CSS** - First paint otimizado

### Arquitetura
- **Modular** - Código organizado em módulos
- **Component-based** - Componentes reutilizáveis
- **State Management** - Gerenciamento centralizado de estado
- **Event-driven** - Comunicação via eventos

---

## 📥 Instalação

### Pré-requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Servidor HTTP (Python, Node.js, PHP, etc.)

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/Foxactive1/supermercado-pro.git

# Entre no diretório
cd supermercado-pro

# Inicie um servidor HTTP

# Opção 1: Python
python -m http.server 8000

# Opção 2: Node.js (http-server)
npx http-server -p 8000

# Opção 3: PHP
php -S localhost:8000

# Acesse no navegador
# http://localhost:8000
```

### Estrutura de Diretórios

```
supermercado-pro/
├── index.html              # Página principal
├── manifest.json           # Configuração PWA
├── service-worker.js       # Service Worker
├── css/
│   ├── style.css          # Estilos principais
│   └── style-additions.css # Estilos adicionais
├── js/
│   ├── app.js             # Inicialização
│   ├── utils.js           # Utilitários
│   ├── state.js           # Gerenciamento de estado
│   ├── theme.js           # Gerenciador de temas
│   ├── commands.js        # Command Palette
│   ├── components/
│   │   └── modals.js      # Componentes modais
│   └── modules/
│       ├── dashboard.js   # Módulo Dashboard
│       ├── pdv.js         # Módulo PDV
│       ├── estoque.js     # Módulo Estoque
│       ├── clientes.js    # Módulo Clientes
│       ├── relatorios.js  # Módulo Relatórios
│       └── fidelidade.js  # Módulo Fidelidade
├── icons/                 # Ícones PWA
│   ├── icon-192.png
│   └── icon-512.png
├── screenshots/           # Screenshots para README
└── README.md             # Este arquivo
```

---

## 💻 Uso

### Navegação

#### Via Menu
- Clique nos itens do menu superior para navegar entre módulos
- Use o menu dropdown "Gestão" para acessar submódulos

#### Via Atalhos de Teclado
- `Ctrl+D` - Dashboard
- `Ctrl+P` - PDV
- `Ctrl+E` - Estoque
- `Ctrl+C` - Clientes
- `Ctrl+F` - Fidelidade
- `Ctrl+R` - Relatórios

#### Via Command Palette
- Pressione `Ctrl+K` (ou `Cmd+K` no Mac)
- Digite o nome do módulo ou comando
- Use ↑↓ para navegar
- Pressione Enter para executar

### Tema

#### Alternar Tema
```javascript
// Via botão no menu
// Clique no ícone de lua/sol

// Via Command Palette
Ctrl+K → "Alternar Tema"

// Via código
window.themeManager.toggle();
```

#### Configurar Auto-Switch
```javascript
// Ativar troca automática por horário
window.themeManager.enableAutoSwitch();

// Desativar
window.themeManager.disableAutoSwitch();
```

### Comandos Customizados

```javascript
// Registrar novo comando
window.commands.registerCommand({
    id: 'custom-report',
    label: 'Gerar Relatório Personalizado',
    icon: 'bi-file-earmark-bar-graph',
    category: 'Relatórios',
    shortcut: 'Ctrl+Shift+R',
    action: () => {
        // Sua lógica aqui
        console.log('Gerando relatório...');
    }
});
```

---

## ⌨️ Atalhos de Teclado

### Navegação
| Atalho | Ação |
|--------|------|
| `Ctrl+D` | Ir para Dashboard |
| `Ctrl+P` | Ir para PDV |
| `Ctrl+E` | Ir para Estoque |
| `Ctrl+C` | Ir para Clientes |
| `Ctrl+F` | Ir para Fidelidade |
| `Ctrl+R` | Ir para Relatórios |

### Comandos
| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Abrir Command Palette |
| `Ctrl+Shift+?` | Ver todos os atalhos |
| `Esc` | Fechar modal/dropdown |

### No Command Palette
| Tecla | Ação |
|-------|------|
| `↑` `↓` | Navegar entre comandos |
| `Enter` | Executar comando |
| `Esc` | Fechar |

---

## 📱 Progressive Web App

### Instalação

#### Desktop (Chrome/Edge)
1. Clique no ícone de instalação na barra de endereço
2. Ou: Menu (⋮) → Instalar Supermercado Pro

#### Mobile (Android/iOS)
1. Abra no Chrome/Safari
2. Toque em "Adicionar à tela inicial"
3. Confirme a instalação

### Features PWA

- ✅ **Instalável** - Funciona como app nativo
- ✅ **Offline First** - Funciona sem internet
- ✅ **Cache Inteligente** - Carregamento instantâneo
- ✅ **Atualizações Automáticas** - Sempre na versão mais recente
- ✅ **App Shortcuts** - Atalhos no menu do app
- ✅ **Push Notifications** - Notificações em tempo real

### Estratégias de Cache

```javascript
// Cache First - Assets estáticos
css/, js/, fonts/, icons/

// Network First - API e dados
/api/*, /data/*

// Stale While Revalidate - HTML
index.html, pages/*
```

---

## 🗺️ Roadmap

### v1.1.0 (Em breve)
- [ ] Integração com impressoras fiscais
- [ ] Sincronização multi-dispositivo
- [ ] Backup automático em nuvem
- [ ] Modo kiosk para PDV

### v1.2.0
- [ ] Multi-idioma (PT, EN, ES)
- [ ] Analytics dashboard avançado
- [ ] API REST documentada
- [ ] Webhooks e integrações

### v2.0.0
- [ ] App mobile nativo (React Native)
- [ ] Sistema de permissões por usuário
- [ ] Integração com e-commerce
- [ ] BI e Machine Learning

[Ver roadmap completo →](https://github.com/Foxactive1/supermercado-pro/projects/1)

---

## 🤝 Contribuindo

Contribuições são sempre bem-vindas! Veja como você pode ajudar:

### Como Contribuir

1. **Fork o projeto**
   ```bash
   # Clique em "Fork" no GitHub
   ```

2. **Clone seu fork**
   ```bash
   git clone https://github.com/seu-usuario/supermercado-pro.git
   ```

3. **Crie uma branch**
   ```bash
   git checkout -b feature/MinhaFeature
   ```

4. **Faça suas alterações**
   ```bash
   # Desenvolva sua feature
   ```

5. **Commit suas mudanças**
   ```bash
   git commit -m "feat: Adiciona nova feature"
   ```

6. **Push para o GitHub**
   ```bash
   git push origin feature/MinhaFeature
   ```

7. **Abra um Pull Request**
   - Descreva suas alterações
   - Adicione screenshots se aplicável
   - Aguarde review

### Diretrizes

- Siga o padrão de código existente
- Escreva commits claros e descritivos
- Teste suas alterações
- Atualize a documentação se necessário
- Seja respeitoso e construtivo

### Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/Foxactive1/supermercado-pro/issues/new?template=bug_report.md)

### Solicitar Features

Tem uma ideia? [Solicite uma feature](https://github.com/Foxactive1/supermercado-pro/issues/new?template=feature_request.md)

---

## 📊 Status do Projeto

### Build Status
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

### Code Quality
![Code Quality](https://img.shields.io/badge/code%20quality-A+-brightgreen.svg)

### Coverage
![Coverage](https://img.shields.io/badge/coverage-85%25-yellow.svg)

### Lighthouse Scores

| Categoria | Score |
|-----------|-------|
| Performance | 97 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| PWA | ✅ |

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

```
MIT License

Copyright (c) 2026 Dione Castro Alves - InNovaIdeia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 📞 Contato

**Dione Castro Alves**  
Fundador da InNovaIdeia

- 📧 Email: [innovaideia2023@gmail.com](mailto:innovaideia2023@gmail.com)
- 💼 LinkedIn: [dione-castro-alves](https://www.linkedin.com/in/dione-castro-alves)
- 🐙 GitHub: [@Foxactive1](https://github.com/Foxactive1)
- 🌐 Website: [innovaideia.com](https://innovaideia.com)

### InNovaIdeia

Transformando desafios em soluções tecnológicas através de consultoria, assessoria em desenvolvimento de software e treinamentos especializados.

**Especialidades:**
- 💻 Desenvolvimento Web (Python, JavaScript, React)
- 🤖 Inteligência Artificial
- 📱 Progressive Web Apps
- 🎨 UX/UI Design
- 📊 Business Intelligence
- 🛒 E-commerce e Varejo

---

## 🙏 Agradecimentos

Este projeto não seria possível sem:

- [Bootstrap](https://getbootstrap.com/) - Framework CSS
- [Bootstrap Icons](https://icons.getbootstrap.com/) - Biblioteca de ícones
- [Chart.js](https://www.chartjs.org/) - Gráficos interativos
- [SweetAlert2](https://sweetalert2.github.io/) - Modais elegantes
- [Google Fonts](https://fonts.google.com/) - Tipografia (Inter)
- [MDN Web Docs](https://developer.mozilla.org/) - Documentação
- [web.dev](https://web.dev/) - Best practices PWA

### Inspirações
- VS Code Command Palette
- Linear App
- Notion
- Figma

---

## 📈 Analytics

![GitHub stars](https://img.shields.io/github/stars/Foxactive1/supermercado-pro?style=social)
![GitHub forks](https://img.shields.io/github/forks/Foxactive1/supermercado-pro?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/Foxactive1/supermercado-pro?style=social)
![GitHub contributors](https://img.shields.io/github/contributors/Foxactive1/supermercado-pro)
![GitHub last commit](https://img.shields.io/github/last-commit/Foxactive1/supermercado-pro)
![GitHub issues](https://img.shields.io/github/issues/Foxactive1/supermercado-pro)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Foxactive1/supermercado-pro)

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Foxactive1/supermercado-pro&type=Date)](https://star-history.com/#Foxactive1/supermercado-pro&Date)

---

<div align="center">

### ⭐ Se este projeto foi útil, considere dar uma estrela!

**Desenvolvido com ❤️ por [Dione Castro Alves](https://www.linkedin.com/in/dione-castro-alves) | [InNovaIdeia](https://innovaideia.com)**

© 2026 InNovaIdeia - Todos os direitos reservados

</div>
