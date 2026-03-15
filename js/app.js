window.app = (function () {
'use strict';

let currentView = 'dashboard';

/*
PERMISSÕES DE VIEW
define quais roles podem acessar cada módulo
*/

const VIEW_PERMISSIONS = {

dashboard: ['admin'],

pdv: ['admin','operador'],

estoque: ['admin'],

clientes: ['admin'],

fornecedores: ['admin'],

fidelidade: ['admin'],

relatorios: ['admin'],

'price-monitor': ['admin']

};


/*
MAPA DE MÓDULOS
*/

const MODULES = {

dashboard: () => window.dashboard,

pdv: () => window.pdv,

estoque: () => window.estoque,

clientes: () => window.clientes,

fornecedores: () => window.fornecedores,

relatorios: () => window.relatorios,

fidelidade: () => window.fidelidade,

'price-monitor': () => window.priceIntelligence,

login: () => window.auth || null

};



/*
INICIALIZAÇÃO
*/

function init(){

console.log('🚀 Inicializando Supermercado Pro Modular');

if(!window.state){

console.error('state.js não carregado');

document.body.innerHTML = `
<div class="container mt-5">
<div class="alert alert-danger">
Erro crítico: state.js não carregou
</div>
</div>
`;

return;

}

setupKeyboardShortcuts();

bootApplication();

}



/*
BOOT DO SISTEMA
*/

function bootApplication(){

if(!window.auth || !window.auth.isAuthenticated()){

switchView('login');

return;

}

const user = window.auth.getUser();

const defaultView = user.role === 'admin'
? 'dashboard'
: 'pdv';

switchView(defaultView);

}



/*
ATALHOS DE TECLADO
*/

function setupKeyboardShortcuts(){

document.addEventListener('keydown', e=>{

if(!e.ctrlKey || e.shiftKey || e.altKey) return;

const shortcuts = {

d:'dashboard',

p:'pdv',

e:'estoque',

c:'clientes',

r:'relatorios',

f:'fidelidade'

};

const view = shortcuts[e.key];

if(view){

e.preventDefault();

if(window.auth?.isAuthenticated())
switchView(view);
else
switchView('login');

}

});

}



/*
TROCAR VIEW
*/

function switchView(view){

if(!view) return;


/*
VERIFICA AUTENTICAÇÃO
*/

if(window.auth && !window.auth.isAuthenticated() && view !== 'login'){

view = 'login';

}



/*
VERIFICA PERMISSÃO
*/

if(window.auth && window.auth.isAuthenticated()){

const user = window.auth.getUser();

const allowedRoles = VIEW_PERMISSIONS[view];

if(allowedRoles && !allowedRoles.includes(user.role)){

window.utils?.showToast('Acesso negado','warning');

view = user.role === 'admin'
? 'dashboard'
: 'pdv';

}

}


currentView = view;

// Oculta subnav e breadcrumb na view de login
const subnav = document.getElementById('subnavDesktop');
const breadcrumb = document.getElementById('breadcrumb');
const isLogin = view === 'login';
if (subnav)    subnav.style.display    = isLogin ? 'none' : '';
if (breadcrumb) breadcrumb.style.display = isLogin ? 'none' : '';

// Dispara evento para outros listeners
document.dispatchEvent(new CustomEvent('viewChange', { detail: { view } }));


/*
CARREGA MÓDULO
*/

const moduleFactory = MODULES[view];

const module = moduleFactory ? moduleFactory() : null;

if(module && typeof module.render === 'function'){

module.render();

}

else{

renderModuleError(view);

}


/*
ATUALIZA UI
*/

updateDocumentTitle(view);

updateNavVisibility();

}



/*
ERRO DE MÓDULO
*/

function renderModuleError(view){

document.getElementById('mainContent').innerHTML = `

<div class="container mt-4">

<div class="alert alert-warning">

<h5>Módulo não disponível</h5>

<p>O módulo <strong>${view}</strong> não foi carregado corretamente.</p>

</div>

</div>

`;

console.warn(`Módulo ${view} não encontrado`);

}



/*
TÍTULO DA PÁGINA
*/

function updateDocumentTitle(view){

const titles = {

dashboard:'Dashboard',

pdv:'PDV',

estoque:'Gestão de Estoque',

clientes:'Gestão de Clientes',

fornecedores:'Fornecedores',

relatorios:'Relatórios',

fidelidade:'Programa de Fidelidade',

'price-monitor':'Inteligência de Preços',

login:'Login'

};

document.title =
`Gst Tech • ${titles[view] || view}`;

}



/*
CONTROLE DE VISIBILIDADE DA NAVBAR
*/

function updateNavVisibility(){

const isAuth =
window.auth && window.auth.isAuthenticated();

const user =
isAuth ? window.auth.getUser() : null;

const role = user?.role;


const links =
document.querySelectorAll('[data-view]');

links.forEach(link=>{

const view = link.dataset.view;

if(!isAuth){

link.style.display='none';
return;

}

const allowed =
VIEW_PERMISSIONS[view]?.includes(role);

link.style.display =
allowed ? '' : 'none';

});


manageLogoutButton(isAuth);

updateBreadcrumb();

}



/*
LOGOUT BUTTON
*/

function manageLogoutButton(isAuth){

const themeToggle =
document.getElementById('themeToggle');

if(!themeToggle) return;

let logoutBtn =
document.getElementById('logoutBtn');

if(isAuth && !logoutBtn){

logoutBtn = document.createElement('button');

logoutBtn.id='logoutBtn';

logoutBtn.className='nav-link btn btn-link';

logoutBtn.innerHTML =
'<i class="bi bi-box-arrow-right"></i>';

logoutBtn.onclick = ()=>window.auth.logout();

themeToggle.parentNode
.insertBefore(logoutBtn,themeToggle);

}

if(!isAuth && logoutBtn){

logoutBtn.remove();

}

}



/*
BREADCRUMB
*/

function updateBreadcrumb(){

const el =
document.getElementById('currentPage');

if(!el) return;

const names = {

dashboard:'Dashboard',

pdv:'PDV',

estoque:'Estoque',

clientes:'Clientes',

fornecedores:'Fornecedores',

relatorios:'Relatórios',

fidelidade:'Fidelidade',

'price-monitor':'Inteligência de Preços'

};

el.textContent =
names[currentView] || currentView;

}



/*
API PUBLICA
*/

function getCurrentView(){

return currentView;

}



document.addEventListener(
'DOMContentLoaded',
init
);


return {

init,

switchView,

getCurrentView

};

})();