import {
  ImageIcon,
  Loader2,
  Maximize,
  MoveVertical,
  Sparkles,
  Type,
  Video,
  X,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../config';
import RemotionPreview from './RemotionPreview';

const FONT_OPTIONS = [
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Impact', label: 'Impact' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Courier New', label: 'Courier New' }
];

const COLOR_PRESETS = [
  { color: '#FFFFFF', label: 'White' },
  { color: '#FFFF00', label: 'Yellow' },
  { color: '#00FFFF', label: 'Cyan' },
  { color: '#00FF00', label: 'Green' },
  { color: '#FF0000', label: 'Red' },
  { color: '#FF69B4', label: 'Pink' }
];

const ANIMATION_OPTIONS = [
  { value: 'pop', label: 'Pop' },
  { value: 'word-highlight', label: 'Glow' },
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'none', label: 'None' }
];

export default function SubtitleModal({
  isOpen,
  onClose,
  videoUrl,
  jobId,
  clipIndex,
  existingHookConfig,
  initialHookText,
  onGenerateBackend,
  isBackendProcessing
}) {
  const [position, setPosition] = useState(0);
  const [fontSize, setFontSize] = useState(24);
  const [fontName, setFontName] = useState('Verdana');
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('#FFDD00');
  const [borderColor, setBorderColor] = useState('#000000');
  const [borderWidth, setBorderWidth] = useState(2);
  const [bgColor, setBgColor] = useState('#000000');
  const [bgOpacity, setBgOpacity] = useState(0.0);
  const [animation, setAnimation] = useState('pop');
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [subtitleEnabled, setSubtitleEnabled] = useState(true);
  const [hookEnabled, setHookEnabled] = useState(false);

  // Remotion preview state
  const [captions, setCaptions] = useState([]);
  const [originalCaptions, setOriginalCaptions] = useState([]);
  const [editableText, setEditableText] = useState('');
  const [durationSec, setDurationSec] = useState(30);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [useRemotionPreview, setUseRemotionPreview] = useState(false);

  // Hook state
  const [hookText, setHookText] = useState('');
  const [hookPosition, setHookPosition] = useState(0);
  const [hookSize, setHookSize] = useState('M');
  const [hookEntranceAnimation, setHookEntranceAnimation] = useState('spring');
  const [hookDisplayDuration, setHookDisplayDuration] = useState(5);

  // Image overlay state
  const [imageEnabled, setImageEnabled] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imagePosition, setImagePosition] = useState('top');
  const [imageSize, setImageSize] = useState('M');
  const [imageEntranceAnimation, setImageEntranceAnimation] =
    useState('spring');
  const [imageDisplayDuration, setImageDisplayDuration] = useState(5);
  const [imageOpacity, setImageOpacity] = useState(1.0);

  // Initialize hook state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHookText(
        existingHookConfig?.text ||
          initialHookText ||
          'POV: You are using the viral hook feature'
      );
      setHookPosition(existingHookConfig?.position || 0);
      setHookSize(existingHookConfig?.size || 'M');
      setHookEntranceAnimation(
        existingHookConfig?.entranceAnimation || 'spring'
      );
      setHookDisplayDuration(existingHookConfig?.displayDurationSec || 5);
    }
  }, [isOpen, existingHookConfig, initialHookText]);

  // Fetch word-level captions when modal opens
  useEffect(() => {
    if (!isOpen || !jobId || clipIndex === undefined) return;

    setCaptionsLoading(true);
    fetch(getApiUrl(`/api/clip/${jobId}/${clipIndex}/transcript`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.captions && data.captions.length > 0) {
          setCaptions(data.captions);
          setOriginalCaptions(data.captions);
          setEditableText(data.captions.map((c) => c.text).join(' '));
          setDurationSec(data.durationSec || 30);
          setUseRemotionPreview(true);
        } else {
          setUseRemotionPreview(false);
        }
      })
      .catch(() => setUseRemotionPreview(false))
      .finally(() => setCaptionsLoading(false));
  }, [isOpen, jobId, clipIndex]);

  // When user edits text, redistribute words across original timestamps
  const handleTextEdit = (newText) => {
    setEditableText(newText);
    const newWords = newText.split(/\s+/).filter((w) => w.length > 0);
    if (newWords.length === 0 || originalCaptions.length === 0) {
      setCaptions([]);
      return;
    }

    // Distribute new words across the time span of original captions
    const totalDurationMs =
      originalCaptions[originalCaptions.length - 1].endMs -
      originalCaptions[0].startMs;
    const startMs = originalCaptions[0].startMs;
    const wordDurationMs = totalDurationMs / newWords.length;

    const newCaptions = newWords.map((word, i) => ({
      text: word,
      startMs: Math.round(startMs + i * wordDurationMs),
      endMs: Math.round(startMs + (i + 1) * wordDurationMs)
    }));
    setCaptions(newCaptions);
  };

  if (!isOpen) return null;

  // Read image as base64 data URL for backend
  const readImageAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Build subtitle config for Remotion
  const subtitleConfig = subtitleEnabled
    ? {
        captions,
        position,
        style: {
          fontFamily: fontName,
          fontSize: fontSize * 2.2,
          fontColor,
          highlightColor,
          borderColor,
          borderWidth: borderWidth * 1.5,
          bgColor,
          bgOpacity,
          animation
        }
      }
    : null;

  const hookConfig =
    hookEnabled && hookText
      ? {
          text: hookText,
          position: hookPosition,
          size: hookSize,
          entranceAnimation: hookEntranceAnimation,
          displayDurationSec: hookDisplayDuration
        }
      : null;

  const imageOverlayConfig =
    imageEnabled && imagePreviewUrl
      ? {
          imageUrl: imagePreviewUrl,
          position: imagePosition,
          size: imageSize,
          entranceAnimation: imageEntranceAnimation,
          displayDurationSec: imageDisplayDuration,
          opacity: imageOpacity
        }
      : null;

  // Fallback: static CSS preview (same as original)
  const bw = Math.max(borderWidth, 0);
  const bc = borderColor;
  const outlineShadow =
    bw > 0
      ? [
          `-${bw}px -${bw}px 0 ${bc}`,
          `${bw}px -${bw}px 0 ${bc}`,
          `-${bw}px ${bw}px 0 ${bc}`,
          `${bw}px ${bw}px 0 ${bc}`,
          `0 -${bw}px 0 ${bc}`,
          `0 ${bw}px 0 ${bc}`,
          `-${bw}px 0 0 ${bc}`,
          `${bw}px 0 0 ${bc}`
        ].join(', ')
      : 'none';

  const fallbackPreviewStyle = {
    fontFamily: fontName,
    color: fontColor,
    fontSize: '20px',
    fontWeight: 'bold',
    maxWidth: '85%',
    padding: '6px 12px',
    borderRadius: '4px',
    textAlign: 'center',
    lineHeight: '1.3',
    ...(bgOpacity > 0
      ? {
          backgroundColor: `${bgColor}${Math.round(bgOpacity * 255)
            .toString(16)
            .padStart(2, '0')}`,
          textShadow: 'none'
        }
      : { textShadow: outlineShadow })
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#121214] border border-white/10 p-6 rounded-2xl w-full max-w-5xl shadow-2xl relative flex flex-col md:flex-row gap-6 max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10"
        >
          <X size={20} />
        </button>

        {/* Left: Preview */}
        <div className="flex-1 flex flex-col items-center justify-center bg-black rounded-lg border border-white/5 overflow-hidden relative aspect-[9/16] max-h-[600px]">
          {captionsLoading ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading preview...</span>
            </div>
          ) : useRemotionPreview ? (
            <RemotionPreview
              videoUrl={videoUrl}
              durationInSeconds={durationSec}
              subtitles={subtitleConfig}
              hook={hookConfig}
              imageOverlay={imageOverlayConfig}
            />
          ) : (
            <>
              <video
                src={videoUrl}
                className="w-full h-full object-contain opacity-50"
                muted
                playsInline
              />
              <div
                className="absolute w-full px-8 text-center transition-all duration-300 pointer-events-none flex flex-col items-center justify-center"
                style={{ top: `${100 - position}%` }}
              >
                <span style={fallbackPreviewStyle}>
                  This is how your subtitles
                  <br />
                  will appear on the video
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-80 flex flex-col">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 shrink-0">
            <Type className="text-primary" /> Auto Subtitles
            <label className="relative inline-flex items-center cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={subtitleEnabled}
                onChange={(e) => setSubtitleEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </h3>

          <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-1">
            {subtitleEnabled && (
              <>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Position: {position} (0 = Bottom, 100 = Top)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={position}
                    onChange={(e) => setPosition(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Bottom</span>
                    <span>Top</span>
                  </div>
                </div>

                {/* Animation Style (new) */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Animation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ANIMATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAnimation(opt.value)}
                        className={`p-2 rounded-lg border text-center text-xs font-medium transition-all ${animation === opt.value ? 'bg-primary/20 border-primary text-white' : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable Transcript (collapsible) */}
                {useRemotionPreview && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTextEditor(!showTextEditor)}
                      className="w-full flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2"
                    >
                      <span>Edit Text ({captions.length} words)</span>
                      <span
                        className={`transition-transform ${showTextEditor ? 'rotate-180' : ''}`}
                      >
                        ▾
                      </span>
                    </button>
                    {showTextEditor && (
                      <textarea
                        value={editableText}
                        onChange={(e) => handleTextEdit(e.target.value)}
                        rows={5}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-primary/50 resize-none leading-relaxed animate-[fadeIn_0.15s_ease-out]"
                        placeholder="Edit subtitle text..."
                      />
                    )}
                  </div>
                )}

                {/* Font Family */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Font
                  </label>
                  <select
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option
                        key={f.value}
                        value={f.value}
                        style={{ fontFamily: f.value }}
                      >
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Text Color */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Text Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.color}
                        onClick={() => setFontColor(c.color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${fontColor === c.color ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'}`}
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                    <label
                      className="w-7 h-7 rounded-full border-2 border-dashed border-white/20 cursor-pointer flex items-center justify-center hover:border-white/50 transition-all overflow-hidden relative"
                      title="Custom color"
                    >
                      <span className="text-[10px] text-zinc-400">+</span>
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Highlight Color (new) */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Highlight Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { color: '#FFDD00', label: 'Gold' },
                      { color: '#FF4444', label: 'Red' },
                      { color: '#00FF88', label: 'Green' },
                      { color: '#00BBFF', label: 'Blue' },
                      { color: '#FF69B4', label: 'Pink' }
                    ].map((c) => (
                      <button
                        key={c.color}
                        onClick={() => setHighlightColor(c.color)}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${highlightColor === c.color ? 'border-white scale-110' : 'border-white/20 hover:border-white/50'}`}
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Border / Outline */}
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                    Border
                  </label>
                  <div className="flex items-center gap-3">
                    <label
                      className="relative w-8 h-8 rounded-lg border border-white/10 cursor-pointer overflow-hidden shrink-0"
                      title="Border color"
                    >
                      <div
                        className="w-full h-full"
                        style={{ backgroundColor: borderColor }}
                      />
                      <input
                        type="color"
                        value={borderColor}
                        onChange={(e) => setBorderColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                    <div className="flex-1">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={borderWidth}
                        onChange={(e) =>
                          setBorderWidth(parseInt(e.target.value))
                        }
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span>None</span>
                        <span>Thick</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Background Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                      Background Box
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bgOpacity > 0}
                        onChange={(e) =>
                          setBgOpacity(e.target.checked ? 0.5 : 0)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  {bgOpacity > 0 && (
                    <div className="space-y-3 animate-[fadeIn_0.2s_ease-out]">
                      <div className="flex items-center gap-3">
                        <label
                          className="relative w-8 h-8 rounded-lg border border-white/10 cursor-pointer overflow-hidden shrink-0"
                          title="Background color"
                        >
                          <div
                            className="w-full h-full"
                            style={{ backgroundColor: bgColor }}
                          />
                          <input
                            type="color"
                            value={bgColor}
                            onChange={(e) => setBgColor(e.target.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </label>
                        <div className="flex-1">
                          <input
                            type="range"
                            min="10"
                            max="100"
                            value={Math.round(bgOpacity * 100)}
                            onChange={(e) =>
                              setBgOpacity(parseInt(e.target.value) / 100)
                            }
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-[10px] text-zinc-500">
                            <span>Transparent</span>
                            <span>{Math.round(bgOpacity * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* --- Viral Hook Section --- */}
            <div className="border-t border-white/10 pt-5">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles size={16} className="text-yellow-400" /> Viral Hook
                <label className="relative inline-flex items-center cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={hookEnabled}
                    onChange={(e) => setHookEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </h4>
              {hookEnabled && (
                <div className="space-y-5">
                  {/* Hook Text Input */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 block">
                      Text
                    </label>
                    <textarea
                      value={hookText}
                      onChange={(e) => setHookText(e.target.value)}
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white placeholder-zinc-600 focus:outline-none focus:border-yellow-500/50 resize-none font-serif"
                      placeholder="Enter text that will stop the scroll..."
                    />
                  </div>

                  {/* Hook Position */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Position: {hookPosition} (0 = Bottom, 100 = Top)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={hookPosition}
                      onChange={(e) =>
                        setHookPosition(parseInt(e.target.value))
                      }
                      className="w-full accent-yellow-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Bottom</span>
                      <span>Top</span>
                    </div>
                  </div>

                  {/* Hook Size */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Maximize size={12} /> Size
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['S', 'M', 'L'].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setHookSize(sz)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                            hookSize === sz
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {sz === 'S'
                            ? 'Small'
                            : sz === 'M'
                              ? 'Medium'
                              : 'Large'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hook Entrance Animation */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap size={12} /> Entrance
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'spring', label: 'Bounce' },
                        { value: 'fade', label: 'Fade' },
                        { value: 'slide-up', label: 'Slide Up' },
                        { value: 'none', label: 'None' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setHookEntranceAnimation(opt.value)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                            hookEntranceAnimation === opt.value
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hook Display Duration */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Duration: {hookDisplayDuration}s
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      value={hookDisplayDuration}
                      onChange={(e) =>
                        setHookDisplayDuration(parseInt(e.target.value))
                      }
                      className="w-full accent-yellow-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>2s</span>
                      <span>15s</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- Image Overlay Section --- */}
            <div className="border-t border-white/10 pt-5">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ImageIcon size={16} className="text-green-400" /> Image / Logo
                <label className="relative inline-flex items-center cursor-pointer ml-auto">
                  <input
                    type="checkbox"
                    checked={imageEnabled}
                    onChange={(e) => {
                      setImageEnabled(e.target.checked);
                      if (!e.target.checked) setImageFile(null);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </h4>
              {imageEnabled && (
                <div className="space-y-5">
                  {/* Image Upload */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 block">
                      Upload Image
                    </label>
                    {imagePreviewUrl ? (
                      <div className="relative mb-3">
                        <img
                          src={imagePreviewUrl}
                          alt="Overlay preview"
                          className="w-full max-h-32 object-contain rounded-lg border border-white/10"
                        />
                        <button
                          onClick={() => {
                            setImageFile(null);
                            setImagePreviewUrl(null);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-green-500/50 transition-colors bg-black/20">
                        <ImageIcon size={24} className="text-zinc-500 mb-1" />
                        <span className="text-xs text-zinc-500">
                          Click to upload (PNG, JPG)
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setImageFile(file);
                              setImagePreviewUrl(URL.createObjectURL(file));
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Image Position */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <MoveVertical size={12} /> Position
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['top', 'center', 'bottom'].map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setImagePosition(pos)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold capitalize transition-all border ${
                            imagePosition === pos
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Size */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Maximize size={12} /> Size
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['S', 'M', 'L'].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setImageSize(sz)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                            imageSize === sz
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {sz === 'S'
                            ? 'Small'
                            : sz === 'M'
                              ? 'Medium'
                              : 'Large'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Entrance Animation */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap size={12} /> Entrance
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'spring', label: 'Bounce' },
                        { value: 'fade', label: 'Fade' },
                        { value: 'slide-up', label: 'Slide Up' },
                        { value: 'none', label: 'None' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setImageEntranceAnimation(opt.value)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border ${
                            imageEntranceAnimation === opt.value
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Image Display Duration */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Duration: {imageDisplayDuration}s
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="15"
                      value={imageDisplayDuration}
                      onChange={(e) =>
                        setImageDisplayDuration(parseInt(e.target.value))
                      }
                      className="w-full accent-green-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>2s</span>
                      <span>15s</span>
                    </div>
                  </div>

                  {/* Image Opacity */}
                  <div>
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Opacity: {Math.round(imageOpacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={Math.round(imageOpacity * 100)}
                      onChange={(e) =>
                        setImageOpacity(parseInt(e.target.value) / 100)
                      }
                      className="w-full accent-green-500"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>10%</span>
                      <span>100%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/*
                    <button
                        onClick={() => onGenerate({
                            position, fontSize, fontName, fontColor, borderColor, borderWidth, bgColor, bgOpacity,
                            remotion: useRemotionPreview ? subtitleConfig : null,
                        })}
                        disabled={isProcessing}
                        className="w-full py-3 mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0"
                    >
                        {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Type size={20} />}
                        {isProcessing ? 'Generating...' : 'Generate Subtitles'}
                    </button>
                    */}

          <button
            onClick={async () => {
              let imageData = null;
              if (imageEnabled && imageFile) {
                try {
                  imageData = await readImageAsDataUrl(imageFile);
                } catch (e) {
                  console.warn('Failed to read image:', e);
                }
              }
              onGenerateBackend({
                position,
                fontSize,
                fontName,
                fontColor,
                highlightColor,
                borderColor,
                borderWidth,
                bgColor,
                bgOpacity,
                animation,
                ...(subtitleEnabled ? {} : { skip_subtitles: true }),
                hook_text: hookEnabled ? hookText || null : null,
                hook_position: hookPosition,
                hook_size: hookSize,
                hook_entrance_animation: hookEntranceAnimation,
                hook_display_duration: hookDisplayDuration,
                image_overlay_data: imageData,
                image_position: imagePosition,
                image_size: imageSize,
                image_entrance_animation: imageEntranceAnimation,
                image_display_duration: imageDisplayDuration,
                image_opacity: imageOpacity
              });
            }}
            disabled={isBackendProcessing}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shrink-0"
          >
            {isBackendProcessing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Video size={20} />
            )}
            {isBackendProcessing
              ? 'Rendering...'
              : 'Render on Backend (Remotion)'}
          </button>
        </div>
      </div>
    </div>
  );
}
