import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { save_id, user_id, audio_path } = await req.json();

    if (!save_id || !user_id || !audio_path) {
      return new Response(
        JSON.stringify({ error: "save_id, user_id, and audio_path required" }),
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

    // 1. Download audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabase.storage
      .from("audio")
      .download(audio_path);

    if (downloadError || !audioData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download audio file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Transcribe with OpenAI Whisper API
    const extension = audio_path.split(".").pop() || "m4a";
    const formData = new FormData();
    formData.append("file", audioData, `audio.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");

    const whisperResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      }
    );

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text();
      console.error("Whisper error:", errText);
      return new Response(
        JSON.stringify({ error: "Transcription failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcription = (await whisperResponse.text()).trim();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "Empty transcription" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Generate a concise title from the transcription
    let title = "Voice Memo";
    if (transcription.length > 20) {
      try {
        const titleResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content:
                    "Generate a concise, descriptive title (5-8 words max) for this voice memo transcription. Return ONLY the title text, no quotes or punctuation wrapping.",
                },
                { role: "user", content: transcription.substring(0, 1000) },
              ],
              temperature: 0.3,
              max_tokens: 30,
            }),
          }
        );

        if (titleResponse.ok) {
          const titleData = await titleResponse.json();
          const generated = titleData.choices?.[0]?.message?.content?.trim();
          if (generated) {
            title = generated.replace(/^["']|["']$/g, "");
          }
        }
      } catch (err) {
        console.warn("Title generation failed, using default:", err);
      }
    }

    // 4. Update the save with transcription and title
    const { error: updateError } = await supabase
      .from("saves")
      .update({
        content: transcription,
        title: title,
        excerpt: transcription.substring(0, 180),
      })
      .eq("id", save_id)
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update save with transcription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Trigger auto-tag (fire-and-forget via internal call)
    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-tag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ save_id, user_id }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        title,
        transcription_length: transcription.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Transcribe error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
