
-- Create filler_audio table
CREATE TABLE public.filler_audio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase_key TEXT NOT NULL,
  phrase_text TEXT NOT NULL,
  voice_name TEXT NOT NULL DEFAULT 'Aoede',
  audio_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on phrase_key + voice_name
ALTER TABLE public.filler_audio ADD CONSTRAINT filler_audio_phrase_voice_unique UNIQUE (phrase_key, voice_name);

-- Enable RLS
ALTER TABLE public.filler_audio ENABLE ROW LEVEL SECURITY;

-- Allow public access (admin tool, no auth yet)
CREATE POLICY "Allow full access to filler_audio" ON public.filler_audio FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_filler_audio_updated_at
  BEFORE UPDATE ON public.filler_audio
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for filler audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('filler-audio', 'filler-audio', true);

-- Public read access for the bucket
CREATE POLICY "Public read access for filler audio" ON storage.objects FOR SELECT USING (bucket_id = 'filler-audio');

-- Public insert/update/delete for admin usage
CREATE POLICY "Public write access for filler audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'filler-audio');
CREATE POLICY "Public update access for filler audio" ON storage.objects FOR UPDATE USING (bucket_id = 'filler-audio');
CREATE POLICY "Public delete access for filler audio" ON storage.objects FOR DELETE USING (bucket_id = 'filler-audio');
