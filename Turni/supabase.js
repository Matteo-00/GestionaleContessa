// ===================================
// SUPABASE CLIENT - Modulo Turni
// ===================================

const SUPABASE_URL = 'https://zlyikcrrwjxmvoigqpdi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpseWlrY3Jyd2p4bXZvaWdxcGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzIxMTEsImV4cCI6MjA4MzQ0ODExMX0.QaRjSOSWjq0zBZtIvM0fSgqJSgIxpfwaHEfyB-j-Q5w';

// Codice segreto per registrarsi come responsabile turni.
// Cambialo con una parola che solo il responsabile conosce.
const CODICE_MANAGER  = 'cont3ssa2026Master!';

// Codice segreto per registrarsi come cameriere.
// Necessario per evitare registrazioni non autorizzate.
const CODICE_CAMERIERE = 'camerieriCont3ssa2026!';

// Client Supabase globale
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================================
// HELPER: Gestione errori uniforme
// ===================================
function dbError(error, msg = 'Errore database') {
  console.error(msg, error);
  throw new Error(error?.message || msg);
}

// ===================================
// AUTH HELPERS
// ===================================
const Auth = {
  async getSession() {
    const { data } = await sb.auth.getSession();
    return data.session;
  },

  async getUser() {
    const { data } = await sb.auth.getUser();
    return data.user;
  },

  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) dbError(error, 'Errore login');
    return data;
  },

  async register(email, password, metadata = {}) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: metadata }  // nome, cognome, ruolo passati al trigger
    });
    if (error) dbError(error, 'Errore registrazione');
    return data;
  },

  async logout() {
    const { error } = await sb.auth.signOut();
    if (error) dbError(error, 'Errore logout');
  },

  onAuthChange(callback) {
    return sb.auth.onAuthStateChange(callback);
  }
};

// ===================================
// DATABASE HELPERS
// ===================================
const DB = {

  // --- Profiles ---
  async getProfile(userId) {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') dbError(error, 'Errore profilo');
    return data;
  },

  async createProfile(userId, nome, cognome, ruolo = 'cameriere') {
    const { data, error } = await sb
      .from('profiles')
      .upsert({ id: userId, nome, cognome, ruolo, attivo: true }, { onConflict: 'id' })
      .select()
      .single();
    if (error) dbError(error, 'Errore creazione profilo');
    return data;
  },

  async getAllProfiles() {
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .neq('attivo', false)   // include attivo=true E attivo=null (profili vecchi)
      .order('cognome');
    if (error) dbError(error, 'Errore profili');
    return data || [];
  },

  // Disattiva (elimina logicamente) un profilo: non compare più in nessuna lista
  // e non può più essere usato per accedere. Non cancella l'account di autenticazione.
  async disattivaProfilo(userId) {
    const { error } = await sb
      .from('profiles')
      .update({ attivo: false })
      .eq('id', userId);
    if (error) dbError(error, 'Errore eliminazione utente');
  },

  // --- Settimane ---
  async getSettimanaCorrente() {
    // Prende la sessione creata più di recente
    const { data, error } = await sb
      .from('settimane')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, 'Errore settimana corrente');
    return data;
  },

  async createSettimana(dataInizio, dataFine) {
    const { data, error } = await sb
      .from('settimane')
      .insert({ settimana: dataInizio, data_fine: dataFine, stato: 'aperta' })
      .select()
      .single();
    if (error) dbError(error, 'Errore creazione sessione');
    return data;
  },

  async updateStatoSettimana(settimana, stato) {
    const update = { stato };
    if (stato === 'pubblicata') update.pubblicata_il = new Date().toISOString();
    const { data, error } = await sb
      .from('settimane')
      .update(update)
      .eq('settimana', settimana)
      .select()
      .single();
    if (error) dbError(error, 'Errore aggiornamento stato settimana');
    return data;
  },

  async getSettimaneStorico() {
    const { data, error } = await sb
      .from('settimane')
      .select('*')
      .eq('stato', 'pubblicata')
      .order('settimana', { ascending: false });
    if (error) dbError(error, 'Errore storico settimane');
    return data || [];
  },

  // Elimina completamente e definitivamente una sessione di lavoro:
  // turni assegnati, disponibilità inviate e richieste di scambio collegate.
  async eliminaSessione(settimana) {
    const { error: errScambi } = await sb.from('richieste_scambio').delete().eq('settimana', settimana);
    if (errScambi) dbError(errScambi, 'Errore eliminazione richieste scambio');

    const { error: errTurni } = await sb.from('turni').delete().eq('settimana', settimana);
    if (errTurni) dbError(errTurni, 'Errore eliminazione turni');

    const { error: errDisp } = await sb.from('disponibilita').delete().eq('settimana', settimana);
    if (errDisp) dbError(errDisp, 'Errore eliminazione disponibilità');

    const { error: errConf } = await sb.from('turni_configurazione').delete().eq('settimana', settimana);
    if (errConf) dbError(errConf, 'Errore eliminazione config turni');

    const { error: errSett } = await sb.from('settimane').delete().eq('settimana', settimana);
    if (errSett) dbError(errSett, 'Errore eliminazione sessione');
  },

  // --- Configurazione Turni (numero camerieri previsti) ---
  async getTurnoConfig(settimana, giorno, turno) {
    const { data, error } = await sb
      .from('turni_configurazione')
      .select('*')
      .eq('settimana', settimana)
      .eq('giorno', parseInt(giorno))
      .eq('turno', turno)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') dbError(error, 'Errore config turno');
    return data; // null se non esiste
  },

  async setTurnoConfig(settimana, giorno, turno, camerieri_richiesti) {
    const { data, error } = await sb
      .from('turni_configurazione')
      .upsert({ settimana, giorno: parseInt(giorno), turno, camerieri_richiesti },
               { onConflict: 'settimana,giorno,turno' })
      .select()
      .single();
    if (error) dbError(error, 'Errore salvataggio config turno');
    return data;
  },

  async getAllTurniConfig(settimana) {
    const { data, error } = await sb
      .from('turni_configurazione')
      .select('*')
      .eq('settimana', settimana);
    if (error) dbError(error, 'Errore config turni sessione');
    return data || [];
  },

  // --- Disponibilità ---
  async getDisponibilita(settimana) {
    const { data, error } = await sb
      .from('disponibilita')
      .select('*')
      .eq('settimana', settimana);
    if (error) dbError(error, 'Errore disponibilità');
    return data || [];
  },

  async getDisponibilitaUtente(userId, settimana) {
    const { data, error } = await sb
      .from('disponibilita')
      .select('*')
      .eq('user_id', userId)
      .eq('settimana', settimana);
    if (error) dbError(error, 'Errore disponibilità utente');
    return data || [];
  },

  // Restituisce i user_id che hanno dato disponibilità per un turno specifico
  // Query server-side: Supabase usa i tipi corretti delle colonne, evita mismatch JS
  async getDisponibiliPerTurno(settimana, giorno, turno, excludeUserId) {
    const { data, error } = await sb
      .from('disponibilita')
      .select('user_id')
      .eq('settimana', settimana)
      .eq('giorno', parseInt(giorno))
      .eq('turno', turno)
      .eq('disponibile', true)
      .neq('user_id', excludeUserId);
    if (error) dbError(error, 'Errore disponibili per turno');
    return (data || []).map(d => d.user_id);
  },

  // Tutti i turni di un utente (storico completo)
  async getAllTurniUtente(userId) {
    const { data, error } = await sb
      .from('turni')
      .select('*')
      .eq('user_id', userId)
      .order('settimana', { ascending: false });
    if (error) dbError(error, 'Errore storico turni');
    return data || [];
  },

  // Tutte le disponibilità di un utente (per lo storico), ordinate dalla più recente
  async getStoricaDisponibilita(userId) {
    const { data, error } = await sb
      .from('disponibilita')
      .select('*')
      .eq('user_id', userId)
      .eq('disponibile', true)
      .order('settimana', { ascending: false })
      .order('giorno',    { ascending: true });
    if (error) dbError(error, 'Errore storico disponibilità');
    return data || [];
  },

  async upsertDisponibilita(records) {
    const { data, error } = await sb
      .from('disponibilita')
      .upsert(records, { onConflict: 'user_id,settimana,giorno,turno' });
    if (error) dbError(error, 'Errore salvataggio disponibilità');
    return data;
  },

  // --- Turni ---
  async getTurni(settimana) {
    const { data, error } = await sb
      .from('turni')
      .select('*')
      .eq('settimana', settimana);
    if (error) dbError(error, 'Errore turni');
    return this._mergeProfiles(data || []);
  },

  async getTurniUtente(userId, settimana) {
    const { data, error } = await sb
      .from('turni')
      .select('*')
      .eq('user_id', userId)
      .eq('settimana', settimana);
    if (error) dbError(error, 'Errore turni utente');
    // Merge profilo dell'utente corrente
    return this._mergeProfiles(data || []);
  },

  // Carica i profili degli utenti presenti nell'array e li unisce come .profiles
  async _mergeProfiles(items) {
    if (!items.length) return items;
    const ids = [...new Set(items.map(t => t.user_id).filter(Boolean))];
    const { data: profs } = await sb
      .from('profiles')
      .select('id, nome, cognome, ruolo')
      .in('id', ids);
    const map = {};
    (profs || []).forEach(p => { map[p.id] = p; });
    return items.map(t => ({ ...t, profiles: map[t.user_id] || null }));
  },

  async upsertTurni(records) {
    const { data, error } = await sb
      .from('turni')
      .upsert(records, { onConflict: 'user_id,settimana,giorno,turno' });
    if (error) dbError(error, 'Errore salvataggio turni');
    return data;
  },

  async deleteTurni(settimana, giorno, turno) {
    const { error } = await sb
      .from('turni')
      .delete()
      .eq('settimana', settimana)
      .eq('giorno', giorno)
      .eq('turno', turno);
    if (error) dbError(error, 'Errore eliminazione turni');
  },

  // --- Richieste Scambio ---
  async getRichiesteInAttesa(userId) {
    // Richieste ricevute in attesa di risposta del ricevente
    const { data, error } = await sb
      .from('richieste_scambio')
      .select('*, cedente:profiles!user_cedente(nome,cognome), ricevente:profiles!user_ricevente(nome,cognome)')
      .eq('user_ricevente', userId)
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });
    if (error) dbError(error, 'Errore richieste in attesa');
    return data || [];
  },

  async getRichiesteAccettate(settimana) {
    // Scambi accettati dal ricevente, in attesa di approvazione manager
    const { data, error } = await sb
      .from('richieste_scambio')
      .select('*, cedente:profiles!user_cedente(nome,cognome), ricevente:profiles!user_ricevente(nome,cognome)')
      .eq('settimana', settimana)
      .eq('stato', 'accettata')
      .order('created_at', { ascending: false });
    if (error) dbError(error, 'Errore richieste accettate');
    return data || [];
  },

  async getMieRichieste(userId) {
    // Tutte le richieste inviate o ricevute dall'utente
    const { data, error } = await sb
      .from('richieste_scambio')
      .select('*, cedente:profiles!user_cedente(nome,cognome), ricevente:profiles!user_ricevente(nome,cognome)')
      .or(`user_cedente.eq.${userId},user_ricevente.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) dbError(error, 'Errore mie richieste');
    return data || [];
  },

  async createRichiestaScambio(record) {
    const { data, error } = await sb
      .from('richieste_scambio')
      .insert(record)
      .select()
      .single();
    if (error) dbError(error, 'Errore creazione richiesta scambio');
    return data;
  },

  async updateRichiestaScambio(id, updates) {
    const { data, error } = await sb
      .from('richieste_scambio')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) dbError(error, 'Errore aggiornamento scambio');
    return data;
  },

  // --- Equità Turni ---

  // Restituisce i key delle ultime 5 settimane pubblicate
  async getUltime5Settimane() {
    const { data, error } = await sb
      .from('settimane')
      .select('settimana')
      .eq('stato', 'pubblicata')
      .order('settimana', { ascending: false })
      .limit(5);
    if (error) dbError(error, 'Errore ultime 5 settimane');
    return (data || []).map(s => s.settimana);
  },

  // Per un giorno+turno specifico, restituisce {userId: conteggio} nelle ultime N settimane
  async getEquitaCounts(giorno, turno, settimaneKeys) {
    if (!settimaneKeys.length) return {};
    const { data, error } = await sb
      .from('turni')
      .select('user_id')
      .in('settimana', settimaneKeys)
      .eq('giorno', parseInt(giorno))
      .eq('turno', turno);
    if (error) dbError(error, 'Errore conteggio equità');
    const counts = {};
    (data || []).forEach(t => {
      counts[t.user_id] = (counts[t.user_id] || 0) + 1;
    });
    return counts;
  },

  // Elimina automaticamente le settimane più vecchie tenendo solo le ultime 5 pubblicate
  async eliminaSettimaneVecchie() {
    const { data, error } = await sb
      .from('settimane')
      .select('settimana')
      .eq('stato', 'pubblicata')
      .order('settimana', { ascending: true });
    if (error) dbError(error, 'Errore pulizia settimane');
    const tutte = (data || []).map(s => s.settimana);
    if (tutte.length <= 5) return;
    const daEliminare = tutte.slice(0, tutte.length - 5);
    for (const s of daEliminare) {
      await sb.from('disponibilita').delete().eq('settimana', s);
      await sb.from('turni').delete().eq('settimana', s);
      await sb.from('settimane').delete().eq('settimana', s);
    }
  }
};

// ===================================
// UTILS DATE
// ===================================
const DateUtils = {

  // Converte un Date in stringa YYYY-MM-DD usando la data LOCALE
  // (evita il bug UTC+2: toISOString() restituisce la data UTC che in Italia
  //  è indietro di 1 giorno rispetto alla data locale)
  _toLocalDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  // Restituisce la data del lunedì della settimana corrente in formato YYYY-MM-DD
  getLunediCorrente() {
    const oggi = new Date();
    const dayOfWeek = oggi.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lunedi = new Date(oggi);
    lunedi.setDate(oggi.getDate() + diff);
    return this._toLocalDateStr(lunedi);
  },

  // Lunedì della settimana che contiene dataStr
  getLunediDiData(dataStr) {
    const d = new Date(dataStr + 'T00:00:00');
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    return this._toLocalDateStr(d);
  },

  // Calcola la data di un giorno (1=lun,7=dom) partendo dal lunedì della settimana di settimanaKey
  getDataGiorno(settimanaKey, giorno) {
    const lunedi = this.getLunediDiData(settimanaKey);
    const base = new Date(lunedi + 'T00:00:00');
    base.setDate(base.getDate() + (giorno - 1));
    return base;
  },

  // Restituisce array di numeri giorno (1-7) compresi tra dataInizio e dataFine
  getGiorniSessione(dataInizio, dataFine) {
    const giorni = [];
    const start = new Date(dataInizio + 'T00:00:00');
    const end = new Date(dataFine + 'T00:00:00');
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getDay();
      giorni.push(dow === 0 ? 7 : dow); // 1=lun, 7=dom
      cur.setDate(cur.getDate() + 1);
    }
    return giorni;
  },

  // Data di oggi in formato YYYY-MM-DD (locale)
  oggi() {
    return this._toLocalDateStr(new Date());
  },

  // Formatta data in italiano
  formatData(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  // Formatta data+ora in italiano
  formatDataOra(isoStr) {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  },

  // Nomi giorni
  GIORNI: ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],

  // Range sessione: "14/07 – 18/07/2026"
  rangeSettimana(dataInizio, dataFine) {
    const s = new Date(dataInizio + 'T00:00:00');
    const e = dataFine ? new Date(dataFine + 'T00:00:00') : (() => { const d = new Date(s); d.setDate(d.getDate()+6); return d; })();
    const fmt = (d) => d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `${fmt(s)} – ${fmt(e)}/${e.getFullYear()}`;
  }
};
