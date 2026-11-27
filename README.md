# Portal de votação CIPA

Spring Boot (Java 17) + React/Vite, em um único serviço no Railway.
Valida o CPF ou o RE na planilha de colaboradores (aba COLABORADORES_HCM), lista os candidatos da planilha "Base de candidatos - CIPA" e grava o voto no Postgres.

## Variáveis de ambiente (Railway)
| Variável | Para quê |
|---|---|
| `GOOGLE_CREDENTIALS_JSON` | JSON da conta de serviço (a mesma do portal serve). As duas planilhas precisam estar compartilhadas com o e-mail dela (leitor). |
| `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Preenchidas pelo plugin Postgres do Railway (use "Add Reference" apontando para o Postgres). |
| `CPF_PEPPER` | Texto secreto longo; entra no hash do CPF. Não troque depois de abrir a votação. |
| `ADMIN_TOKEN` | Senha da tela de apuração (`/#apuracao`). |
| `COLABORADORES_SHEET_ID`, `COLABORADORES_RANGE` | Opcionais. Padrão: aba `COLABORADORES_HCM`, colunas A:H (CPF_AJUSTADO, CPF, NOME, CARGO). Ajuste a posição com `COL_CPF`, `COL_CPF_ALT`, `COL_NOME`, `COL_RE`, `COL_CARGO` (a partir do 0). |
| `VOTACAO_ENCERRA_EM` | Opcional. Data e hora de encerramento com fuso, ex.: `2026-12-05T18:00:00-03:00`. Depois dela a votação fecha; antes dela a apuração (placar) fica bloqueada, mas a lista de quem votou continua visível. |
| `LIMITE_POR_MINUTO` | Opcional. Chamadas por minuto de cada IP (padrão 120). Na rede da empresa muita gente sai pelo mesmo IP. |
| `CANDIDATOS_SHEET_ID`, `CANDIDATOS_RANGE` | Opcionais. Padrão: base de candidatos, `'Página1'!A2:B`. |

## Rodar local
```
# Postgres local com banco "cipa" e as variáveis acima exportadas
mvn spring-boot:run          # back em :8080
cd frontend && npm install && npm run dev   # front em :5173 (proxy para /api)
```

## CPF ou RE
Com 9 dígitos ou mais o número é tratado como CPF; com menos, como RE. O voto é sempre barrado pelo hash do CPF da pessoa, então quem vota por RE não consegue votar de novo por CPF. Se o mesmo RE existir em mais de uma empresa da base, o sistema pede o CPF.

## Rotas
- `POST /api/validar` `{cpf}` (o campo aceita CPF ou RE) → nome, cargo e candidatos
- `POST /api/votos` `{cpf, candidato}` → comprovante `{protocolo, nome, cargo, votadoEm}` (nunca traz o candidato)
- `GET /api/admin/apuracao` (header `X-Admin-Token`) → total de votos por candidato
- `GET /api/admin/votantes` (header `X-Admin-Token`) → quem votou: protocolo, nome, cargo, hora e IP (sem a escolha)
- `/#apuracao` → administração: resultado, quem votou, conferência de protocolo e botão **Baixar Excel** (abas Resumo, Apuração, Participação, Por hora e Por IP)

## Sigilo do voto
A NR-5 exige voto secreto. Por isso o sistema guarda duas coisas que **não se ligam**:
- `votantes`: hash do CPF, protocolo, nome, cargo, hora e IP de quem votou;
- `votos`: só o candidato escolhido, sem CPF, sem nome e sem hora. O id é sorteado, para a ordem dos votos não permitir casar um voto com a lista de quem votou.

O comprovante prova a participação, mas não mostra o candidato. Não existe (nem deve existir) uma tela ou planilha de "quem votou em quem".
Para evitar descobrir um voto comparando o placar com a lista de quem votou em tempo real, defina `VOTACAO_ENCERRA_EM`: antes dessa hora a apuração fica bloqueada.

## IP de quem votou
O IP é gravado só na tabela `votantes`, nunca junto do voto. Atrás do Railway o IP do cliente vem no header `X-Real-IP`, que a borda do Railway sobrescreve (o cliente não consegue forjar). O endereço da conexão (`getRemoteAddr`) é o do proxy, por isso não serve. A aba **Por IP** da administração e a aba **Por IP** do Excel mostram quantos votos vieram de cada IP. Muitos votos no mesmo IP não provam fraude: rede da empresa, Wi-Fi e operadora de celular compartilham IP.
