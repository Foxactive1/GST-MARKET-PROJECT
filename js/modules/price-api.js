const PriceAPI = {

 async buscarProduto(produto){

   const url = `https://dummyjson.com/products/search?q=${produto}`;

   try{

      const response = await fetch(url);

      const data = await response.json();

      return data.products.map(p => ({

          nome: p.title,
          preco: p.price,
          loja: "Marketplace"

      }));

   }catch(e){

      console.error("Erro API", e);

      return [];

   }

 }

}