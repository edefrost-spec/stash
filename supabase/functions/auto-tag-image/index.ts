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
    const { save_id, user_id, image_url } = await req.json();

    if (!save_id || !user_id || !image_url) {
      return new Response(
        JSON.stringify({ error: "save_id, user_id, and image_url required" }),
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

    // Call GPT-4 Vision to analyze image
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an image tagging assistant. Analyze the image and suggest 3-5 relevant, specific tags.

Rules:
- Tags must be lowercase
- Use single words or short phrases (2-3 words max, use hyphens for multi-word)
- Be specific but not too narrow
- Focus on: main subjects, style/aesthetic, colors, mood, context
- Do NOT include generic tags like "image", "photo", "picture"
- Return ONLY a valid JSON array of strings, nothing else

Example output: ["sunset", "ocean", "landscape", "golden-hour", "serene"]`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: image_url
                }
              },
              {
                type: "text",
                text: "Analyze this image and suggest relevant tags."
              }
            ]
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error("OpenAI Vision error:", errorText);
      return new Response(
        JSON.stringify({ error: "OpenAI Vision API error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const visionData = await visionResponse.json();
    const tagContent = visionData.choices?.[0]?.message?.content || "[]";

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

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
