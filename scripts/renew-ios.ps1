<#
.SYNOPSIS
    智卷工坊 · iOS 签名续签一键脚本
.DESCRIPTION
    自动下载最新 IPA → 引导签名安装 → 支持计划任务自动提醒
    每 6 天双击运行一次即可，不需要手动去 GitHub 下载。
.PARAMETER DownloadOnly
    仅下载 IPA，不启动签名工具
.PARAMETER Setup
    首次运行，检查环境并保存配置
#>

param(
    [switch]$DownloadOnly,
    [switch]$Setup
)

$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "智卷工坊 · iOS 续签"

# ==================== 配置 ====================
$APP_NAME   = "智卷工坊"
$REPO_OWNER = "liuliuqiu0402"
$REPO_NAME  = "zhi-juan"
$IPA_FILE   = "zhijuan.ipa"
$WORK_DIR   = "$env:LOCALAPPDATA\zhijuan-renew"

# ==================== 工具函数 ====================
function Write-Banner {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  📱 $APP_NAME · iOS 续签工具" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Text, [string]$Status = "info")
    $icon = @{ info = "🔹"; ok = "✅"; warn = "⚠️"; err = "❌" }[$Status]
    $color = @{ info = "Cyan"; ok = "Green"; warn = "Yellow"; err = "Red" }[$Status]
    Write-Host "$icon $Text" -ForegroundColor $color
}

function Test-iPhoneConnected {
    $connected = $false
    try {
        # 方法1: 通过 iTunes COM 检测
        $iTunes = New-Object -ComObject iTunes.Application -ErrorAction SilentlyContinue
        if ($iTunes) {
            foreach ($src in $iTunes.Sources) {
                if ($src.Kind -eq 1) {
                    $connected = $true
                    Write-Step "已连接设备: $($src.Name)" -Status ok
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($iTunes) | Out-Null
                    return $true
                }
            }
            [System.Runtime.Interopservices.Marshal]::ReleaseComObject($iTunes) | Out-Null
        }
    } catch {}

    # 方法2: 检查 Apple Mobile Device Service 是否运行
    $amds = Get-Service "Apple Mobile Device Service" -ErrorAction SilentlyContinue
    if ($amds -and $amds.Status -eq "Running") {
        Write-Step "Apple 驱动正常，但未检测到设备（请解锁 iPhone 并信任此电脑）" -Status warn
    } else {
        Write-Step "Apple Mobile Device Service 未运行，请安装/启动 iTunes" -Status warn
    }
    return $connected
}

function Get-LatestIPA {
    Write-Step "正在查找最新 IPA..." -Status info

    # 确保工作目录存在
    New-Item -ItemType Directory -Force -Path $WORK_DIR | Out-Null
    $ipaPath = "$WORK_DIR\$IPA_FILE"

    # 方法1: GitHub Release
    try {
        Write-Step "尝试从 GitHub Release 下载..." -Status info
        $releaseUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/latest"
        $release = Invoke-RestMethod -Uri $releaseUrl -TimeoutSec 15

        $asset = $release.assets | Where-Object { $_.name -eq $IPA_FILE } | Select-Object -First 1

        if ($asset) {
            Write-Step "找到 Release: $($release.tag_name) ($([math]::Round($asset.size/1MB,1)) MB)" -Status info
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $ipaPath -UseBasicParsing

            if ((Get-Item $ipaPath).Length -gt 1048576) {  # > 1MB
                Write-Step "下载完成: $([math]::Round((Get-Item $ipaPath).Length/1MB,1)) MB" -Status ok
                return $ipaPath
            }
        }
    } catch {
        Write-Step "GitHub Release 下载失败: $_" -Status warn
    }

    # 方法2: nightly.link (GitHub Actions 直接下载)
    try {
        Write-Step "尝试从 CI 构建下载..." -Status info
        $zipPath = "$WORK_DIR\zhijuan-ci.zip"
        $ciUrl   = "https://nightly.link/$REPO_OWNER/$REPO_NAME/workflows/ios-build/main/zhijuan-iOS.zip"
        Invoke-WebRequest -Uri $ciUrl -OutFile $zipPath -UseBasicParsing

        Expand-Archive -Path $zipPath -DestinationPath $WORK_DIR -Force
        Remove-Item $zipPath -Force

        $extractedIpa = Get-ChildItem -Path $WORK_DIR -Recurse -Filter "*.ipa" | Select-Object -First 1
        if ($extractedIpa) {
            Move-Item $extractedIpa.FullName $ipaPath -Force
            Write-Step "下载完成: $([math]::Round((Get-Item $ipaPath).Length/1MB,1)) MB" -Status ok
            return $ipaPath
        }
    } catch {
        Write-Step "CI 构建下载失败: $_" -Status warn
    }

    # 全部失败
    Write-Step "自动下载失败，请检查网络或手动下载" -Status err
    Write-Host "`n手动下载地址:"
    Write-Host "  https://github.com/$REPO_OWNER/$REPO_NAME/releases" -ForegroundColor Cyan
    Write-Host "`n下载后放到: $ipaPath" -ForegroundColor Yellow
    Write-Host "然后重新运行此脚本`n"

    Start-Process "https://github.com/$REPO_OWNER/$REPO_NAME/releases"
    Read-Host "按 Enter 退出"
    exit 1
}

function Start-SigningTool {
    param([string]$IpaPath)

    Write-Step "准备签名工具..." -Status info

    # 优先 Sideloadly
    $sideloadlyPaths = @(
        "$env:LOCALAPPDATA\Sideloadly\Sideloadly.exe"
        "${env:ProgramFiles}\Sideloadly\Sideloadly.exe"
        "${env:ProgramFiles(x86)}\Sideloadly\Sideloadly.exe"
    )
    $sideloadly = $sideloadlyPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($sideloadly) {
        Write-Step "找到 Sideloadly，启动中..." -Status ok
        Write-Host "`n📋 Sideloadly 操作步骤:" -ForegroundColor Cyan
        Write-Host "  1. 把 IPA 文件拖入 Sideloadly 窗口"
        Write-Host "  2. 填写 Apple ID（手机号加 +86）和 App 专用密码"
        Write-Host "  3. 点击 Start，等待完成"
        Write-Host "  4. 在 iPhone: 设置→通用→VPN与设备管理→信任证书`n"

        Start-Process $sideloadly
        Start-Process "explorer.exe" "/select,$IpaPath"
        return $true
    }

    # 回退 爱思助手
    $i4toolsPaths = @(
        "${env:ProgramFiles}\i4Tools9\i4Tools.exe"
        "${env:ProgramFiles(x86)}\i4Tools9\i4Tools.exe"
        "$env:LOCALAPPDATA\i4Tools9\i4Tools.exe"
    )
    $i4tools = $i4toolsPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($i4tools) {
        Write-Step "找到爱思助手，启动中..." -Status ok
        Write-Host "`n📋 爱思助手操作步骤:" -ForegroundColor Cyan
        Write-Host "  1. 工具箱 → IPA签名"
        Write-Host "  2. 选择 IPA 文件 → 使用 Apple ID 签名"
        Write-Host "  3. 签名完成后 → 安装到手机"
        Write-Host "  4. 在 iPhone: 设置→通用→VPN与设备管理→信任证书`n"

        Start-Process $i4tools
        Start-Process "explorer.exe" "/select,$IpaPath"
        return $true
    }

    Write-Step "未找到签名工具" -Status err
    Write-Host "`n请下载以下任一工具:" -ForegroundColor Yellow
    Write-Host "  · Sideloadly: https://sideloadly.io"
    Write-Host "  · 爱思助手: https://www.i4.cn"
    Write-Host "`nIPA 文件位置: $IpaPath`n"
    Start-Process "explorer.exe" "/select,$IpaPath"

    Read-Host "按 Enter 退出"
    exit 1
}

# ==================== 主流程 ====================
Write-Banner

# 设备检测
$hasDevice = Test-iPhoneConnected

# 下载 IPA
$ipaPath = Get-LatestIPA

if ($DownloadOnly) {
    Write-Step "仅下载模式，IPA 已保存" -Status ok
    Start-Process "explorer.exe" "/select,$ipaPath"
    Read-Host "按 Enter 退出"
    exit 0
}

# 签名 & 安装
Start-SigningTool -IpaPath $ipaPath

# 完成
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Step "脚本执行完毕！" -Status ok
Write-Host "💡 下次签名到期前再运行此脚本即可" -ForegroundColor Cyan
Write-Host "💡 建议添加到 Windows 计划任务（每 6 天提醒）" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Read-Host "按 Enter 退出"
