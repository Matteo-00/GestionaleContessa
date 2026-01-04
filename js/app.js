let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];

/* NAV */
const navButtons = document.querySelectorAll('nav button');
const indicator = document.querySelector('.indicator');

function updateIndicatorFor(btn){
  // posiziona e scala l'indicatore in base al bottone attivo
  const navRect = btn.parentElement.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  const offset = btnRect.left - navRect.left;
  indicator.style.width = `${btnRect.width}px`;
  indicator.style.transform = `translateX(${offset}px)`;
// --- Ricerca prodotto in tempo reale ---
const searchProduct = document.getElementById('searchProduct');
const searchResults = document.getElementById('searchResults');
const productDetails = document.getElementById('productDetails');

function renderProductSearchResults(query) {
  searchResults.innerHTML = '';
  productDetails.style.display = 'none';
  productDetails.innerHTML = '';
  if (!query) return;
  const filtered = products.filter(p => p.toLowerCase().includes(query.toLowerCase()));
  if (filtered.length === 0) {
    searchResults.innerHTML = '<li style="color:var(--muted);">Nessun prodotto trovato</li>';
    return;
  }
  filtered.forEach(prod => {
    const li = document.createElement('li');
    li.textContent = prod;
    li.onclick = () => {
      // Seleziona il prodotto nei campi sottostanti
      productSelect.value = prod;
      searchProduct.value = prod;
      searchResults.innerHTML = '';
      productSelect.scrollIntoView({behavior:'smooth', block:'center'});

            // Mostra dettagli prodotto in dialog come tabella
            let acquisti = purchases.filter(x => x.product === prod);
            const dialog = document.getElementById('productDialog');
            const dialogContent = document.getElementById('productDialogContent');
            if (acquisti.length > 0) {
              // Filtro/ordinamento UI avanzato
              let filterUI = `<div style="display:flex;gap:1.2em;align-items:center;justify-content:flex-start;margin-bottom:1.1em;flex-wrap:wrap;">
                  <button class="filterBtn" id="sortRecent">Ultimo acquisto</button>
                  <button class="filterBtn" id="sortSupplierAZ">Fornitore A-Z</button>
                  <button class="filterBtn" id="sortSupplierZA">Fornitore Z-A</button>
                  <button class="filterBtn" id="sortPriceLow">Prezzo più basso</button>
                  <button class="filterBtn" id="sortPriceHigh">Prezzo più alto</button>
                </div>`;
              function renderTable(acqList) {
                let table = `<table style="margin:0 auto 0 auto;font-size:1rem;min-width:520px;max-width:99%;box-shadow:0 4px 24px #2f7d6530,0 1.5px 8px #eab30812;border-radius:16px;overflow:hidden;background:#fff;border-collapse:separate;border-spacing:0;border:2.5px solid #2f7d65;">
                  <thead style='background:linear-gradient(90deg,#eafaf3 60%,#fffbe7 100%);'>
                    <tr>
                      <th style='padding:0.7em 1.2em;text-align:left;font-size:1.05em;'>Prodotto</th>
                      <th style='padding:0.7em 1.2em;text-align:left;font-size:1.05em;'>Fornitore</th>
                      <th style='padding:0.7em 1.2em;text-align:left;font-size:1.05em;'>Prezzo</th>
                      <th style='padding:0.7em 1.2em;text-align:left;font-size:1.05em;'>Data</th>
                      <th style='padding:0.7em 1.2em;text-align:center;font-size:1.05em;'>Azioni</th>
                    </tr>
                  </thead><tbody>`;
                acqList.forEach((acq, idx) => {
                  table += `<tr style="border-bottom:1.5px solid #eafaf3;">
                    <td style='padding:0.6em 1.2em;'>${acq.product}</td>
                    <td style='padding:0.6em 1.2em;'>${acq.supplier}</td>
                    <td style='padding:0.6em 1.2em;'>€ ${acq.price.toFixed(2)}</td>
                    <td style='padding:0.6em 1.2em;'>${acq.date}</td>
                    <td style='padding:0.6em 1.2em;text-align:center;'><button class="primary gotoArchiveBtn" data-idx="${idx}" style="padding:0.4em 0.9em;font-size:0.95em;">Vedi in archivio</button></td>
                  </tr>`;
                });
                table += '</tbody></table>';
                return table;
              }
              // Stato filtri
              let filterState = {
                sortRecent: false,
                sortSupplierAZ: false,
                sortSupplierZA: false,
                sortPriceLow: false,
                sortPriceHigh: false
              };

              function applyFilters() {
                let filtered = [...acquisti];
                // Ultimo acquisto
                if (filterState.sortRecent) {
                  if (filtered.length > 0) {
                    let maxDate = filtered.reduce((max, x) => x.date > max ? x.date : max, filtered[0].date);
                    filtered = filtered.filter(x => x.date === maxDate);
                  }
                }
                // Fornitore A-Z
                if (filterState.sortSupplierAZ) {
                  filtered.sort((a, b) => a.supplier.localeCompare(b.supplier));
                }
                // Fornitore Z-A
                if (filterState.sortSupplierZA) {
                  filtered.sort((a, b) => b.supplier.localeCompare(a.supplier));
                }
                // Prezzo più basso
                if (filterState.sortPriceLow) {
                  filtered.sort((a, b) => a.price - b.price);
                }
                // Prezzo più alto
                if (filterState.sortPriceHigh) {
                  filtered.sort((a, b) => b.price - a.price);
                }
                dialogContent.innerHTML = filterUI + renderTable(filtered);
                setTimeout(setupFilterEvents, 10);
                setTimeout(setupArchiveBtns, 10);
              }

              function updateFilterBtnStyles() {
                Object.keys(filterState).forEach(key => {
                  const btn = dialogContent.querySelector(`#${key}`);
                  if (btn) {
                    if (filterState[key]) {
                      btn.style.background = 'linear-gradient(90deg,#ffe066 60%,#fffbe7 100%)';
                      btn.style.color = '#2f7d65';
                      btn.style.borderColor = '#eab308';
                    } else {
                      btn.style.background = '#f7f7f9';
                      btn.style.color = '#222';
                      btn.style.borderColor = '#2f7d65';
                    }
                  }
                });
              }

              function setupFilterEvents() {
                // Ultimo acquisto
                dialogContent.querySelector('#sortRecent').onclick = () => {
                  filterState.sortRecent = !filterState.sortRecent;
                  applyFilters();
                  updateFilterBtnStyles();
                };
                // Fornitore A-Z
                dialogContent.querySelector('#sortSupplierAZ').onclick = () => {
                  if (!filterState.sortSupplierAZ) {
                    filterState.sortSupplierAZ = true;
                    filterState.sortSupplierZA = false;
                  } else {
                    filterState.sortSupplierAZ = false;
                  }
                  applyFilters();
                  updateFilterBtnStyles();
                };
                // Fornitore Z-A
                dialogContent.querySelector('#sortSupplierZA').onclick = () => {
                  if (!filterState.sortSupplierZA) {
                    filterState.sortSupplierZA = true;
                    filterState.sortSupplierAZ = false;
                  } else {
                    filterState.sortSupplierZA = false;
                  }
                  applyFilters();
                  updateFilterBtnStyles();
                };
                // Prezzo più basso
                dialogContent.querySelector('#sortPriceLow').onclick = () => {
                  if (!filterState.sortPriceLow) {
                    filterState.sortPriceLow = true;
                    filterState.sortPriceHigh = false;
                  } else {
                    filterState.sortPriceLow = false;
                  }
                  applyFilters();
                  updateFilterBtnStyles();
                };
                // Prezzo più alto
                dialogContent.querySelector('#sortPriceHigh').onclick = () => {
                  if (!filterState.sortPriceHigh) {
                    filterState.sortPriceHigh = true;
                    filterState.sortPriceLow = false;
                  } else {
                    filterState.sortPriceHigh = false;
                  }
                  applyFilters();
                  updateFilterBtnStyles();
                };
                updateFilterBtnStyles();
              }

              function setupArchiveBtns() {
                dialogContent.querySelectorAll('.gotoArchiveBtn').forEach(btn => {
                  btn.onclick = () => {
                    const acq = acquisti[btn.getAttribute('data-idx')];
                    dialog.close();
                    document.querySelector('nav button[data-page="archive"]').click();
                    filterProduct.value = acq.product;
                    renderArchive(acq.product);
                    setTimeout(() => {
                      const rows = archiveTable.querySelectorAll('tr');
                      rows.forEach(row => {
                        if (
                          row.children[1] && row.children[1].textContent === acq.product &&
                          row.children[2] && row.children[2].textContent === acq.supplier &&
                          row.children[3] && row.children[3].textContent.replace('€ ','') === acq.price.toFixed(2)
                        ) {
                          row.style.background = 'linear-gradient(90deg,#ffe066 60%,#fffbe7 100%)';
                          row.scrollIntoView({behavior:'smooth', block:'center'});
                        } else {
                          row.style.background = '';
                        }
                      });
                    }, 100);
                  };
                });
              }

              applyFilters();
            } else {
              dialogContent.innerHTML = '<div style="margin:1.2rem 0;color:var(--muted);">Nessun acquisto registrato per questo prodotto.</div>';
              dialog.showModal();
            }
    };
    searchResults.appendChild(li);
  });
// Gestione chiusura dialog prodotto
const productDialog = document.getElementById('productDialog');
const closeProductDialog = document.getElementById('closeProductDialog');
if (productDialog && closeProductDialog) {
  closeProductDialog.onclick = () => productDialog.close();
  productDialog.addEventListener('click', (e) => {
    if (e.target === productDialog) productDialog.close();
  });
}
}

if (searchProduct) {
  searchProduct.addEventListener('input', e => {
    renderProductSearchResults(e.target.value);
  });
  // Nascondi risultati se si clicca fuori
  document.addEventListener('click', e => {
    if (!searchProduct.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.innerHTML = '';
    }
  });
}
}

navButtons.forEach((btn,i)=>{
  btn.onclick=()=>{
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    navButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    updateIndicatorFor(btn);
    renderArchive();
    renderStats();
  };
});

// initialize indicator on load
window.addEventListener('load',()=>{
  const active = document.querySelector('nav button.active') || navButtons[0];
  if(active) updateIndicatorFor(active);
});
window.addEventListener('resize',()=>{
  const active = document.querySelector('nav button.active') || navButtons[0];
  if(active) updateIndicatorFor(active);
});

/* SELECTS */
function refreshSelects(){
  const fill=(el,list)=>{
    el.innerHTML='<option value="">Tutti</option>';
    list.forEach(x=>el.innerHTML+=`<option>${x}</option>`);
  };
  fill(productSelect,products);
  fill(supplierSelect,suppliers);
  fill(filterProduct,products);
  fill(filterSupplier,suppliers);
  fill(statsProduct,products);
  fill(statsSupplier,suppliers);
}

/* SAVE */
savePurchase.onclick=()=>{
  const p=newProduct.value||productSelect.value;
  const s=newSupplier.value||supplierSelect.value;
  const d=description.value;
  if(!p||!s||!price.value||!purchaseDate.value)return;

  if(!products.includes(p))products.push(p);
  if(!suppliers.includes(s))suppliers.push(s);

  purchases.push({product:p,supplier:s,price:+price.value,date:purchaseDate.value,description:d});
  localStorage.setItem('purchases',JSON.stringify(purchases));
  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));

  newProduct.value=newSupplier.value=price.value=description.value='';
  purchaseDate.value='';
  showToast();
  refreshSelects();
  renderArchive();
  renderStats();
};

/* ARCHIVIO + PAGINAZIONE */
let currentPage=1, perPage=20;

function renderArchive(){
  let data=[...purchases];

  if(filterProduct.value)data=data.filter(x=>x.product===filterProduct.value);
  if(filterSupplier.value)data=data.filter(x=>x.supplier===filterSupplier.value);

  if(filterPriceMode.value==='exact'&&filterPriceExact.value)
    data=data.filter(x=>x.price==filterPriceExact.value);
  if(filterPriceMode.value==='asc')data.sort((a,b)=>a.price-b.price);
  if(filterPriceMode.value==='desc')data.sort((a,b)=>b.price-a.price);

  if(filterDateMode.value==='recent')data.sort((a,b)=>b.date.localeCompare(a.date));
  if(filterDateMode.value==='old')data.sort((a,b)=>a.date.localeCompare(b.date));
  if(filterDateMode.value==='range')
    data=data.filter(x=>x.date>=dateFrom.value&&x.date<=dateTo.value);

  const pages=Math.max(1,Math.ceil(data.length/perPage));
  currentPage=Math.min(Math.max(currentPage,1),pages);

  const start=(currentPage-1)*perPage;
  const slice=data.slice(start,start+perPage);

  archiveTable.innerHTML='';
  slice.forEach(x=>{
    archiveTable.innerHTML+=`
      <tr>
        <td>${x.date}</td>
        <td>${x.product}</td>
        <td>${x.supplier}</td>
        <td>${x.price.toFixed(2)}</td>
        <td>${x.description ? x.description : ''}</td>
      </tr>`;
  });

  pageInfo.textContent=`Pagina ${currentPage} / ${pages}`;
}

prevPage.onclick=()=>{ currentPage=Math.max(1,currentPage-1); renderArchive(); }
nextPage.onclick=()=>{ 
  // calcola tot pagine in base ai filtri correnti
  let data=[...purchases];
  if(filterProduct.value)data=data.filter(x=>x.product===filterProduct.value);
  if(filterSupplier.value)data=data.filter(x=>x.supplier===filterSupplier.value);
  if(filterPriceMode.value==='exact'&&filterPriceExact.value)
    data=data.filter(x=>x.price==filterPriceExact.value);
  if(filterDateMode.value==='range')
    data=data.filter(x=>x.date>=dateFrom.value&&x.date<=dateTo.value);
  const pages=Math.max(1,Math.ceil(data.length/perPage));
  currentPage=Math.min(pages,currentPage+1);
  renderArchive();
}

/* STATISTICHE */
let chart;
function renderStats(){
  const map={};
  purchases.forEach(p=>{
    if(statsProduct.value&&p.product!==statsProduct.value)return;
    if(statsSupplier.value&&p.supplier!==statsSupplier.value)return;
    const m=p.date.slice(0,7);
    map[m]=(map[m]||0)+p.price;
  });

  const labels=Object.keys(map).sort();
  const values=labels.map(l=>map[l]);

  if(chart)chart.destroy();
  chart=new Chart(statsChart,{
    type:'bar',
    data:{
      labels,
      datasets:[{
        label:'Spesa mensile (€)',
        data:values,
        backgroundColor:'#2f7d65'
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        y:{beginAtZero:true}
      }
    }
  });
}

/* EXPORT */
exportExcel.onclick=()=>{
  const ws=XLSX.utils.json_to_sheet(purchases);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Acquisti');
  XLSX.writeFile(wb,'acquisti.xlsx');
};
exportPDF.onclick=()=>window.print();

function showToast(){
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2000);
}

/* UI dinamica */
filterPriceMode.onchange=()=>filterPriceExact.classList.toggle('hidden',filterPriceMode.value!=='exact');
filterDateMode.onchange=()=>dateRange.classList.toggle('hidden',filterDateMode.value!=='range');

document.querySelectorAll('select,input').forEach(e=>e.addEventListener('change',()=>{
  renderArchive();
  renderStats();
}));

refreshSelects();
renderArchive();
renderStats();
