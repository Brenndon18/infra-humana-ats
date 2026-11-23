'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),{spawnSync}=require('node:child_process');
const {createServer,sanitize,empty}=require('../server');
const {gerarDadosFicticios}=require('../scripts/dados-ficticios');
const admin={id:1,name:'Admin Homologação',email:'admin@example.com',role:'admin',active:1};
const root=path.resolve(__dirname,'..');

test('homologação: dados fictícios passam pelas mesmas validações do sistema',()=>{
 const out=sanitize(gerarDadosFicticios(admin.name),empty(),[admin],admin);
 assert.ok(out.companies.length>=3&&out.jobs.length>=5&&out.candidates.length>=10&&out.applications.length>=10);
 assert.ok(out.candidates.every(c=>c.email.endsWith('@example.com')),'e-mails devem ser de domínio reservado para exemplos');
 assert.ok(out.applications.some(a=>a.status==='')&&out.applications.some(a=>a.clientPending));
});

test('homologação: /api/status informa o ambiente para mostrar o aviso na tela',async t=>{
 const repo={users:async()=>[]};
 for(const [environment,expected] of [['homologacao','homologacao'],[undefined,'producao'],['qualquer','producao']]){
  const server=createServer(repo,{origin:'http://localhost',localTest:true,environment});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/status');server.close();
  assert.equal((await r.json()).environment,expected);
 }
});

function iniciar(env){
 const script=`const db=require.resolve('./database');require.cache[db]={id:db,filename:db,loaded:true,exports:{connect:async()=>({})}};
 require('node:http').createServer=()=>({listen(){console.log('SERVER_STARTED');return this}});require('./app');`;
 return spawnSync(process.execPath,['-e',script],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,DB_PASSWORD:'teste',...env}});
}
test('homologação: trava impede usar banco ou endereço de produção',()=>{
 assert.match(iniciar({ATS_AMBIENTE:'homologacao',DB_NAME:'infraest_homolog_ats',APP_ORIGIN:'https://homolog.example.com'}).stdout,/SERVER_STARTED/);
 assert.doesNotMatch(iniciar({ATS_AMBIENTE:'homologacao',DB_NAME:'infraest_ats',APP_ORIGIN:'https://homolog.example.com'}).stdout,/SERVER_STARTED/);
 assert.doesNotMatch(iniciar({ATS_AMBIENTE:'homologacao',DB_NAME:'infraest_homolog_ats',APP_ORIGIN:'https://ats.infrahumana.com.br'}).stdout,/SERVER_STARTED/);
 assert.match(iniciar({DB_NAME:'infraest_ats',APP_ORIGIN:'https://ats.infrahumana.com.br'}).stdout,/SERVER_STARTED/,'produção continua iniciando normalmente');
});

test('homologação: script de dados fictícios recusa rodar fora da homologação',()=>{
 for(const env of [{},{ATS_AMBIENTE:'homologacao',DB_NAME:'infraest_ats'}]){
  const r=spawnSync(process.execPath,['scripts/dados-ficticios.js'],{cwd:root,encoding:'utf8',env:{PATH:process.env.PATH,...env}});
  assert.equal(r.status,1);assert.match(r.stderr,/homologação|produção/);
 }
});
