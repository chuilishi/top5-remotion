# Top5 渲染 (封面 + 一步 NVENC 直接编码)
# 用法: .\render-top5.ps1
# 不传 --x264-preset: NVENC 下反而更慢，详见 render.ps1 顶部注释

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

# --- 封面渲染 (字号 317) ---
$propsFile = Join-Path $projectRoot "src/templates/top5/index.ts"
$coverFile = "out/${projectName}_${timestamp}_cover.png"

Write-Host "`n== 渲染封面 (字号 317) ==" -ForegroundColor Cyan
(Get-Content $propsFile -Raw) -replace '开场标题: \{ 字号: 250,', '开场标题: { 字号: 317,' | Set-Content $propsFile -NoNewline
npx remotion still $compositionId $coverFile --frame=30
(Get-Content $propsFile -Raw) -replace '开场标题: \{ 字号: 317,', '开场标题: { 字号: 250,' | Set-Content $propsFile -NoNewline

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n== 封面渲染失败 ==" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  封面: $coverFile" -ForegroundColor DarkCyan

Write-Host "`n== 渲染: Remotion → NVENC H.264 ==" -ForegroundColor Cyan
Write-Host "输出: $outFile`n"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
npx remotion render $compositionId $outFile `
  --codec=h264 `
  --video-bitrate=8M `
  --hardware-acceleration=required `
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
Write-Host "封面: $coverFile"
Write-Host "大小: ${sizeMB} MB"
Write-Host "耗时: ${m}分${s}秒"

Pop-Location
