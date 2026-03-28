// ⚠️ 此文件由 scripts/build-config.mjs 自动生成
// ⚠️ 请勿手动编辑 — 修改 style.config.yaml 后运行 npm run config
//
// 生成时间: 2026-03-28T05:34:12.211Z

import type { StyleConfig } from "./types";

const styleConfig: StyleConfig = {
  "fonts": {
    "title": "'Source Han Sans SC', 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Poppins', 'Helvetica Neue', sans-serif",
    "subtitle": "'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Poppins', 'Helvetica Neue', sans-serif",
    "stat": "'Poppins', 'Noto Sans CJK SC', 'Helvetica Neue', sans-serif",
    "watermark": "'Poppins', 'Noto Sans CJK SC', 'Helvetica Neue', sans-serif"
  },
  "colors": {
    "globalBg": "#000",
    "fallbackBg": "linear-gradient(135deg, #0a0a1a, #1a1a2e, #0f3460)",
    "goldGradient": [
      {
        "offset": "0%",
        "color": "#ffe640"
      },
      {
        "offset": "40%",
        "color": "#ffd700"
      },
      {
        "offset": "100%",
        "color": "#ffe000"
      }
    ],
    "glowColor": "#FFD700",
    "statGlowColor": "rgb(255, 40, 20)",
    "goldStroke": "#000000"
  },
  "subtitle": {
    "fontSize": 86,
    "bottom": 68,
    "color": "#FFFFFF",
    "strokeWidth": 16,
    "strokeColor": "#000",
    "textShadow": "0 5px 14px rgba(0,0,0,1), 0 0 32px rgba(0,0,0,0.7), 5px 5px 18px rgba(0,0,0,0.8)",
    "padding": "0",
    "bgColor": "transparent"
  },
  "statNumber": {
    "fontSize": 162,
    "spreadRatio": 0.29,
    "strokeWidth": 22,
    "charWidthRatios": {
      "digit": 0.58,
      "comma": 0.32,
      "plusMinus": 0.5,
      "dot": 0.28
    },
    "charSpreadWeights": {
      "digit": 1,
      "comma": 0.35,
      "plusMinus": 0.55,
      "dot": 0.3
    }
  },
  "watermark": {
    "fontSize": 42,
    "top": 36,
    "fillColor": "#FFD700",
    "strokeColor": "#000",
    "strokeWidth": 8
  },
  "rankNumber": {
    "svgSize": 630,
    "fontSize": 540,
    "lineSpacing": 63,
    "lineStrokeWidth": 7,
    "goldStrokeWidth": 7
  },
  "kenBurns": {
    "zoomRange": [
      1,
      1.08
    ],
    "panXRange": [
      0,
      -34
    ]
  },
  "cinematic": {
    "intro": {
      "grain": 0.035,
      "vignette": 0.2
    },
    "rankTransition": {
      "grain": 0.035,
      "vignette": 0.25
    },
    "titleCard": {
      "grain": 0.03,
      "vignette": 0.2
    },
    "gameplay": {
      "grain": 0.025,
      "vignette": 0.15
    }
  },
  "intro": {
    "fontSizeRatio": 0.175,
    "fontSizeMax": 338,
    "lineGapRatio": 0.005,
    "spreadRatio": 0.18,
    "shuffleSeed": 42,
    "delayBase": 2,
    "delayInterval": 1.5,
    "strokeWidth": 14,
    "shadowOffsetX": 7,
    "shadowOffsetY": 9
  },
  "titleCard": {
    "fontSizeBreakpoints": [
      [
        4,
        0.2,
        326
      ],
      [
        8,
        0.145,
        248
      ],
      [
        12,
        0.11,
        202
      ],
      [
        Infinity,
        0.085,
        153
      ]
    ],
    "delayBase": 5,
    "delayInterval": -1,
    "charPadding": 0.14,
    "strokeWidth": 34,
    "shadowOffsetX": 7,
    "shadowOffsetY": 9
  }
};

export default styleConfig;
