import React from 'react';
import { AbsoluteFill, Sequence, Video, useVideoConfig } from 'remotion';
import type { ClipData, SubtitleData, StatData } from '../types';

export interface ClipPreviewProps {
  clips: ClipData[];
  subtitles: SubtitleData[];
  stats: StatData[];
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

export const ClipPreview: React.FC<ClipPreviewProps> = ({ clips, subtitles, stats }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      {clips.map((clip, i) => {
        const startFrame = Math.round((clip.offsetSec ?? 0) * fps);
        const durFrames = Math.round(clip.durationSec * fps);
        return (
          <Sequence key={`clip-${i}`} from={startFrame} durationInFrames={durFrames} layout="none">
            <AbsoluteFill>
              <Video
                src={`http://localhost:3456/public/${clip.src}`}
                startFrom={clip.startFrom ? Math.round(clip.startFrom * fps) : 0}
                volume={0}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {subtitles.map((sub, i) => {
        const startFrame = Math.round(sub.startSec * fps);
        const durFrames = Math.round(sub.durationSec * fps);
        return (
          <Sequence key={`sub-${i}`} from={startFrame} durationInFrames={durFrames} layout="none">
            <SubtitleOverlay text={sub.text} />
          </Sequence>
        );
      })}

      {stats.map((stat, i) => {
        const startFrame = Math.round(stat.startSec * fps);
        const durFrames = Math.round(stat.durationSec * fps);
        return (
          <Sequence key={`stat-${i}`} from={startFrame} durationInFrames={durFrames} layout="none">
            <StatOverlay value={stat.value} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
