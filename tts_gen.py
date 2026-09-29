"""TTS for the Top5 pipeline.

    uv run tts_gen.py --batch <file.json> [--engine voxcpm|fish]
    uv run tts_gen.py "<text>" <out.mp3> [speed] [atempo] [--engine voxcpm|fish]

stdout contract (parsed by scripts/fill-timeline.mjs): one line per job,
    [i/n] <out> — OK: <bytes> bytes, <seconds>s
Everything else (progress, Colab logs) goes to stderr.

Engines:
  voxcpm (default) — VoxCPM2 "ultimate cloning" of tools/voices/sodabobo/ref.wav, generated on a
                     Colab L4 that is created and stopped per run (tools/voxcpm/colab_run.sh, via WSL).
                     Results are cached per text in .tts_cache/voxcpm/, so re-running a batch after
                     editing a few lines only generates those lines (no Colab at all if nothing changed).
                     Default atempo 1.0: VoxCPM2 already speaks at Sodabobo's pace (~6.4 chars/s).
  fish             — Fish Audio API (needs FISH_AUDIO_API_KEY), default speed 1.3 + atempo 1.1.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

# Windows pipes default to the ANSI code page (GBK here), which turns the "—" in the output contract
# into bytes fill-timeline.mjs (reading UTF-8) can't match.
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent
for env_path in [ROOT / '.env', Path('.env')]:
    if env_path.exists():
        for line in env_path.read_text().strip().splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())
        break

VOICE_DIR = ROOT / 'tools' / 'voices' / 'sodabobo'
CACHE_DIR = ROOT / '.tts_cache' / 'voxcpm'
DEFAULTS = {'voxcpm': {'speed': 1.0, 'atempo': 1.0}, 'fish': {'speed': 1.3, 'atempo': 1.1}}


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def duration_of(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def encode(src, out, atempo):
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    af = ['-af', f'atempo={atempo}'] if atempo != 1.0 else []
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', str(src), *af, out], check=True)
    return f'OK: {os.path.getsize(out)} bytes, {duration_of(out):.1f}s'


# ---------------------------------------------------------------- fish
def fish_one(text, out, speed, atempo, client):
    import ormsgpack
    req = {'text': text, 'reference_id': 'd4c4b2437dd341cc998b71d248379070', 'format': 'mp3',
           'prosody': {'speed': speed}}
    r = client.post('https://api.fish.audio/v1/tts', content=ormsgpack.packb(req), timeout=60, headers={
        'authorization': f'Bearer {os.environ["FISH_AUDIO_API_KEY"]}',
        'content-type': 'application/msgpack', 'model': 's2-pro'})
    if r.status_code != 200:
        return f'Error: {r.status_code} {r.text}'
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    raw = out + '.raw.mp3'
    open(raw, 'wb').write(r.content)
    try:
        return encode(raw, out, atempo)
    finally:
        os.remove(raw)


def run_fish(jobs):
    import httpx
    with httpx.Client() as c:
        for i, job in enumerate(jobs, 1):
            result = fish_one(job['text'], job['out'], job['speed'], job['atempo'], c)
            print(f'[{i}/{len(jobs)}] {job["out"]} — {result}', flush=True)
            if result.startswith('Error'):
                sys.exit(1)


# ---------------------------------------------------------------- voxcpm
def to_wsl(path):
    p = Path(path).resolve()
    return f'/mnt/{p.drive[0].lower()}{p.as_posix()[2:]}'


def cache_key(text):
    ref = hashlib.sha1((VOICE_DIR / 'ref.wav').read_bytes() + (VOICE_DIR / 'ref.txt').read_bytes()).hexdigest()
    return hashlib.sha1(f'voxcpm2|ultimate|{ref}|{text}'.encode('utf-8')).hexdigest()[:20]


def run_voxcpm(jobs):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for job in jobs:
        job['key'] = cache_key(job['text'])
    todo = {j['key']: j['text'] for j in jobs if not (CACHE_DIR / f'{j["key"]}.wav').exists()}
    log(f'voxcpm: {len(jobs)} jobs, {len(jobs) - len(todo)} cached, {len(todo)} to generate')

    if todo:
        job_dir = Path(tempfile.mkdtemp(prefix='voxcpm_'))
        try:
            shutil.copytree(VOICE_DIR, job_dir / 'voice')
            (job_dir / 'jobs.json').write_text(
                json.dumps([{'key': k, 'text': t} for k, t in todo.items()], ensure_ascii=False), encoding='utf-8')
            log('voxcpm: generating on Colab L4 (session is stopped afterwards) ...')
            r = subprocess.run(['wsl.exe', '-d', 'Ubuntu', '--', 'bash',
                                to_wsl(ROOT / 'tools' / 'voxcpm' / 'colab_run.sh'), to_wsl(job_dir)],
                               stdout=sys.stderr, stderr=sys.stderr)
            for k in todo:
                src = job_dir / 'out' / f'{k}.wav'
                if src.exists():
                    shutil.move(str(src), CACHE_DIR / f'{k}.wav')
            missing = [t for k, t in todo.items() if not (CACHE_DIR / f'{k}.wav').exists()]
            if r.returncode or missing:
                log(f'voxcpm: FAILED (exit {r.returncode}), {len(missing)} lines not generated')
                sys.exit(1)
        finally:
            shutil.rmtree(job_dir, ignore_errors=True)

    for i, job in enumerate(jobs, 1):
        result = encode(CACHE_DIR / f'{job["key"]}.wav', job['out'], job['atempo'])
        print(f'[{i}/{len(jobs)}] {job["out"]} — {result}', flush=True)


# ---------------------------------------------------------------- cli
def main(argv):
    engine = 'voxcpm'
    if '--engine' in argv:
        i = argv.index('--engine')
        engine = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if engine not in DEFAULTS:
        sys.exit(f'unknown engine: {engine}')
    d = DEFAULTS[engine]

    if argv and argv[0] == '--batch':
        raw_jobs = json.load(open(argv[1], encoding='utf-8'))
    else:
        raw_jobs = [{'text': argv[0], 'out': argv[1],
                     **({'speed': float(argv[2])} if len(argv) > 2 else {}),
                     **({'atempo': float(argv[3])} if len(argv) > 3 else {})}]
    jobs = [{'text': j['text'], 'out': j['out'], 'speed': j.get('speed', d['speed']),
             'atempo': j.get('atempo', d['atempo'])} for j in raw_jobs]
    (run_voxcpm if engine == 'voxcpm' else run_fish)(jobs)


if __name__ == '__main__':
    main(sys.argv[1:])
