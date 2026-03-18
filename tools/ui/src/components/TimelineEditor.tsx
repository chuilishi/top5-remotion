import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import type { ClipData, SubtitleData, StatData, VoiceoverData, GameData } from '../types';
import { resolveClipLayout, computeClipsDuration } from '@top5/utils/timeline';
import { ClipPreview, type ClipPreviewProps } from './ClipPreview';

const SNAP_PX = 8;

const FPS = 60;

interface Props {
  clips: ClipData[];
  subtitles: SubtitleData[];
  stats: StatData[];
  voiceover: VoiceoverData[];
  onClipsChange: (clips: ClipData[]) => void;
  onSubtitlesChange: (subs: SubtitleData[]) => void;
  onStatsChange: (stats: StatData[]) => void;
  onVoiceoverChange: (vo: VoiceoverData[]) => void;
  onSave: () => Promise<void>;
  onRefresh: () => void;
  currentGame: GameData | null;
}

function computeDuration(clips: ClipData[]): number {
  if (!clips.length) return 0;
  return computeClipsDuration(clips);
}

function getSnapPoints(clips: ClipData[], subs: SubtitleData[], stats: StatData[], voiceover: VoiceoverData[], type: string, excludeIdx: number, dur: number, trackW: number): number[] {
  const pxPerSec = trackW / dur;
  const points = [0];
  const resolved = resolveClipLayout(clips);
  resolved.forEach((c, i) => {
    if (type === 'clip' && i === excludeIdx) return;
    const start = c.offsetSec * pxPerSec;
    const end = (c.offsetSec + c.durationSec) * pxPerSec;
    points.push(start, end);
  });
  subs.forEach((s, i) => {
    if (type === 'subtitle' && i === excludeIdx) return;
    points.push(s.startSec * pxPerSec, (s.startSec + s.durationSec) * pxPerSec);
  });
  stats.forEach((s, i) => {
    if (type === 'stat' && i === excludeIdx) return;
    points.push(s.startSec * pxPerSec, (s.startSec + s.durationSec) * pxPerSec);
  });
  voiceover.forEach((v, i) => {
    if (type === 'voiceover' && i === excludeIdx) return;
    points.push(v.offsetSec * pxPerSec);
  });
  return [...new Set(points)];
}

function applySnap(px: number, snapPoints: number[], threshold: number): number {
  let closest = px;
  let minDist = threshold + 1;
  for (const sp of snapPoints) {
    const d = Math.abs(px - sp);
    if (d < minDist) { minDist = d; closest = sp; }
  }
  return minDist <= threshold ? closest : px;
}

export function TimelineEditor({ clips, subtitles, stats, voiceover, onClipsChange, onSubtitlesChange, onStatsChange, onVoiceoverChange, onSave, onRefresh, currentGame }: Props) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [zoom, setZoom] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [compositionTime, setCompositionTime] = useState(0);
  const playerRef = useRef<PlayerRef>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dur = useMemo(() => computeDuration(clips), [clips]);
  const totalFrames = useMemo(() => Math.max(1, Math.round(dur * FPS)), [dur]);
  const resolvedClips = useMemo(() => resolveClipLayout(clips), [clips]);

  const seekToTime = useCallback((t: number) => {
    const p = playerRef.current;
    if (!p || dur <= 0) return;
    const clampedT = Math.max(0, Math.min(dur, t));
    setCompositionTime(clampedT);
    if (playheadRef.current) {
      playheadRef.current.style.left = (clampedT / dur * 100) + '%';
    }
    p.seekTo(Math.round(clampedT * FPS));
  }, [dur]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = () => {
      const frame = p.getCurrentFrame();
      const t = frame / FPS;
      setCompositionTime(t);
      if (playheadRef.current && dur > 0) {
        playheadRef.current.style.left = (t / dur * 100) + '%';
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    p.addEventListener('frameupdate', onFrame as any);
    p.addEventListener('play', onPlay as any);
    p.addEventListener('pause', onPause as any);
    p.addEventListener('ended', onEnded as any);
    return () => {
      p.removeEventListener('frameupdate', onFrame as any);
      p.removeEventListener('play', onPlay as any);
      p.removeEventListener('pause', onPause as any);
      p.removeEventListener('ended', onEnded as any);
    };
  }, [dur]);

  const handlePlayPause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (isPlaying) {
      p.pause();
    } else {
      p.play();
    }
  }, [isPlaying]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left + el.scrollLeft;
      const oldZoom = zoom;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(1, Math.min(20, oldZoom * factor));
      setZoom(newZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = mouseX * (newZoom / oldZoom) - (e.clientX - rect.left);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom]);

  const handleWrapperClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.timeline-bar') || (e.target as HTMLElement).closest('.timeline-handle')) return;
    const wrapper = wrapperRef.current;
    if (!wrapper || dur <= 0) return;
    const rect = wrapper.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const t = (x / rect.width) * dur;
    seekToTime(t);
  }, [dur, seekToTime]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, idx: number, type: 'clip' | 'subtitle' | 'stat' | 'voiceover') => {
    if ((e.target as HTMLElement).classList.contains('timeline-handle')) return;
    e.preventDefault();
    const bar = e.currentTarget as HTMLElement;
    bar.classList.add('dragging');
    const track = bar.parentElement!;
    const trackW = track.offsetWidth;
    const startX = e.clientX;
    const startLeft = parseFloat(bar.style.left) / 100 * trackW;
    const snapPoints = getSnapPoints(clips, subtitles, stats, voiceover, type, idx, dur, trackW);

    const onMove = (e2: MouseEvent) => {
      const dx = e2.clientX - startX;
      let newLeft = Math.max(0, startLeft + dx);
      const itemDur = type === 'clip' ? clips[idx].durationSec
        : type === 'subtitle' ? subtitles[idx].durationSec
        : type === 'stat' ? stats[idx].durationSec : 1;
      const rightPx = newLeft + itemDur * (trackW / dur);
      const snappedLeft = applySnap(newLeft, snapPoints, SNAP_PX);
      const snappedRight = applySnap(rightPx, snapPoints, SNAP_PX);
      if (Math.abs(snappedLeft - newLeft) <= Math.abs(snappedRight - rightPx)) {
        newLeft = snappedLeft;
      } else {
        newLeft = snappedRight - itemDur * (trackW / dur);
      }
      newLeft = Math.max(0, newLeft);
      const newSec = Math.round(newLeft / trackW * dur * 10) / 10;
      bar.style.left = (newSec / dur * 100) + '%';
      bar.dataset.pendingSec = String(newSec);
    };
    const onUp = () => {
      bar.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalSec = parseFloat(bar.dataset.pendingSec ?? '0');
      delete bar.dataset.pendingSec;
      if (type === 'clip') {
        const next = [...clips]; next[idx] = { ...next[idx], offsetSec: finalSec }; onClipsChange(next);
      } else if (type === 'subtitle') {
        const next = [...subtitles]; next[idx] = { ...next[idx], startSec: finalSec }; onSubtitlesChange(next);
      } else if (type === 'voiceover') {
        const next = [...voiceover]; next[idx] = { ...next[idx], offsetSec: finalSec }; onVoiceoverChange(next);
      } else {
        const next = [...stats]; next[idx] = { ...next[idx], startSec: finalSec }; onStatsChange(next);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [clips, subtitles, stats, voiceover, dur, onClipsChange, onSubtitlesChange, onStatsChange, onVoiceoverChange]);

  const handleEdgeDrag = useCallback((e: React.MouseEvent, idx: number, type: 'clip' | 'subtitle' | 'stat' | 'voiceover', side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    const bar = handle.parentElement!;
    handle.classList.add('active');
    bar.classList.add('dragging');
    const track = bar.parentElement!;
    const trackW = track.offsetWidth;
    const pxPerSec = trackW / dur;
    const startX = e.clientX;

    const item = type === 'clip' ? { ...clips[idx] } : type === 'subtitle' ? { ...subtitles[idx] } : type === 'voiceover' ? { ...voiceover[idx], durationSec: 1 } : { ...stats[idx] };
    const origOffset = type === 'clip' ? (resolvedClips[idx]?.offsetSec ?? 0) : type === 'voiceover' ? (item as VoiceoverData).offsetSec : (item as SubtitleData).startSec;
    const origDur = item.durationSec;
    let pendingOffset = origOffset;
    let pendingDur = origDur;

    const onMove = (e2: MouseEvent) => {
      const dx = e2.clientX - startX;
      const deltaSec = dx / pxPerSec;

      if (side === 'left') {
        const maxDelta = origDur - 0.1;
        const delta = Math.max(-origOffset, Math.min(maxDelta, deltaSec));
        const roundDelta = Math.round(delta * 10) / 10;
        pendingOffset = Math.round((origOffset + roundDelta) * 10) / 10;
        pendingDur = Math.max(0.1, Math.round((origDur - roundDelta) * 10) / 10);
        bar.style.left = (pendingOffset / dur * 100) + '%';
        bar.style.width = (pendingDur / dur * 100) + '%';
      } else {
        pendingDur = Math.max(0.1, Math.round((origDur + deltaSec) * 10) / 10);
        bar.style.width = (pendingDur / dur * 100) + '%';
      }
    };
    const onUp = () => {
      handle.classList.remove('active');
      bar.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (type === 'clip') {
        const next = [...clips];
        next[idx] = side === 'left'
          ? { ...next[idx], offsetSec: pendingOffset, durationSec: pendingDur }
          : { ...next[idx], durationSec: pendingDur };
        onClipsChange(next);
      } else if (type === 'subtitle') {
        const next = [...subtitles];
        next[idx] = side === 'left'
          ? { ...next[idx], startSec: pendingOffset, durationSec: pendingDur }
          : { ...next[idx], durationSec: pendingDur };
        onSubtitlesChange(next);
      } else if (type === 'voiceover') {
        const next = [...voiceover];
        next[idx] = { ...next[idx], offsetSec: pendingOffset };
        onVoiceoverChange(next);
      } else {
        const next = [...stats];
        next[idx] = side === 'left'
          ? { ...next[idx], startSec: pendingOffset, durationSec: pendingDur }
          : { ...next[idx], durationSec: pendingDur };
        onStatsChange(next);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [clips, subtitles, stats, voiceover, resolvedClips, dur, onClipsChange, onSubtitlesChange, onStatsChange, onVoiceoverChange]);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      await onSave();
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 1500);
    }
  };

  const addSubtitle = () => {
    const last = subtitles[subtitles.length - 1];
    const start = last ? last.startSec + last.durationSec + 0.5 : 0;
    onSubtitlesChange([...subtitles, { text: '新字幕', startSec: Math.round(start * 10) / 10, durationSec: 2 }]);
  };

  const addStat = () => {
    const last = stats[stats.length - 1];
    const start = last ? last.startSec + last.durationSec + 0.5 : 5;
    onStatsChange([...stats, { value: '0', startSec: Math.round(start * 10) / 10, durationSec: 2.5 }]);
  };

  const rulerStep = dur <= 10 ? 1 : dur <= 30 ? 2 : 5;
  const rulerMarks: number[] = [];
  for (let t = 0; t <= dur; t += rulerStep) rulerMarks.push(t);

  const saveLabel = saveState === 'saving' ? '⏳' : saveState === 'saved' ? '✓ 已保存' : saveState === 'error' ? '✗ 失败' : '💾 保存';

  return (
    <div className="section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <label style={{ margin: 0 }}>时间线编辑</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" onClick={onRefresh}>↻ 刷新</button>
          <button className="btn-save" disabled={saveState !== 'idle'} onClick={handleSave}>{saveLabel}</button>
        </div>
      </div>

      <div className="video-preview-container">
        <Player
          ref={playerRef}
          component={ClipPreview}
          inputProps={{ clips, subtitles, stats, voiceover } satisfies ClipPreviewProps}
          durationInFrames={totalFrames}
          compositionWidth={1920}
          compositionHeight={1080}
          fps={FPS}
          style={{ width: '100%', aspectRatio: '16/9', background: '#0a0a0f' }}
          controls={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <button className="btn-ghost" onClick={handlePlayPause} style={{ fontSize: 16, padding: '4px 12px' }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
          {compositionTime.toFixed(1)}s / {dur.toFixed(1)}s
        </span>
      </div>

      <div ref={scrollRef} className="timeline-scroll" style={{ overflowX: zoom > 1 ? 'auto' : 'hidden' }}>
      <div ref={wrapperRef} className="timeline-wrapper" style={{ width: `${zoom * 100}%` }} onClick={handleWrapperClick}>
        <div className="timeline-ruler">
          {rulerMarks.map(t => (
            <span key={t} style={{ left: dur > 0 ? (t / dur * 100) + '%' : '0%' }}>{t}s</span>
          ))}
        </div>
        <div ref={tracksRef}>
          {/* Clip track */}
          <div className="timeline-track" title="切片轨" style={{ background: '#0d0d12' }}>
            {resolvedClips.map((c, i) => {
                const name = c.src.split('/').pop();
                return (
                  <div key={i} className="timeline-bar clip"
                    style={{ left: dur > 0 ? (c.offsetSec / dur * 100) + '%' : '0%', width: dur > 0 ? (c.durationSec / dur * 100) + '%' : '0%' }}
                    title={`${name} [offset=${c.offsetSec.toFixed(1)}s, dur=${c.durationSec}s]`}
                    onMouseDown={e => handleBarMouseDown(e, i, 'clip')}>
                    {name}
                    <div className="timeline-handle timeline-handle-left" onMouseDown={e => handleEdgeDrag(e, i, 'clip', 'left')} />
                    <div className="timeline-handle timeline-handle-right" onMouseDown={e => handleEdgeDrag(e, i, 'clip', 'right')} />
                  </div>
                );
            })}
          </div>
          {/* Subtitle track */}
          <div className="timeline-track" title="字幕轨">
            {subtitles.map((s, i) => (
              <div key={i} className="timeline-bar subtitle"
                style={{ left: dur > 0 ? (s.startSec / dur * 100) + '%' : '0%', width: dur > 0 ? (s.durationSec / dur * 100) + '%' : '0%' }}
                title={`${s.text} [${s.startSec}s → ${s.startSec + s.durationSec}s]`}
                onMouseDown={e => handleBarMouseDown(e, i, 'subtitle')}>
                {s.text}
                <div className="timeline-handle timeline-handle-left" onMouseDown={e => handleEdgeDrag(e, i, 'subtitle', 'left')} />
                <div className="timeline-handle timeline-handle-right" onMouseDown={e => handleEdgeDrag(e, i, 'subtitle', 'right')} />
              </div>
            ))}
          </div>
          {/* Stat track */}
          {stats.length > 0 && (
            <div className="timeline-track" title="统计数字轨">
              {stats.map((s, i) => (
                <div key={i} className="timeline-bar stat"
                  style={{ left: dur > 0 ? (s.startSec / dur * 100) + '%' : '0%', width: dur > 0 ? (s.durationSec / dur * 100) + '%' : '0%' }}
                  title={`${s.value} [${s.startSec}s → ${s.startSec + s.durationSec}s]`}
                  onMouseDown={e => handleBarMouseDown(e, i, 'stat')}>
                  {s.value}
                  <div className="timeline-handle timeline-handle-left" onMouseDown={e => handleEdgeDrag(e, i, 'stat', 'left')} />
                  <div className="timeline-handle timeline-handle-right" onMouseDown={e => handleEdgeDrag(e, i, 'stat', 'right')} />
                </div>
              ))}
            </div>
          )}
          {/* Voiceover track */}
          {voiceover.length > 0 && (
            <div className="timeline-track" title="配音轨" style={{ background: '#0a100d' }}>
              {voiceover.map((vo, i) => {
                const voDur = i < voiceover.length - 1 ? voiceover[i + 1].offsetSec - vo.offsetSec : dur - vo.offsetSec;
                return (
                <div key={i} className="timeline-bar voiceover"
                  style={{ left: dur > 0 ? (vo.offsetSec / dur * 100) + '%' : '0%', width: dur > 0 ? (Math.max(0.5, voDur) / dur * 100) + '%' : '0%' }}
                  title={`${vo.text} [${vo.offsetSec}s]`}
                  onMouseDown={e => handleBarMouseDown(e, i, 'voiceover')}>
                  {vo.text}
                </div>
                );
              })}
            </div>
          )}
        </div>
        <div ref={playheadRef} className="timeline-playhead" />
      </div>
      </div>

      {zoom > 1 && (
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <button className="btn-ghost" onClick={() => setZoom(1)} style={{ fontSize: 11 }}>
            🔍 {Math.round(zoom * 100)}% → 重置
          </button>
        </div>
      )}

      {/* Subtitles */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ margin: 0 }}>字幕</label>
          <button className="btn-add" onClick={addSubtitle}>+ 添加</button>
        </div>
        <div>
          {subtitles.map((s, i) => (
            <div key={i} className="sub-item">
              <div className="timing-row">
                <input className="timing-text-input" value={s.text}
                  onChange={e => { const next = [...subtitles]; next[i] = { ...next[i], text: e.target.value }; onSubtitlesChange(next); }} />
                <button className="btn-remove" onClick={() => { const next = subtitles.filter((_, j) => j !== i); onSubtitlesChange(next); }}>×</button>
              </div>
              <div className="timing-row" style={{ marginTop: 4 }}>
                <label>开始</label>
                <input className="timing-input" type="number" step={0.1} min={0} value={s.startSec}
                  onChange={e => { const next = [...subtitles]; next[i] = { ...next[i], startSec: +e.target.value }; onSubtitlesChange(next); }} />
                <label>时长</label>
                <input className="timing-input" type="number" step={0.1} min={0.1} value={s.durationSec}
                  onChange={e => { const next = [...subtitles]; next[i] = { ...next[i], durationSec: +e.target.value }; onSubtitlesChange(next); }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Voiceover */}
      {voiceover.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label>配音</label>
          <div>
            {voiceover.map((vo, i) => (
              <div key={i} className="sub-item">
                <div className="timing-row">
                  <span style={{ flex: 1, fontSize: 13, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vo.text}</span>
                  <span style={{ fontSize: 11, color: '#666', flexShrink: 0 }}>{vo.src.split('/').pop()}</span>
                </div>
                <div className="timing-row" style={{ marginTop: 4 }}>
                  <label>偏移</label>
                  <input className="timing-input" type="number" step={0.1} min={0} value={vo.offsetSec}
                    onChange={e => { const next = [...voiceover]; next[i] = { ...next[i], offsetSec: +e.target.value }; onVoiceoverChange(next); }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ margin: 0 }}>统计数字</label>
          <button className="btn-add" onClick={addStat}>+ 添加</button>
        </div>
        <div>
          {stats.map((s, i) => (
            <div key={i} className="sub-item">
              <div className="timing-row">
                <input className="timing-text-input" value={s.value}
                  onChange={e => { const next = [...stats]; next[i] = { ...next[i], value: e.target.value }; onStatsChange(next); }} />
                <button className="btn-remove" onClick={() => { const next = stats.filter((_, j) => j !== i); onStatsChange(next); }}>×</button>
              </div>
              <div className="timing-row" style={{ marginTop: 4 }}>
                <label>开始</label>
                <input className="timing-input" type="number" step={0.1} min={0} value={s.startSec}
                  onChange={e => { const next = [...stats]; next[i] = { ...next[i], startSec: +e.target.value }; onStatsChange(next); }} />
                <label>时长</label>
                <input className="timing-input" type="number" step={0.1} min={0.1} value={s.durationSec}
                  onChange={e => { const next = [...stats]; next[i] = { ...next[i], durationSec: +e.target.value }; onStatsChange(next); }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
