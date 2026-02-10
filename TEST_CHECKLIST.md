# ✅ CHECKLIST TEST POST-REFACTORING

## 🔍 Test da Eseguire

### 1. **Esegui lo Script SQL** (SE NON L'HAI GIA FATTO)
- Apri **Supabase Dashboard** → **SQL Editor**
- Copia il contenuto di `MIGRATION_SQL.sql`
- Clicca **RUN**
- ✅ Verifica che le tabelle siano create: `ProdottoNew`, `Fornitore`, `Acquisto`, `Consumo`

---

### 2. **Test Home - Dropdown Nuovo Acquisto**
1. Apri l'applicazione (index.html)
2. Vai su **"Registra un nuovo acquisto"**
3. Clicca sull'input **"Prodotto"**
   - ✅ Dovrebbe mostrare la lista dei prodotti esistenti
4. Clicca sull'input **"Fornitore"**
   - ✅ Dovrebbe mostrare la lista dei fornitori esistenti

---

### 3. **Test Filtri Archivio**
1. Vai alla sezione **"Archivio"**
2. Clicca sul filtro **"🔍 Cerca prodotto..."**
   - ✅ Dovrebbe mostrare tutti i prodotti disponibili
3. Clicca sul filtro **"🔍 Cerca fornitore..."**
   - ✅ Dovrebbe mostrare tutti i fornitori disponibili
4. Digita un nome parziale in un filtro
   - ✅ La tabella dovrebbe filtrare in tempo reale

---

### 4. **Test Nuovo Acquisto**
1. Compila il form con:
   - Prodotto: (nuovo o esistente)
   - Fornitore: (nuovo o esistente)
   - Prezzo, Quantità, Data
2. Clicca **"Salva Acquisto"**
   - ✅ Dovrebbe salvare senza errori
   - ✅ L'archivio si deve aggiornare
   - ✅ Se è un prodotto esistente, la quantità deve sommarsi

---

### 5. **Test Consuma**
1. Nell'archivio, clicca **"Consuma"** su un prodotto
2. Inserisci una quantità minore di quella disponibile
3. Clicca **"Conferma Consumo"**
   - ✅ La quantità in archivio deve ridursi
   - ✅ Deve apparire un alert con la quantità residua

---

### 6. **Test Modifica Prezzo**
1. Clicca **"Modifica"** su un prodotto
2. Cambia SOLO il prezzo
3. Clicca **"Salva Modifiche"**
   - ✅ Il prezzo deve aggiornarsi
4. Prova a cambiare prodotto/fornitore/quantità
   - ✅ Deve apparire un alert che impedisce la modifica

---

### 7. **Test Riacquisto**
1. Clicca **"Acquista"** su un prodotto esistente
2. Inserisci quantità e prezzo
3. Conferma
   - ✅ Deve creare un NUOVO acquisto
   - ✅ La quantità in archivio deve aumentare

---

## 🐛 Cosa Controllare in Console

Apri la **Console del Browser** (F12) e controlla che NON ci siano:
- ❌ Errori tipo: `Cannot read property 'toLowerCase' of undefined`
- ❌ Errori tipo: `products.filter is not a function`
- ❌ Errori di database: `relation "Prodotto" does not exist`

---

## ✅ Se Tutto Funziona

Congratulazioni! Il refactoring è completo. Ora hai:
- ✅ Storico immutabile di acquisti e consumi
- ✅ Aggregazione automatica delle quantità
- ✅ Tracciabilità completa dei movimenti
- ✅ Nessuna possibilità di perdere dati storici

**Buon lavoro! 🎉**

---

## 🆘 In Caso di Problemi

### Problema: "Dropdown vuote"
**Causa:** Le tabelle `ProdottoNew` e `Fornitore` sono vuote  
**Soluzione:** Esegui lo script SQL per migrare i dati dalla vecchia tabella `Prodotto`

### Problema: "Errore: relation 'Prodotto' does not exist"
**Causa:** Il vecchio codice cerca ancora la tabella vecchia  
**Soluzione:** Ricarica completamente la pagina (CTRL+F5)

### Problema: "Quantità non si somma"
**Causa:** La funzione `getArchivioAggregato` potrebbe avere problemi  
**Soluzione:** Controlla la console per errori di JOIN nel database

### Problema: "Non posso creare nuovi prodotti"
**Causa:** Problema nella funzione `getOrCreateProduct`  
**Soluzione:** Verifica che le policy RLS siano configurate correttamente in Supabase
