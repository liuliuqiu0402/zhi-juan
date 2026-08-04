package com.wisdom.zhijuan;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        try {
            WebView webView = getBridge().getWebView();
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setDatabaseEnabled(true);
            webView.getSettings().setAllowFileAccess(true);
            webView.getSettings().setAllowContentAccess(true);
            // OPPO/ColorOS: 显式设置 WebView 渲染模式
            webView.getSettings().setMixedContentMode(0); // MIXED_CONTENT_ALWAYS_ALLOW
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
