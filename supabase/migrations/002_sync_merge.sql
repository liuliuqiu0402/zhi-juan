-- 智慧工坊 · 同步机制重构：云端覆盖写入 + sync_key 隔离
-- 客户端调用 RPC，服务端事务内原子覆盖，消除多端挤兑
--
-- 合并策略：客户端发完整列表 → 直接覆盖写入（Last-Write-Wins）
--   效果：新增 ✅  删除 ✅  更新 ✅  单用户多设备可预期

-- ══════════════════════════════════════════════════════════════
-- RPC：覆盖写入 doc_history（截断 50 条）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION merge_doc_history(p_sync_key TEXT, p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (SELECT item FROM jsonb_array_elements(p_items) AS item LIMIT 50) sub;

  INSERT INTO doc_history (id, data, updated_at)
  VALUES (p_sync_key, v_result, now())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result), 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- RPC：覆盖写入 generated_docs（截断 20 条）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION merge_generated_docs(p_sync_key TEXT, p_items JSONB)
RETURNS JSONB AS $$
DECLARE
  v_id TEXT;
  v_result JSONB;
BEGIN
  v_id := p_sync_key || ':generated_docs';

  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (SELECT item FROM jsonb_array_elements(p_items) AS item LIMIT 20) sub;

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
