// ===================================
// STORICO.JS - Storico ultime 5 settimane
// ===================================

async function renderStorico(vista = 'ultime5', payload = null) {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar('storico') + `<div class="page" id="pageContent">${renderLoading()}</div>`;

  try {
    if (vista === 'settimana') await renderStoricoDettaglio(payload);
    else                       await renderStoricoHome();
  } catch (err) {
    document.getElementById('pageContent').innerHTML = renderEmpty('❌', 'Errore', err.message);
  }
}

// ===================================
// HOME: ultime 5 settimane
// ===================================
async function renderStoricoHome() {
  const userId = AppState.user.id;
  const isManager = ['manager_turni','super_admin'].includes(AppState.profile?.ruolo);

  const [disponibilita, turni, settimane] = await Promise.all([
    DB.getStoricaDisponibilita(userId),
    DB.getAllTurniUtente(userId),
    DB.getSettimaneStorico()
  ]);

  // Mostra solo le ultime 5 settimane pubblicate
  const ultime5 = settimane.slice(0, 5);

  if (!ultime5.length) {
    document.getElementById('pageContent').innerHTML =
      renderEmpty('📅', 'Nessuno storico', 'Le ultime 5 settimane pubblicate appariranno qui.');
    return;
  }

  const cardsHtml = ultime5.map(s => {
    const dispSettimana  = disponibilita.filter(d => d.settimana === s.settimana);
    const turniSettimana = turni.filter(t => t.settimana === s.settimana);

    return `
      <div class="settimana-5w-card">
        <div class="settimana-5w-periodo">
          ${DateUtils.rangeSettimana(s.settimana, s.data_fine)}
        </div>
        <div class="settimana-5w-stats">
          <div class="settimana-5w-stat">
            <div class="settimana-5w-num">${dispSettimana.length}</div>
            <div class="settimana-5w-label">Disponibilità inviate</div>
          </div>
          <div class="settimana-5w-divider"></div>
          <div class="settimana-5w-stat">
            <div class="settimana-5w-num">${turniSettimana.length}</div>
            <div class="settimana-5w-label">Turni lavorati</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-full settimana-5w-btn"
          onclick="renderStorico('settimana','${s.settimana}')">
          📂 Apri Dettaglio
        </button>
      </div>
    `;
  }).join('');

  document.getElementById('pageContent').innerHTML = `
    <h2 class="section-title">Ultime 5 settimane</h2>
    ${cardsHtml}
    ${isManager ? `
      <div style="margin-top:24px">
        <h2 class="section-title">Esporta</h2>
        ${ultime5.map(s => `
          <div class="export-row">
            <span class="export-row-label">${DateUtils.rangeSettimana(s.settimana, s.data_fine)}</span>
            <button class="btn btn-secondary btn-sm" onclick="esportaExcel('${s.settimana}')">📊 Excel</button>
            <button class="btn btn-secondary btn-sm" onclick="esportaPDF('${s.settimana}')">🖨️ PDF</button>
          </div>
        `).join('')}
      </div>` : ''}
  `;
}

// ===================================
// DETTAGLIO MESE: giorni precisi
// ===================================
async function renderStoricoMeseDettaglio(mese) {
  const userId = AppState.user.id;
  const [anno, m] = mese.split('-');
  const nomeMese = new Date(parseInt(anno), parseInt(m)-1, 1)
    .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  const [disponibilita, turni] = await Promise.all([
    DB.getStoricaDisponibilita(userId),
    DB.getAllTurniUtente(userId)
  ]);

  const dispMese  = disponibilita.filter(d => d.settimana.startsWith(mese));
  const turniMese = turni.filter(t => t.settimana.startsWith(mese));

  // Raggruppa per sessione
  const sessioni = {};
  [...new Set([...dispMese.map(d=>d.settimana), ...turniMese.map(t=>t.settimana)])].forEach(s => {
    sessioni[s] = {
      disp:  dispMese.filter(d=>d.settimana===s),
      turni: turniMese.filter(t=>t.settimana===s)
    };
  });

  const sessioniHtml = Object.entries(sessioni).sort((a,b)=>b[0].localeCompare(a[0])).map(([sett, dati]) => {
    const dispItems = dati.disp.map(d => {
      const data  = DateUtils.getDataGiorno(sett, d.giorno)
                      .toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'2-digit' });
      const turno = d.turno === 'mattina' ? '☀️' : '🌙';
      return `<span class="disp-chip">${turno} ${data}</span>`;
    }).join('');

    const turniItems = dati.turni.map(t => {
      const data  = DateUtils.getDataGiorno(sett, t.giorno)
                      .toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'2-digit' });
      const turno = t.turno === 'mattina' ? '☀️' : '🌙';
      return `<span class="disp-chip" style="background:var(--success-bg);border-color:var(--success-border);color:var(--success)">${turno} ${data}</span>`;
    }).join('');

    return `
      <div class="mese-sessione-card">
        <div class="mese-sessione-header">
          <span class="mese-sessione-range">Sessione ${DateUtils.rangeSettimana(sett)}</span>
          <div style="display:flex;gap:8px">
            <span class="disp-chip" style="background:var(--success-bg);color:var(--success)">✓ ${dati.turni.length} turni</span>
            <span class="disp-chip">📋 ${dati.disp.length} disp.</span>
          </div>
        </div>
        ${dati.turni.length ? `
          <div style="margin-bottom:10px">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">
              Turni lavorati
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:6px">${turniItems}</div>
          </div>` : ''}
        ${dati.disp.length ? `
          <div>
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:6px">
              Disponibilità date
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:6px">${dispItems}</div>
          </div>` : ''}
      </div>
    `;
  }).join('');

  document.getElementById('pageContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn btn-secondary btn-sm" onclick="renderStorico()">← Storico</button>
      <span style="font-size:16px;font-weight:700;text-transform:capitalize">${nomeMese}</span>
    </div>
    <div class="stats-row" style="margin-bottom:20px">
      <div class="stat-box">
        <div class="stat-box-num">${turniMese.length}</div>
        <div class="stat-box-label">Turni lavorati</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-num">${dispMese.length}</div>
        <div class="stat-box-label">Disponibilità</div>
      </div>
    </div>
    ${sessioniHtml || renderEmpty('📅','Nessun dato per questo mese')}
  `;
}

// ===================================
// DETTAGLIO SETTIMANA — griglia disponibilità vs turni
// ===================================
async function renderStoricoDettaglio(settimanaKey) {
  const userId = AppState.user.id;
  const isManager = ['manager_turni','super_admin'].includes(AppState.profile?.ruolo);

  const [disponibilita, turni, settimane] = await Promise.all([
    DB.getDisponibilitaUtente(userId, settimanaKey),
    DB.getTurniUtente(userId, settimanaKey),
    DB.getSettimaneStorico()
  ]);

  const settimana = settimane.find(s => s.settimana === settimanaKey);

  // Lookup: "giorno-turno" → true
  const dispMap  = {};
  disponibilita.forEach(d => { if (d.disponibile) dispMap[`${d.giorno}-${d.turno}`] = true; });
  const turniMap = {};
  turni.forEach(t => { turniMap[`${t.giorno}-${t.turno}`] = true; });

  const giorniAttivi = DateUtils.getGiorniSessione(
    settimanaKey,
    settimana?.data_fine || settimanaKey
  );

  const righeGrid = giorniAttivi.map(g => {
    const renderCella = (turno) => {
      const haTurno = turniMap[`${g}-${turno}`];
      const haDisp  = dispMap[`${g}-${turno}`];
      if (haTurno)      return `<span class="tg-cell tg-cell-turno" title="Turno assegnato">🟦</span>`;
      if (haDisp)       return `<span class="tg-cell tg-cell-disp"  title="Disponibilità inviata">🟩</span>`;
      return `<span class="tg-cell tg-cell-empty" title="Nessuno">⬜</span>`;
    };
    const data = DateUtils.getDataGiorno(settimanaKey, g)
                   .toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `
      <div class="tg-row">
        <div class="tg-day">
          <span class="tg-day-name">${DateUtils.GIORNI[g]}</span>
          <span class="tg-day-date">${data}</span>
        </div>
        <div class="tg-cell-wrap">${renderCella('mattina')}</div>
        <div class="tg-cell-wrap">${renderCella('sera')}</div>
      </div>
    `;
  }).join('');

  const totDisp  = disponibilita.filter(d => d.disponibile).length;
  const totTurni = turni.length;

  document.getElementById('pageContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn btn-secondary btn-sm" onclick="renderStorico()">← Storico</button>
      <span style="font-size:15px;font-weight:600">
        ${DateUtils.rangeSettimana(settimanaKey, settimana?.data_fine)}
      </span>
    </div>

    <div class="stats-row" style="margin-bottom:20px">
      <div class="stat-box">
        <div class="stat-box-num">${totTurni}</div>
        <div class="stat-box-label">Turni lavorati</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-num">${totDisp}</div>
        <div class="stat-box-label">Disponibilità date</div>
      </div>
    </div>

    <div class="tg-card">
      <div class="tg-header">
        <div class="tg-header-day"></div>
        <div class="tg-header-col">☀️ Mattina</div>
        <div class="tg-header-col">🌙 Sera</div>
      </div>
      ${righeGrid}
    </div>

    <div class="tg-legend">
      <span class="tg-legend-item">🟩 Disponibilità</span>
      <span class="tg-legend-item">🟦 Turno assegnato</span>
      <span class="tg-legend-item">⬜ Nessuno</span>
    </div>

    ${isManager ? `
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn-secondary" style="flex:1" onclick="esportaExcel('${settimanaKey}')">
          📊 Esporta Excel
        </button>
        <button class="btn btn-secondary" style="flex:1" onclick="esportaPDF('${settimanaKey}')">
          🖨️ Stampa PDF
        </button>
      </div>` : ''}
  `;
}
