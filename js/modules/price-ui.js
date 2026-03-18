const PriceUI = {

 renderTabela(produto, dados){

   let html = `
   <h4>Comparação de preços: ${produto}</h4>

   <table class="table table-bordered">
   <thead>
   <tr>
      <th>Produto</th>
      <th>Loja</th>
      <th>Preço</th>
   </tr>
   </thead>
   <tbody>
   `;

   dados.forEach(p => {

      html += `
      <tr>
        <td>${p.nome}</td>
        <td>${p.loja}</td>
        <td>R$ ${p.preco}</td>
      </tr>
      `;

   });

   html += "</tbody></table>";

   document.getElementById("price-results").innerHTML = html;

 }

}