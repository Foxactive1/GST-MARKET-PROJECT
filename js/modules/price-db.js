const priceDB = {

KEY:"price_history",

salvar(produto,preco){

let dados =
JSON.parse(localStorage.getItem(this.KEY) || "[]");

dados.push({

produto,
preco,
data:new Date().toLocaleString()

});

localStorage.setItem(
this.KEY,
JSON.stringify(dados)
);

},

listar(){

return JSON.parse(
localStorage.getItem(this.KEY) || "[]"
);

}

};