# Infra Humana ATS — Contexto técnico e funcional para continuidade por outra IA

**Documento de transferência de contexto**  
**Última revisão:** 19/11/2026  
**Base técnica analisada:** pacote de código `infra-humana-ats-atualizacao-2.3.zip` (`package.json` versão `2.3.0`)  
**Documentos complementares:** `Backlog-Infra-Humana-ATS.md` (versão documental 13, 09/11/2026) e `Infra-Humana-ATS-Referencia-UI-UX-Figma.md` (16/11/2026).

> Este documento reúne o que foi identificado no código-fonte e nas decisões registradas do projeto. Ele não substitui a inspeção do ambiente de produção. **Não assumir que a versão 2.3 está publicada:** o pacote e as notas registram que ela foi preparada e testada localmente, mas não instalada nem validada contra o MySQL de produção. A versão efetivamente publicada deve ser confirmada na tela Configurações e no painel de hospedagem antes de qualquer alteração.

---

## 1. Resumo executivo

O **Infra Humana ATS** é um sistema interno de recrutamento e seleção da consultoria Infra Humana. Seu objetivo é centralizar empresas clientes, vagas, banco de talentos e o acompanhamento de cada candidato em cada vaga.

A aplicação atual é um sistema web enxuto, sem framework de frontend ou backend:

- **Frontend:** HTML, CSS e JavaScript puro (Vanilla JavaScript), executado no navegador.
- **Backend:** Node.js, usando o módulo nativo `http` para atender páginas e API. Não usa Express.
- **Banco:** MySQL, acessado pela biblioteca `mysql2/promise`.
- **Persistência dos dados de negócio:** um estado JSON serializado em uma única coluna `LONGTEXT` na tabela `ats_state`.
- **Autenticação:** usuários individuais, senha derivada com `scrypt`, sessão armazenada no MySQL e cookie HttpOnly.
- **Hospedagem registrada nas instruções:** aplicação Node.js no painel chamado **Painel Munhoz**, subdomínio `https://ats.infrahumana.com.br`, diretório `/home/infraest/infra-humana-ats`.
- **Versão do pacote analisado:** `2.3.0`, exige Node.js `>=22`.

**Importante sobre o banco:** apesar de usar MySQL, o sistema 2.3 não tem uma tabela relacional separada para cada empresa, vaga, candidato e candidatura. Esses registros são lidos e gravados juntos no JSON de `ats_state`. As tabelas separadas são voltadas principalmente a usuários, sessões, tentativas de login e registros técnicos de revisão.

---

## 2. Identidade e objetivo do produto

- **Produto:** Infra Humana ATS.
- **Organização:** Infra Humana — consultoria de recrutamento, seleção e hunting com atuação em Engenharia, Infraestrutura, Tecnologia e Telecomunicações.
- **Público atual:** equipe interna da consultoria, com contas individuais (por exemplo, administrador e equipe de recrutamento).
- **Não é, na versão 2.3 analisada, um portal multiempresa para clientes externos.** Requisitos antigos de um MVP mais amplo mencionavam portal do cliente, requisição digital e recursos de IA; isso não deve ser confundido com funções implementadas no código atual.
- **Idioma da interface:** português do Brasil, com o valor histórico de etapa `On holding` mantido em inglês para preservar os dados existentes.

### Princípios operacionais

1. Um cadastro de candidato representa a pessoa; a candidatura representa a participação dessa pessoa em uma vaga específica.
2. O mesmo candidato pode participar de várias vagas, com etapa, responsável, datas e observações independentes em cada participação.
3. Vincular um candidato a uma vaga não significa que houve contato, entrevista ou apresentação.
4. Indicadores devem refletir a regra de negócio e a unidade correta (vaga ou candidatura).
5. Salvamentos e exclusões precisam ser confirmados pelo servidor; não mostrar sucesso antes da confirmação.
6. Preservar histórico, identificadores e relacionamentos ao alterar código ou banco.

---

## 3. Stack tecnológica confirmada no pacote 2.3

| Camada | Tecnologia identificada | Observação |
|---|---|---|
| Linguagem frontend | JavaScript puro | Não há React, Vue, Angular ou TypeScript no pacote. |
| Estrutura frontend | HTML5 | `public/index.html`. |
| Estilos | CSS | `public/style.css`; identidade visual cinza/verde e modo noturno. |
| Linguagem backend | JavaScript em Node.js | CommonJS (`require` / `module.exports`). |
| Servidor HTTP | `node:http` nativo | Backend implementa as rotas diretamente; não usa Express. |
| Banco de dados | MySQL | Tabelas InnoDB, charset `utf8mb4`. |
| Driver MySQL | `mysql2` versão `3.24.6` | Usa a API de Promises (`mysql2/promise`). |
| Testes | Node.js Test Runner | `node --test test/*.test.js`. |
| Fontes | Manrope | Carregada via Google Fonts no CSS. |

### Dependências do `package.json`

```json
{
  "name": "infra-humana-ats",
  "version": "2.3.0",
  "private": true,
  "engines": { "node": ">=22" },
  "scripts": {
    "start": "node app.js",
    "test": "node --test test/*.test.js"
  },
  "dependencies": {
    "mysql2": "3.24.6"
  }
}
```

Não há outras dependências de produção declaradas no pacote. As funções HTTP, criptografia, arquivos e utilitários do backend usam módulos nativos do Node.js.

---

## 4. Estrutura do código-fonte

Estrutura do pacote 2.3 analisado:

```text
infra-humana-ats/
├── app.js                    # Entrada do processo Node.js
├── server.js                 # API HTTP, autenticação, validação e regras de negócio
├── database.js               # Pool MySQL, criação das tabelas e operações de persistência
├── package.json              # Versão, requisito de Node e scripts
├── package-lock.json         # Lockfile das dependências
├── ATUALIZACAO-2.3.txt       # Histórico e procedimento de instalação da versão 2.3
├── public/
│   ├── index.html            # Estrutura HTML inicial
│   ├── app.js                # Interface, telas, formulários e interação com a API
│   ├── auth.js               # Login, setup inicial, sessão e criação de usuários
│   ├── query.js              # Parser de pesquisa, filtros e operadores
│   ├── theme.js              # Tema claro/escuro e preferência local
│   ├── style.css             # Estilo e responsividade
│   └── logo.png              # Logo usada pela interface
└── test/
    ├── app.test.js           # Testes de regras principais, segurança e HTTP
    ├── deletion.test.js      # Exclusões, filtros e escopo dos vínculos
    ├── release23.test.js     # Regras adicionadas na versão 2.3
    └── v2.test.js            # Regras introduzidas na versão 2.x
```

### Responsabilidade dos arquivos principais

- `app.js`: ponto de entrada muito pequeno; importa `server.js`, chama `start()` e trata falha de inicialização. O comentário informa compatibilidade com `node app.js` e carregador LiteSpeed.
- `server.js`: servidor HTTP nativo, rotas `/api/*`, autenticação, autorização, sanitização dos dados e regras para vagas/candidaturas/históricos.
- `database.js`: configura conexão MySQL, cria tabelas caso não existam, inicializa o estado vazio e implementa operações transacionais.
- `public/app.js`: monta as telas e formulários, mantém o estado carregado no navegador e envia o estado completo ao backend ao salvar.
- `public/auth.js`: tela de login/primeiro acesso, chamadas da API, dados do usuário conectado e ações de sessão.
- `public/query.js`: parser e avaliador de expressões de pesquisa e regras de filtros.
- `public/theme.js`: alternância entre tema normal e noturno; guarda a preferência em `localStorage` do navegador.

---

## 5. Hospedagem e execução

### Dados registrados no pacote de instalação

| Item | Valor confirmado nas instruções |
|---|---|
| Subdomínio | `https://ats.infrahumana.com.br` |
| Painel mencionado | Painel Munhoz |
| Diretório da aplicação | `/home/infraest/infra-humana-ats` |
| Runtime | Node.js `>=22` |
| Inicialização | `node app.js` (script `npm start`) |
| Porta | `process.env.PORT` ou `3000` como fallback |
| Banco | `infraest_ats` é o nome citado no procedimento de backup; `DB_NAME` precisa terminar em `_ats` |
| Diretório público | `/home/infraest/infra-humana-ats/public` |

O pacote de atualização orienta usar o recurso de aplicação Node.js do painel, parar e iniciar o aplicativo por ele, e não alterar o `.htaccess` do subdomínio. A nota do `app.js` também cita compatibilidade com um carregador LiteSpeed.

**O provedor comercial/empresa responsável pelo painel não pôde ser confirmado pelo código-fonte.** Não assumir Hostinger, cPanel, VPS de outro fornecedor ou qualquer outro provedor apenas com base nesses dados. O nome comprovado no procedimento é “Painel Munhoz”.

### Variáveis de ambiente usadas pelo código

| Variável | Obrigatória? | Uso / regra |
|---|---|---|
| `APP_ORIGIN` | Sim | Deve ser exatamente `https://ats.infrahumana.com.br`, sem barra final. O backend exige HTTPS e origem sem caminho. |
| `DB_HOST` | Não no código | Host do MySQL; default `localhost`. Confirmar valor real no painel. |
| `DB_PORT` | Não no código | Porta MySQL; default `3306`. |
| `DB_USER` | Sim na prática | Usuário MySQL. Valor real não está no pacote. |
| `DB_NAME` | Sim | Nome do banco; deve terminar com `_ats`. A documentação de instalação menciona `infraest_ats`. |
| `DB_PASSWORD` | Sim | Senha do banco. Não está incluída no pacote e não deve ser colocada em documentação pública. |
| `SETUP_TOKEN` | Sim para primeiro setup | Código secreto usado para criar o primeiro administrador; exige pelo menos 32 caracteres. Não compartilhar com outra IA nem inserir em repositório. |
| `PORT` | Definida pelo painel ou fallback | Porta em que o Node escuta; default `3000`. |

O código não lê `NODE_ENV` nem depende de um arquivo `.env` no pacote. As variáveis devem ser conferidas no painel de hospedagem, sem presumir seus valores.

### Validações de inicialização

O servidor não inicia se:

- `APP_ORIGIN` estiver ausente, não for HTTPS ou tiver barra final/caminho extra;
- `DB_PASSWORD` estiver ausente;
- `DB_NAME` não terminar em `_ats`.

### Procedimento de atualização documentado para 2.3

1. Combinar uma janela de manutenção e pedir que ninguém edite o ATS durante a atualização.
2. Fazer backup SQL atualizado do banco `infraest_ats` e baixar uma cópia da pasta atual da aplicação.
3. Parar a aplicação Node.js no painel.
4. Extrair o ZIP diretamente em `/home/infraest/infra-humana-ats`, substituindo os arquivos existentes. Não criar uma segunda pasta `infra-humana-ats` dentro da pasta atual.
5. Conferir que `server.js`, `app.js` e `public/` estão diretamente na raiz da aplicação.
6. Manter as variáveis de ambiente existentes. A atualização 2.3 não exige novas variáveis.
7. Não alterar o `.htaccess` do subdomínio.
8. Iniciar a aplicação Node.js.
9. Abrir o subdomínio e fazer recarga forçada (`Ctrl+Shift+R`); todos os usuários devem fechar/reabrir ou atualizar abas antigas antes de editar.
10. Conferir em Configurações se aparece “Versão 2.3” e executar a validação funcional.

As dependências declaradas são as mesmas da versão anterior citada no procedimento; por isso o roteiro 2.3 informa que não é necessário executar NPM na atualização. Em uma instalação nova, verificar `npm install`/dependências e configuração do ambiente antes de iniciar.

**Rollback:** parar o aplicativo, restaurar a cópia dos arquivos anterior e reiniciar. Restaurar também o backup SQL anterior somente se for necessário reverter os dados; isso elimina alterações posteriores ao backup. A versão antiga pode não reconhecer campos novos e apagá-los ao salvar, então não permitir uso de abas antigas ou gravação de dados com código antigo depois da atualização.

---

## 6. Como o banco de dados funciona

### Visão geral: MySQL + estado JSON

O banco utilizado é MySQL, mas o modelo de persistência do negócio é híbrido e bastante simples:

- Empresas, vagas, candidatos, candidaturas e históricos são armazenados dentro de um único objeto JSON.
- Esse objeto é serializado como texto e salvo na coluna `payload` da tabela `ats_state` (`LONGTEXT`).
- A aplicação carrega o estado completo do banco para o navegador ao iniciar/atualizar.
- Ao salvar, o navegador envia o objeto completo ao backend; o backend valida e substitui o JSON salvo.
- Usuários, sessões, tentativas de login e auditoria técnica ficam em tabelas SQL próprias.

Portanto, **não existem tabelas separadas `companies`, `jobs`, `candidates` e `applications` na versão 2.3 analisada**. As relações entre esses objetos são IDs dentro do JSON e são verificadas pelo servidor.

### Tabelas criadas por `database.js`

| Tabela | Finalidade | Campos principais identificados |
|---|---|---|
| `ats_state` | Estado principal do ATS | `id`, `revision`, `payload LONGTEXT` |
| `ats_users` | Contas individuais da equipe | `id`, `name`, `email`, `password`, `role`, `active` |
| `ats_sessions` | Sessões autenticadas | `token`, `user_id`, `expires` |
| `ats_login_attempts` | Controle de tentativas de login | `attempt_key`, `attempts`, `expires` |
| `ats_audit` | Auditoria técnica resumida de gravações | `id`, `user_id`, `revision`, `created_at` |

As tabelas são criadas automaticamente com `CREATE TABLE IF NOT EXISTS` quando o backend conecta ao MySQL. O estado inicial é criado com arrays vazios se a linha principal ainda não existir.

### Detalhes das tabelas

**`ats_state`**

```sql
CREATE TABLE IF NOT EXISTS ats_state (
  id INT PRIMARY KEY,
  revision INT NOT NULL DEFAULT 0,
  payload LONGTEXT NOT NULL
) ENGINE=InnoDB;
```

O registro usado pela aplicação tem `id = 1`. `revision` é um contador global de versão do estado. `payload` contém o JSON completo.

**`ats_users`**

Armazena nome, e-mail, hash/derivação da senha, papel (`admin` ou `member`) e indicador de usuário ativo. Nome e e-mail têm restrições `UNIQUE`.

**`ats_sessions`**

Armazena o hash do token da sessão, ID do usuário e horário de expiração. As sessões expiram em 8 horas.

**`ats_login_attempts`**

Armazena uma chave derivada do e-mail e a quantidade de tentativas com expiração. Ao atingir cinco tentativas incorretas, novos logins ficam bloqueados por 15 minutos.

**`ats_audit`**

Registra quem salvou e qual revisão foi gravada, com timestamp. Não é uma trilha granular de cada campo alterado; o histórico operacional de vagas/candidaturas está no JSON de negócio.

### Estrutura do JSON principal

A função `empty()` de `server.js` define o estado inicial:

```json
{
  "companies": [],
  "jobs": [],
  "candidates": [],
  "applications": [],
  "history": []
}
```

#### `companies` — empresas

Campos relevantes:

- `id`: identificador numérico;
- `name`: nome obrigatório;
- `sector`: setor opcional;
- `city`: cidade/UF opcional;
- `logo`: imagem codificada em Data URI/Base64 (o backend aceita PNG ou WebP após tratamento no navegador).

#### `jobs` — vagas

Campos relevantes:

- `id`;
- `company`: ID da empresa;
- `title`: título/posição;
- `owner`: nome do usuário responsável, que precisa estar ativo;
- `deadline`: prazo de apresentação (data `YYYY-MM-DD` ou vazio);
- `status`: status da vaga;
- `mapped`: campo legado preservado no JSON;
- `chosen`: ID do candidato escolhido, ou `null`.

Na interface 2.3, o cartão “Profissionais mapeados” é calculado pelo total de candidaturas vinculadas (`applications`) àquela vaga. O antigo valor manual continua preservado no campo `mapped`, mas não é usado como o número visível do cartão.

#### `candidates` — banco de talentos

Campos relevantes:

- `id`;
- `name`;
- `email`;
- `phone`, `phone1`, `phone2`;
- `city`;
- `origin`;
- `cv`: link externo do currículo (não é o arquivo do currículo).

O e-mail é opcional, mas, quando informado, é normalizado para minúsculas e não pode se repetir entre candidatos. A versão atual não oferece upload de currículo PDF/DOCX.

#### `applications` — candidatura/vínculo candidato-vaga

Cada objeto representa uma participação específica de um candidato em uma vaga.

Campos relevantes:

- `id`;
- `job`: ID da vaga;
- `candidate`: ID do candidato;
- `status`: etapa atual;
- `owner`: responsável pela candidatura;
- `first`: data do primeiro contato;
- `interview`: data da entrevista/agendamento;
- `follow`: data de acompanhamento;
- `action`: próxima ação/atividade;
- `interviewed`: marcador histórico de entrevista realizada;
- `presented`: marcador histórico de apresentação ao cliente;
- `presentationDates`: array com as datas de apresentação;
- `clientPending`: indicador de pendência de retorno do cliente;
- `notes`: observações dessa participação, cada uma com ID, texto, autor e data.

O mesmo candidato pode ter várias candidaturas em vagas diferentes. Não misturar etapa, responsável, entrevista, apresentação nem observações de uma participação com outra.

#### `history` — histórico de vaga

Registros relacionados a uma vaga, com `id`, `job`, `text`, `author` e `at`.

### Relacionamentos e validações

- Uma empresa pode ter várias vagas.
- Uma vaga pertence a uma empresa existente.
- Um candidato pode existir sem vaga e pode participar de várias vagas.
- Uma candidatura deve apontar para vaga e candidato existentes.
- Não pode haver duplicação do par `job + candidate`.
- Não é permitido trocar a vaga ou o candidato de uma candidatura já existente; para outro processo, cria-se outro vínculo.
- O profissional escolhido na vaga precisa estar vinculado àquela vaga.
- O servidor normaliza e valida o estado inteiro antes de gravá-lo.

### Concorrência e salvamento

O `revision` global evita sobrescrita silenciosa:

1. O browser carrega `{ revision, data }`.
2. No salvamento, envia a revisão que havia carregado e o estado `data` completo.
3. O MySQL inicia uma transação e trava a linha de `ats_state` com `SELECT ... FOR UPDATE`.
4. Se a revisão no banco for diferente da revisão enviada, o servidor devolve HTTP `409` e rejeita a gravação.
5. Se for igual, valida os dados, incrementa a revisão, grava o novo JSON e registra o usuário/revisão em `ats_audit`.

O controle é global: duas pessoas podem entrar em conflito mesmo se estiverem editando registros diferentes. Na interface atual, em caso de conflito ela tenta recarregar o estado mais novo e mostra erro. O rascunho que estava no formulário pode ser perdido; preservar o rascunho é melhoria futura, não garantia existente.

### Backup

Existem dois tipos distintos:

- **Exportar backup pela interface (`/api/export`):** baixa o estado do ATS em JSON, com cadastros, vínculos e históricos de negócio.
- **Backup SQL no painel de hospedagem:** é necessário para uma cópia completa do banco, inclusive usuários, sessões, tentativas e auditoria técnica.

O botão de exportação do ATS não equivale a backup integral do banco ou da hospedagem. Antes de atualização, a instrução oficial pede backup SQL e cópia da pasta do aplicativo.

---

## 7. Autenticação, usuários e segurança

### Primeiro acesso

- A rota `/api/status` informa se ainda é necessário configurar o sistema.
- Quando não há usuários, a tela apresenta o primeiro acesso.
- O primeiro administrador é criado via `/api/setup`, usando o `SETUP_TOKEN` configurado no painel.
- O setup só pode ser concluído uma vez.
- O token de instalação precisa ter pelo menos 32 caracteres.

### Senhas e login

- Senhas aceitas: 12 a 128 caracteres.
- O servidor deriva a senha com `crypto.scrypt`, salt aleatório e chave de 64 bytes.
- A senha não é armazenada em texto puro.
- Após cinco tentativas inválidas, o login fica bloqueado por 15 minutos para a chave de e-mail.
- Mensagem de falha de login não revela se o e-mail existe.

### Sessões

- Token aleatório de 32 bytes; apenas hash SHA-256 do token é salvo no banco.
- Cookie de produção: `__Host-ih_session` com `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` e validade de 8 horas.
- Ao trocar a senha, todas as sessões existentes daquele usuário são removidas.
- Logout remove a sessão do banco e limpa o cookie.

### Papéis

- `admin`: pode criar usuários da equipe e administradores.
- `member`: usuário comum da equipe.
- A criação de usuários é restrita a administradores.
- **Não há matriz granular de permissões por ação no pacote analisado.** Rotas de alteração de dados, exclusões e exportação não estão limitadas por papel de forma granular. Não afirmar que usuário Equipe é somente leitura ou que apenas Administrador pode excluir cadastros.
- A tabela tem coluna `active`, mas o pacote não apresenta uma tela/rota de administração completa para desativar ou excluir usuário.

### Proteções HTTP identificadas

- API exige HTTPS em produção.
- Operações de escrita validam a origem (`Origin`) contra `APP_ORIGIN`.
- Operações de escrita exigem conteúdo JSON.
- Limite máximo do corpo de requisição: 2 MiB.
- Cabeçalhos de proteção incluem `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy` e `Permissions-Policy`.

### Limitações relevantes

- Não há fluxo de recuperação de senha por e-mail no pacote; a tela orienta solicitar ajuda ao responsável técnico.
- Não há MFA/2FA implementado.
- Não prometer auditoria imutável: registros de histórico/observações podem ser excluídos por ações explícitas.
- A tabela `ats_audit` é resumida e não contém o detalhe de cada campo modificado.

---

## 8. Módulos e funcionalidades da interface

### 8.1 Visão geral

Quatro indicadores principais, todos clicáveis:

1. **Vagas em andamento:** vagas que não estejam encerradas, canceladas ou congeladas.
2. **Vagas com prazo vencido:** vagas ativas com prazo anterior à data corrente no fuso `America/Sao_Paulo`. Prazo igual a hoje ou ausente não é atraso.
3. **Apresentações neste mês:** conta uma candidatura por mês com pelo menos uma data de apresentação no mês. Reenvios na mesma candidatura e no mesmo mês não duplicam o total. Reenvios em meses diferentes contam em cada mês correspondente.
4. **Aguardando retorno do cliente:** candidaturas com material enviado e pendência ativa, em vagas/processos ativos. Não deduplicar por pessoa se ela tiver pendências em vagas diferentes.

Outros elementos existentes: vagas em acompanhamento, próximos passos registrados e distribuição das candidaturas por etapa.

Regras de período e data:

- Calendário de referência: `America/Sao_Paulo`.
- Apresentações de vagas encerradas posteriormente continuam no indicador do mês em que foram feitas.
- Dados antigos sem data confiável não recebem uma data inventada nem entram automaticamente no mês atual.
- Aprovação/reprovação pelo cliente encerra a pendência de retorno.
- Uma nova transição para `Material enviado ao cliente` abre uma nova pendência.
- Apenas reabrir a vaga não cria uma nova pendência.

### 8.2 Empresas

Campos:

- Nome obrigatório (até 150 caracteres).
- Setor opcional (até 150 caracteres).
- Cidade/UF opcional (até 150 caracteres).
- Logo opcional.

O fluxo de imagem reduz a logo no navegador para até 160 × 160 px, preserva a proporção e a converte em WebP. O backend valida o conteúdo reduzido; não tratar como armazenamento de arquivo original em alta resolução.

Cartões exibem nome, setor, cidade, logo, quantidade de vagas e quantidade de vagas em andamento. É possível editar, ver vagas da empresa e excluir.

**Regra de exclusão:** empresa com vagas não pode ser excluída.

### 8.3 Vagas

Campos:

- Título/posição obrigatório (até 200 caracteres).
- Empresa obrigatória e existente.
- Responsável interno, que deve ser usuário ativo.
- Prazo de apresentação opcional.
- Status.
- Profissional escolhido opcional, limitado a candidatos vinculados à vaga.

Status de vaga aceitos no backend:

- `Aberta`
- `Entrevista Técnica`
- `Negociação Cliente`
- `Congelada`
- `Encerrada`
- `Cancelada`

Não confundir status de vaga com etapa de candidatura. Vaga congelada não conta nos indicadores de processos ativos, atrasados ou retorno pendente.

A lista de vagas mostra vaga/empresa, responsável, prazo, status e total de candidaturas vinculadas. Detalhe da vaga inclui edição, exclusão, lista de candidaturas, vínculo de novo candidato, profissional escolhido e histórico.

No detalhe da vaga há quatro cartões:

- Profissionais mapeados;
- Candidatos na vaga;
- Entrevistas realizadas;
- Apresentados ao cliente.

Na 2.3, os dois primeiros têm o mesmo valor: total de candidaturas vinculadas. Não inventar uma diferença de métrica entre eles. A proposta de unificá-los foi registrada como ponto de UX a discutir.

### 8.4 Candidatos / banco de talentos

Campos:

- Nome completo obrigatório (até 150 caracteres).
- E-mail opcional (até 254 caracteres).
- Celular e até dois telefones adicionais (até 50 caracteres cada).
- Cidade/UF e origem (até 150 caracteres cada).
- Link externo do currículo (até 2.000 caracteres).

O link do currículo deve ser HTTP ou HTTPS, sem usuário/senha embutidos na URL. E-mail é validado e não pode duplicar outro candidato (comparação sem diferenciar maiúsculas/minúsculas). Não há deduplicação por nome, telefone ou CPF.

**Não há upload de currículo PDF/DOCX na versão atual.** O campo é um link externo. O upload de logo de empresa não significa que haja upload de currículo.

O candidato pode existir sem candidatura e pode ser vinculado a mais de uma vaga.

### 8.5 Candidatura / acompanhamento

Ao vincular:

- Criar um vínculo específico entre candidato e vaga.
- Iniciar em branco (`status: ""`), representado na interface como **Sem etapa**.
- Não registrar primeiro contato, entrevista ou apresentação pelo simples vínculo.
- Contar o vínculo no total de candidatos da vaga.

Etapas aceitas:

1. Sem etapa (valor vazio)
2. `On holding`
3. `Contato iniciado`
4. `Em tratativa`
5. `Entrevista feita`
6. `Aprovado na entrevista RH`
7. `Reprovado em entrevista RH`
8. `Reprovado pelo cliente`
9. `Material enviado ao cliente`
10. `Aprovado pelo cliente`

A lista de etapas é um conjunto de opções; o backend não impõe um roteiro obrigatório de transições.

Campos do acompanhamento:

- Etapa;
- Responsável;
- Primeiro contato;
- Data de entrevista;
- Data de apresentação ao cliente;
- Próxima ação;
- Nova observação;
- Observações/histórico com autor e data.

O campo antigo “Data do próximo contato” foi removido da tela; não reintroduzir. A data de acompanhamento e “Próxima ação” são conceitos distintos.

#### Entrevista — regra crítica

- A data de entrevista pode representar agendamento; não prova que a entrevista aconteceu.
- O marcador `interviewed` se torna verdadeiro ao passar pela etapa `Entrevista feita` e é preservado mesmo depois que a candidatura avança.
- Ir diretamente para `Aprovado na entrevista RH` ou `Reprovado em entrevista RH` não marca automaticamente entrevista realizada.
- Não inferir entrevista feita apenas porque existe uma data de entrevista.
- Não confundir “etapa atual diferente de Entrevista feita” com “sem entrevista realizada registrada”.

#### Apresentação ao cliente — regra crítica

- A transição para `Material enviado ao cliente` registra apresentação.
- A data é registrada no fuso `America/Sao_Paulo`; o fluxo permite informar a data real do envio para regularizar registro antigo.
- Data futura é rejeitada.
- Não aceitar data de apresentação sem marcador de apresentação/transição correspondente.
- Reenvio em outro mês acrescenta data e preserva as anteriores.
- Ajuste da última data registrada gera observação automática com autor e data.
- Permanecer na etapa e adicionar observação não representa novo envio.
- Aprovação/reprovação do cliente fecha `clientPending`, mas não apaga o histórico de apresentação.

---

## 9. Pesquisa, filtros e paginação

### Funcionalidades

- Pesquisa por digitação e filtros por contexto.
- Campos de seleção pesquisável com até oito sugestões.
- Sugestões navegáveis por teclado; Enter seleciona e Escape fecha.
- Paginação de até 50 linhas por página.
- Painel de filtros avançados.
- Operadores: é, não é, contém, não contém, está vazio, não está vazio.
- Combinação de condições por “Todas as condições (E)” ou “Qualquer condição (OU)”.
- Busca ignora diferenças de acentuação.

### Sintaxe da busca textual

```text
Ana Souza
!entrevista feita
etapa:"Em tratativa"
!etapa:"Entrevista feita"
cidade:"São Paulo" E !entrevista feita
cidade:Maringá OU cidade:Campinas
```

Regras do parser:

- `E` e `OU` devem estar em maiúsculas.
- `E` tem precedência sobre `OU`.
- Parênteses não são suportados.
- Frases podem ser colocadas entre aspas.
- `!entrevista feita` significa **sem entrevista realizada registrada**, não apenas etapa atual diferente de “Entrevista feita”.
- Com vaga selecionada, a consulta considera a candidatura naquela vaga.
- Sem vaga selecionada, a busca geral considera o escopo de todas as participações; o painel permite explicitar se se busca ausência em todas ou pelo menos uma participação.
- Etapa e responsável precisam pertencer à mesma participação; não cruzar dados de vagas diferentes.
- Candidatos sem vínculo em filtros de processo precisam de inclusão explícita.
- Sintaxe inválida deve apresentar erro; nunca interpretar silenciosamente como consulta válida.
- Texto da pesquisa nunca deve ser executado como JavaScript ou SQL.

Campos por contexto:

| Contexto | Campos |
|---|---|
| Empresas | Texto, nome, setor, cidade |
| Vagas | Texto, vaga, empresa, status, responsável, prazo |
| Candidatos/candidaturas | Texto, nome, e-mail, cidade, vaga, empresa, etapa, responsável, entrevista, apresentação e retorno |

### Limite de escala

**Busca e paginação ocorrem no navegador.** O backend entrega o conjunto de dados JSON completo; a interface filtra e pagina esse conjunto localmente. O pacote 2.3 não implementa paginação/consulta de dados no servidor. O teste de pesquisa com 10 mil registros sintéticos é evidência de teste, não garantia de capacidade operacional ou de hospedagem.

Evolução sugerida para volumes maiores: migrar o modelo de dados para tabelas relacionais e implementar endpoints com filtros e paginação no servidor. Isso exige plano de migração, backup e validação de integridade; não fazer como uma alteração visual simples.

---

## 10. Exclusões e preservação de dados

| Ação | Efeito da versão atual |
|---|---|
| Excluir empresa | Só é permitido se não houver vagas associadas. |
| Excluir vaga | Remove vaga, vínculos, observações desses vínculos e histórico daquela vaga; preserva os cadastros dos candidatos. |
| Excluir candidato | Remove cadastro do candidato, participações e observações relacionadas; limpa a indicação de escolhido nas vagas. |
| Desvincular candidato da vaga | Remove somente aquela candidatura/participação e suas observações; preserva o cadastro do candidato. Limpa o escolhido da vaga quando necessário. |
| Excluir observação/histórico | Remove apenas o registro confirmado. A ação é explícita. |

- Salvamento comum não deve apagar registros que desapareceram acidentalmente do payload; o backend exige `deleteMode` para remoções explícitas.
- A interface atual usa confirmações nativas do navegador, não há lixeira nem desfazer.
- Excluir registros pode alterar totais históricos calculados dos dados que restam. Não prometer relatório histórico imutável sem implementar armazenamento específico.
- Ao excluir uma observação no formulário, a versão atual avisa que alterações ainda não salvas podem ser descartadas.

---

## 11. Design, identidade visual e acessibilidade

### Direção visual aprovada

- Identidade visual em cinza e verde.
- Fundo e superfícies cinzas, em vez de grandes áreas brancas arbitrárias.
- Todos os cartões de indicadores com o mesmo fundo verde e textos/números claros.
- Preservar cores semânticas de status (vermelho, azul, roxo e neutros) em badges e alertas.
- Tema normal/claro como padrão e tema noturno opcional.
- Preferência do tema guardada no navegador (`localStorage`, chave `ih-theme`).
- Preservar as cores originais da logo e das imagens; não aplicar inversão global de cores.
- Fonte Manrope no pacote atual.
- A versão 2.3 removeu a faixa superior redundante e aumentou o título de seção.

### Tokens CSS registrados como referência

| Token | Tema normal | Tema noturno |
|---|---|---|
| Fundo da página | `#E5E8E7` | `#171D1B` |
| Superfície | `#F0F2F1` | `#222B27` |
| Superfície alternativa | `#E8ECEA` | `#2B3530` |
| Campos | `#F6F7F6` | `#1C2521` |
| Texto principal | `#22332B` | `#E5EDE8` |
| Texto secundário | `#58645F` | `#B1BDB5` |
| Bordas | `#CBD2CF` | `#45534A` |
| Verde principal | `#1D6048` | `#236C50` |
| Verde escuro | `#174C3B` | `#183E30` |

Esses tokens não são certificação de contraste. Qualquer redesign deve verificar contrastes reais, inclusive badges, foco, textos pequenos e estados desabilitados.

### Acessibilidade

A meta solicitada para o redesign é **WCAG 2.2 nível AA**. Isso é uma meta do projeto de redesign, não uma certificação nem uma afirmação de conformidade do código 2.3 atual.

Critérios desejados:

- Contraste suficiente nos dois temas; informação não pode depender apenas de cor.
- Labels visíveis e permanentes nos campos.
- Foco de teclado visível e ordem de tabulação coerente.
- Botões apenas com ícone devem ter nome acessível.
- Campos e menus devem funcionar com teclado.
- Mensagens de erro e atualizações importantes devem ser acessíveis.
- Em celular, formulário em uma coluna e ações sem sair da tela.
- Tabelas com rolagem localizada ou alternativa responsiva sem perder a relação entre cabeçalhos/valores.
- Conferir desktop de 1440 px e celular de 390 px, além de largura intermediária e zoom.

---

## 12. Backlog e decisões de versão

O backlog documental lista ATS-001 a ATS-014. As decisões consolidadas da entrega 2.3 são:

| Item | Tema | Tratamento na 2.3 |
|---|---|---|
| ATS-001 | Contagem de profissionais mapeados | Revisado: o cartão passa a exibir contagem automática dos candidatos vinculados. O valor manual anterior permanece guardado no JSON em `mapped`, sem edição/exibição. |
| ATS-002 | Destacar prazo vencido | Prazo anterior a hoje recebe indicação de atraso em vaga ativa; hoje/futuro não é atraso. |
| ATS-003 | Padronizar status de vaga | Cores sutis e consistentes para os status, mantendo texto. |
| ATS-004 | Remover data do próximo contato | Campo removido da tela de candidatura; `Próxima ação` continua. Dados legados podem permanecer. |
| ATS-005 | Ampliar etapas de candidatura | Inclui aprovado/reprovado na entrevista RH e reprovado pelo cliente. |
| ATS-006 | Permitir vínculo sem etapa | Nova candidatura começa em branco, sem inferir contato ou avanço. |
| ATS-007 | Mostrar/ocultar senha | Botão para alternar visibilidade do campo de senha. |
| ATS-008 | Integração de documentos ao SharePoint | **Fora da 2.3 e pausada. Exige autorização específica de Brenndon antes de publicar/ativar.** |
| ATS-009 | Modo noturno | Opcional, com preferência lembrada no navegador. |
| ATS-010 | Aumentar título superior da seção | Título de seção maior e mais legível. |
| ATS-011 | Remover faixa superior redundante | Faixa removida e conteúdo reposicionado. |
| ATS-012 | Melhorar pesquisa e filtros | Sugestões limitadas, filtros avançados, condições E/OU, negação, escopo de entrevista e paginação 50. |
| ATS-013 | Reformular indicadores | Quatro indicadores operacionais: andamento, atraso, apresentações do mês e retorno do cliente. |
| ATS-014 | Harmonizar cinza e verde | Tema claro cinza/verde e cartões de indicadores uniformemente verdes. |

### Restrição de SharePoint — obrigatória

A integração SharePoint não está implementada na 2.3 e não pode ser adicionada a um pacote para produção sem autorização explícita e específica de Brenndon. Aprovação genérica para outras melhorias ou para uma nova versão não autoriza essa integração.

Escopo futuro discutido:

- currículo associado ao cadastro do candidato;
- material enviado ao cliente associado à candidatura naquela vaga;
- upload/abertura/download pela interface;
- arquivos armazenados em biblioteca privada do SharePoint;
- banco do ATS guarda metadados/identificadores, não cópia permanente dos arquivos;
- integração planejada via Microsoft Graph, com credenciais mantidas no servidor.

Antes da implementação, definir permissões, biblioteca, formatos, tamanho máximo, versionamento, substituição, retenção/exclusão e tratamento de falhas. Pedir autorização de Brenndon antes de subir/ativar em produção.

---

## 13. Limites técnicos confirmados

| Limite | Valor / comportamento |
|---|---|
| Corpo de requisição JSON | Máximo 2 MiB por requisição |
| Registros por coleção principal | Até 10.000 em cada coleção (`companies`, `jobs`, `candidates`, `applications`) |
| Observações por candidatura | Até 2.000 |
| Tamanho do texto da observação | Até 5.000 caracteres |
| Datas de apresentação por candidatura | Até 500 |
| Link do currículo | Até 2.000 caracteres |
| Título de vaga | Até 200 caracteres |
| Nome de empresa/candidato | Até 150 caracteres |
| Nome do setor/cidade/origem | Até 150 caracteres |
| Senha | 12 a 128 caracteres |
| Sessão | 8 horas |
| Tentativas de login | 5 tentativas incorretas; bloqueio de 15 minutos |
| Pool de conexões MySQL | `connectionLimit: 4` |
| Paginação frontend | 50 registros por página |

A quantidade de 10 mil itens é um limite de validação no servidor, não promessa de desempenho/capacidade. O payload global e o limite de 2 MiB podem virar gargalos conforme a base cresce.

---

## 14. O que NÃO existe na versão 2.3 — não prometer nem desenhar como existente

- Portal de cliente externo com login próprio.
- Cadastro/requisição de vaga feito pelo cliente.
- Upload de currículo PDF/DOCX.
- Upload e gestão de materiais enviados ao cliente.
- Integração com SharePoint / Microsoft Graph.
- Integração com Google Calendar ou Outlook.
- Envio automático de e-mails ou notificações.
- Geração de materiais Word/PDF por IA.
- Avaliação ou aprovação automática de candidatos por IA.
- Busca/paginação de registros no servidor; a pesquisa atual ocorre após carregamento do estado JSON no browser.
- Sincronização em tempo real entre usuários.
- Trabalho offline.
- Salvamento automático de rascunho.
- Recuperação de senha por e-mail.
- MFA/2FA.
- Lixeira ou desfazer exclusões.
- Matriz granular de permissões por papel/ação.
- Trilha de auditoria imutável e detalhada por campo.
- Capacidade ilimitada de dados.

Alguns itens aparecem em documentos antigos de requisitos do MVP, mas não fazem parte do código 2.3 analisado.

---

## 15. Testes e validação da versão 2.3

A nota de atualização registra 36 testes automatizados aprovados e conferência visual/funcional no Chromium com dados fictícios em desktop de 1440 px e celular de 390 px.

**Também executei `npm test` diretamente na cópia do pacote 2.3 analisado nesta revisão. Resultado:**

```text
# tests 36
# pass 36
# fail 0
# cancelled 0
# skipped 0
```

Os testes cobrem, entre outros pontos:

- hash de senha e verificação;
- setup inicial, login, proteção de rotas, origem e logout;
- bloqueio após tentativas de login;
- exportação e não exposição de arquivos privados;
- concorrência e conflito por revisão;
- preservação de histórico e autores definidos pelo servidor;
- vínculo de candidato em mais de uma vaga;
- regras de exclusão e desvinculação;
- pesquisa sem acentos e filtros E/OU;
- escopo da busca de entrevista realizada;
- etapas novas e candidatura sem etapa;
- datas de apresentação, reenvio e retorno do cliente;
- indicadores e limite sintético de pesquisa com 10 mil registros.

**Limitação do teste:** a suíte foi executada localmente contra os arquivos do ZIP. Isso não significa que a aplicação foi testada contra o servidor, o MySQL ou a configuração real de produção.

---

## 16. Pontos técnicos que merecem cuidado em evoluções futuras

1. **Persistência em JSON único:** funcional para o escopo atual, mas cada salvamento regrava o estado inteiro. Aumenta o risco de atingir limite de payload e dificulta consulta/paginação no servidor.
2. **Conflito global de revisão:** qualquer gravação altera a revisão do estado inteiro. Dois usuários editando registros distintos podem conflitar. A UI pode descartar o rascunho ao recarregar a versão mais recente.
3. **Permissões amplas:** `admin` controla criação de usuários; as ações de dados não possuem autorização granular por perfil.
4. **Auditoria resumida:** `ats_audit` guarda usuário/revisão/tempo, não diffs de cada alteração. Histórico de negócio pode ser excluído explicitamente.
5. **Recuperação de senha:** não há fluxo de recuperação por e-mail.
6. **Dados pessoais:** o sistema armazena dados de candidatos. Usar exclusivamente dados fictícios em testes e protótipos; nunca copiar currículos, senhas ou dados reais para prompts sem necessidade e autorização.
7. **Migração:** migrar de JSON para tabelas relacionais exige exportação, backup SQL, scripts de conversão, validação de contagens e relacionamentos e plano de rollback.
8. **Compatibilidade de versão:** não permitir edição da mesma base por abas antigas/código de versão anterior após atualização. A versão anterior pode não compreender campos novos.
9. **SharePoint:** não implementar/publicar sem autorização específica do responsável do projeto.
10. **Produção:** não alterar banco, variáveis, `.htaccess` ou arquivos hospedados sem backup e autorização apropriada.

### Evoluções arquiteturais possíveis (não implementadas)

- Normalizar `companies`, `jobs`, `candidates`, `applications`, `application_notes` e `job_history` em tabelas relacionais.
- Criar endpoints REST com paginação, filtros e ordenação no servidor.
- Usar controle de versão por registro ou resolução de conflitos mais granular.
- Preservar rascunho do formulário em erro/conflito.
- Criar matriz formal de permissões, com autorização aplicada no backend.
- Fortalecer auditoria com eventos/diffs imutáveis, caso seja requisito.
- Definir retenção, anonimização e exclusão de dados pessoais.
- Implementar backup agendado e monitoramento, se o ambiente permitir.

Essas são possibilidades para discussão; não aplicar automaticamente nem tratar como decisões já aprovadas.

---

## 17. Instruções para a próxima IA / pessoa desenvolvedora

Use este documento como contexto e o ZIP de código-fonte 2.3 como fonte técnica. Antes de escrever ou alterar código:

1. Inspecione a estrutura e leia `ATUALIZACAO-2.3.txt`, `server.js`, `database.js`, `public/app.js`, `public/auth.js`, `public/query.js` e os testes.
2. Confirme com Brenndon qual versão está efetivamente publicada na tela Configurações e no painel. Não assumir que 2.3 está em produção.
3. Identifique se a tarefa é correção funcional, melhoria visual, alteração de banco ou infraestrutura.
4. Preserve o modelo `candidate` separado de `application`; uma pessoa pode estar em várias vagas.
5. Não altere regras de entrevista, apresentação, pendência, indicadores ou exclusões sem explicar impacto e manter compatibilidade com dados legados.
6. Não mude o esquema de banco nem rode migração em produção sem backup SQL e autorização explícita.
7. Não adicione SharePoint à publicação sem autorização específica de Brenndon.
8. Não coloque senhas, `SETUP_TOKEN`, dados reais de candidatos ou credenciais no código, prompts, logs ou documentos.
9. Use dados fictícios para desenvolvimento/teste.
10. Rode `npm test` após alterações e preserve/adicione testes para as regras afetadas.
11. Se alterar frontend, validar desktop e celular, teclado, contraste e estados de erro/sucesso; WCAG 2.2 AA é a meta do redesign.
12. Não declarar que uma atualização foi instalada ou validada em produção sem evidência do painel e do banco reais.

### Prompt inicial sugerido para a próxima IA

> Você está assumindo a continuidade do Infra Humana ATS. Leia integralmente este documento de contexto e inspecione o ZIP do código-fonte anexado antes de propor alterações. A versão de referência do código é 2.3.0, mas a publicação em produção precisa ser confirmada. A stack atual é HTML/CSS/JavaScript puro no frontend, Node.js com HTTP nativo no backend e MySQL via mysql2. Os dados de negócio ficam em um JSON único na tabela `ats_state`; usuários e sessões ficam em tabelas separadas. Preserve regras de negócio, IDs, histórico e compatibilidade dos dados. Não presuma funcionalidades ausentes, não faça alterações em produção sem backup/autorização e não publique integração SharePoint sem aprovação específica de Brenndon. Primeiro explique o entendimento da arquitetura e o impacto da tarefa; só então implemente o escopo solicitado. Execute `npm test` e documente os resultados.

---

## 18. Arquivos de referência usados para montar este contexto

1. `infra-humana-ats-atualizacao-2.3.zip` — código-fonte completo analisado (17 arquivos).
2. `ATUALIZACAO-2.3.txt` — instruções de atualização, regras da versão e validação.
3. `Backlog-Infra-Humana-ATS.md` — backlog ATS-001 a ATS-014, versão documental 13, atualizado em 09/11/2026.
4. `Infra-Humana-ATS-Referencia-UI-UX-Figma.md` — documentação funcional e de interface criada em 16/11/2026.
5. `infra-humana-ats-backup.json` — export de teste antigo, com dados fictícios; não representa o banco atual de produção e não deve ser usado como base de dados real.

### Status conhecido na data deste documento

- Pacote 2.3.0 existe e foi analisado localmente.
- `npm test`: 36 aprovados, 0 falhas na cópia local.
- Instruções do pacote 2.3 dizem que a hospedagem e o MySQL de produção não foram acessados/alterados na preparação.
- A instalação de 2.3 em produção não está confirmada. Verificar a versão exibida em Configurações antes de prosseguir.
- Nenhuma credencial, senha ou dado real de candidato foi incluído neste documento.
