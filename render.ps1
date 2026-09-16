# 渲染视频 (一步渲染: NVENC 直接编码)
# 编码设置（codec / bitrate / sample-rate / 硬件加速）统一在 remotion.config.ts，
# 本脚本只传没有 Config setter 的 --offthreadvideo-video-threads。
# 不要在这里加 --x264-preset：Remotion 会把它无条件转成 ffmpeg -preset 交给 NVENC，
# 实测 slow 比默认 p4 慢 17%（详见 AGENTS.md 实测数据一节）。
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
  --offthreadvideo-video-threads=8
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
