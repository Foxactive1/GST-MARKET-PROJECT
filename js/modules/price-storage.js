const priceDB = {

db:null,

async init(){

return new Promise((resolve,reject)=>{

let request = indexedDB.open("price-intelligence",1);

request.onupgradeneeded = e => {

let db = e.target.result;

db.createObjectStore("prices",{
keyPath:"id",
autoIncrement:true
});

};

request.onsuccess = e => {

this.db = e.target.result;
resolve();

};

request.onerror = reject;

});

},

salvar(produto,preco,loja){

let tx = this.db.transaction("prices","readwrite");

let store = tx.objectStore("prices");

store.add({
produto,
preco,
loja,
data:new Date().toISOString()
});

},

listar(callback){

let tx = this.db.transaction("prices","readonly");

let store = tx.objectStore("prices");

let request = store.getAll();

request.onsuccess = ()=> callback(request.result);

}

};