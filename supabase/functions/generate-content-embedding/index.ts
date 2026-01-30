import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { save_id, user_id } = await req.json();

    if (!save_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "save_id and user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch save content
    const { data: save, error: fetchError } = await supabase
      .from("saves")
      .select("id, title, excerpt, content, highlight, notes")
      .eq("id", save_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !save) {
      return new Response(
        JSON.stringify({ error: "Save not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Combine text for embedding (prioritize different fields)
    const textParts: string[] = [];
    if (save.title) textParts.push(save.title);
    if (save.excerpt) textParts.push(save.excerpt);
    if (save.highlight) textParts.push(save.highlight);
    if (save.notes) textParts.push(save.notes);
    // Limit content to first 2000 chars to stay within token limits
    if (save.content) textParts.push(save.content.substring(0, 2000));

    const text = textParts.filter(Boolean).join('\n\n');

    // Not enough content to embed
    if (text.length < 20) {
      return new Response(
        JSON.stringify({ success: true, message: "Insufficient content for embedding" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embedding using OpenAI
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error("OpenAI embedding error:", errorText);
      return new Response(
        JSON.stringify({ error: "OpenAI Embeddings API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data?.[0]?.embedding;

    if (!embedding) {
      return new Response(
        JSON.stringify({ error: "No embedding generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store embedding in database
    const { error: updateError } = await supabase
      .from("saves")
      .update({ content_embedding: embedding })
      .eq("id", save_id);

    if (updateError) {
      console.error("Database update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to store embedding" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, embedding_length: embedding.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
