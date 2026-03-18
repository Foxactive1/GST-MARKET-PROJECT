const PriceDashboard = {

 atualizar(){

    const dados = PriceStorage.obter();

    if(dados.length === 0) return;

    let total = 0;
    let count = 0;

    dados.forEach(h => {

        h.dados.forEach(p => {

            total += p.preco;
            count++;

        });

    });

    const media = (total/count).toFixed(2);

    document.getElementById("price-media").innerHTML =
      "Preço médio pesquisado: R$ " + media;

 }

}