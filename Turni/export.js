// ===================================
// EXPORT.JS - Esportazione Excel e PDF
// ===================================

// ===================================
// EXCEL - Formato Turni Sala
// Struttura:
//   Riga 1: Titolo + periodo
//   Riga 2: "Nome" | giorno1-mat | giorno1-sera | giorno2-mat | ...
//   Riga N: nome cognome | ✓ | | ✓ | ...
// ===================================
async function esportaExcel(settimanaKey) {
  if (typeof XLSX === 'undefined') {
    showToast('Libreria Excel non ancora caricata. Riprova.', 'error');
    return;
  }

  showToast('Preparazione Excel...', 'info');

  try {
    const [turni, settimane, profiles] = await Promise.all([
      DB.getTurni(settimanaKey),
      DB.getSettimaneStorico(),
      DB.getAllProfiles()
    ]);

    const settimana = settimane.find(s => s.settimana === settimanaKey);
    const range     = DateUtils.rangeSettimana(settimanaKey, settimana?.data_fine);
    const giorni    = DateUtils.getGiorniSessione(settimanaKey, settimana?.data_fine || settimanaKey);

    // Mappa turni: user_id -> Set di "giorno-turno"
    const turniMap = {};
    turni.forEach(t => {
      if (!turniMap[t.user_id]) turniMap[t.user_id] = new Set();
      turniMap[t.user_id].add(`${t.giorno}-${t.turno}`);
    });

    // Intestazioni colonne: "NOME" + per ogni giorno × turno
    const headerRow = ['NOME'];
    const subHeader = [''];
    giorni.forEach(g => {
      const data = DateUtils.getDataGiorno(settimanaKey, g)
                     .toLocaleDateString('it-IT', { weekday:'short', day:'2-digit', month:'2-digit' });
      headerRow.push(`${DateUtils.GIORNI[g].toUpperCase()}\n${data}`, '');
      subHeader.push('Mattina', 'Sera');
    });

    // Righe persone — solo chi ha almeno un turno assegnato
    const personeConTurni = profiles.filter(p => turniMap[p.id]);

    const righe = personeConTurni.map(p => {
      const row = [`${p.nome} ${p.cognome}`];
      giorni.forEach(g => {
        row.push(turniMap[p.id]?.has(`${g}-mattina`) ? '✓' : '');
        row.push(turniMap[p.id]?.has(`${g}-sera`)    ? '✓' : '');
      });
      return row;
    });

    // Costruzione worksheet
    const wsData = [
      [`TURNI SALA — ${range}`, ...Array(headerRow.length - 1).fill('')],
      [`Pubblicata il ${DateUtils.formatDataOra(settimana?.pubblicata_il)}`, ...Array(headerRow.length - 1).fill('')],
      [],
      headerRow,
      subHeader,
      ...righe
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Larghezze colonne
    ws['!cols'] = [{ wch: 22 }, ...giorni.flatMap(() => [{ wch: 10 }, { wch: 10 }])];

    // Merge celle intestazione giorni (ogni giorno occupa 2 colonne: mat+sera)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } }, // titolo
      { s: { r: 1, c: 0 }, e: { r: 1, c: headerRow.length - 1 } }, // data pubblicazione
    ];
    giorni.forEach((g, i) => {
      const col = 1 + i * 2;
      ws['!merges'].push({ s: { r: 3, c: col }, e: { r: 3, c: col + 1 } });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Turni');

    const nomeFile = `Turni_${settimanaKey}.xlsx`;
    XLSX.writeFile(wb, nomeFile);
    showToast('Excel scaricato!', 'success');

  } catch (err) {
    showToast('Errore export: ' + err.message, 'error');
  }
}

// ===================================
// PDF — Stampa via browser
// ===================================
async function esportaPDF(settimanaKey) {
  showToast('Preparazione PDF...', 'info');

  try {
    const [turni, settimane, profiles] = await Promise.all([
      DB.getTurni(settimanaKey),
      DB.getSettimaneStorico(),
      DB.getAllProfiles()
    ]);

    const settimana = settimane.find(s => s.settimana === settimanaKey);
    const range     = DateUtils.rangeSettimana(settimanaKey, settimana?.data_fine);
    const giorni    = DateUtils.getGiorniSessione(settimanaKey, settimana?.data_fine || settimanaKey);

    // Mappa turni
    const turniMap = {};
    turni.forEach(t => {
      if (!turniMap[t.user_id]) turniMap[t.user_id] = new Set();
      turniMap[t.user_id].add(`${t.giorno}-${t.turno}`);
    });

    const personeConTurni = profiles.filter(p => turniMap[p.id]);

    // Intestazioni
    const colHeaders = giorni.flatMap(g => {
      const data = DateUtils.getDataGiorno(settimanaKey, g)
                     .toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
      return [
        `<th colspan="2" style="text-align:center;background:#EDE6D8">${DateUtils.GIORNI[g]}<br><span style="font-weight:400;font-size:11px">${data}</span></th>`
      ];
    }).join('');

    const subHeaders = giorni.flatMap(() => [
      '<th style="background:#F5F2ED;font-size:11px">☀️ Mat</th>',
      '<th style="background:#F5F2ED;font-size:11px">🌙 Sera</th>'
    ]).join('');

    const righe = personeConTurni.map((p, i) => {
      const cells = giorni.flatMap(g => [
        `<td style="text-align:center;font-size:16px">${turniMap[p.id]?.has(`${g}-mattina`) ? '✓' : ''}</td>`,
        `<td style="text-align:center;font-size:16px">${turniMap[p.id]?.has(`${g}-sera`)    ? '✓' : ''}</td>`
      ]).join('');
      const bg = i % 2 === 0 ? '#ffffff' : '#FAF8F5';
      return `<tr style="background:${bg}">
        <td style="font-weight:600;padding:8px 12px">${p.nome} ${p.cognome}</td>
        ${cells}
      </tr>`;
    }).join('');

    const htmlStampa = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <title>Turni ${range}</title>
        <style>
          @page { size: landscape; margin: 1.5cm; }
          body { font-family: 'Arial', sans-serif; font-size: 13px; color: #2C2824; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1a1a1a; }
          p  { font-size: 12px; color: #6B6458; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; border: 1px solid #E0D8C8; }
          th, td { border: 1px solid #E0D8C8; padding: 6px 8px; }
          th { font-weight: 700; color: #2C2824; }
          .header-logo { font-size: 22px; margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="header-logo">🍽️ La Contessa</div>
        <h1>Turni Sala — ${range}</h1>
        <p>Pubblicata il ${DateUtils.formatDataOra(settimana?.pubblicata_il)}</p>
        <table>
          <thead>
            <tr>
              <th rowspan="2" style="background:#D4C8AB;min-width:140px">Nome</th>
              ${colHeaders}
            </tr>
            <tr>${subHeaders}</tr>
          </thead>
          <tbody>${righe}</tbody>
        </table>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=1000,height=700');
    win.document.write(htmlStampa);
    win.document.close();
    setTimeout(() => win.print(), 500);

  } catch (err) {
    showToast('Errore PDF: ' + err.message, 'error');
  }
}
