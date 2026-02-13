import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type, authorization",
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

    // Fetch the save
    const { data: save, error: fetchError } = await supabase
      .from("saves")
      .select("id, title, excerpt, content, highlight, site_name, notes")
      .eq("id", save_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !save) {
      return new Response(
        JSON.stringify({ error: "Save not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build content for analysis
    const contentParts: string[] = [];
    if (save.title) contentParts.push(`Title: ${save.title}`);
    if (save.site_name) contentParts.push(`Source: ${save.site_name}`);
    if (save.highlight) contentParts.push(`Highlight: ${save.highlight}`);
    if (save.notes) contentParts.push(`Notes: ${save.notes}`);
    if (save.excerpt) contentParts.push(`Excerpt: ${save.excerpt}`);
    if (save.content) contentParts.push(`Content: ${save.content.substring(0, 1500)}`);

    const contentText = contentParts.join("\n");

    // Not enough content to tag
    if (contentText.length < 20) {
      return new Response(
        JSON.stringify({ success: true, tags: [], message: "Insufficient content" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI
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
            content: `You are a content categorization assistant. Analyze content and suggest 2-5 relevant tags.

Rules:
- Tags must be lowercase
- Use single words or short phrases (2-3 words max, use hyphens for multi-word)
- Be specific but not too narrow
- Do NOT include generic tags like "article", "website", "content", "page"
- Return ONLY a valid JSON array of strings, nothing else

Example output: ["machine-learning", "python", "tutorial"]`
          },
          {
            role: "user",
            content: contentText
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
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
    const tagContent = openaiData.choices?.[0]?.message?.content || "[]";

    // Parse tags from response
    let tagNames: string[] = [];
    try {
      // Handle potential markdown code blocks
      const cleaned = tagContent.replace(/```json\n?|\n?```/g, "").trim();
      tagNames = JSON.parse(cleaned);
      if (!Array.isArray(tagNames)) tagNames = [];
      // Sanitize: lowercase, trim, limit length
      tagNames = tagNames
        .map((t: unknown) => String(t).toLowerCase().trim().substring(0, 50))
        .filter((t: string) => t.length > 0 && t.length <= 50)
        .slice(0, 5);
    } catch {
      console.error("Failed to parse tags:", tagContent);
      tagNames = [];
    }

    if (tagNames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, tags: [], message: "No tags generated" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or find tags and link to save
    const appliedTags: string[] = [];

    for (const tagName of tagNames) {
      // Check if tag exists
      let { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", user_id)
        .eq("name", tagName)
        .single();

      // Create if not exists
      if (!existingTag) {
        const { data: newTag } = await supabase
          .from("tags")
          .insert({ user_id, name: tagName })
          .select("id")
          .single();
        existingTag = newTag;
      }

      if (existingTag) {
        // Link tag to save (upsert to handle duplicates gracefully)
        const { error: linkError } = await supabase
          .from("save_tags")
          .upsert(
            { save_id, tag_id: existingTag.id },
            { onConflict: "save_id,tag_id", ignoreDuplicates: true }
          );

        if (!linkError) {
          appliedTags.push(tagName);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, tags: appliedTags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Auto-tag error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
