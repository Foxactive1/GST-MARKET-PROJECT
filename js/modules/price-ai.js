const priceAI = {

analisar(precos){

const box =
document.getElementById("priceAnalysis");

if(!box) return;

const media =
precos.reduce((a,b)=>a+b,0)/precos.length;

const min =
Math.min(...precos);

const max =
Math.max(...precos);

box.innerHTML = `

<li class="list-group-item">
Preço médio: R$ ${media.toFixed(2)}
</li>

<li class="list-group-item">
Menor preço: R$ ${min}
</li>

<li class="list-group-item">
Maior preço: R$ ${max}
</li>

<li class="list-group-item">
Sugestão de venda: R$ ${(media*1.15).toFixed(2)}
</li>

`;

}

};