# 渲染视频 (两步渲染: ProRes + NVENC)
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
$tempProRes = "out/${projectName}_${timestamp}_temp.mov"

Write-Host "`n== 生成配置 ==" -ForegroundColor Cyan
npm run config

$activeFile = Join-Path $projectRoot "src/templates/active.ts"
$compositionId = (Select-String -Path $activeFile -Pattern 'activeTemplateId = "(.+?)"').Matches[0].Groups[1].Value
Write-Host "Composition: $compositionId" -ForegroundColor DarkCyan

Write-Host "`n== 第一步: Remotion → ProRes ==" -ForegroundColor Cyan
Write-Host "中间文件: $tempProRes`n"

$swTotal = [System.Diagnostics.Stopwatch]::StartNew()
$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
npx remotion render $compositionId $tempProRes --codec=prores --prores-profile=standard
$sw1.Stop()

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n== 第一步失败 ==" -ForegroundColor Red
    Pop-Location
    exit 1
}

$proResFile = Get-Item "$projectRoot\$tempProRes"
$proResSizeMB = [math]::Round($proResFile.Length / 1MB, 1)
$m1 = [math]::Floor($sw1.Elapsed.TotalMinutes)
$s1 = $sw1.Elapsed.Seconds
Write-Host "`n  ProRes 完成: ${proResSizeMB} MB | 耗时: ${m1}分${s1}秒" -ForegroundColor DarkCyan

Write-Host "`n== 第二步: NVENC 重编码 ==" -ForegroundColor Cyan
Write-Host "输出: $outFile | 编码: h264_nvenc`n"

$sw2 = [System.Diagnostics.Stopwatch]::StartNew()
ffmpeg -y -i "$projectRoot\$tempProRes" -c:v h264_nvenc -preset p7 -b:v 8M -pix_fmt yuv420p -c:a aac -b:a 320k "$projectRoot\$outFile"
$sw2.Stop()

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n== 第二步失败 ==" -ForegroundColor Red
    Pop-Location
    exit 1
}

$swTotal.Stop()

Remove-Item "$projectRoot\$tempProRes" -Force
$file = Get-Item "$projectRoot\$outFile"
$sizeMB = [math]::Round($file.Length / 1MB, 1)
$m2 = [math]::Floor($sw2.Elapsed.TotalMinutes)
$s2 = $sw2.Elapsed.Seconds
$mT = [math]::Floor($swTotal.Elapsed.TotalMinutes)
$sT = $swTotal.Elapsed.Seconds

Write-Host "`n== 渲染完成 ==" -ForegroundColor Green
Write-Host "文件: $outFile"
Write-Host "大小: ${sizeMB} MB"
Write-Host "第一步 (ProRes): ${m1}分${s1}秒"
Write-Host "第二步 (NVENC):  ${m2}分${s2}秒"
Write-Host "总耗时: ${mT}分${sT}秒"

Pop-Location
