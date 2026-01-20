// Test per Supabase Edge Function - Gemini
// Esegui con: node test.js

const SUPABASE_ANON_KEY = "sb_publishable_lFhwqKcPUN_IhGTgPacqkg_2wEx45Yz";

async function testGemini() {
  console.log("🚀 Test chiamata Edge Function Gemini...\n");
  
  try {
    const res = await fetch(
      "https://zlyikcrrwjxmvoigqpdi.supabase.co/functions/v1/gemini",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "apikey": SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          prompt: "Dimmi se conviene comprare mozzarella da un fornitore caro ma di qualità"
        })
      }
    );

    const data = await res.json();
    
    if (res.ok) {
      console.log("✅ Risposta ricevuta:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log("❌ Errore:", res.status);
      console.log(data);
    }
  } catch (err) {
    console.error("❌ Errore di connessione:", err.message);
  }
}

testGemini();
