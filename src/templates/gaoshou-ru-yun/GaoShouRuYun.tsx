import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import type { GaoShouRuYunProps } from "./schema";

const FRAME = {
  DIM_START: 890,
  TEXT_SWITCH: 897,
  NORMAL_BRIGHTNESS: 903,
  GRAPHIC_EFFECT: 927,
  BEATS: [927, 980, 1035, 1091],
} as const;

const VIDEO_BEAT_SEC = FRAME.GRAPHIC_EFFECT / 30;

export const GaoShouRuYun: React.FC<GaoShouRuYunProps> = ({
  前段文字,
  后段文字,
  视频路径,
  音乐卡点秒,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dimOverlayOpacity = (() => {
    if (frame < FRAME.DIM_START) return 0;
    if (frame < FRAME.TEXT_SWITCH) {
      return interpolate(frame, [FRAME.DIM_START, FRAME.TEXT_SWITCH], [0, 1]);
    }
    if (frame < FRAME.NORMAL_BRIGHTNESS) {
      return interpolate(frame, [FRAME.TEXT_SWITCH, FRAME.NORMAL_BRIGHTNESS], [1, 0]);
    }
    return 0;
  })();

  const showFrontText = frame < FRAME.TEXT_SWITCH;
  const showBackText = frame >= FRAME.TEXT_SWITCH;

  const hasVideo = 视频路径.length > 0;

  const textStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: 120,
    textAlign: "center",
    color: "white",
    fontSize: 60,
    fontWeight: 900,
    fontFamily: "Source Han Sans SC, sans-serif",
    textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
    lineHeight: 1,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <Audio
        src={staticFile("高手如云的小曲.mp3")}
        trimBefore={Math.round((音乐卡点秒 - VIDEO_BEAT_SEC) * fps)}
      />

      {hasVideo ? (
        <Video
          src={staticFile(视频路径)}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          }}
        />
      )}

      <AbsoluteFill
        style={{
          backgroundColor: `rgba(0, 0, 0, ${dimOverlayOpacity})`,
        }}
      />

      {showFrontText && (
        <div style={{ ...textStyle, opacity: 1 - dimOverlayOpacity }}>
          {前段文字}
        </div>
      )}

      {showBackText && (
        <div style={textStyle}>
          {后段文字}
        </div>
      )}
    </AbsoluteFill>
  );
};
