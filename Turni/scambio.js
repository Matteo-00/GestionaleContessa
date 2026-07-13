// ===================================
// SCAMBIO.JS - Sistema scambio turni
// ===================================

// ===================================
// SEZIONE SCAMBI nel profilo cameriere
// (aggiunta alla vista pubblicata)
// ===================================

// Controlla se ci sono proposte di scambio in arrivo per questo utente
async function renderNotificheScambio() {
  const userId = AppState.user.id;
  const richieste = await DB.getRichiesteInAttesa(userId);
  if (!richieste.length) return '';

  const items = richieste.map(r => {
    const data  = DateUtils.getDataGiorno(r.settimana, r.giorno_cedente)
                    .toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' });
    const turno = r.turno_cedente === 'mattina' ? '☀️ Mattina' : '🌙 Sera';
    const tipo  = r.tipo === 'cessione' ? 'ti cede il turno' : 'propone uno scambio';
    return `
      <div class="notifica-scambio">
        <div class="notifica-icon">🔔</div>
        <div class="notifica-body">
          <p><b>${r.cedente?.nome} ${r.cedente?.cognome}</b> ${tipo}:</p>
          <p style="font-weight:700">${data} — ${turno}</p>
          ${r.tipo === 'scambio_1x1' && r.giorno_ricevente ? `
            <p style="font-size:12px;color:var(--text-muted)">
              In cambio vuole: ${DateUtils.getDataGiorno(r.settimana, r.giorno_ricevente)
                .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              — ${r.turno_ricevente === 'mattina' ? '☀️ Mattina' : '🌙 Sera'}
            </p>
          ` : ''}
        </div>
        <div class="notifica-actions">
          <button class="btn btn-success btn-sm" onclick="rispondiScambio('${r.id}', 'accettata')">✓</button>
          <button class="btn btn-danger btn-sm"  onclick="rispondiScambio('${r.id}', 'rifiutata')">✗</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="turni-section">
      <h2>🔔 Proposte di scambio</h2>
      ${items}
    </div>
  `;
}

// Accetta o rifiuta una proposta di scambio
async function rispondiScambio(id, stato) {
  const msg = stato === 'accettata'
    ? 'Accetti questo scambio? Sarà poi approvato dal responsabile.'
    : 'Rifiuti questa proposta di scambio?';
  if (!confirm(msg)) return;

  try {
    await DB.updateRichiestaScambio(id, { stato });
    showToast(stato === 'accettata' ? 'Accettato! In attesa del responsabile.' : 'Rifiutato.', stato === 'accettata' ? 'success' : 'info');
    renderCameriere();
  } catch (err) {
    showToast('Errore: ' + err.message, 'error');
  }
}

// ===================================
// MODAL: PROPONI SCAMBIO (dal turno pubblicato)
// ===================================
async function apriModaleScambio(giorno, turno, settimanaKey) {
  const userId    = AppState.user.id;
  const giornoInt = parseInt(giorno);

  try {
    // Query server-side: Supabase filtra direttamente nel DB con i tipi corretti
    const [disponibiliIds, profiles, mieiTurni] = await Promise.all([
      DB.getDisponibiliPerTurno(settimanaKey, giornoInt, turno, userId),
      DB.getAllProfiles(),
      DB.getTurniUtente(userId, settimanaKey)
    ]);

    console.log('[Scambio] user_id disponibili per turno:', disponibiliIds);

    // Costruisce lista persone dai profili corrispondenti agli ID trovati
    const profileMap = {};
    profiles.forEach(p => { profileMap[p.id] = p; });

    const persone = disponibiliIds
      .map(id => profileMap[id] || { id, nome: id.slice(0, 8), cognome: '(no profilo)', ruolo: '' })
      .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
  // I miei altri turni (per proposta 1x1)
  const mieiAltriTurni = mieiTurni.filter(t => !(t.giorno === giorno && t.turno === turno));

  const dataFmt = DateUtils.getDataGiorno(settimanaKey, giorno)
                    .toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' });
  const turnoLabel = turno === 'mattina' ? '☀️ Mattina' : '🌙 Sera';

  const opzioniPersone = persone.length
    ? persone.map(p => `<option value="${p.id}">${p.nome} ${p.cognome}</option>`).join('')
    : `<option value="" disabled>Nessuno ha dato disponibilità per questo turno</option>`;

  const opzioniMieiTurni = mieiAltriTurni.length
    ? mieiAltriTurni.map(t => {
        const d = DateUtils.getDataGiorno(settimanaKey, t.giorno)
                    .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const tl = t.turno === 'mattina' ? '☀️ Mattina' : '🌙 Sera';
        return `<option value="${t.giorno}|${t.turno}">${d} — ${tl}</option>`;
      }).join('')
    : '<option value="" disabled>Nessun altro turno assegnato</option>';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalScambio';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div class="modal-header">
        <h3>🔄 Proponi Scambio</h3>
        <p>${dataFmt} — ${turnoLabel}</p>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:18px">

          <!-- Tipo scambio -->
          <div class="form-group">
            <label>Tipo di scambio</label>
            <div class="role-selector">
              <label class="role-option">
                <input type="radio" name="tipoScambio" value="cessione" checked onchange="onTipoScambioChange()">
                <div class="role-option-card">
                  <span class="role-icon">➡️</span>
                  <span class="role-label">Cedo il turno</span>
                </div>
              </label>
              <label class="role-option">
                <input type="radio" name="tipoScambio" value="scambio_1x1" onchange="onTipoScambioChange()">
                <div class="role-option-card">
                  <span class="role-icon">🔄</span>
                  <span class="role-label">Scambio 1×1</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Seleziona persona -->
          <div class="form-group">
            <label>A chi proponi</label>
            <select id="scambioRicevente" style="padding:14px 16px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:16px;background:var(--bg);width:100%;color:var(--text)">
              ${opzioniPersone}
            </select>
          </div>

          <!-- Il mio turno in cambio (solo per 1x1) -->
          <div class="form-group" id="turnoInCambioWrap" style="display:none">
            <label>Il mio turno che offro in cambio</label>
            <select id="scambioTurnoRicevente" style="padding:14px 16px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:16px;background:var(--bg);width:100%;color:var(--text)">
              ${opzioniMieiTurni}
            </select>
          </div>

          <div class="form-error" id="scambioError"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" style="flex:1" onclick="chiudiModaleScambio()">Annulla</button>
        <button class="btn btn-primary" style="flex:2"
          onclick="inviaRichiestaScambio(${giorno},'${turno}','${settimanaKey}')">
          📤 Invia Proposta
        </button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) chiudiModaleScambio(); });
  document.body.appendChild(overlay);

  } catch (err) {
    console.error('[Scambio] ERRORE:', err);
    showToast('Errore apertura scambio: ' + err.message, 'error');
  }
}

function onTipoScambioChange() {
  const tipo  = document.querySelector('input[name="tipoScambio"]:checked')?.value;
  const wrap  = document.getElementById('turnoInCambioWrap');
  if (wrap) wrap.style.display = tipo === 'scambio_1x1' ? '' : 'none';
}

function chiudiModaleScambio() {
  document.getElementById('modalScambio')?.remove();
}

async function inviaRichiestaScambio(giornoCedente, turnoCedente, settimanaKey) {
  const tipo       = document.querySelector('input[name="tipoScambio"]:checked')?.value;
  const ricevente  = document.getElementById('scambioRicevente')?.value;
  const errEl      = document.getElementById('scambioError');

  if (!ricevente) {
    errEl.textContent = 'Seleziona una persona.'; errEl.classList.add('visible'); return;
  }

  let giornoRicevente  = null;
  let turnoRicevente   = null;

  if (tipo === 'scambio_1x1') {
    const sel = document.getElementById('scambioTurnoRicevente')?.value;
    if (!sel) {
      errEl.textContent = 'Seleziona il turno da offrire in cambio.'; errEl.classList.add('visible'); return;
    }
    [giornoRicevente, turnoRicevente] = sel.split('|');
    giornoRicevente = parseInt(giornoRicevente);
  }

  const record = {
    tipo,
    user_cedente:   AppState.user.id,
    settimana:      settimanaKey,
    giorno_cedente: giornoCedente,
    turno_cedente:  turnoCedente,
    user_ricevente: ricevente,
    giorno_ricevente: giornoRicevente,
    turno_ricevente:  turnoRicevente
  };

  try {
    await DB.createRichiestaScambio(record);
    chiudiModaleScambio();
    showToast('Proposta inviata! Attendi la risposta.', 'success');
  } catch (err) {
    errEl.textContent = 'Errore: ' + err.message;
    errEl.classList.add('visible');
  }
}

// Restituisce HTML per la sezione "I miei scambi" (storico richieste)
async function renderMieiScambi(settimanaKey) {
  const userId    = AppState.user.id;
  const richieste = await DB.getMieRichieste(userId);
  const miei      = richieste.filter(r => r.settimana === settimanaKey);

  if (!miei.length) return '';

  return miei.map(r => {
    const isCedente  = r.user_cedente === userId;
    const altra      = isCedente ? r.ricevente : r.cedente;
    const data       = DateUtils.getDataGiorno(r.settimana, r.giorno_cedente)
                         .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const tLabel     = r.turno_cedente === 'mattina' ? '☀️ Mattina' : '🌙 Sera';
    const direzione  = isCedente ? '➡️ Proposta inviata a' : '⬅️ Proposta ricevuta da';

    const statoChip  = {
      in_attesa:  '<span class="scambio-stato stato-attesa">⏳ In attesa</span>',
      accettata:  '<span class="scambio-stato stato-accettata">👍 Accettata — attende manager</span>',
      rifiutata:  '<span class="scambio-stato stato-rifiutata">❌ Rifiutata</span>',
      approvata:  '<span class="scambio-stato stato-approvata">✅ Approvata</span>',
      respinta:   '<span class="scambio-stato stato-rifiutata">🚫 Respinta dal manager</span>'
    }[r.stato] || r.stato;

    return `
      <div class="scambio-row">
        <div class="scambio-row-left">
          <div class="scambio-row-title">${data} — ${tLabel}</div>
          <div class="scambio-row-sub">${direzione} <b>${altra?.nome || '?'} ${altra?.cognome || ''}</b></div>
          <div style="margin-top:6px">${statoChip}</div>
        </div>
        <span class="turno-chip ${r.tipo === 'cessione' ? 'chip-mattina' : 'chip-sera'}" style="font-size:11px;flex-shrink:0">
          ${r.tipo === 'cessione' ? '➡️ Cede' : '🔄 1×1'}
        </span>
      </div>`;
  }).join('');
}
