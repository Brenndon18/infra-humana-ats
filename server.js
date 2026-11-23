'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util');const scrypt=promisify(crypto.scrypt);
const STAGES=['','On holding','Contato iniciado','Em tratativa','Entrevista feita','Aprovado na entrevista RH','Reprovado em entrevista RH','Reprovado pelo cliente','Material enviado ao cliente','Aprovado pelo cliente'];
const JOBS=['Aberta','Entrevista Técnica','Negociação Cliente','Congelada','Encerrada','Cancelada'];
const empty=()=>({companies:[],jobs:[],candidates:[],applications:[],history:[]});
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>crypto.timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const text=(v,max=300)=>{if(typeof v!=='string'||v.length>max)fail(400,'Texto inválido ou muito longo.');return v.trim()};
const required=(v,max=300)=>{let s=text(v,max);if(!s)fail(400,'Preencha os campos obrigatórios.');return s};
const num=v=>{if(!Number.isSafeInteger(v)||v<1)fail(400,'Identificador inválido.');return v};
function date(v){if(!v)return '';if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)fail(400,'Data inválida.');return v}
function email(v){let s=required(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'E-mail inválido.');return s}
function password(v){if(typeof v!=='string'||v.length<12||v.length>128)fail(400,'Use uma senha de 12 a 128 caracteres.');return v}
async function encode(p){let salt=crypto.randomBytes(16).toString('hex');return salt+':'+(await scrypt(password(p),salt,64)).toString('hex')}
async function verify(p,stored){if(typeof p!=='string'||p.length>128)return false;let [salt,k]=stored.split(':');return crypto.timingSafeEqual(await scrypt(p,salt,64),Buffer.from(k,'hex'))}
const stamp=()=>new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
function logo(v){if(!v)return '';if(typeof v!=='string'||v.length>40000||!/^data:image\/(webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(v))fail(400,'Logo inválida.');return v}
function sanitize(input,previous,users,actor,allowDelete=false){
 if(!input||typeof input!=='object')fail(400,'Dados inválidos.');let out=empty();const ids={};
 for(let key of ['companies','jobs','candidates','applications']){if(!Array.isArray(input[key])||input[key].length>10000)fail(400,'Quantidade de registros inválida.');ids[key]=new Set();for(let row of input[key]){num(row.id);if(ids[key].has(row.id))fail(400,'Identificador duplicado.');ids[key].add(row.id)}}
 const owner=v=>{let s=required(v,100);if(!users.some(u=>u.name===s&&u.active))fail(400,'Responsável inválido.');return s};
 for(let c of input.companies)out.companies.push({id:c.id,name:required(c.name,150),sector:text(c.sector||'',150),city:text(c.city||'',150),logo:logo(c.logo)});
 const emails=new Set();for(let c of input.candidates){let e=c.email?email(c.email):'';if(e&&emails.has(e))fail(409,'Já existe um candidato com esse e-mail.');if(e)emails.add(e);let cv=text(c.cv||'',2000);if(cv){let u;try{u=new URL(cv)}catch{fail(400,'Link de currículo inválido.')}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)fail(400,'Use link HTTP ou HTTPS sem credenciais.')}out.candidates.push({id:c.id,name:required(c.name,150),email:e,phone:text(c.phone||'',50),phone1:text(c.phone1||'',50),phone2:text(c.phone2||'',50),city:text(c.city||'',150),origin:text(c.origin||'',150),cv})}
 for(let j of input.jobs){if(!ids.companies.has(j.company)||!JOBS.includes(j.status)||!Number.isSafeInteger(j.mapped)||j.mapped<0)fail(400,'Dados da vaga inválidos.');out.jobs.push({id:j.id,company:j.company,title:required(j.title,200),owner:owner(j.owner),deadline:date(j.deadline),status:j.status,mapped:j.mapped,chosen:j.chosen?num(j.chosen):null})}
 const pairs=new Set();for(let a of input.applications){if(!ids.jobs.has(a.job)||!ids.candidates.has(a.candidate)||!STAGES.includes(a.status))fail(400,'Vínculo de candidatura inválido.');let pair=a.job+':'+a.candidate;if(pairs.has(pair))fail(409,'Candidato já vinculado a esta vaga.');pairs.add(pair);let old=previous.applications.find(x=>x.id===a.id);if(old&&(old.job!==a.job||old.candidate!==a.candidate))fail(400,'Não é permitido trocar o vínculo existente.');let oldNotes=old?.notes||[];if(!Array.isArray(a.notes)||a.notes.length>2000)fail(400,'Observações inválidas.');const fresh=a.notes.filter(n=>!oldNotes.some(o=>o.id===n.id&&o.id)).filter(n=>!oldNotes.some(o=>!n.id&&n.text===o.text&&n.at===o.at));const notes=[...fresh.map(n=>({id:crypto.randomUUID(),text:required(n.text,5000),author:actor.name,at:stamp()})),...oldNotes.filter(o=>!allowDelete||a.notes.some(n=>o.id?n.id===o.id:n.text===o.text&&n.at===o.at))];let dates=Array.isArray(old?.presentationDates)?[...old.presentationDates]:[];
 const requested=date(a.presentationDate);const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
 if(requested&&requested>day)fail(400,'A apresentação não pode ter data futura.');
 const sentNow=a.status==='Material enviado ao cliente'&&old?.status!==a.status;
 if(requested&&!old?.presented&&!sentNow)fail(400,'Registre o envio ao cliente antes de informar a data.');
 if(sentNow){let d=requested&&requested!==(old?.presentationDates||[]).at(-1)?requested:day;if(!dates.includes(d))dates.push(d)}
 else if(requested&&requested!==dates.at(-1)&&old?.presented){if(dates.length)dates[dates.length-1]=requested;else dates.push(requested)}
 dates=[...new Set(dates)].sort();if(dates.length>500)fail(400,'Limite de datas de apresentação atingido.');
 const returned=['Aprovado pelo cliente','Reprovado pelo cliente'].includes(a.status);
 const pending=returned?false:sentNow?true:(old?.clientPending??(old?.status==='Material enviado ao cliente'));
 if(JSON.stringify(dates)!==JSON.stringify(old?.presentationDates||[]))notes.unshift({id:crypto.randomUUID(),text:'Datas de apresentação: '+dates.join(', '),author:actor.name,at:stamp()});
 out.applications.push({id:a.id,job:a.job,candidate:a.candidate,status:a.status,owner:owner(a.owner),first:date(a.first),interview:date(a.interview),follow:date(a.follow),action:text(a.action||'',500),interviewed:!!old?.interviewed||a.status==='Entrevista feita',presented:!!old?.presented||a.status==='Material enviado ao cliente',presentationDates:dates,clientPending:pending,notes})}
 for(let j of out.jobs)if(j.chosen&&!out.applications.some(a=>a.job===j.id&&a.candidate===j.chosen))fail(400,'Profissional escolhido deve estar vinculado à vaga.');
 // Remoções exigem uma operação explícita; salvamentos comuns preservam o histórico.
 for(let key of ['companies','jobs','candidates','applications'])for(let row of previous[key])if(!allowDelete&&!ids[key].has(row.id))fail(400,'Confirme a exclusão pelo botão Excluir.');
 const notes=Array.isArray(input.history)?input.history:[];out.history=(previous.history||[]).filter(o=>!allowDelete||(ids.jobs.has(o.job)&&notes.some(n=>o.id?n.id===o.id:n.text===o.text&&n.at===o.at)));
 for(let n of notes.filter(n=>!n.id&&!out.history.some(o=>o.text===n.text&&o.at===n.at))){if(ids.jobs.has(n.job))out.history=[{id:crypto.randomUUID(),job:n.job,text:required(n.text,5000),author:actor.name,at:stamp()},...out.history]}
 for(let j of out.jobs){let old=previous.jobs.find(x=>x.id===j.id);if(JSON.stringify(old)!==JSON.stringify(j))out.history=[{id:crypto.randomUUID(),job:j.id,text:old?'Cadastro da vaga atualizado.':'Vaga criada.',author:actor.name,at:stamp()},...out.history]}
 return out;
}
function createServer(repo,config){const origin=config.origin,local=config.localTest===true,environment=config.environment==='homologacao'?'homologacao':'producao';const cookieName=local?'ih_session':'__Host-ih_session';
 function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))}
 async function body(req){let chunks=[],size=0;for await(let c of req){size+=c.length;if(size>2*1024*1024)fail(413,'Dados muito grandes.');chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString())}catch{fail(400,'JSON inválido.')}}
 const server=http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 try{const url=new URL(req.url,origin),route=url.pathname;
 if(route.startsWith('/api/')){
 if(!local&&req.headers['x-forwarded-proto']?.split(',')[0].trim()!=='https'&&!req.socket.encrypted)fail(400,'Acesso permitido somente por HTTPS.');
 if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)fail(403,'Origem não autorizada.');
 if(!['GET','HEAD'].includes(req.method)&&!String(req.headers['content-type']).startsWith('application/json'))fail(415,'Envie dados JSON.');
 if(route==='/api/status'&&req.method==='GET')return send(res,200,{needsSetup:!(await repo.users()).length,environment});
 if(route==='/api/setup'&&req.method==='POST'){let d=await body(req);if(!config.setupToken||config.setupToken.length<32||!equal(d.token||'',config.setupToken))fail(403,'Código de instalação inválido.');let u={name:required(d.name,100),email:email(d.email),password:await encode(d.password),role:'admin'};await repo.setup(u);return send(res,201,{ok:true})}
 if(route==='/api/login'&&req.method==='POST'){let d=await body(req),e=email(d.email),key=hash(e);if(await repo.blocked(key))fail(429,'Muitas tentativas. Aguarde 15 minutos.');let u=await repo.userByEmail(e);let ok=u&&u.active&&await verify(d.password,u.password);if(!ok){await repo.failed(key);fail(401,'E-mail ou senha incorretos.')}await repo.clearFailures(key);let token=crypto.randomBytes(32).toString('hex');await repo.session(hash(token),u.id);res.setHeader('Set-Cookie',`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${local?'':'; Secure'}`);return send(res,200,{ok:true})}
 let token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);let user=token?await repo.authenticate(hash(token)):null;if(!user)fail(401,'Entre para continuar.');
 if(route==='/api/logout'&&req.method==='POST'){await repo.logout(hash(token));res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${local?'':'; Secure'}`);return send(res,200,{ok:true})}
 if(route==='/api/me'&&req.method==='GET')return send(res,200,{id:user.id,name:user.name,email:user.email,role:user.role});
 if(route==='/api/users'&&req.method==='GET')return send(res,200,(await repo.users()).map(u=>({id:u.id,name:u.name,active:!!u.active,role:u.role})));
 if(route==='/api/users'&&req.method==='POST'){if(user.role!=='admin')fail(403,'Apenas o administrador pode criar acessos.');let d=await body(req),u={name:required(d.name,100),email:email(d.email),password:await encode(d.password),role:d.role==='admin'?'admin':'member'};await repo.createUser(u);return send(res,201,{ok:true})}
 if(route==='/api/password'&&req.method==='POST'){let d=await body(req),fresh=await repo.userByEmail(user.email);if(!await verify(d.current,fresh.password))fail(401,'Senha atual incorreta.');await repo.changePassword(user.id,await encode(d.password));return send(res,200,{ok:true})}
 if(route==='/api/state'&&req.method==='GET')return send(res,200,await repo.getState());
 if(route==='/api/state'&&req.method==='PUT'){let d=await body(req);if(!Number.isInteger(d.revision))fail(400,'Versão inválida.');let users=await repo.users();let result=await repo.updateState(d.revision,old=>sanitize(d.data,old,users,user,d.deleteMode===true),user.id);return send(res,200,result)}
 if(route==='/api/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="infra-humana-ats-backup.json"');return send(res,200,{exportedAt:new Date().toISOString(),...(await repo.getState())})}
 fail(404,'Endereço não encontrado.');
 }
 if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Método não permitido.');let files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/auth.js':'auth.js','/logo.png':'logo.png','/query.js':'query.js','/theme.js':'theme.js'};let f=files[route];if(!f)fail(404,'Arquivo não encontrado.');let file=path.join(__dirname,'public',f),data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':f.endsWith('.png')?'image/png':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});res.end(req.method==='HEAD'?undefined:data);
 }catch(e){if(!e.status)console.error('ats_request_failed',e.code||e.name);send(res,e.status||500,{error:e.status?e.message:'Não foi possível concluir. Verifique o log da aplicação.'})}});return server;
}
const PRODUCTION_DATABASES=['infraest_ats'],PRODUCTION_ORIGINS=['https://ats.infrahumana.com.br'];
async function start(){
 const origin=process.env.APP_ORIGIN;
 if(!origin||new URL(origin).protocol!=='https:'||new URL(origin).origin!==origin)throw new Error('APP_ORIGIN deve ser a origem HTTPS, sem barra final.');
 if(!process.env.DB_PASSWORD||!process.env.DB_NAME?.endsWith('_ats'))throw new Error('Configure DB_PASSWORD e banco exclusivo com final _ats.');
 const environment=process.env.ATS_AMBIENTE==='homologacao'?'homologacao':'producao';
 // Trava de segurança: a homologação nunca pode apontar para o banco ou o endereço de produção.
 if(environment==='homologacao'&&(PRODUCTION_DATABASES.includes(process.env.DB_NAME)||PRODUCTION_ORIGINS.includes(origin)))throw new Error('Homologação não pode usar o banco nem o endereço de produção.');
 const repo=await require('./database').connect();
 return createServer(repo,{origin,environment,setupToken:process.env.SETUP_TOKEN}).listen(process.env.PORT||3000);
}
module.exports={createServer,sanitize,encode,verify,empty,start,PRODUCTION_DATABASES,PRODUCTION_ORIGINS};
