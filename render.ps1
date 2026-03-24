# 渲染 Top5 视频
# 用法: .\render.ps1

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

# Use project-local temp dir to avoid Windows Storage Sense cleanup during render
$env:TEMP = Join-Path $projectRoot ".remotion-tmp"
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null

Push-Location $projectRoot

$projectName = (Get-Content ".current-project" -ErrorAction SilentlyContinue).Trim()
if (-not $projectName) { $projectName = "video" }
$timestamp = Get-Date -Format "MMdd-HHmm"
$outFile = "out/${projectName}_${timestamp}.mp4"

Write-Host "`n== 生成配置 ==" -ForegroundColor Cyan
npm run config

Write-Host "`n== 开始渲染 ==" -ForegroundColor Cyan
Write-Host "输出: $outFile | 码率: 20M | 编码: H.264`n"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
npx remotion render Top5Video $outFile --video-bitrate=20M --x264-preset=medium
$sw.Stop()

if ($LASTEXITCODE -eq 0) {
    $file = Get-Item "$projectRoot\$outFile"
    $sizeMB = [math]::Round($file.Length / 1MB, 1)
    $mins = [math]::Floor($sw.Elapsed.TotalMinutes)
    $secs = $sw.Elapsed.Seconds
    Write-Host "`n== 渲染完成 ==" -ForegroundColor Green
    Write-Host "文件: $outFile"
    Write-Host "大小: ${sizeMB} MB"
    Write-Host "耗时: ${mins}分${secs}秒"
} else {
    Write-Host "`n== 渲染失败 ==" -ForegroundColor Red
}

Pop-Location
