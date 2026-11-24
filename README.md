# Portal de votação CIPA

Spring Boot (Java 17) + React/Vite, em um único serviço no Railway.
Valida o CPF na planilha de colaboradores (aba COLABORADORES_HCM), lista os candidatos da planilha "Base de candidatos - CIPA" e grava o voto no Postgres.

## Variáveis de ambiente (Railway)
| Variável | Para quê |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | JSON da conta de serviço (a mesma do portal serve). As duas planilhas precisam estar compartilhadas com o e-mail dela (leitor). |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Preenchidas pelo plugin Postgres do Railway (use "Add Reference" apontando para o Postgres). |
| `CPF_PEPPER` | Texto secreto longo; entra no hash do CPF. Não troque depois de abrir a votação. |
| `ADMIN_TOKEN` | Senha da tela de apuração (`/#apuracao`). |
| `COLABORADORES_SHEET_ID`, `COLABORADORES_RANGE` | Opcionais. Padrão: aba `COLABORADORES_HCM`, colunas A:H (CPF_AJUSTADO, CPF, NOME, CARGO). Ajuste a posição com `COL_CPF`, `COL_CPF_ALT`, `COL_NOME`, `COL_CARGO` (a partir do 0). |
| `CANDIDATOS_SHEET_ID`, `CANDIDATOS_RANGE` | Opcionais. Padrão: base de candidatos, `'Página1'!A2:B`. |

## Rodar local
```
# Postgres local com banco "cipa" e as variáveis acima exportadas
mvn spring-boot:run          # back em :8080
cd frontend && npm install && npm run dev   # front em :5173 (proxy para /api)
```

## Rotas
- `POST /api/validar` `{cpf}` → nome, cargo e candidatos
- `POST /api/votos` `{cpf, candidato}` → 204
- `GET /api/admin/apuracao` (header `X-Admin-Token`) → contagem
- `/#apuracao` → tela de apuração

## Sigilo
`votantes` guarda só o hash (HMAC-SHA256) do CPF e a hora. `votos` guarda só o candidato, sem CPF e sem hora.
