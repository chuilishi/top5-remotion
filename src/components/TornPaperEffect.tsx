import React, { useMemo } from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { styleConfig } from "../config";

/**
 * 撕裂纸张效果 — 精致版
 *
 * 样式参数来源: style.config.yaml → tornPaper
 */
export const TornPaperEffect: React.FC<{
  width: number;
  height: number;
  progress?: number;
  seed?: number;
}> = ({ width, height, progress = 1, seed = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tp = styleConfig.tornPaper;

  const tearHeight = interpolate(progress, [0, 1], [0, height * tp.tearHeightRatio], {
    extrapolateRight: "clamp",
  });

  const centerY = height * 0.5;

  const paths = useMemo(() => {
    const rand = (i: number, s: number) => {
      const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    const steps = tp.edgeSteps;
    const stepX = width / steps;
    const amp = tp.edgeAmplitude;

    const generateEdgePoints = (baseY: number, s: number) => {
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= steps; i++) {
        const x = i * stepX;
        const low =
          Math.sin(i * 0.15 + s * 1.3) * amp * 0.55 +
          Math.sin(i * 0.08 + s * 2.7) * amp * 0.35;
        const high =
          Math.sin(i * 0.9 + s * 5.1) * amp * 0.22 +
          Math.sin(i * 2.3 + s * 3.3) * amp * 0.12;
        const spike =
          rand(i, s) > 0.88 ? (rand(i + 1, s) - 0.5) * amp * 0.7 : 0;
        const fiber =
          rand(i * 3, s + 7) > 0.75 ? (rand(i * 3 + 1, s + 7) - 0.5) * amp * 0.2 : 0;
        const y = baseY + low + high + spike + fiber;
        points.push({ x, y });
      }
      return points;
    };

    const topY = centerY - tearHeight / 2;
    const bottomY = centerY + tearHeight / 2;

    const topPts = generateEdgePoints(topY, seed);
    const bottomPts = generateEdgePoints(bottomY, seed + 10);

    const topPaperPts = topPts.map((p, i) => ({
      x: p.x,
      y: p.y + 5.6 + rand(i, seed * 2) * 9,
    }));
    const bottomPaperPts = bottomPts.map((p, i) => ({
      x: p.x,
      y: p.y - 5.6 - rand(i, seed * 3) * 9,
    }));

    const toD = (pts: Array<{ x: number; y: number }>) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    const toDReverse = (pts: Array<{ x: number; y: number }>) => {
      const rev = [...pts].reverse();
      return rev.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    };

    const topMaskD = `M0,0 L${width},0 L${width},${topY + 34} ${toDReverse(topPts)} L0,${topY + 34} Z`;
    const bottomMaskD = `${toD(bottomPts)} L${width},${height} L0,${height} Z`;
    const topEdgeD = `${toD(topPts)} ${toDReverse(topPaperPts)} Z`;
    const bottomEdgeD = `${toD(bottomPts)} ${toDReverse(bottomPaperPts)} Z`;
    const topInnerLine = toD(topPaperPts);
    const bottomInnerLine = toD(bottomPaperPts);

    return { topMaskD, bottomMaskD, topEdgeD, bottomEdgeD, topInnerLine, bottomInnerLine };
  }, [width, height, tearHeight, centerY, seed, tp.edgeSteps, tp.edgeAmplitude]);

  if (tearHeight < 1) return null;

  const topTearY = centerY - tearHeight / 2;
  const uid = `t${seed}`;

  // 极轻微的呼吸 — 红色亮度在 0.97~1.03 之间波动
  const t = frame / fps;
  const breathe = 1.0 + 0.03 * Math.sin(t * 1.8);

  // 从配置读取裂缝渐变色
  const crackColors = tp.crackGradientColors;
  const crackStops = [
    { offset: "0%",   color: crackColors[0] ?? "#5a0000" },
    { offset: "20%",  color: crackColors[1] ?? "#200808" },
    { offset: "45%",  color: crackColors[2] ?? "#3a0505" },
    { offset: "55%",  color: crackColors[3] ?? "#1a0404" },
    { offset: "80%",  color: crackColors[4] ?? "#2a0808" },
    { offset: "100%", color: crackColors[5] ?? "#5a0000" },
  ];

  // 纸张边缘色
  const etColors = tp.edgeTopColors;
  const ebColors = tp.edgeBottomColors;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", top: 0, left: 0, zIndex: 20 }}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
          {crackStops.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>

        <linearGradient id={`et-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={etColors[0] ?? "#7a756a"} />
          <stop offset="35%"  stopColor={etColors[1] ?? "#a8a090"} />
          <stop offset="65%"  stopColor={etColors[2] ?? "#bab2a2"} />
          <stop offset="100%" stopColor={etColors[3] ?? "#8a8575"} />
        </linearGradient>

        <linearGradient id={`eb-${uid}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor={ebColors[0] ?? "#7a756a"} />
          <stop offset="35%"  stopColor={ebColors[1] ?? "#a8a090"} />
          <stop offset="65%"  stopColor={ebColors[2] ?? "#bab2a2"} />
          <stop offset="100%" stopColor={ebColors[3] ?? "#8a8575"} />
        </linearGradient>

        {/* 柔和投影 */}
        <filter id={`ds-${uid}`}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={tp.shadowBlur} result="blur" />
          <feOffset dy={tp.shadowOffset} result="offset" />
          <feFlood floodColor="#000" floodOpacity={tp.shadowOpacity} />
          <feComposite in2="offset" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`dsu-${uid}`}>
          <feGaussianBlur in="SourceAlpha" stdDeviation={tp.shadowBlur} result="blur" />
          <feOffset dy={-tp.shadowOffset} result="offset" />
          <feFlood floodColor="#000" floodOpacity={tp.shadowOpacity} />
          <feComposite in2="offset" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 纸面噪声纹理 */}
        <filter id={`ptex-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="4" seed={42} />
          <feColorMatrix type="saturate" values="0" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
      </defs>

      {/* 裂缝红色背景 */}
      <rect
        x={0} y={topTearY - 56}
        width={width} height={tearHeight + 112}
        fill={`url(#bg-${uid})`}
        opacity={breathe}
      />

      {/* 动漫角色剪影 */}
      <g opacity={0.88}>
        <rect x={0} y={topTearY} width={width * 0.15} height={tearHeight} fill="#5a0000" opacity={0.7} />
        <rect x={width * 0.7} y={topTearY} width={width * 0.3} height={tearHeight} fill="#6b0000" opacity={0.8} />
        <ellipse cx={width * 0.42} cy={centerY - tearHeight * 0.08} rx={width * 0.07} ry={tearHeight * 0.32} fill="#080205" />
        <path d={`M${width * 0.46},${centerY - tearHeight * 0.38} Q${width * 0.56},${centerY - tearHeight * 0.42} ${width * 0.6},${centerY - tearHeight * 0.18} Q${width * 0.57},${centerY - tearHeight * 0.05} ${width * 0.48},${centerY + tearHeight * 0.02} Q${width * 0.44},${centerY - tearHeight * 0.12} ${width * 0.46},${centerY - tearHeight * 0.38}`} fill="#080205" />
        <path d={`M${width * 0.38},${centerY - tearHeight * 0.35} Q${width * 0.28},${centerY - tearHeight * 0.28} ${width * 0.26},${centerY} Q${width * 0.3},${centerY + tearHeight * 0.08} ${width * 0.36},${centerY + tearHeight * 0.02} Q${width * 0.37},${centerY - tearHeight * 0.12} ${width * 0.38},${centerY - tearHeight * 0.35}`} fill="#080205" />
        <ellipse cx={width * 0.49} cy={centerY - tearHeight * 0.04} rx={29} ry={16} fill="#2a2018" />
        <ellipse cx={width * 0.49} cy={centerY - tearHeight * 0.04} rx={16} ry={11} fill="#8a7a68" opacity={0.65} />
        <ellipse cx={width * 0.49} cy={centerY - tearHeight * 0.04} rx={8} ry={8} fill="#100a05" />
        <circle cx={width * 0.495} cy={centerY - tearHeight * 0.07} r={4} fill="#c8c0b0" opacity={0.55} />
        <path d={`M${width * 0.3},${centerY + tearHeight * 0.12} Q${width * 0.36},${centerY + tearHeight * 0.05} ${width * 0.42},${centerY + tearHeight * 0.18} L${width * 0.52},${centerY + tearHeight * 0.18} Q${width * 0.58},${centerY + tearHeight * 0.08} ${width * 0.62},${centerY + tearHeight * 0.22} L${width * 0.55},${centerY + tearHeight * 0.48} L${width * 0.33},${centerY + tearHeight * 0.48} Z`} fill="#080205" opacity={0.75} />
      </g>

      {/* 上方纸张 */}
      <path d={paths.topMaskD} fill="#000" filter={`url(#ds-${uid})`} />
      <path d={paths.topMaskD} fill="rgba(30,28,26,0.08)" filter={`url(#ptex-${uid})`} />
      <path d={paths.topEdgeD} fill={`url(#et-${uid})`} opacity={0.7} />

      {/* 下方纸张 */}
      <path d={paths.bottomMaskD} fill="#000" filter={`url(#dsu-${uid})`} />
      <path d={paths.bottomMaskD} fill="rgba(30,28,26,0.08)" filter={`url(#ptex-${uid})`} />
      <path d={paths.bottomEdgeD} fill={`url(#eb-${uid})`} opacity={0.7} />

      {/* 边缘线 */}
      <path d={paths.topInnerLine} fill="none" stroke={tp.edgeLineColor} strokeWidth={tp.edgeLineWidth} />
      <path d={paths.bottomInnerLine} fill="none" stroke={tp.edgeLineColor} strokeWidth={tp.edgeLineWidth} />
    </svg>
  );
};
