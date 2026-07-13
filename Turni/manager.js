// ===================================
// MANAGER.JS - Vista Manager & Super Admin
// ===================================

let _managerView = 'dashboard';

async function renderManager() {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar('principale') + `<div class="page" id="pageContent">${renderLoading()}</div>`;

  const tabBar = `
    <div class="manager-tabs">
      <button class="mtab ${_managerView === 'dashboard'     ? 'active' : ''}" onclick="setManagerView('dashboard')">📋 Turni</button>
      <button class="mtab ${_managerView === 'disponibilita' ? 'active' : ''}" onclick="setManagerView('disponibilita')">👥 Disponibilità</button>
      <button class="mtab ${_managerView === 'mia-disp'      ? 'active' : ''}" onclick="setManagerView('mia-disp')">✋ La mia</button>
      <button class="mtab ${_managerView === 'scambi'        ? 'active' : ''}" onclick="setManagerView('scambi')">🔄 Scambi</button>
    </div>
  `;

  try {
    if      (_managerView === 'dashboard')     await renderManagerDashboard(tabBar);
    else if (_managerView === 'disponibilita') await renderManagerDisponibilita(tabBar);
    else if (_managerView === 'mia-disp')      await renderManagerMiaDisponibilita(tabBar);
    else if (_managerView === 'scambi')        await renderManagerScambi(tabBar);
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
      return `
        <div class="manager-card" onclick="openTurnoModal(${g}, '${turno}')">
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
    ${renderStatoActions(settimana)}
  `;
}

function statoLabel(stato) {
  return { aperta: 'Aperta', in_elaborazione: 'In elaborazione', pubblicata: 'Pubblicata' }[stato] || stato;
}

// ===================================
// MACCHINA A STATI — pulsanti azione
// ===================================
function renderStatoActions(settimana) {
  const stato = settimana.stato;
  let html = '<div class="action-section">';

  if (stato === 'aperta') {
    html += `
      <button class="btn btn-warning btn-full" onclick="cambiaStato('in_elaborazione')">🔒 Inizia Creazione Turni</button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center">Blocca le disponibilità e inizia ad assegnare i turni</p>
    `;
  } else if (stato === 'in_elaborazione') {
    html += `
      <button class="btn btn-success btn-full" onclick="cambiaStato('pubblicata')">✅ Pubblica Turni</button>
      <button class="btn btn-secondary btn-full" onclick="cambiaStato('aperta')">🔓 Riapri Disponibilità</button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center">"Riapri" permette ai camerieri di modificare ancora le disponibilità</p>
    `;
  } else if (stato === 'pubblicata') {
    html += `
      <button class="btn btn-primary btn-full" onclick="openCreaSessioneModal()">➕ Crea Nuova Sessione</button>
      <p style="font-size:12px;color:var(--text-muted);text-align:center">Puoi ancora modificare i turni pubblicati cliccando sulle card</p>
    `;
  }

  html += '</div>';
  return html;
}

async function cambiaStato(nuovoStato) {
  const msg = {
    in_elaborazione: 'Bloccare le disponibilità e iniziare a creare i turni?',
    pubblicata:      'Pubblicare i turni? I camerieri potranno vederli.',
    aperta:          'Riaprire le disponibilità? I camerieri potranno modificarle.'
  };
  if (!confirm(msg[nuovoStato])) return;

  try {
    const updated = await DB.updateStatoSettimana(AppState.settimana.settimana, nuovoStato);
    AppState.settimana = updated;
    showToast('Stato aggiornato!', 'success');
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
// MODAL ASSEGNAZIONE TURNO (con modifica post-pubblicazione)
// ===================================
async function openTurnoModal(giorno, turno) {
  const settimana = AppState.settimana;

  const [disponibilita, turniAssegnati, profiles] = await Promise.all([
    DB.getDisponibilita(settimana.settimana),
    DB.getTurni(settimana.settimana),
    DB.getAllProfiles()
  ]);

  const dispIds     = new Set(disponibilita.filter(d => d.giorno === giorno && d.turno === turno && d.disponibile).map(d => d.user_id));
  const assegnatiIds = new Set(turniAssegnati.filter(t => t.giorno === giorno && t.turno === turno).map(t => t.user_id));
  const tutti = profiles.filter(p => dispIds.has(p.id) || assegnatiIds.has(p.id));

  const emoji     = turno === 'mattina' ? '☀️' : '🌙';
  const dataStr   = DateUtils.getDataGiorno(settimana.settimana, giorno)
                      .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  // Il manager può SEMPRE modificare i turni (anche dopo pubblicazione)
  const listaHtml = tutti.length
    ? tutti.map(p => `
        <div class="disponibile-item" onclick="toggleAssegna('${p.id}')">
          <input type="checkbox" class="checkbox-assegna" id="ass_${p.id}" ${assegnatiIds.has(p.id) ? 'checked' : ''}>
          <label for="ass_${p.id}">${p.nome} ${p.cognome}</label>
          <span class="disponibile-badge">${p.ruolo === 'manager_turni' ? 'Manager' : 'Cameriere'}</span>
        </div>
      `).join('')
    : '<p style="color:var(--text-muted);font-size:14px">Nessuno disponibile.</p>';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalTurno';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>${emoji} ${DateUtils.GIORNI[giorno]} ${dataStr} – ${turno === 'mattina' ? 'Mattina' : 'Sera'}</h3>
        <p>${dispIds.size} disponibili · ${assegnatiIds.size} assegnati</p>
      </div>
      <div class="modal-body"><div class="disponibili-list">${listaHtml}</div></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" onclick="chiudiModali()">Annulla</button>
        <button class="btn btn-primary" style="flex:2" onclick="salvaTurniModal(${giorno},'${turno}')">💾 Salva</button>
      </div>
    </div>
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) chiudiModali(); });
  document.body.appendChild(overlay);
}

function toggleAssegna(userId) {
  const cb = document.getElementById(`ass_${userId}`);
  if (cb) cb.checked = !cb.checked;
}

function chiudiModali() {
  document.getElementById('modalTurno')?.remove();
  document.getElementById('modalSessione')?.remove();
}

// Alias usato da storico e altri file
function closeModal() { chiudiModali(); }

async function salvaTurniModal(giorno, turno) {
  const settimana = AppState.settimana;
  await DB.deleteTurni(settimana.settimana, giorno, turno);

  const selezionati = Array.from(document.querySelectorAll('.checkbox-assegna'))
    .filter(cb => cb.checked)
    .map(cb => ({ user_id: cb.id.replace('ass_', ''), settimana: settimana.settimana, giorno, turno }));

  try {
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
      ${grp.map(p => `
        <div class="recap-item">
          <div class="recap-icon ${hannoInviato.has(p.id) ? 'icon-ok' : 'icon-no'}">${hannoInviato.has(p.id) ? '✓' : '✗'}</div>
          <span class="recap-name">${p.nome} ${p.cognome}</span>
        </div>
      `).join('')}
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
