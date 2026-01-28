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
    const { save_id, user_id, limit = 12 } = await req.json();

    if (!save_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "save_id and user_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the source image's embedding
    const { data: sourceImage, error: fetchError } = await supabase
      .from("saves")
      .select("image_embedding, image_aesthetic_description")
      .eq("id", save_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !sourceImage) {
      return new Response(
        JSON.stringify({ error: "Image not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sourceImage.image_embedding) {
      return new Response(
        JSON.stringify({ error: "Image has no embedding", needsEmbedding: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find similar images using the database function
    const { data: similarImages, error: searchError } = await supabase
      .rpc("find_similar_images", {
        query_embedding: sourceImage.image_embedding,
        user_uuid: user_id,
        exclude_id: save_id,
        match_count: limit,
      });

    if (searchError) {
      console.error("Similarity search error:", searchError);
      return new Response(
        JSON.stringify({ error: "Search failed: " + searchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        source_description: sourceImage.image_aesthetic_description,
        similar: similarImages || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Find similar error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
