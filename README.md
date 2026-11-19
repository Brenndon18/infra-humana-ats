# Infra Humana ATS

Sistema interno de recrutamento (ATS) da Infra Humana: cadastro de empresas, vagas e candidatos, vínculos e etapas do processo seletivo, indicadores e histórico de apresentações.

Em produção em https://ats.infrahumana.com.br (versão **2.3.0**).

## Stack

- Front-end em HTML, CSS e JavaScript puro (pasta `public/`).
- Servidor Node.js (>= 22) com o módulo `http` nativo, sem framework (`server.js`, `app.js`).
- Banco MySQL via `mysql2` (`database.js`). Os dados de negócio ficam num JSON único na tabela `ats_state`; usuários e sessões têm tabelas próprias.

Documentação completa do sistema: [docs/CONTEXTO.md](docs/CONTEXTO.md).

## Rodar os testes

```bash
npm ci      # instala as dependências exatamente como no package-lock.json
npm test    # roda os testes automatizados (36 na versão 2.3)
```

Os testes não precisam de banco de dados: usam um repositório em memória e dados fictícios.

## Variáveis de ambiente

Configuradas **somente** no painel da hospedagem, nunca no repositório:
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME` (precisa terminar em `_ats`), `DB_PASSWORD`, `APP_ORIGIN`, `SETUP_TOKEN` (apenas para o primeiro acesso) e `PORT`.

## Deploy no Painel Munhoz (resumo)

O deploy continua manual. Detalhes e verificação pós-instalação em `ATUALIZACAO-2.3.txt`.

1. Combine uma pausa com a equipe (ninguém editando durante a atualização).
2. Faça backup SQL do banco `infraest_ats` e baixe uma cópia da pasta `/home/infraest/infra-humana-ats`.
3. No aplicativo Node.js do ATS, clique em **Parar aplicativo**.
4. Envie o ZIP da versão para `/home/infraest/infra-humana-ats` e extraia ali, substituindo os arquivos (sem criar subpasta). `server.js`, `app.js` e `public/` devem ficar na raiz.
5. Mantenha as variáveis de ambiente atuais e não altere o `.htaccess`.
6. Inicie o aplicativo. Só rode `npm` se a versão mudar dependências.
7. Abra o site com Ctrl+Shift+R e confira a versão em **Configurações**.

Para voltar à versão anterior: pare o aplicativo, restaure a cópia dos arquivos (e o SQL, se necessário) e reinicie.

## Regras do projeto

- Nunca colocar senhas, `DB_PASSWORD`, `SETUP_TOKEN` ou dados reais de candidatos no repositório.
- Usar somente dados fictícios em testes.
- Integração com SharePoint só com autorização específica.
