-- 智慧工坊 · Supabase 初始建表
-- 个人使用场景，单行模式（id='default'），JSONB 存储

-- 教材库
CREATE TABLE IF NOT EXISTS textbooks (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 模板库
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 生成历史
CREATE TABLE IF NOT EXISTS doc_history (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户设置
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 策略：允许 anon key 读写（个人使用，无敏感隔离需求）
ALTER TABLE textbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_textbooks" ON textbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_templates" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_doc_history" ON doc_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_user_settings" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- 显式授权 anon / authenticated 角色（SQL Editor 建表不会自动 GRANT）
GRANT ALL ON public.textbooks TO anon, authenticated;
GRANT ALL ON public.templates TO anon, authenticated;
GRANT ALL ON public.doc_history TO anon, authenticated;
GRANT ALL ON public.user_settings TO anon, authenticated;
