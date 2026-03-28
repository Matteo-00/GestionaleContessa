// ===================================
// AI ANALYZER CON GEMINI API
// ===================================
// La chiave API viene caricata da config.js (GEMINI_API_KEY)
// Assicurati che config.js sia caricato PRIMA di questo file nell'HTML
// const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_API_URL = 'https://zlyikcrrwjxmvoigqpdi.functions.supabase.co/gemini';

// Rate limiting
let lastAPICallTime = 0;
let isAnalyzing = false; // Flag per evitare chiamate multiple
const MIN_CALL_INTERVAL = 60000; // 60 secondi tra le chiamate (1 minuto)
const MAX_RETRIES = 1; // Solo 1 retry per evitare spam
const INITIAL_RETRY_DELAY = 2000; // 2 secondi (per errori di rete)
const RATE_LIMIT_RETRY_DELAY = 60000; // 60 secondi per 429

// Inizializza i listener per l'analisi AI
function initAIAnalyzer() {
  const analyzeBtn = document.getElementById('analyzeWithAI');
  const statsProduct = document.getElementById('statsProduct');
  const statsSupplier = document.getElementById('statsSupplier');
  
  // Abilita/disabilita il pulsante in base alla selezione del prodotto
  const updateAnalyzeButton = () => {
    analyzeBtn.disabled = !statsProduct.value;
  };
  
  // Esponi la funzione globalmente per poterla chiamare da app.js
  window.updateAnalyzeButton = updateAnalyzeButton;
  
  statsProduct.addEventListener('change', updateAnalyzeButton);
  statsSupplier.addEventListener('change', updateAnalyzeButton);
  
  // Click sul pulsante di analisi
  analyzeBtn.addEventListener('click', async (event) => {
    const selectedProduct = statsProduct.value;
    const selectedSupplier = statsSupplier.value;
    
    if (!selectedProduct) {
      alert('Seleziona prima un prodotto da analizzare');
      return;
    }
    
    // Previeni chiamate multiple simultanee
    if (isAnalyzing) {
      alert('⏳ Analisi già in corso... attendi il completamento');
      return;
    }
    
    // Controlla cooldown SOLO se non è un click automatico dall'archivio
    const now = Date.now();
    const timeSinceLastCall = now - lastAPICallTime;
    const isAutoClick = event.isTrusted === false || window.selectedRecordId; // Click automatico o da archivio
    
    if (!isAutoClick && timeSinceLastCall < MIN_CALL_INTERVAL) {
      const waitTime = Math.ceil((MIN_CALL_INTERVAL - timeSinceLastCall) / 1000);
      alert(`⏳ Attendi ${waitTime} secondi prima di fare un'altra analisi (rate limiting API - max 1 al minuto)`);
      return;
    }
    
    // Disabilita il pulsante durante l'analisi
    analyzeBtn.disabled = true;
    isAnalyzing = true;
    const originalText = analyzeBtn.innerHTML;
    
    try {
      await analyzeWithGemini(selectedProduct, selectedSupplier);
    } finally {
      isAnalyzing = false;
      
      // Riabilita dopo il cooldown
      setTimeout(() => {
        analyzeBtn.disabled = !statsProduct.value;
        analyzeBtn.innerHTML = originalText;
      }, MIN_CALL_INTERVAL);
      
      // Mostra countdown
      let countdown = Math.ceil(MIN_CALL_INTERVAL / 1000);
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          analyzeBtn.innerHTML = `⏳ Attendi ${countdown}s`;
        } else {
          clearInterval(countdownInterval);
        }
      }, 1000);
    }
  });
}

// Funzione principale per l'analisi con Gemini
async function analyzeWithGemini(productName, supplierFilter = '') {
  console.log('🚀 INIZIO ANALISI AI');
  console.log('📦 Prodotto:', productName);
  console.log('🏭 Fornitore filtro:', supplierFilter || 'Nessun filtro');
  
  const aiLoading = document.getElementById('aiLoading');
  const aiResults = document.getElementById('aiResults');
  
  // Mostra loading
  aiLoading.style.display = 'block';
  aiResults.style.display = 'none';
  
  try {
    // Filtra gli acquisti per il prodotto selezionato
    let filteredPurchases = purchases.filter(p => p.product === productName);
    console.log('📊 Acquisti trovati:', filteredPurchases.length);
    
    // Filtra per fornitore se selezionato
    if (supplierFilter) {
      filteredPurchases = filteredPurchases.filter(p => p.supplier === supplierFilter);
    }
    
    if (filteredPurchases.length === 0) {
      aiResults.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--muted);">
          <p>Nessun acquisto trovato per "${productName}"</p>
        </div>
      `;
      aiLoading.style.display = 'none';
      aiResults.style.display = 'block';
      return;
    }
    
    // Costruisci il prompt con tutti i dati
    const prompt = buildAnalysisPrompt(productName, filteredPurchases);
    console.log('📝 Prompt costruito:', prompt.substring(0, 200) + '...');
    console.log('📏 Lunghezza prompt:', prompt.length, 'caratteri');
    
    // Chiama l'API di Gemini con retry
    console.log('🌐 Chiamata API Gemini in corso...');
    const geminiResponse = await callGeminiWithRetry(prompt);
    console.log('✅ Risposta ricevuta da Gemini');
    console.log('📄 Risposta completa:', geminiResponse);
    
    // Aggiorna il timestamp dell'ultima chiamata
    lastAPICallTime = Date.now();
    
    // Mostra i risultati
    console.log('🎨 Visualizzazione risultati...');
    displayAIResults(geminiResponse, productName, filteredPurchases);
    console.log('✅ Analisi completata con successo!');
    
  } catch (error) {
    console.error('❌ ERRORE nell\'analisi AI:');
    console.error('   - Tipo:', error.name);
    console.error('   - Messaggio:', error.message);
    console.error('   - Stack:', error.stack);
    
    let errorMessage = error.message;
    let errorTitle = '❌ Errore nell\'analisi';
    
    // Messaggi personalizzati per errori comuni
    if (error.message.includes('429')) {
      errorTitle = '⏳ Troppe richieste (429)';
      errorMessage = 'Hai superato il limite di chiamate API di Gemini. ATTENDI ALMENO 2-3 MINUTI e riprova. L\'API ha limiti molto restrittivi.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      errorTitle = '🔒 Errore di autenticazione';
      errorMessage = 'La chiave API non è valida o è scaduta. Controlla la configurazione.';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorTitle = '🌐 Errore di connessione';
      errorMessage = 'Impossibile connettersi all\'API di Gemini. Controlla la tua connessione internet.';
    }
    
    aiResults.innerHTML = `
      <div style="text-align:center;padding:2rem;color:#dc2626;">
        <h3>${errorTitle}</h3>
        <p>${errorMessage}</p>
        <details style="margin-top:1rem;text-align:left;">
          <summary style="cursor:pointer;color:var(--muted);">Dettagli tecnici</summary>
          <pre style="padding:1rem;background:var(--card-subtle);border-radius:6px;margin-top:0.5rem;font-size:0.85rem;overflow:auto;">${error.message}\n\n${error.stack || ''}</pre>
        </details>
      </div>
    `;
    aiResults.style.display = 'block';
  } finally {
    aiLoading.style.display = 'none';
  }
}

// Funzione per chiamare Gemini con retry e backoff esponenziale
async function callGeminiWithRetry(prompt, retryCount = 0) {
  console.log(`🔄 Tentativo API Supabase #${retryCount + 1}`);
  try {
    const requestBody = { prompt };
    console.log('\n\n📤 ========================================');
    console.log('📤 REQUEST PER SUPABASE EDGE FUNCTION');
    console.log('📤 ========================================');
    console.log('📤 URL:', GEMINI_API_URL);
    console.log('📤 Method: POST');
    console.log('📤 Headers:', JSON.stringify({ 'Content-Type': 'application/json' }, null, 2));
    console.log('\n📤 BODY:');
    console.log(JSON.stringify(requestBody, null, 2));
    console.log('📤 ========================================\n');
    console.log('\n📝 PROMPT INVIATO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(prompt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response ok:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('📦 Dati JSON ricevuti:', JSON.stringify(data, null, 2));
      // Adatta qui in base a come risponde la tua Edge Function
      // Se la risposta è { result: "..." }
     if (!data || typeof data.text !== 'string') {
  throw new Error('Risposta non valida dalla funzione Supabase');
}

return data.text;

      return geminiResponse;
    }

    if (response.status === 429) {
      console.error('❌ 429 TOO MANY REQUESTS - API quota superata!');
      throw new Error('Rate limit superato (429). Attendi 1-2 minuti e riprova.');
    }

    // Prova a leggere il messaggio di errore dal body
    let errorMsg = `Errore API: ${response.status}`;
    try {
      const errData = await response.json();
      errorMsg += ' - ' + (errData.error || JSON.stringify(errData));
      if (errData.details) {
        errorMsg += '\nDettagli Gemini: ' + JSON.stringify(errData.details);
        console.error('Dettagli errore Gemini:', errData.details);
      }
    } catch {}
    throw new Error(errorMsg);
  } catch (error) {
    if (error.message.includes('fetch') && retryCount < MAX_RETRIES) {
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`Errore di rete. Retry ${retryCount + 1}/${MAX_RETRIES} tra ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return callGeminiWithRetry(prompt, retryCount + 1);
    }
    throw error;
  }
}

// Costruisce il prompt per Gemini con tutti i dati degli acquisti
function buildAnalysisPrompt(productName, purchases) {
  // Converti i dati in formato leggibile
  const purchasesData = purchases.map((p, index) => {
    const qualityText = getQualityText(p.rating || 0);
    return `
Record ${index + 1}:
- ID: ${p.id}
- Prodotto: ${p.product}
- Fornitore: ${p.supplier}
- Prezzo cadauno: €${p.price.toFixed(2)} per ${p.unit || 'kg'}
- Quantità acquistata: ${p.quantity || 'N/D'} ${p.unit || 'kg'}
- Qualità: ${qualityText} (${p.rating || 0}/5 stelle)
- Data acquisto: ${p.date}
- Note: ${p.description || 'Nessuna nota'}
    `.trim();
  }).join('\n\n');
  
  const prompt = `
Sei un assistente AI esperto in analisi di acquisti e gestione fornitori per ristoranti.

Ho raccolto tutti gli acquisti del prodotto "${productName}" e voglio che mi aiuti a decidere da quale fornitore conviene comprare.

Ecco tutti gli acquisti registrati (${purchases.length} record):

${purchasesData}

COMPITO:
Analizza TUTTI questi record considerando:
1. **Prezzo cadauno** (il prezzo è già per kg, litro o pezzo - NON dividere per quantità)
2. **Qualità del prodotto** (valutazione in stelle)
3. **Rapporto qualità-prezzo**
4. **Affidabilità del fornitore** (frequenza acquisti, consistenza qualità)
5. **Descrizione/Note** che possono indicare caratteristiche speciali

FORMATO RISPOSTA RICHIESTO:
Fornisci la risposta in questo formato ESATTO:

=== SOMMARIO ===
[Breve analisi generale (2-3 frasi) sul confronto tra i fornitori]

=== TOP 5 RACCOMANDAZIONI ===
1. ID: [id] | Fornitore: [nome] | Prezzo: €[prezzo] | Qualità: [stelle/5] | Motivo: [breve spiegazione]
2. ID: [id] | Fornitore: [nome] | Prezzo: €[prezzo] | Qualità: [stelle/5] | Motivo: [breve spiegazione]
3. ID: [id] | Fornitore: [nome] | Prezzo: €[prezzo] | Qualità: [stelle/5] | Motivo: [breve spiegazione]
4. ID: [id] | Fornitore: [nome] | Prezzo: €[prezzo] | Qualità: [stelle/5] | Motivo: [breve spiegazione]
5. ID: [id] | Fornitore: [nome] | Prezzo: €[prezzo] | Qualità: [stelle/5] | Motivo: [breve spiegazione]

IMPORTANTE: 
- Ordina la TOP 5 dal MIGLIOR rapporto qualità-prezzo al peggiore
- Considera che qualità alta con prezzo leggermente superiore può essere preferibile a qualità bassa con prezzo basso
- Se ci sono meno di 5 record, fornisci solo quelli disponibili
- Sii conciso nelle motivazioni (max 15-20 parole per motivo)
`.trim();
  
  return prompt;
}

// Converte il rating numerico in testo
function getQualityText(rating) {
  if (rating >= 4.5) return 'Ottima';
  if (rating >= 3.5) return 'Buona';
  if (rating >= 2) return 'Media';
  if (rating > 0) return 'Scarsa';
  return 'Non valutata';
}

// Mostra i risultati dell'analisi AI
function displayAIResults(geminiResponse, productName, allPurchases) {
  console.log('🎨 displayAIResults chiamata');
  console.log('   - geminiResponse length:', geminiResponse?.length);
  console.log('   - productName:', productName);
  console.log('   - allPurchases:', allPurchases?.length);
  
  const aiResults = document.getElementById('aiResults');
  
  try {
    // Parse della risposta di Gemini
    console.log('🔍 Parsing risposta Gemini...');
    const { summary, recommendations } = parseGeminiResponse(geminiResponse, allPurchases);
    console.log('📊 Parsing completato:');
    console.log('   - summary:', summary);
    console.log('   - recommendations:', recommendations.length, 'trovate');
    
    // Calcola statistiche fornitori
    const supplierStats = calculateSupplierStats(allPurchases);
    
    let html = `
      <!-- Tabella prodotto analizzato -->
      <div class="analyzed-product-table">
        <div class="analyzed-product-header">
           Prodotto Analizzato
        </div>
        <div class="analyzed-product-content">
          <div class="analyzed-product-name">${productName}</div>
          <p class="analyzed-product-desc">
            Confronto effettuato su <strong>${allPurchases.length}</strong> ${allPurchases.length === 1 ? 'acquisto' : 'acquisti'} 
            registrati di "${productName}" per identificare il miglior rapporto qualità-prezzo tra i diversi fornitori.
          </p>
        </div>
      </div>
    `;
    
    // Top 5 fornitori per quantità
    if (supplierStats.length > 0) {
      html += `
        <div class="top-suppliers-table">
          <div class="top-suppliers-header">
             Top Fornitori per Quantità Acquistata
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Fornitore</th>
                <th>Quantità Totale</th>
                <th>Acquisti</th>
              </tr>
            </thead>
            <tbody>
              ${supplierStats.slice(0, 5).map((stat, index) => `
                <tr>
                  <td><span class="supplier-rank">${index + 1}</span></td>
                  <td class="supplier-name-cell">${stat.supplier}</td>
                  <td class="quantity-cell">${stat.totalQuantity.toFixed(2)} ${stat.unit}</td>
                  <td>${stat.count} ${stat.count === 1 ? 'acquisto' : 'acquisti'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    // Top 5 raccomandazioni
    if (recommendations.length > 0) {
      const selectedId = window.selectedRecordId; // ID del record selezionato dall'archivio
      
      html += `
        <div class="ai-ranking">
          <div class="ranking-header">
            🏆 Top ${recommendations.length} Migliori Acquisti
          </div>
          <table class="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fornitore</th>
                <th>Prezzo Cad.</th>
                <th>Quantità</th>
                <th>Qualità</th>
                <th>Data</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${recommendations.map((rec, index) => {
                const isSelected = selectedId && rec.id === selectedId;
                const rowClass = isSelected ? ' class="selected-record"' : '';
                return `
                <tr${rowClass}>
                  <td>
                    <span class="rank-badge rank-${index < 3 ? index + 1 : 'other'}">
                      ${index + 1}
                    </span>
                  </td>
                  <td class="supplier-cell">${rec.supplier}${isSelected ? ' <span class="selected-badge">✓ Selezionato</span>' : ''}</td>
                  <td class="price-cell">€${rec.price.toFixed(2)}</td>
                  <td>${rec.quantity ? rec.quantity.toFixed(2) : 'N/D'} ${rec.unit || ''}</td>
                  <td>
                    <span class="quality-badge quality-${getQualityClass(rec.rating)}">
                      ${getQualityText(rec.rating)} (${rec.rating}/5)
                    </span>
                  </td>
                  <td class="date-cell">${rec.date}</td>
                  <td>${rec.reason}</td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      html += `
        <div style="text-align:center;padding:2rem;color:var(--muted);">
          <p>⚠️ Non sono riuscito ad estrarre le raccomandazioni dalla risposta</p>
          <details>
            <summary style="cursor:pointer;color:var(--primary);">Mostra risposta completa</summary>
            <pre style="text-align:left;padding:1rem;background:var(--card-subtle);border-radius:6px;margin-top:1rem;white-space:pre-wrap;">${geminiResponse}</pre>
          </details>
        </div>
      `;
    }
    
    aiResults.innerHTML = html;
    aiResults.style.display = 'block';
    
  } catch (error) {
    console.error('Errore nel parsing della risposta:', error);
    aiResults.innerHTML = `
      <div class="ai-summary">
        <h3>Risposta Completa</h3>
        <pre style="white-space:pre-wrap;font-size:0.9rem;line-height:1.6;">${geminiResponse}</pre>
      </div>
    `;
    aiResults.style.display = 'block';
  }
}

// Calcola le statistiche dei fornitori per quantità acquistata
function calculateSupplierStats(purchases) {
  const stats = {};
  
  purchases.forEach(p => {
    if (!stats[p.supplier]) {
      stats[p.supplier] = {
        supplier: p.supplier,
        totalQuantity: 0,
        count: 0,
        unit: p.unit || 'kg'
      };
    }
    stats[p.supplier].totalQuantity += parseFloat(p.quantity || 0);
    stats[p.supplier].count++;
  });
  
  // Converti in array e ordina per quantità totale decrescente
  return Object.values(stats)
    .sort((a, b) => b.totalQuantity - a.totalQuantity);
}


// Parse della risposta di Gemini per estrarre sommario e raccomandazioni
function parseGeminiResponse(response, allPurchases) {
  const lines = response.split('\n').map(l => l.trim()).filter(l => l);
  
  let summary = '';
  const recommendations = [];
  let inSummary = false;
  let inRecommendations = false;
  
  for (const line of lines) {
    // Cerca il sommario
    if (line.includes('=== SOMMARIO ===') || line.includes('SOMMARIO')) {
      inSummary = true;
      inRecommendations = false;
      continue;
    }
    
    // Cerca le raccomandazioni
    if (line.includes('=== TOP') || line.includes('RACCOMANDAZIONI') || line.includes('TOP 5')) {
      inSummary = false;
      inRecommendations = true;
      continue;
    }
    
    // Raccoglie il sommario
    if (inSummary && !line.includes('===')) {
      summary += line + ' ';
    }
    
    // Raccoglie le raccomandazioni
    if (inRecommendations) {
      // Pattern: 1. ID: xxx | Fornitore: xxx | ...
      const match = line.match(/^\d+\.\s*ID:\s*(\d+)\s*\|\s*Fornitore:\s*([^|]+)\s*\|\s*Prezzo:\s*€?([\d.]+)\s*\|\s*Qualità:\s*([\d.]+)\/5\s*\|\s*Motivo:\s*(.+)$/i);
      
      if (match) {
        const [, id, supplier, price, quality, reason] = match;
        
        // Trova il record originale
        const purchase = allPurchases.find(p => p.id == id);
        
        if (purchase) {
          recommendations.push({
            id: purchase.id,
            supplier: supplier.trim(),
            price: parseFloat(price),
            quantity: purchase.quantity,
            unit: purchase.unit,
            rating: parseFloat(quality),
            date: purchase.date,
            reason: reason.trim()
          });
        }
      }
    }
  }
  
  // Se non ha trovato raccomandazioni nel formato atteso, prova un parsing alternativo
  if (recommendations.length === 0) {
    // Cerca pattern più semplici tipo "1. Fornitore X"
    for (const line of lines) {
      const simpleMatch = line.match(/^\d+\.\s*(.+)/);
      if (simpleMatch && inRecommendations) {
        // Estrae informazioni dal testo libero
        const text = simpleMatch[1];
        
        // Cerca fornitore nei nostri dati
        for (const purchase of allPurchases) {
          if (text.toLowerCase().includes(purchase.supplier.toLowerCase())) {
            recommendations.push({
              id: purchase.id,
              supplier: purchase.supplier,
              price: purchase.price,
              quantity: purchase.quantity,
              unit: purchase.unit,
              rating: purchase.rating || 0,
              date: purchase.date,
              reason: text
            });
            break;
          }
        }
      }
    }
  }
  
  return {
    summary: summary.trim() || 'Analisi completata. Di seguito le raccomandazioni.',
    recommendations: recommendations.slice(0, 5) // Max 5
  };
}

// Converte il rating in classe CSS
function getQualityClass(rating) {
  if (rating >= 4.5) return 'ottima';
  if (rating >= 3.5) return 'buona';
  if (rating >= 2) return 'media';
  return 'scarsa';
}

// Inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAIAnalyzer);
} else {
  initAIAnalyzer();
}

// ===============================
// TEST: Chiamata a Supabase Edge Function Gemini
// ===============================

window.testSupabaseGemini = async function() {
  const endpoint = 'https://zlyikcrrwjxmvoigqpdi.functions.supabase.co/gemini';
  const payload = { prompt: 'Ciao Gemini! Questa è una chiamata di test dalla funzione Supabase.' };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('Risposta Supabase Gemini:', data);
    alert('Risposta Supabase Gemini: ' + JSON.stringify(data));
  } catch (err) {
    console.error('Errore chiamata Supabase Gemini:', err);
    alert('Errore chiamata Supabase Gemini: ' + err.message);
  }
};
// Usa dalla console: testSupabaseGemini();
