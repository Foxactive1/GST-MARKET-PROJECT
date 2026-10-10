# Backend GST Market (Neon)

API Flask com autenticação JWT e estado persistido por mercado em PostgreSQL/Neon. A PWA mantém o cache local e sincroniza após o login. Os dados de cada mercado ficam separados pelo token do usuário. A versão do estado evita sobrescrita silenciosa quando duas sessões editaram dados diferentes.

## Desenvolvimento local

Requisitos: Python 3.11+ e um banco PostgreSQL/Neon. O SQLite é usado apenas como fallback local.

```bash
python -m venv .venv
source .venv/bin/activate                 # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env
# Edite DATABASE_URL, SECRET_KEY, JWT_SECRET_KEY e CORS_ORIGINS
flask --app backend.wsgi:app db upgrade
flask --app backend.wsgi:app create-admin
flask --app backend.wsgi:app run
```

A conexão deve ser copiada do painel Neon. Use a connection string pooled para executar a API; mantenha o segredo apenas nas variáveis do serviço. Não commite o arquivo `.env`.

## Criar as tabelas pelo Neon SQL Editor

Se quiser criar o esquema manualmente no painel do Neon, abra o SQL Editor da branch/banco corretos e execute o arquivo [schema.sql](./schema.sql). Ele cria as tabelas relacionais de operação (`categories`, `suppliers`, `clients`, `products`, `inventory`, `sales`, itens, caixa, movimentos de estoque, fidelidade, pedidos de compra e histórico de preços), além de `stores`, `users` e `store_state`. O script registra a revisão `0002_retail_tables` para o Flask-Migrate.

O serviço também aplica essa migração automaticamente ao iniciar. O script SQL pode ser usado antes ou depois desse primeiro deploy. Em banco novo, não é necessário criar as tabelas pelos dois caminhos.

## Publicação

1. Publique o serviço web deste repositório no Render usando o `render.yaml`.
2. Configure `DATABASE_URL` com a URL pooled do Neon e `CORS_ORIGINS` com a origem exata da PWA (sem barra final). Render gera `SECRET_KEY` e `JWT_SECRET_KEY`. A busca de preços usa a rota autenticada `/api/price-search`; se a API do Mercado Livre exigir credencial para sua aplicação, configure `MERCADOLIBRE_ACCESS_TOKEN` como variável secreta.
3. O comando de inicialização do Render aplica as migrações versionadas antes de iniciar a API.
4. Crie o primeiro usuário no shell do serviço: `flask --app backend.wsgi:app create-admin`. Use `create-user` para cadastrar operadores/admins adicionais.
5. Copie a URL HTTPS do serviço para `GST_API_BASE_URL` em `js/api-config.js` e publique novamente o frontend. Essa configuração também é necessária para a pesquisa de preços, que passa pelo backend.

O health check em `/api/health` confirma que a API consegue consultar o Neon. A integração de backend só é ativada quando `GST_API_BASE_URL` tem uma URL; vazia, a demonstração continua usando o login local já existente.

## API

- `POST /api/auth/login` — recebe `{ "username": "...", "password": "..." }`; devolve JWT e usuário.
- `GET /api/auth/me` — valida o token.
- `GET /api/state` — obtém o estado central e sua versão.
- `PUT /api/state` — envia `{ "state": { ... }, "version": 0 }`; nova gravação exige a versão devolvida pela leitura.
- `GET /api/health` — verificação da conexão ao banco.

O primeiro `PUT` usa versão `0`. Atualizações de versões antigas recebem HTTP 409; a PWA preserva a cópia local e mostra uma mensagem para recarregar e resolver a divergência.

## Como os dados são armazenados

O banco possui tabelas relacionais para produtos e estoque, clientes e fidelidade, fornecedores e pedidos de compra, vendas e itens, sessões de caixa, movimentos de estoque e histórico de preços. Cada registro operacional é associado à loja.

Nesta etapa, a PWA ainda envia e recebe o estado completo em `store_state` para preservar o funcionamento offline e a compatibilidade atual. As tabelas relacionais estão criadas e modeladas, mas as rotas atuais ainda não projetam automaticamente o snapshot nessas tabelas. As senhas ficam somente na tabela de usuários, protegidas por hash.
