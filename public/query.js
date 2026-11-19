/* Pure search and KPI rules shared by the interface and tests. */
(function(root){
'use strict';
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const active=j=>!!j&&!['Encerrada','Cancelada','Congelada'].includes(j.status);
const overdue=(j,day)=>active(j)&&!!j.deadline&&j.deadline<day;
const month=(a,day)=>(a.presentationDates||[]).some(d=>d.slice(0,7)===day.slice(0,7));
const waiting=(a,j)=>active(j)&&!!a.presented&&(a.clientPending===true||(a.clientPending===undefined&&a.status==='Material enviado ao cliente'));
const labels={texto:'Texto',nome:'Nome',email:'E-mail',cidade:'Cidade',setor:'Setor',vaga:'Vaga',empresa:'Empresa',etapa:'Etapa atual',status:'Status',responsavel:'Responsável',entrevista:'Entrevista realizada',prazo:'Prazo',apresentacao:'Apresentação',retorno:'Retorno do cliente'};
function parse(input,allowed=Object.keys(labels)){
 let s=String(input||'').trim();if(!s)return {groups:[],error:''};
 if(/^(E|OU|AND|OR)(\s|$)|\s(E|OU|AND|OR)$/.test(s))return {groups:[],error:'Complete as condições antes e depois de E / OU.'};
 if(/[()]/.test(s))return {groups:[],error:'Use E ou OU, sem parênteses. Frases podem ficar entre aspas.'};
 let parts=[],buf='',quoted=false;
 for(let i=0;i<s.length;i++){
  if(s[i]==='"'){quoted=!quoted;buf+=s[i];continue}
  if(!quoted){let m=s.slice(i).match(/^\s+(E|OU|AND|OR)\s+/);if(m){parts.push(buf.trim(),m[1]);buf='';i+=m[0].length-1;continue}}
  buf+=s[i];
 }
 if(quoted)return {groups:[],error:'Feche as aspas da pesquisa.'};parts.push(buf.trim());let groups=[[]];
 for(let p of parts){if(['OU','OR'].includes(p)){groups.push([]);continue}if(['E','AND'].includes(p))continue;
  let neg=p.startsWith('!');if(neg)p=p.slice(1).trim();if(!p)return {groups:[],error:'Informe um valor depois do operador.'};
  let field='texto',value=p,op=neg?'notcontains':'contains';
  if(norm(p)==='entrevista feita'){field='entrevista';value='sim';op=neg?'neq':'eq'}
  else if(p.includes(':')){let at=p.indexOf(':');field=norm(p.slice(0,at).trim());value=p.slice(at+1).trim();op=neg?'neq':'eq'}
  if(!allowed.includes(field))return {groups:[],error:'Campo não disponível nesta tela: '+field};
  if(value.startsWith('"')&&value.endsWith('"'))value=value.slice(1,-1);else if(value.includes('"'))return {groups:[],error:'Use aspas envolvendo a frase inteira.'};
  if(!value)return {groups:[],error:'Informe o valor do campo '+field+'.'};
  groups[groups.length-1].push({field,op,value});
 }
 if(groups.some(g=>!g.length))return {groups:[],error:'Complete as condições antes e depois de E / OU.'};return {groups,error:''};
}
function condition(doc,c){let v=norm(doc[c.field]),q=norm(c.value);switch(c.op){case'eq':return v===q;case'neq':return v!==q;case'contains':return v.includes(q);case'notcontains':return !v.includes(q);case'empty':return !v;case'notempty':return !!v;default:return false}}
function matches(doc,query,rules=[],mode='all'){return !query.error&&(!query.groups.length||query.groups.some(g=>g.every(c=>condition(doc,c))))&&(!rules.length||(mode==='any'?rules.some(c=>condition(doc,c)):rules.every(c=>condition(doc,c))))}
const api={norm,active,overdue,month,waiting,labels,parse,condition,matches};if(typeof module!=='undefined')module.exports=api;else root.ATSQuery=api;
})(typeof window==='undefined'?globalThis:window);
