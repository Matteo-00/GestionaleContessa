let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];

/* NAV */
btnNew.onclick = () => switchView('new');
btnArchive.onclick = () => switchView('archive');

function switchView(v){
  sectionNew.classList.toggle('hidden',v!=='new');
  sectionArchive.classList.toggle('hidden',v!=='archive');
  btnNew.classList.toggle('active',v==='new');
  btnArchive.classList.toggle('active',v==='archive');
  renderArchive();
}

/* SELECT DINAMICI */
function refreshSelects(){
  productSelect.innerHTML='<option value="">Prodotto</option>';
  supplierSelect.innerHTML='<option value="">Fornitore</option>';
  filterProduct.innerHTML='<option value="">Prodotto</option>';
  filterSupplier.innerHTML='<option value="">Fornitore</option>';

  products.forEach(p=>{
    productSelect.innerHTML+=`<option>${p}</option>`;
    filterProduct.innerHTML+=`<option>${p}</option>`;
  });

  suppliers.forEach(s=>{
    supplierSelect.innerHTML+=`<option>${s}</option>`;
    filterSupplier.innerHTML+=`<option>${s}</option>`;
  });
}

/* SALVA ACQUISTO */
savePurchase.onclick = ()=>{
  const product = newProduct.value || productSelect.value;
  const supplier = newSupplier.value || supplierSelect.value;

  if(!product || !supplier || !price.value || !purchaseDate.value) return;

  if(!products.includes(product)) products.push(product);
  if(!suppliers.includes(supplier)) suppliers.push(supplier);

  purchases.push({
    product,
    supplier,
    price:+price.value,
    date:purchaseDate.value
  });

  localStorage.setItem('purchases',JSON.stringify(purchases));
  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));

  newProduct.value=newSupplier.value=price.value='';
  purchaseDate.value='';
  showToast();
  refreshSelects();
};

/* UI FILTRI DINAMICI */
filterPriceMode.onchange = ()=>{
  filterPriceExact.classList.toggle('hidden',filterPriceMode.value!=='exact');
};

filterDateMode.onchange = ()=>{
  dateRange.classList.toggle('hidden',filterDateMode.value!=='range');
};

/* ARCHIVIO */
function renderArchive(){
  let data=[...purchases];

  if(filterProduct.value)
    data=data.filter(x=>x.product===filterProduct.value);

  if(filterSupplier.value)
    data=data.filter(x=>x.supplier===filterSupplier.value);

  if(filterPriceMode.value==='exact' && filterPriceExact.value)
    data=data.filter(x=>x.price==filterPriceExact.value);

  if(filterPriceMode.value==='asc')
    data.sort((a,b)=>a.price-b.price);

  if(filterPriceMode.value==='desc')
    data.sort((a,b)=>b.price-a.price);

  if(filterDateMode.value==='recent')
    data.sort((a,b)=>b.date.localeCompare(a.date));

  if(filterDateMode.value==='old')
    data.sort((a,b)=>a.date.localeCompare(b.date));

  if(filterDateMode.value==='range')
    data=data.filter(x=>x.date>=dateFrom.value && x.date<=dateTo.value);

  archiveTable.innerHTML='';
  data.forEach(x=>{
    archiveTable.innerHTML+=`
      <tr>
        <td>${x.date}</td>
        <td>${x.product}</td>
        <td>${x.supplier}</td>
        <td>${x.price.toFixed(2)}</td>
      </tr>`;
  });
}

/* EXPORT EXCEL */
exportExcel.onclick = ()=>{
  const ws = XLSX.utils.json_to_sheet(purchases);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Acquisti');
  XLSX.writeFile(wb, 'archivio_acquisti.xlsx');
};

exportPDF.onclick = ()=>window.print();

/* EVENTI */
document.querySelectorAll('select,input')
  .forEach(el=>el.addEventListener('change',renderArchive));

function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

/* INIT */
refreshSelects();
renderArchive();
