import React, { useMemo } from 'react';
import { AbsoluteFill, Audio, Sequence, Series, Video, useVideoConfig } from 'remotion';
import type { ClipData, SubtitleData, StatData, VoiceoverData } from '../types';
import { resolveClipLayout, computeClipsDuration, computeVoiceDurations } from '@top5/utils/timeline';

export interface ClipPreviewProps {
  clips: ClipData[];
  subtitles: SubtitleData[];
  stats: StatData[];
  voiceover: VoiceoverData[];
}

const SubtitleOverlay: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 60,
  }}>
    <span style={{
      fontSize: 48,
      fontWeight: 900,
      color: '#fff',
      textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.5)',
      WebkitTextStroke: '1.5px rgba(0,0,0,0.6)',
      padding: '4px 16px',
    }}>
      {text}
    </span>
  </div>
);

const StatOverlay: React.FC<{ value: string }> = ({ value }) => (
  <div style={{
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 55,
  }}>
    <span style={{
      fontSize: 120,
      fontWeight: 900,
      color: '#ffd700',
      textShadow: '0 4px 16px rgba(0,0,0,0.8), 0 0 40px rgba(255,50,0,0.3)',
      WebkitTextStroke: '2px rgba(180,130,0,0.5)',
      transform: 'skewX(-6deg) scaleX(0.88)',
      letterSpacing: 4,
    }}>
      {value}
    </span>
  </div>
);

export const ClipPreview: React.FC<ClipPreviewProps> = ({ clips, subtitles, stats, voiceover }) => {
  const { fps } = useVideoConfig();

  const resolved = useMemo(() => resolveClipLayout(clips), [clips]);
  const gpDur = useMemo(() => computeClipsDuration(clips), [clips]);
  const hasExplicitOffsets = useMemo(() => clips.some((c) => c.offsetSec != null), [clips]);
  const voDurs = useMemo(
    () => voiceover.length ? computeVoiceDurations(voiceover, gpDur) : [],
    [voiceover, gpDur],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      {hasExplicitOffsets
        ? resolved.map((clip, i) => (
            <Sequence key={`clip-${i}`} from={Math.round(clip.offsetSec * fps)} durationInFrames={Math.round(clip.durationSec * fps)} layout="none">
              <AbsoluteFill>
                <Video
                  src={`http://localhost:3456/public/${clip.src}`}
                  startFrom={Math.round(clip.startFrom * fps)}
                  volume={0}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </AbsoluteFill>
            </Sequence>
          ))
        : (
          <Series>
            {resolved.map((clip, i) => (
              <Series.Sequence key={`clip-${i}`} durationInFrames={Math.round(clip.durationSec * fps)} layout="none">
                <AbsoluteFill>
                  <Video
                    src={`http://localhost:3456/public/${clip.src}`}
                    startFrom={Math.round(clip.startFrom * fps)}
                    volume={0}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </AbsoluteFill>
              </Series.Sequence>
            ))}
          </Series>
        )}

      {subtitles.map((sub, i) => (
        <Sequence key={`sub-${i}`} from={Math.round(sub.startSec * fps)} durationInFrames={Math.round(sub.durationSec * fps)} layout="none">
          <SubtitleOverlay text={sub.text} />
        </Sequence>
      ))}

      {stats.map((stat, i) => (
        <Sequence key={`stat-${i}`} from={Math.round(stat.startSec * fps)} durationInFrames={Math.round(stat.durationSec * fps)} layout="none">
          <StatOverlay value={stat.value} />
        </Sequence>
      ))}

      {voiceover.map((vo, i) => {
        const fromFrame = Math.round(vo.offsetSec * fps);
        const durFrames = Math.max(1, Math.round((voDurs[i] ?? 10) * fps));
        return (
          <Sequence key={`vo-${i}`} from={fromFrame} durationInFrames={durFrames} layout="none">
            <Audio src={`http://localhost:3456/public/${vo.src}`} volume={1} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
