# Word COM 后处理：将 __TZG_/__FLT_ 标记替换为原生表格/形状
# 策略：用 PowerShell 正则扫文本 → 逆序 Range 替换（不再用 Word 通配符搜索）
param([string]$DocPath)

$ErrorActionPreference = "Stop"

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss.fff"
    Write-Host "[$ts] $msg"
}

try {
    Log "脚本启动, DocPath=$DocPath"

    # --- 0. 打开 Word ---
    Log "创建 Word COM 对象..."
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $word.ScreenUpdating = $false
    $word.AutomationSecurity = 3
    $word.Options.CheckSpellingAsYouType = $false
    $word.Options.CheckGrammarAsYouType = $false
    Log "Word COM 对象创建成功"

    Log "打开文档..."
    $doc = $word.Documents.Open($DocPath)
    Log "文档已打开"

    # ============================================================
    # 用正则扫全文文本找标记（不用 Word 通配符，避免卡死）
    # ============================================================
    Log "读取文档全文..."
    $fullText = $doc.Content.Text
    Log "全文长度: $($fullText.Length) 字符"

    $tzgRegex = [regex]'__TZG_(.+?)_(\d+)__'
    $fltRegex = [regex]'__FLT_(.+?)_(\d+)__'

    $tzgMatches = $tzgRegex.Matches($fullText)
    $fltMatches = $fltRegex.Matches($fullText)
    Log "正则匹配完成 - 田字格: $($tzgMatches.Count) 个, 四线三格: $($fltMatches.Count) 个"

    # ============================================================
    # 逆序处理田字格匹配
    # ============================================================
    $tzgCount = 0
    for ($i = $tzgMatches.Count - 1; $i -ge 0; $i--) {
        $m = $tzgMatches[$i]
        $char = $m.Groups[1].Value
        $emu  = [int]$m.Groups[2].Value

        # 用字符位置创建 Range
        $startPos = $m.Index
        $endPos   = $m.Index + $m.Length
        $rng = $doc.Range($startPos, $endPos)

        # 页面坐标
        try {
            $leftPos = $rng.Information(6)
            $topPos  = $rng.Information(7)
            $leftPos += $doc.PageSetup.LeftMargin
            $topPos  += $doc.PageSetup.TopMargin
        } catch {
            $leftPos = 100; $topPos = 100
        }

        # 字号估算
        $dxa    = [Math]::Round($emu / 635.0)
        $ptSize = [Math]::Round($dxa / 15.0)
        if ($ptSize -lt 10) { $ptSize = 14 }
        if ($ptSize -gt 72) { $ptSize = 14 }
        $cellW = $ptSize * 1.5

        # 删除标记
        $rng.Delete()

        # 插入 1x1 表格
        $tbl = $doc.Tables.Add($rng, 1, 1)
        $tbl.PreferredWidthType = 2
        $tbl.PreferredWidth = $cellW

        $cell = $tbl.Cell(1, 1)
        $cell.Width = $cellW
        try { $cell.Row.HeightRule = 2; $cell.Row.Height = $cellW } catch { }
        $cell.VerticalAlignment = 1

        # 表格外框
        try {
            foreach ($b in $tbl.Borders) {
                $b.LineStyle = 1; $b.LineWidth = 6; $b.Color = 0x999999
            }
        } catch { }
        try { $tbl.Borders.InsideLineStyle = 0 } catch { }

        # 单元格文字
        $cellRange = $cell.Range
        $cellRange.Text = ""
        $cellRange.InsertAfter($char)
        $cellRange.ParagraphFormat.Alignment = 1
        $cellRange.Font.Name = "宋体"
        $cellRange.Font.Size = $ptSize
        $cellRange.ParagraphFormat.SpaceBefore = 0
        $cellRange.ParagraphFormat.SpaceAfter = 0

        # 十字虚线
        $halfW = $cellW / 2.0
        $hLine = $doc.Shapes.AddLine($leftPos, $topPos + $halfW, $leftPos + $cellW, $topPos + $halfW)
        $hLine.Line.DashStyle = 2; $hLine.Line.ForeColor.RGB = 0x999999; $hLine.Line.Weight = 0.75
        $hLine.ZOrder(4); $hLine.RelativeHorizontalPosition = 3; $hLine.RelativeVerticalPosition = 4

        $vLine = $doc.Shapes.AddLine($leftPos + $halfW, $topPos, $leftPos + $halfW, $topPos + $cellW)
        $vLine.Line.DashStyle = 2; $vLine.Line.ForeColor.RGB = 0x999999; $vLine.Line.Weight = 0.75
        $vLine.ZOrder(4); $vLine.RelativeHorizontalPosition = 3; $vLine.RelativeVerticalPosition = 4

        $tzgCount++
        if ($tzgCount % 10 -eq 0) { Log "田字格进度: $tzgCount / $($tzgMatches.Count)" }
    }
    Log "田字格处理完成: $tzgCount 个"

    # ============================================================
    # 逆序处理四线三格匹配
    # ============================================================
    $fltCount = 0
    for ($i = $fltMatches.Count - 1; $i -ge 0; $i--) {
        $m = $fltMatches[$i]
        $letter = $m.Groups[1].Value
        $emu    = [int]$m.Groups[2].Value

        $startPos = $m.Index
        $endPos   = $m.Index + $m.Length
        $rng = $doc.Range($startPos, $endPos)

        try {
            $leftPos = $rng.Information(6)
            $topPos  = $rng.Information(7)
            $leftPos += $doc.PageSetup.LeftMargin
            $topPos  += $doc.PageSetup.TopMargin
        } catch {
            $leftPos = 100; $topPos = 100
        }

        $dxa    = [Math]::Round($emu / 635.0)
        $ptSize = [Math]::Round($dxa / 20.0)
        if ($ptSize -lt 10) { $ptSize = 14 }
        if ($ptSize -gt 72) { $ptSize = 14 }

        # 删除标记，替换为字母
        $rng.Delete()
        $rng.InsertAfter($letter)
        $rng.Font.Name = "Times New Roman"
        $rng.Font.Size = $ptSize

        # 4 条水平线
        $lineEm  = @(0.10, 0.55, 1.00, 1.45)
        $colors  = @(0x999999, 0x999999, 0x666666, 0xE74C3C)
        $weights = @(0.5, 0.5, 0.75, 1.0)
        $lineWid = $ptSize * 1.6

        for ($j = 0; $j -lt 4; $j++) {
            $yOff = $lineEm[$j] * $ptSize
            $l = $doc.Shapes.AddLine($leftPos, $topPos + $yOff, $leftPos + $lineWid, $topPos + $yOff)
            $l.Line.ForeColor.RGB = $colors[$j]; $l.Line.Weight = $weights[$j]
            $l.ZOrder(4); $l.RelativeHorizontalPosition = 3; $l.RelativeVerticalPosition = 4
        }

        $fltCount++
    }
    Log "四线三格处理完成: $fltCount 个"

    # 保存 & 退出
    Log "保存文档..."
    $doc.Save()
    Log "关闭文档..."
    $doc.Close()
    Log "退出 Word..."
    $word.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    Log "全部完成"

    @{ success = $true; error = ""; processed = @{ tzg = $tzgCount; flt = $fltCount } } | ConvertTo-Json -Compress

} catch {
    $errMsg = "EXCEPTION: $($_.Exception.Message)"
    Log $errMsg
    Log "Stack: $($_.ScriptStackTrace)"
    try {
        if ($doc)  { try { $doc.Close(0) } catch { } }
        if ($word) {
            $word.Quit()
            [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
        }
    } catch { }
    @{ success = $false; error = $errMsg; processed = @{ tzg = 0; flt = 0 } } | ConvertTo-Json -Compress
}
