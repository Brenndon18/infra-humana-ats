"use strict";
// Ponto de entrada compatível com node app.js e com o carregador LiteSpeed.
const app=require('./server');
app.start().catch(error=>{
 console.error('ats_start_failed',error.code||error.message);
 process.exitCode=1;
});
