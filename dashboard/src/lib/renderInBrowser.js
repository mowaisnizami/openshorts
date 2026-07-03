import { renderMediaOnWeb } from '@remotion/web-renderer';
import { ShortVideo } from '../remotion/compositions/ShortVideo';

let webcodecsSupported = null;

export async function supportsWebCodecsH264() {
  if (webcodecsSupported !== null) return webcodecsSupported;
  try {
    if (typeof VideoDecoder === 'undefined' || !VideoDecoder.isConfigSupported) {
      webcodecsSupported = false;
      return false;
    }
    const result = await VideoDecoder.isConfigSupported({
      codec: 'avc1.64001E',
      codedWidth: 640,
      codedHeight: 480,
    });
    webcodecsSupported = result.supported;
  } catch {
    webcodecsSupported = false;
  }
  return webcodecsSupported;
}

/** @returns {Promise<boolean>} */
export async function renderInBrowser({
  videoUrl,
  durationInSeconds = 30,
  subtitles = null,
  hook = null,
  effects = null,
  onProgress,
  signal
}) {
  const fps = 30;
  const durationInFrames = Math.max(1, Math.round(durationInSeconds * fps));

  const { getBlob } = await renderMediaOnWeb({
    composition: {
      component: ShortVideo,
      durationInFrames,
      fps,
      width: 1080,
      height: 1920,
      id: 'ShortVideo',
      calculateMetadata: null
    },
    inputProps: {
      videoUrl,
      durationInFrames,
      fps,
      width: 1080,
      height: 1920,
      subtitles,
      hook,
      effects
    },
    container: 'mp4',
    videoCodec: 'h264',
    videoBitrate: 'high',
    audioCodec: 'aac',
    onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined,
    signal,
    licenseKey: 'free-license',
    isProduction: false
  });

  const blob = await getBlob();
  return URL.createObjectURL(blob);
}

/**
 * Triggers a download of a blob URL as an MP4 file.
 */
export function downloadBlobUrl(blobUrl, filename = 'output.mp4') {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
