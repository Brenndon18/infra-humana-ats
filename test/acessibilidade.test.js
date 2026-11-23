'use strict';
// Verificações simples de acessibilidade da interface (versão 2.4).
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ler=f=>fs.readFileSync(path.join(__dirname,'../public',f),'utf8');

test('acessibilidade: página tem link para pular ao conteúdo, menu nomeado e modal com título',()=>{
 const html=ler('index.html');
 assert.match(html,/<html lang="pt-BR">/);
 assert.match(html,/class="skip-link" href="#main"/);
 assert.match(html,/<nav id="nav" aria-label="Menu principal">/);
 assert.match(html,/<main id="main" tabindex="-1">/);
 assert.match(html,/<dialog id="modal" aria-labelledby="modal-title">/);
});

test('acessibilidade: menu marca a página atual, tabelas têm cabeçalhos e o foco volta ao fechar o modal',()=>{
 const js=ler('app.js');
 assert.match(js,/aria-current="page"/);
 assert.doesNotMatch(js,/<th>/,'todo cabeçalho de tabela deve ter scope="col"');
 assert.match(js,/id="page-title" tabindex="-1"/);
 assert.match(js,/modal\.onclose=/);
});

test('acessibilidade: CSS tem foco visível, movimento reduzido e alto contraste',()=>{
 const css=ler('style.css');
 assert.match(css,/:focus-visible\{outline:3px solid var\(--focus\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/forced-colors:active/);
});
