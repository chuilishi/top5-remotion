#!/bin/bash
# Runs inside WSL (Colab CLI is Linux-only). Usage: colab_run.sh <job_dir as /mnt/c/... path>
# job_dir must contain: jobs.json, voice/ref.wav, voice/ref.txt. Results land in <job_dir>/out/.
# Everything goes to stderr: tts_gen.py's stdout is parsed by fill-timeline.mjs.
set -u -o pipefail
exec 1>&2
. ~/.bashrc
C=~/.local/bin/colab
JOB=$1
HERE=$(cd "$(dirname "$0")" && pwd)
S="vox-$(date +%s)"

# Always release the GPU, whatever happens below.
trap '$C stop -s "$S" 2>&1 | tail -1' EXIT

cp "$HERE/gen.py" "$JOB/gen.py"
tar cf /tmp/$S-in.tar -C "$JOB" jobs.json voice gen.py

$C new -s "$S" --gpu L4 2>&1 | tail -1 || exit 1
echo "import os; os.makedirs('/content/vox', exist_ok=True)" > /tmp/$S-mk.py
$C exec -s "$S" -f /tmp/$S-mk.py >/dev/null || exit 1
$C upload -s "$S" /tmp/$S-in.tar /content/vox/in.tar 2>&1 | tail -1
out=$($C exec -s "$S" -f "$HERE/remote_launch.py" --timeout 3600 2>&1)
echo "$out" | grep -v -E "it/s\]|^\s*$" | tail -40
echo "$out" | grep -q "VOXCPM_EXIT 0" || { echo "voxcpm: remote generation failed"; exit 1; }
$C download -s "$S" /content/vox/out.tar /tmp/$S-out.tar 2>&1 | tail -1
mkdir -p "$JOB/out" && tar xf /tmp/$S-out.tar -C "$JOB" && rm -f /tmp/$S-*
