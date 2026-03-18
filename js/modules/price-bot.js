"use strict";

/*
=========================================
Supermercado Pro - Price Intelligence
PriceBot v3.0
Robô de pesquisa de preços
=========================================
*/

window.priceBot = (function(){

const API_URL = "https://api.mercadolibre.com/sites/MLB/search?q=";
const STORAGE_KEY = "gst_price_history";

/* ==========================
   PESQUISAR PREÇOS
========================== */

async function pesquisar(){

try{

const input = document.getElementById("produtoPesquisa");

if(!input){
console.warn("Input produtoPesquisa não encontrado");
return;
}

const produto = input.value.trim();

if(!produto){

window.utils?.showToast(
"Digite um produto para pesquisar",
"warning"
);

return;

}

const url = API_URL + encodeURIComponent(produto);

console.log("🔎 PriceBot buscando:", url);

const response = await fetch(url,{
method:"GET",
headers:{
"Accept":"application/json"
}
});

if(response.status === 403){

throw new Error("API MercadoLivre bloqueou a requisição (403)");

}

if(!response.ok){

throw new Error("Falha na API de preços");

}

const data = await response.json();

const results = data?.results || [];

console.log("📊 resultados:",results.length);

renderTabela(results);

salvarHistorico(results);

}
catch(err){

console.error("PriceBot erro completo:",err);

window.utils?.showToast(
"Erro ao pesquisar preços",
"danger"
);

}

}

/* ==========================
   RENDER TABELA
========================== */

function renderTabela(results){

const tabela =
document.getElementById("resultadoPesquisa");

if(!tabela) return;

tabela.innerHTML = "";

if(results.length === 0){

tabela.innerHTML = `
<tr>
<td colspan="3" class="text-center text-muted">
Nenhum preço encontrado
</td>
</tr>
`;

return;

}

results.slice(0,8).forEach(item=>{

const preco = Number(item.price || 0).toFixed(2);

tabela.innerHTML += `
<tr>
<td>${item.title}</td>
<td>R$ ${preco}</td>
<td>${item.seller?.nickname || "Loja"}</td>
</tr>
`;

});

}

/* ==========================
   SALVAR HISTÓRICO
========================== */

function salvarHistorico(results){

if(!results.length) return;

let historico =
JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

results.slice(0,8).forEach(item=>{

historico.push({

produto: item.title,
preco: item.price,
loja: item.seller?.nickname || "Loja",
data: new Date().toISOString()

});

});

localStorage.setItem(
STORAGE_KEY,
JSON.stringify(historico)
);

}

/* ==========================
   HISTÓRICO
========================== */

function carregarHistorico(){

const tabela =
document.getElementById("historicoPrecos");

if(!tabela) return;

let historico =
JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

tabela.innerHTML = "";

historico.slice(-20).reverse().forEach(item=>{

tabela.innerHTML += `
<tr>
<td>${item.produto}</td>
<td>R$ ${Number(item.preco).toFixed(2)}</td>
<td>${item.loja}</td>
<td>${new Date(item.data).toLocaleDateString()}</td>
</tr>
`;

});

}

/* ==========================
   LIMPAR HISTÓRICO
========================== */

function limparHistorico(){

localStorage.removeItem(STORAGE_KEY);

carregarHistorico();

window.utils?.showToast(
"Histórico apagado",
"info"
);

}

/* ==========================
   IA SIMPLES DE PREÇO
========================== */

function sugerirPreco(){

let historico =
JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

if(historico.length === 0) return null;

let soma = 0;

historico.forEach(item=>{
soma += Number(item.preco);
});

let media = soma / historico.length;

let sugestao = media * 0.97;

return{

media: media.toFixed(2),
sugerido: sugestao.toFixed(2)

};

}

/* ==========================
   API PUBLICA
========================== */

return{

pesquisar,
carregarHistorico,
limparHistorico,
sugerirPreco

};

})();