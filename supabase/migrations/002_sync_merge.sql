-- 智慧工坊 · 同步机制重构：云端合并 + sync_key 隔离
-- 客户端调用 RPC，服务端事务内原子合并，消除多端挤兑

-- ══════════════════════════════════════════════════════════════
-- RPC：服务端合并 doc_history
-- 逻辑：读当前 → 按 id 去重（p_items 优先）→ 截断 50 条 → 写回
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION merge_doc_history(p_sync_key TEXT, p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_current JSONB;
  v_result JSONB;
BEGIN
  SELECT data INTO v_current FROM doc_history WHERE id = p_sync_key;
  IF v_current IS NULL THEN
    v_current := '[]'::jsonb;
  END IF;

  WITH all_items AS (
    SELECT item, 1 AS priority FROM jsonb_array_elements(p_items) AS item
    UNION ALL
    SELECT item, 2 AS priority FROM jsonb_array_elements(v_current) AS item
  ),
  deduped AS (
    SELECT DISTINCT ON (item->>'id') item
    FROM all_items
    ORDER BY (item->>'id'), priority
  ),
  sorted AS (
    SELECT item FROM deduped
    ORDER BY
      (item->>'savedAt')::bigint DESC NULLS LAST,
      (item->>'timestamp')::bigint DESC NULLS LAST
    LIMIT 50
  )
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_result FROM sorted;

  INSERT INTO doc_history (id, data, updated_at)
  VALUES (p_sync_key, v_result, now())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result), 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- RPC：服务端合并 generated_docs
-- 同 doc_history，截断 20 条
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION merge_generated_docs(p_sync_key TEXT, p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_id TEXT;
  v_current JSONB;
  v_result JSONB;
BEGIN
  v_id := p_sync_key || ':generated_docs';

  SELECT data INTO v_current FROM user_settings WHERE id = v_id;
  IF v_current IS NULL THEN
    v_current := '[]'::jsonb;
  END IF;

  WITH all_items AS (
    SELECT item, 1 AS priority FROM jsonb_array_elements(p_items) AS item
    UNION ALL
    SELECT item, 2 AS priority FROM jsonb_array_elements(v_current) AS item
  ),
  deduped AS (
    SELECT DISTINCT ON (item->>'id') item
    FROM all_items
    ORDER BY (item->>'id'), priority
  ),
  sorted AS (
    SELECT item FROM deduped
    ORDER BY
      (item->>'savedAt')::bigint DESC NULLS LAST,
      (item->>'timestamp')::bigint DESC NULLS LAST
    LIMIT 20
  )
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_result FROM sorted;

  INSERT INTO user_settings (id, data, updated_at)
  VALUES (v_id, v_result, now())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result), 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- GRANT：允许 anon 角色执行 RPC
-- ══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION merge_doc_history(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION merge_generated_docs(TEXT, JSONB) TO anon, authenticated;
