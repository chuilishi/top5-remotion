import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent, type MouseEvent } from 'react';
import { detectFPS, fmtTime, COLORS, type Item, type ExportData } from './utils';

let nextId = 1;

interface StateSnapshot {
  fps: number;
  totalFrames: number;
  currentFrame: number;
  isPlaying: boolean;
  items: Item[];
  annoMode: boolean;
}

interface DragState {
  start: { x: number; y: number };
  isDragging: boolean;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoMeta, setVideoMeta] = useState('未加载视频');
  const [fileName, setFileName] = useState('');
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [fps, setFps] = useState(30);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [annoMode, setAnnoMode] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [tlStyle, setTlStyle] = useState<{ left: string; width: string }>({ left: '0', width: '100%' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editIsNew, setEditIsNew] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const stateRef = useRef<StateSnapshot>({ fps: 30, totalFrames: 0, currentFrame: 0, isPlaying: false, items: [], annoMode: false });
  useEffect(() => { Object.assign(stateRef.current, { fps, totalFrames, currentFrame, isPlaying, items, annoMode }); });

  const animIdRef = useRef<number | null>(null);
  const pendingImportRef = useRef<ExportData | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoLoaded) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const update = () => {
      const cr = canvas.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      setTlStyle({ left: `${cr.left - wr.left}px`, width: `${cr.width}px` });
    };
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    update();
    return () => ro.disconnect();
  }, [videoLoaded]);

  const seekToFrame = useCallback((frame: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const { fps, totalFrames } = stateRef.current;
    frame = Math.max(0, Math.min(totalFrames - 1, frame));
    video.currentTime = frame / fps;
    const handler = () => {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCurrentFrame(frame);
      if (!video.muted) {
        video.play();
        setTimeout(() => { if (!stateRef.current.isPlaying) video.pause(); }, Math.round(1000 / stateRef.current.fps));
      }
    };
    video.addEventListener('seeked', handler, { once: true });
  }, []);

  const drawAnnotations = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const { currentFrame, items } = stateRef.current;
    const frameAnnos = items.filter(it => it.frame === currentFrame && it.type !== 'marker');
    if (!frameAnnos.length) return;

    frameAnnos.forEach((a, i) => {
      const color = COLORS[i % COLORS.length];
      octx.strokeStyle = color;
      octx.fillStyle = color;
      octx.lineWidth = 2;

      if (a.type === 'rect') {
        octx.strokeRect(a.x, a.y, a.w, a.h);
        octx.globalAlpha = 0.1;
        octx.fillRect(a.x, a.y, a.w, a.h);
        octx.globalAlpha = 1;
        if (a.note) {
          octx.font = '14px sans-serif';
          const tw = octx.measureText(a.note).width;
          octx.fillStyle = color; octx.globalAlpha = 0.85;
          octx.fillRect(a.x, a.y - 18, tw + 8, 18);
          octx.globalAlpha = 1; octx.fillStyle = '#000';
          octx.fillText(a.note, a.x + 4, a.y - 4);
        }
      } else {
        octx.beginPath();
        octx.arc(a.x, a.y, 8, 0, Math.PI * 2);
        octx.globalAlpha = 0.8; octx.fill(); octx.globalAlpha = 1;
        octx.strokeStyle = '#fff'; octx.lineWidth = 1.5; octx.stroke();
        if (a.note) {
          octx.font = '14px sans-serif';
          const tw = octx.measureText(a.note).width;
          octx.fillStyle = color; octx.globalAlpha = 0.85;
          octx.fillRect(a.x + 12, a.y - 9, tw + 8, 18);
          octx.globalAlpha = 1; octx.fillStyle = '#000';
          octx.fillText(a.note, a.x + 16, a.y + 5);
        }
      }
    });
  }, []);

  useEffect(() => { drawAnnotations(); }, [currentFrame, items, drawAnnotations]);

  const loadVideo = useCallback(async (file: File) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!video || !canvas || !overlay) return;

    video.src = URL.createObjectURL(file);
    video.load();
    await new Promise<void>(r => video.addEventListener('loadedmetadata', () => r(), { once: true }));

    const detectedFps = await detectFPS(file);
    const frames = Math.floor(video.duration * detectedFps);
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    overlay.width = video.videoWidth; overlay.height = video.videoHeight;

    setFileName(file.name);
    setVideoWidth(video.videoWidth);
    setVideoHeight(video.videoHeight);
    setFps(detectedFps);
    setTotalFrames(frames);
    setCurrentFrame(0);
    setVideoLoaded(true);
    setVideoMeta(`${file.name} | ${video.videoWidth}×${video.videoHeight} | ${detectedFps}fps | ${frames}帧 | ${fmtTime(video.duration)}`);

    const pending = pendingImportRef.current;
    if (pending) {
      pendingImportRef.current = null;
      const warnings: string[] = [];
      if (pending.fileName && pending.fileName !== file.name)
        warnings.push(`文件名不匹配: 期望 ${pending.fileName}, 实际 ${file.name}`);
      if (pending.width && pending.width !== video.videoWidth)
        warnings.push(`宽度不匹配: 期望 ${pending.width}, 实际 ${video.videoWidth}`);
      if (pending.height && pending.height !== video.videoHeight)
        warnings.push(`高度不匹配: 期望 ${pending.height}, 实际 ${video.videoHeight}`);
      if (warnings.length && !confirm(`视频可能不匹配:\n${warnings.join('\n')}\n\n仍然导入?`)) return;
      if (pending.fps) { setFps(pending.fps); stateRef.current.fps = pending.fps; }
      if (pending.totalFrames) setTotalFrames(pending.totalFrames);
      const imported: Item[] = pending.items.map(it => ({
        id: nextId++, frame: it.frame, type: it.type, note: it.note || '',
        x: it.x || 0, y: it.y || 0, w: it.w || 0, h: it.h || 0,
      }));
      setItems(imported);
    } else {
      setItems([]);
    }

    stateRef.current.fps = detectedFps;
    stateRef.current.totalFrames = frames;
    seekToFrame(0);
  }, [seekToFrame]);

  const stepFrame = useCallback((d: number) => {
    if (!videoLoaded) return;
    if (stateRef.current.isPlaying) {
      videoRef.current?.pause();
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      setIsPlaying(false);
    }
    seekToFrame(stateRef.current.currentFrame + d);
  }, [videoLoaded, seekToFrame]);

  const togglePlay = useCallback(() => {
    if (!videoLoaded) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (stateRef.current.isPlaying) {
      video.pause();
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      setIsPlaying(false);
    } else {
      const { fps, currentFrame } = stateRef.current;
      video.currentTime = currentFrame / fps;
      video.play();
      setIsPlaying(true);
      const ctx = canvas.getContext('2d')!;
      const tick = () => {
        if (!stateRef.current.isPlaying) return;
        const f = Math.round(video.currentTime * stateRef.current.fps);
        if (f >= stateRef.current.totalFrames) {
          video.pause(); setIsPlaying(false); return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setCurrentFrame(f);
        animIdRef.current = requestAnimationFrame(tick);
      };
      animIdRef.current = requestAnimationFrame(tick);
    }
  }, [videoLoaded]);

  const addMarker = useCallback(() => {
    if (!videoLoaded) return;
    const { currentFrame } = stateRef.current;
    const id = nextId++;
    setItems(prev => {
      const item: Item = { id, frame: currentFrame, type: 'marker', note: '', x: 0, y: 0, w: 0, h: 0 };
      const next = [...prev, item];
      next.sort((a, b) => a.frame - b.frame || a.id - b.id);
      return next;
    });
    setEditingId(id);
    setEditingText('');
    setEditIsNew(true);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [videoLoaded]);

  const deleteItem = useCallback((id: number) => {
    setItems(prev => prev.filter(it => it.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const updateItemNote = useCallback((id: number, note: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, note } : it));
  }, []);

  const startEditing = useCallback((it: Item) => {
    setEditingId(it.id);
    setEditingText(it.note);
    setEditIsNew(false);
    setTimeout(() => editRef.current?.focus(), 0);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId !== null) {
      updateItemNote(editingId, editingText);
      setEditingId(null);
      setEditIsNew(false);
    }
  }, [editingId, editingText, updateItemNote]);

  const cancelEdit = useCallback(() => {
    if (editIsNew && editingId !== null) {
      setItems(prev => prev.filter(it => it.id !== editingId));
    }
    setEditingId(null);
    setEditIsNew(false);
  }, [editIsNew, editingId]);

  const getCanvasPos = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * overlay.width / rect.width,
      y: (e.clientY - rect.top) * overlay.height / rect.height,
    };
  }, []);

  const onOverlayMouseDown = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    if (!stateRef.current.annoMode) return;
    dragRef.current = { start: getCanvasPos(e), isDragging: false };
  }, [getCanvasPos]);

  const onOverlayMouseMove = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const p = getCanvasPos(e);
    const dx = Math.abs(p.x - d.start.x), dy = Math.abs(p.y - d.start.y);
    if (dx > 5 || dy > 5) d.isDragging = true;
    if (d.isDragging) {
      drawAnnotations();
      const octx = overlayRef.current?.getContext('2d');
      if (octx) {
        octx.strokeStyle = '#d29922';
        octx.lineWidth = 2;
        octx.setLineDash([6, 3]);
        octx.strokeRect(d.start.x, d.start.y, p.x - d.start.x, p.y - d.start.y);
        octx.setLineDash([]);
      }
    }
  }, [getCanvasPos, drawAnnotations]);

  const onOverlayMouseUp = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || !stateRef.current.annoMode) return;
    const p = getCanvasPos(e);
    const { currentFrame } = stateRef.current;

    const id = nextId++;
    const item: Item = d.isDragging
      ? { id, frame: currentFrame, type: 'rect', note: '', x: Math.round(Math.min(d.start.x, p.x)), y: Math.round(Math.min(d.start.y, p.y)), w: Math.round(Math.abs(p.x - d.start.x)), h: Math.round(Math.abs(p.y - d.start.y)) }
      : { id, frame: currentFrame, type: 'point', note: '', x: Math.round(p.x), y: Math.round(p.y), w: 0, h: 0 };

    setItems(prev => {
      const next = [...prev, item];
      next.sort((a, b) => a.frame - b.frame || a.id - b.id);
      return next;
    });
    setEditingId(id);
    setEditingText('');
    setEditIsNew(true);
    setTimeout(() => editRef.current?.focus(), 0);
  }, [getCanvasPos]);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.outline = 'none';
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('video/')) loadVideo(f);
  }, [loadVideo]);

  const exportJSON = useCallback(() => {
    const { fps, totalFrames } = stateRef.current;
    const data: ExportData = {
      fileName, width: videoWidth, height: videoHeight,
      fps, totalFrames, videoDuration: +(totalFrames / fps).toFixed(3),
      items: stateRef.current.items.map(it => ({
        frame: it.frame, time: fmtTime(it.frame / fps), type: it.type, note: it.note,
        x: it.x, y: it.y, w: it.w, h: it.h,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'video-decompose.json'; a.click();
  }, []);

  const copyJSON = useCallback(() => {
    const { fps, totalFrames } = stateRef.current;
    const data: ExportData = {
      fileName, width: videoWidth, height: videoHeight,
      fps, totalFrames, videoDuration: +(totalFrames / fps).toFixed(3),
      items: stateRef.current.items.map(it => ({
        frame: it.frame, time: fmtTime(it.frame / fps), type: it.type, note: it.note,
        x: it.x, y: it.y, w: it.w, h: it.h,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => alert('已复制到剪贴板'));
  }, []);

  const importJSON = useCallback(() => { importInputRef.current?.click(); }, []);

  const applyImport = useCallback((data: ExportData) => {
    if (data.fps) setFps(data.fps);
    if (data.totalFrames) setTotalFrames(data.totalFrames);
    const imported: Item[] = data.items.map(it => ({
      id: nextId++, frame: it.frame, type: it.type, note: it.note || '',
      x: it.x || 0, y: it.y || 0, w: it.w || 0, h: it.h || 0,
    }));
    setItems(imported);
  }, []);

  const handleImport = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportData;
        if (videoLoaded) {
          applyImport(data);
        } else {
          pendingImportRef.current = data;
          alert(`请选择视频文件${data.fileName ? ': ' + data.fileName : ''}`);
          fileInputRef.current?.click();
        }
      } catch (err) { alert('JSON 解析失败: ' + (err as Error).message); }
    };
    reader.readAsText(file); e.target.value = '';
  }, [videoLoaded, applyImport]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); stepFrame(e.shiftKey ? -10 : -1); break;
        case 'ArrowRight': e.preventDefault(); stepFrame(e.shiftKey ? 10 : 1); break;
        case ' ': e.preventDefault(); togglePlay(); break;
        case 'm': case 'M': addMarker(); break;
        case 'a': case 'A': setAnnoMode(p => !p); break;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [stepFrame, togglePlay, addMarker]);

  const onTimelineClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!videoLoaded || (e.target as HTMLElement).classList.contains('tl-pin')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekToFrame(Math.round((e.clientX - rect.left) / rect.width * stateRef.current.totalFrames));
  }, [videoLoaded, seekToFrame]);

  const uniqueFrames = [...new Set(items.map(it => it.frame))].sort((a, b) => a - b);

  return (
    <>
      <header>
        <h1>Video Decompose</h1>
        <span className="meta">{videoMeta}</span>
      </header>
      <div className="main">
        <div className="video-panel">
          <div
            className="canvas-wrap"
            onDragOver={(e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.style.outline = '2px solid var(--accent)'; }}
            onDragLeave={(e: DragEvent<HTMLDivElement>) => { e.currentTarget.style.outline = 'none'; }}
            onDrop={handleDrop}
          >
            <canvas ref={canvasRef} />
            <canvas
              ref={overlayRef}
              className={`overlay ${annoMode ? '' : 'inactive'}`}
              onMouseDown={onOverlayMouseDown}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
            />
            <div className="timeline" ref={timelineRef} style={{ left: tlStyle.left, width: tlStyle.width }} onClick={onTimelineClick}>
              {videoLoaded && totalFrames > 0 && (
                <>
                  {uniqueFrames.map((frame, idx) => (
                    <div
                      key={frame}
                      className="tl-pin"
                      style={{
                        left: `${(frame / totalFrames) * 100}%`,
                        background: COLORS[idx % COLORS.length],
                        opacity: 0.8,
                      }}
                      title={`#${frame}`}
                      onClick={(e) => { e.stopPropagation(); seekToFrame(frame); }}
                    />
                  ))}
                  <div className="tl-cursor" style={{ left: `${(currentFrame / totalFrames) * 100}%` }} />
                </>
              )}
            </div>
            {!videoLoaded && <div className="drop-hint">拖拽视频文件到此处<br/>或点击下方「加载视频」</div>}
          </div>

          <div className="controls">
            <input type="file" ref={fileInputRef} accept="video/*" style={{ display: 'none' }} onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) loadVideo(e.target.files[0]); }} />
            <button className="load-btn" onClick={() => fileInputRef.current?.click()}>加载视频</button>
            <button onClick={() => stepFrame(-10)} title="后退10帧 (Shift+←)">⏪10</button>
            <button onClick={() => stepFrame(-1)} title="后退1帧 (←)">◀ 1帧</button>
            <button onClick={togglePlay} title="播放/暂停 (Space)">{isPlaying ? '⏸' : '▶'}</button>
            <button onClick={() => stepFrame(1)} title="前进1帧 (→)">1帧 ▶</button>
            <button onClick={() => stepFrame(10)} title="前进10帧 (Shift+→)">10⏩</button>
            <span className="frame-info">帧 {currentFrame} / {totalFrames} | {fmtTime(currentFrame / fps)}</span>
            <input
              type="range" min={0} max={totalFrames - 1} value={currentFrame} step={1}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { if (isPlaying) togglePlay(); seekToFrame(parseInt(e.target.value)); }}
            />
            <button
              className={`mute-btn ${muted ? '' : 'active'}`}
              onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next; }}
              title="静音切换"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button className="mark-btn" onClick={addMarker} title="标记当前帧 (M)">📌 标记</button>
            <button
              className={`anno-btn ${annoMode ? 'active' : ''}`}
              onClick={() => setAnnoMode(p => !p)}
              title="画面标注模式 (A)"
            >
              {annoMode ? '✏️ 标注中' : '✏️ 标注'}
            </button>
          </div>
        </div>

        <div className={`items-panel ${panelCollapsed ? 'collapsed' : ''}`}>
          <div className="items-header" onClick={() => setPanelCollapsed(p => !p)}>
            <h2>条目 ({items.length}) <span className="toggle-arrow">{panelCollapsed ? '▲' : '▼'}</span></h2>
          </div>
          <div className="items-list">
            {items.map((it, idx) => (
              <div key={it.id} className={`item-card ${it.frame === currentFrame ? 'highlight' : ''}`} onClick={() => seekToFrame(it.frame)}>
                <div className="item-header">
                  <span className="item-type" style={{ color: COLORS[idx % COLORS.length] }}>
                    {it.type === 'marker' ? '📌' : it.type === 'point' ? '●' : '▭'}
                  </span>
                  <span className="item-frame">#{it.frame}</span>
                  <span className="item-time">{fmtTime(it.frame / fps)}</span>
                  <button className="del-btn" title="删除" onClick={(e) => { e.stopPropagation(); deleteItem(it.id); }}>✕</button>
                </div>
                <div
                  className="item-note-preview"
                  onClick={(e) => { e.stopPropagation(); startEditing(it); }}
                >
                  {it.note || <span className="placeholder">{it.type === 'marker' ? '注释...' : '标注说明...'}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="export-bar">
            <button onClick={exportJSON}>导出 JSON</button>
            <button className="secondary" onClick={importJSON}>导入</button>
            <button className="secondary" onClick={copyJSON}>复制</button>
          </div>
        </div>
      </div>

      {editingId !== null && (
        <div className="edit-overlay" onClick={commitEdit}>
          <div className="edit-panel" onClick={(e) => e.stopPropagation()}>
            <textarea
              ref={editRef}
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') cancelEdit();
              }}
              placeholder="编辑注释... (Enter 确认, Shift+Enter 换行, Esc 取消)"
            />
            <div className="edit-actions">
              <button onClick={commitEdit}>确认</button>
              <button className="secondary" onClick={cancelEdit}>取消</button>
            </div>
          </div>
        </div>
      )}

      <video ref={videoRef} style={{ display: 'none' }} muted={muted} />
      <input type="file" ref={importInputRef} accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </>
  );
}
