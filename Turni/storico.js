// ===================================
// STORICO.JS - Storico mensile completo
// ===================================

async function renderStorico(vista = 'mese', payload = null) {
  const app = document.getElementById('app');
  app.innerHTML = renderNavbar('storico') + `<div class="page" id="pageContent">${renderLoading()}</div>`;

  try {
    if (vista === 'dettaglio-mese')   await renderStoricoMeseDettaglio(payload);
    else if (vista === 'settimana')   await renderStoricoDettaglio(payload);
    else                              await renderStoricoHome();
  } catch (err) {
    document.getElementById('pageContent').innerHTML = renderEmpty('❌', 'Errore', err.message);
  }
}

// ===================================
// HOME: statistiche mensili
// ===================================
async function renderStoricoHome() {
  const userId = AppState.user.id;
  const isManager = ['manager_turni','super_admin'].includes(AppState.profile?.ruolo);

  const [disponibilita, turni, settimane] = await Promise.all([
    DB.getStoricaDisponibilita(userId),
    DB.getAllTurniUtente(userId),
    DB.getSettimaneStorico()
  ]);

  // Raggruppa per mese (YYYY-MM)
  const mesiMap = {};

  disponibilita.forEach(d => {
    const mese = d.settimana.slice(0, 7); // "2026-07"
    if (!mesiMap[mese]) mesiMap[mese] = { disp: 0, turni: 0 };
    mesiMap[mese].disp++;
  });

  turni.forEach(t => {
    const mese = t.settimana.slice(0, 7);
    if (!mesiMap[mese]) mesiMap[mese] = { disp: 0, turni: 0 };
    mesiMap[mese].turni++;
  });

  const mesiOrdinati = Object.entries(mesiMap).sort((a, b) => b[0].localeCompare(a[0]));

  const totDisp  = disponibilita.length;
  const totTurni = turni.length;

  // Header statistiche totali
  const statsHtml = `
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-box-num">${totTurni}</div>
        <div class="stat-box-label">Turni lavorati</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-num">${totDisp}</div>
        <div class="stat-box-label">Disponibilità date</div>
      </div>
      <div class="stat-box">
        <div class="stat-box-num">${mesiOrdinati.length}</div>
        <div class="stat-box-label">Mesi attivi</div>
      </div>
    </div>
  `;

  // Card per ogni mese
  const mesiHtml = mesiOrdinati.length
    ? mesiOrdinati.map(([mese, dati]) => {
        const [anno, m] = mese.split('-');
        const nomeMese = new Date(parseInt(anno), parseInt(m)-1, 1)
          .toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
        const percLavoro = dati.disp > 0 ? Math.round((dati.turni / dati.disp) * 100) : 0;
        return `
          <div class="mese-card" onclick="renderStorico('dettaglio-mese','${mese}')">
            <div class="mese-card-header">
              <span class="mese-nome">${nomeMese}</span>
              <span class="mese-arrow">›</span>
            </div>
            <div class="mese-stats">
              <div class="mese-stat">
                <span class="mese-stat-num">${dati.turni}</span>
                <span class="mese-stat-label">turni</span>
              </div>
              <div class="mese-divider"></div>
              <div class="mese-stat">
                <span class="mese-stat-num">${dati.disp}</span>
                <span class="mese-stat-label">disponibilità</span>
              </div>
              <div class="mese-divider"></div>
              <div class="mese-stat">
                <span class="mese-stat-num">${percLavoro}%</span>
                <span class="mese-stat-label">confermato</span>
              </div>
            </div>
            <div class="progress-bar-wrap" style="margin-top:10px">
              <div class="progress-bar-fill" style="width:${percLavoro}%"></div>
            </div>
          </div>
        `;
      }).join('')
    : renderEmpty('📅', 'Nessuno storico', 'Le tue attività passate appariranno qui.');

  // Settimane pubblicate (per tutti)
  const settimaneHtml = settimane.length
    ? `
      <h2 class="section-title" style="margin-top:28px">📋 Settimane pubblicate</h2>
      <div class="storico-list">
        ${settimane.map(s => `
          <div class="storico-card">
            <div class="storico-card-header">
              <div>
                <h3>${DateUtils.rangeSettimana(s.settimana, s.data_fine)}</h3>
                <p>Pubblicata il ${DateUtils.formatDataOra(s.pubblicata_il)}</p>
              </div>
              <span class="stato-badge stato-pubblicata">Pubblicata</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px">
              <button class="btn btn-secondary btn-sm" style="flex:1"
                onclick="renderStorico('settimana','${s.settimana}')">
                📂 Apri
              </button>
              ${isManager ? `
                <button class="btn btn-secondary btn-sm" style="flex:1"
                  onclick="esportaExcel('${s.settimana}')">
                  📊 Excel
                </button>
                <button class="btn btn-secondary btn-sm" style="flex:1"
                  onclick="esportaPDF('${s.settimana}')">
                  🖨️ PDF
                </button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`
    : '';

  document.getElementById('pageContent').innerHTML = `
    <h2 class="section-title">Il mio storico</h2>
    ${statsHtml}
    <h2 class="section-title" style="margin-top:20px">Per mese</h2>
    ${mesiHtml}
    ${settimaneHtml}
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
// DETTAGLIO SETTIMANA (sola lettura)
// ===================================
async function renderStoricoDettaglio(settimanaKey) {
  const userId = AppState.user.id;
  const isManager = ['manager_turni','super_admin'].includes(AppState.profile?.ruolo);

  const [turni, settimane] = await Promise.all([
    DB.getTurni(settimanaKey),
    DB.getSettimaneStorico()
  ]);

  const settimana = settimane.find(s => s.settimana === settimanaKey);
  const mieiTurni = turni.filter(t => t.user_id === userId);

  document.getElementById('pageContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button class="btn btn-secondary btn-sm" onclick="renderStorico()">← Storico</button>
      <span style="font-size:15px;font-weight:600">
        ${DateUtils.rangeSettimana(settimanaKey, settimana?.data_fine)}
      </span>
    </div>

    <div class="settimana-banner" style="margin-bottom:20px">
      <div class="settimana-banner-info">
        <h3>${DateUtils.rangeSettimana(settimanaKey, settimana?.data_fine)}</h3>
        <p>Pubblicata il ${settimana ? DateUtils.formatDataOra(settimana.pubblicata_il) : '-'}</p>
      </div>
      <span class="stato-badge stato-pubblicata">Storico</span>
    </div>

    ${isManager ? `
      <div style="display:flex;gap:10px;margin-bottom:20px">
        <button class="btn btn-secondary" style="flex:1" onclick="esportaExcel('${settimanaKey}')">
          📊 Esporta Excel
        </button>
        <button class="btn btn-secondary" style="flex:1" onclick="esportaPDF('${settimanaKey}')">
          🖨️ Stampa PDF
        </button>
      </div>` : ''}

    ${renderMieiTurniSection(mieiTurni, settimanaKey)}
    ${renderTuttiTurniSection(turni, settimanaKey)}
  `;
}
