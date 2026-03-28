import React from "react";
import { AbsoluteFill } from "remotion";

interface ChromaticAberrationProps {
  children: React.ReactNode;
  offset: number;
}

export const ChromaticAberration: React.FC<ChromaticAberrationProps> = ({
  children,
  offset,
}) => {
  const filterId = `chromatic-aberration-${Math.abs(offset)}`;

  if (offset === 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  return (
    <AbsoluteFill>
      <svg
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              in="SourceGraphic"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="red"
            />
            <feOffset in="red" dx={-offset} dy={0} result="redShifted" />
            <feColorMatrix
              type="matrix"
              in="SourceGraphic"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="green"
            />
            <feColorMatrix
              type="matrix"
              in="SourceGraphic"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blue"
            />
            <feOffset in="blue" dx={offset} dy={0} result="blueShifted" />
            <feBlend
              mode="screen"
              in="redShifted"
              in2="green"
              result="rg"
            />
            <feBlend mode="screen" in="rg" in2="blueShifted" />
          </filter>
        </defs>
      </svg>
      <AbsoluteFill style={{ filter: `url(#${filterId})` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
