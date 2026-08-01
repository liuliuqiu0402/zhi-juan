-- 003: generated_docs 独立建表
-- 从 user_settings 拆分出来，与 doc_history 结构一致

CREATE TABLE IF NOT EXISTS generated_docs (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_generated_docs" ON generated_docs FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.generated_docs TO anon, authenticated;
