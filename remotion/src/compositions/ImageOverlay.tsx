import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import type { ImageOverlayConfig } from "../lib/types";

const SIZE_SCALE: Record<string, number> = {
  S: 0.15,
  M: 0.25,
  L: 0.4,
};

const getPositionStyle = (pos: number): React.CSSProperties => {
  return { top: `${100 - pos}%`, bottom: "auto" };
};

interface ImageBoxProps {
  config: ImageOverlayConfig;
  displayFrames: number;
}

const ENTRANCE_DURATION_FRAMES = 20;

const ImageBox: React.FC<ImageBoxProps> = ({ config, displayFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = SIZE_SCALE[config.size] ?? 0.25;
  const imageWidth = Math.round(width * scale);

  const entranceProgress = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.5,
    },
  });

  const fadeIn = interpolate(frame, [0, ENTRANCE_DURATION_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideUp = interpolate(
    frame,
    [0, ENTRANCE_DURATION_FRAMES],
    [50, 0],
    { extrapolateRight: "clamp" }
  );

  let animOpacity = config.opacity;
  let animScale = 1;
  let animTranslateY = 0;

  switch (config.entranceAnimation) {
    case "spring":
      animOpacity = config.opacity * entranceProgress;
      animScale = interpolate(entranceProgress, [0, 1], [0.5, 1]);
      break;
    case "fade":
      animOpacity = config.opacity * fadeIn;
      break;
    case "slide-up":
      animOpacity = config.opacity * fadeIn;
      animTranslateY = slideUp;
      break;
    case "none":
    default:
      break;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        ...getPositionStyle(config.position),
        opacity: animOpacity,
        transform: `scale(${animScale}) translateY(${animTranslateY}px)`,
      }}
    >
      <Img
        src={config.imageUrl}
        style={{
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

interface ImageOverlayProps {
  config: ImageOverlayConfig;
}

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
