-- =====================================================
-- AGGIUNTA COLONNA TelefonoManager ALLA TABELLA FORNITORE
-- =====================================================
-- Esegui questo script nel SQL Editor di Supabase
-- Dashboard → SQL Editor → New Query → Incolla e RUN
-- =====================================================

-- Aggiungi la colonna TelefonoManager alla tabella Fornitore
ALTER TABLE "Fornitore" 
ADD COLUMN IF NOT EXISTS "TelefonoManager" TEXT;

-- Commento per documentazione
COMMENT ON COLUMN "Fornitore"."TelefonoManager" IS 'Numero di telefono del manager del fornitore';
