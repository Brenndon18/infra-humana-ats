'use strict';
// E-mail de agradecimento ao candidato reprovado (versão 2.5). Nenhum teste fala com a Microsoft de verdade.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createServer,sanitize,empty}=require('../server');
const {createMailer,thanksMessage}=require('../mailer');

const admin={id:1,name:'Admin Teste',email:'admin@example.com',role:'admin',active:1};
const graph={MS_TENANT_ID:'contoso.onmicrosoft.com',MS_CLIENT_ID:'00000000-0000-0000-0000-000000000000',MS_CLIENT_SECRET:'segredo-de-teste',EMAIL_REMETENTE:'recrutamento@example.com'};
const quiet={error(){}};

function fakeFetch(){
 const calls=[];
 const fn=async(url,opts)=>{calls.push({url,opts});
  if(url.includes('login.microsoftonline.com'))return {ok:true,status:200,json:async()=>({access_token:'tok',expires_in:3600})};
  return {ok:true,status:202,json:async()=>({})}};
 fn.calls=calls;return fn;
}
const mail=f=>f.calls.filter(c=>c.url.includes('graph.microsoft.com')).map(c=>JSON.parse(c.opts.body));

test('e-mail: modos conforme ambiente e variáveis',()=>{
 const m=(env,environment)=>createMailer(env,{environment,log:quiet}).mode;
 assert.equal(m({},'producao'),'desligado','produção começa desligada');
 assert.equal(m(graph,'producao'),'desligado','só liga com EMAIL_AGRADECIMENTO=ativo');
 assert.equal(m({...graph,EMAIL_AGRADECIMENTO:'ativo'},'producao'),'ativo');
 assert.equal(m({EMAIL_AGRADECIMENTO:'ativo',EMAIL_REMETENTE:'x@example.com'},'producao'),'desligado','configuração incompleta não liga');
 assert.equal(m({},'homologacao'),'simulado');
 assert.equal(m(graph,'homologacao'),'simulado','homologação sem EMAIL_TESTE não envia');
 assert.equal(m({...graph,EMAIL_TESTE:'teste@example.com'},'homologacao'),'teste');
});

test('e-mail: produção envia ao candidato pelo Microsoft Graph, em texto simples',async()=>{
 const f=fakeFetch(),m=createMailer({...graph,EMAIL_AGRADECIMENTO:'ativo'},{environment:'producao',fetchImpl:f,log:quiet});
 const r=await m.sendThanks({name:'Ana Souza',email:'ana@example.com',jobTitle:'Engenheira Civil'});
 assert.deepEqual(r,{mode:'ativo',to:'ana@example.com'});
 const token=f.calls[0];assert.match(token.url,/contoso\.onmicrosoft\.com\/oauth2\/v2\.0\/token$/);
 assert.equal(token.opts.body.get('grant_type'),'client_credentials');assert.equal(token.opts.body.get('scope'),'https://graph.microsoft.com/.default');
 assert.match(f.calls[1].url,/\/v1\.0\/users\/recrutamento%40example\.com\/sendMail$/);
 const [msg]=mail(f);
 assert.deepEqual(msg.message.toRecipients,[{emailAddress:{address:'ana@example.com'}}]);
 assert.equal(msg.message.body.contentType,'Text');assert.match(msg.message.body.content,/Olá, Ana,/);assert.match(msg.message.body.content,/vaga de Engenheira Civil/);
 assert.equal(msg.saveToSentItems,true);
 await m.sendThanks({name:'Bia',email:'bia@example.com',jobTitle:'X'});
 assert.equal(f.calls.filter(c=>c.url.includes('login')).length,1,'reaproveita o token');
});

test('e-mail: homologação NUNCA envia ao candidato real',async()=>{
 const f=fakeFetch(),m=createMailer({...graph,EMAIL_AGRADECIMENTO:'ativo',EMAIL_TESTE:'teste@example.com'},{environment:'homologacao',fetchImpl:f,log:quiet});
 const r=await m.sendThanks({name:'Carlos',email:'candidato.real@empresa.com.br',jobTitle:'Eletricista'});
 assert.equal(r.to,'teste@example.com');
 const [msg]=mail(f);
 assert.deepEqual(msg.message.toRecipients,[{emailAddress:{address:'teste@example.com'}}]);
 assert.match(msg.message.subject,/^\[HOMOLOGAÇÃO\]/);
 assert.ok(!JSON.stringify(msg.message.toRecipients).includes('empresa.com.br'));
 const sim=fakeFetch(),s=createMailer({},{environment:'homologacao',fetchImpl:sim,log:quiet});
 assert.deepEqual(await s.sendThanks({name:'Carlos',email:'candidato.real@empresa.com.br',jobTitle:'X'}),{mode:'simulado',to:null});
 assert.equal(sim.calls.length,0,'modo simulado não chama a internet');
});

test('e-mail: falhas da Microsoft viram mensagem clara, sem vazar segredo',async()=>{
 const logs=[],log={error:(...a)=>logs.push(a.join(' '))};
 const m=createMailer({...graph,EMAIL_AGRADECIMENTO:'ativo'},{environment:'producao',log,fetchImpl:async()=>({ok:false,status:401,json:async()=>({})})});
 await assert.rejects(m.sendThanks({name:'A',email:'a@example.com'}),e=>e.status===502&&/Microsoft/.test(e.message));
 assert.ok(!logs.join().includes(graph.MS_CLIENT_SECRET));
});

test('e-mail: mensagem é única e não muda com o motivo de reprovação',()=>{
 const t=thanksMessage({name:'Ana\nBcc: x',jobTitle:'Vaga\r\nX'});
 assert.doesNotMatch(t,/Bcc: x\n/);assert.doesNotMatch(t,/reprova/i);
});

test('e-mail: registro "thanks" é do servidor e sobrevive a salvamentos comuns',()=>{
 const base={companies:[{id:1,name:'Empresa'}],jobs:[{id:2,company:1,title:'Vaga',owner:admin.name,status:'Aberta',mapped:0}],candidates:[{id:3,name:'Ana',email:'ana@example.com'}],applications:[{id:4,job:2,candidate:3,status:'Reprovado pelo cliente',rejectReason:'Perfil técnico',owner:admin.name,notes:[]}]};
 const forged=sanitize({...base,applications:[{...base.applications[0],thanks:{at:'forjado'}}]},empty(),[admin],admin);
 assert.equal(forged.applications[0].thanks,null,'tela não consegue forjar o envio');
 const previous=structuredClone(forged);previous.applications[0].thanks={at:'01/12/2026',by:admin.name,to:'ana@example.com',mode:'ativo'};
 const again=sanitize({...base,applications:[{...base.applications[0],thanks:undefined}]},previous,[admin],admin);
 assert.equal(again.applications[0].thanks.at,'01/12/2026');
});

function repoWith(status){
 let state={revision:5,data:{...empty(),companies:[{id:1,name:'Empresa'}],jobs:[{id:2,company:1,title:'Analista',owner:admin.name,status:'Aberta',mapped:0}],candidates:[{id:3,name:'Ana Lima',email:'ana@example.com'},{id:6,name:'Sem Email',email:''}],applications:[{id:4,job:2,candidate:3,status,owner:admin.name,notes:[]},{id:7,job:2,candidate:6,status:'Reprovado em entrevista RH',owner:admin.name,notes:[]}]}};
 return {users:async()=>[admin],authenticate:async()=>admin,getState:async()=>state,mutateState:async fn=>{state={revision:state.revision+1,data:fn(structuredClone(state.data))};return state},get state(){return state}};
}
async function call(server,method,route,body){
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+server.address().port+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost',Cookie:'ih_session=abc'},body:body&&JSON.stringify(body)});return {status:r.status,data:await r.json()}}
 finally{server.close()}
}

test('e-mail: rota envia, registra no histórico e bloqueia repetição',async()=>{
 const repo=repoWith('Reprovado pelo cliente'),sent=[];
 const mailer={mode:'ativo',compose:x=>({to:x.email,subject:'S',body:'B'}),sendThanks:async x=>{sent.push(x);return {mode:'ativo',to:x.email}}};
 const mk=()=>createServer(repo,{origin:'http://localhost',localTest:true,mailer});
 const status=await call(mk(),'GET','/api/status');assert.equal(status.data.email,'ativo');
 const preview=await call(mk(),'GET','/api/thanks-email?application=4');assert.equal(preview.status,200);assert.equal(preview.data.to,'ana@example.com');
 const r=await call(mk(),'POST','/api/thanks-email',{application:4});
 assert.equal(r.status,200);assert.equal(r.data.revision,6);assert.equal(sent.length,1);
 const a=r.data.data.applications.find(x=>x.id===4);
 assert.equal(a.thanks.by,admin.name);assert.equal(a.thanks.to,'ana@example.com');
 assert.match(a.notes[0].text,/E-mail de agradecimento enviado para ana@example\.com/);
 const again=await call(mk(),'POST','/api/thanks-email',{application:4});
 assert.equal(again.status,409);assert.equal(sent.length,1,'não envia duas vezes');
 assert.equal((await call(mk(),'POST','/api/thanks-email',{application:7})).status,400,'sem e-mail cadastrado');
});

test('e-mail: rota recusa candidato não reprovado e sistema desligado',async()=>{
 const mailer={mode:'ativo',sendThanks:async()=>assert.fail('não deveria enviar')};
 assert.equal((await call(createServer(repoWith('Em tratativa'),{origin:'http://localhost',localTest:true,mailer}),'POST','/api/thanks-email',{application:4})).status,400);
 const off=createServer(repoWith('Reprovado pelo cliente'),{origin:'http://localhost',localTest:true});
 assert.equal((await call(off,'POST','/api/thanks-email',{application:4})).status,503);
});

test('e-mail: homologação registra no histórico que não foi ao candidato',async()=>{
 const repo=repoWith('Reprovado em entrevista RH');
 const mailer=createMailer({},{environment:'homologacao',log:quiet,fetchImpl:()=>assert.fail('sem internet')});
 const r=await call(createServer(repo,{origin:'http://localhost',localTest:true,environment:'homologacao',mailer}),'POST','/api/thanks-email',{application:4});
 assert.equal(r.status,200);const a=r.data.data.applications.find(x=>x.id===4);
 assert.equal(a.thanks.mode,'simulado');assert.match(a.notes[0].text,/simulado/);
});

test('e-mail: tela mostra o pop-up só para reprovação nova e com envio configurado',()=>{
 const js=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','public','app.js'),'utf8');
 assert.match(js,/if\(previous!==d\.status&&canThank\(a\)\)return \(\)=>offerThanks\(a\.id\)/);
 assert.match(js,/window\.atsEmail!=='desligado'/);
 assert.match(js,/Enviar e-mail de agradecimento\?/);
});
