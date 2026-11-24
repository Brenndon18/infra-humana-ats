'use strict';
// Preenche o ATS de HOMOLOGAÇÃO com dados 100% fictícios, para testar sem usar dados reais.
// Uso (somente na homologação, depois de criar o administrador): npm run homolog:dados-ficticios
// Travas: só roda com ATS_AMBIENTE=homologacao, nunca no banco de produção e só com o banco vazio.
const {sanitize,empty,PRODUCTION_DATABASES}=require('../server');

const EMPRESAS=[['Construtora Horizonte Fictícia','Construção civil','São Paulo'],['Metalúrgica Exemplo Ltda','Indústria','Campinas'],['Energia Solar Demo','Energia','Maringá'],['Logística Teste S.A.','Logística','Curitiba']];
const VAGAS=[[1,'Engenheiro civil pleno','Aberta',20],[1,'Técnico de segurança do trabalho','Entrevista Técnica',-3],[2,'Analista de manutenção','Negociação Cliente',10],[2,'Soldador TIG','Congelada',30],[3,'Eletricista de média tensão','Aberta',-1],[4,'Coordenador de logística','Encerrada',-20]];
const NOMES=['Ana Teste Souza','Bruno Exemplo Lima','Carla Fictícia Rocha','Diego Demo Alves','Elisa Modelo Costa','Fábio Teste Nunes','Gabriela Exemplo Dias','Henrique Demo Pires','Isabela Fictícia Melo','João Modelo Ramos','Karina Teste Lopes','Lucas Exemplo Freitas','Mariana Demo Castro','Nicolas Fictício Prado','Olívia Modelo Teixeira'];
const CIDADES=['São Paulo','Campinas','Maringá','Curitiba','Londrina'];
// [vaga, candidato, etapa] — cobre etapas variadas, inclusive vínculo sem etapa ('').
const VINCULOS=[[1,1,'Contato iniciado'],[1,2,'Entrevista feita'],[1,3,''],[2,4,'Em tratativa'],[2,5,'Material enviado ao cliente'],[3,6,'Aprovado na entrevista RH'],[3,7,'Reprovado em entrevista RH'],[3,1,'On holding'],[4,8,'Contato iniciado'],[5,9,'Material enviado ao cliente'],[5,10,'Entrevista feita'],[6,11,'Aprovado pelo cliente'],[6,12,'Reprovado pelo cliente']];

function dia(deslocamento){const hoje=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());const d=new Date(hoje+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+deslocamento);return d.toISOString().slice(0,10)}

function gerarDadosFicticios(responsavel){
 const data=empty();
 EMPRESAS.forEach(([name,sector,city],i)=>data.companies.push({id:i+1,name,sector,city,logo:''}));
 NOMES.forEach((name,i)=>{const login=name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('.');data.candidates.push({id:i+1,name,email:login+'@example.com',phone:'(11) 90000-'+String(1000+i),phone1:'',phone2:'',city:CIDADES[i%CIDADES.length],origin:['LinkedIn','Catho','Indicação','Banco de Currículos','E-mail'][i%5],cv:'https://example.com/curriculo-'+(i+1)+'.pdf'})});
 VAGAS.forEach(([company,title,status,prazo],i)=>data.jobs.push({id:i+1,company,title,owner:responsavel,deadline:dia(prazo),status,mapped:0,chosen:null}));
 VINCULOS.forEach(([job,candidate,status],i)=>data.applications.push({id:i+1,job,candidate,status,owner:responsavel,first:dia(-15+i),interview:['Entrevista feita','Aprovado na entrevista RH','Reprovado em entrevista RH'].includes(status)?dia(-5):'',follow:status?dia(3):'',action:status?'Retornar contato (teste)':'',rejectReason:/^Reprovado/.test(status)?'Motivo fictício para testes.':'',notes:[{text:'Observação fictícia criada para testes.'}]}));
 data.jobs[5].chosen=11; // vaga encerrada com profissional escolhido
 return data;
}

async function main(){
 if(process.env.ATS_AMBIENTE!=='homologacao')throw new Error('Este script só roda na homologação (ATS_AMBIENTE=homologacao).');
 if(PRODUCTION_DATABASES.includes(process.env.DB_NAME))throw new Error('Recusado: este é o banco de produção.');
 const repo=await require('../database').connect();
 try{
  const admin=(await repo.users()).find(u=>u.active&&u.role==='admin');
  if(!admin)throw new Error('Crie primeiro o administrador da homologação pelo site (Primeiro acesso).');
  const {revision,data}=await repo.getState();
  if(['companies','jobs','candidates','applications'].some(k=>data[k].length))throw new Error('O banco já tem dados; nada foi alterado.');
  const users=await repo.users();
  await repo.updateState(revision,old=>sanitize(gerarDadosFicticios(admin.name),old,users,admin),admin.id);
  console.log('Dados fictícios criados: '+EMPRESAS.length+' empresas, '+VAGAS.length+' vagas, '+NOMES.length+' candidatos, '+VINCULOS.length+' vínculos.');
 }finally{await repo.close()}
}

if(require.main===module)main().catch(e=>{console.error('Não foi possível criar os dados fictícios: '+e.message);process.exitCode=1});
module.exports={gerarDadosFicticios};
