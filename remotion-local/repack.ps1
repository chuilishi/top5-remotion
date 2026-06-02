$root = "e:\Desktop\top5-remotion\remotion-src"
$out = "e:\Desktop\top5-remotion\remotion-local"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$catalog = @{
  "react" = "19.2.3"
  "react-dom" = "19.2.3"
  "eslint" = "9.19.0"
  "prettier" = "3.8.1"
  "zod" = "4.3.6"
  "@types/react" = "19.2.7"
  "@types/react-dom" = "19.2.3"
  "@types/node" = "20.12.14"
  "@types/web" = "0.0.166"
  "@types/bun" = "1.3.3"
  "@types/dom-webcodecs" = "0.1.11"
  "@types/three" = "0.170.0"
  "@typescript/native-preview" = "7.0.0-dev.20260217.1"
  "next" = "16.1.7"
  "three" = "0.178.0"
  "sharp" = "0.34.5"
  "@react-three/fiber" = "9.2.0"
  "openai" = "4.67.1"
  "@vitejs/plugin-react" = "4.3.4"
  "@vitest/browser-playwright" = "4.0.9"
  "playwright" = "1.55.1"
  "vitest" = "4.0.9"
  "mediabunny" = "1.45.0"
  "@mediabunny/server" = "1.45.0"
  "@mediabunny/mp3-encoder" = "1.45.0"
  "@mediabunny/aac-encoder" = "1.45.0"
  "@mediabunny/flac-encoder" = "1.45.0"
  "@mediabunny/ac3" = "1.45.0"
  "@aws-sdk/s3-request-presigner" = "3.986.0"
  "@aws-sdk/credential-provider-ini" = "3.972.5"
  "@aws-sdk/client-s3" = "3.986.0"
  "@aws-sdk/client-lambda" = "3.986.0"
  "@aws-sdk/client-iam" = "3.986.0"
  "@aws-sdk/client-sts" = "3.986.0"
  "@aws-sdk/lib-storage" = "3.986.0"
  "@aws-sdk/client-cloudwatch-logs" = "3.986.0"
  "@aws-sdk/client-service-quotas" = "3.986.0"
  "@aws-sdk/middleware-flexible-checksums" = "3.972.5"
}

$packages = @(
  "core","cli","renderer","media","player","zod-types",
  "effects","transitions","paths","shapes","light-leaks","starburst","sfx",
  "streaming","licensing","bundler","media-parser","media-utils",
  "timeline-utils","web-renderer",
  "studio","studio-server","studio-shared","enable-scss",
  "compositor-win32-x64-msvc","eslint-config"
)

foreach ($p in $packages) {
  $dir = Join-Path $root "packages\$p"
  $pkgJson = Join-Path $dir "package.json"
  if (!(Test-Path $pkgJson)) { Write-Host "SKIP $p"; continue }

  $content = Get-Content $pkgJson -Raw
  $fixed = $content -replace '"workspace:\*"', '"4.0.470"'

  foreach ($key in $catalog.Keys) {
    $escaped = [regex]::Escape("`"$key`": `"catalog:`"")
    $replacement = "`"$key`": `"$($catalog[$key])`""
    $fixed = $fixed -replace $escaped, $replacement
  }

  [System.IO.File]::WriteAllText($pkgJson, $fixed, $utf8NoBom)

  Push-Location $dir
  $tgz = npm pack --pack-destination $out 2>$null
  Pop-Location

  [System.IO.File]::WriteAllText($pkgJson, $content, $utf8NoBom)

  $size = if (Test-Path (Join-Path $out $tgz)) { [math]::Round((Get-Item (Join-Path $out $tgz)).Length/1KB, 0) } else { "?" }
  Write-Host "  $p -> $tgz (${size}KB)"
}

Write-Host "`nTotal: $((Get-ChildItem $out -Filter '*.tgz').Count) tarballs"
