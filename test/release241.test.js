'use strict';
// Versão 2.4.1: motivo da reprovação, aviso "Alteração Salva com Sucesso" e origem em lista fixa.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {sanitize,empty}=require('../server');
const ler=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');
const users=[{name:'Teste',active:true}],actor={name:'Teste'};
function fixture(){return {companies:[{id:1,name:'Cliente',sector:'',city:''}],jobs:[{id:2,company:1,title:'Vaga',owner:'Teste',status:'Aberta',mapped:0,deadline:''}],candidates:[{id:3,name:'Pessoa Fictícia'}],applications:[{id:4,job:2,candidate:3,owner:'Teste',status:'',notes:[]}],history:[]}}

test('reprovação: exige motivo ao mudar a etapa para reprovado e guarda o texto livre',()=>{
 const old=sanitize(fixture(),empty(),users,actor);
 for(const status of ['Reprovado em entrevista RH','Reprovado pelo cliente']){
  const sem=fixture();sem.applications[0].status=status;
  assert.throws(()=>sanitize(sem,old,users,actor),/motivo da reprovação/);
  const com=fixture();com.applications[0].status=status;com.applications[0].rejectReason='  Perfil técnico abaixo do esperado (fictício)  ';
  assert.equal(sanitize(com,old,users,actor).applications[0].rejectReason,'Perfil técnico abaixo do esperado (fictício)');
 }
});

test('reprovação: registros antigos já reprovados sem motivo continuam salvando',()=>{
 const d=fixture();d.applications[0].status='Reprovado pelo cliente';d.applications[0].rejectReason='x';
 const old=sanitize(d,empty(),users,actor);old.applications[0].rejectReason='';
 const again=fixture();again.applications[0].status='Reprovado pelo cliente';
 assert.equal(sanitize(again,old,users,actor).applications[0].rejectReason,'');
});

test('reprovação: motivo muito longo é recusado',()=>{
 const d=fixture();d.applications[0].status='Reprovado pelo cliente';d.applications[0].rejectReason='a'.repeat(2001);
 assert.throws(()=>sanitize(d,empty(),users,actor));
});

test('origem: aceita só a lista fixa em cadastros novos ou alterados',()=>{
 for(const origin of ['LinkedIn','Catho','Indicação','Banco de Currículos','E-mail','']){
  const d=fixture();d.candidates[0].origin=origin;assert.equal(sanitize(d,empty(),users,actor).candidates[0].origin,origin);
 }
 const d=fixture();d.candidates[0].origin='Facebook';
 assert.throws(()=>sanitize(d,empty(),users,actor),/origem do candidato/);
});

test('origem: valor antigo em texto livre é mantido enquanto não for alterado',()=>{
 const old=empty();old.candidates=[{id:3,name:'Pessoa Fictícia',origin:'Site antigo'}];
 const d=fixture();d.candidates[0].origin='Site antigo';
 assert.equal(sanitize(d,old,users,actor).candidates[0].origin,'Site antigo');
 const outro=fixture();outro.candidates[0].origin='Outro texto';
 assert.throws(()=>sanitize(outro,old,users,actor),/origem do candidato/);
});

test('aviso: mensagem "Alteração Salva com Sucesso" no canto superior direito, anunciada a leitores de tela',()=>{
 const js=ler('app.js'),css=ler('style.css'),html=ler('index.html');
 assert.match(js,/save\(msg='Alteração Salva com Sucesso'/);
 assert.match(html,/<div id="toast" role="status" aria-live="polite" aria-atomic="true"><\/div>/);
 assert.match(css,/#toast\{position:fixed;top:24px;right:24px/);
 assert.doesNotMatch(css,/#toast\{[^}]*bottom:/);
 assert.match(css,/prefers-reduced-motion:reduce\)\{#toast/);
});

test('tela: origem vira lista e motivo aparece como campo de texto livre',()=>{
 const js=ler('app.js');
 assert.match(js,/const ORIGINS=\['LinkedIn','Catho','Indicação','Banco de Currículos','E-mail'\]/);
 assert.match(js,/\(cadastro antigo\)/);
 assert.match(js,/<textarea name="rejectReason"/);
 assert.match(js,/Não é enviado ao candidato/);
});
