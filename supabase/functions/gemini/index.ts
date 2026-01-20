import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// CORS headers per permettere chiamate dal browser
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

Deno.serve(async (req) => {
  // Gestione preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt mancante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Usa gemini-1.5-flash-latest
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    )

    const data = await response.json()

    // Gestione errori dall'API Gemini
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Errore Gemini: ${response.status}`, details: data }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    return new Response(
      JSON.stringify({ text, raw: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
