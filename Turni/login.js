// ===================================
// LOGIN.JS - Login & Registrazione UI
// ===================================

// SVG eye icons per toggle password
const eyeIcon     = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const eyeOffIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Toggle visibilità password
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden ? eyeOffIcon : eyeIcon;
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <div class="auth-logo">
          <img src="../assets/IMG_5695.jpeg" alt="La Contessa" class="logo-img">
          <h1>La Contessa</h1>
          <p>Gestione Turni</p>
        </div>

        <!-- Tab switcher -->
        <div class="auth-tabs">
          <button class="auth-tab active" id="tabLogin" onclick="switchAuthTab('login')">Accedi</button>
          <button class="auth-tab" id="tabRegister" onclick="switchAuthTab('register')">Registrati</button>
        </div>

        <!-- Form Login -->
        <div id="formLoginWrap">
          <form id="loginForm" class="auth-form" onsubmit="submitLogin(event)">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="loginEmail" placeholder="tuaemail@esempio.it" required autocomplete="email" inputmode="email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <div class="pwd-wrapper">
                <input type="password" id="loginPassword" placeholder="Password" required autocomplete="current-password" minlength="6">
                <button type="button" class="pwd-toggle" onclick="togglePwd('loginPassword',this)" aria-label="Mostra/Nascondi password">${eyeIcon}</button>
              </div>
            </div>
            <div class="form-error" id="loginError"></div>
            <button type="submit" class="btn btn-primary btn-full">
              <span class="btn-text">Accedi</span>
              <span class="btn-spinner hidden">⏳</span>
            </button>
          </form>
          <div class="auth-link">
            Non hai un account?
            <button onclick="switchAuthTab('register')">Registrati</button>
          </div>
        </div>

        <!-- Form Registrazione -->
        <div id="formRegisterWrap" style="display:none">
          <form id="registerForm" class="auth-form" onsubmit="submitRegister(event)">
            <div class="form-row">
              <div class="form-group">
                <label>Nome</label>
                <input type="text" id="regNome" placeholder="Nome" required autocomplete="given-name">
              </div>
              <div class="form-group">
                <label>Cognome</label>
                <input type="text" id="regCognome" placeholder="Cognome" required autocomplete="family-name">
              </div>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="regEmail" placeholder="tuaemail@esempio.it" required autocomplete="email" inputmode="email">
            </div>
            <div class="form-group">
              <label>Password</label>
              <div class="pwd-wrapper">
                <input type="password" id="regPassword" placeholder="Min. 6 caratteri" required autocomplete="new-password" minlength="6">
                <button type="button" class="pwd-toggle" onclick="togglePwd('regPassword',this)" aria-label="Mostra/Nascondi password">${eyeIcon}</button>
              </div>
            </div>
            <div class="form-group">
              <label>Conferma Password</label>
              <div class="pwd-wrapper">
                <input type="password" id="regPasswordConf" placeholder="Ripeti password" required autocomplete="new-password" minlength="6">
                <button type="button" class="pwd-toggle" onclick="togglePwd('regPasswordConf',this)" aria-label="Mostra/Nascondi password">${eyeIcon}</button>
              </div>
            </div>

            <!-- Selezione ruolo -->
            <div class="form-group">
              <label>Ruolo</label>
              <div class="role-selector">
                <label class="role-option" id="roleOptCameriere">
                  <input type="radio" name="ruolo" value="cameriere" checked onchange="onRuoloChange()">
                  <div class="role-option-card">
                    <span class="role-icon">🤵</span>
                    <span class="role-label">Cameriere</span>
                  </div>
                </label>
                <label class="role-option" id="roleOptManager">
                  <input type="radio" name="ruolo" value="manager_turni" onchange="onRuoloChange()">
                  <div class="role-option-card">
                    <span class="role-icon">📋</span>
                    <span class="role-label">Responsabile Turni</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Codice responsabile (visibile solo se si sceglie Responsabile) -->
            <div class="form-group" id="managerCodeWrap" style="display:none">
              <label>Codice Responsabile</label>
              <div class="pwd-wrapper">
                <input type="password" id="regCodiceManager" placeholder="Inserisci il codice" autocomplete="off">
                <button type="button" class="pwd-toggle" onclick="togglePwd('regCodiceManager',this)" aria-label="Mostra/Nascondi password">${eyeIcon}</button>
              </div>
              <p style="font-size:12px;color:var(--text-muted);margin-top:4px">
                Chiedi il codice al titolare del ristorante.
              </p>
            </div>

            <!-- Codice cameriere (sempre visibile) -->
            <div class="form-group" id="cameriereCodeWrap">
              <label>Codice di Accesso</label>
              <div class="pwd-wrapper">
                <input type="password" id="regCodiceCameriere" placeholder="Codice fornito dal responsabile" autocomplete="off">
                <button type="button" class="pwd-toggle" onclick="togglePwd('regCodiceCameriere',this)" aria-label="Mostra/Nascondi password">${eyeIcon}</button>
              </div>
              <p style="font-size:12px;color:var(--text-muted);margin-top:4px">
                Chiedi il codice al responsabile prima di registrarti.
              </p>
            </div>

            <div class="form-error" id="registerError"></div>
            <button type="submit" class="btn btn-primary btn-full">
              <span class="btn-text">Crea Account</span>
              <span class="btn-spinner hidden">⏳</span>
            </button>
          </form>
          <div class="auth-link">
            Hai già un account?
            <button onclick="switchAuthTab('login')">Accedi</button>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Switcher tab login/register
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('formLoginWrap').style.display = isLogin ? '' : 'none';
  document.getElementById('formRegisterWrap').style.display = isLogin ? 'none' : '';
}

// Mostra errore form
function showFormError(errorId, message) {
  const el = document.getElementById(errorId);
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
}

function hideFormError(errorId) {
  const el = document.getElementById(errorId);
  if (el) el.classList.remove('visible');
}

// Mostra/nasconde il campo codice responsabile
function onRuoloChange() {
  const selected = document.querySelector('input[name="ruolo"]:checked')?.value;
  const managerWrap   = document.getElementById('managerCodeWrap');
  const cameriereWrap = document.getElementById('cameriereCodeWrap');

  if (managerWrap)   managerWrap.style.display   = selected === 'manager_turni' ? '' : 'none';
  // Il campo codice cameriere è visibile solo se si sceglie cameriere
  if (cameriereWrap) cameriereWrap.style.display  = selected === 'cameriere' ? '' : 'none';

  // Reset campi codice quando si cambia selezione
  if (selected !== 'manager_turni') {
    const inp = document.getElementById('regCodiceManager');
    if (inp) inp.value = '';
  }
  if (selected !== 'cameriere') {
    const inp = document.getElementById('regCodiceCameriere');
    if (inp) inp.value = '';
  }
}

// Submit login
async function submitLogin(e) {
  e.preventDefault();
  hideFormError('loginError');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) return;

  setFormLoading('loginForm', true);
  try {
    await Auth.login(email, password);
    // onAuthStateChange gestirà il routing
  } catch (err) {
    let msg = 'Credenziali non valide. Riprova.';
    if (err.message?.includes('Invalid login')) msg = 'Email o password errati.';
    if (err.message?.includes('Email not confirmed')) msg = 'Controlla la tua email per confermare l\'account.';
    showFormError('loginError', msg);
    setFormLoading('loginForm', false);
  }
}

// Submit registrazione
async function submitRegister(e) {
  e.preventDefault();
  hideFormError('registerError');

  const nome = document.getElementById('regNome').value.trim();
  const cognome = document.getElementById('regCognome').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const passwordConf = document.getElementById('regPasswordConf').value;
  const ruoloSelezionato = document.querySelector('input[name="ruolo"]:checked')?.value || 'cameriere';
  const codiceManager = document.getElementById('regCodiceManager')?.value || '';

  if (!nome || !cognome || !email || !password) return;

  if (password !== passwordConf) {
    showFormError('registerError', 'Le password non coincidono.');
    return;
  }

  if (password.length < 6) {
    showFormError('registerError', 'La password deve essere di almeno 6 caratteri.');
    return;
  }

  // Verifica codice in base al ruolo selezionato
  let ruoloFinale = 'cameriere';
  if (ruoloSelezionato === 'cameriere') {
    const codiceCam = document.getElementById('regCodiceCameriere')?.value || '';
    if (!codiceCam) {
      showFormError('registerError', 'Inserisci il codice di accesso camerieri.');
      return;
    }
    if (codiceCam !== CODICE_CAMERIERE) {
      showFormError('registerError', 'Codice di accesso non valido.');
      return;
    }
    ruoloFinale = 'cameriere';
  } else if (ruoloSelezionato === 'manager_turni') {
    if (!codiceManager) {
      showFormError('registerError', 'Inserisci il codice responsabile.');
      return;
    }
    if (codiceManager !== CODICE_MANAGER) {
      showFormError('registerError', 'Codice responsabile non valido.');
      return;
    }
    ruoloFinale = 'manager_turni';
  }

  setFormLoading('registerForm', true);
  try {
    // Passa nome, cognome e ruolo come metadata → il trigger DB crea il profilo automaticamente
    const { user } = await Auth.register(email, password, {
      nome:    nome,
      cognome: cognome,
      ruolo:   ruoloFinale
    });

    showToast('Account creato! Accedi per continuare.', 'success');
    switchAuthTab('login');
  } catch (err) {
    let msg = 'Errore durante la registrazione.';
    if (err.message?.includes('already registered')) msg = 'Email già registrata. Prova ad accedere.';
    if (err.message?.includes('password')) msg = 'Password non valida. Usa almeno 6 caratteri.';
    showFormError('registerError', msg);
  } finally {
    setFormLoading('registerForm', false);
  }
}
