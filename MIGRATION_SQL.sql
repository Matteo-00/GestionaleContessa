-- =====================================================
-- SCRIPT MIGRAZIONE DATABASE - MODELLO NORMALIZZATO
-- =====================================================
-- Esegui questo script nel SQL Editor di Supabase
-- Dashboard → SQL Editor → New Query → Incolla e RUN
-- =====================================================

-- 1. CREA TABELLA ProdottoNew (master prodotti)
CREATE TABLE IF NOT EXISTS "ProdottoNew" (
  "Id" BIGSERIAL PRIMARY KEY,
  "NomeProdotto" TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREA TABELLA Fornitore (master fornitori)
CREATE TABLE IF NOT EXISTS "Fornitore" (
  "Id" BIGSERIAL PRIMARY KEY,
  "Nome" TEXT NOT NULL UNIQUE,
  "Email" TEXT,
  "Telefono" TEXT,
  "Indirizzo" TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREA TABELLA Acquisto (storico acquisti - IMMUTABILE)
CREATE TABLE IF NOT EXISTS "Acquisto" (
  "Id" BIGSERIAL PRIMARY KEY,
  "DataAcquisto" DATE NOT NULL,
  "IdProdotto" BIGINT NOT NULL REFERENCES "ProdottoNew"("Id") ON DELETE RESTRICT,
  "IdFornitore" BIGINT NOT NULL REFERENCES "Fornitore"("Id") ON DELETE RESTRICT,
  "PrezzoAl" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "Quantità" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "Unità" TEXT NOT NULL DEFAULT 'kg',
  "Descrizione" TEXT DEFAULT '',
  "Qualità" NUMERIC(3,1) DEFAULT 0,
  "rating" NUMERIC(3,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CREA TABELLA Consumo (storico consumi - IMMUTABILE)
CREATE TABLE IF NOT EXISTS "Consumo" (
  "Id" BIGSERIAL PRIMARY KEY,
  "DataConsumo" DATE NOT NULL,
  "IdProdotto" BIGINT NOT NULL REFERENCES "ProdottoNew"("Id") ON DELETE RESTRICT,
  "IdFornitore" BIGINT NOT NULL REFERENCES "Fornitore"("Id") ON DELETE RESTRICT,
  "Quantità" NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CREA INDICI per performance
CREATE INDEX IF NOT EXISTS idx_acquisto_prodotto ON "Acquisto"("IdProdotto");
CREATE INDEX IF NOT EXISTS idx_acquisto_fornitore ON "Acquisto"("IdFornitore");
CREATE INDEX IF NOT EXISTS idx_acquisto_data ON "Acquisto"("DataAcquisto");
CREATE INDEX IF NOT EXISTS idx_consumo_prodotto ON "Consumo"("IdProdotto");
CREATE INDEX IF NOT EXISTS idx_consumo_fornitore ON "Consumo"("IdFornitore");
CREATE INDEX IF NOT EXISTS idx_consumo_data ON "Consumo"("DataConsumo");

-- 6. ABILITA RLS (Row Level Security) per sicurezza
ALTER TABLE "ProdottoNew" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fornitore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Acquisto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consumo" ENABLE ROW LEVEL SECURITY;

-- 7. POLICY: Consenti tutto agli utenti autenticati (adatta secondo necessità)
CREATE POLICY "Enable all for authenticated users" ON "ProdottoNew"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON "Fornitore"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON "Acquisto"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users" ON "Consumo"
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- MIGRAZIONE DATI (opzionale - se hai già dati in "Prodotto")
-- =====================================================
-- ATTENZIONE: Verifica prima che la vecchia tabella "Prodotto" esista
-- e abbia dati da migrare. Altrimenti salta questa sezione.

-- 8. Estrai prodotti unici dalla tabella Prodotto
INSERT INTO "ProdottoNew" ("NomeProdotto")
SELECT DISTINCT "NomeProdotto"
FROM "Prodotto"
WHERE "NomeProdotto" IS NOT NULL
ON CONFLICT ("NomeProdotto") DO NOTHING;

-- 9. Estrai fornitori unici dalla tabella Prodotto
INSERT INTO "Fornitore" ("Nome")
SELECT DISTINCT "NomeFornitore"
FROM "Prodotto"
WHERE "NomeFornitore" IS NOT NULL
ON CONFLICT ("Nome") DO NOTHING;

-- 10. Migra gli acquisti dalla vecchia tabella Prodotto
INSERT INTO "Acquisto" (
  "DataAcquisto",
  "IdProdotto",
  "IdFornitore",
  "PrezzoAl",
  "Quantità",
  "Unità",
  "Descrizione",
  "Qualità",
  "rating"
)
SELECT 
  p."DataAcquisto",
  prod."Id" AS "IdProdotto",
  forn."Id" AS "IdFornitore",
  p."PrezzoAl",
  p."Quantità",
  COALESCE(p."Unità", 'kg'),
  COALESCE(p."Descrizione", ''),
  COALESCE(p."Qualità", 0),
  COALESCE(p."rating", 0)
FROM "Prodotto" p
INNER JOIN "ProdottoNew" prod ON prod."NomeProdotto" = p."NomeProdotto"
INNER JOIN "Fornitore" forn ON forn."Nome" = p."NomeFornitore";

-- =====================================================
-- FINE MIGRAZIONE
-- =====================================================

-- =====================================================
-- AGGIORNAMENTO TABELLA FORNITORE (se già esistente)
-- =====================================================
-- Se hai già creato la tabella Fornitore senza i campi Email, Telefono, Indirizzo,
-- esegui questi comandi per aggiungerli:

ALTER TABLE "Fornitore" 
  ADD COLUMN IF NOT EXISTS "Email" TEXT,
  ADD COLUMN IF NOT EXISTS "Telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "Indirizzo" TEXT;

-- =====================================================
-- Verifica i dati:
-- SELECT * FROM "ProdottoNew";
-- SELECT * FROM "Fornitore";
-- SELECT * FROM "Acquisto";
-- SELECT * FROM "Consumo";
-- =====================================================
