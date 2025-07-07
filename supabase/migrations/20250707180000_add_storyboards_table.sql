-- Create storyboards table
CREATE TABLE storyboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  model TEXT NOT NULL CHECK (model IN ('gen4_turbo', 'gen4', 'gen3_alpha_turbo')),
  ratio TEXT NOT NULL CHECK (ratio IN ('1280:720', '1584:672', '1104:832', '720:1280', '832:1104', '672:1584')),
  shots JSONB NOT NULL,
  fps INTEGER NOT NULL DEFAULT 24 CHECK (fps IN (24, 30)),
  output_format TEXT NOT NULL DEFAULT 'mp4' CHECK (output_format IN ('mp4', 'gif')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on story_id for fast lookups
CREATE INDEX idx_storyboards_story_id ON storyboards(story_id);

-- Add RLS policies
ALTER TABLE storyboards ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (same as other tables)
CREATE POLICY "Allow all operations on storyboards" ON storyboards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_storyboards_updated_at BEFORE UPDATE ON storyboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 