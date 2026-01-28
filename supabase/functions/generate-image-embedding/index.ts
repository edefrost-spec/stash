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

    // Step 1: Generate aesthetic description using GPT-4 Vision
    const visionResponse = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: `You are an image aesthetics analyzer. Describe the visual "vibe" of images for similarity matching.

Focus on:
- Dominant colors and color palette (warm/cool, muted/vibrant, specific colors)
- Mood and atmosphere (cozy, energetic, melancholic, serene, dramatic)
- Visual style (minimalist, cluttered, vintage, modern, artistic, photographic)
- Composition (centered, symmetrical, chaotic, geometric, organic)
- Lighting (bright, dark, high contrast, soft, golden hour, neon)
- Subject matter type (nature, urban, people, abstract, food, architecture)
- Texture and patterns (smooth, grainy, textured, patterned)

Output a single paragraph of 50-100 words describing these aesthetic qualities. Be specific and evocative.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: image_url, detail: "low" }
              },
              {
                type: "text",
                text: "Describe the aesthetic vibe of this image."
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!visionResponse.ok) {
      const error = await visionResponse.text();
      console.error("Vision API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to analyze image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const visionData = await visionResponse.json();
    const description = visionData.choices?.[0]?.message?.content || "";

    if (!description) {
      return new Response(
        JSON.stringify({ error: "No description generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Generate embedding from description
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: description,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      console.error("Embedding API error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to generate embedding" }),
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

    // Step 3: Store description and embedding
    const { error: updateError } = await supabase
      .from("saves")
      .update({
        image_aesthetic_description: description,
        image_embedding: embedding,
      })
      .eq("id", save_id)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Database update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to store embedding" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Generate embedding error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
