// ===================================
// CAMERIERE.JS - Vista Cameriere
// ===================================

async function renderCameriere() {
  const app = document.getElementById('app');
  const settimana = AppState.settimana;

  // Navbar + TabBar
  app.innerHTML = renderNavbar('principale') + `<div class="page" id="pageContent">${renderLoading()}</div>`;

  if (!settimana) {
    document.getElementById('pageContent').innerHTML = `
      <div class="status-screen">
        <div class="status-icon">📅</div>
        <h2>Nessuna settimana attiva</h2>
        <p>Il responsabile non ha ancora aperto la settimana.<br>Torna presto!</p>
      </div>
    `;
    return;
  }

  const stato = settimana.stato;

  if (stato === 'aperta') {
    await renderCameriereAperta();
  } else if (stato === 'in_elaborazione') {
    renderCameriereElaborazione();
  } else if (stato === 'pubblicata') {
    await renderCamerierePublicata();
  }
}

// --- STATO: Aperta ---
async function renderCameriereAperta() {
  const settimana = AppState.settimana;
  const userId = AppState.user.id;

  try {
    const dispList = await DB.getDisponibilitaUtente(userId, settimana.settimana);

    // Mappa: "giorno-turno" -> disponibile
    const dispMap = {};
    dispList.forEach(d => { dispMap[`${d.giorno}-${d.turno}`] = d.disponibile; });

    // Mostra SOLO i giorni attivi nella sessione
    const giorniAttivi = DateUtils.getGiorniSessione(
      settimana.settimana,
      settimana.data_fine || settimana.settimana
    );

    const righe = giorniAttivi.map(g => {
      const mattina = dispMap[`${g}-mattina`] === true;
      const sera    = dispMap[`${g}-sera`] === true;
      return `
        <div class="disp-row">
          <span class="disp-row-day">${DateUtils.GIORNI[g]}</span>
          <div class="disp-cell">
            <input type="checkbox" class="checkbox-turno" data-giorno="${g}" data-turno="mattina" ${mattina ? 'checked' : ''}>
          </div>
          <div class="disp-cell">
            <input type="checkbox" class="checkbox-turno" data-giorno="${g}" data-turno="sera" ${sera ? 'checked' : ''}>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <div class="settimana-banner">
        <div class="settimana-banner-info">
          <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
          <p>Inserisci la tua disponibilità</p>
        </div>
        <span class="stato-badge stato-aperta">Aperta</span>
      </div>

      <div class="disponibilita-section">
        <h2>La mia disponibilità</h2>
        <div class="disponibilita-grid">
          <div class="disp-header">
            <span>Giorno</span>
            <span>Mattina</span>
            <span>Sera</span>
          </div>
          ${righe}
        </div>
      </div>

      <button class="btn btn-primary btn-full" onclick="salvaDisponibilita()" id="btnSalva">
        <span class="btn-text">💾 Salva Disponibilità</span>
        <span class="btn-spinner hidden">⏳</span>
      </button>
    `;

    document.getElementById('pageContent').innerHTML = html;
  } catch (err) {
    document.getElementById('pageContent').innerHTML = renderEmpty('❌', 'Errore caricamento', err.message);
  }
}

// Salva disponibilità cameriere
async function salvaDisponibilita() {
  const settimana = AppState.settimana;
  const userId = AppState.user.id;
  const checkboxes = document.querySelectorAll('.checkbox-turno');

  const records = Array.from(checkboxes).map(cb => ({
    user_id: userId,
    settimana: settimana.settimana,
    giorno: parseInt(cb.dataset.giorno),
    turno: cb.dataset.turno,
    disponibile: cb.checked
  }));

  const btn = document.getElementById('btnSalva');
  if (btn) btn.disabled = true;

  try {
    await DB.upsertDisponibilita(records);
    showToast('Disponibilità salvata! ✓', 'success');
  } catch (err) {
    showToast('Errore salvataggio: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- STATO: In elaborazione ---
function renderCameriereElaborazione() {
  const settimana = AppState.settimana;
  const html = `
    <div class="settimana-banner">
      <div class="settimana-banner-info">
        <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
        <p>In fase di elaborazione</p>
      </div>
      <span class="stato-badge stato-in_elaborazione">In elaborazione</span>
    </div>
    <div class="status-screen">
      <div class="status-icon">⏳</div>
      <h2>Turni in elaborazione</h2>
      <p>Il responsabile sta organizzando i turni della settimana.<br><br>Non è più possibile modificare la disponibilità.<br>Torna presto per vedere i turni assegnati!</p>
    </div>
  `;
  document.getElementById('pageContent').innerHTML = html;
}

// --- STATO: Pubblicata ---
async function renderCamerierePublicata() {
  const settimana = AppState.settimana;
  const userId    = AppState.user.id;

  try {
    const [tuttiTurni, mieiTurni, notifiche, scambiHtml] = await Promise.all([
      DB.getTurni(settimana.settimana),
      DB.getTurniUtente(userId, settimana.settimana),
      renderNotificheScambio(),
      renderMieiScambi(settimana.settimana)
    ]);

    const mieiTurniCount   = mieiTurni.length;
    const tuttiTurniCount  = tuttiTurni.length;

    document.getElementById('pageContent').innerHTML = `

      <!-- Banner sessione -->
      <div class="settimana-banner">
        <div class="settimana-banner-info">
          <h3>${DateUtils.rangeSettimana(settimana.settimana, settimana.data_fine)}</h3>
          <p>Pubblicata il ${DateUtils.formatDataOra(settimana.pubblicata_il)}</p>
        </div>
        <span class="stato-badge stato-pubblicata">Pubblicata</span>
      </div>

      <!-- Notifiche scambio in arrivo -->
      ${notifiche}

      <!-- SEZIONE: I miei turni -->
      <div class="collapsible-section">
        <div class="collapsible-header" onclick="toggleSection('sec_miei_turni')">
          <div class="collapsible-header-left">
            <span class="collapsible-icon-wrap">🗓️</span>
            <div>
              <span class="collapsible-title">I miei turni</span>
              <span class="collapsible-sub">${mieiTurniCount} turno${mieiTurniCount !== 1 ? 'i' : ''} assegnato${mieiTurniCount !== 1 ? 'i' : ''}</span>
            </div>
          </div>
          <span class="collapsible-toggle" id="sec_miei_turni_icon">▲</span>
        </div>
        <div id="sec_miei_turni" class="collapsible-body">
          ${buildMieiTurniContent(mieiTurni, settimana.settimana)}
        </div>
      </div>

      <!-- SEZIONE: Tutti i turni della settimana -->
      <div class="collapsible-section">
        <div class="collapsible-header" onclick="toggleSection('sec_tutti_turni')">
          <div class="collapsible-header-left">
            <span class="collapsible-icon-wrap">👥</span>
            <div>
              <span class="collapsible-title">Turni della settimana</span>
              <span class="collapsible-sub">Tocca per vedere chi lavora</span>
            </div>
          </div>
          <span class="collapsible-toggle" id="sec_tutti_turni_icon">▼</span>
        </div>
        <div id="sec_tutti_turni" class="collapsible-body" style="display:none">
          ${buildTuttiTurniContent(tuttiTurni, settimana.settimana)}
        </div>
      </div>

      <!-- SEZIONE: I miei scambi -->
      <div class="collapsible-section">
        <div class="collapsible-header" onclick="toggleSection('sec_scambi')">
          <div class="collapsible-header-left">
            <span class="collapsible-icon-wrap">🔄</span>
            <div>
              <span class="collapsible-title">I miei scambi</span>
              <span class="collapsible-sub">Storico proposte inviate e ricevute</span>
            </div>
          </div>
          <span class="collapsible-toggle" id="sec_scambi_icon">▼</span>
        </div>
        <div id="sec_scambi" class="collapsible-body" style="display:none">
          ${scambiHtml || renderEmpty('🔄', 'Nessuno scambio', 'Le tue proposte appariranno qui.')}
        </div>
      </div>
    `;

  } catch (err) {
    document.getElementById('pageContent').innerHTML = renderEmpty('❌', 'Errore', err.message);
  }
}

// Toggle collapsible section
function toggleSection(id) {
  const body = document.getElementById(id);
  const icon = document.getElementById(id + '_icon');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  if (icon) icon.textContent = isOpen ? '▼' : '▲';
}

// Contenuto "I miei turni" con bottone scambio
function buildMieiTurniContent(turni, settimanaKey) {
  if (!turni.length) {
    return `<div style="padding:20px 0">${renderEmpty('😴', 'Nessun turno assegnato', 'Non sei in turno questa sessione.')}</div>`;
  }

  return gruppiTurniPerGiornoTurno(turni, settimanaKey).map(({ giorno, turno: t, members }) => {
    const emoji   = t === 'mattina' ? '☀️' : '🌙';
    const chipCls = t === 'mattina' ? 'chip-mattina' : 'chip-sera';
    const data    = DateUtils.getDataGiorno(settimanaKey, giorno)
                      .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const membersHtml = members.map(m => {
      const ini = ((m.nome||'')[0]||'') + ((m.cognome||'')[0]||'');
      return `
        <div class="turno-member">
          <div class="member-avatar">${ini.toUpperCase()}</div>
          <div class="member-info">
            <div class="member-name">${m.nome} ${m.cognome}</div>
            ${m.ruolo ? `<div class="member-role">${m.ruolo}</div>` : ''}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="turno-card">
        <div class="turno-card-header">
          <h4>${DateUtils.GIORNI[giorno]} <span style="color:var(--text-muted);font-weight:400">${data}</span></h4>
          <span class="turno-chip ${chipCls}">${emoji} ${t === 'mattina' ? 'Mattina' : 'Sera'}</span>
        </div>
        <div class="turno-members">${membersHtml}</div>
        <div style="padding:4px 18px 14px">
          <button class="btn btn-secondary btn-sm btn-full"
            onclick="apriModaleScambio(${giorno},'${t}','${settimanaKey}')">
            🔄 Proponi scambio
          </button>
        </div>
      </div>`;
  }).join('');
}

// Contenuto "Tutti i turni" raggruppato per giorno
function buildTuttiTurniContent(turni, settimanaKey) {
  if (!turni.length) {
    return `<div style="padding:20px 0">${renderEmpty('📋', 'Nessun turno pubblicato')}</div>`;
  }

  const gruppi = gruppiTurniPerGiornoTurno(turni, settimanaKey);

  // Raggruppa ulteriormente per giorno (mattina + sera affiancati)
  const perGiorno = {};
  gruppi.forEach(g => {
    if (!perGiorno[g.giorno]) perGiorno[g.giorno] = {};
    perGiorno[g.giorno][g.turno] = g.members;
  });

  return Object.entries(perGiorno).sort((a,b) => a[0]-b[0]).map(([giorno, turni]) => {
    const g    = parseInt(giorno);
    const data = DateUtils.getDataGiorno(settimanaKey, g)
                   .toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });

    const renderTurnoSlot = (turnoKey, emoji, chipCls) => {
      const members = turni[turnoKey] || [];
      if (!members.length) return '';
      const nomi = members.map(m => `${m.nome} ${m.cognome}`).join(', ');
      return `
        <div class="tutti-slot">
          <span class="turno-chip ${chipCls}" style="font-size:11px">${emoji} ${turnoKey === 'mattina' ? 'Mattina' : 'Sera'}</span>
          <span class="tutti-slot-nomi">${nomi}</span>
        </div>`;
    };

    return `
      <div class="tutti-giorno-card">
        <div class="tutti-giorno-header">
          <span class="tutti-giorno-label">${DateUtils.GIORNI[g]}</span>
          <span class="tutti-giorno-data">${data}</span>
        </div>
        ${renderTurnoSlot('mattina', '☀️', 'chip-mattina')}
        ${renderTurnoSlot('sera',    '🌙', 'chip-sera')}
      </div>`;
  }).join('');
}

// Sezione "I miei turni" con pulsante scambio
function renderMieiTurniConScambio(turni, settimana) {
  if (!turni.length) {
    return `
      <div class="turni-section">
        <h2>I miei turni</h2>
        ${renderEmpty('😴', 'Nessun turno assegnato', 'Non sei in turno questa sessione.')}
      </div>
    `;
  }

  const cards = gruppiTurniPerGiornoTurno(turni, settimana).map(({ giorno, turno: t, members }) => {
    const nomeGiorno = DateUtils.GIORNI[giorno];
    const chipClass  = t === 'mattina' ? 'chip-mattina' : 'chip-sera';
    const emoji      = t === 'mattina' ? '☀️' : '🌙';
    const data       = DateUtils.getDataGiorno(settimana, giorno);
    const dataStr    = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

    const membersHtml = members.map(m => {
      const initials = (m.nome[0] || '') + (m.cognome[0] || '');
      return `
        <div class="turno-member">
          <div class="member-avatar">${initials.toUpperCase()}</div>
          <div class="member-info">
            <div class="member-name">${m.nome} ${m.cognome}</div>
            ${m.ruolo ? `<div class="member-role">${m.ruolo}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="turno-card">
        <div class="turno-card-header">
          <h4>${nomeGiorno} <span style="color:var(--text-muted);font-weight:400">${dataStr}</span></h4>
          <span class="turno-chip ${chipClass}">${emoji} ${t === 'mattina' ? 'Mattina' : 'Sera'}</span>
        </div>
        <div class="turno-members">${membersHtml}</div>
        <div style="padding:0 18px 14px">
          <button class="btn btn-secondary btn-sm btn-full"
            onclick="apriModaleScambio(${giorno},'${t}','${settimana}')">
            🔄 Proponi scambio
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="turni-section"><h2>I miei turni</h2>${cards}</div>`;
}

// Sezione "I miei turni" (senza scambio — usata nello storico)
function renderMieiTurniSection(turni, settimana) {
  if (!turni.length) {
    return `
      <div class="turni-section">
        <h2>I miei turni</h2>
        ${renderEmpty('😴', 'Nessun turno assegnato', 'Non sei in turno questa settimana.')}
      </div>
    `;
  }

  const cards = gruppiTurniPerGiornoTurno(turni, settimana)
    .map(({ giorno, turno, members }) => renderTurnoCard(giorno, turno, members, settimana))
    .join('');

  return `
    <div class="turni-section">
      <h2>I miei turni</h2>
      ${cards}
    </div>
  `;
}

// Sezione "Tutti i turni"
function renderTuttiTurniSection(turni, settimana) {
  if (!turni.length) {
    return `
      <div class="turni-section">
        <h2>Tutti i turni della settimana</h2>
        ${renderEmpty('📋', 'Nessun turno pubblicato')}
      </div>
    `;
  }

  const cards = gruppiTurniPerGiornoTurno(turni, settimana)
    .map(({ giorno, turno, members }) => renderTurnoCard(giorno, turno, members, settimana))
    .join('');

  return `
    <div class="turni-section">
      <h2>Tutti i turni della settimana</h2>
      ${cards}
    </div>
  `;
}

// Raggruppa turni per giorno+turno, ordinati
function gruppiTurniPerGiornoTurno(turni, settimana) {
  const map = {};
  turni.forEach(t => {
    const key = `${t.giorno}-${t.turno}`;
    if (!map[key]) map[key] = { giorno: t.giorno, turno: t.turno, members: [] };
    const profile = t.profiles || {};
    map[key].members.push({
      nome:    profile.nome    || t.user_id?.slice(0,8) || '?',
      cognome: profile.cognome || '',
      ruolo:   t.ruolo_servizio || profile.ruolo || ''
    });
  });

  return Object.values(map).sort((a, b) => {
    if (a.giorno !== b.giorno) return a.giorno - b.giorno;
    return a.turno === 'mattina' ? -1 : 1;
  });
}

// Render singola card turno
function renderTurnoCard(giorno, turno, members, settimana) {
  const nomeGiorno = DateUtils.GIORNI[giorno];
  const chipClass = turno === 'mattina' ? 'chip-mattina' : 'chip-sera';
  const emoji = turno === 'mattina' ? '☀️' : '🌙';
  const data = DateUtils.getDataGiorno(settimana, giorno);
  const dataStr = data.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  const membersHtml = members.map(m => {
    const initials = (m.nome[0] || '') + (m.cognome[0] || '');
    return `
      <div class="turno-member">
        <div class="member-avatar">${initials.toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${m.nome} ${m.cognome}</div>
          ${m.ruolo ? `<div class="member-role">${m.ruolo}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="turno-card">
      <div class="turno-card-header">
        <h4>${nomeGiorno} <span style="color:var(--text-muted);font-weight:400">${dataStr}</span></h4>
        <span class="turno-chip ${chipClass}">${emoji} ${turno.charAt(0).toUpperCase() + turno.slice(1)}</span>
      </div>
      <div class="turno-members">
        ${membersHtml || '<p style="color:var(--text-muted);font-size:13px">Nessuno assegnato</p>'}
      </div>
    </div>
  `;
}
