import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
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

    // Fetch the save
    const { data: save, error: fetchError } = await supabase
      .from("saves")
      .select("id, title, excerpt, content, highlight, notes, site_name, is_book, url")
      .eq("id", save_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !save) {
      return new Response(
        JSON.stringify({ error: "Save not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build content for summarization
    const contentParts: string[] = [];
    if (save.title) contentParts.push(`Title: ${save.title}`);
    if (save.site_name) contentParts.push(`Source: ${save.site_name}`);
    if (save.highlight) contentParts.push(`Highlight: ${save.highlight}`);
    if (save.notes) contentParts.push(`Notes: ${save.notes}`);
    if (save.content) contentParts.push(`Content: ${save.content.substring(0, 4000)}`);
    else if (save.excerpt) contentParts.push(`Excerpt: ${save.excerpt}`);

    const contentText = contentParts.join("\n\n");

    if (contentText.length < 20) {
      return new Response(
        JSON.stringify({ error: "Insufficient content to summarize" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI for summary
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a concise summarization assistant. Write a 2-4 sentence TLDR summary of the provided content.

Rules:
- Be concise and direct — capture the key idea or takeaway
- Write in plain prose, no bullet points or markdown
- Do not start with "This article" or "This content" — just summarize the substance
- Focus on what makes this content worth saving`
          },
          {
            role: "user",
            content: contentText
          }
        ],
        temperature: 0.4,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI error:", errorText);
      return new Response(
        JSON.stringify({ error: "OpenAI API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const summary = openaiData.choices?.[0]?.message?.content?.trim() || "";

    if (!summary) {
      return new Response(
        JSON.stringify({ error: "No summary generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store summary in excerpt field
    const { error: updateError } = await supabase
      .from("saves")
      .update({ excerpt: summary })
      .eq("id", save_id)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save summary" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Summarize error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
