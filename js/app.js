let purchases = JSON.parse(localStorage.getItem('purchases')) || [];
let products = JSON.parse(localStorage.getItem('products')) || [];
let suppliers = JSON.parse(localStorage.getItem('suppliers')) || [];

/* NAV */
const navButtons = document.querySelectorAll('nav button');

navButtons.forEach((btn,i)=>{
  btn.onclick=()=>{
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+btn.dataset.page).classList.add('active');
    navButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderArchive();
    renderStats();
  };
});

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
      // Vai alla pagina archivio
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-archive').classList.add('active');
      navButtons.forEach(b=>b.classList.remove('active'));
      document.querySelector('nav button[data-page="archive"]').classList.add('active');
      
      // Filtra per il prodotto selezionato
      filterProduct.value = prod;
      
      // Pulisci la ricerca
      searchProduct.value = '';
      searchResults.innerHTML = '';
      
      // Renderizza l'archivio con il filtro
      currentPage = 1; // Reset alla prima pagina
      renderArchive();
      
      // Scroll verso l'alto dell'archivio
      document.getElementById('page-archive').scrollIntoView({behavior:'smooth', block:'start'});
    };
    searchResults.appendChild(li);
  });
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

/* SELECTS */
const productSelect = document.getElementById('productSelect');
const supplierSelect = document.getElementById('supplierSelect');
const filterProduct = document.getElementById('filterProduct');
const filterSupplier = document.getElementById('filterSupplier');
const statsProduct = document.getElementById('statsProduct');
const statsSupplier = document.getElementById('statsSupplier');
const savePurchase = document.getElementById('savePurchase');
const newProduct = document.getElementById('newProduct');
const newSupplier = document.getElementById('newSupplier');
const price = document.getElementById('price');
const quantity = document.getElementById('quantity');
const unit = document.getElementById('unit');
const purchaseDate = document.getElementById('purchaseDate');
const description = document.getElementById('description');
const archiveTable = document.getElementById('archiveTable');
const filterPriceMode = document.getElementById('filterPriceMode');
const filterPriceExact = document.getElementById('filterPriceExact');
const filterDateMode = document.getElementById('filterDateMode');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const pageInfo = document.getElementById('pageInfo');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');

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
  const q=quantity.value||0;
  const u=unit.value;
  
  if(!p||!s||!price.value||!purchaseDate.value){
    alert('Compila tutti i campi obbligatori: Prodotto, Fornitore, Prezzo e Data');
    return;
  }

  if(!products.includes(p))products.push(p);
  if(!suppliers.includes(s))suppliers.push(s);

  const newPurchase = {
    product:p,
    supplier:s,
    price:+price.value,
    quantity:+q,
    unit:u,
    date:purchaseDate.value,
    description:d
  };
  
  purchases.push(newPurchase);
  
  localStorage.setItem('purchases',JSON.stringify(purchases));
  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));

  newProduct.value=newSupplier.value=price.value=quantity.value=description.value='';
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
  slice.forEach((x,idx)=>{
    const pricePerUnit = x.quantity > 0 ? (x.price / x.quantity).toFixed(2) : x.price.toFixed(2);
    archiveTable.innerHTML+=`
      <tr>
        <td>${x.date}</td>
        <td>${x.product}</td>
        <td>${x.supplier}</td>
        <td>€ ${x.price.toFixed(2)}</td>
        <td>${x.quantity || '-'}</td>
        <td>${x.unit || '-'}</td>
        <td>${x.description || ''}</td>
        <td><button class="view-stats-btn" data-product="${x.product}" style="padding:0.4rem 0.8rem;font-size:0.8rem;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;">Statistiche</button></td>
      </tr>`;
  });
  
  // Aggiungi event listener per i bottoni statistiche
  document.querySelectorAll('.view-stats-btn').forEach(btn => {
    btn.onclick = () => {
      const productName = btn.dataset.product;
      // Vai alla pagina statistiche
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-stats').classList.add('active');
      navButtons.forEach(b=>b.classList.remove('active'));
      document.querySelector('nav button[data-page="stats"]').classList.add('active');
      // Filtra per il prodotto
      statsProduct.value = productName;
      renderStats();
    };
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
  const statsInfo = document.getElementById('statsInfo');
  
  // Filtra gli acquisti
  let filteredPurchases = purchases.filter(p => {
    if(statsProduct.value && p.product !== statsProduct.value) return false;
    if(statsSupplier.value && p.supplier !== statsSupplier.value) return false;
    return true;
  });

  // Calcola statistiche dettagliate
  if(statsProduct.value && filteredPurchases.length > 0) {
    const withQuantity = filteredPurchases.filter(p => p.quantity && p.quantity > 0);
    
    let infoHTML = `<h3 style="margin:0 0 0.8rem 0;font-size:0.95rem;color:var(--primary);">Statistiche: ${statsProduct.value}</h3>`;
    infoHTML += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">`;
    
    // Miglior prezzo al kg/litro/pezzo
    if(withQuantity.length > 0) {
      const pricePerUnit = withQuantity.map(p => ({
        unitPrice: p.price / p.quantity,
        unit: p.unit,
        supplier: p.supplier,
        date: p.date,
        price: p.price,
        quantity: p.quantity
      }));
      
      // Raggruppa per unità
      const byUnit = {};
      pricePerUnit.forEach(p => {
        if(!byUnit[p.unit]) byUnit[p.unit] = [];
        byUnit[p.unit].push(p);
      });
      
      Object.keys(byUnit).forEach(unit => {
        const prices = byUnit[unit];
        const best = prices.reduce((min, p) => p.unitPrice < min.unitPrice ? p : min);
        const avg = prices.reduce((sum, p) => sum + p.unitPrice, 0) / prices.length;
        
        infoHTML += `
          <div style="background:white;padding:0.8rem;border-radius:6px;border:1px solid var(--border);">
            <div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem;font-weight:600;">Miglior Prezzo al ${unit}</div>
            <div style="font-size:1.3rem;font-weight:600;color:var(--primary);margin-bottom:0.3rem;">€ ${best.unitPrice.toFixed(2)}/${unit}</div>
            <div style="font-size:0.8rem;color:var(--muted);">
              <div>${best.supplier} - ${best.date}</div>
              <div style="margin-top:0.3rem;">Media: € ${avg.toFixed(2)}/${unit}</div>
            </div>
          </div>
        `;
      });
    }
    
    // Totale speso
    const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.price, 0);
    infoHTML += `
      <div style="background:white;padding:0.8rem;border-radius:6px;border:1px solid var(--border);">
        <div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem;font-weight:600;">Totale Speso</div>
        <div style="font-size:1.3rem;font-weight:600;color:var(--primary);margin-bottom:0.3rem;">€ ${totalSpent.toFixed(2)}</div>
        <div style="font-size:0.8rem;color:var(--muted);">in ${filteredPurchases.length} acquisti</div>
      </div>
    `;
    
    // Prezzo medio
    const avgPrice = totalSpent / filteredPurchases.length;
    infoHTML += `
      <div style="background:white;padding:0.8rem;border-radius:6px;border:1px solid var(--border);">
        <div style="font-size:0.75rem;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem;font-weight:600;">Prezzo Medio</div>
        <div style="font-size:1.3rem;font-weight:600;color:var(--primary);margin-bottom:0.3rem;">€ ${avgPrice.toFixed(2)}</div>
        <div style="font-size:0.8rem;color:var(--muted);">per acquisto</div>
      </div>
    `;
    
    infoHTML += `</div>`;
    statsInfo.innerHTML = infoHTML;
    statsInfo.style.display = 'block';
  } else {
    statsInfo.style.display = 'none';
  }

  // Grafico mensile
  const map={};
  filteredPurchases.forEach(p=>{
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
const toast = document.getElementById('toast');
const exportExcel = document.getElementById('exportExcel');
const exportPDF = document.getElementById('exportPDF');
const dateRange = document.getElementById('dateRange');
const priceLabel = document.getElementById('priceLabel');

// Aggiorna label prezzo quando cambia l'unità
unit.onchange = () => {
  const unitText = unit.value === 'kg' ? 'al kg' : unit.value === 'litri' ? 'al litro' : 'al pezzo';
  priceLabel.textContent = `Prezzo (€ ${unitText})`;
};

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

// Listener per filtri statistiche
statsProduct.onchange = () => renderStats();
statsSupplier.onchange = () => renderStats();

// Listener per filtri archivio
filterProduct.onchange = () => renderArchive();
filterSupplier.onchange = () => renderArchive();
filterPriceMode.onchange = () => { 
  filterPriceExact.classList.toggle('hidden',filterPriceMode.value!=='exact'); 
  renderArchive(); 
};
filterPriceExact.onchange = () => renderArchive();
filterDateMode.onchange = () => { 
  dateRange.classList.toggle('hidden',filterDateMode.value!=='range'); 
  renderArchive(); 
};
dateFrom.onchange = () => renderArchive();
dateTo.onchange = () => renderArchive();

// Inizializzazione al caricamento
refreshSelects();
renderArchive();
renderStats();
