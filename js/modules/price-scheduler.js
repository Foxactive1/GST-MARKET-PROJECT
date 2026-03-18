const priceScheduler = {

iniciar(){

setInterval(()=>{

let produto =
document.getElementById("produtoPesquisa").value;

if(produto){
priceBot.pesquisar();
}

}, 1000 * 60 * 60 * 6);

}

};