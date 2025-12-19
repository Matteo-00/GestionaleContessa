let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
let purchases = JSON.parse(localStorage.getItem('purchases')) || [];

// ELEMENTS
const sectionNew = document.getElementById('sectionNew');
const sectionArchive = document.getElementById('sectionArchive');
const btnNew = document.getElementById('btnNew');
const btnArchive = document.getElementById('btnArchive');
const toast = document.getElementById('toast');

// NAVIGATION
btnNew.onclick = () => toggleView('new');
btnArchive.onclick = () => toggleView('archive');

function toggleView(view){
  sectionNew.classList.toggle('hidden', view !== 'new');
  sectionArchive.classList.toggle('hidden', view !== 'archive');
  btnNew.classList.toggle('active', view === 'new');
  btnArchive.classList.toggle('active', view === 'archive');
  renderArchive();
}

// SELECTS
function refreshSelects(){
  productSelect.innerHTML = '<option value=\"\">Seleziona prodotto</option>';
  supplierSelect.innerHTML = '<option value=\"\">Seleziona fornitore</option>';
  products.forEach(p => productSelect.innerHTML += `<option>${p}</option>`);
  suppliers.forEach(s => supplierSelect.innerHTML += `<option>${s}</option>`);
}

// UX new fields
newProduct.oninput = () => newProduct.classList.toggle('new', newProduct.value);
newSupplier.oninput = () => newSupplier.classList.toggle('new', newSupplier.value);

// SAVE PURCHASE
savePurchase.onclick = () => {
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

  localStorage.setItem('products', JSON.stringify(products));
  localStorage.setItem('suppliers', JSON.stringify(suppliers));
  localStorage.setItem('purchases', JSON.stringify(purchases));

  newProduct.value = '';
  newSupplier.value = '';
  price.value = '';
  description.value = '';
  newProduct.classList.remove('new');
  newSupplier.classList.remove('new');

  showToast();
  refreshSelects();
};

// ARCHIVE RENDER
function renderArchive(){
  archiveTable.innerHTML = '';
  let data = [...purchases];

  if(fromDate.value) data = data.filter(p => p.date >= fromDate.value);
  if(toDate.value) data = data.filter(p => p.date <= toDate.value);

  if(priceOrder.value === 'asc') data.sort((a,b)=>a.price-b.price);
  if(priceOrder.value === 'desc') data.sort((a,b)=>b.price-a.price);

  data.forEach(p => {
    archiveTable.innerHTML += `
      <tr>
        <td>${p.date}</td>
        <td>${p.product}</td>
        <td>${p.supplier}</td>
        <td>€ ${p.price.toFixed(2)}</td>
      </tr>`;
  });
}

// EXPORT
exportExcel.onclick = () => {
  let csv = 'Data,Prodotto,Fornitore,Prezzo\n';
  purchases.forEach(p => csv += `${p.date},${p.product},${p.supplier},${p.price}\n`);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'archivio_acquisti.csv';
  a.click();
};

exportPDF.onclick = () => window.print();

// FILTER EVENTS
[fromDate, toDate, priceOrder].forEach(el =>
  el.addEventListener('change', renderArchive)
);

// TOAST
function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

// INIT
refreshSelects();
renderArchive();
