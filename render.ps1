# 渲染 Top5 视频
# 用法: .\render.ps1

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

Push-Location $projectRoot

Write-Host "`n== 生成配置 ==" -ForegroundColor Cyan
npm run config

Write-Host "`n== 开始渲染 ==" -ForegroundColor Cyan
Write-Host "输出: out/video.mp4 | 码率: 10M | 编码: H.264`n"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
npm run build
$sw.Stop()

if ($LASTEXITCODE -eq 0) {
    $file = Get-Item "$projectRoot\out\video.mp4"
    $sizeMB = [math]::Round($file.Length / 1MB, 1)
    $mins = [math]::Floor($sw.Elapsed.TotalMinutes)
    $secs = $sw.Elapsed.Seconds
    Write-Host "`n== 渲染完成 ==" -ForegroundColor Green
    Write-Host "文件: out/video.mp4"
    Write-Host "大小: ${sizeMB} MB"
    Write-Host "耗时: ${mins}分${secs}秒"
} else {
    Write-Host "`n== 渲染失败 ==" -ForegroundColor Red
}

Pop-Location
