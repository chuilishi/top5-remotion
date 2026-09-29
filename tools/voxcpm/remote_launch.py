# Executed in the Colab kernel via `colab exec`. Sets up a clean VoxCPM2 venv and runs gen.py.
#
# Measured on a cold L4 (2026-09-29): installing voxcpm takes ~26 s, but downloading the 4.7 GB of
# weights + loading + first generation took ~147 s. So the weights download starts first, in the
# background (system python + hf_xet high-performance mode), while the venv is being installed.
# The venv's VoxCPM.from_pretrained() then finds the files already in the shared HF cache.
#
# Colab presets UV_SYSTEM_PYTHON=true (and other UV_* vars), which would send `uv pip install`
# to system python instead of the venv, so every UV_* var is dropped first.
import os, subprocess

env = {k: v for k, v in os.environ.items() if not k.startswith("UV_")}
env.update(HF_XET_HIGH_PERFORMANCE="1", UV_HTTP_TIMEOUT="120", UV_HTTP_RETRIES="5")

script = r"""
set -e
t0=$(date +%s); ts(){ echo "[t+$(( $(date +%s) - t0 ))s] $*"; }
cd /content/vox && tar xf in.tar

# 1. weights download in the background
( pip install -q -U "huggingface_hub[hf_xet]" \
  && python3 -c "from huggingface_hub import snapshot_download; snapshot_download('openbmb/VoxCPM2')" \
  && echo ok > /content/vox/.weights_done || echo fail > /content/vox/.weights_done ) > /content/vox/weights.log 2>&1 &
ts "weights download started"

# 2. venv install, retried: PyPI occasionally times out from Colab (seen 2026-09-28)
pip install -q uv
[ -x /content/v_vox/bin/python ] || uv venv -q -p 3.11 /content/v_vox
for i in 1 2 3; do
  uv pip install -q --python /content/v_vox/bin/python voxcpm soundfile && break
  ts "venv install attempt $i failed, retrying"; sleep 10
  [ "$i" = 3 ] && exit 1
done
ts "venv ready"

# 3. wait for the weights (from_pretrained would otherwise start a second download)
while [ ! -f /content/vox/.weights_done ]; do sleep 1; done
ts "weights: $(cat /content/vox/.weights_done)"; tail -3 /content/vox/weights.log

/content/v_vox/bin/python gen.py
ts "generation done"
tar cf /content/vox/out.tar out
"""
r = subprocess.run(["bash", "-c", script], env=env, capture_output=True, text=True)
print(r.stdout[-4000:])
print(r.stderr[-4000:] if r.returncode else "")
print("VOXCPM_EXIT", r.returncode)
