import React from "react";
import { styleConfig } from "../config";

/**
 * 水印 — Canvas 2D 渲染 + 2x 超采样
 *
 * 样式参数来源: style.config.yaml → watermark
 */
const WM_SS = 2;

export const Watermark: React.FC<{
  text: string;
  width: number;
  fontSizeOverride?: number;
}> = ({ text, width, fontSizeOverride }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { fontSize: defaultFontSize, top, fillColor, strokeColor, strokeWidth } =
    styleConfig.watermark;
  const fontSize = fontSizeOverride ?? defaultFontSize;
  const fontFamily = styleConfig.fonts.watermark;

  const canvasW = text.length * fontSize * 0.7 + 60;
  const canvasH = fontSize * 2;

  React.useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const S = WM_SS;
    const W = canvasW * S;
    const H = canvasH * S;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;
    ctx.font = `900 ${fontSize * S}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 阴影 + 描边
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8 * S;
    ctx.shadowOffsetY = 5 * S;
    ctx.lineWidth = strokeWidth * S;
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    ctx.strokeText(text, cx, cy);
    ctx.restore();

    // 干净描边
    ctx.lineWidth = strokeWidth * S;
    ctx.lineJoin = "round";
    ctx.strokeStyle = strokeColor;
    ctx.strokeText(text, cx, cy);

    // 金色填充
    ctx.fillStyle = fillColor;
    ctx.fillText(text, cx, cy);
  }, [text, fontSize, fontFamily, canvasW, canvasH, fillColor, strokeColor, strokeWidth]);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 0,
        width,
        display: "flex",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasW * WM_SS}
        height={canvasH * WM_SS}
        style={{ width: canvasW, height: canvasH }}
      />
    </div>
  );
};
