' draw_shapes.vbs — 扫描 §TZG/§MIZ/§FLT 标记并 COM 自绘形状
' 用法: cscript //nologo draw_shapes.vbs "C:\path\to\output.docx"
' 前置: Microsoft Word 2010+ 或 WPS Office（Word 优先，WPS 回退）

Option Explicit

Dim app, doc, filePath, engine

If WScript.Arguments.Count < 1 Then
    WScript.Echo "ERROR: Missing file path argument."
    WScript.Quit 1
End If

filePath = WScript.Arguments(0)

' ===== 启动办公软件（Word → WPS 回退） =====
Dim progIDs: progIDs = Array("Word.Application", "WPS.Application", "KWPS.Application")
Dim idx, errMsg
engine = ""

For idx = 0 To UBound(progIDs)
    On Error Resume Next
    Set app = CreateObject(progIDs(idx))
    errMsg = Err.Description
    If Err.Number = 0 And Not app Is Nothing Then
        engine = progIDs(idx)
        Exit For
    End If
    Err.Clear
Next
On Error GoTo 0

If engine = "" Then
    WScript.Echo "ERROR: No office software found (tried Word, WPS)."
    WScript.Quit 2
End If

app.Visible = False
app.DisplayAlerts = 0
app.AutomationSecurity = 1

WScript.Echo "Engine: " & engine

On Error Resume Next
Set doc = app.Documents.Open(filePath)
If Err.Number <> 0 Or doc Is Nothing Then
    WScript.Echo "ERROR: Cannot open " & filePath
    If Not app Is Nothing Then app.Quit
    WScript.Quit 3
End If
On Error GoTo 0

' 处理三种标记
ProcessType doc, "TZG"
ProcessType doc, "MIZ"
ProcessType doc, "FLT"

doc.Save
doc.Close
app.Quit

WScript.Echo "OK"

' ===== Subroutines =====

Sub ProcessType(objDoc, mType)
    Dim rng, text, fs, fullMarkLen
    Dim leftPos, topPos, markerStart
    Dim marginLeft, marginTop

    ' 正文区域坐标需加上页边距才能转为页面绝对坐标
    marginLeft = CDbl(objDoc.PageSetup.LeftMargin)
    marginTop  = CDbl(objDoc.PageSetup.TopMargin)

    Set rng = objDoc.Content
    rng.Find.ClearFormatting
    rng.Find.Text = ChrW(167) & mType & ":"
    rng.Find.Forward = True
    rng.Find.Wrap = 0

    Do While rng.Find.Execute() = True
        markerStart = rng.Start

        rng.MoveEnd 1, 30
        text = rng.Text
        rng.MoveEnd 1, -30

        fs = ParseSize(text, mType)
        If fs > 0 Then
            fullMarkLen = InStr(2, text, ChrW(167))
            If fullMarkLen > 0 Then
                ' 定位到标记之后的真实汉字（而非 2pt 白色标记字符）
                rng.Collapse 0                           ' 收窄到 Find 匹配末尾
                rng.MoveEnd 1, fullMarkLen - 5           ' 滑过剩余标记字符
                rng.Collapse 0                           ' 收窄到标记末尾 = 汉字起始
                rng.MoveEnd 1, 1                         ' 选中第一个真实汉字

                ' Information() 返回正文区域内坐标（twips），需加页边距得到页面坐标
                leftPos = CDbl(rng.Information(5)) / 20.0 + marginLeft
                topPos  = CDbl(rng.Information(6)) / 20.0 + marginTop
                DrawForType mType, objDoc, leftPos, topPos, CDbl(fs)

                ' 删除完整标记 [markerStart, markerStart + fullMarkLen)
                rng.MoveStart 1, -(fullMarkLen)
                rng.MoveEnd 1, -1
                rng.Delete
                rng.Collapse 0
            Else
                rng.Collapse 0
            End If
        Else
            rng.Collapse 0
        End If
    Loop
    Set rng = Nothing
End Sub

Function ParseSize(text, mType)
    Dim re, matches
    Set re = CreateObject("VBScript.RegExp")
    re.Pattern = ChrW(167) & mType & ":(\d+)" & ChrW(167)
    If re.Test(text) Then
        Set matches = re.Execute(text)
        ParseSize = CInt(matches(0).SubMatches(0))
    Else
        ParseSize = 0
    End If
End Function

Sub DrawForType(mType, objDoc, x, y, fs)
    Dim cellSz, halfSz
    cellSz = fs * 1.8
    halfSz = cellSz / 2.0

    On Error Resume Next
    Select Case mType
        Case "TZG"
            DrawGrid objDoc, x, y, cellSz, halfSz, False
        Case "MIZ"
            DrawGrid objDoc, x, y, cellSz, halfSz, True
        Case "FLT"
            DrawFourLine objDoc, x, y, fs, cellSz
    End Select
    On Error GoTo 0
End Sub

Sub DrawGrid(objDoc, x, y, sz, half, isMi)
    Dim shapeRect, lineH, lineV, lineD1, lineD2
    Dim sX, sY, sSz, sHalf

    sX = CDbl(x)
    sY = CDbl(y)
    sSz = CDbl(sz)
    sHalf = CDbl(half)

    On Error Resume Next

    ' 外框矩形
    Set shapeRect = objDoc.Shapes.AddShape(1, sX, sY, sSz, sSz)
    If Not shapeRect Is Nothing Then
        shapeRect.Fill.Visible = False
        shapeRect.Line.ForeColor.RGB = RGB(153, 153, 153)
        shapeRect.Line.Weight = 1.5
        shapeRect.RelativeHorizontalPosition = 1
        shapeRect.RelativeVerticalPosition = 1
        shapeRect.Left = sX
        shapeRect.Top = sY
        shapeRect.ZOrder 1
    End If

    ' 水平中线
    Set lineH = objDoc.Shapes.AddLine(sX, sY + sHalf, sX + sSz, sY + sHalf)
    If Not lineH Is Nothing Then
        lineH.Line.ForeColor.RGB = RGB(204, 204, 204)
        lineH.Line.Weight = 0.5
        lineH.RelativeHorizontalPosition = 1
        lineH.RelativeVerticalPosition = 1
        lineH.Left = sX
        lineH.Top = sY + sHalf
        lineH.ZOrder 1
    End If

    ' 竖直中线
    Set lineV = objDoc.Shapes.AddLine(sX + sHalf, sY, sX + sHalf, sY + sSz)
    If Not lineV Is Nothing Then
        lineV.Line.ForeColor.RGB = RGB(204, 204, 204)
        lineV.Line.Weight = 0.5
        lineV.RelativeHorizontalPosition = 1
        lineV.RelativeVerticalPosition = 1
        lineV.Left = sX + sHalf
        lineV.Top = sY
        lineV.ZOrder 1
    End If

    ' 米字格对角线
    If isMi Then
        Set lineD1 = objDoc.Shapes.AddLine(sX, sY, sX + sSz, sY + sSz)
        If Not lineD1 Is Nothing Then
            lineD1.Line.ForeColor.RGB = RGB(204, 204, 204)
            lineD1.Line.Weight = 0.5
            lineD1.RelativeHorizontalPosition = 1
            lineD1.RelativeVerticalPosition = 1
            lineD1.ZOrder 1
        End If

        Set lineD2 = objDoc.Shapes.AddLine(sX + sSz, sY, sX, sY + sSz)
        If Not lineD2 Is Nothing Then
            lineD2.Line.ForeColor.RGB = RGB(204, 204, 204)
            lineD2.Line.Weight = 0.5
            lineD2.RelativeHorizontalPosition = 1
            lineD2.RelativeVerticalPosition = 1
            lineD2.ZOrder 1
        End If
    End If

    On Error GoTo 0
End Sub

Sub DrawFourLine(objDoc, x, y, fs, w)
    Dim fy, fx, fw, ffs

    ffs = CDbl(fs)
    fx = CDbl(x)
    fy = CDbl(y)
    fw = CDbl(w)

    AddHLine objDoc, fx, fy + ffs * 0.10, fx + fw, RGB(153,153,153), 0.75
    AddHLine objDoc, fx, fy + ffs * 0.55, fx + fw, RGB(153,153,153), 0.75
    AddHLine objDoc, fx, fy + ffs * 1.00, fx + fw, RGB(102,102,102), 0.75
    AddHLine objDoc, fx, fy + ffs * 1.45, fx + fw, RGB(153,153,153), 0.75
End Sub

Sub AddHLine(objDoc, x1, y1, x2, clr, wgt)
    Dim ln, dx1, dy1, dx2
    dx1 = CDbl(x1)
    dy1 = CDbl(y1)
    dx2 = CDbl(x2)

    On Error Resume Next
    Set ln = objDoc.Shapes.AddLine(dx1, dy1, dx2, dy1)
    If Not ln Is Nothing Then
        ln.Line.ForeColor.RGB = clr
        ln.Line.Weight = wgt
        ln.RelativeHorizontalPosition = 1
        ln.RelativeVerticalPosition = 1
        ln.Left = dx1
        ln.Top = dy1
        ln.ZOrder 1
    End If
    On Error GoTo 0
End Sub
