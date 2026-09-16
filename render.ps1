# 渲染视频 (一步渲染: NVENC 直接编码)
# 用 required 而非 if-possible: NVENC 若失效会硬报错，避免静默退回 libx264 而没人察觉
# (NVENC 的驱动版本要求与排查方法见 CLAUDE.md)
# 用法: .\render.ps1

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot

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

$activeFile = Join-Path $projectRoot "src/templates/active.ts"
$compositionId = (Select-String -Path $activeFile -Pattern 'activeTemplateId = "(.+?)"').Matches[0].Groups[1].Value
Write-Host "Composition: $compositionId" -ForegroundColor DarkCyan

Write-Host "`n== 渲染: Remotion → NVENC H.264 ==" -ForegroundColor Cyan
Write-Host "输出: $outFile`n"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
npx remotion render $compositionId $outFile `
  --codec=h264 `
  --video-bitrate=8M `
  --sample-rate=48000 `
  --hardware-acceleration=required `
  --x264-preset=slow `
  --offthreadvideo-video-threads=4
$sw.Stop()

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n== 渲染失败 ==" -ForegroundColor Red
    Pop-Location
    exit 1
}

$file = Get-Item "$projectRoot\$outFile"
$sizeMB = [math]::Round($file.Length / 1MB, 1)
$m = [math]::Floor($sw.Elapsed.TotalMinutes)
$s = $sw.Elapsed.Seconds

Write-Host "`n== 渲染完成 ==" -ForegroundColor Green
Write-Host "文件: $outFile"
Write-Host "大小: ${sizeMB} MB"
Write-Host "耗时: ${m}分${s}秒"

Pop-Location
