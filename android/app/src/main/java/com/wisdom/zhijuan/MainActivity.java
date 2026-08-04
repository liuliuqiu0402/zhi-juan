package com.wisdom.zhijuan;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            // OPPO/ColorOS: 显式设置 WebView 渲染模式
            settings.setMixedContentMode(0); // MIXED_CONTENT_ALWAYS_ALLOW

            // ═══ 视口自适应核心配置 ═══
            // setUseWideViewPort(true) + setLoadWithOverviewMode(true)
            // 使 WebView 以 device-width 为视口宽度，自动缩放到屏幕大小
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            // 禁止文本缩放（防止系统字体大小影响布局）
            settings.setTextZoom(100);
            // 标准布局算法（非 SINGLE_COLUMN，避免移动端重排）
            settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
            // 允许缩放但不让用户手动缩放（由 meta viewport 控制）
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            // 初始缩放 100%
            webView.setInitialScale(100);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
