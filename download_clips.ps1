$clips = @(
    # #5 DuckDuckGo
    @{folder="duckduckgo"; num="001"; url="https://www.youtube.com/watch?v=iq7B-qJ_C9g"; start=0.0; end=2.0},
    @{folder="duckduckgo"; num="002"; url="https://www.youtube.com/watch?v=iq7B-qJ_C9g"; start=11.0; end=13.5},
    @{folder="duckduckgo"; num="003"; url="https://www.youtube.com/watch?v=iq7B-qJ_C9g"; start=22.5; end=25.0},
    @{folder="duckduckgo"; num="004"; url="https://www.youtube.com/watch?v=f8q2U_Q22Oc"; start=35.5; end=37.8},
    @{folder="duckduckgo"; num="005"; url="https://www.youtube.com/watch?v=f8q2U_Q22Oc"; start=56.5; end=58.8},
    @{folder="duckduckgo"; num="006"; url="https://www.youtube.com/watch?v=f8q2U_Q22Oc"; start=95.5; end=98.0},
    @{folder="duckduckgo"; num="007"; url="https://www.youtube.com/watch?v=tASblawbsuk"; start=30.5; end=33.0},
    @{folder="duckduckgo"; num="008"; url="https://www.youtube.com/watch?v=tASblawbsuk"; start=269.5; end=272.0},
    @{folder="duckduckgo"; num="009"; url="https://www.youtube.com/watch?v=tASblawbsuk"; start=0.0; end=2.0},

    # #4 Yandex
    @{folder="yandex"; num="001"; url="https://www.youtube.com/watch?v=75tX9K3RClo"; start=11.3; end=13.7},
    @{folder="yandex"; num="002"; url="https://www.youtube.com/watch?v=75tX9K3RClo"; start=15.0; end=17.3},
    @{folder="yandex"; num="003"; url="https://www.youtube.com/watch?v=75tX9K3RClo"; start=22.8; end=25.1},
    @{folder="yandex"; num="004"; url="https://www.youtube.com/watch?v=75tX9K3RClo"; start=42.3; end=44.7},
    @{folder="yandex"; num="005"; url="https://www.youtube.com/watch?v=eF_3MbXP5-4"; start=27.0; end=29.3},
    @{folder="yandex"; num="006"; url="https://www.youtube.com/watch?v=eF_3MbXP5-4"; start=48.3; end=50.5},
    @{folder="yandex"; num="007"; url="https://www.youtube.com/watch?v=eF_3MbXP5-4"; start=65.3; end=67.5},
    @{folder="yandex"; num="008"; url="https://www.youtube.com/watch?v=eF_3MbXP5-4"; start=209.5; end=212.0},
    @{folder="yandex"; num="009"; url="https://www.youtube.com/watch?v=eF_3MbXP5-4"; start=229.0; end=231.5},

    # #3 Yahoo
    @{folder="yahoo"; num="001"; url="https://www.youtube.com/watch?v=W4cgMkoaLAk"; start=0.0; end=1.7},
    @{folder="yahoo"; num="002"; url="https://www.youtube.com/watch?v=W4cgMkoaLAk"; start=2.7; end=4.9},
    @{folder="yahoo"; num="003"; url="https://www.youtube.com/watch?v=W4cgMkoaLAk"; start=13.5; end=15.7},
    @{folder="yahoo"; num="004"; url="https://www.youtube.com/watch?v=W4cgMkoaLAk"; start=48.3; end=50.5},
    @{folder="yahoo"; num="005"; url="https://www.youtube.com/watch?v=BKdknDt00II"; start=14.5; end=16.7},
    @{folder="yahoo"; num="006"; url="https://www.youtube.com/watch?v=BKdknDt00II"; start=23.0; end=25.2},
    @{folder="yahoo"; num="007"; url="https://www.youtube.com/watch?v=BKdknDt00II"; start=118.0; end=120.2},
    @{folder="yahoo"; num="008"; url="https://www.youtube.com/watch?v=BKdknDt00II"; start=171.0; end=173.2},
    @{folder="yahoo"; num="009"; url="https://www.youtube.com/watch?v=54igwcEO5VM"; start=9.5; end=11.7},
    @{folder="yahoo"; num="010"; url="https://www.youtube.com/watch?v=54igwcEO5VM"; start=133.5; end=136.0},

    # #2 Bing
    @{folder="bing"; num="001"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=12.2; end=14.5},
    @{folder="bing"; num="002"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=16.0; end=18.3},
    @{folder="bing"; num="003"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=23.5; end=25.7},
    @{folder="bing"; num="004"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=29.8; end=32.1},
    @{folder="bing"; num="005"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=40.2; end=42.5},
    @{folder="bing"; num="006"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=47.5; end=49.8},
    @{folder="bing"; num="007"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=64.2; end=66.5},
    @{folder="bing"; num="008"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=76.5; end=79.0},
    @{folder="bing"; num="009"; url="https://www.youtube.com/watch?v=Ay3ttUozxTA"; start=93.2; end=95.5},

    # #1 Google
    @{folder="google"; num="001"; url="https://www.youtube.com/watch?v=ZLtJOpqgIgQ"; start=20.5; end=22.7},
    @{folder="google"; num="002"; url="https://www.youtube.com/watch?v=ZLtJOpqgIgQ"; start=143.5; end=145.7},
    @{folder="google"; num="003"; url="https://www.youtube.com/watch?v=ZLtJOpqgIgQ"; start=264.5; end=266.7},
    @{folder="google"; num="004"; url="https://www.youtube.com/watch?v=KIViy7L_lo8"; start=2.5; end=4.7},
    @{folder="google"; num="005"; url="https://www.youtube.com/watch?v=KIViy7L_lo8"; start=42.5; end=44.7},
    @{folder="google"; num="006"; url="https://www.youtube.com/watch?v=KIViy7L_lo8"; start=59.5; end=61.7},
    @{folder="google"; num="007"; url="https://www.youtube.com/watch?v=KIViy7L_lo8"; start=65.5; end=67.7},
    @{folder="google"; num="008"; url="https://www.youtube.com/watch?v=KIViy7L_lo8"; start=80.5; end=82.7},
    @{folder="google"; num="009"; url="https://www.youtube.com/watch?v=5NE7Ty6vtqU"; start=17.5; end=19.7},
    @{folder="google"; num="010"; url="https://www.youtube.com/watch?v=5NE7Ty6vtqU"; start=43.0; end=45.2},
    @{folder="google"; num="011"; url="https://www.youtube.com/watch?v=5NE7Ty6vtqU"; start=46.0; end=48.2},
    @{folder="google"; num="012"; url="https://www.youtube.com/watch?v=5NE7Ty6vtqU"; start=62.5; end=65.0}
)

$total = $clips.Count
$i = 0
foreach ($c in $clips) {
    $i++
    $out = "public/$($c.folder)/clip_$($c.num).mp4"
    $section = "*$($c.start)-$($c.end)"
    Write-Host "[$i/$total] Downloading $out ..." -ForegroundColor Cyan
    yt-dlp -f "bestvideo[height<=1080]/best[height<=1080]" --download-sections $section --force-keyframes-at-cuts --merge-output-format mp4 --no-download-archive -o $out $c.url 2>&1 | Select-String -Pattern "download|error|Destination" | ForEach-Object { Write-Host "  $_" }
}
Write-Host "All $total clips downloaded!" -ForegroundColor Green
