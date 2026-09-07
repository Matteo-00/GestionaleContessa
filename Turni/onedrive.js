// ===================================
// ONEDRIVE.JS - Compilazione automatica file Excel su OneDrive
// alla pubblicazione dei turni (Microsoft Graph + MSAL.js)
// ===================================

// --- CONFIGURAZIONE (da completare) ---------------------------------------
// 1) CLIENT_ID: crealo su https://portal.azure.com -> Microsoft Entra ID ->
//    "Registrazioni app" -> "Nuova registrazione".
//      - Tipi di account supportati: "Account personali Microsoft" (o
//        "Account in qualsiasi directory organizzativa e account Microsoft
//        personali" se un domani volete usarlo anche con account aziendali).
//      - Piattaforma: "Applicazione a pagina singola (SPA)".
//      - URI di reindirizzamento: l'URL dove gira l'app, es.
//        https://tuosito.it/Turni/index.html (deve combaciare esattamente).
//      - In "Autorizzazioni API" aggiungi Microsoft Graph -> Delegate ->
//        Files.ReadWrite (consenso utente, non serve admin consent).
//    Copia il "ID applicazione (client)" e incollalo qui sotto.
// 2) FILE_PATH: percorso del file .xlsx dentro OneDrive (root personale),
//    es. "/Turni/PianoTurni.xlsx" (lo stesso che vedi nell'URL di OneDrive
//    senza il dominio, a partire dalla cartella).
// 3) SHEET_NAME: nome del foglio Excel da compilare (es. "Foglio1").
// 4) CELL_MAP: dimmi quali celle compilare e te lo aggiorno subito.
const OD_CONFIG = {
  CLIENT_ID: 'INSERISCI_QUI_CLIENT_ID',
  AUTHORITY: 'https://login.microsoftonline.com/consumers', // account personali
  REDIRECT_URI: window.location.origin + window.location.pathname,
  SCOPES: ['Files.ReadWrite'],
  FILE_PATH: '/Turni/PianoTurni.xlsx',
  SHEET_NAME: 'Foglio1'
};

let _msalInstance = null;

function _getMsalInstance() {
  if (_msalInstance) return _msalInstance;
  _msalInstance = new msal.PublicClientApplication({
    auth: {
      clientId: OD_CONFIG.CLIENT_ID,
      authority: OD_CONFIG.AUTHORITY,
      redirectUri: OD_CONFIG.REDIRECT_URI
    },
    cache: { cacheLocation: 'localStorage' }
  });
  return _msalInstance;
}

// Ottiene un access token Graph, chiedendo il login solo se necessario
async function _getGraphToken() {
  const msalApp = _getMsalInstance();
  await msalApp.initialize();

  const accounts = msalApp.getAllAccounts();
  const request = { scopes: OD_CONFIG.SCOPES };

  if (accounts.length > 0) {
    request.account = accounts[0];
    try {
      const result = await msalApp.acquireTokenSilent(request);
      return result.accessToken;
    } catch (e) {
      // token scaduto/non disponibile: richiedi login interattivo
    }
  }

  const result = await msalApp.loginPopup(request);
  return result.accessToken;
}

// Scrive un blocco di valori in un range di celle (es. address: 'A2:B5')
async function _scriviRangeExcel(token, address, values) {
  const encodedPath = encodeURIComponent(OD_CONFIG.FILE_PATH);
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:${OD_CONFIG.FILE_PATH}:` +
              `/workbook/worksheets('${encodeURIComponent(OD_CONFIG.SHEET_NAME)}')` +
              `/range(address='${address}')`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Errore scrittura Excel (${res.status}): ${err}`);
  }
}

// ---------------------------------------------------------------------------
// PUNTO DI INGRESSO: chiamata quando la settimana viene pubblicata.
// Al momento non sappiamo ANCORA quali celle compilare: appena mi mostri il
// file mi limito a riempire CELL_MAP e la funzione sotto con gli indirizzi
// giusti (es. giorno X -> cella B3, nome cameriere -> C3, ecc.).
// ---------------------------------------------------------------------------
async function compilaFileOneDriveAllaPubblicazione(settimana) {
  if (!OD_CONFIG.CLIENT_ID || OD_CONFIG.CLIENT_ID === 'INSERISCI_QUI_CLIENT_ID') {
    console.warn('[OneDrive] CLIENT_ID non configurato: salto la compilazione del file.');
    return;
  }

  try {
    const token = await _getGraphToken();
    const turni = await DB.getTurni(settimana.settimana);

    // TODO: sostituire con la scrittura reale non appena definita la mappatura celle.
    // Esempio placeholder (da rimuovere): scrive il numero totale di turni in A1.
    // await _scriviRangeExcel(token, 'A1', [[turni.length]]);

    showToast('Turni pubblicati (file OneDrive: mappatura celle da configurare)', 'info');
  } catch (err) {
    console.error('[OneDrive] Errore compilazione file:', err);
    showToast('Turni pubblicati, ma errore aggiornamento file OneDrive: ' + err.message, 'error');
  }
}





// PS:
// //Ho preparato l'integrazione, ma prima di poterla far funzionare mi servono alcune cose da te.

// Cosa ho fatto
// Creato onedrive.js: usa Microsoft Graph + MSAL.js per fare login con il tuo account Microsoft personale e scrivere celle in un file Excel su OneDrive.
// Agganciato la chiamata in manager.js:269 dentro cambiaStato(): quando lo stato passa a pubblicata, viene invocata compilaFileOneDriveAllaPubblicazione(updated).
// Aggiunto lo script MSAL.js e il nuovo file in index.html:27.
// La logica di scrittura (_scriviRangeExcel) è pronta, ma non scrive ancora nulla finché non mi dai la mappatura delle celle — per ora mostra solo un toast informativo.
// Cosa mi serve da te
// Registrare un'app su Azure (gratis, 5 minuti) per ottenere un "Client ID":

// Vai su portal.azure.com → cerca "Microsoft Entra ID" → "Registrazioni app" → "Nuova registrazione"
// Nome: es. "Gestionale Contessa Turni"
// Tipi di account supportati: "Account Microsoft personali"
// Piattaforma: "Applicazione a pagina singola (SPA)", URI di reindirizzamento = l'URL esatto dove gira l'app (es. https://tuosito.it/Turni/index.html)
// Dopo la creazione vai su "Autorizzazioni API" → "Aggiungi un'autorizzazione" → Microsoft Graph → Delegate → cerca Files.ReadWrite
// Copiami l'"ID applicazione (client)" mostrato nella pagina Overview
// Il percorso del file su OneDrive (es. /Turni/PianoTurni.xlsx)

// Il nome del foglio Excel da compilare (es. "Foglio1")

// Mostrami il file (screenshot o descrizione) con le celle esatte da compilare (es. "colonna B = nome cameriere, riga 3 = lunedì mattina, ecc.") — appena me lo mostri completo CELL_MAP e la funzione di scrittura.

// Se preferisci, posso anche procedere senza aspettare tutto: dammi anche solo il Client ID e il percorso file, e intanto testiamo che il login funzioni prima di definire le celle.