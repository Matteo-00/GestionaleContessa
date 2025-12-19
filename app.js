let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];
let purchases = JSON.parse(localStorage.getItem('purchases')) || [];

btnNew.onclick = ()=>switchView('new');
btnArchive.onclick = ()=>switchView('archive');

function switchView(v){
  sectionNew.classList.toggle('hidden',v!=='new');
  sectionArchive.classList.toggle('hidden',v!=='archive');
  btnNew.classList.toggle('active',v==='new');
  btnArchive.classList.toggle('active',v==='archive');
  renderArchive();
}

/* SELECT */
function refreshSelects(){
  productSelect.innerHTML='<option value="">Seleziona prodotto</option>';
  supplierSelect.innerHTML='<option value="">Seleziona fornitore</option>';
  filterProduct.innerHTML='<option value="">Tutti i prodotti</option>';
  filterSupplier.innerHTML='<option value="">Tutti i fornitori</option>';

  products.forEach(p=>{
    productSelect.innerHTML+=`<option>${p}</option>`;
    filterProduct.innerHTML+=`<option>${p}</option>`;
  });

  suppliers.forEach(s=>{
    supplierSelect.innerHTML+=`<option>${s}</option>`;
    filterSupplier.innerHTML+=`<option>${s}</option>`;
  });
}

/* SAVE */
savePurchase.onclick=()=>{
  const p=newProduct.value||productSelect.value;
  const s=newSupplier.value||supplierSelect.value;

  if(p&&!products.includes(p))products.push(p);
  if(s&&!suppliers.includes(s))suppliers.push(s);

  purchases.push({
    date:purchaseDate.value,
    product:p,
    supplier:s,
    price:+price.value
  });

  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));
  localStorage.setItem('purchases',JSON.stringify(purchases));

  newProduct.value=newSupplier.value=price.value='';
  refreshSelects();
  showToast();
};

/* ARCHIVIO + FILTRI */
function renderArchive(){
  let data=[...purchases];

  if(filterProduct.value)
    data=data.filter(x=>x.product===filterProduct.value);

  if(filterSupplier.value)
    data=data.filter(x=>x.supplier===filterSupplier.value);

  if(filterPrice.value)
    data=data.filter(x=>x.price==filterPrice.value);

  if(filterDate.value)
    data=data.filter(x=>x.date===filterDate.value);

  if(filterOrder.value==='priceAsc')
    data.sort((a,b)=>a.price-b.price);
  if(filterOrder.value==='priceDesc')
    data.sort((a,b)=>b.price-a.price);
  if(filterOrder.value==='dateAsc')
    data.sort((a,b)=>a.date.localeCompare(b.date));
  if(filterOrder.value==='dateDesc')
    data.sort((a,b)=>b.date.localeCompare(a.date));

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

  highlightFilters();
}

/* FILTRI ATTIVI */
function highlightFilters(){
  [filterProduct,filterSupplier,filterPrice,filterDate,filterOrder]
    .forEach(f=>f.classList.toggle('filter-active',f.value));
}

/* EXPORT EXCEL VERO */
exportExcel.onclick=()=>{
  const ws=XLSX.utils.json_to_sheet(purchases);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Acquisti');
  XLSX.writeFile(wb,'archivio_acquisti.xlsx');
};

exportPDF.onclick=()=>window.print();

[filterProduct,filterSupplier,filterPrice,filterDate,filterOrder]
  .forEach(f=>f.addEventListener('change',renderArchive));

function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

refreshSelects();
renderArchive();
