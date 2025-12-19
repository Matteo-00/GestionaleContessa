let products = JSON.parse(localStorage.getItem('products')) || [
  'Pomodori','Mais','Pollo','Manzo','Pasta','Formaggio'
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
const toast = document.getElementById('toast');

function refreshSelects(){
  const fill = (el, list, all=true) => {
    el.innerHTML = all ? `<option value="">Tutti</option>` : ``;
    list.forEach(i => el.innerHTML += `<option>${i}</option>`);
  };

  fill(productSelect, products, false);
  fill(supplierSelect, suppliers, false);
  fill(filterProduct, products);
  fill(filterSupplier, suppliers);
}

function save(){
  localStorage.setItem('products', JSON.stringify(products));
  localStorage.setItem('suppliers', JSON.stringify(suppliers));
  localStorage.setItem('purchases', JSON.stringify(purchases));
}

function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2500);
}

newProduct.oninput = () =>
  newProduct.classList.toggle('new', newProduct.value.trim());

newSupplier.oninput = () =>
  newSupplier.classList.toggle('new', newSupplier.value.trim());

document.getElementById('savePurchase').onclick = () => {
  const np = newProduct.value.trim();
  const ns = newSupplier.value.trim();

  if(np && !products.includes(np)) products.push(np);
  if(ns && !suppliers.includes(ns)) suppliers.push(ns);

  purchases.push({
    date: purchaseDate.value,
    product: np || productSelect.value,
    supplier: ns || supplierSelect.value,
    price: parseFloat(price.value)
  });

  save();
  refreshSelects();
  render();

  newProduct.value = '';
  newSupplier.value = '';
  price.value = '';
  description.value = '';
  newProduct.classList.remove('new');
  newSupplier.classList.remove('new');

  showToast();
};

function render(){
  tableBody.innerHTML = '';

  let data = purchases
    .filter(p =>
      (!filterProduct.value || p.product === filterProduct.value) &&
      (!filterSupplier.value || p.supplier === filterSupplier.value) &&
      (!dateFrom.value || p.date >= dateFrom.value) &&
      (!dateTo.value || p.date <= dateTo.value)
    );

  if(priceOrder.value === 'asc') data.sort((a,b)=>a.price-b.price);
  if(priceOrder.value === 'desc') data.sort((a,b)=>b.price-a.price);

  data.forEach(p => {
    tableBody.innerHTML += `
      <tr>
        <td>${p.date}</td>
        <td>${p.product}</td>
        <td>${p.supplier}</td>
        <td>€ ${p.price.toFixed(2)}</td>
      </tr>`;
  });
}

document.querySelectorAll('select,input').forEach(e =>
  e.addEventListener('change', render)
);

refreshSelects();
render();
