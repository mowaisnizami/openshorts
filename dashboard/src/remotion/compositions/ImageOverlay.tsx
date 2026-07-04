import React from "react";
import { Img } from "remotion";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import type { ImageOverlayConfig } from "../lib/types";

interface ImageOverlayProps {
  config: ImageOverlayConfig;
}

const SIZE_SCALE: Record<string, number> = {
  S: 0.15,
  M: 0.25,
  L: 0.4,
};

const getPositionStyle = (pos: number): React.CSSProperties => {
  return { top: `${100 - pos}%`, bottom: "auto" };
};

export const ImageOverlay: React.FC<ImageOverlayProps> = ({ config }) => {
  const { fps } = useVideoConfig();
  const displayFrames = Math.round(config.displayDurationSec * fps);

  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={displayFrames} layout="none">
        <ImageBox config={config} displayFrames={displayFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};

interface ImageBoxProps {
  config: ImageOverlayConfig;
  displayFrames: number;
}

const ImageBox: React.FC<ImageBoxProps> = ({ config, displayFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = SIZE_SCALE[config.size] ?? 0.25;

  let animOpacity = 1;
  let animScale = 1;
  let animTranslateY = 0;

  switch (config.entranceAnimation) {
    case "spring": {
      const prog = spring({
        frame,
        fps,
        config: { mass: 0.8, stiffness: 200, damping: 15 },
        durationInFrames: 20,
      });
      animScale = interpolate(prog, [0, 1], [0.5, 1]);
      animOpacity = interpolate(prog, [0, 1], [0, 1]);
      break;
    }
    case "fade": {
      animOpacity = interpolate(frame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
      });
      break;
    }
    case "slide-up": {
      const prog = spring({
        frame,
        fps,
        config: { mass: 1, stiffness: 150, damping: 18 },
        durationInFrames: 20,
      });
      animTranslateY = interpolate(prog, [0, 1], [60, 0]);
      animOpacity = interpolate(prog, [0, 1], [0, 1]);
      break;
    }
    default:
      break;
  }

  const fadeOutStart = displayFrames - 15;
  if (frame > fadeOutStart) {
    animOpacity *= interpolate(frame, [fadeOutStart, displayFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  animOpacity *= config.opacity;

  const positionStyle = getPositionStyle(config.position);
  const imageWidth = Math.round(width * scale);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        ...positionStyle,
      }}
    >
      <Img
        src={config.imageUrl}
        style={{
          opacity: animOpacity,
          transform: `scale(${animScale}) translateY(${animTranslateY}px)`,
          width: imageWidth,
          height: "auto",
          borderRadius: 12,
          boxShadow: "3px 3px 12px rgba(0, 0, 0, 0.3)",
          objectFit: "contain",
        }}
      />
    </div>
  );
};
