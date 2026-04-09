import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createWavHeader(pcmDataLength: number, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // "RIFF"
  view.setUint8(0, 0x52); view.setUint8(1, 0x49); view.setUint8(2, 0x46); view.setUint8(3, 0x46);
  view.setUint32(4, 36 + pcmDataLength, true);
  // "WAVE"
  view.setUint8(8, 0x57); view.setUint8(9, 0x41); view.setUint8(10, 0x56); view.setUint8(11, 0x45);
  // "fmt "
  view.setUint8(12, 0x66); view.setUint8(13, 0x6d); view.setUint8(14, 0x74); view.setUint8(15, 0x20);
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data"
  view.setUint8(36, 0x64); view.setUint8(37, 0x61); view.setUint8(38, 0x74); view.setUint8(39, 0x61);
  view.setUint32(40, pcmDataLength, true);

  return new Uint8Array(header);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phrase_key, phrase_text, voice_name } = await req.json();

    if (!phrase_key || !phrase_text || !voice_name) {
      return new Response(
        JSON.stringify({ error: "phrase_key, phrase_text, and voice_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Gemini TTS model with the same voice names as the live agent
    const ttsModel = "gemini-2.5-flash-preview-tts";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: phrase_text }] }],
        generationConfig: {
          response_modalities: ["AUDIO"],
          speech_config: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice_name,
              },
            },
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini TTS error:", errorText);
      return new Response(
        JSON.stringify({ error: "TTS generation failed", details: errorText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract audio from response
    const audioData = geminiData?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData?.data) {
      return new Response(
        JSON.stringify({ error: "No audio data in response", raw: geminiData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gemini TTS returns PCM audio at 24kHz. Convert base64 PCM to WAV.
    const pcmBytes = base64ToUint8Array(audioData.data);
    const sampleRate = 24000;
    const wavHeader = createWavHeader(pcmBytes.length, sampleRate);
    const wavFile = new Uint8Array(wavHeader.length + pcmBytes.length);
    wavFile.set(wavHeader, 0);
    wavFile.set(pcmBytes, wavHeader.length);

    // Upload to Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const filePath = `${voice_name}/${phrase_key}.wav`;

    const { error: uploadError } = await supabase.storage
      .from("filler-audio")
      .upload(filePath, wavFile, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("filler-audio")
      .getPublicUrl(filePath);

    const audioUrl = publicUrlData.publicUrl;

    // Upsert filler_audio record
    const { error: dbError } = await supabase
      .from("filler_audio")
      .upsert(
        {
          phrase_key,
          phrase_text,
          voice_name,
          audio_url: audioUrl,
          status: "ready",
        },
        { onConflict: "phrase_key,voice_name" }
      );

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(
        JSON.stringify({ error: "Failed to save record", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, audio_url: audioUrl, phrase_key, voice_name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
