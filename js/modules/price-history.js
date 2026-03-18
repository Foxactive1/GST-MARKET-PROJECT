const priceHistory = {

carregar(){

const tabela =
document.getElementById("priceHistory");

if(!tabela) return;

const dados = priceDB.listar();

tabela.innerHTML="";

dados.slice(-10).reverse().forEach(item=>{

tabela.innerHTML += `
<tr>
<td>${item.produto}</td>
<td>R$ ${item.preco}</td>
<td>${item.data}</td>
</tr>
`;

});

}

};