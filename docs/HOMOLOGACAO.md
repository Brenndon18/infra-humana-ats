# Ambiente de homologação (teste)

**Homologação** é uma cópia do ATS só para testes, como um "ensaio geral" antes da estreia: as versões novas são instaladas e conferidas lá primeiro e só depois vão para a produção (o sistema oficial que a equipe usa).

| | Produção (oficial) | Homologação (teste) |
|---|---|---|
| Endereço | https://ats.infrahumana.com.br | https://ats-homolog.infrahumana.com.br |
| Pasta do app | `/home/infraest/infra-humana-ats` | `/home/infraest/infra-humana-ats-homolog` |
| Banco | `infraest_ats` | `infraest_homolog_ats` |
| Dados | reais | **somente fictícios** |
| Administrador | o atual | outro e-mail e outra senha |

O banco **precisa terminar em `_ats`** (o sistema recusa iniciar se não terminar). Por isso o nome é `infraest_homolog_ats`, e não `infraest_ats_homolog`.

## Variáveis de ambiente do app de homologação

Preencha no painel, no aplicativo Node.js da homologação. Nunca coloque esses valores no repositório.

| Variável | Valor na homologação |
|---|---|
| `ATS_AMBIENTE` | `homologacao` (liga a faixa laranja "AMBIENTE DE HOMOLOGAÇÃO" e as travas de segurança) |
| `APP_ORIGIN` | `https://ats-homolog.infrahumana.com.br` (sem barra no final) |
| `DB_HOST` | o mesmo da produção (normalmente `localhost`) |
| `DB_PORT` | o mesmo da produção (normalmente `3306`) |
| `DB_NAME` | `infraest_homolog_ats` |
| `DB_USER` | o usuário **novo**, criado só para esse banco (ex.: `infraest_homolog`) |
| `DB_PASSWORD` | a senha **nova** desse usuário (diferente da produção) |
| `SETUP_TOKEN` | um código aleatório novo, com 32 caracteres ou mais |
| `PORT` | só se o painel pedir; normalmente ele define sozinho |

Travas automáticas quando `ATS_AMBIENTE=homologacao`:

- o app **não inicia** se `DB_NAME` for `infraest_ats` ou se `APP_ORIGIN` for o endereço de produção;
- o script de dados fictícios só roda na homologação, nunca no banco de produção, e só com o banco vazio.
- o e-mail de agradecimento **nunca** vai para o candidato: sem `EMAIL_TESTE` o envio é só simulado (registra no histórico e não manda nada); com `EMAIL_TESTE` e as variáveis da Microsoft, vai somente para esse endereço de teste. Veja `docs/EMAIL-OUTLOOK.md`.

Na produção nada muda: sem `ATS_AMBIENTE`, o sistema funciona como hoje e não mostra a faixa.

## Dados fictícios

Depois de criar o administrador da homologação pelo site (tela "Primeiro acesso"), rode o script `homolog:dados-ficticios` pelo painel (opção de executar script do aplicativo Node.js) ou pelo terminal, dentro da pasta do app:

```bash
npm run homolog:dados-ficticios
```

Ele cria 4 empresas, 6 vagas, 15 candidatos e 13 vínculos, todos inventados e com e-mails `@example.com` (domínio reservado para exemplos).

## Fluxo de uma nova versão

1. Instalar o ZIP na pasta da homologação e testar lá.
2. Só depois que tudo estiver certo, seguir o roteiro de atualização da produção (com backup).
