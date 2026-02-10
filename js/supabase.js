// Configurazione Supabase
const supabaseUrl = 'https://zlyikcrrwjxmvoigqpdi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpseWlrY3Jyd2p4bXZvaWdxcGRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NzIxMTEsImV4cCI6MjA4MzQ0ODExMX0.QaRjSOSWjq0zBZtIvM0fSgqJSgIxpfwaHEfyB-j-Q5w';

// Crea il client Supabase globale
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

/**
 * NUOVO MODELLO DATI NORMALIZZATO
 * 
 * Tabelle:
 * - ProdottoNew: master prodotti (Id, NomeProdotto)
 * - Fornitore: master fornitori (Id, Nome)
 * - Acquisto: storico entrate (NON modificabile)
 * - Consumo: storico uscite (NON modificabile)
 * 
 * REGOLE:
 * - Ogni acquisto/consumo CREA una nuova riga
 * - MAI modificare o eliminare righe storiche
 * - Quantità in archivio = SUM(Acquisti) - SUM(Consumi)
 * - Prezzo = ultimo acquisto (per prodotto+fornitore)
 */

window.db = {
  
  // ========================================
  // MASTER DATA - ProdottoNew
  // ========================================
  
  async getAllProducts() {
    const { data, error } = await supabaseClient
      .from('ProdottoNew')
      .select('Id, NomeProdotto')
      .order('NomeProdotto');
    
    if (error) {
      console.error('Errore caricamento prodotti:', error);
      return [];
    }
    
    return data || [];
  },
  
  async getProductByName(nome) {
    const { data, error } = await supabaseClient
      .from('ProdottoNew')
      .select('Id, NomeProdotto')
      .eq('NomeProdotto', nome)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Errore ricerca prodotto:', error);
      return null;
    }
    
    return data;
  },
  
  async createProduct(nome) {
    const { data, error } = await supabaseClient
      .from('ProdottoNew')
      .insert([{ NomeProdotto: nome }])
      .select()
      .single();
    
    if (error) {
      console.error('Errore creazione prodotto:', error);
      throw error;
    }
    
    return data;
  },
  
  async getOrCreateProduct(nome) {
    let product = await this.getProductByName(nome);
    if (!product) {
      product = await this.createProduct(nome);
    }
    return product;
  },
  
  // ========================================
  // MASTER DATA - Fornitore
  // ========================================
  
  async getAllSuppliers() {
    const { data, error } = await supabaseClient
      .from('Fornitore')
      .select('Id, Nome, Email, Telefono, Indirizzo')
      .order('Nome');
    
    if (error) {
      console.error('Errore caricamento fornitori:', error);
      return [];
    }
    
    return data || [];
  },
  
  async getSupplierByName(nome) {
    const { data, error } = await supabaseClient
      .from('Fornitore')
      .select('Id, Nome, Email, Telefono, Indirizzo')
      .eq('Nome', nome)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Errore ricerca fornitore:', error);
      return null;
    }
    
    return data;
  },
  
  async getSupplierById(id) {
    const { data, error } = await supabaseClient
      .from('Fornitore')
      .select('Id, Nome, Email, Telefono, Indirizzo')
      .eq('Id', id)
      .single();
    
    if (error) {
      console.error('Errore ricerca fornitore per ID:', error);
      return null;
    }
    
    return data;
  },
  
  async createSupplier(supplierData) {
    // supplierData può essere una stringa (nome) o un oggetto {Nome, Email, Telefono, Indirizzo}
    const insertData = typeof supplierData === 'string' 
      ? { Nome: supplierData }
      : {
          Nome: supplierData.Nome,
          Email: supplierData.Email || null,
          Telefono: supplierData.Telefono || null,
          Indirizzo: supplierData.Indirizzo || null
        };
    
    const { data, error } = await supabaseClient
      .from('Fornitore')
      .insert([insertData])
      .select()
      .single();
    
    if (error) {
      console.error('Errore creazione fornitore:', error);
      throw error;
    }
    
    return data;
  },
  
  async updateSupplier(id, supplierData) {
    const updateData = {
      Email: supplierData.Email || null,
      Telefono: supplierData.Telefono || null,
      Indirizzo: supplierData.Indirizzo || null
    };
    
    // Se il nome è stato modificato, includilo
    if (supplierData.Nome) {
      updateData.Nome = supplierData.Nome;
    }
    
    const { data, error } = await supabaseClient
      .from('Fornitore')
      .update(updateData)
      .eq('Id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Errore aggiornamento fornitore:', error);
      throw error;
    }
    
    return data;
  },

  // Elimina fornitore (CASCADE eliminerà anche Acquisto e Consumo associati)
  async deleteSupplier(id) {
    const { error } = await supabaseClient
      .from('Fornitore')
      .delete()
      .eq('Id', id);
    
    if (error) {
      console.error('Errore eliminazione fornitore:', error);
      throw error;
    }
    
    return true;
  },
  
  async getOrCreateSupplier(nome) {
    let supplier = await this.getSupplierByName(nome);
    if (!supplier) {
      supplier = await this.createSupplier(nome);
    }
    return supplier;
  },
  
  // ========================================
  // ACQUISTI (solo INSERT - mai UPDATE/DELETE)
  // ========================================
  
  async addAcquisto(acquisto) {
    // Assicura che IdProdotto e IdFornitore esistano
    const product = await this.getOrCreateProduct(acquisto.product);
    const supplier = await this.getOrCreateSupplier(acquisto.supplier);
    
    const dbData = {
      DataAcquisto: acquisto.date,
      IdProdotto: product.Id,
      IdFornitore: supplier.Id,
      PrezzoAl: acquisto.price,
      Unità: acquisto.unit || 'kg',
      Descrizione: acquisto.description || '',
      Quantità: acquisto.quantity || 0,
      Qualità: acquisto.rating || 0,
      rating: acquisto.rating || 0
    };
    
    const { data, error } = await supabaseClient
      .from('Acquisto')
      .insert([dbData])
      .select(`
        *,
        ProdottoNew:IdProdotto (Id, NomeProdotto),
        Fornitore:IdFornitore (Id, Nome)
      `)
      .single();
    
    if (error) {
      console.error('Errore inserimento acquisto:', error);
      throw error;
    }
    
    return data;
  },
  
  async updateLastAcquistoPrice(idProdotto, idFornitore, newPrice) {
    // Trova l'ULTIMO acquisto per questo prodotto+fornitore
    const { data, error: fetchError } = await supabaseClient
      .from('Acquisto')
      .select('Id, DataAcquisto')
      .eq('IdProdotto', idProdotto)
      .eq('IdFornitore', idFornitore)
      .order('DataAcquisto', { ascending: false })
      .limit(1)
      .single();
    
    if (fetchError || !data) {
      console.error('Errore ricerca ultimo acquisto:', fetchError);
      throw new Error('Nessun acquisto trovato per questo prodotto+fornitore');
    }
    
    // Aggiorna SOLO il prezzo dell'ultimo acquisto
    const { error: updateError } = await supabaseClient
      .from('Acquisto')
      .update({ PrezzoAl: newPrice })
      .eq('Id', data.Id);
    
    if (updateError) {
      console.error('Errore aggiornamento prezzo:', updateError);
      throw updateError;
    }
  },
  
  async updateLastAcquistoInfo(idProdotto, idFornitore, updates) {
    // Trova l'ULTIMO acquisto per questo prodotto+fornitore
    const { data, error: fetchError } = await supabaseClient
      .from('Acquisto')
      .select('Id, DataAcquisto, Descrizione, Qualità, rating')
      .eq('IdProdotto', idProdotto)
      .eq('IdFornitore', idFornitore)
      .order('DataAcquisto', { ascending: false })
      .limit(1)
      .single();
    
    if (fetchError || !data) {
      console.error('Errore ricerca ultimo acquisto:', fetchError);
      throw new Error('Nessun acquisto trovato per questo prodotto+fornitore');
    }
    
    // Prepara i dati da aggiornare (solo i campi specificati)
    const updateData = {};
    if (updates.description !== undefined) {
      updateData.Descrizione = updates.description;
    }
    if (updates.rating !== undefined) {
      updateData.Qualità = updates.rating;
      updateData.rating = updates.rating;
    }
    
    // Aggiorna l'ultimo acquisto
    const { error: updateError } = await supabaseClient
      .from('Acquisto')
      .update(updateData)
      .eq('Id', data.Id);
    
    if (updateError) {
      console.error('Errore aggiornamento info acquisto:', updateError);
      throw updateError;
    }
  },
  
  // ========================================
  // CONSUMI (solo INSERT - mai UPDATE/DELETE)
  // ========================================
  
  async addConsumo(consumo) {
    const dbData = {
      DataConsumo: consumo.date || new Date().toISOString(),
      IdProdotto: consumo.idProdotto,
      IdFornitore: consumo.idFornitore,
      Quantità: consumo.quantity
    };
    
    const { data, error } = await supabaseClient
      .from('Consumo')
      .insert([dbData])
      .select(`
        *,
        ProdottoNew:IdProdotto (Id, NomeProdotto),
        Fornitore:IdFornitore (Id, Nome)
      `)
      .single();
    
    if (error) {
      console.error('Errore inserimento consumo:', error);
      throw error;
    }
    
    return data;
  },
  
  // ========================================
  // ARCHIVIO AGGREGATO
  // ========================================
  
  async getArchivioAggregato() {
    // Ottieni tutti gli acquisti con JOIN
    const { data: acquisti, error: errAcq } = await supabaseClient
      .from('Acquisto')
      .select(`
        Id,
        DataAcquisto,
        IdProdotto,
        IdFornitore,
        PrezzoAl,
        Unità,
        Descrizione,
        Quantità,
        Qualità,
        rating,
        ProdottoNew:IdProdotto (Id, NomeProdotto),
        Fornitore:IdFornitore (Id, Nome)
      `)
      .order('DataAcquisto', { ascending: false });
    
    if (errAcq) {
      console.error('Errore caricamento acquisti:', errAcq);
      return [];
    }
    
    // Ottieni tutti i consumi con JOIN
    const { data: consumi, error: errCons } = await supabaseClient
      .from('Consumo')
      .select(`
        Id,
        DataConsumo,
        IdProdotto,
        IdFornitore,
        Quantità,
        ProdottoNew:IdProdotto (Id, NomeProdotto),
        Fornitore:IdFornitore (Id, Nome)
      `);
    
    if (errCons) {
      console.error('Errore caricamento consumi:', errCons);
      // Continua anche se i consumi non ci sono
    }
    
    // Aggrega per IdProdotto + IdFornitore
    const aggregati = new Map();
    
    // Processa acquisti
    (acquisti || []).forEach(acq => {
      const key = `${acq.IdProdotto}-${acq.IdFornitore}`;
      
      if (!aggregati.has(key)) {
        aggregati.set(key, {
          idProdotto: acq.IdProdotto,
          idFornitore: acq.IdFornitore,
          product: acq.ProdottoNew?.NomeProdotto || '',
          supplier: acq.Fornitore?.Nome || '',
          totalAcquisti: 0,
          totalConsumi: 0,
          totalSpent: 0,
          lastAcquisto: null,
          unit: acq.Unità,
          description: acq.Descrizione,
          rating: acq.rating || 0
        });
      }
      
      const agg = aggregati.get(key);
      agg.totalAcquisti += (acq.Quantità || 0);
      agg.totalSpent += (acq.Quantità || 0) * (acq.PrezzoAl || 0);
      
      // Trova l'ultimo acquisto (più recente) e aggiorna descrizione/rating
      if (!agg.lastAcquisto || new Date(acq.DataAcquisto) > new Date(agg.lastAcquisto.DataAcquisto)) {
        agg.lastAcquisto = acq;
        // Aggiorna con le info dell'ultimo acquisto
        agg.description = acq.Descrizione || '';
        agg.rating = acq.rating || 0;
        agg.unit = acq.Unità || 'kg';
      }
    });
    
    // Processa consumi
    (consumi || []).forEach(cons => {
      const key = `${cons.IdProdotto}-${cons.IdFornitore}`;
      
      if (aggregati.has(key)) {
        aggregati.get(key).totalConsumi += (cons.Quantità || 0);
      }
    });
    
    // Converti in array e calcola quantità netta
    const result = Array.from(aggregati.values()).map(agg => ({
      id: `${agg.idProdotto}-${agg.idFornitore}`, // ID composito per UI
      idProdotto: agg.idProdotto,
      idFornitore: agg.idFornitore,
      product: agg.product,
      supplier: agg.supplier,
      quantity: agg.totalAcquisti - agg.totalConsumi, // Quantità netta
      price: agg.lastAcquisto?.PrezzoAl || 0,
      totalSpent: agg.totalSpent, // Totale speso per questo prodotto/fornitore
      unit: agg.unit,
      date: agg.lastAcquisto?.DataAcquisto || '',
      description: agg.description,
      rating: agg.rating,
      lastPurchaseDate: agg.lastAcquisto?.DataAcquisto || ''
    }));
    
    return result;
  },
  
  // ========================================
  // ELIMINAZIONE COMPLETA PRODOTTO+FORNITORE
  // ========================================
  
  async deleteAllForProductSupplier(idProdotto, idFornitore) {
    // Elimina tutti gli acquisti per questo prodotto+fornitore
    const { error: errAcq } = await supabaseClient
      .from('Acquisto')
      .delete()
      .eq('IdProdotto', idProdotto)
      .eq('IdFornitore', idFornitore);
    
    if (errAcq) {
      console.error('Errore eliminazione acquisti:', errAcq);
      throw errAcq;
    }
    
    // Elimina tutti i consumi per questo prodotto+fornitore
    const { error: errCons } = await supabaseClient
      .from('Consumo')
      .delete()
      .eq('IdProdotto', idProdotto)
      .eq('IdFornitore', idFornitore);
    
    if (errCons) {
      console.error('Errore eliminazione consumi:', errCons);
      // Non bloccare se non ci sono consumi
    }
  }
};

