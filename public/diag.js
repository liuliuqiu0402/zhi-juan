// ═══ 外部脚本诊断：OPPO 是否只禁内联脚本？ ═══
(function() {
  var __t0 = Date.now();
  var __dl = document.getElementById('diag-layer');
  if (__dl) {
    __dl.textContent = '🟢 EXT-JS:' + __t0 + 'ms';
    __dl.style.background = '#2e7d32';
  } else {
    // 如果找不到 diag-layer，写进 app
    var app = document.getElementById('app');
    if (app) app.innerHTML = '<div style="color:green;padding:20px;">🟢 EXT-JS ALIVE (no diag-layer)</div>';
  }

  // 错误捕获
  window.__showError = function(msg) {
    if (__dl) { __dl.textContent = '🔴 ERROR'; __dl.style.background = '#b71c1c'; }
    var el = document.getElementById('app');
    if (el) el.innerHTML = '<div style="padding:40px 20px;font-family:sans-serif;color:#e53935;text-align:center;"><h2>⚠️ 启动异常</h2><pre style="text-align:left;background:#fff3f3;padding:16px;border-radius:8px;overflow:auto;max-height:70vh;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-all;">' + msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre></div>';
  };

  window.addEventListener('error', function(e) {
    var isJsError = e instanceof ErrorEvent;
    var isScript = e.target && e.target.tagName === 'SCRIPT';
    if (!isJsError && !isScript) return;
    var msg = e.message || '(none)';
    var info = '[error]\ntype=' + e.type + '\nmessage=' + msg + '\nfilename=' + (e.filename || '(none)') + '\ntarget=' + ((e.target && e.target.tagName) || e.target || 'window');
    if (isScript) info += '\nsrc=' + (e.target.src || e.target.getAttribute('src') || '?');
    window.__showError(info);
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    window.__showError('Promise: ' + (e.reason && e.reason.message || String(e.reason)));
  });
})();
