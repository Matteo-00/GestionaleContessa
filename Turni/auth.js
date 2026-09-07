// ===================================
// AUTH.JS - Gestione autenticazione
// ===================================

// Stato globale dell'applicazione
const AppState = {
  user: null,       // Supabase User
  profile: null,    // Record da tabella profiles
  settimana: null,  // Settimana mostrata di default
  settimanaAltra: null,     // L'altra settimana attiva, se corrente e successiva si sovrappongono
  settimanaAltraTipo: null, // 'corrente' | 'successiva' — cosa rappresenta settimanaAltra
};

// ===================================
// Inizializzazione app
// ===================================
async function initApp() {
  // Listener cambio stato auth
  sb.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      await onUserLogin(session.user);
    } else {
      onUserLogout();
    }
  });

  // Controlla sessione esistente
  const { data } = await sb.auth.getSession();
  if (data.session?.user) {
    await onUserLogin(data.session.user);
  } else {
    showLoginView();
  }
}

// Chiamato quando l'utente risulta autenticato
async function onUserLogin(user) {
  AppState.user = user;

  try {
    // Carica profilo
    let profile = await DB.getProfile(user.id);
    if (!profile) {
      // Profilo non trovato: può succedere se la creazione durante la
      // registrazione ha fallito. Forziamo il logout e chiediamo di
      // registrarsi di nuovo — così nome, cognome e ruolo sono corretti.
      showToast('Profilo non trovato. Registrati di nuovo.', 'error');
      await Auth.logout();
      return;
    }
    AppState.profile = profile;

    // Carica/crea settimana corrente
    await loadSettimanaCorrente(profile.ruolo);

    // Mostra dashboard in base al ruolo
    showDashboard();
  } catch (err) {
    console.error('Errore login:', err);
    showToast('Errore: ' + err.message, 'error');
    showLoginView();
  }
}

// Carica settimana corrente.
// I manager creano le sessioni manualmente — nessuna auto-creazione.
//
// Se esistono due settimane "vicine" (quella in corso e quella appena creata
// per raccogliere le nuove disponibilità), restano visibili entrambe finché
// quella vecchia non è scaduta da un giorno intero (si "elimina" il giorno
// dopo l'ultimo turno, es. lunedì se la settimana finiva la domenica).
// AppState.settimana       -> settimana mostrata di default
// AppState.settimanaAltra  -> l'altra settimana attiva (o null se non ce n'è)
// AppState.settimanaAltraTipo -> 'corrente' | 'successiva' (cosa rappresenta settimanaAltra)
async function loadSettimanaCorrente(ruolo) {
  const settimane = await DB.getUltimeSettimane(2);

  if (!settimane.length) {
    AppState.settimana = null;
    AppState.settimanaAltra = null;
    AppState.settimanaAltraTipo = null;
    return;
  }

  const [piuRecente, precedente] = settimane;

  if (!precedente) {
    AppState.settimana = piuRecente;
    AppState.settimanaAltra = null;
    AppState.settimanaAltraTipo = null;
    return;
  }

  const fineVecchia = precedente.data_fine || precedente.settimana;
  const limiteVisibilita = DateUtils.addGiorni(fineVecchia, 1); // giorno in cui la vecchia sparisce
  const oggi = DateUtils.oggi();

  if (oggi >= limiteVisibilita) {
    // La settimana precedente è scaduta: resta solo quella nuova
    AppState.settimana = piuRecente;
    AppState.settimanaAltra = null;
    AppState.settimanaAltraTipo = null;
    return;
  }

  // Le due settimane si sovrappongono: entrambe restano visibili.
  // Di default si mostra ancora la corrente, ma dalle 9:00 dell'ultimo
  // giorno (o oltre) si passa automaticamente alla successiva, dove si
  // stanno raccogliendo le disponibilità.
  const oraAttuale = new Date();
  const dopoLeNove = oggi > fineVecchia || (oggi === fineVecchia && oraAttuale.getHours() >= 9);

  if (dopoLeNove) {
    AppState.settimana = piuRecente;
    AppState.settimanaAltra = precedente;
    AppState.settimanaAltraTipo = 'corrente';
  } else {
    AppState.settimana = precedente;
    AppState.settimanaAltra = piuRecente;
    AppState.settimanaAltraTipo = 'successiva';
  }
}

// Scambia la settimana visualizzata con l'altra settimana attiva (se presente)
function swapSettimanaVista() {
  if (!AppState.settimanaAltra) return;
  const tmp = AppState.settimana;
  AppState.settimana = AppState.settimanaAltra;
  AppState.settimanaAltra = tmp;
  AppState.settimanaAltraTipo = AppState.settimanaAltraTipo === 'successiva' ? 'corrente' : 'successiva';
  showDashboard();
}

// Barra da mostrare quando ci sono due settimane attive contemporaneamente:
// indica di quale settimana è composta la vista corrente e permette di passare all'altra.
function renderMultiSettimanaBar() {
  if (!AppState.settimanaAltra) return '';
  const altra = AppState.settimanaAltra;
  const tipoAltra = AppState.settimanaAltraTipo;
  const tipoVista = tipoAltra === 'successiva' ? 'corrente' : 'successiva';
  const labelVista = tipoVista === 'corrente' ? '🔴 Corrente' : 'Sessione successiva';
  const labelAltra = tipoAltra === 'corrente' ? '🔴 Corrente' : 'Sessione successiva';
  const range = DateUtils.rangeSettimana(altra.settimana, altra.data_fine);
  return `
    <div class="multi-settimana-bar">
      <span class="multi-settimana-tag tag-${tipoVista}">${labelVista}</span>
      <span class="multi-settimana-range">Stai visualizzando questa settimana. L'altra: <strong>${labelAltra}</strong> ${range}</span>
      <button class="btn btn-secondary btn-sm" onclick="swapSettimanaVista()">🔁 Vedi l'altra</button>
    </div>
  `;
}

function onUserLogout() {
  AppState.user = null;
  AppState.profile = null;
  AppState.settimana = null;
  AppState.settimanaAltra = null;
  AppState.settimanaAltraTipo = null;
  showLoginView();
}

// ===================================
// ROUTING VISTE
// ===================================
function showLoginView() {
  renderLogin();
}

function showDashboard() {
  const ruolo = AppState.profile?.ruolo;
  if (ruolo === 'cameriere') {
    renderCameriere();
  } else if (ruolo === 'manager_turni' || ruolo === 'super_admin') {
    renderManager();
  } else {
    renderCameriere(); // default
  }
}

// ===================================
// LOGOUT
// ===================================
async function doLogout() {
  try {
    await Auth.logout();
    // onAuthStateChange gestirà il redirect
  } catch (err) {
    showToast('Errore logout', 'error');
  }
}

// ===================================
// UTILITY UI
// ===================================

// Toast notifications
let toastTimer = null;
function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast toast-${type} toast-show`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
  }, 3500);
}

// Imposta loading su form
function setFormLoading(formId, loading) {
  const form = document.getElementById(formId);
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (text) text.classList.toggle('hidden', loading);
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

// Render header navbar
function renderNavbar(activeTab = null) {
  const ruolo = AppState.profile?.ruolo;
  const nome = AppState.profile?.nome || '';
  const isManager = ruolo === 'manager_turni' || ruolo === 'super_admin';

  return `
    <nav class="navbar">
      <div class="navbar-brand">
        <span class="navbar-logo">🍽️</span>
        <span class="navbar-title">Turni</span>
      </div>
      <div class="navbar-right">
        <span class="navbar-user">${nome}</span>
        <button class="btn-icon" onclick="doLogout()" title="Esci">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </nav>
    <div class="tab-bar">
      <button class="tab-btn ${activeTab === 'principale' ? 'active' : ''}" onclick="${isManager ? 'renderManager()' : 'renderCameriere()'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>${isManager ? 'Dashboard' : 'Turni'}</span>
      </button>
      <button class="tab-btn ${activeTab === 'storico' ? 'active' : ''}" onclick="renderStorico()">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Storico</span>
      </button>
    </div>
  `;
}

// Loading spinner full screen
function renderLoading(message = 'Caricamento...') {
  return `
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

// Empty state
function renderEmpty(icon, title, subtitle = '') {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <h3>${title}</h3>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
  `;
}
