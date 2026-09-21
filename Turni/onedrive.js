// ===================================
// ONEDRIVE.JS
// Pubblicazione automatica turni su
// Excel OneDrive tramite Supabase Edge Function
// ===================================

const ONEDRIVE_FUNCTION_URL =
  'https://zlyikcrrwjxmvoigqpdi.supabase.co/functions/v1/onedrive';


/**
 * Pubblica i turni della settimana sul file Excel
 * "TURNI SETTIMANALI DEFINITIVI.xlsx" presente su OneDrive.
 *
 * Il browser NON accede direttamente a Microsoft Graph.
 * I dati vengono inviati alla Edge Function Supabase,
 * che si occupa di:
 *
 * 1. recuperare il token Microsoft
 * 2. aggiornare direttamente il foglio SALA tramite Microsoft Graph
 * 3. lasciare invariati gli altri fogli
 */
async function compilaFileOneDriveAllaPubblicazione(settimana) {

  try {

    // -------------------------------------------------
    // 1. Controllo settimana
    // -------------------------------------------------

    if (!settimana || !settimana.settimana) {
      throw new Error('Settimana non valida.');
    }

    console.log(
      '[OneDrive] Pubblicazione settimana:',
      settimana.settimana
    );


    // -------------------------------------------------
    // 2. Recuperiamo i turni assegnati
    // -------------------------------------------------

    const turni =
      await DB.getTurni(settimana.settimana);

    console.log(
      '[OneDrive] Turni recuperati:',
      turni
    );


    // -------------------------------------------------
    // 3. Recuperiamo i profili
    //    per trasformare user_id -> nome/cognome
    // -------------------------------------------------

    const profiles =
      await DB.getAllProfiles();

    const profilesMap = {};

    profiles.forEach(profile => {
      profilesMap[profile.id] = profile;
    });


    // -------------------------------------------------
    // 4. MAPPATURA NOMI PER EXCEL
    // -------------------------------------------------
    //
    // IMPORTANTE:
    //
    // Questa mappatura viene utilizzata SOLO per
    // preparare i dati da inviare a Excel.
    //
    // NON modifica:
    // - database
    // - profiles
    // - turni
    // - nomi utilizzati dal resto dell'applicazione
    //
    // Il valore a destra è ESATTAMENTE quello che
    // vogliamo mandare al foglio Excel SALA.
    //

    const nomiExcel = {

      // Utenti da NON mandare a Excel
      'Matteo Sebastiani': null,
      'GestionaleContessaUser': null,

      // Camerieri / nomi Excel
      'Giulia': 'GIULIA',
      'Alice': 'ALICE',
      'Giovi': 'GIOVI',

      // Nel DB può essere Samantha,
      // mentre in Excel è SAMANTA
      'Samantha': 'SAMANTA',
      'Samanta': 'SAMANTA',

      'Jessica': 'JESSICA',
      'Anita': 'ANITA',

      'Ale': 'ALE',
      'Ale B': 'ALE B',

      'Giada': 'GIADA',
      'Giorgia': 'GIORGIA',

      'Anna': 'ANNA',

      'Maddi': 'MADDI',

      // Possibili valori del DB
      'Annina': 'ANNINA',
      'Annina .': 'ANNINA',

      'Aurora': 'AURORA',
      'Mari': 'MARI',
      'Benni': 'BENNI',
      'Dania': 'DANIA',

      // Lisa G -> LISA in Excel
      'Lisa G': 'LISA',

      'Maurizio': 'MAURIZIO',

      'Matteo': 'MATTEO',

      // Presenti nella struttura Excel
      'Maura': 'MAURA',
      'Pietro': 'PIETRO'
    };


    // -------------------------------------------------
    // 5. Prepariamo i dati da mandare alla Edge Function
    // -------------------------------------------------
    //
    // Consideriamo SOLO:
    //
    // giorno 1 -> lunedì
    // giorno 2 -> martedì
    // ...
    // giorno 7 -> domenica
    //
    // turno:
    // mattina
    // sera
    //
    // RIPOSO NON VIENE GESTITO.
    //
    // Il nome contenuto in "turniExcel" è già convertito
    // nel formato corretto per Excel.
    //

    const turniExcel = turni
      .filter(t => {

        if (!t) {
          return false;
        }

        const giorno =
          Number(t.giorno);

        return (
          giorno >= 1 &&
          giorno <= 7 &&
          (
            t.turno === 'mattina' ||
            t.turno === 'sera'
          )
        );
      })
      .map(t => {

        const profile =
          profilesMap[t.user_id];

        if (!profile) {

          console.warn(
            '[OneDrive] Profilo non trovato:',
            t.user_id
          );

          return null;
        }


        // ---------------------------------------------
        // Nome originale del DB
        // ---------------------------------------------

        const nome =
          profile.nome || '';

        const cognome =
          profile.cognome || '';

        const nomeCompleto =
          `${nome} ${cognome}`.trim();


        if (!nomeCompleto) {
          return null;
        }


        // ---------------------------------------------
        // CONVERSIONE SOLO PER EXCEL
        // ---------------------------------------------
        //
        // Prima proviamo:
        // "Nome Cognome"
        //
        // Se non esiste nella mappa, proviamo:
        // "Nome"
        //
        // Esempi:
        //
        // Samantha -> SAMANTA
        // Maurizio -> MAURIZIO
        // Ale B -> ALE B
        // Lisa G -> LISA
        // Annina . -> ANNINA
        //

        let nomeExcel;

        if (
          Object.prototype.hasOwnProperty.call(
            nomiExcel,
            nomeCompleto
          )
        ) {

          nomeExcel =
            nomiExcel[nomeCompleto];

        } else if (
          Object.prototype.hasOwnProperty.call(
            nomiExcel,
            nome
          )
        ) {

          nomeExcel =
            nomiExcel[nome];

        } else {

          nomeExcel = undefined;
        }


        // ---------------------------------------------
        // Utente escluso dalla pubblicazione Excel
        // ---------------------------------------------

        if (nomeExcel === null) {

          console.log(
            '[OneDrive] Utente escluso da Excel:',
            nomeCompleto
          );

          return null;
        }


        // ---------------------------------------------
        // Nome non presente nella mappatura
        // ---------------------------------------------

        if (!nomeExcel) {

          console.warn(
            '[OneDrive] Nome NON presente nella mappa Excel:',
            nomeCompleto
          );

          return null;
        }


        // ---------------------------------------------
        // Log conversione
        // ---------------------------------------------

        console.log(
          '[OneDrive] Nome per Excel:',
          nomeCompleto,
          '->',
          nomeExcel
        );


        // ---------------------------------------------
        // Oggetto destinato ESCLUSIVAMENTE a Excel
        // ---------------------------------------------

        return {

          giorno:
            Number(t.giorno),

          turno:
            t.turno,

          nome:
            nomeExcel

        };
      })
      .filter(t => t !== null);


    console.log(
      '[OneDrive] Dati preparati per Excel:',
      turniExcel
    );


    // -------------------------------------------------
    // 6. Chiamata alla Edge Function Supabase
    // -------------------------------------------------

    const response =
      await fetch(
        `${ONEDRIVE_FUNCTION_URL}?action=pubblica-turni`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({

            // Identificativo della settimana
            settimana:
              settimana.settimana,

            // Turni con nomi già convertiti
            // ESCLUSIVAMENTE per Excel
            turni:
              turniExcel

          })
        }
      );


    // -------------------------------------------------
    // 7. Leggiamo la risposta
    // -------------------------------------------------

    const result =
      await response
        .json()
        .catch(() => ({}));


    if (!response.ok) {

      throw new Error(
        result?.error ||
        result?.message ||
        `Errore OneDrive (${response.status})`
      );
    }


    // -------------------------------------------------
    // 8. Successo
    // -------------------------------------------------

    console.log(
      '[OneDrive] Excel aggiornato correttamente:',
      result
    );


    showToast(
      'Turni pubblicati e file Excel SALA aggiornato su OneDrive!',
      'success'
    );


    return result;


  } catch (err) {

    // -------------------------------------------------
    // 9. Errore
    // -------------------------------------------------

    console.error(
      '[OneDrive] Errore aggiornamento Excel:',
      err
    );


    showToast(
      'Turni pubblicati, ma errore aggiornamento Excel OneDrive: ' +
      err.message,
      'error'
    );


    throw err;
  }
}