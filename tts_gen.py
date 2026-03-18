import httpx, ormsgpack, sys, os, subprocess, shutil
from pathlib import Path

for env_path in [Path(__file__).parent / '.env', Path('.env')]:
    if env_path.exists():
        for line in env_path.read_text().strip().splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
        break

text = sys.argv[1]
out = sys.argv[2]
speed = float(sys.argv[3]) if len(sys.argv) > 3 else 1.3
atempo = float(sys.argv[4]) if len(sys.argv) > 4 else 1.1

os.makedirs(os.path.dirname(out) or '.', exist_ok=True)

req = {
    'text': text,
    'reference_id': 'd4c4b2437dd341cc998b71d248379070',
    'format': 'mp3',
    'prosody': {'speed': speed},
}

with httpx.Client() as c:
    r = c.post('https://api.fish.audio/v1/tts',
        content=ormsgpack.packb(req),
        headers={
            'authorization': f'Bearer {os.environ["FISH_AUDIO_API_KEY"]}',
            'content-type': 'application/msgpack',
            'model': 's2-pro',
        },
        timeout=60)
    if r.status_code != 200:
        print(f'Error: {r.status_code} {r.text}', file=sys.stderr)
        sys.exit(1)

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
print(f'OK: {os.path.getsize(out)} bytes, {float(dur.stdout.strip()):.1f}s')
