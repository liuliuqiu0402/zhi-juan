-- 智慧工坊 · 同步机制 v3：按设备独立存储 + 拉取时动态合并
--
-- 推：每个设备独立一行 (sync_key + device_id)，互不覆盖
-- 拉：读取所有设备行 → 按 id 去重（最新时间戳优先）→ 过滤 _deleted 标记
-- 效果：多端同时生成不丢数据 ✅  一端删除全端同步 ✅  无需手动合并 ✅

-- ══════════════════════════════════════════════════════════════
-- doc_history：push（设备写自己的行）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION push_doc_history(
  p_sync_key TEXT,
  p_device_id TEXT,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_id TEXT;
  v_result JSONB;
BEGIN
  v_id := p_sync_key || ':' || p_device_id;

  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (SELECT item FROM jsonb_array_elements(p_items) AS item LIMIT 50) sub;

  INSERT INTO doc_history (id, data, updated_at)
  VALUES (v_id, v_result, now())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- doc_history：pull（读所有设备行 → 合并去重 → 过滤删除标记）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION pull_doc_history(p_sync_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH all_items AS (
    SELECT jsonb_array_elements(data) AS item
    FROM doc_history
    WHERE id LIKE p_sync_key || ':%'
  ),
  -- 任意设备标记 _deleted 即视为删除
  tombstone_ids AS (
    SELECT DISTINCT item->>'id' AS tid
    FROM all_items
    WHERE (item->>'_deleted')::boolean IS TRUE
  ),
  -- 去重：同 id 保留最新时间戳版本
  merged AS (
    SELECT DISTINCT ON ((item->>'id'))
      item
    FROM all_items
    WHERE (item->>'id') NOT IN (SELECT tid FROM tombstone_ids)
    ORDER BY (item->>'id'),
      (item->>'savedAt')::bigint DESC NULLS LAST,
      (item->>'timestamp')::bigint DESC NULLS LAST
  )
  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (
    -- 🔧 LIMIT 必须在 jsonb_agg 之前作用到行（聚合后只产 1 行，LIMIT 无效）
    SELECT item FROM merged
    ORDER BY (item->>'savedAt')::bigint DESC NULLS LAST,
             (item->>'timestamp')::bigint DESC NULLS LAST
    LIMIT 50
  ) limited;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result), 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- generated_docs：push（设备写自己的行到 user_settings）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION push_generated_docs(
  p_sync_key TEXT,
  p_device_id TEXT,
  p_items JSONB
) RETURNS JSONB AS $$
DECLARE
  v_id TEXT;
  v_result JSONB;
BEGIN
  v_id := p_sync_key || ':generated_docs:' || p_device_id;

  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (SELECT item FROM jsonb_array_elements(p_items) AS item LIMIT 20) sub;

  INSERT INTO user_settings (id, data, updated_at)
  VALUES (v_id, v_result, now())
  ON CONFLICT (id) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- generated_docs：pull（读所有设备行 → 合并去重 → 过滤删除标记）
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION pull_generated_docs(p_sync_key TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH all_items AS (
    SELECT jsonb_array_elements(data) AS item
    FROM user_settings
    WHERE id LIKE p_sync_key || ':generated_docs:%'
  ),
  tombstone_ids AS (
    SELECT DISTINCT item->>'id' AS tid
    FROM all_items
    WHERE (item->>'_deleted')::boolean IS TRUE
  ),
  merged AS (
    SELECT DISTINCT ON ((item->>'id'))
      item
    FROM all_items
    WHERE (item->>'id') NOT IN (SELECT tid FROM tombstone_ids)
    ORDER BY (item->>'id'),
      (item->>'savedAt')::bigint DESC NULLS LAST,
      (item->>'timestamp')::bigint DESC NULLS LAST
  )
  SELECT COALESCE(jsonb_agg(item ORDER BY
    (item->>'savedAt')::bigint DESC NULLS LAST,
    (item->>'timestamp')::bigint DESC NULLS LAST
  ), '[]'::jsonb) INTO v_result
  FROM (
    -- 🔧 LIMIT 必须在 jsonb_agg 之前作用到行
    SELECT item FROM merged
    ORDER BY (item->>'savedAt')::bigint DESC NULLS LAST,
             (item->>'timestamp')::bigint DESC NULLS LAST
    LIMIT 20
  ) limited;

  RETURN jsonb_build_object('ok', true, 'count', jsonb_array_length(v_result), 'data', v_result);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- v4 轻量拉取：只查原始行，合并去重交给客户端 JS
--   旧 RPC (pull_*) 保留兼容，新客户端走 fetch_*
--   返回格式：[{"data": [items...]}, {"data": [items...]}, ...]
-- ══════════════════════════════════════════════════════════════

-- doc_history：纯查询，不做任何处理
CREATE OR REPLACE FUNCTION fetch_doc_history(p_sync_key TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('data', data) ORDER BY updated_at DESC), '[]'::jsonb)
  FROM doc_history
  WHERE id LIKE p_sync_key || ':%';
$$;

-- generated_docs：纯查询，不做任何处理
CREATE OR REPLACE FUNCTION fetch_generated_docs(p_sync_key TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('data', data) ORDER BY updated_at DESC), '[]'::jsonb)
  FROM user_settings
  WHERE id LIKE p_sync_key || ':generated_docs:%';
$$;

-- ══════════════════════════════════════════════════════════════
-- v5 合并查询：一次拉取所有 user_settings 行，客户端按 ID 分流
--   替代 settings / activation / instructions / generated_docs 四次分查
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fetch_all_user_settings(p_sync_key TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'data', data)
    ORDER BY updated_at DESC
  ), '[]'::jsonb)
  FROM user_settings
  WHERE id LIKE p_sync_key || ':%';
$$;

-- ══════════════════════════════════════════════════════════════
-- GRANT
-- ══════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION push_doc_history(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pull_doc_history(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION push_generated_docs(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pull_generated_docs(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fetch_doc_history(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fetch_generated_docs(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fetch_all_user_settings(TEXT) TO anon, authenticated;
