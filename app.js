let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
let purchases = JSON.parse(localStorage.getItem('purchases')) || [];

/* ELEMENTI */
const sectionNew = document.getElementById('sectionNew');
const sectionArchive = document.getElementById('sectionArchive');
const btnNew = document.getElementById('btnNew');
const btnArchive = document.getElementById('btnArchive');
const toast = document.getElementById('toast');

/* NAV */
btnNew.onclick = () => switchView('new');
btnArchive.onclick = () => switchView('archive');

function switchView(view){
  sectionNew.classList.toggle('hidden', view !== 'new');
  sectionArchive.classList.toggle('hidden', view !== 'archive');
  btnNew.classList.toggle('active', view === 'new');
  btnArchive.classList.toggle('active', view === 'archive');
  renderArchive();
}

/* SELECT DINAMICI */
function refreshSelects(){
  productSelect.innerHTML = '<option value="">Seleziona prodotto</option>';
  supplierSelect.innerHTML = '<option value="">Seleziona fornitore</option>';
  filterProduct.innerHTML = '<option value="">Tutti i prodotti</option>';
  filterSupplier.innerHTML = '<option value="">Tutti i fornitori</option>';

  products.forEach(p=>{
    productSelect.innerHTML += `<option>${p}</option>`;
    filterProduct.innerHTML += `<option>${p}</option>`;
  });

  suppliers.forEach(s=>{
    supplierSelect.innerHTML += `<option>${s}</option>`;
    filterSupplier.innerHTML += `<option>${s}</option>`;
  });
}

/* UX nuovi campi */
newProduct.oninput = () => newProduct.classList.toggle('new', newProduct.value);
newSupplier.oninput = () => newSupplier.classList.toggle('new', newSupplier.value);

/* SALVATAGGIO */
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

  refreshSelects();
  showToast();
};

/* ARCHIVIO + FILTRI */
function renderArchive(){
  archiveTable.innerHTML = '';
  let data = [...purchases];

  if(filterProduct.value)
    data = data.filter(p => p.product === filterProduct.value);

  if(filterSupplier.value)
    data = data.filter(p => p.supplier === filterSupplier.value);

  if(filterPrice.value)
    data = data.filter(p => p.price == filterPrice.value);

  if(fromDate.value)
    data = data.filter(p => p.date >= fromDate.value);

  if(toDate.value)
    data = data.filter(p => p.date <= toDate.value);

  data.forEach(p=>{
    archiveTable.innerHTML += `
      <tr>
        <td>${p.date}</td>
        <td>${p.product}</td>
        <td>${p.supplier}</td>
        <td>€ ${p.price.toFixed(2)}</td>
      </tr>`;
  });

  highlightFilters();
}

/* EVIDENZIA FILTRI ATTIVI */
function highlightFilters(){
  [filterProduct, filterSupplier, filterPrice, fromDate, toDate].forEach(el=>{
    el.classList.toggle('filter-active', el.value);
  });
}

/* EXPORT */
exportExcel.onclick = () => {
  let csv = 'Data,Prodotto,Fornitore,Prezzo\n';
  purchases.forEach(p=>{
    csv += `${p.date},${p.product},${p.supplier},${p.price}\n`;
  });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
  a.download = 'archivio_acquisti.csv';
  a.click();
};

exportPDF.onclick = () => window.print();

/* EVENTI FILTRI */
[filterProduct, filterSupplier, filterPrice, fromDate, toDate]
  .forEach(el => el.addEventListener('change', renderArchive));

/* TOAST */
function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

/* INIT */
refreshSelects();
renderArchive();
