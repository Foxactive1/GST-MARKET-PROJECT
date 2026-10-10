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

## Publicação

1. Publique o serviço web deste repositório no Render usando o `render.yaml`.
2. Configure `DATABASE_URL` com a URL pooled do Neon e `CORS_ORIGINS` com a origem exata da PWA (sem barra final). Render gera `SECRET_KEY` e `JWT_SECRET_KEY`.
3. O comando de inicialização do Render aplica as migrações versionadas antes de iniciar a API.
4. Crie o primeiro usuário no shell do serviço: `flask --app backend.wsgi:app create-admin`. Use `create-user` para cadastrar operadores/admins adicionais.
5. Copie a URL HTTPS do serviço para `GST_API_BASE_URL` em `js/api-config.js` e publique novamente o frontend.

O health check em `/api/health` confirma que a API consegue consultar o Neon. A integração de backend só é ativada quando `GST_API_BASE_URL` tem uma URL; vazia, a demonstração continua usando o login local já existente.

## API

- `POST /api/auth/login` — recebe `{ "username": "...", "password": "..." }`; devolve JWT e usuário.
- `GET /api/auth/me` — valida o token.
- `GET /api/state` — obtém o estado central e sua versão.
- `PUT /api/state` — envia `{ "state": { ... }, "version": 0 }`; nova gravação exige a versão devolvida pela leitura.
- `GET /api/health` — verificação da conexão ao banco.

O primeiro `PUT` usa versão `0`. Atualizações de versões antigas recebem HTTP 409; a PWA preserva a cópia local e mostra uma mensagem para recarregar e resolver a divergência.

## Limite desta primeira etapa

Para manter compatibilidade com a PWA offline já existente, produtos, clientes, fornecedores, vendas, pedidos, fidelidade e configuração são sincronizados como um snapshot JSON por mercado em `store_state`. As contas de usuário e lojas são relacionais. A senha é armazenada com hash, nunca no snapshot. Uma próxima etapa pode converter os módulos mais consultados em tabelas relacionais sem perder a experiência offline.
