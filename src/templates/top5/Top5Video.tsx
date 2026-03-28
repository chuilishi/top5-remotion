import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, prefetch, delayRender, continueRender } from "remotion";
import { IntroScene } from "./components/IntroScene";
import { RankTransition } from "./components/RankTransition";
import { GameTitleCard } from "./components/GameTitleCard";
import { GameplaySection } from "./components/GameplaySection";
import {
  calculateSegments,
  styleConfig,
} from "./config";
import type { ContentConfig } from "./config";
import type { Top5Props } from "./schema";

export const Top5Video: React.FC<Top5Props & { content?: ContentConfig }> = (props) => {
  const data = props.content!;
  const segments = useMemo(() => calculateSegments(data), [data]);

  const allMediaSrcs = useMemo(() => {
    const srcs = new Set<string>();
    srcs.add(staticFile("BGM.mp3"));
    srcs.add(staticFile("background.jpg"));
    for (const game of data.games) {
      srcs.add(staticFile(`number/number_${game.rank}.mp3`));
      if (game.videoSrc) srcs.add(staticFile(game.videoSrc));
      if (game.clips) {
        for (const clip of game.clips) srcs.add(staticFile(clip.src));
      }
      if (game.voiceover) {
        for (const vo of game.voiceover) srcs.add(staticFile(vo.src));
      }
      if (game.brandVoiceover) {
        for (const bv of game.brandVoiceover) srcs.add(staticFile(bv.src));
      }
    }
    return [...srcs];
  }, [data]);

  useEffect(() => {
    const handles = allMediaSrcs.map((src) => prefetch(src, { method: "blob-url" }));
    return () => handles.forEach((h) => h.free());
  }, [allMediaSrcs]);

  const [fontReady, setFontReady] = useState(false);
  const [fontHandle] = useState(() => delayRender("Waiting for fonts to load"));
  useEffect(() => {
    const fontUrl = staticFile("fonts/SourceHanSansSC-Heavy.otf");
    const font = new FontFace("Source Han Sans SC", `url(${fontUrl})`, {
      weight: "900",
      style: "normal",
    });
    font
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        return document.fonts.ready;
      })
      .then(() => {
        setFontReady(true);
        continueRender(fontHandle);
      })
      .catch((err) => {
        console.error("Font load failed, continuing anyway:", err);
        setFontReady(true);
        continueRender(fontHandle);
      });
  }, [fontHandle]);

  const watermarkText = props.水印.内容;

  const statValueOverrides = [
    props.统计数字.第5名数值,
    props.统计数字.第4名数值,
    props.统计数字.第3名数值,
    props.统计数字.第2名数值,
    props.统计数字.第1名数值,
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: styleConfig.colors.globalBg,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      <Img
        src={staticFile("background.jpg")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />
      <style>{`
        @font-face {
          font-family: 'Source Han Sans SC';
          font-weight: 900;
          font-style: normal;
          font-display: block;
          src: url('${staticFile("fonts/SourceHanSansSC-Heavy.otf")}') format('opentype'),
               local('Source Han Sans SC Heavy'), local('SourceHanSansSC-Heavy'),
               local('思源黑体 CN Heavy'), local('思源黑体 Heavy');
        }
        @font-face {
          font-family: 'Noto Sans CJK SC';
          font-weight: 900;
          font-style: normal;
          font-display: block;
          src: local('Noto Sans CJK SC Black'), local('NotoSansCJKsc-Black'),
               local('Noto Sans SC Black'), local('NotoSansSC-Black');
        }
        @font-face {
          font-family: 'Noto Sans CJK TC';
          font-weight: 900;
          font-style: normal;
          font-display: block;
          src: local('Noto Sans CJK TC Black'), local('NotoSansCJKtc-Black'),
               local('Noto Sans TC Black'), local('NotoSansTC-Black');
        }
        @font-face {
          font-family: 'Poppins';
          font-weight: 900;
          font-style: normal;
          font-display: block;
          src: local('Poppins Black'), local('Poppins-Black'),
               local('Poppins ExtraBold'), local('Poppins-ExtraBold');
        }
        svg text {
          shape-rendering: geometricPrecision;
        }
      `}</style>
      <Audio src={staticFile("BGM.mp3")} volume={0.3} />
      {fontReady && segments.map((seg, idx) => {
        switch (seg.type) {
          case "intro":
            return (
              <Sequence
                key={`intro-${idx}`}
                from={seg.startFrame}
                durationInFrames={seg.durationFrames}
              >
                <IntroScene
                  titleLine1={data.titleLine1}
                  titleLine2={data.titleLine2}
                  watermark={watermarkText}
                  introFontSize={props.开场标题.字号}
                  introLineGap={props.开场标题.行间距}
                  introCharSpacing={props.开场标题.字间距系数}
                  introStrokeWidth={props.开场标题.描边粗细}
                  introCharHeight={props.开场标题.字符高度系数}
                  watermarkFontSize={props.水印.字号}
                />
              </Sequence>
            );

          case "rankTransition":
            return (
              <Sequence
                key={`rank-${idx}`}
                from={seg.startFrame}
                durationInFrames={seg.durationFrames}
              >
                <RankTransition
                  rank={data.games[seg.gameIndex!].rank}
                  watermark={watermarkText}
                  rankSvgSize={props.排名数字.容器尺寸}
                  rankFontSize={props.排名数字.数字字号}
                  rankOutlineStroke={props.排名数字.空心描边线宽}
                  rankFillStroke={props.排名数字.实心描边线宽}
                  rankSlideDistance={props.排名数字.滑入距离}
                  rankTrailPeak={props.排名数字.拖尾透明度}
                  watermarkFontSize={props.水印.字号}
                />
              </Sequence>
            );

          case "gameplay": {
            const ggi = seg.gameIndex!;
            const titleOverrides = [
              props.标题卡.第5名标题,
              props.标题卡.第4名标题,
              props.标题卡.第3名标题,
              props.标题卡.第2名标题,
              props.标题卡.第1名标题,
            ];
            const gameWithOverride = {
              ...data.games[ggi],
              titleEn: titleOverrides[ggi] || data.games[ggi].titleEn,
              stats: data.games[ggi].stats?.map((s, si) =>
                si === 0 && statValueOverrides[ggi]
                  ? { ...s, value: statValueOverrides[ggi] }
                  : s,
              ),
            };
            const titleOverlayDelay = Math.round(0.4 * data.fps);
            const titleOverlayDur = Math.round(1.5 * data.fps);
            return (
              <Sequence
                key={`gameplay-${idx}`}
                from={seg.startFrame}
                durationInFrames={seg.durationFrames}
              >
                <GameplaySection
                  game={gameWithOverride}
                  watermark={watermarkText}
                  subtitleFontSize={props.字幕.字号}
                  subtitleBottom={props.字幕.底部距离}
                  subtitleStrokeWidth={props.字幕.描边粗细}
                  statFontSizeOverride={props.统计数字.字号}
                  statSkewX={props.统计数字.倾斜角度}
                  statScaleX={props.统计数字.水平缩放}
                  statSpreadRatio={props.统计数字.扩散系数}
                  watermarkFontSize={props.水印.字号}
                />
                <Sequence
                  from={titleOverlayDelay}
                  durationInFrames={titleOverlayDur}
                  layout="none"
                >
                  <GameTitleCard
                    game={gameWithOverride}
                    watermark={watermarkText}
                    overlay
                    skewX={props.标题卡.倾斜角度}
                    scaleX={props.标题卡.水平缩放}
                    translateX={props.标题卡.水平偏移}
                    fontSizeMultiplier={props.标题卡.字号倍率}
                    charPaddingOverride={props.标题卡.字间距}
                    shadowOffsetXOverride={props.标题卡.阴影偏移X}
                    shadowOffsetYOverride={props.标题卡.阴影偏移Y}
                    glowMultiplier={props.标题卡.光晕强度}
                    redGlowRadius={props.标题卡.红色光晕半径}
                    watermarkFontSize={props.水印.字号}
                  />
                </Sequence>
              </Sequence>
            );
          }

          default:
            return null;
        }
      })}
    </AbsoluteFill>
  );
};
