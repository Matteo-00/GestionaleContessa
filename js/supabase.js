// Configurazione Supabase
const supabaseUrl = 'https://zlyikcrrwjxmvoigqpdi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpseWlrY3Jyd2p4bXZvaWdxcGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzIxMTEsImV4cCI6MjA4MzQ0ODExMX0.QaRjSOSWjq0zBZtIvM0fSgqJSgIxpfwaHEfyB-j-Q5w';
// sb_publishable_lFhwqKcPUN_IhGTgPacqkg_2wEx45Yz
// Crea il client Supabase globale
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Funzioni helper per database - Usa solo la tabella "Prodotto"
window.db = {
  // Mappa i dati della tabella Prodotto al formato dell'app
  mapFromDB(row) {
    return {
      id: row.Id,
      product: row.NomeProdotto,
      supplier: row.NomeFornitore,
      price: parseFloat(row.PrezzoAl) || 0,
      quantity: parseFloat(row.Quantità) || 0,
      unit: row.Unità || 'kg',
      date: row.DataAcquisto,
      description: row.Descrizione || '',
      rating: parseFloat(row.rating) || 0,
      lastPurchaseDate: row.DataAcquisto
    };
  },

  // Mappa i dati dell'app al formato della tabella Prodotto
  mapToDB(purchase) {
    return {
      NomeProdotto: purchase.product,
      NomeFornitore: purchase.supplier,
      PrezzoAl: purchase.price,
      Quantità: purchase.quantity || 0,
      Unità: purchase.unit || 'kg',
      DataAcquisto: purchase.date,
      Descrizione: purchase.description || '',
      rating: purchase.rating || 0
    };
  },

  // === PURCHASES ===
  async getAllPurchases() {
    const { data, error } = await supabaseClient
      .from('Prodotto')
      .select('*')
      .order('DataAcquisto', { ascending: false });
    
    if (error) {
      console.error('Errore nel caricamento acquisti:', error);
      return [];
    }
    return (data || []).map(row => this.mapFromDB(row));
  },

  async addPurchase(purchase) {
    const dbData = this.mapToDB(purchase);
    const { data, error } = await supabaseClient
      .from('Prodotto')
      .insert([dbData])
      .select();
    
    if (error) {
      console.error('Errore nel salvataggio acquisto:', error);
      throw error;
    }
    return this.mapFromDB(data[0]);
  },

  async updatePurchase(id, updates) {
    const dbData = this.mapToDB(updates);
    const { data, error } = await supabaseClient
      .from('Prodotto')
      .update(dbData)
      .eq('Id', id)
      .select();
    
    if (error) {
      console.error('Errore nell\'aggiornamento acquisto:', error);
      throw error;
    }
    return this.mapFromDB(data[0]);
  },

  async deletePurchase(id) {
    const { error } = await supabaseClient
      .from('Prodotto')
      .delete()
      .eq('Id', id);
    
    if (error) {
      console.error('Errore nell\'eliminazione acquisto:', error);
      throw error;
    }
  },

  // === PRODUCTS (estrae nomi unici dalla tabella Prodotto) ===
  async getAllProducts() {
    const { data, error } = await supabaseClient
      .from('Prodotto')
      .select('NomeProdotto')
      .order('NomeProdotto');
    
    if (error) {
      console.error('Errore nel caricamento prodotti:', error);
      return [];
    }
    
    // Estrai solo i nomi unici
    const uniqueProducts = [...new Set((data || []).map(p => p.NomeProdotto).filter(p => p))];
    return uniqueProducts.sort();
  },

  // === SUPPLIERS (estrae nomi unici dalla tabella Prodotto) ===
  async getAllSuppliers() {
    const { data, error } = await supabaseClient
      .from('Prodotto')
      .select('NomeFornitore')
      .order('NomeFornitore');
    
    if (error) {
      console.error('Errore nel caricamento fornitori:', error);
      return [];
    }
    
    // Estrai solo i nomi unici
    const uniqueSuppliers = [...new Set((data || []).map(s => s.NomeFornitore).filter(s => s))];
    return uniqueSuppliers.sort();
  }
};
