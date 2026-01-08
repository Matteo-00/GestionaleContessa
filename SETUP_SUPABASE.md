# 🗄️ Setup Database Supabase - Gestionale La Contessa

## ✅ La tua tabella "Prodotto" è già pronta!

Hai già creato la tabella su Supabase con le colonne giuste. Ora devi solo configurare le **policy di sicurezza (RLS)**.

---

### 🔐 Configura Row Level Security (RLS)

⚠️ **IMPORTANTE PER LA SICUREZZA** ⚠️

Vai su [Supabase Dashboard](https://supabase.com/dashboard) → Il tuo progetto → **SQL Editor**

Copia e incolla questo codice SQL:

```sql
-- ====================================
-- POLICY PER LA TABELLA "Prodotto"
-- ====================================

-- Abilita Row Level Security
ALTER TABLE "Prodotto" ENABLE ROW LEVEL SECURITY;

-- Permetti lettura a tutti (SELECT)
CREATE POLICY "Tutti possono leggere i prodotti"
ON "Prodotto" FOR SELECT
USING (true);

-- Permetti inserimento a tutti (INSERT)
CREATE POLICY "Tutti possono inserire prodotti"
ON "Prodotto" FOR INSERT
WITH CHECK (true);

-- Permetti modifica a tutti (UPDATE)
CREATE POLICY "Tutti possono modificare prodotti"
ON "Prodotto" FOR UPDATE
USING (true)
WITH CHECK (true);

-- Permetti eliminazione a tutti (DELETE)
CREATE POLICY "Tutti possono eliminare prodotti"
ON "Prodotto" FOR DELETE
USING (true);
```

Clicca su **RUN** per eseguire lo script.

---

### ✅ Fatto!

Ora la tua applicazione è collegata al database Supabase! 🎉

**Cosa succede ora:**
- ✅ Quando aggiungi un acquisto → viene salvato nella tabella "Prodotto"
- ✅ Quando apri l'archivio → carica i dati dalla tabella "Prodotto"
- ✅ I dati sono nel cloud, accessibili da qualsiasi dispositivo
- ❌ Non usa più localStorage del browser

---

### 🆘 Problemi comuni

#### ❌ Errore: "new row violates row-level security policy"
→ Verifica di aver eseguito TUTTE le policy RLS (copia il codice SQL sopra)

#### ❌ Non vedo i dati nel frontend
→ Apri la Console del browser (F12) e cerca errori
→ Verifica su Supabase Dashboard → Table Editor → Prodotto

#### ❌ I vecchi dati localStorage non si vedono
→ Normale! Ora i dati sono sul database cloud
→ Se vuoi migrare i vecchi dati, contattami

---

### 📊 Struttura della tabella "Prodotto"

La tua tabella ha queste colonne:

| Colonna | Tipo | Utilizzo |
|---------|------|----------|
| `Id` | bigint | ID univoco (auto-incrementale) |
| `DataAcquisto` | date | Data dell'acquisto |
| `NomeProdotto` | varchar | Nome del prodotto |
| `NomeFornitore` | varchar | Nome del fornitore |
| `PrezzoAl` | numeric | Prezzo totale |
| `Quantità` | numeric | Quantità acquistata |
| `Unità` | varchar | Unità di misura (kg/litri/pezzi) |
| `Descrizione` | varchar | Note e descrizione |
| `Magazzino` | numeric | (non usato per ora) |

---

## 🔐 Note sulla sicurezza

⚠️ **Importante**: Le policy attuali permettono a chiunque di leggere/scrivere i dati.

Per un'applicazione in produzione, dovresti:

1. **Aggiungere autenticazione utenti** con Supabase Auth
2. **Modificare le policy RLS** per limitare l'accesso ai propri dati
3. Aggiungere una colonna `user_id` nella tabella

Esempio di policy con autenticazione:

```sql
-- Solo l'utente può vedere i propri acquisti
CREATE POLICY "Utenti vedono solo i propri acquisti"
ON "Prodotto" FOR SELECT
USING (auth.uid() = user_id);
```

Ma per iniziare, le policy "aperte" vanno bene per testare.

---

## 🚀 Prossimi passi (opzionali)

- Aggiungi autenticazione utenti
- Usa la colonna `Magazzino` per tracciare le giacenze
- Aggiungi notifiche quando un prodotto sta per finire
- Crea report personalizzati
