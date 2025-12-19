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
  if(!p||!s||!price.value||!purchaseDate.value)return;

  if(!products.includes(p))products.push(p);
  if(!suppliers.includes(s))suppliers.push(s);

  purchases.push({product:p,supplier:s,price:+price.value,date:purchaseDate.value});
  localStorage.setItem('purchases',JSON.stringify(purchases));
  localStorage.setItem('products',JSON.stringify(products));
  localStorage.setItem('suppliers',JSON.stringify(suppliers));

  newProduct.value=newSupplier.value=price.value='';
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
