// ===================================
// MANAGER.JS - Vista Manager & Super Admin
// ===================================

let _managerView = 'dashboard';
let _turnoSort = 'desc';        // 'desc' = più turni prima, 'asc' = meno turni prima
let _turnoModalData = null;     // cache dati aperti nel modal

async function renderManager() {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar('principale') + `<div class="page" id="pageContent">${renderLoading()}</div>`;

  const tabBar = `
    <div class="manager-tabs">
      <button class="mtab ${_managerView === 'dashboard'     ? 'active' : ''}" onclick="setManagerView('dashboard')">📋 Turni</button>
      <button class="mtab ${_managerView === 'disponibilita' ? 'active' : ''}" onclick="setManagerView('disponibilita')">👥 Disponibilità</button>
      <button class="mtab ${_managerView === 'mia-disp'      ? 'active' : ''}" onclick="setManagerView('mia-disp')">✋ La mia</button>
      <button class="mtab ${_managerView === 'scambi'        ? 'active' : ''}" onclick="setManagerView('scambi')">🔄 Scambi</button>
      <button class="mtab ${_managerView === 'utenti'        ? 'active' : ''}" onclick="setManagerView('utenti')">🧑‍🤝‍🧑 Utenti</button>
    </div>
  `;

  try {
    if      (_managerView === 'dashboard')     await renderManagerDashboard(tabBar);
    else if (_managerView === 'disponibilita') await renderManagerDisponibilita(tabBar);
    else if (_managerView === 'mia-disp')      await renderManagerMiaDisponibilita(tabBar);
    else if (_managerView === 'scambi')        await renderManagerScambi(tabBar);
    else if (_managerView === 'utenti')        await renderManagerUtenti(tabBar);
  } catch (err) {
    document.getElementById('pageContent').innerHTML = tabBar + renderEmpty('❌', 'Errore', err.message);
  }
}

function setManagerView(view) {
  _managerView = view;
  renderManager();
}

// ===================================
// DASHBOARD TURNI — card per ogni giorno/turno della sessione
// ===================================
async function renderManagerDashboard(tabBar) {
  const settimana = AppState.settimana;

  if (!settimana) {
    document.getElementById('pageContent').innerHTML = tabBar + `
      <div class="status-screen">
        <div class="status-icon">📅</div>
        <h2>Nessuna sessione attiva</h2>
        <p>Crea una sessione di lavoro per iniziare a raccogliere le disponibilità dei camerieri.</p>
      </div>
      <div class="action-section" style="margin-top:0">
        <button class="btn btn-primary btn-full" onclick="openCreaSessioneModal()">➕ Crea Sessione</button>
      </div>
    `;
    return;
  }

  const [disponibilita, turni] = await Promise.all([
    DB.getDisponibilita(settimana.settimana),
    DB.getTurni(settimana.settimana)
  ]);

  const giorniAttivi = DateUtils.getGiorniSessione(
    settimana.settimana,
    settimana.data_fine || settimana.settimana
  );

  const dispMap = {};
  disponibilita.forEach(d => {
    if (!d.disponibile) return;
    const k = `${d.giorno}-${d.turno}`;
    if (!dispMap[k]) dispMap[k] = [];
    dispMap[k].push(d.user_id);
  });

  const turniMap = {};
  turni.forEach(t => {
    const k = `${t.giorno}-${t.turno}`;
    if (!turniMap[k]) turniMap[k] = [];
    turniMap[k].push(t.user_id);
  });

  const cards = giorniAttivi.flatMap(g =>
    ['mattina', 'sera'].map(turno => {
      const k = `${g}-${turno}`;
      const disponibili = (dispMap[k] || []).length;
      const assegnati   = (turniMap[k] || []).length;
      const cls = assegnati > 0 ? 'indicator-ok' : (disponibili > 0 ? 'indicator-warn' : 'indicator-empty');
      const emoji = turno === 'mattina' ? '☀️' : '🌙';
      const bloccata = settimana.stato === 'in_revisione' && AppState.profile?.ruolo !== 'super_admin';
      return `
        <div class="manager-card ${bloccata ? 'manager-card-locked' : ''}" onclick="openTurnoModal(${g}, '${turno}')">
          <div class="manager-card-day">${DateUtils.GIORNI[g]}</div>
          <div class="manager-card-turno">${emoji} ${turno === 'mattina' ? 'Mattina' : 'Sera'}</div>
          <div class="manager-card-stats">
            <div class="stat-line"><span>Disponibili</span><strong>${disponibili}</strong></div>
            <div class="stat-line">
              <span>Assegnati</span>
              <strong>${assegnati} <span class="card-indicator ${cls}"></span></strong>
            </div>
          </div>
        </div>
      `;
    })
  ).join('');

  document.getElementById('pageContent').innerHTML = `
    ${tabBar}
    <div class="settimana-banner">
      <div class="settimana-banner-info">
        <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
        <p>Sessione di lavoro</p>
      </div>
      <span class="stato-badge stato-${settimana.stato}">${statoLabel(settimana.stato)}</span>
    </div>
    <div class="manager-grid">${cards}</div>
    <div style="margin:0 0 8px">
      <button class="btn btn-secondary btn-full" onclick="openAnteprima()">📊 Anteprima Settimana</button>
    </div>
    ${renderStatoActions(settimana)}
  `;
}

function statoLabel(stato) {
  return { aperta: 'Aperta', in_elaborazione: 'In elaborazione', in_revisione: 'In revisione', pubblicata: 'Pubblicata' }[stato] || stato;
}

// ===================================
// MACCHINA A STATI — pulsanti azione
// ===================================
function renderStatoActions(settimana) {
  const stato = settimana.stato;
  const isSuperAdmin = AppState.profile?.ruolo === 'super_admin';
  let html = '<div class="action-section">';

  if (stato === 'aperta') {
    html += `
      <button class="btn btn-warning btn-full" onclick="cambiaStato('in_elaborazione')">🔒 Inizia Creazione Turni</button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center">Blocca le disponibilità e inizia ad assegnare i turni</p>
    `;
  } else if (stato === 'in_elaborazione') {
    if (isSuperAdmin) {
      html += `
        <button class="btn btn-success btn-full" onclick="cambiaStato('pubblicata')">✅ Pubblica Turni</button>
        <button class="btn btn-secondary btn-full" onclick="cambiaStato('aperta')">🔓 Riapri Disponibilità</button>
        <p style="font-size:12px;color:var(--text-muted);text-align:center">"Riapri" permette ai camerieri di modificare ancora le disponibilità</p>
      `;
    } else {
      html += `
        <button class="btn btn-success btn-full" onclick="inviaTurniPerRevisione()">📤 Invia Turni al Super Admin</button>
        <button class="btn btn-secondary btn-full" onclick="cambiaStato('aperta')">🔓 Riapri Disponibilità</button>
        <p style="font-size:12px;color:var(--text-muted);text-align:center">Assegna i turni sulle card qui sopra, poi invia al Super Admin per la conferma finale.</p>
      `;
    }
  } else if (stato === 'in_revisione') {
    if (isSuperAdmin) {
      html += `
        <div class="alert-banner alert-warning">📥 Turni pronti — controllali e conferma</div>
        <button class="btn btn-success btn-full" onclick="cambiaStato('pubblicata')">✅ Conferma e Pubblica Turni</button>
        <p style="font-size:12px;color:var(--text-muted);text-align:center">Puoi ancora modificare i turni cliccando sulle card prima di confermare.</p>
      `;
    } else {
      html += `
        <div class="alert-banner alert-warning">⏳ Turni inviati — in attesa di conferma del Super Admin</div>
        <p style="font-size:12px;color:var(--text-muted);text-align:center">Non sono più modificabili finché il Super Admin non decide.</p>
      `;
    }
  } else if (stato === 'pubblicata') {
    html += `
      <button class="btn btn-primary btn-full" onclick="openCreaSessioneModal()">➕ Crea Nuova Sessione</button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center">Puoi ancora modificare i turni pubblicati cliccando sulle card</p>
    `;
  }

  html += `
    <button class="btn btn-danger btn-full" style="margin-top:14px" onclick="eliminaSessioneCorrente()">🗑️ Elimina Sessione di Lavoro</button>
  `;

  html += '</div>';
  return html;
}

// Il manager_turni ha finito di precompilare i turni e li invia al Super Admin
// per la conferma finale (da quel momento non sono più modificabili dal manager).
async function inviaTurniPerRevisione() {
  if (!confirm('Inviare i turni al Super Admin per la conferma finale?\n\nNon potrai più modificarli finché non risponde.')) return;

  try {
    const updated = await DB.updateStatoSettimana(AppState.settimana.settimana, 'in_revisione');
    AppState.settimana = updated;
    showToast('Turni inviati al Super Admin!', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

async function cambiaStato(nuovoStato) {
  if (nuovoStato === 'pubblicata' && AppState.profile?.ruolo !== 'super_admin') {
    showToast('Solo il Super Admin può confermare e pubblicare i turni.', 'error');
    return;
  }

  const msg = {
    in_elaborazione: 'Bloccare le disponibilità e iniziare a creare i turni?',
    pubblicata:      'Confermare e pubblicare i turni? I camerieri potranno vederli.',
    aperta:          'Riaprire le disponibilità? I camerieri potranno modificarle.'
  };
  if (!confirm(msg[nuovoStato])) return;

  try {
    const updated = await DB.updateStatoSettimana(AppState.settimana.settimana, nuovoStato);
    AppState.settimana = updated;

    // Quando si pubblica, elimina automaticamente le settimane più vecchie (mantieni solo ultime 5)
    if (nuovoStato === 'pubblicata') {
      await DB.eliminaSettimaneVecchie();
    }

    showToast('Stato aggiornato!', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// Elimina definitivamente la sessione di lavoro corrente:
// turni assegnati, disponibilità inviate e richieste di scambio collegate.
async function eliminaSessioneCorrente() {
  const settimana = AppState.settimana;
  if (!settimana) return;

  const ok = confirm(
    'Sei sicuro di voler eliminare questa sessione di lavoro?\n\n' +
    'Verranno eliminati definitivamente:\n' +
    '• Tutti i turni assegnati\n' +
    '• Tutte le disponibilità inviate dai camerieri\n' +
    '• Le eventuali richieste di scambio collegate\n\n' +
    'Questa azione NON può essere annullata.'
  );
  if (!ok) return;

  try {
    await DB.eliminaSessione(settimana.settimana);
    AppState.settimana = null;
    showToast('Sessione di lavoro eliminata.', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// ===================================
// MODAL: CREA SESSIONE
// ===================================
function openCreaSessioneModal() {
  // Minimo: domani (non si può iniziare da oggi)
  const domani = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  })();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalSessione';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>➕ Nuova Sessione</h3>
        <p>Scegli i giorni per cui raccogliere le disponibilità</p>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="form-row">
            <div class="form-group">
              <label>Dal</label>
              <input type="date" id="sessInizio" value="${domani}" min="${domani}" required>
            </div>
            <div class="form-group">
              <label>Al</label>
              <input type="date" id="sessFine" value="${domani}" min="${domani}" required>
            </div>
          </div>
          <div id="sessPreview"></div>
          <div class="form-error" id="sessError"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" onclick="chiudiModali()">Annulla</button>
        <button class="btn btn-primary" style="flex:2" onclick="confermaCreaSessione()">✅ Crea Sessione</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) chiudiModali(); });
  document.body.appendChild(overlay);

  document.getElementById('sessInizio')?.addEventListener('change', aggiornaPreviewSessione);
  document.getElementById('sessFine')?.addEventListener('change', aggiornaPreviewSessione);
  aggiornaPreviewSessione();
}

function aggiornaPreviewSessione() {
  const inizio  = document.getElementById('sessInizio')?.value;
  const fine    = document.getElementById('sessFine')?.value;
  const preview = document.getElementById('sessPreview');
  const errEl   = document.getElementById('sessError');
  if (!preview || !inizio || !fine) return;

  if (fine < inizio) {
    errEl.textContent = 'La data fine deve essere uguale o successiva all\'inizio.';
    errEl.classList.add('visible');
    preview.innerHTML = '';
    return;
  }
  errEl.classList.remove('visible');

  const giorni = DateUtils.getGiorniSessione(inizio, fine);
  if (giorni.length > 7) {
    errEl.textContent = 'La sessione non può superare 7 giorni.';
    errEl.classList.add('visible');
    return;
  }

  const nomi = giorni.map(g => DateUtils.GIORNI[g]).join(', ');
  preview.innerHTML = `
    <div class="sess-preview-box">
      <span style="font-size:13px;font-weight:600">
        📅 ${giorni.length} giorno${giorni.length !== 1 ? 'i' : ''}: ${nomi}
      </span>
    </div>
  `;
}

async function confermaCreaSessione() {
  const inizio = document.getElementById('sessInizio')?.value;
  const fine   = document.getElementById('sessFine')?.value;
  const errEl  = document.getElementById('sessError');

  // Calcola domani per validazione
  const domani = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

  if (!inizio || !fine) {
    errEl.textContent = 'Seleziona le date.'; errEl.classList.add('visible'); return;
  }
  if (inizio < domani) {
    errEl.textContent = 'La data di inizio deve essere almeno domani.'; errEl.classList.add('visible'); return;
  }
  if (fine < inizio) {
    errEl.textContent = 'La data fine deve essere uguale o successiva all\'inizio.'; errEl.classList.add('visible'); return;
  }
  if (DateUtils.getGiorniSessione(inizio, fine).length > 7) {
    errEl.textContent = 'Massimo 7 giorni.'; errEl.classList.add('visible'); return;
  }

  try {
    const nuova = await DB.createSettimana(inizio, fine);
    AppState.settimana = nuova;
    chiudiModali();
    showToast('Sessione creata!', 'success');
    renderManager();
  } catch (err) {
    errEl.textContent = 'Errore: ' + err.message;
    errEl.classList.add('visible');
  }
}

// ===================================
// HELPER: Badge equità turni (6 livelli)
// ===================================
function equityBadge(count) {
  if (count === 0) return `<span class="equity-badge equity-0">🟢 0</span>`;
  if (count === 1) return `<span class="equity-badge equity-1">🟡 1</span>`;
  if (count === 2) return `<span class="equity-badge equity-2">🟠 2</span>`;
  if (count === 3) return `<span class="equity-badge equity-3">🔴 3</span>`;
  if (count === 4) return `<span class="equity-badge equity-4">🟣 4</span>`;
  return `<span class="equity-badge equity-5">⚫ ${count}</span>`;
}

// Re-render solo la lista nel modal (senza riaprirlo)
function _renderListaTurnoModal() {
  if (!_turnoModalData) return;
  const { tutti, equitaCounts, assegnatiIds, sessioneCounts, isWeekendEquita, weeklyDispCounts } = _turnoModalData;

  const sorted = isWeekendEquita
    ? [...tutti].sort((a, b) => {
        const diff = (equitaCounts[a.id] || 0) - (equitaCounts[b.id] || 0);
        return _turnoSort === 'desc' ? -diff : diff;
      })
    : [...tutti].sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`));

  const listaEl = document.getElementById('disponibiliLista');
  const btnEl   = document.getElementById('turnoSortBtn');
  if (!listaEl) return;

  listaEl.innerHTML = sorted.length
    ? sorted.map(p => {
        const count        = sessioneCounts[p.id] || 0;
        const giaAssegnato = assegnatiIds.has(p.id);
        const nomeEsc      = `${p.nome} ${p.cognome}`.replace(/'/g, "\\'");
        const dispCount    = weeklyDispCounts ? (weeklyDispCounts[p.id] || 0) : 0;
        const sessBadge    = count > 0
          ? `<span class="sess-count-badge" title="Turni già assegnati in questa sessione">📌 ${count}×</span>`
          : '';
        return `
        <div class="disponibile-item-wrap">
          <div class="disponibile-item" onclick="toggleAssegna('${p.id}')">
            <input type="checkbox" class="checkbox-assegna" id="ass_${p.id}" ${giaAssegnato ? 'checked' : ''}>
            <div class="disponibile-item-info">
              <label for="ass_${p.id}">${p.nome} ${p.cognome}</label>
              <div class="disponibile-badges">
                ${isWeekendEquita ? equityBadge(equitaCounts[p.id] || 0) : ''}
                ${sessBadge}
                <span class="avail-count-badge" title="Disponibilità totali questa settimana">📅 ${dispCount} disp.</span>
              </div>
            </div>
          </div>
          <button class="btn-disp-detail" onclick="apriDispCompleta('${p.id}','${nomeEsc}')">📅 Vedi</button>
        </div>
      `;
      }).join('')
    : '<p style="color:var(--text-muted);font-size:14px">Nessuno disponibile.</p>';

  if (btnEl) {
    btnEl.textContent = _turnoSort === 'desc' ? '⬆ Meno turni prima' : '⬇ Più turni prima';
  }

  _updateTurnoCounter();
}

function toggleTurnoSort() {
  _turnoSort = _turnoSort === 'desc' ? 'asc' : 'desc';
  _renderListaTurnoModal();
}

// ===================================
// MODAL ASSEGNAZIONE TURNO (con modifica post-pubblicazione)
// ===================================
async function openTurnoModal(giorno, turno) {
  const settimana = AppState.settimana;

  // Una volta inviati al Super Admin per la conferma, il manager_turni non può più modificarli
  if (settimana.stato === 'in_revisione' && AppState.profile?.ruolo !== 'super_admin') {
    showToast('Turni inviati al Super Admin: non sono più modificabili.', 'info');
    return;
  }

  // Il conteggio di equità (chi ha lavorato di più/meno) si applica solo
  // ai giorni di punta: venerdì (5), sabato (6), domenica (7)
  const isWeekendEquita = [5, 6, 7].includes(giorno);

  const [disponibilita, turniAssegnati, profiles, ultime5] = await Promise.all([
    DB.getDisponibilita(settimana.settimana),
    DB.getTurni(settimana.settimana),
    DB.getAllProfiles(),
    isWeekendEquita ? DB.getUltime5Settimane() : Promise.resolve([])
  ]);

  // Esclude la settimana corrente dal conteggio equità (conta solo le passate)
  const settimanePassate = ultime5.filter(s => s !== settimana.settimana);
  const equitaCounts = isWeekendEquita
    ? await DB.getEquitaCounts(giorno, turno, settimanePassate)
    : {};

  const dispIds     = new Set(disponibilita.filter(d => d.giorno === giorno && d.turno === turno && d.disponibile).map(d => d.user_id));
  const assegnatiIds = new Set(turniAssegnati.filter(t => t.giorno === giorno && t.turno === turno).map(t => t.user_id));
  const tutti = profiles.filter(p => dispIds.has(p.id) || assegnatiIds.has(p.id));

  // Conteggio dei turni già assegnati a ciascuna persona in QUESTA sessione
  // (escluso il giorno/turno che si sta modificando ora) — solo indicativo
  const sessioneCounts = {};
  turniAssegnati.forEach(t => {
    if (t.giorno === giorno && t.turno === turno) return;
    sessioneCounts[t.user_id] = (sessioneCounts[t.user_id] || 0) + 1;
  });

  // Conteggio disponibilità settimanali per persona
  const weeklyDispCounts = {};
  disponibilita.filter(d => d.disponibile).forEach(d => {
    weeklyDispCounts[d.user_id] = (weeklyDispCounts[d.user_id] || 0) + 1;
  });

  // Mappa profili per id
  const profilesMap = {};
  profiles.forEach(p => { profilesMap[p.id] = p; });

  // Giorni attivi della sessione
  const giorniAttivi = DateUtils.getGiorniSessione(settimana.settimana, settimana.data_fine || settimana.settimana);

  // Numero previsto di camerieri (da localStorage)
  const requiredCount = _getRequiredCount(settimana.settimana, giorno, turno);

  // Salva i dati nel cache per il sort toggle e le funzioni di supporto
  _turnoModalData = {
    tutti, equitaCounts, assegnatiIds, sessioneCounts, isWeekendEquita,
    weeklyDispCounts, profilesMap, giorniAttivi,
    dispSettimana: disponibilita, turniSettimana: turniAssegnati,
    currentGiorno: giorno, currentTurno: turno,
    settimanaKey: settimana.settimana, requiredCount
  };

  const emoji   = turno === 'mattina' ? '☀️' : '🌙';
  const dataStr = DateUtils.getDataGiorno(settimana.settimana, giorno)
                    .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  const legendaEquitaHtml = isWeekendEquita ? `
    <div class="equity-legend">
      <span class="equity-legend-title">Badge Equità — ultime ${settimanePassate.length} settimane</span>
      <div class="equity-legend-items">
        <span><span class="equity-badge equity-0">🟢 0</span> Mai</span>
        <span><span class="equity-badge equity-1">🟡 1</span> Una volta</span>
        <span><span class="equity-badge equity-2">🟠 2</span> Due volte</span>
        <span><span class="equity-badge equity-3">🔴 3</span> Tre volte</span>
        <span><span class="equity-badge equity-4">🟣 4</span> Quattro volte</span>
        <span><span class="equity-badge equity-5">⚫ 5</span> Cinque su cinque</span>
      </div>
    </div>
  ` : '';

  const sortLabel = _turnoSort === 'desc' ? '⬆ Meno turni prima' : '⬇ Più turni prima';

  const counterCls = requiredCount > 0
    ? (assegnatiIds.size >= requiredCount ? 'counter-ok' : 'counter-progress')
    : '';
  const counterTxt = requiredCount > 0
    ? `${assegnatiIds.size} / ${requiredCount}`
    : `${assegnatiIds.size} assegnati`;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalTurno';
  overlay.innerHTML = `
    <div class="modal-sheet modal-sheet-tall">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
          <div style="flex:1;min-width:0">
            <h3>${emoji} ${DateUtils.GIORNI[giorno]} ${dataStr} – ${turno === 'mattina' ? 'Mattina' : 'Sera'}</h3>
            <p style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>${dispIds.size} disponibili</span>
              <span id="turnoCounter" class="turno-counter ${counterCls}">${counterTxt}</span>
            </p>
            <div class="previsti-row">
              <label>Previsti:</label>
              <input type="number" id="previsti-input" value="${requiredCount || ''}" min="0" max="99"
                oninput="aggiornaPrevisti()" placeholder="–">
              <button class="btn btn-secondary btn-sm" onclick="apriDettaglioAssegnati()">👥 Dettaglio</button>
            </div>
          </div>
          ${isWeekendEquita ? `<button id="turnoSortBtn" class="btn btn-secondary btn-sm" style="flex-shrink:0;white-space:nowrap"
            onclick="toggleTurnoSort()">${sortLabel}</button>` : ''}
        </div>
      </div>
      <div class="modal-body">
        <div class="disp-legenda-turno">
          <span class="dlt-item dlt-available">🟢 Disponibile</span>
          <span class="dlt-item dlt-assigned">🔴 Già inserita</span>
          <span class="dlt-item dlt-none">⚪ Non disponibile</span>
        </div>
        ${legendaEquitaHtml}
        <div class="disponibili-list" id="disponibiliLista"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" onclick="chiudiModali()">Annulla</button>
        <button class="btn btn-primary" style="flex:2" onclick="salvaTurniModal(${giorno},'${turno}')">💾 Salva</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) chiudiModali(); });
  document.body.appendChild(overlay);

  // Renderizza la lista con il sort corrente
  _renderListaTurnoModal();
}

function toggleAssegna(userId) {
  const cb = document.getElementById(`ass_${userId}`);
  if (cb) cb.checked = !cb.checked;
  _updateTurnoCounter();
}

function chiudiModali() {
  document.getElementById('modalTurno')?.remove();
  document.getElementById('modalSessione')?.remove();
  document.getElementById('modalDispCompleta')?.remove();
  document.getElementById('modalDettaglio')?.remove();
  document.getElementById('modalAnteprima')?.remove();
}

// Alias usato da storico e altri file
function closeModal() { chiudiModali(); }

async function salvaTurniModal(giorno, turno) {
  const settimana = AppState.settimana;

  const selezionati = Array.from(document.querySelectorAll('.checkbox-assegna'))
    .filter(cb => cb.checked)
    .map(cb => ({ user_id: cb.id.replace('ass_', ''), settimana: settimana.settimana, giorno, turno }));

  // Controllo sovrannumero rispetto ai previsti
  const req = _turnoModalData?.requiredCount || 0;
  if (req > 0 && selezionati.length > req) {
    const extra = selezionati.length - req;
    const ok = confirm(
      `⚠️ Stai inserendo ${extra} camerier${extra === 1 ? 'e' : 'i'} in più rispetto ai ${req} previsti.\nVuoi aggiunger${extra === 1 ? 'lo' : 'li'} comunque?`
    );
    if (!ok) return;
  }

  try {
    await DB.deleteTurni(settimana.settimana, giorno, turno);
    if (selezionati.length > 0) await DB.upsertTurni(selezionati);
    chiudiModali();
    showToast('Turno salvato!', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// ===================================
// DASHBOARD DISPONIBILITÀ
// ===================================
async function renderManagerDisponibilita(tabBar) {
  const settimana = AppState.settimana;
  if (!settimana) {
    document.getElementById('pageContent').innerHTML = tabBar + renderEmpty('📅', 'Nessuna sessione attiva', 'Crea una sessione dalla scheda Turni.');
    return;
  }

  const [profiles, disponibilita] = await Promise.all([
    DB.getAllProfiles(),
    DB.getDisponibilita(settimana.settimana)
  ]);

  const hannoInviato = new Set(disponibilita.filter(d => d.disponibile).map(d => d.user_id));
  const totale  = profiles.length;
  const inviati = profiles.filter(p => hannoInviato.has(p.id)).length;
  const perc    = totale > 0 ? Math.round((inviati / totale) * 100) : 0;

  const managers  = profiles.filter(p => p.ruolo !== 'cameriere');
  const camerieri = profiles.filter(p => p.ruolo === 'cameriere');

  const renderGruppo = (grp, titolo) => !grp.length ? '' : `
    <div class="recap-list" style="margin-bottom:12px">
      <div class="recap-group-title">${titolo}</div>
      ${grp.map(p => {
        const haInviato = hannoInviato.has(p.id);
        const nomeEsc = `${p.nome} ${p.cognome}`.replace(/'/g, "\\'");
        return `
        <div class="recap-item">
          <div class="recap-icon ${haInviato ? 'icon-ok' : 'icon-no'}">${haInviato ? '✓' : '✗'}</div>
          <span class="recap-name" style="flex:1">${p.nome} ${p.cognome}</span>
          ${haInviato ? `<button class="btn btn-secondary btn-sm" onclick="openDispModalStandalone('${p.id}','${nomeEsc}')">📅 Vedi</button>` : ''}
        </div>
      `}).join('')}
    </div>
  `;

  document.getElementById('pageContent').innerHTML = `
    ${tabBar}
    <div class="settimana-banner">
      <div class="settimana-banner-info">
        <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
        <p>Riepilogo disponibilità</p>
      </div>
      <span class="stato-badge stato-${settimana.stato}">${statoLabel(settimana.stato)}</span>
    </div>
    <div class="recap-section">
      <h2>Disponibilità ricevute</h2>
      <div class="recap-progress">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:28px;font-weight:800">${inviati}</span>
          <span style="font-size:14px;color:var(--text-muted)">su ${totale} persone</span>
        </div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${perc}%"></div></div>
        <p style="font-size:13px;color:var(--text-muted)">${perc}% del team ha inviato</p>
      </div>
      ${renderGruppo(managers, 'Manager')}
      ${renderGruppo(camerieri, 'Camerieri')}
    </div>
    ${settimana.stato === 'aperta' ? `<div class="action-section">
      <button class="btn btn-warning btn-full" onclick="cambiaStato('in_elaborazione')">🔒 Inizia Creazione Turni</button>
    </div>` : ''}
  `;
}

// ===================================
// LA MIA DISPONIBILITÀ (Manager)
// ===================================
async function renderManagerMiaDisponibilita(tabBar) {
  const settimana = AppState.settimana;
  const userId    = AppState.user.id;

  if (!settimana) {
    document.getElementById('pageContent').innerHTML = tabBar + renderEmpty('📅', 'Nessuna sessione attiva');
    return;
  }

  const readonly     = settimana.stato !== 'aperta';
  const giorniAttivi = DateUtils.getGiorniSessione(settimana.settimana, settimana.data_fine || settimana.settimana);
  const dispList     = await DB.getDisponibilitaUtente(userId, settimana.settimana);

  const dispMap = {};
  dispList.forEach(d => { dispMap[`${d.giorno}-${d.turno}`] = d.disponibile; });

  const righe = giorniAttivi.map(g => `
    <div class="disp-row">
      <span class="disp-row-day">${DateUtils.GIORNI[g]}</span>
      <div class="disp-cell">
        <input type="checkbox" class="checkbox-turno" data-giorno="${g}" data-turno="mattina"
          ${dispMap[`${g}-mattina`] ? 'checked' : ''} ${readonly ? 'disabled' : ''}>
      </div>
      <div class="disp-cell">
        <input type="checkbox" class="checkbox-turno" data-giorno="${g}" data-turno="sera"
          ${dispMap[`${g}-sera`] ? 'checked' : ''} ${readonly ? 'disabled' : ''}>
      </div>
    </div>
  `).join('');

  document.getElementById('pageContent').innerHTML = `
    ${tabBar}
    <div class="settimana-banner">
      <div class="settimana-banner-info">
        <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
        <p>La mia disponibilità</p>
      </div>
      <span class="stato-badge stato-${settimana.stato}">${statoLabel(settimana.stato)}</span>
    </div>
    ${readonly ? `<div class="alert-banner alert-warning">⚠️ Disponibilità bloccate — ${statoLabel(settimana.stato)}</div>` : ''}
    <div class="disponibilita-grid">
      <div class="disp-header"><span>Giorno</span><span>Mattina</span><span>Sera</span></div>
      ${righe}
    </div>
    ${!readonly ? `<div style="margin-top:16px">
      <button class="btn btn-primary btn-full" onclick="salvaDisponibilita()" id="btnSalva">
        <span class="btn-text">💾 Salva Disponibilità</span>
        <span class="btn-spinner hidden">⏳</span>
      </button>
    </div>` : ''}
  `;
}

// ===================================
// SCAMBI TURNO — Approvazioni Manager
// ===================================
async function renderManagerScambi(tabBar) {
  const settimana = AppState.settimana;
  if (!settimana) {
    document.getElementById('pageContent').innerHTML = tabBar + renderEmpty('🔄', 'Nessuna sessione attiva');
    return;
  }

  const richieste = await DB.getRichiesteAccettate(settimana.settimana);

  document.getElementById('pageContent').innerHTML = `
    ${tabBar}
    <h2 class="section-title">Scambi da approvare</h2>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      Scambi accettati da entrambe le parti — richiede il tuo ok finale.
    </p>
    ${richieste.length
      ? richieste.map(r => renderScambioCardManager(r)).join('')
      : renderEmpty('✅', 'Nessuno scambio da approvare')
    }
  `;
}

function renderScambioCardManager(r) {
  const emoji    = r.tipo === 'cessione' ? '➡️' : '🔄';
  const tipoLabel = r.tipo === 'cessione' ? 'Cessione turno' : 'Scambio 1×1';
  const dataC    = DateUtils.getDataGiorno(r.settimana, r.giorno_cedente)
                     .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const turnoC   = r.turno_cedente === 'mattina' ? '☀️ Mattina' : '🌙 Sera';

  let dettaglio = `<b>${r.cedente?.nome} ${r.cedente?.cognome}</b> cede
    <b>${dataC} ${turnoC}</b> a
    <b>${r.ricevente?.nome} ${r.ricevente?.cognome}</b>`;

  if (r.tipo === 'scambio_1x1' && r.giorno_ricevente) {
    const dataR = DateUtils.getDataGiorno(r.settimana, r.giorno_ricevente)
                    .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const turnoR = r.turno_ricevente === 'mattina' ? '☀️ Mattina' : '🌙 Sera';
    dettaglio += `<br>In cambio: <b>${dataR} ${turnoR}</b>`;
  }

  return `
    <div class="turno-card" style="margin-bottom:12px">
      <div class="turno-card-header">
        <h4>${emoji} ${tipoLabel}</h4>
      </div>
      <div style="padding:14px 18px">
        <p style="font-size:14px;line-height:1.7;margin-bottom:14px">${dettaglio}</p>
        <div style="display:flex;gap:10px">
          <button class="btn btn-success" style="flex:1" onclick="approvaScambio('${r.id}')">✅ Approva</button>
          <button class="btn btn-danger"  style="flex:1" onclick="rifiutaScambioManager('${r.id}')">❌ Rifiuta</button>
        </div>
      </div>
    </div>
  `;
}

async function approvaScambio(id) {
  try {
    const { data: r, error } = await sb.from('richieste_scambio').select('*').eq('id', id).single();
    if (error) throw error;

    await DB.updateRichiestaScambio(id, { stato: 'approvata' });
    await eseguiScambioDB(r);

    showToast('Scambio approvato e applicato!', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

async function rifiutaScambioManager(id) {
  if (!confirm('Rifiutare questo scambio?')) return;
  try {
    await DB.updateRichiestaScambio(id, { stato: 'respinta' });
    showToast('Scambio rifiutato.', 'info');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

async function eseguiScambioDB(r) {
  const settimana = r.settimana;
  if (r.tipo === 'cessione') {
    await DB.deleteTurni(settimana, r.giorno_cedente, r.turno_cedente);
    await DB.upsertTurni([{ user_id: r.user_ricevente, settimana, giorno: r.giorno_cedente, turno: r.turno_cedente }]);
  } else if (r.tipo === 'scambio_1x1' && r.giorno_ricevente) {
    await DB.deleteTurni(settimana, r.giorno_cedente, r.turno_cedente);
    await DB.deleteTurni(settimana, r.giorno_ricevente, r.turno_ricevente);
    await DB.upsertTurni([
      { user_id: r.user_ricevente, settimana, giorno: r.giorno_cedente,  turno: r.turno_cedente },
      { user_id: r.user_cedente,   settimana, giorno: r.giorno_ricevente, turno: r.turno_ricevente }
    ]);
  }
}

// ===================================
// GESTIONE UTENTI — super_admin vede tutti ed elimina tutti,
// manager_turni vede tutti ma elimina solo i camerieri
// ===================================
async function renderManagerUtenti(tabBar) {
  const profiles    = await DB.getAllProfiles();
  const ruoloMio    = AppState.profile?.ruolo;
  const isSuperAdmin = ruoloMio === 'super_admin';

  const ruoloLabel = r => ({
    super_admin:   '👑 Super Admin',
    manager_turni: '📋 Responsabile Turni',
    cameriere:     '🤵 Cameriere'
  }[r] || r);

  const righe = profiles.map(p => {
    const isSelf       = p.id === AppState.user.id;
    const puoEliminare = !isSelf && (isSuperAdmin || (ruoloMio === 'manager_turni' && p.ruolo === 'cameriere'));
    const nomeSicuro   = `${p.nome || ''} ${p.cognome || ''}`.trim().replace(/'/g, "\\'");

    return `
      <div class="recap-item">
        <div class="recap-icon icon-ok">${(p.nome || '?').charAt(0).toUpperCase()}</div>
        <div style="flex:1">
          <span class="recap-name">${p.nome} ${p.cognome}</span>
          <div style="font-size:12px;color:var(--text-muted)">${ruoloLabel(p.ruolo)}${isSelf ? ' · Tu' : ''}</div>
        </div>
        ${puoEliminare ? `<button class="btn btn-danger btn-sm" onclick="eliminaUtente('${p.id}','${nomeSicuro}')">🗑️ Elimina</button>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('pageContent').innerHTML = `
    ${tabBar}
    <h2 class="section-title">Utenti</h2>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      ${isSuperAdmin ? 'Puoi eliminare qualsiasi utente.' : 'Puoi eliminare solo i camerieri.'}
    </p>
    <div class="recap-list">
      ${righe || '<p style="padding:16px;color:var(--text-muted)">Nessun utente.</p>'}
    </div>
  `;
}

async function eliminaUtente(userId, nomeCompleto) {
  const ok = confirm(
    `Sei sicuro di voler eliminare l'utente ${nomeCompleto}?\n\n` +
    'Non potrà più accedere all\'app e sarà rimosso da tutte le liste.'
  );
  if (!ok) return;

  try {
    await DB.disattivaProfilo(userId);
    showToast('Utente eliminato.', 'success');
    renderManager();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// ===================================
// GESTIONE NUMERO PREVISTO CAMERIERI PER TURNO
// ===================================
function _getRequiredCount(settimana, giorno, turno) {
  return parseInt(localStorage.getItem(`req_${settimana}_${giorno}_${turno}`) || '0', 10);
}

function _setRequiredCount(settimana, giorno, turno, count) {
  localStorage.setItem(`req_${settimana}_${giorno}_${turno}`, count);
}

function aggiornaPrevisti() {
  if (!_turnoModalData) return;
  const input = document.getElementById('previsti-input');
  if (!input) return;
  const val = Math.max(0, parseInt(input.value || '0', 10) || 0);
  const { settimanaKey, currentGiorno, currentTurno } = _turnoModalData;
  _setRequiredCount(settimanaKey, currentGiorno, currentTurno, val);
  _turnoModalData.requiredCount = val;
  _updateTurnoCounter();
}

function _updateTurnoCounter() {
  if (!_turnoModalData) return;
  const checked = document.querySelectorAll('.checkbox-assegna:checked').length;
  const el = document.getElementById('turnoCounter');
  if (!el) return;
  const req = _turnoModalData.requiredCount || 0;
  if (req > 0) {
    el.textContent = `${checked} / ${req}`;
    el.className = checked > req ? 'turno-counter counter-over'
                 : checked >= req ? 'turno-counter counter-ok'
                 : 'turno-counter counter-progress';
  } else {
    el.textContent = `${checked} assegnati`;
    el.className = 'turno-counter';
  }
}

function apriDettaglioAssegnati() {
  if (!_turnoModalData) return;
  const { tutti, profilesMap } = _turnoModalData;
  const checked = Array.from(document.querySelectorAll('.checkbox-assegna:checked'))
    .map(cb => cb.id.replace('ass_', ''));

  const nomi = checked.map(id => {
    const p = profilesMap[id] || tutti.find(u => u.id === id);
    return p ? `${p.nome} ${p.cognome}` : id;
  });

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalDettaglio';
  overlay.style.zIndex = '300';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>👥 Camerieri assegnati (${nomi.length})</h3>
      </div>
      <div class="modal-body">
        ${nomi.length
          ? nomi.map(n => `<div class="recap-item"><div class="recap-icon icon-ok">✓</div><span class="recap-name">${n}</span></div>`).join('')
          : '<p style="color:var(--text-muted)">Nessuno ancora selezionato.</p>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-full" onclick="document.getElementById('modalDettaglio')?.remove()">Chiudi</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ===================================
// DISPONIBILITÀ COMPLETA SETTIMANALE — modal per singola persona
// ===================================
function apriDispCompleta(userId, nomeCompleto) {
  if (!_turnoModalData) return;
  const { giorniAttivi, dispSettimana, turniSettimana, currentGiorno, currentTurno } = _turnoModalData;
  openDisponibilitaCompletaModal(userId, nomeCompleto, {
    giorniAttivi, dispSettimana, turniSettimana, currentGiorno, currentTurno
  });
}

async function openDispModalStandalone(userId, nomeCompleto) {
  const settimana = AppState.settimana;
  if (!settimana) return;
  const giorniAttivi = DateUtils.getGiorniSessione(settimana.settimana, settimana.data_fine || settimana.settimana);
  const [dispSettimana, turniSettimana] = await Promise.all([
    DB.getDisponibilita(settimana.settimana),
    DB.getTurni(settimana.settimana)
  ]);
  openDisponibilitaCompletaModal(userId, nomeCompleto, {
    giorniAttivi, dispSettimana, turniSettimana, currentGiorno: null, currentTurno: null
  });
}

function openDisponibilitaCompletaModal(userId, nomeCompleto, ctx) {
  const { giorniAttivi, dispSettimana, turniSettimana, currentGiorno, currentTurno } = ctx;

  const userDisp = new Set();
  dispSettimana.filter(d => d.user_id === userId && d.disponibile).forEach(d => {
    userDisp.add(`${d.giorno}-${d.turno}`);
  });

  const userAssigned = {};
  turniSettimana.filter(t => t.user_id === userId).forEach(t => {
    if (t.giorno === currentGiorno && t.turno === currentTurno) return;
    userAssigned[`${t.giorno}-${t.turno}`] = `${DateUtils.GIORNI[t.giorno]} ${t.turno === 'mattina' ? 'mattina' : 'sera'}`;
  });

  const renderSlot = (g, turno) => {
    const k = `${g}-${turno}`;
    const isCurrent  = g === currentGiorno && turno === currentTurno;
    const isAssigned = userAssigned[k];
    const isAvailable = userDisp.has(k);
    const emoji = turno === 'mattina' ? '☀️' : '🌙';
    const label = turno === 'mattina' ? 'Mattina' : 'Sera';

    if (isCurrent) {
      return `<div class="disp-slot slot-current">${emoji} ${label}<br><small>✨ Turno corrente</small></div>`;
    } else if (isAssigned) {
      return `<div class="disp-slot slot-assigned">${emoji} ${label}<br><small>Già inserita – ${isAssigned}</small></div>`;
    } else if (isAvailable) {
      return `<div class="disp-slot slot-available">${emoji} ${label}<br><small>Disponibile</small></div>`;
    } else {
      return `<div class="disp-slot slot-unavailable">${emoji} ${label}<br><small>Non disponibile</small></div>`;
    }
  };

  const rows = giorniAttivi.map(g => `
    <div class="disp-week-row">
      <span class="disp-week-day">${DateUtils.GIORNI[g]}</span>
      <div class="disp-slots">
        ${renderSlot(g, 'mattina')}
        ${renderSlot(g, 'sera')}
      </div>
    </div>
  `).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalDispCompleta';
  overlay.style.zIndex = '300';
  overlay.innerHTML = `
    <div class="modal-sheet modal-sheet-tall">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>📅 ${nomeCompleto}</h3>
        <p>Disponibilità settimanale completa</p>
      </div>
      <div class="modal-body">
        <div class="disp-legenda">
          <span class="disp-legend-item slot-available">🟢 Disponibile</span>
          <span class="disp-legend-item slot-assigned">🔴 Già inserita</span>
          <span class="disp-legend-item slot-unavailable">⚪ Non disponibile</span>
          ${currentGiorno !== null ? '<span class="disp-legend-item slot-current">✨ Turno corrente</span>' : ''}
        </div>
        <div class="disp-week-grid">${rows}</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-full" onclick="document.getElementById('modalDispCompleta')?.remove()">Chiudi</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// ===================================
// ANTEPRIMA SETTIMANA — riepilogo turni di tutti i camerieri
// ===================================
async function openAnteprima() {
  const settimana = AppState.settimana;
  if (!settimana) { showToast('Nessuna sessione attiva.', 'info'); return; }

  const [profiles, turni] = await Promise.all([
    DB.getAllProfiles(),
    DB.getTurni(settimana.settimana)
  ]);

  const turniPerUser = {};
  turni.forEach(t => {
    if (!turniPerUser[t.user_id]) turniPerUser[t.user_id] = [];
    turniPerUser[t.user_id].push(t);
  });

  const conTurni    = profiles.filter(p =>  turniPerUser[p.id]?.length > 0)
    .sort((a, b) => (turniPerUser[b.id]?.length || 0) - (turniPerUser[a.id]?.length || 0));
  const senzaTurni  = profiles.filter(p => !turniPerUser[p.id]?.length);

  const giornoLabel = g => DateUtils.GIORNI[g] || g;
  const turnoLabel  = t => t === 'mattina' ? '☀️ Mattina' : '🌙 Sera';

  const renderDettaglio = userId => {
    return (turniPerUser[userId] || [])
      .sort((a, b) => a.giorno - b.giorno || a.turno.localeCompare(b.turno))
      .map(t => `<div class="anteprima-turno">${giornoLabel(t.giorno)} — ${turnoLabel(t.turno)}</div>`)
      .join('');
  };

  const personCards = conTurni.map(p => {
    const count = turniPerUser[p.id]?.length || 0;
    return `
      <div class="anteprima-person">
        <div class="anteprima-header" onclick="toggleAnteprimaDettaglio('ant_${p.id}', this)">
          <span class="anteprima-name">${p.nome} ${p.cognome}</span>
          <span class="anteprima-count">${count} turno${count !== 1 ? 'i' : ''}</span>
          <span class="anteprima-toggle">▼ Dettagli</span>
        </div>
        <div class="anteprima-dettaglio" id="ant_${p.id}" style="display:none">
          ${renderDettaglio(p.id)}
        </div>
      </div>
    `;
  }).join('');

  const senzaHtml = senzaTurni.length ? `
    <div class="anteprima-senza">
      <p style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:6px">Senza turni assegnati:</p>
      ${senzaTurni.map(p => `<p style="font-size:13px;color:var(--text-muted)">• ${p.nome} ${p.cognome}</p>`).join('')}
    </div>
  ` : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAnteprima';
  overlay.innerHTML = `
    <div class="modal-sheet modal-sheet-tall">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>📊 Anteprima Settimana</h3>
        <p>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)} — riepilogo turni assegnati</p>
      </div>
      <div class="modal-body">
        ${personCards || '<p style="color:var(--text-muted)">Nessun turno ancora assegnato.</p>'}
        ${senzaHtml}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary btn-full" onclick="document.getElementById('modalAnteprima')?.remove()">Chiudi</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function toggleAnteprimaDettaglio(id, headerEl) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  const toggle = headerEl?.querySelector('.anteprima-toggle');
  if (toggle) toggle.textContent = isOpen ? '▼ Dettagli' : '▲ Nascondi';
}
