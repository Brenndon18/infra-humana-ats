'use strict';
const mysql=require('mysql2/promise');const {empty}=require('./server');
async function connect(){let pool=mysql.createPool({host:process.env.DB_HOST||'localhost',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,connectionLimit:4,charset:'utf8mb4',supportBigNumbers:true});
for(let sql of [
`CREATE TABLE IF NOT EXISTS ats_state (id INT PRIMARY KEY, revision INT NOT NULL DEFAULT 0, payload LONGTEXT NOT NULL) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS ats_users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(254) NOT NULL UNIQUE, password VARCHAR(200) NOT NULL, role VARCHAR(20) NOT NULL, active TINYINT NOT NULL DEFAULT 1) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS ats_sessions (token CHAR(64) PRIMARY KEY,user_id INT NOT NULL, expires DATETIME NOT NULL, INDEX(expires)) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS ats_login_attempts (attempt_key CHAR(64) PRIMARY KEY, attempts INT NOT NULL, expires DATETIME NOT NULL) ENGINE=InnoDB`,
`CREATE TABLE IF NOT EXISTS ats_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL, revision INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`
])await pool.query(sql);
await pool.execute('INSERT IGNORE INTO ats_state (id,payload) VALUES (1,?)',[JSON.stringify(empty())]);
const one=async(sql,args=[])=>{let [rows]=await pool.execute(sql,args);return rows[0]};
async function transaction(fn){let c=await pool.getConnection();try{await c.beginTransaction();let r=await fn(c);await c.commit();return r}catch(e){await c.rollback();if(e.code==='ER_DUP_ENTRY')throw Object.assign(new Error('Nome ou e-mail já cadastrado.'),{status:409});throw e}finally{c.release()}}
return {
users:async()=>{let [r]=await pool.query('SELECT * FROM ats_users ORDER BY id');return r},userByEmail:e=>one('SELECT * FROM ats_users WHERE email=?',[e]),
setup:u=>transaction(async c=>{await c.query('SELECT id FROM ats_state WHERE id=1 FOR UPDATE');let [users]=await c.query('SELECT id FROM ats_users LIMIT 1');if(users.length)throw Object.assign(new Error('Instalação já concluída.'),{status:409});await c.execute('INSERT INTO ats_users(name,email,password,role) VALUES(?,?,?,?)',[u.name,u.email,u.password,u.role])}),
createUser:u=>transaction(async c=>{await c.execute('INSERT INTO ats_users(name,email,password,role) VALUES(?,?,?,?)',[u.name,u.email,u.password,u.role])}),
blocked:async k=>{let r=await one('SELECT attempts FROM ats_login_attempts WHERE attempt_key=? AND expires>UTC_TIMESTAMP()',[k]);return r&&r.attempts>=5},
failed:k=>pool.execute('INSERT INTO ats_login_attempts VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE attempts=IF(expires<=UTC_TIMESTAMP(),1,attempts+1), expires=IF(expires<=UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE),expires)',[k]),clearFailures:k=>pool.execute('DELETE FROM ats_login_attempts WHERE attempt_key=?',[k]),
session:async(t,id)=>{await pool.query('DELETE FROM ats_sessions WHERE expires<UTC_TIMESTAMP()');await pool.query('DELETE FROM ats_login_attempts WHERE expires<UTC_TIMESTAMP()');await pool.execute('INSERT INTO ats_sessions VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))',[t,id])},
authenticate:t=>one('SELECT u.* FROM ats_sessions s JOIN ats_users u ON u.id=s.user_id WHERE s.token=? AND s.expires>UTC_TIMESTAMP() AND u.active=1',[t]),logout:t=>pool.execute('DELETE FROM ats_sessions WHERE token=?',[t]),
changePassword:(id,p)=>transaction(async c=>{await c.execute('UPDATE ats_users SET password=? WHERE id=?',[p,id]);await c.execute('DELETE FROM ats_sessions WHERE user_id=?',[id])}),
getState:async()=>{let r=await one('SELECT revision,payload FROM ats_state WHERE id=1');return {revision:r.revision,data:JSON.parse(r.payload)}},
updateState:(rev,fn,uid)=>transaction(async c=>{let [rows]=await c.query('SELECT revision,payload FROM ats_state WHERE id=1 FOR UPDATE'),r=rows[0];if(r.revision!==rev)throw Object.assign(new Error('Outra pessoa atualizou os dados. Recarregue e refaça sua alteração.'),{status:409});let data=fn(JSON.parse(r.payload));await c.execute('UPDATE ats_state SET revision=revision+1,payload=? WHERE id=1',[JSON.stringify(data)]);await c.execute('INSERT INTO ats_audit(user_id,revision) VALUES(?,?)',[uid,rev+1]);return {revision:rev+1,data}}),
// Alteração feita pelo próprio servidor (ex.: registro de e-mail enviado), sem depender da versão aberta na tela.
mutateState:(fn,uid)=>transaction(async c=>{let [rows]=await c.query('SELECT revision,payload FROM ats_state WHERE id=1 FOR UPDATE'),r=rows[0];let data=fn(JSON.parse(r.payload));await c.execute('UPDATE ats_state SET revision=revision+1,payload=? WHERE id=1',[JSON.stringify(data)]);await c.execute('INSERT INTO ats_audit(user_id,revision) VALUES(?,?)',[uid,r.revision+1]);return {revision:r.revision+1,data}}),close:()=>pool.end()
};}
module.exports={connect};
