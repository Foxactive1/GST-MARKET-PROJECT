"use strict";

/*
=========================================
Supermercado Pro
Command Palette v2.0
Desenvolvido por: Dione Castro Alves
InNovaIdeia
=========================================
*/

class CommandPalette {

constructor(){

this.commands = [];
this.filteredCommands = [];
this.selectedIndex = 0;
this.isOpen = false;

this.modal = null;
this.input = null;
this.list = null;

this.init();

}

/* ================================
INICIALIZAÇÃO
================================ */

init(){

this.modal = document.getElementById("commandPalette");
this.input = document.getElementById("commandInput");
this.list = document.getElementById("commandList");

if(!this.modal || !this.input || !this.list){

console.warn("Command Palette elementos não encontrados");

return;

}

this.registerDefaultCommands();
this.setupEvents();

}

/* ================================
COMANDOS PADRÃO
================================ */

registerDefaultCommands(){

this.commands = [

{
id:"nav-dashboard",
label:"Ir para Dashboard",
icon:"bi-speedometer2",
category:"Navegação",
shortcut:"Ctrl+D",
action:()=>window.app?.switchView("dashboard")
},

{
id:"nav-pdv",
label:"Ir para PDV",
icon:"bi-cash-register",
category:"Navegação",
shortcut:"Ctrl+P", // BUG 03 CORRIGIDO: era "Ctrl+Shift+P" que era interceptado pelo browser como Imprimir
action:()=>window.app?.switchView("pdv")
},

{
id:"nav-estoque",
label:"Ir para Estoque",
icon:"bi-box-seam",
category:"Navegação",
shortcut:"Ctrl+E",
action:()=>window.app?.switchView("estoque")
},

{
id:"nav-clientes",
label:"Ir para Clientes",
icon:"bi-people",
category:"Navegação",
shortcut:"Ctrl+C",
action:()=>window.app?.switchView("clientes")
},

{
id:"nav-relatorios",
label:"Ir para Relatórios",
icon:"bi-graph-up",
category:"Navegação",
shortcut:"Ctrl+R",
action:()=>window.app?.switchView("relatorios")
},

{
id:"nav-price-monitor",
label:"Ir para Inteligência de Preços",
icon:"bi-graph-up-arrow",
category:"Navegação",
shortcut:"Ctrl+Shift+M",
action:()=>window.app?.switchView("price-monitor")
},

{
id:"theme-toggle",
label:"Alternar Tema",
icon:"bi-moon-stars",
category:"Aparência",
action:()=>window.themeManager?.toggle()
},

{
id:"action-refresh",
label:"Recarregar Página",
icon:"bi-arrow-clockwise",
category:"Ações",
action:()=>location.reload()
},

{
id:"action-print",
label:"Imprimir Página",
icon:"bi-printer",
category:"Ações",
// Sem shortcut — Ctrl+P é reservado para PDV; imprimir está disponível apenas via Command Palette
action:()=>window.print()
},

{
id:"action-clear-cache",
label:"Limpar Cache",
icon:"bi-trash",
category:"Sistema",
action:()=>this.clearCache()
},

{
id:"help-shortcuts",
label:"Ver Atalhos de Teclado",
icon:"bi-keyboard",
category:"Ajuda",
shortcut:"Ctrl+Shift+?",
action:()=>this.showShortcuts()
},

{
id:"help-about",
label:"Sobre o Sistema",
icon:"bi-info-circle",
category:"Ajuda",
action:()=>this.showAbout()
}

];

}

/* ================================
EVENTOS
================================ */

setupEvents(){

this.input.addEventListener("input",(e)=>{

this.filter(e.target.value);

});

this.input.addEventListener("keydown",(e)=>{

switch(e.key){

case "ArrowDown":
e.preventDefault();
this.next();
break;

case "ArrowUp":
e.preventDefault();
this.prev();
break;

case "Enter":
e.preventDefault();
this.execute();
break;

case "Escape":
this.hide();
break;

}

});

document.addEventListener("keydown",(e)=>{

if(e.ctrlKey && e.key === "k"){

e.preventDefault();
this.show();

}

});

this.modal.addEventListener("shown.bs.modal",()=>{

this.isOpen=true;
this.input.focus();
this.filter("");

});

this.modal.addEventListener("hidden.bs.modal",()=>{

this.isOpen=false;
this.selectedIndex=0;

});

}

/* ================================
MOSTRAR / ESCONDER
================================ */

show(){

const modal = new bootstrap.Modal(this.modal);

modal.show();

}

hide(){

const modal = bootstrap.Modal.getInstance(this.modal);

if(modal) modal.hide();

}

/* ================================
FILTRO
================================ */

filter(query){

query=query.toLowerCase().trim();

if(!query){

this.filteredCommands=[...this.commands];

}else{

this.filteredCommands=this.commands.filter(cmd=>

cmd.label.toLowerCase().includes(query) ||
cmd.category.toLowerCase().includes(query)

);

}

this.selectedIndex=0;

this.render();

}

/* ================================
RENDER
================================ */

render(){

if(this.filteredCommands.length===0){

this.list.innerHTML=`<div class="p-3 text-muted">Nenhum comando encontrado</div>`;

return;

}

let html="";

this.filteredCommands.forEach((cmd,index)=>{

const selected=index===this.selectedIndex;

html+=`

<div class="command-item ${selected?"selected":""}" data-index="${index}">

<div>

<i class="bi ${cmd.icon} me-2"></i>

${cmd.label}

</div>

${cmd.shortcut?`<kbd>${cmd.shortcut}</kbd>`:""}

</div>

`;

});

this.list.innerHTML=html;

this.list.querySelectorAll(".command-item").forEach(el=>{

el.addEventListener("click",()=>{

this.selectedIndex=parseInt(el.dataset.index);

this.execute();

});

});

}

/* ================================
NAVEGAÇÃO
================================ */

next(){

if(this.selectedIndex < this.filteredCommands.length-1){

this.selectedIndex++;

this.render();

}

}

prev(){

if(this.selectedIndex>0){

this.selectedIndex--;

this.render();

}

}

/* ================================
EXECUTAR
================================ */

execute(){

const cmd=this.filteredCommands[this.selectedIndex];

if(!cmd) return;

this.hide();

setTimeout(()=>{

cmd.action();

},100);

}

/* ================================
REGISTRAR COMANDO
================================ */

registerCommand(command){

if(!command.id || !command.label || !command.action){

console.warn("Comando inválido",command);

return;

}

this.commands=this.commands.filter(c=>c.id!==command.id);

this.commands.push({

category:"Custom",
icon:"bi-lightning",
...command

});

console.log("Command registered:",command.label);

}

/* ================================
REMOVER COMANDO
================================ */

unregisterCommand(id){

this.commands=this.commands.filter(c=>c.id!==id);

}

/* ================================
UTILS
================================ */

async clearCache(){

if("caches" in window){

const names=await caches.keys();

await Promise.all(names.map(n=>caches.delete(n)));

window.utils?.showToast("Cache limpo","success");

setTimeout(()=>location.reload(),1000);

}

}

/* ================================
ATALHOS
================================ */

showShortcuts(){

window.utils?.showAlert(

"Atalhos",

"info",

`
<ul class="text-start">

<li>Ctrl + K → Command Palette</li>
<li>Ctrl + D → Dashboard</li>
<li>Ctrl + P → PDV</li>
<li>Ctrl + E → Estoque</li>
<li>Ctrl + C → Clientes</li>
<li>Ctrl + R → Relatórios</li>
<li>Ctrl + F → Fidelidade</li>
<li>Ctrl + G → Fornecedores</li>

</ul>
`

);

}

/* ================================
ABOUT
================================ */

showAbout(){

window.utils?.showAlert(

"Sobre",

"info",

`
<h4>Supermercado Pro</h4>

<p>Sistema de Gestão Modular</p>

<p><b>Versão:</b> 1.0</p>

<p><b>Desenvolvedor:</b> Dione Castro Alves</p>

<p><b>Empresa:</b> InNovaIdeia</p>

`

);

}

}

/* ===================================
CRIAR INSTÂNCIA GLOBAL
=================================== */

window.commands = new CommandPalette();

console.log("✅ Command Palette carregado");
console.log("📋",window.commands.commands.length,"comandos ativos");