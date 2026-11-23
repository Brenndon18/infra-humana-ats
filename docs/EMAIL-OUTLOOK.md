# E-mail de agradecimento pelo Outlook (Microsoft 365) — versão 2.5

## O que a função faz

1. Ao mudar a etapa de uma candidatura para **Reprovado em entrevista RH** ou **Reprovado pelo cliente** e salvar, aparece o pop-up **"Enviar e-mail de agradecimento?"** com a prévia da mensagem.
2. **Enviar e-mail** manda a mensagem padrão (única, não usa o motivo da reprovação) para o e-mail do cadastro do candidato.
3. O envio fica registrado no histórico da candidatura (quem, quando e para qual e-mail). O sistema não deixa enviar duas vezes para a mesma candidatura.
4. Se a pessoa clicar em **Agora não**, dá para enviar depois pelo botão **Enviar e-mail de agradecimento** dentro da candidatura.

O pop-up só aparece quando o envio está configurado e o candidato tem e-mail cadastrado. A mensagem fica em `mailer.js` (função `thanksMessage`).

## Como funciona o envio

O ATS usa o **Microsoft Graph**, a forma oficial da Microsoft para um sistema enviar e-mail sozinho. O ATS recebe uma "chave" própria (aplicativo registrado no Microsoft Entra), que só tem permissão de enviar e-mail por **uma caixa** (ex.: `rh@infrahumana.com.br`). Nenhuma senha de pessoa fica no sistema. **Não** é pedida nenhuma permissão de SharePoint, OneDrive, calendário ou leitura de e-mails.

## Variáveis de ambiente (painel da hospedagem, nunca no código)

| Variável | Exemplo | Para que serve |
|---|---|---|
| `EMAIL_AGRADECIMENTO` | `ativo` | Liga a função na produção. Sem ela, nada muda. |
| `MS_TENANT_ID` | `xxxxxxxx-xxxx-...` | "ID do diretório (locatário)" da empresa na Microsoft |
| `MS_CLIENT_ID` | `xxxxxxxx-xxxx-...` | "ID do aplicativo (cliente)" do ATS |
| `MS_CLIENT_SECRET` | (segredo) | Valor do segredo criado no aplicativo. **Tratar como senha.** |
| `EMAIL_REMETENTE` | `rh@infrahumana.com.br` | Caixa de onde o e-mail sai |
| `EMAIL_TESTE` | `seu.email@infrahumana.com.br` | **Só na homologação**: todo e-mail de teste vai para cá |

Homologação: sem `EMAIL_TESTE` (ou sem as variáveis da Microsoft) o envio é **simulado**: nada sai, só registra no histórico. Com elas, vai **somente** para `EMAIL_TESTE`, com "[HOMOLOGAÇÃO]" no assunto.

## Passo a passo do lado da Microsoft (feito por um administrador do Microsoft 365)

Tempo estimado: 20 minutos, uma única vez.

1. **Caixa de envio.** O e-mail sai de `rh@infrahumana.com.br` (caixa que já existe). As respostas dos candidatos chegam nela normalmente, e a cópia do envio fica em "Itens enviados".
2. **Registrar o aplicativo.** Em entra.microsoft.com > *Aplicativos > Registros de aplicativo > Novo registro*. Nome: `ATS Infra Humana`. Tipo de conta: "Somente contas deste diretório". Sem URL de redirecionamento. Registrar.
3. **Anotar os IDs.** Na tela do aplicativo, copie o *ID do aplicativo (cliente)* → `MS_CLIENT_ID` e o *ID do diretório (locatário)* → `MS_TENANT_ID`.
4. **Criar o segredo.** *Certificados e segredos > Novo segredo do cliente*, validade de 24 meses. Copie o **Valor** na hora (ele some depois) → `MS_CLIENT_SECRET`. Anote na agenda a data de vencimento: antes dela é preciso criar outro segredo e trocar a variável.
5. **Dar permissão só para a caixa de recrutamento** (recomendado, pelo Exchange Online PowerShell). Em *Aplicativos empresariais*, abra `ATS Infra Humana` e copie a *ID do Objeto*. Depois:
   ```powershell
   Connect-ExchangeOnline
   New-ServicePrincipal -AppId <MS_CLIENT_ID> -ObjectId <ID do Objeto> -DisplayName "ATS Infra Humana"
   New-ManagementScope -Name "ATS - somente RH" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'rh@infrahumana.com.br'"
   New-ManagementRoleAssignment -App <MS_CLIENT_ID> -Role "Application Mail.Send" -CustomResourceScope "ATS - somente RH"
   Test-ServicePrincipalAuthorization -Identity <MS_CLIENT_ID> -Resource rh@infrahumana.com.br
   ```
   Assim o ATS consegue enviar **apenas** por essa caixa. **Não** adicione a permissão `Mail.Send` em "Permissões de API" do Entra: lá ela valeria para todas as caixas da empresa.
6. **Configurar a homologação primeiro**: preencha as variáveis no app da homologação, incluindo `EMAIL_TESTE`, reinicie e teste. Só depois, com autorização, coloque as variáveis na produção com `EMAIL_AGRADECIMENTO=ativo`.

## Problemas comuns

- "A Microsoft recusou o acesso do ATS": IDs ou segredo errados, ou segredo vencido.
- "A Microsoft não aceitou o envio": a permissão do passo 5 não foi dada para a caixa de `EMAIL_REMETENTE` (pode levar até 1 hora para valer depois de criada).
- O log da aplicação mostra só códigos (`ats_email_token_falhou 401`, `ats_email_envio_falhou 403`), nunca o segredo.
