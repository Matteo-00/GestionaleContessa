let purchases = [];
let products = [];
let suppliers = [];

// Carica i dati da Supabase all'avvio
async function loadData() {
  purchases = await db.getAllPurchases();
  products = await db.getAllProducts();
  suppliers = await db.getAllSuppliers();
  refreshSelects();
  renderArchive();
  renderStats();
  renderSpendingTrends(); // Inizializza la pillola andamento spese
  updateInfoBadges(); // Inizializza i badge informativi
}

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

// ===============================
// SCANSIONE FATTURA: Upload e AI OCR
// ===============================
const scanInvoiceBtn = document.getElementById('scanInvoiceBtn');
if (scanInvoiceBtn) {
  // Crea input file nascosto
  let fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  scanInvoiceBtn.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = fileInput.files[0];
    if (!file) return;
    scanInvoiceBtn.disabled = true;
    scanInvoiceBtn.innerHTML = 'Estrazione in corso...';
    try {
      // 1. Leggi l'immagine come base64
      const base64 = await toBase64(file);
      // 2. Estrai dati con AI OCR (Gemini Vision via Supabase Edge Function)
      const ocrResult = await estraiDatiFatturaConAI(base64);
      if (!ocrResult || !ocrResult.product) throw new Error('Dati non riconosciuti. Riprova con una foto più chiara.');
      // 3. Aggiungi prodotto
      await aggiungiProdottoDaFattura(ocrResult);
      alert('Prodotto aggiunto automaticamente!');
      // Aggiorna dati
      products = await db.getAllProducts();
      suppliers = await db.getAllSuppliers();
      purchases = await db.getAllPurchases();
      refreshSelects();
      renderArchive();
      renderStats();
    } catch (err) {
      alert('Errore durante la scansione: ' + err.message);
    } finally {
      scanInvoiceBtn.disabled = false;
      scanInvoiceBtn.innerHTML = '<span class="ia-btn-icon">📷</span> Scansiona';
    }
  });

// Funzione: invia immagine a funzione AI OCR (Gemini Vision via Supabase Edge Function)
async function estraiDatiFatturaConAI(base64img) {
  // Endpoint Supabase Edge Function (da creare: /fattura-ocr)
  const endpoint = 'https://zlyikcrrwjxmvoigqpdi.functions.supabase.co/fattura-ocr';
  // Prompt per Gemini Vision: chiedi estrazione dati fattura
  const prompt = `Estrai i seguenti dati dalla foto di una fattura di acquisto per ristorante:\n- Nome prodotto\n- Nome fornitore\n- Prezzo unitario\n- Quantità\n- Unità di misura\n- Data acquisto\n- Note (se presenti)\nRispondi in JSON con queste chiavi: product, supplier, price, quantity, unit, date, description.`;
  const body = {
    image: base64img,
    prompt
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Errore OCR AI');
  // Si aspetta un oggetto { product, supplier, price, quantity, unit, date, description }
  return data;
}

// Funzione: aggiungi prodotto estratto da fattura
async function aggiungiProdottoDaFattura(dati) {
  // Adatta i dati per il db
  const nuovo = {
    product: dati.product,
    supplier: dati.supplier,
    price: parseFloat(dati.price) || 0,
    quantity: parseFloat(dati.quantity) || 0,
    unit: dati.unit || 'kg',
    date: dati.date || new Date().toISOString().slice(0,10),
    description: dati.description || '',
    rating: 0
  };
  await db.addPurchase(nuovo);
}
}

// Helper: file -> base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
const searchProduct = document.getElementById('searchProduct');
const searchResults = document.getElementById('searchResults');
const productDetails = document.getElementById('productDetails');
const spendingTrendsPill = document.getElementById('spendingTrendsPill');
const statsBadgesRow = document.querySelector('.stats-badges-row');

function renderProductSearchResults(query) {
  searchResults.innerHTML = '';
  productDetails.style.display = 'none';
  productDetails.innerHTML = '';
  
  // Oscura la pillola andamento spese E i badge durante la ricerca
  if (query && query.length > 0) {
    spendingTrendsPill.classList.add('dimmed');
    if (statsBadgesRow) statsBadgesRow.classList.add('dimmed');
  } else {
    spendingTrendsPill.classList.remove('dimmed');
    if (statsBadgesRow) statsBadgesRow.classList.remove('dimmed');
  }
  
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
      
      // Pulisci la ricerca e ripristina la pillola E i badge
      searchProduct.value = '';
      searchResults.innerHTML = '';
      spendingTrendsPill.classList.remove('dimmed');
      if (statsBadgesRow) statsBadgesRow.classList.remove('dimmed');
      
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
      spendingTrendsPill.classList.remove('dimmed'); // Ripristina anche la pillola
      if (statsBadgesRow) statsBadgesRow.classList.remove('dimmed'); // Ripristina anche i badge
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
const rating = document.getElementById('rating');
const ratingStars = document.querySelectorAll('#ratingStars .star');
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

// Sistema di valutazione stelle (supporto mezze stelle)
let currentRating = 0;

function updateStars(rating, starsElements) {
  starsElements.forEach((star, index) => {
    const starValue = parseFloat(star.dataset.value);
    if (starValue <= rating) {
      star.style.color = '#d4af37'; // Oro
    } else {
      star.style.color = '#d1d5db'; // Grigio
    }
  });
}

ratingStars.forEach(star => {
  star.addEventListener('click', () => {
    const value = parseFloat(star.dataset.value);
    currentRating = value;
    rating.value = value;
    updateStars(value, ratingStars);
  });
  
  star.addEventListener('mouseenter', () => {
    const value = parseFloat(star.dataset.value);
    updateStars(value, ratingStars);
  });
});

document.getElementById('ratingStars').addEventListener('mouseleave', () => {
  updateStars(currentRating, ratingStars);
});

// Funzione per calcolare l'indicatore temporale (badge colorato con orologio)
function getTimeIndicator(lastPurchaseDate) {
  if (!lastPurchaseDate) {
    return '<span style="display:inline-block;background:#e5e7eb;color:#6b7280;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;" title="Mai acquistato">⏱️</span>';
  }
  
  const now = new Date();
  const purchaseDate = new Date(lastPurchaseDate);
  const diffTime = Math.abs(now - purchaseDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 30) {
    return '<span style="display:inline-block;background:#d1fae5;color:#065f46;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;border:1px solid #6ee7b7;" title="Acquistato ' + diffDays + ' giorni fa">🕐 ' + diffDays + 'g</span>';
  } else if (diffDays <= 90) {
    return '<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;border:1px solid #fcd34d;" title="Acquistato ' + diffDays + ' giorni fa">🕐 ' + diffDays + 'g</span>';
  } else {
    return '<span style="display:inline-block;background:#fee2e2;color:#991b1b;padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;border:1px solid #fca5a5;" title="Acquistato ' + diffDays + ' giorni fa">🕐 ' + diffDays + 'g</span>';
  }
}

// Funzione per renderizzare le stelle in modalità visualizzazione
function renderStars(rating) {
  if (!rating || rating === 0) return '<span style="color:var(--muted);font-size:0.8rem;">-</span>';
  
  let starsHTML = '';
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span style="color:#d4af37;font-size:0.9rem;">★</span>';
  }
  
  if (hasHalf) {
    starsHTML += '<span style="color:#d4af37;font-size:0.9rem;">⯨</span>';
  }
  
  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<span style="color:#d1d5db;font-size:0.9rem;">★</span>';
  }
  
  return starsHTML;
}

/* SAVE */
savePurchase.onclick = async () => {
  const p=newProduct.value||productSelect.value;
  const s=newSupplier.value||supplierSelect.value;
  const d=description.value;
  const q=quantity.value||0;
  const u=unit.value;
  const r=parseFloat(rating.value)||0;
  
  if(!p||!s||!price.value||!purchaseDate.value){
    alert('Compila tutti i campi obbligatori: Prodotto, Fornitore, Prezzo e Data');
    return;
  }

  try {
    const newPurchase = {
      product:p,
      supplier:s,
      price:+price.value,
      quantity:+q,
      unit:u,
      date:purchaseDate.value,
      description:d,
      rating:r,
      lastPurchaseDate:purchaseDate.value
    };
    
    const saved = await db.addPurchase(newPurchase);
    purchases.push(saved);
    
    // Ricarica le liste prodotti e fornitori
    products = await db.getAllProducts();
    suppliers = await db.getAllSuppliers();
    
    newProduct.value=newSupplier.value=price.value=quantity.value=description.value='';
    purchaseDate.value='';
    rating.value='0';
    currentRating=0;
    updateStars(0, ratingStars);
    showToast();
    refreshSelects();
    renderArchive();
    renderStats();
    renderSpendingTrends(); // Aggiorna la pillola andamento spese
    updateInfoBadges(); // Aggiorna i badge informativi
  } catch (error) {
    alert('Errore nel salvataggio: ' + error.message);
  }
};

/* ARCHIVIO + PAGINAZIONE */
let currentPage=1, perPage=8;

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
    const actualIndex = start + idx;
    const pricePerUnit = x.quantity > 0 ? (x.price / x.quantity).toFixed(2) : x.price.toFixed(2);
    const timeIndicator = getTimeIndicator(x.lastPurchaseDate || x.date);
    const starsDisplay = renderStars(x.rating || 0);
    
    archiveTable.innerHTML+=`
      <tr>
        <td>${timeIndicator}</td>
        <td>${x.date}</td>
        <td>${x.product}</td>
        <td>${x.supplier}</td>
        <td>€ ${x.price.toFixed(2)}</td>
        <td>${x.quantity || '-'}</td>
        <td>${x.unit || '-'}</td>
        <td>${starsDisplay}</td>
        <td>${x.description || ''}</td>
        <td style="white-space:nowrap;">
          <button class="view-stats-btn" data-product="${x.product}" data-id="${x.id}" style="padding:0.35rem 0.7rem;font-size:0.75rem;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;margin-right:0.3rem;">Statistiche</button>
          <button class="repurchase-btn" data-index="${actualIndex}" style="padding:0.35rem 0.7rem;font-size:0.75rem;background:#2f7d65;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:0.3rem;">Acquista</button>
          <button class="edit-btn" data-index="${actualIndex}" style="padding:0.35rem 0.7rem;font-size:0.75rem;background:#6b7280;color:white;border:none;border-radius:4px;cursor:pointer;margin-right:0.3rem;">Modifica</button>
          <button class="delete-btn" data-index="${actualIndex}" data-id="${x.id}" style="padding:0.35rem 0.7rem;font-size:0.75rem;background:#dc2626;color:white;border:none;border-radius:4px;cursor:pointer;">Elimina</button>
        </td>
      </tr>`;
  });
  
  // Aggiungi event listener per i bottoni statistiche
  document.querySelectorAll('.view-stats-btn').forEach(btn => {
    btn.onclick = () => {
      const productName = btn.dataset.product;
      const recordId = parseInt(btn.dataset.id);
      
      // Salva l'ID del record selezionato per evidenziarlo
      window.selectedRecordId = recordId;
      
      // Vai alla pagina statistiche
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-stats').classList.add('active');
      navButtons.forEach(b=>b.classList.remove('active'));
      document.querySelector('nav button[data-page="stats"]').classList.add('active');
      
      // Aspetta che il DOM si aggiorni prima di procedere
      setTimeout(() => {
        // Filtra per il prodotto
        statsProduct.value = productName;
        
        // IMPORTANTE: Aggiorna manualmente lo stato del bottone dopo aver impostato il valore
        if (window.updateAnalyzeButton) {
          window.updateAnalyzeButton();
        }
        
        // Aspetta un frame per assicurarsi che il select sia aggiornato
        requestAnimationFrame(() => {
          renderStats();
          
          // Trigger automatico dell'analisi AI
          setTimeout(() => {
            const analyzeBtn = document.getElementById('analyzeWithAI');
            if (analyzeBtn && !analyzeBtn.disabled) {
              console.log('🔄 Trigger automatico analisi AI per:', productName);
              // Forza il click
              analyzeBtn.click();
            } else {
              console.warn('⚠️ Bottone analisi non disponibile:', {
                exists: !!analyzeBtn,
                disabled: analyzeBtn?.disabled,
                productValue: statsProduct?.value
              });
            }
          }, 300);
        });
      }, 100);
    };
  });
  
  // Event listener per bottoni Riacquisto
  document.querySelectorAll('.repurchase-btn').forEach(btn => {
    btn.onclick = () => {
      const index = parseInt(btn.dataset.index);
      openRepurchaseDialog(purchases[index], index);
    };
  });
  
  // Event listener per bottoni Modifica
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = () => {
      const index = parseInt(btn.dataset.index);
      openEditDialog(purchases[index], index);
    };
  });

  // Event listener per bottoni Elimina
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const index = parseInt(btn.dataset.index);
      const id = btn.dataset.id;
      const purchase = purchases[index];
      
      if (confirm(`Sei sicuro di voler eliminare definitivamente "${purchase.product}"?\nQuesta operazione non può essere annullata.`)) {
        try {
          await db.deletePurchase(id);
          purchases.splice(index, 1);
          renderArchive();
          renderStats();
          alert('Prodotto eliminato con successo');
        } catch (err) {
          console.error('Errore eliminazione:', err);
          alert('Errore durante l\'eliminazione del prodotto');
        }
      }
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
let trendsChart;

// Toggle tra Analisi con AI e Statistiche (AI default)
document.addEventListener('DOMContentLoaded', () => {
  const classicTab = document.getElementById('classicStatsTab');
  const aiTab = document.getElementById('aiStatsTab');
  const classicSection = document.getElementById('classicStatsSection');
  const aiSection = document.getElementById('aiStatsSection');
  if (classicTab && aiTab && classicSection && aiSection) {
    // AI è default, quindi è già visibile
    classicTab.addEventListener('click', () => {
      classicTab.classList.add('active');
      aiTab.classList.remove('active');
      classicSection.style.display = '';
      aiSection.style.display = 'none';
      // Rigenera i grafici quando si passa alla sezione statistiche
      renderStats();
    });
    aiTab.addEventListener('click', () => {
      aiTab.classList.add('active');
      classicTab.classList.remove('active');
      aiSection.style.display = '';
      classicSection.style.display = 'none';
    });
  }
});

function renderStats() {
  // KPI Cards
  renderKPICards();
  // Grafici professionali - Tutti con lo stile del grafico home
  renderMonthlyTrendStatsChart();
  renderSupplierSpendingStatsChart();
  renderTopProductsStatsChart();
  renderOrderFrequencyStatsChart();
  // --- STATISTICHE CON AI (mantiene la logica esistente, se serve) ---
  const statsProduct = document.getElementById('statsProduct');
  if (!statsProduct) return;
}

// Nuove funzioni per KPI Cards
function renderKPICards() {
  if (!purchases.length) return;
  const totalSpent = purchases.reduce((sum,p)=>sum+(p.price*(p.quantity||1)),0);
  const uniqueSuppliers = new Set(purchases.map(p=>p.supplier)).size;
  const uniqueProducts = new Set(purchases.map(p=>p.product)).size;
  const avgPurchase = totalSpent / purchases.length;
  
  const kpiTotalSpent = document.getElementById('kpiTotalSpent');
  const kpiSuppliers = document.getElementById('kpiSuppliers');
  const kpiProducts = document.getElementById('kpiProducts');
  const kpiAvgPurchase = document.getElementById('kpiAvgPurchase');
  
  if (kpiTotalSpent) kpiTotalSpent.textContent = `€ ${totalSpent.toFixed(2)}`;
  if (kpiSuppliers) kpiSuppliers.textContent = uniqueSuppliers;
  if (kpiProducts) kpiProducts.textContent = uniqueProducts;
  if (kpiAvgPurchase) kpiAvgPurchase.textContent = `€ ${avgPurchase.toFixed(2)}`;
}

// ===== GRAFICI STATISTICHE CON STILE DEL GRAFICO HOME =====

// Grafico 1: Andamento Spese Mensili (come il grafico home)
function renderMonthlyTrendStatsChart() {
  const ctx = document.getElementById('monthlyTrendChart');
  if (!ctx) return;
  
  // Raggruppa per mese
  const monthlyData = {};
  purchases.forEach(p => {
    const monthKey = p.date.slice(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
    monthlyData[monthKey] += p.price * (p.quantity || 1);
  });
  
  const sortedMonths = Object.keys(monthlyData).sort();
  const values = sortedMonths.map(m => monthlyData[m]);
  const labels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
  });
  
  if (window.monthlyTrendStatsChart) window.monthlyTrendStatsChart.destroy();
  
  window.monthlyTrendStatsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spesa (€)',
        data: values,
        backgroundColor: 'rgba(115, 135, 142, 0.2)',
        borderColor: '#73878e',
        borderWidth: 2.5,
        pointBackgroundColor: '#73878e',
        pointBorderColor: '#5a6a71',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#8a9ba3',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return 'Spesa: €' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '€' + value.toFixed(0);
            },
            font: { size: 9 },
            color: '#64748b'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: { size: 8 },
            maxRotation: 45,
            minRotation: 45,
            color: '#64748b'
          },
          grid: { display: false }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
          const progress = animation.currentStep / animation.numSteps;
          this.canvas.style.opacity = 0.3 + (progress * 0.7);
        },
        onComplete: function() {
          this.canvas.style.opacity = 1;
        }
      },
      animations: {
        tension: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: 0,
          to: 0.4,
          loop: false
        },
        y: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: (ctx) => {
            if (ctx.type === 'data') {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          }
        }
      }
    }
  });
}

// Grafico 2: Spese per Fornitore (line chart come home)
function renderSupplierSpendingStatsChart() {
  const ctx = document.getElementById('supplierSpendingChart');
  if (!ctx) return;
  
  // Calcola spese totali per fornitore
  const supplierTotals = {};
  purchases.forEach(p => {
    if (!supplierTotals[p.supplier]) supplierTotals[p.supplier] = 0;
    supplierTotals[p.supplier] += p.price * (p.quantity || 1);
  });
  
  const sorted = Object.entries(supplierTotals).sort((a,b)=>b[1]-a[1]).slice(0, 8);
  const labels = sorted.map(x=>x[0]);
  const values = sorted.map(x=>x[1]);
  
  if (window.supplierSpendingStatsChart) window.supplierSpendingStatsChart.destroy();
  
  window.supplierSpendingStatsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spesa (€)',
        data: values,
        backgroundColor: 'rgba(115, 135, 142, 0.2)',
        borderColor: '#73878e',
        borderWidth: 2.5,
        pointBackgroundColor: '#73878e',
        pointBorderColor: '#5a6a71',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#8a9ba3',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return 'Spesa: €' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '€' + value.toFixed(0);
            },
            font: { size: 9 },
            color: '#64748b'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: { size: 8 },
            maxRotation: 45,
            minRotation: 45,
            color: '#64748b'
          },
          grid: { display: false }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
          const progress = animation.currentStep / animation.numSteps;
          this.canvas.style.opacity = 0.3 + (progress * 0.7);
        },
        onComplete: function() {
          this.canvas.style.opacity = 1;
        }
      },
      animations: {
        tension: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: 0,
          to: 0.4,
          loop: false
        },
        y: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: (ctx) => {
            if (ctx.type === 'data') {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          }
        }
      }
    }
  });
}

// Grafico 3: Top Prodotti (line chart come home)
function renderTopProductsStatsChart() {
  const ctx = document.getElementById('topProductsChart');
  if (!ctx) return;
  
  // Conta quantità acquistate per prodotto
  const productTotals = {};
  purchases.forEach(p => {
    if (!productTotals[p.product]) productTotals[p.product] = 0;
    productTotals[p.product] += p.quantity || 1;
  });
  
  const sorted = Object.entries(productTotals).sort((a,b)=>b[1]-a[1]).slice(0, 5);
  const labels = sorted.map(x=>x[0]);
  const values = sorted.map(x=>x[1]);
  
  if (window.topProductsStatsChart) window.topProductsStatsChart.destroy();
  
  window.topProductsStatsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Quantità',
        data: values,
        backgroundColor: 'rgba(115, 135, 142, 0.2)',
        borderColor: '#73878e',
        borderWidth: 2.5,
        pointBackgroundColor: '#73878e',
        pointBorderColor: '#5a6a71',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#8a9ba3',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return 'Quantità: ' + context.parsed.y.toFixed(1);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 9 },
            color: '#64748b'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: { size: 8 },
            maxRotation: 45,
            minRotation: 45,
            color: '#64748b'
          },
          grid: { display: false }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
          const progress = animation.currentStep / animation.numSteps;
          this.canvas.style.opacity = 0.3 + (progress * 0.7);
        },
        onComplete: function() {
          this.canvas.style.opacity = 1;
        }
      },
      animations: {
        tension: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: 0,
          to: 0.4,
          loop: false
        },
        y: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: (ctx) => {
            if (ctx.type === 'data') {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          }
        }
      }
    }
  });
}

// Grafico 4: Frequenza Ordini (line chart come home)
function renderOrderFrequencyStatsChart() {
  const ctx = document.getElementById('orderFrequencyChart');
  if (!ctx) return;
  
  // Calcola numero ordini per fornitore
  const supplierFreq = {};
  purchases.forEach(p => {
    supplierFreq[p.supplier] = (supplierFreq[p.supplier] || 0) + 1;
  });
  
  const sorted = Object.entries(supplierFreq).sort((a,b)=>b[1]-a[1]).slice(0, 5);
  const labels = sorted.map(x=>x[0]);
  const values = sorted.map(x=>x[1]);
  
  if (window.orderFrequencyStatsChart) window.orderFrequencyStatsChart.destroy();
  
  window.orderFrequencyStatsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Ordini',
        data: values,
        backgroundColor: 'rgba(115, 135, 142, 0.2)',
        borderColor: '#73878e',
        borderWidth: 2.5,
        pointBackgroundColor: '#73878e',
        pointBorderColor: '#5a6a71',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#8a9ba3',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return 'Ordini: ' + context.parsed.y;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: { size: 9 },
            color: '#64748b'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: { size: 8 },
            maxRotation: 45,
            minRotation: 45,
            color: '#64748b'
          },
          grid: { display: false }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
          const progress = animation.currentStep / animation.numSteps;
          this.canvas.style.opacity = 0.3 + (progress * 0.7);
        },
        onComplete: function() {
          this.canvas.style.opacity = 1;
        }
      },
      animations: {
        tension: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: 0,
          to: 0.4,
          loop: false
        },
        y: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: (ctx) => {
            if (ctx.type === 'data') {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          }
        }
      }
    }
  });
}

// ===== FINE NUOVI GRAFICI =====

// Rimuovi vecchie funzioni grafici
function renderSupplierFrequencyChart() {}

// Vecchie funzioni rimosse - ora i grafici usano lo stile unificato della home

function renderClassicStatsSummary() {
  const el = document.getElementById('classicStatsSummary');
  if (!el) return;
  // Calcola riepilogo: spesa totale, fornitore top, prodotto top, acquisto medio
  if (!purchases.length) {
    el.innerHTML = '<li>Nessun dato disponibile</li>';
    return;
  }
  const totalSpent = purchases.reduce((sum,p)=>sum+(p.price*(p.quantity||1)),0);
  const supplierTotals = {};
  const productTotals = {};
  purchases.forEach(p => {
    if (!supplierTotals[p.supplier]) supplierTotals[p.supplier] = 0;
    supplierTotals[p.supplier] += p.price * (p.quantity || 1);
    if (!productTotals[p.product]) productTotals[p.product] = 0;
    productTotals[p.product] += p.quantity || 1;
  });
  const topSupplier = Object.entries(supplierTotals).sort((a,b)=>b[1]-a[1])[0];
  const topProduct = Object.entries(productTotals).sort((a,b)=>b[1]-a[1])[0];
  const avgSpent = totalSpent / purchases.length;
  el.innerHTML = `
    <li>Spesa totale: <strong>€ ${totalSpent.toFixed(2)}</strong></li>
    <li>Fornitore top: <strong>${topSupplier ? topSupplier[0] : '-'}</strong> (€ ${topSupplier ? topSupplier[1].toFixed(2) : '0'})</li>
    <li>Prodotto più acquistato: <strong>${topProduct ? topProduct[0] : '-'}</strong> (${topProduct ? topProduct[1] : '0'} unità)</li>
    <li>Spesa media per acquisto: <strong>€ ${avgSpent.toFixed(2)}</strong></li>
  `;
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

// Inizializzazione al caricamento - aspetta che il DOM sia pronto
document.addEventListener('DOMContentLoaded', () => {
  // Event listener per il cambio periodo andamento spese
  const trendsPeriodEl = document.getElementById('trendsPeriod');
  if (trendsPeriodEl) {
    trendsPeriodEl.addEventListener('change', renderSpendingTrends);
  }
  
  loadData(); // Carica i dati da Supabase
});

// ===== PILLOLA ANDAMENTO SPESE =====
function renderSpendingTrends() {
  const periodSelect = document.getElementById('trendsPeriod');
  const periodTotalEl = document.getElementById('periodTotal');
  const trendsChartCanvas = document.getElementById('trendsChart');
  
  if (!periodSelect || !periodTotalEl || !trendsChartCanvas) {
    console.warn('Elementi andamento spese non trovati nel DOM');
    return;
  }
  
  const period = parseInt(periodSelect.value); // Ora è in giorni
  
  // Calcola la data di inizio in base al periodo selezionato
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - period);
  
  // Filtra gli acquisti nel periodo
  const filteredPurchases = purchases.filter(p => {
    const purchaseDate = new Date(p.date);
    return purchaseDate >= startDate && purchaseDate <= now;
  });
  
  // Calcola e aggiorna il totale del periodo
  const periodTotal = filteredPurchases.reduce((sum, p) => sum + (p.price * (p.quantity || 1)), 0);
  document.getElementById('periodTotal').textContent = `€ ${periodTotal.toFixed(2)}`;
  
  if (filteredPurchases.length === 0) {
    // Nessun dato, grafico vuoto
    if (trendsChart) trendsChart.destroy();
    return;
  }
  
  // Decidi se raggruppare per giorni o per mesi
  const groupByMonth = period > 60; // Se più di 60 giorni, raggruppa per mese
  
  let labels = [];
  let values = [];
  
  if (groupByMonth) {
    // Raggruppa per mese
    const monthlyData = {};
    filteredPurchases.forEach(p => {
      const monthKey = p.date.slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = 0;
      }
      monthlyData[monthKey] += p.price * (p.quantity || 1);
    });
    
    // Ordina per data
    const sortedMonths = Object.keys(monthlyData).sort();
    values = sortedMonths.map(m => monthlyData[m]);
    
    // Formatta le etichette (mese/anno)
    labels = sortedMonths.map(m => {
      const [year, month] = m.split('-');
      const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      return `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`;
    });
  } else {
    // Raggruppa per giorno
    const dailyData = {};
    filteredPurchases.forEach(p => {
      const dayKey = p.date; // YYYY-MM-DD
      if (!dailyData[dayKey]) {
        dailyData[dayKey] = 0;
      }
      dailyData[dayKey] += p.price * (p.quantity || 1);
    });
    
    // Ordina per data
    const sortedDays = Object.keys(dailyData).sort();
    values = sortedDays.map(d => dailyData[d]);
    
    // Formatta le etichette (giorno/mese)
    labels = sortedDays.map(d => {
      const [year, month, day] = d.split('-');
      return `${day}/${month}`;
    });
  }
  
  // Crea o aggiorna il grafico con stile scenografico "onde/montagne"
  if (trendsChart) trendsChart.destroy();
  
  trendsChart = new Chart(trendsChartCanvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spesa (€)',
        data: values,
        backgroundColor: 'rgba(115, 135, 142, 0.2)', // #73878e con trasparenza per riempimento
        borderColor: '#73878e', // Colore linea
        borderWidth: 2.5,
        pointBackgroundColor: '#73878e', // Colore punti
        pointBorderColor: '#5a6a71',
        pointBorderWidth: 1.5,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#8a9ba3',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(30, 58, 138, 0.95)',
          padding: 10,
          titleFont: {
            size: 12,
            weight: 'bold'
          },
          bodyFont: {
            size: 11
          },
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function(context) {
              return 'Spesa: €' + context.parsed.y.toFixed(2);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '€' + value.toFixed(0);
            },
            font: {
              size: 9
            },
            color: '#64748b'
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.04)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            font: {
              size: 8
            },
            maxRotation: 45,
            minRotation: 45,
            color: '#64748b'
          },
          grid: {
            display: false
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
        onProgress: function(animation) {
          // Effetto pulsazione durante l'animazione
          const progress = animation.currentStep / animation.numSteps;
          this.canvas.style.opacity = 0.3 + (progress * 0.7);
        },
        onComplete: function() {
          // Ripristina opacità completa alla fine
          this.canvas.style.opacity = 1;
        }
      },
      animations: {
        tension: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: 0,
          to: 0.4,
          loop: false
        },
        y: {
          duration: 1500,
          easing: 'easeInOutQuart',
          from: (ctx) => {
            if (ctx.type === 'data') {
              return ctx.chart.scales.y.getPixelForValue(0);
            }
          }
        }
      }
    }
  });
}

// Funzione per aggiornare i badge informativi
function updateInfoBadges() {
  const totalSpentEl = document.getElementById('totalSpent');
  const activeSuppliersEl = document.getElementById('activeSuppliers');
  const registeredProductsEl = document.getElementById('registeredProducts');
  
  // Verifica che gli elementi esistano nel DOM
  if (!totalSpentEl || !activeSuppliersEl || !registeredProductsEl) {
    console.warn('Badge informativi non trovati nel DOM');
    return;
  }
  
  // Spese totali
  const totalSpent = purchases.reduce((sum, p) => sum + (p.price * (p.quantity || 1)), 0);
  animateValue('totalSpent', 0, totalSpent, 1500, '€ ');
  
  // Numero fornitori attivi (sincronizzato a 1500ms)
  const uniqueSuppliers = new Set(purchases.map(p => p.supplier));
  animateValue('activeSuppliers', 0, uniqueSuppliers.size, 1500);
  
  // Numero prodotti registrati (sincronizzato a 1500ms)
  const uniqueProducts = new Set(purchases.map(p => p.product));
  animateValue('registeredProducts', 0, uniqueProducts.size, 1500);
}

// Funzione per animare i numeri da 0 al valore finale
function animateValue(elementId, start, end, duration, prefix = '') {
  const element = document.getElementById(elementId);
  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }
    
    // Formatta il valore
    if (prefix === '€ ') {
      element.textContent = prefix + current.toFixed(2);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 16);
}

// ===== GESTIONE DIALOG RIACQUISTO =====
const repurchaseDialog = document.getElementById('repurchaseDialog');
const repurchaseContent = document.getElementById('repurchaseContent');
const repurchaseQuantity = document.getElementById('repurchaseQuantity');
const repurchasePrice = document.getElementById('repurchasePrice');
const lastPriceInfo = document.getElementById('lastPriceInfo');
const saveRepurchase = document.getElementById('saveRepurchase');
const closeRepurchaseDialog = document.getElementById('closeRepurchaseDialog');

let currentRepurchaseIndex = null;

function openRepurchaseDialog(purchase, index) {
  currentRepurchaseIndex = index;
  
  repurchaseContent.innerHTML = `
    <div style="background:var(--card-subtle);padding:1rem;border-radius:6px;border-left:3px solid var(--primary);">
      <h3 style="margin:0 0 0.5rem 0;font-size:0.9rem;color:var(--primary);">Prodotto: ${purchase.product}</h3>
      <p style="margin:0;font-size:0.8rem;color:var(--muted);">Fornitore: ${purchase.supplier}</p>
      <p style="margin:0.3rem 0 0 0;font-size:0.8rem;color:var(--muted);">Unità: ${purchase.unit}</p>
    </div>
  `;
  
  lastPriceInfo.innerHTML = `Ultimo prezzo: <strong>€ ${purchase.price.toFixed(2)}</strong> (${purchase.date})`;
  repurchaseQuantity.value = purchase.quantity || '';
  repurchasePrice.value = '';
  
  repurchaseDialog.showModal();
}

saveRepurchase.onclick = async () => {
  if (!repurchaseQuantity.value || !repurchasePrice.value) {
    alert('Inserisci quantità e prezzo per il riacquisto');
    return;
  }
  
  try {
    const originalPurchase = purchases[currentRepurchaseIndex];
    const today = new Date().toISOString().split('T')[0];
    
    // SOMMA la quantità esistente con quella nuova
    const oldQuantity = parseFloat(originalPurchase.quantity) || 0;
    const newQuantity = parseFloat(repurchaseQuantity.value);
    const totalQuantity = oldQuantity + newQuantity;
    
    // AGGIORNA il record esistente invece di crearne uno nuovo
    const updatedData = {
      price: parseFloat(repurchasePrice.value),  // Nuovo prezzo
      quantity: totalQuantity,  // Quantità totale sommata
      date: today,  // Data aggiornata
      lastPurchaseDate: today
    };
    
    await db.updatePurchase(originalPurchase.id, updatedData);
    
    // Aggiorna anche l'array locale
    purchases[currentRepurchaseIndex].price = updatedData.price;
    purchases[currentRepurchaseIndex].quantity = updatedData.quantity;
    purchases[currentRepurchaseIndex].date = updatedData.date;
    purchases[currentRepurchaseIndex].lastPurchaseDate = updatedData.lastPurchaseDate;
    
    repurchaseDialog.close();
    showToast();
    renderArchive();
  } catch (error) {
    alert('Errore nel riacquisto: ' + error.message);
  }
};

closeRepurchaseDialog.onclick = () => {
  repurchaseDialog.close();
};

// ===== GESTIONE DIALOG MODIFICA =====
const editDialog = document.getElementById('editDialog');
const editProduct = document.getElementById('editProduct');
const editSupplier = document.getElementById('editSupplier');
const editPrice = document.getElementById('editPrice');
const editQuantity = document.getElementById('editQuantity');
const editUnit = document.getElementById('editUnit');
const editDate = document.getElementById('editDate');
const editDescription = document.getElementById('editDescription');
const editRating = document.getElementById('editRating');
const editRatingStars = document.querySelectorAll('#editRatingStars .edit-star');
const saveEdit = document.getElementById('saveEdit');
const closeEditDialog = document.getElementById('closeEditDialog');

let currentEditIndex = null;
let editCurrentRating = 0;

// Sistema stelle per dialog modifica
editRatingStars.forEach(star => {
  star.addEventListener('click', () => {
    const value = parseFloat(star.dataset.value);
    editCurrentRating = value;
    editRating.value = value;
    updateStars(value, editRatingStars);
  });
  
  star.addEventListener('mouseenter', () => {
    const value = parseFloat(star.dataset.value);
    updateStars(value, editRatingStars);
  });
});

document.getElementById('editRatingStars').addEventListener('mouseleave', () => {
  updateStars(editCurrentRating, editRatingStars);
});

function openEditDialog(purchase, index) {
  currentEditIndex = index;
  
  editProduct.value = purchase.product;
  editSupplier.value = purchase.supplier;
  editPrice.value = purchase.price;
  editQuantity.value = purchase.quantity || '';
  editUnit.value = purchase.unit || 'kg';
  editDate.value = purchase.date;
  editDescription.value = purchase.description || '';
  editCurrentRating = purchase.rating || 0;
  editRating.value = editCurrentRating;
  updateStars(editCurrentRating, editRatingStars);
  
  editDialog.showModal();
}

saveEdit.onclick = async () => {
  if (!editProduct.value || !editSupplier.value || !editPrice.value || !editDate.value) {
    alert('Compila tutti i campi obbligatori');
    return;
  }
  
  try {
    const purchaseToUpdate = purchases[currentEditIndex];
    
    const updatedPurchase = {
      product: editProduct.value,
      supplier: editSupplier.value,
      price: parseFloat(editPrice.value),
      quantity: parseFloat(editQuantity.value) || 0,
      unit: editUnit.value,
      date: editDate.value,
      description: editDescription.value,
      rating: parseFloat(editRating.value) || 0
    };
    
    await db.updatePurchase(purchaseToUpdate.id, updatedPurchase);
    purchases[currentEditIndex] = { ...purchaseToUpdate, ...updatedPurchase };
    
    // Ricarica le liste prodotti e fornitori
    products = await db.getAllProducts();
    suppliers = await db.getAllSuppliers();
    
    editDialog.close();
    showToast();
    refreshSelects();
    renderArchive();
    renderStats();
  } catch (error) {
    alert('Errore nell\'aggiornamento: ' + error.message);
  }
};

closeEditDialog.onclick = () => {
  editDialog.close();
};
