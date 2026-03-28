import { createFile } from 'mp4box';

export interface Item {
  id: number;
  frame: number;
  type: 'marker' | 'point' | 'rect';
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExportData {
  fileName: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  videoDuration: number;
  items: {
    frame: number;
    time: string;
    type: 'marker' | 'point' | 'rect';
    note: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
}

export async function detectFPS(file: File): Promise<number> {
  if (file.name.match(/\.(mp4|m4v|mov)$/i)) {
    const fps = await parseMp4Fps(file);
    if (fps) return fps;
  }
  const input = prompt('无法从容器解析帧率，请输入 FPS', '30');
  return parseFloat(input ?? '30') || 30;
}

function parseMp4Fps(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const mp4 = createFile();
    let resolved = false;

    mp4.onReady = (info: { videoTracks?: { nb_samples: number; movie_duration: number; movie_timescale: number }[] }) => {
      if (resolved) return;
      resolved = true;
      const vt = info.videoTracks?.[0];
      if (vt && vt.nb_samples > 0 && vt.movie_duration > 0) {
        const duration = vt.movie_duration / vt.movie_timescale;
        resolve(snapFps(vt.nb_samples / duration));
      } else {
        resolve(null);
      }
    };

    mp4.onError = () => {
      if (!resolved) { resolved = true; resolve(null); }
    };

    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result as ArrayBuffer & { fileStart: number };
      buf.fileStart = 0;
      mp4.appendBuffer(buf);
      mp4.flush();
      if (!resolved) {
        setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 3000);
      }
    };
    reader.onerror = () => { if (!resolved) { resolved = true; resolve(null); } };
    reader.readAsArrayBuffer(file);
  });
}

function snapFps(raw: number): number {
  const common = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
  const best = common.reduce((b, c) => Math.abs(c - raw) < Math.abs(b - raw) ? c : b);
  return Math.abs(best - raw) < 0.5 ? best : +raw.toFixed(3);
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(3).padStart(6, '0')}`;
}

export function captureThumbnail(canvas: HTMLCanvasElement, w = 160, h = 90): string {
  const tc = document.createElement('canvas');
  tc.width = w; tc.height = h;
  tc.getContext('2d')!.drawImage(canvas, 0, 0, w, h);
  return tc.toDataURL('image/jpeg', 0.7);
}

export const COLORS = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#f0883e','#56d4dd','#db61a2'] as const;
