API mínima para gerenciar dados do bot e do site.

Como usar (local):

1. Copie `.env.example` para `.env` e ajuste `API_KEY` e credenciais Postgres.
2. No diretório `api/` rode:

```bash
npm install
npm run start
```

A API ficará disponível em `http://localhost:5500` por padrão.

Rotas exemplo:
- POST `/api/bot/raffle/join` (body: `discord_name`, `discord_tag`, `discord_id`)
- GET `/api/bot/raffle/active`
- POST `/api/site/register` (body: campos do registro)

Todas as rotas exigem header `x-api-key: <API_KEY>`.
