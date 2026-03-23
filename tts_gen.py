import httpx, ormsgpack, json, sys, os, subprocess, shutil
from pathlib import Path

for env_path in [Path(__file__).parent / '.env', Path('.env')]:
    if env_path.exists():
        for line in env_path.read_text().strip().splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
        break

def generate_one(text, out, speed=1.3, atempo=1.1, client=None):
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    req = {
        'text': text,
        'reference_id': 'd4c4b2437dd341cc998b71d248379070',
        'format': 'mp3',
        'prosody': {'speed': speed},
    }
    r = client.post('https://api.fish.audio/v1/tts',
        content=ormsgpack.packb(req),
        headers={
            'authorization': f'Bearer {os.environ["FISH_AUDIO_API_KEY"]}',
            'content-type': 'application/msgpack',
            'model': 's2-pro',
        },
        timeout=60)
    if r.status_code != 200:
        return f'Error: {r.status_code} {r.text}'
    raw = out + '.raw.mp3'
    open(raw, 'wb').write(r.content)
    if atempo != 1.0 and shutil.which('ffmpeg'):
        subprocess.run(['ffmpeg', '-y', '-i', raw, '-af', f'atempo={atempo}', out],
                       capture_output=True, check=True)
        os.remove(raw)
    else:
        shutil.move(raw, out)
    dur = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', out], capture_output=True, text=True)
    duration = float(dur.stdout.strip())
    return f'OK: {os.path.getsize(out)} bytes, {duration:.1f}s'

if len(sys.argv) >= 2 and sys.argv[1] == '--batch':
    batch_file = sys.argv[2]
    with open(batch_file, 'r', encoding='utf-8') as f:
        jobs = json.load(f)
    with httpx.Client() as c:
        for i, job in enumerate(jobs):
            text = job['text']
            out = job['out']
            speed = job.get('speed', 1.3)
            atempo = job.get('atempo', 1.1)
            result = generate_one(text, out, speed, atempo, client=c)
            print(f'[{i+1}/{len(jobs)}] {out} — {result}')
            if result.startswith('Error'):
                sys.exit(1)
else:
    text = sys.argv[1]
    out = sys.argv[2]
    speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.3
    atempo = float(sys.argv[4]) if len(sys.argv) > 4 else 1.1
    with httpx.Client() as c:
        result = generate_one(text, out, speed, atempo, client=c)
        print(result)
        if result.startswith('Error'):
            sys.exit(1)
