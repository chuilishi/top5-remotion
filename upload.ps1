<#
.SYNOPSIS
  交互式 B站投稿脚本 — 基于 biliup CLI
.DESCRIPTION
  读取 project.yaml 自动填充标题/标签，支持定时发布，分区默认237(运动文化)
#>
param(
  [string]$CookieFile = "cookies.json"
)

$ErrorActionPreference = "Stop"

# ── 颜色输出 ──
function Write-Cyan  ($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Green ($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Yellow($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Red   ($msg) { Write-Host $msg -ForegroundColor Red }

# ── 可编辑输入 ──
function Read-Editable {
  param([string]$Prompt, [string]$Default)
  Write-Host "${Prompt}: " -NoNewline
  Write-Host $Default -ForegroundColor Yellow
  $result = Read-Host "  回车确认 / 输入新值替换"
  if (-not $result) { return $Default }
  return $result
}

# ── 检查依赖 ──
if (-not (Get-Command biliup -ErrorAction SilentlyContinue)) {
  Write-Red "biliup 未安装。请运行: uv tool install biliup"
  exit 1
}

# ── 检查登录状态 ──
Write-Cyan "`n=== B站投稿助手 ==="
if (-not (Test-Path $CookieFile)) {
  Write-Yellow "未找到登录凭证 ($CookieFile)，需要先登录。"
  biliup -u $CookieFile login
  if (-not (Test-Path $CookieFile)) {
    Write-Red "登录失败，退出。"
    exit 1
  }
}
Write-Green "登录凭证已就绪: $CookieFile"

# ── 选择视频文件 ──
Write-Cyan "`n[1/5] 选择视频文件"
$outDir = Join-Path $PSScriptRoot "out"
if (Test-Path $outDir) {
  $videos = Get-ChildItem $outDir -Filter "*.mp4" | Sort-Object LastWriteTime -Descending
  if ($videos.Count -gt 0) {
    Write-Host "out/ 目录下的视频:"
    for ($i = 0; $i -lt $videos.Count; $i++) {
      $size = [math]::Round($videos[$i].Length / 1MB, 1)
      $time = $videos[$i].LastWriteTime.ToString("MM-dd HH:mm")
      Write-Host "  [$($i+1)] $($videos[$i].Name)  (${size}MB, $time)"
    }
    Write-Host "  [0] 手动输入路径"
    $choice = Read-Host "选择"
    if ($choice -eq "0") {
      $videoPath = Read-Host "输入视频文件路径"
    } else {
      $idx = [int]$choice - 1
      if ($idx -ge 0 -and $idx -lt $videos.Count) {
        $videoPath = $videos[$idx].FullName
      } else {
        Write-Red "无效选择"; exit 1
      }
    }
  } else {
    $videoPath = Read-Host "out/ 目录为空，请输入视频路径"
  }
} else {
  $videoPath = Read-Host "请输入视频文件路径"
}

if (-not (Test-Path $videoPath)) {
  Write-Red "文件不存在: $videoPath"; exit 1
}
Write-Green "视频: $videoPath"

# ── 选择项目 (自动填充标题) ──
Write-Cyan "`n[2/5] 选择项目 (自动填充标题)"
$projDir = Join-Path $PSScriptRoot "projects"
$projects = Get-ChildItem $projDir -Directory | Sort-Object Name
for ($i = 0; $i -lt $projects.Count; $i++) {
  Write-Host "  [$($i+1)] $($projects[$i].Name)"
}
Write-Host "  [0] 不关联项目，手动输入标题"
$projChoice = Read-Host "选择"

$titleSuggestion = ""
$tagSuggestion = ""
if ($projChoice -ne "0") {
  $idx = [int]$projChoice - 1
  if ($idx -ge 0 -and $idx -lt $projects.Count) {
    $projYaml = Join-Path $projects[$idx].FullName "project.yaml"
    if (Test-Path $projYaml) {
      $yaml = Get-Content $projYaml -Raw
      if ($yaml -match 'titleLine1:\s*"?([^"\r\n]+)"?') { $t1 = $Matches[1].Trim() }
      if ($yaml -match 'titleLine2:\s*"?([^"\r\n]+)"?') { $t2 = $Matches[1].Trim() }
      $titleSuggestion = "${t1}${t2}"
      $tagSuggestion = "$t1,$t2,TOP5,排行榜,盘点"
    }
  }
}

# ── 期数 ──
Write-Cyan "`n[3/5] 设置标题"
$counterFile = Join-Path $PSScriptRoot ".episode"
$lastEp = 0
if (Test-Path $counterFile) { $lastEp = [int](Get-Content $counterFile -Raw).Trim() }
$nextEp = $lastEp + 1
$epInput = Read-Host "期数 (上次=${lastEp}，默认=${nextEp})"
$episodeNum = if ($epInput) { [int]$epInput } else { $nextEp }
$baseSuffix = if ($titleSuggestion) { $titleSuggestion } else { "全球前五XXX" }
$defaultTitle = "第${episodeNum}期 | $baseSuffix"
$title = Read-Editable "标题" $defaultTitle
Write-Green "标题: $title"

# ── 标签 ──
$tags = ""

# ── 分区 ──
Write-Cyan "`n[4/5] 选择分区"
$partitions = @(
  @{ tid = 237; name = "运动文化 (推荐，低竞争)" }
  @{ tid = 238; name = "运动综合" }
  @{ tid = 17;  name = "单机游戏" }
  @{ tid = 95;  name = "数码" }
  @{ tid = 183; name = "影视剪辑" }
  @{ tid = 201; name = "科学科普" }
  @{ tid = 86;  name = "特摄" }
  @{ tid = 65;  name = "网络游戏" }
)
for ($i = 0; $i -lt $partitions.Count; $i++) {
  $p = $partitions[$i]
  $prefix = if ($i -eq 0) { " *" } else { "  " }
  Write-Host "$prefix[$($i+1)] tid=$($p.tid) $($p.name)"
}
Write-Host "  [0] 手动输入tid"
$partChoice = Read-Host "选择 (默认1=运动文化)"
if (-not $partChoice -or $partChoice -eq "1") {
  $tid = 237
} elseif ($partChoice -eq "0") {
  $tid = [int](Read-Host "输入tid")
} else {
  $idx = [int]$partChoice - 1
  $tid = $partitions[$idx].tid
}
$partName = ($partitions | Where-Object { $_.tid -eq $tid }).name
if (-not $partName) { $partName = "自定义" }
Write-Green "分区: tid=$tid ($partName)"

# ── 定时发布 ──
Write-Cyan "`n[5/5] 发布时间"
Write-Host "  [1] 立即发布"
Write-Host "  [2] 今天 18:00"
Write-Host "  [3] 今天 20:00"
Write-Host "  [4] 明天 18:00"
Write-Host "  [5] 自定义时间"
$timeChoice = Read-Host "选择 (默认1=立即)"

$dtimeArg = @()
switch ($timeChoice) {
  "2" {
    $target = (Get-Date).Date.AddHours(18)
    if ($target -lt (Get-Date).AddHours(4)) {
      Write-Yellow "  距提交不足4小时，自动改为明天18:00"
      $target = $target.AddDays(1)
    }
    $dtime = [int][DateTimeOffset]::new($target).ToUnixTimeSeconds()
    $dtimeArg = @("--dtime", $dtime)
    Write-Green "定时发布: $($target.ToString('yyyy-MM-dd HH:mm'))"
  }
  "3" {
    $target = (Get-Date).Date.AddHours(20)
    if ($target -lt (Get-Date).AddHours(4)) {
      Write-Yellow "  距提交不足4小时，自动改为明天20:00"
      $target = $target.AddDays(1)
    }
    $dtime = [int][DateTimeOffset]::new($target).ToUnixTimeSeconds()
    $dtimeArg = @("--dtime", $dtime)
    Write-Green "定时发布: $($target.ToString('yyyy-MM-dd HH:mm'))"
  }
  "4" {
    $target = (Get-Date).Date.AddDays(1).AddHours(18)
    $dtime = [int][DateTimeOffset]::new($target).ToUnixTimeSeconds()
    $dtimeArg = @("--dtime", $dtime)
    Write-Green "定时发布: $($target.ToString('yyyy-MM-dd HH:mm'))"
  }
  "5" {
    $custom = Read-Host "输入时间 (格式: 2026-03-25 18:00)"
    $target = [DateTime]::ParseExact($custom, "yyyy-MM-dd HH:mm", $null)
    if ($target -lt (Get-Date).AddHours(4)) {
      Write-Red "  定时发布需距提交至少4小时！"; exit 1
    }
    $dtime = [int][DateTimeOffset]::new($target).ToUnixTimeSeconds()
    $dtimeArg = @("--dtime", $dtime)
    Write-Green "定时发布: $($target.ToString('yyyy-MM-dd HH:mm'))"
  }
  default {
    Write-Green "立即发布"
  }
}

# ── 确认 ──
Write-Cyan "`n========== 投稿确认 =========="
Write-Host "视频: $videoPath"
Write-Host "标题: $title"
Write-Host "标签: $tags"
Write-Host "分区: tid=$tid ($partName)"
if ($dtimeArg.Count -gt 0) {
  Write-Host "发布: 定时 $($target.ToString('yyyy-MM-dd HH:mm'))"
} else {
  Write-Host "发布: 立即"
}
Write-Host "版权: 自制 (copyright=1)"
Write-Cyan "================================"

$confirm = Read-Host "`n确认投稿? (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
  Write-Yellow "已取消。"
  exit 0
}

# ── 执行上传 ──
Write-Cyan "`n正在上传..."
$uploadArgs = @(
  "-u", $CookieFile
  "upload"
  $videoPath
  "--title", $title
  "--tid", $tid
  "--copyright", "1"
  "--desc", "-"
  "--no-reprint", "0"
)
$uploadArgs += $dtimeArg
if ($tags) { $uploadArgs += @("--tag", $tags) }

Write-Host "biliup $($uploadArgs -join ' ')" -ForegroundColor DarkGray
& biliup @uploadArgs

if ($LASTEXITCODE -eq 0) {
  $episodeNum | Out-File $counterFile -NoNewline
  Write-Green "`n投稿成功！期数已保存: 第${episodeNum}期"
} else {
  Write-Red "`n投稿失败，请检查错误信息。(期数未更新)"
}
