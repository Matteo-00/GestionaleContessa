let products = JSON.parse(localStorage.getItem('products')) || [
  'Pomodori','Mais','Pollo','Manzo','Pasta','Formaggio','Farina','Olio','Sale','Zucchero'
];

let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [
  'Giannelli','Rossi','Bianchi'
];

let purchases = JSON.parse(localStorage.getItem('purchases')) || [];

const productSelect = document.getElementById('productSelect');
const supplierSelect = document.getElementById('supplierSelect');
const filterProduct = document.getElementById('filterProduct');
const filterSupplier = document.getElementById('filterSupplier');
const tableBody = document.getElementById('tableBody');

function refreshSelects(){
  const fill = (el,list,all=true)=>{
    el.innerHTML = all ? `<option value="">Tutti</option>` : ``;
    list.forEach(i=>el.innerHTML+=`<option>${i}</option>`);
  };
  fill(productSelect,products,false);
  fill(supplierSelect,suppliers,false);
  fill(filterProduct,products);
  fill(filterSupplier,suppliers);
}

function save(){
  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));
  localStorage.setItem('purchases',JSON.stringify(purchases));
}

function addPurchase(){
  const np = newProduct.value.trim();
  const ns = newSupplier.value.trim();

  if(np && !products.includes(np)) products.push(np);
  if(ns && !suppliers.includes(ns)) suppliers.push(ns);

  const purchase = {
    date: new Date().toISOString().split('T')[0],
    product: np || productSelect.value,
    supplier: ns || supplierSelect.value,
    price: parseFloat(price.value)
  };

  purchases.push(purchase);
  save();
  refreshSelects();
  render();
}

function render(){
  tableBody.innerHTML='';
  purchases
    .filter(p=>
      (!filterProduct.value || p.product===filterProduct.value) &&
      (!filterSupplier.value || p.supplier===filterSupplier.value) &&
      (!filterDate.value || p.date===filterDate.value) &&
      (!filterPrice.value || p.price<=filterPrice.value)
    )
    .forEach(p=>{
      tableBody.innerHTML+=`
        <tr>
          <td>${p.date}</td>
          <td>${p.product}</td>
          <td>${p.supplier}</td>
          <td>€ ${p.price.toFixed(2)}</td>
        </tr>`;
    });
}

document.querySelectorAll('.filters select,.filters input')
  .forEach(e=>e.addEventListener('change',render));

refreshSelects();
render();
