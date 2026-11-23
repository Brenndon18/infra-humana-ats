'use strict';
// Envio do e-mail de agradecimento pelo Microsoft 365 (Microsoft Graph).
// Credenciais vêm SOMENTE das variáveis de ambiente do painel de hospedagem. Nunca escreva segredos aqui.
//
// Modos:
//  - desligado: produção sem EMAIL_AGRADECIMENTO=ativo ou com configuração incompleta. O pop-up não aparece.
//  - ativo:     produção configurada. O e-mail vai para o endereço cadastrado do candidato.
//  - teste:     homologação configurada. O e-mail vai SEMPRE para EMAIL_TESTE, nunca para o candidato.
//  - simulado:  homologação sem Microsoft ou sem EMAIL_TESTE. Nada é enviado; só registra no histórico.

const SUBJECT='Agradecemos sua participação no processo seletivo';
const validEmail=v=>typeof v==='string'&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const oneLine=v=>String(v||'').replace(/[\r\n\t]+/g,' ').trim().slice(0,200);

// Modelo único da mensagem (não depende do motivo de reprovação).
function thanksMessage({name,jobTitle}){
 const first=oneLine(name).split(' ')[0]||'tudo bem';
 const job=oneLine(jobTitle);
 return `Olá, ${first},

Agradecemos o seu interesse e o tempo dedicado ao processo seletivo${job?` para a vaga de ${job}`:''}.

Após a análise, informamos que, neste momento, seguiremos com outros perfis mais alinhados aos requisitos da posição.

Seu currículo continuará em nosso banco de talentos, e poderemos entrar em contato em futuras oportunidades compatíveis com a sua experiência.

Desejamos muito sucesso na sua trajetória profissional.

Atenciosamente,
Equipe de Recrutamento
Infra Humana — RH para Engenharia e Tecnologia`;
}

function createMailer(env=process.env,{environment='producao',fetchImpl=globalThis.fetch,log=console}={}){
 const homolog=environment==='homologacao';
 const graph={tenant:env.MS_TENANT_ID,client:env.MS_CLIENT_ID,secret:env.MS_CLIENT_SECRET,sender:(env.EMAIL_REMETENTE||'').toLowerCase()};
 const graphReady=!!(graph.tenant&&graph.client&&graph.secret&&validEmail(graph.sender))&&/^[A-Za-z0-9.-]{1,100}$/.test(graph.tenant);
 const testAddress=(env.EMAIL_TESTE||'').toLowerCase();
 let mode;
 if(homolog)mode=graphReady&&validEmail(testAddress)?'teste':'simulado';
 else if(env.EMAIL_AGRADECIMENTO==='ativo'){mode=graphReady?'ativo':'desligado';if(!graphReady)log.error('ats_email_config_incompleta')}
 else mode='desligado';

 let cached=null;
 async function token(){
  if(cached&&cached.expires>Date.now()+60000)return cached.value;
  const r=await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(graph.tenant)}/oauth2/v2.0/token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:graph.client,client_secret:graph.secret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}),signal:AbortSignal.timeout(15000)});
  if(!r.ok){log.error('ats_email_token_falhou',r.status);throw Object.assign(new Error('A Microsoft recusou o acesso do ATS. Confira o cadastro do aplicativo e o segredo.'),{status:502})}
  const d=await r.json();cached={value:d.access_token,expires:Date.now()+(Number(d.expires_in)||3000)*1000};return cached.value;
 }

 // Monta a mensagem final. Trava da homologação: o destinatário real nunca é usado.
 function compose({name,email,jobTitle}){
  if(!validEmail(email))throw Object.assign(new Error('Candidato sem e-mail válido cadastrado.'),{status:400});
  let body=thanksMessage({name,jobTitle}),subject=SUBJECT,to=email;
  if(homolog){to=mode==='teste'?testAddress:null;subject='[HOMOLOGAÇÃO] '+subject;body=`[Teste da homologação. Em produção, iria para: ${email}]\n\n`+body}
  return {to,subject,body};
 }

 async function sendThanks({name,email,jobTitle}){
  if(mode==='desligado')throw Object.assign(new Error('O envio de e-mail não está configurado.'),{status:503});
  const {to,subject,body}=compose({name,email,jobTitle});
  if(mode==='simulado')return {mode,to:null};
  const r=await fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graph.sender)}/sendMail`,{method:'POST',headers:{'Authorization':'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify({message:{subject,body:{contentType:'Text',content:body},toRecipients:[{emailAddress:{address:to}}]},saveToSentItems:true}),signal:AbortSignal.timeout(20000)});
  if(r.status===401)cached=null;
  if(r.status!==202){log.error('ats_email_envio_falhou',r.status);throw Object.assign(new Error('A Microsoft não aceitou o envio do e-mail. Tente de novo em alguns minutos.'),{status:502})}
  return {mode,to};
 }
 return {mode,compose,sendThanks};
}

module.exports={createMailer,thanksMessage,SUBJECT};
