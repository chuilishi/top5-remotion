# Runs on the Colab VM inside the VoxCPM2 venv. Reads jobs.json [{key, text}] + voice/ref.{wav,txt}
# from the current directory and writes out/<key>.wav ("ultimate cloning": reference audio + its transcript).
import json, os, time
import soundfile as sf
from voxcpm import VoxCPM

jobs = json.load(open("jobs.json", encoding="utf-8"))
ref_text = open("voice/ref.txt", encoding="utf-8").read().strip()
os.makedirs("out", exist_ok=True)

t = time.time()
# optimize=False skips torch.compile: load 121 s -> 21 s on L4, per-line generation ~0.8 s slower.
# A full 32-line episode still comes out ~1 min faster, and short reruns ~2x faster.
model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False)
sr = model.tts_model.sample_rate
print(f"model load {time.time() - t:.1f}s", flush=True)
for i, job in enumerate(jobs, 1):
    t = time.time()
    wav = model.generate(text=job["text"], prompt_wav_path="voice/ref.wav", prompt_text=ref_text,
                         reference_wav_path="voice/ref.wav", cfg_value=2.0, inference_timesteps=10)
    sf.write(f"out/{job['key']}.wav", wav, sr)
    print(f"[{i}/{len(jobs)}] {time.time() - t:.1f}s {job['text'][:30]}", flush=True)
