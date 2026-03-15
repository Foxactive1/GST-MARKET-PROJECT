"use strict";

/*
=========================================
Supermercado Pro
Módulo: Inteligência de Preços
Arquivo: price-monitor.js
=========================================
*/

window.priceMonitor = (function(){

function render(){

const main = document.getElementById("mainContent");

if(!main){

console.warn("mainContent não encontrado");

return;

}

main.innerHTML = `

<div class="container-fluid">

<div class="row">

<div class="col-12">

<div class="card shadow">

<div class="card-header bg-primary text-white">

<h5 class="mb-0">

<i class="bi bi-graph-up"></i>
 Inteligência de Preços

</h5>

</div>

<div class="card-body">

<div class="row mb-3">

<div class="col-md-8">

<input 
type="text"
id="produtoPesquisa"
class="form-control"
placeholder="Digite um produto para pesquisar concorrência"
/>

</div>

<div class="col-md-4">

<button
class="btn btn-success w-100"
onclick="priceBot.pesquisar()"
>

<i class="bi bi-search"></i>
Pesquisar Preços

</button>

</div>

</div>

<h6 class="mt-3">Resultados da Concorrência</h6>

<div class="table-responsive">

<table class="table table-striped">

<thead>

<tr>
<th>Produto</th>
<th>Preço</th>
<th>Vendedor</th>
</tr>

</thead>

<tbody id="resultadoPesquisa">

<tr>
<td colspan="3" class="text-center text-muted">
Nenhuma pesquisa realizada
</td>
</tr>

</tbody>

</table>

</div>

<hr>

<h6>Histórico de Preços Pesquisados</h6>

<div class="table-responsive">

<table class="table table-sm">

<thead>

<tr>
<th>Produto</th>
<th>Preço</th>
<th>Loja</th>
<th>Data</th>
</tr>

</thead>

<tbody id="historicoPrecos"></tbody>

</table>

</div>

<div class="mt-3">

<button
class="btn btn-outline-danger"
onclick="priceBot.limparHistorico()"
>

<i class="bi bi-trash"></i>
Limpar Histórico

</button>

<button
class="btn btn-outline-primary"
onclick="mostrarSugestao()"
>

<i class="bi bi-lightbulb"></i>
Sugerir Preço

</button>

</div>

</div>

</div>

</div>

</div>

</div>

`;

carregarHistorico();

}

/* ==========================
   HISTÓRICO
========================== */

function carregarHistorico(){

if(window.priceBot){

priceBot.carregarHistorico();

}

}

/* ==========================
   SUGESTÃO DE PREÇO
========================== */

function mostrarSugestao(){

if(!window.priceBot) return;

const sugestao = priceBot.sugerirPreco();

if(!sugestao){

window.utils?.showToast(
"Nenhum histórico para calcular sugestão",
"warning"
);

return;

}

window.utils?.showToast(
`Preço médio: R$ ${sugestao.media} | Sugerido: R$ ${sugestao.sugerido}`,
"info"
);

}

/* ==========================
   REGISTRAR MÓDULO
========================== */

if(window.app && window.app.registerModule){

window.app.registerModule({

id: "price-monitor",
label: "Inteligência de Preços",
icon: "bi-graph-up",
action: render

});

}

return {

render,
carregarHistorico

};

})();