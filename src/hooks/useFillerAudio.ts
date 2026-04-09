import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVersionedAudioUrl } from "@/lib/filler-audio";

export interface FillerPhrase {
  id: string;
  phrase_key: string;
  phrase_text: string;
  voice_name: string;
  audio_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PHRASES = [
  { key: "hello", text: "Hello!" },
  { key: "hi_there", text: "Hi there!" },
  { key: "i_see", text: "I see..." },
  { key: "okay", text: "Okay..." },
  { key: "right", text: "Right..." },
  { key: "hmm", text: "Hmm..." },
  { key: "let_me_think", text: "Let me think..." },
  { key: "interesting", text: "Interesting..." },
  { key: "got_it", text: "Got it..." },
  { key: "sure", text: "Sure!" },
  { key: "one_moment", text: "One moment..." },
  { key: "absolutely", text: "Absolutely!" },
];

export function useFillerAudio(voiceName: string) {
  const [phrases, setPhrases] = useState<FillerPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());

  const fetchPhrases = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("filler_audio")
      .select("*")
      .eq("voice_name", voiceName)
      .order("phrase_key");

    if (error) {
      console.error("Error fetching filler audio:", error);
      setLoading(false);
      return;
    }

    // Merge with defaults so all phrases show up
    const existing = new Map((data ?? []).map((d: FillerPhrase) => [d.phrase_key, d]));
    const merged: FillerPhrase[] = DEFAULT_PHRASES.map((dp) => {
      if (existing.has(dp.key)) return existing.get(dp.key)!;
      return {
        id: crypto.randomUUID(),
        phrase_key: dp.key,
        phrase_text: dp.text,
        voice_name: voiceName,
        audio_url: null,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    // Also add any DB entries not in defaults
    for (const [key, val] of existing) {
      if (!DEFAULT_PHRASES.some((dp) => dp.key === key)) {
        merged.push(val);
      }
    }

    setPhrases(merged);
    setLoading(false);
  }, [voiceName]);

  useEffect(() => {
    fetchPhrases();
  }, [fetchPhrases]);

  const generate = useCallback(
    async (phraseKey: string, phraseText: string) => {
      setGeneratingKeys((prev) => new Set(prev).add(phraseKey));

      // Update local state to "generating"
      setPhrases((prev) =>
        prev.map((p) =>
          p.phrase_key === phraseKey ? { ...p, status: "generating" } : p
        )
      );

      try {
        // Also upsert a "generating" status in DB
        await supabase.from("filler_audio").upsert(
          {
            phrase_key: phraseKey,
            phrase_text: phraseText,
            voice_name: voiceName,
            status: "generating",
          },
          { onConflict: "phrase_key,voice_name" }
        );

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const response = await fetch(
          `${baseUrl}/functions/v1/generate-filler-audio`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({
              phrase_key: phraseKey,
              phrase_text: phraseText,
              voice_name: voiceName,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `Generation failed (${response.status})`);
        }

        const result = await response.json();

        setPhrases((prev) =>
          prev.map((p) =>
            p.phrase_key === phraseKey
              ? {
                  ...p,
                  status: "ready",
                  audio_url: getVersionedAudioUrl(result.audio_url, new Date().toISOString()),
                  updated_at: new Date().toISOString(),
                }
              : p
          )
        );
      } catch (err) {
        console.error("Generation error:", err);
        setPhrases((prev) =>
          prev.map((p) =>
            p.phrase_key === phraseKey ? { ...p, status: "failed" } : p
          )
        );

        await supabase
          .from("filler_audio")
          .upsert(
            { phrase_key: phraseKey, phrase_text: phraseText, voice_name: voiceName, status: "failed" },
            { onConflict: "phrase_key,voice_name" }
          )
          .then(() => {});
      } finally {
        setGeneratingKeys((prev) => {
          const next = new Set(prev);
          next.delete(phraseKey);
          return next;
        });
      }
    },
    [voiceName]
  );

  const deleteFiller = useCallback(
    async (phraseKey: string) => {
      // Delete from storage
      await supabase.storage
        .from("filler-audio")
        .remove([`${voiceName}/${phraseKey}.wav`]);

      // Delete from DB
      await supabase
        .from("filler_audio")
        .delete()
        .eq("phrase_key", phraseKey)
        .eq("voice_name", voiceName);

      setPhrases((prev) =>
        prev.map((p) =>
          p.phrase_key === phraseKey
            ? { ...p, status: "pending", audio_url: null }
            : p
        )
      );
    },
    [voiceName]
  );

  const generateAll = useCallback(async () => {
    const pending = phrases.filter(
      (p) => p.status === "pending" || p.status === "failed"
    );
    for (const p of pending) {
      await generate(p.phrase_key, p.phrase_text);
    }
  }, [phrases, generate]);

  return {
    phrases,
    loading,
    generatingKeys,
    generate,
    generateAll,
    deleteFiller,
    refetch: fetchPhrases,
  };
}
