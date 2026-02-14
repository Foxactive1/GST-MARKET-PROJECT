# 🤝 Contribuindo para o Supermercado Pro

Obrigado por considerar contribuir com o Supermercado Pro! Este documento contém diretrizes para contribuir com o projeto.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Posso Contribuir?](#como-posso-contribuir)
- [Processo de Desenvolvimento](#processo-de-desenvolvimento)
- [Padrões de Código](#padrões-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Reportar Bugs](#reportar-bugs)
- [Solicitar Features](#solicitar-features)

## 📜 Código de Conduta

Este projeto adota o [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Ao participar, espera-se que você siga este código.

## 🎯 Como Posso Contribuir?

### 1. Reportar Bugs 🐛

Encontrou um bug? Ajude-nos a melhorar!

- Verifique se o bug já não foi reportado em [Issues](https://github.com/Foxactive1/supermercado-pro/issues)
- Se não foi, [abra uma nova issue](https://github.com/Foxactive1/supermercado-pro/issues/new?template=bug_report.md)
- Use o template de bug report
- Seja claro e descritivo
- Inclua steps para reproduzir o bug
- Adicione screenshots se aplicável

### 2. Sugerir Features ✨

Tem uma ideia para melhorar o projeto?

- Verifique se já não existe uma issue similar
- [Abra uma nova issue](https://github.com/Foxactive1/supermercado-pro/issues/new?template=feature_request.md)
- Use o template de feature request
- Descreva claramente a feature
- Explique o benefício para os usuários
- Adicione exemplos se possível

### 3. Contribuir com Código 💻

Quer contribuir diretamente?

1. **Fork o projeto**
2. **Clone seu fork**
3. **Crie uma branch** para sua feature/correção
4. **Desenvolva**
5. **Teste**
6. **Commit** suas mudanças
7. **Push** para seu fork
8. **Abra um Pull Request**

### 4. Melhorar Documentação 📚

Documentação clara é essencial!

- Corrija erros de digitação
- Melhore explicações
- Adicione exemplos
- Traduza para outros idiomas

### 5. Testar 🧪

- Teste o sistema em diferentes navegadores
- Reporte problemas de compatibilidade
- Teste em diferentes dispositivos
- Valide acessibilidade

## 🔧 Processo de Desenvolvimento

### 1. Setup do Ambiente

```bash
# Fork e clone o repositório
git clone https://github.com/seu-usuario/supermercado-pro.git
cd supermercado-pro

# Crie uma branch para sua feature
git checkout -b feature/nome-da-feature
```

### 2. Desenvolvimento

- Siga os [padrões de código](#padrões-de-código)
- Escreva código limpo e legível
- Comente código complexo
- Mantenha funções pequenas e focadas
- Evite duplicação de código

### 3. Testes

```bash
# Inicie um servidor local
python -m http.server 8000

# Teste em:
- Chrome (Desktop e Mobile)
- Firefox
- Safari (Desktop e Mobile)
- Edge
```

### 4. Commit

```bash
# Adicione suas mudanças
git add .

# Commit com mensagem descritiva
git commit -m "feat: Adiciona nova funcionalidade X"
```

### 5. Push e Pull Request

```bash
# Push para seu fork
git push origin feature/nome-da-feature

# Abra um Pull Request no GitHub
```

## 📝 Padrões de Código

### JavaScript

#### Estilo
```javascript
// Use camelCase para variáveis e funções
const meuObjeto = {};
function minhaFuncao() {}

// Use PascalCase para classes
class MinhaClasse {}

// Use UPPER_CASE para constantes
const MAX_ITEMS = 100;

// Use comentários JSDoc para funções
/**
 * Calcula o total da venda
 * @param {Array} items - Array de itens
 * @returns {number} Total da venda
 */
function calcularTotal(items) {
    return items.reduce((acc, item) => acc + item.preco, 0);
}
```

#### Boas Práticas
```javascript
// ✅ Bom
const items = data.filter(item => item.ativo);
const total = items.reduce((sum, item) => sum + item.valor, 0);

// ❌ Evitar
var items = [];
for (var i = 0; i < data.length; i++) {
    if (data[i].ativo) {
        items.push(data[i]);
    }
}
```

### HTML

```html
<!-- Use semântica apropriada -->
<nav>
    <ul>
        <li><a href="#home">Home</a></li>
    </ul>
</nav>

<!-- Sempre inclua atributos de acessibilidade -->
<button aria-label="Fechar modal" onclick="closeModal()">
    <i class="bi bi-x" aria-hidden="true"></i>
</button>

<!-- Use indentação consistente (2 ou 4 espaços) -->
<div class="container">
    <div class="row">
        <div class="col">
            Conteúdo
        </div>
    </div>
</div>
```

### CSS

```css
/* Use BEM ou nomenclatura consistente */
.card {}
.card__header {}
.card__body {}
.card--featured {}

/* Organize propriedades logicamente */
.elemento {
    /* Positioning */
    position: relative;
    top: 0;
    left: 0;
    
    /* Box Model */
    display: flex;
    width: 100%;
    padding: 1rem;
    margin: 1rem 0;
    
    /* Typography */
    font-size: 1rem;
    color: #333;
    
    /* Visual */
    background: #fff;
    border: 1px solid #ddd;
    
    /* Misc */
    transition: all 0.3s ease;
}

/* Use variáveis CSS */
:root {
    --primary-color: #0d6efd;
    --spacing-md: 1rem;
}

.button {
    background: var(--primary-color);
    padding: var(--spacing-md);
}
```

## 📝 Commits

### Formato

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: Nova feature
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação, ponto e vírgula, etc
- `refactor`: Refatoração de código
- `perf`: Melhoria de performance
- `test`: Adição ou correção de testes
- `chore`: Manutenção geral

### Exemplos

```bash
# Feature
git commit -m "feat(pdv): adiciona cálculo automático de troco"

# Bug fix
git commit -m "fix(estoque): corrige validação de quantidade"

# Documentação
git commit -m "docs: atualiza README com instruções de instalação"

# Refatoração
git commit -m "refactor(theme): melhora lógica de detecção de tema"

# Performance
git commit -m "perf(dashboard): otimiza renderização de gráficos"
```

## 🔄 Pull Requests

### Checklist

Antes de abrir um PR, verifique:

- [ ] Código segue os padrões do projeto
- [ ] Todos os testes passam
- [ ] Código está documentado
- [ ] README atualizado (se necessário)
- [ ] CHANGELOG atualizado
- [ ] Sem conflitos com a branch main
- [ ] Commits seguem o padrão
- [ ] PR tem descrição clara

### Template

```markdown
## Descrição
Breve descrição das mudanças

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Como Testar?
1. Vá para '...'
2. Clique em '....'
3. Veja '....'

## Screenshots (se aplicável)
Adicione screenshots para mudanças visuais

## Checklist
- [ ] Código segue os padrões
- [ ] Testes passam
- [ ] Documentação atualizada
```

### Review Process

1. **Automated Checks** - CI/CD valida o código
2. **Code Review** - Maintainer revisa o código
3. **Testing** - Testamos as mudanças
4. **Merge** - PR é merged se aprovado

## 🐛 Reportar Bugs

### Antes de Reportar

1. Atualize para a versão mais recente
2. Verifique se já não foi reportado
3. Reproduza o bug em modo incógnito
4. Teste em diferentes navegadores

### Template de Bug Report

```markdown
**Descrição**
Descrição clara e concisa do bug

**Para Reproduzir**
1. Vá para '...'
2. Clique em '....'
3. Veja o erro

**Comportamento Esperado**
O que deveria acontecer

**Screenshots**
Se aplicável, adicione screenshots

**Ambiente**
- OS: [ex. Windows 10]
- Browser: [ex. Chrome 120]
- Versão: [ex. 1.0.0]

**Informações Adicionais**
Qualquer outra informação relevante
```

## ✨ Solicitar Features

### Template de Feature Request

```markdown
**A feature está relacionada a um problema?**
Descrição clara do problema. Ex: Sempre fico frustrado quando [...]

**Descreva a solução desejada**
Descrição clara do que você quer que aconteça

**Descreva alternativas consideradas**
Descrição de soluções ou features alternativas

**Contexto Adicional**
Qualquer outra informação ou screenshots
```

## 🏆 Reconhecimento

Contribuidores serão:

- Adicionados ao README
- Mencionados no CHANGELOG
- Referenciados em releases

## 📞 Dúvidas?

- Abra uma [Discussion](https://github.com/Foxactive1/supermercado-pro/discussions)
- Entre em contato: innovaideia2023@gmail.com

## 📚 Recursos

- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)

---

**Obrigado por contribuir! 🎉**

Desenvolvido com ❤️ por [Dione Castro Alves](https://www.linkedin.com/in/dione-castro-alves) | InNovaIdeia
