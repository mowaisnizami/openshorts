import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Grid3x3,
  Instagram,
  Languages,
  Loader2,
  MoreVertical,
  Share2,
  Trash2,
  Type,
  Video,
  Wand2,
  X,
  Youtube
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../config';
import { renderInBrowser, supportsWebCodecsH264 } from '../lib/renderInBrowser';
// import HookModal from './HookModal';
import SubtitleModal from './SubtitleModal';
import TranslateModal from './TranslateModal';

export default function ResultCard({
  clip,
  index,
  jobId,
  uploadPostKey,
  uploadUserId,
  geminiApiKey,
  elevenLabsKey,
  onPlay,
  onPause,
  showActions = true,
  onNewClip,
  onClipDeleted
}) {
  const [showModal, setShowModal] = useState(false);
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  const videoRef = React.useRef(null);
  const originalVideoUrl = clip.video_url ? getApiUrl(clip.video_url) : null; // Never changes — used for Remotion previews
  const [currentVideoUrl, setCurrentVideoUrl] = useState(originalVideoUrl);

  const [platforms, setPlatforms] = useState({
    tiktok: true,
    instagram: true,
    youtube: true
  });
  const [postTitle, setPostTitle] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');

  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSubtitling, setIsSubtitling] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  // const [isHooking, setIsHooking] = useState(false);
  // const [showHookModal, setShowHookModal] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [editError, setEditError] = useState(null);

  const [clipDuration, setClipDuration] = useState(
    clip.end && clip.start ? clip.end - clip.start : 30
  );

  // Accumulate Remotion layers across operations
  const [activeLayers, setActiveLayers] = useState({
    subtitles: null,
    hook: null,
    effects: null
  });

  // Fetch clip duration from transcript endpoint
  useEffect(() => {
    if (!jobId || index === undefined) return;
    fetch(getApiUrl(`/api/clip/${jobId}/${index}/transcript`))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.durationSec) setClipDuration(data.durationSec);
      })
      .catch(() => {});
  }, [jobId, index]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleCopy = useCallback(async () => {
    const title = clip.video_title_for_youtube_short || '';
    const caption = clip.video_description_for_tiktok ||
      clip.video_description_for_instagram || '';
    const text = title + (caption ? `\n\n${caption}` : '');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    setShowMenu(false);
  }, [clip]);

  const handleDeleteVideoOnly = useCallback(async () => {
    setShowMenu(false);
    if (!confirm('Delete video file only? The clip metadata (title, captions) will be preserved.')) return;
    try {
      const res = await fetch(getApiUrl(`/api/creations/${jobId}/clips/${index}/video`), {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete video');
      onClipDeleted?.(jobId, index, 'video');
    } catch (err) {
      alert('Failed to delete video: ' + err.message);
    }
  }, [jobId, index, onClipDeleted]);

  const handleDeleteClip = useCallback(async () => {
    setShowMenu(false);
    if (!confirm('Delete this clip entirely? The video file and all metadata will be removed.')) return;
    try {
      const res = await fetch(getApiUrl(`/api/creations/${jobId}/clips/${index}`), {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete clip');
      onClipDeleted?.(jobId, index, 'clip');
    } catch (err) {
      alert('Failed to delete clip: ' + err.message);
    }
  }, [jobId, index, onClipDeleted]);

  // Initialize/Reset form when modal opens
  useEffect(() => {
    if (showModal) {
      setPostTitle(clip.video_title_for_youtube_short || 'Viral Short');
      setPostDescription(
        clip.video_description_for_instagram ||
          clip.video_description_for_tiktok ||
          ''
      );
      setIsScheduling(false);
      setScheduleDate('');
      setPostResult(null);
    }
  }, [showModal, clip]);

  const handleAutoEdit = async () => {
    setIsEditing(true);
    setEditError(null);
    try {
      const apiKey = geminiApiKey;

      if (!apiKey) {
        throw new Error(
          'Gemini API Key is missing. Please set it in Settings.'
        );
      }

      // Try Remotion effects endpoint first
      const effectsRes = await fetch(getApiUrl('/api/effects/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': apiKey
        },
        body: JSON.stringify({
          job_id: jobId,
          clip_index: index,
          input_filename: currentVideoUrl.split('/').pop()
        })
      });

      if (effectsRes.ok) {
        const data = await effectsRes.json();
        if (data.effects && data.effects.segments) {
          const newLayers = { ...activeLayers, effects: data.effects };
          setActiveLayers(newLayers);
          if (await supportsWebCodecsH264()) {
            const blobUrl = await renderInBrowser({
              videoUrl: originalVideoUrl,
              durationInSeconds: clipDuration,
              subtitles: newLayers.subtitles,
              hook: newLayers.hook,
              effects: newLayers.effects
            });
            setCurrentVideoUrl(blobUrl);
            if (videoRef.current) videoRef.current.load();
            return;
          }
        }
      }

      // Fallback: legacy FFmpeg edit endpoint
      const res = await fetch(getApiUrl('/api/edit'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-Key': apiKey
        },
        body: JSON.stringify({
          job_id: jobId,
          clip_index: index,
          input_filename: currentVideoUrl.split('/').pop()
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        try {
          const jsonErr = JSON.parse(errText);
          throw new Error(jsonErr.detail || errText);
        } catch (e) {
          throw new Error(errText);
        }
      }

      const data = await res.json();
      if (data.new_video_url) {
        setCurrentVideoUrl(getApiUrl(data.new_video_url));
        if (videoRef.current) {
          videoRef.current.load();
        }
      }
    } catch (e) {
      setEditError(e.message);
      setTimeout(() => setEditError(null), 5000);
    } finally {
      setIsEditing(false);
    }
  };

  /*
  const handleSubtitle = async (options) => {
    setIsSubtitling(true);
    setEditError(null);
    try {
      if (options.remotion && (await supportsWebCodecsH264())) {
        try {
          const newLayers = { ...activeLayers, subtitles: options.remotion };
          setActiveLayers(newLayers);
          const blobUrl = await renderInBrowser({
            videoUrl: originalVideoUrl,
            durationInSeconds: clipDuration,
            subtitles: newLayers.subtitles,
            hook: newLayers.hook,
            effects: newLayers.effects
          });
          setCurrentVideoUrl(blobUrl);
          if (videoRef.current) videoRef.current.load();
          setShowSubtitleModal(false);
          return;
        } catch (remotionErr) {
          console.warn('Browser render failed, falling back to FFmpeg:', remotionErr);
        }
      }

      // Fallback: legacy FFmpeg
      const res = await fetch(getApiUrl('/api/subtitle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          clip_index: index,
          position: options.position,
          font_size: options.fontSize,
          font_name: options.fontName,
          font_color: options.fontColor,
          border_color: options.borderColor,
          border_width: options.borderWidth,
          bg_color: options.bgColor,
          bg_opacity: options.bgOpacity,
          input_filename: currentVideoUrl.split('/').pop()
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.new_video_url) {
        setCurrentVideoUrl(getApiUrl(data.new_video_url));
        if (videoRef.current) videoRef.current.load();
        setShowSubtitleModal(false);
      }
    } catch (e) {
      setEditError(e.message);
      setTimeout(() => setEditError(null), 5000);
    } finally {
      setIsSubtitling(false);
    }
  };
  */

  const handleRemotionBackendSubtitle = async (options) => {
    setIsSubtitling(true);
    setEditError(null);
    try {
      const res = await fetch(getApiUrl('/api/remotion/subtitle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          clip_index: index,
          position: options.position,
          font_size: options.fontSize,
          font_name: options.fontName,
          font_color: options.fontColor,
          highlight_color: options.highlightColor,
          border_color: options.borderColor,
          border_width: options.borderWidth,
          bg_color: options.bgColor,
          bg_opacity: options.bgOpacity,
          animation: options.animation,
          hook_text: options.hook_text || null,
          hook_position: options.hook_position ?? 0,
          hook_size: options.hook_size || 'M',
          hook_entrance_animation: options.hook_entrance_animation || 'spring',
          hook_display_duration: options.hook_display_duration || 5,
          image_overlay_data: options.image_overlay_data || null,
          image_position: options.image_position ?? 0,
          image_horizontal_position: options.image_horizontal_position ?? 50,
          image_size: options.image_size || 'M',
          image_entrance_animation: options.image_entrance_animation || 'spring',
          image_display_duration: options.image_display_duration || 5,
          image_opacity: options.image_opacity ?? 1.0,
          input_filename: currentVideoUrl.split('/').pop(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        try { throw new Error(JSON.parse(errText).detail || errText); }
        catch (e) { throw new Error(errText); }
      }

      const data = await res.json();
      if (data.new_video_url) {
        try {
          const downloadRes = await fetch(getApiUrl(data.new_video_url));
          if (downloadRes.ok) {
            const blob = await downloadRes.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `subtitled-clip-${index + 1}.mp4`;
            a.click();
            window.URL.revokeObjectURL(url);
          }
        } catch (dlErr) {
          console.warn('Download failed:', dlErr);
        }
        setShowSubtitleModal(false);
        onNewClip?.(jobId);
      }
    } catch (e) {
      setEditError(e.message);
      setTimeout(() => setEditError(null), 5000);
    } finally {
      setIsSubtitling(false);
    }
  };

  /*
  const handleHook = async (hookData) => {
    setIsHooking(true);
    setEditError(null);
    try {
      if (hookData.remotion) {
        const newLayers = { ...activeLayers, hook: hookData.remotion };
        setActiveLayers(newLayers);
        const blobUrl = await renderInBrowser({
          videoUrl: originalVideoUrl,
          durationInSeconds: clipDuration,
          subtitles: newLayers.subtitles,
          hook: newLayers.hook,
          effects: newLayers.effects
        });
        setCurrentVideoUrl(blobUrl);
        if (videoRef.current) videoRef.current.load();
        setShowHookModal(false);
        return;
      }

      // Fallback: legacy FFmpeg
      const payload =
        typeof hookData === 'string'
          ? { text: hookData, position: 'top', size: 'M' }
          : hookData;

      const res = await fetch(getApiUrl('/api/hook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          clip_index: index,
          text: payload.text,
          position: payload.position,
          size: payload.size,
          input_filename: currentVideoUrl.split('/').pop()
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.new_video_url) {
        setCurrentVideoUrl(getApiUrl(data.new_video_url));
        if (videoRef.current) videoRef.current.load();
        setShowHookModal(false);
      }
    } catch (e) {
      setEditError(e.message);
      setTimeout(() => setEditError(null), 5000);
    } finally {
      setIsHooking(false);
    }
  };
  */

  const handleTranslate = async (options) => {
    console.log('[Translate] Starting translation with options:', options);
    setIsTranslating(true);
    setEditError(null);
    try {
      const apiKey = elevenLabsKey;
      console.log('[Translate] API Key available:', !!apiKey);

      if (!apiKey) {
        throw new Error(
          'ElevenLabs API Key is missing. Please set it in Settings.'
        );
      }

      const requestBody = {
        job_id: jobId,
        clip_index: index,
        target_language: options.targetLanguage,
        input_filename: currentVideoUrl.split('/').pop()
      };
      console.log('[Translate] Request body:', requestBody);
      console.log('[Translate] Sending request to /api/translate');

      const res = await fetch(getApiUrl('/api/translate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ElevenLabs-Key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[Translate] Response status:', res.status);

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Translate] Error response:', errText);
        try {
          const jsonErr = JSON.parse(errText);
          throw new Error(jsonErr.detail || errText);
        } catch (e) {
          if (e.message !== errText) throw e;
          throw new Error(errText);
        }
      }

      const data = await res.json();
      console.log('[Translate] Success response:', data);
      if (data.new_video_url) {
        setCurrentVideoUrl(getApiUrl(data.new_video_url));
        if (videoRef.current) {
          videoRef.current.load();
        }
        setShowTranslateModal(false);
      }
    } catch (e) {
      console.error('[Translate] Exception:', e);
      setEditError(e.message);
      setTimeout(() => setEditError(null), 5000);
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePost = async () => {
    if (!uploadPostKey || !uploadUserId) {
      setPostResult({ success: false, msg: 'Missing API Key or User ID.' });
      return;
    }

    const selectedPlatforms = Object.keys(platforms).filter(
      (k) => platforms[k]
    );
    if (selectedPlatforms.length === 0) {
      setPostResult({ success: false, msg: 'Select at least one platform.' });
      return;
    }

    if (isScheduling && !scheduleDate) {
      setPostResult({ success: false, msg: 'Please select a date and time.' });
      return;
    }

    setPosting(true);
    setPostResult(null);

    try {
      const payload = {
        job_id: jobId,
        clip_index: index,
        api_key: uploadPostKey,
        user_id: uploadUserId,
        platforms: selectedPlatforms,
        title: postTitle,
        description: postDescription
      };

      if (isScheduling && scheduleDate) {
        // Convert to ISO-8601
        payload.scheduled_date = new Date(scheduleDate).toISOString();
        // Optional: pass timezone if needed, backend defaults to UTC or we can send user's timezone
        payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }

      const res = await fetch(getApiUrl('/api/social/post'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        try {
          const jsonErr = JSON.parse(errText);
          throw new Error(jsonErr.detail || errText);
        } catch (e) {
          throw new Error(errText);
        }
      }

      setPostResult({
        success: true,
        msg: isScheduling ? 'Scheduled successfully!' : 'Posted successfully!'
      });
      setTimeout(() => {
        setShowModal(false);
        setPostResult(null);
      }, 3000);
    } catch (e) {
      setPostResult({ success: false, msg: `Failed: ${e.message}` });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div
      className="bg-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col md:flex-row group hover:border-white/10 transition-all animate-[fadeIn_0.5s_ease-out] min-h-[300px] h-auto"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Left: Video Preview (Responsive Width) */}
      <div className="w-full md:w-[180px] lg:w-[200px] bg-black relative shrink-0 aspect-[9/16] md:aspect-auto group/video">
        {clip.video_deleted ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 p-4">
            <Trash2 size={24} className="mb-2 opacity-50" />
            <p className="text-[11px] text-zinc-500 text-center">Video file deleted</p>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={currentVideoUrl}
            controls
            className="w-full h-full object-cover"
            playsInline
            onPlay={() => {
              const currentTime = videoRef.current
                ? videoRef.current.currentTime
                : 0;
              onPlay && onPlay(clip.start + currentTime);
            }}
            onPause={() => onPause && onPause()}
            onEnded={() => {
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play();
              }
            }}
          />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-white/10 uppercase tracking-wide">
            Clip {clip.clip_id || index + 1}
          </span>
          {clip.derived && (
            <span className="bg-purple-600/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md border border-purple-400/30 uppercase tracking-wide">
              Subtitle Render
            </span>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setShowGrid(!showGrid); }}
          className={`absolute top-3 right-3 p-1 rounded transition-colors z-[5] ${
            showGrid ? 'bg-primary/40 text-white' : 'bg-black/40 text-white/60 hover:text-white'
          }`}
          title="Toggle alignment grid"
        >
          <Grid3x3 size={14} />
        </button>

        {showGrid && (
          <div className="absolute inset-0 pointer-events-none z-[4]">
            <div className="absolute left-[33.33%] top-0 w-[1px] h-full bg-white/30" />
            <div className="absolute left-[66.67%] top-0 w-[1px] h-full bg-white/30" />
            <div className="absolute top-[33.33%] left-0 h-[1px] w-full bg-white/30" />
            <div className="absolute top-[66.67%] left-0 h-[1px] w-full bg-white/30" />
          </div>
        )}

        {/* Auto Edit Overlay if Processing */}
        {isEditing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4 text-center">
            <Loader2 size={32} className="text-primary animate-spin mb-3" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              AI Magic in Progress...
            </span>
            <span className="text-[10px] text-zinc-400 mt-1">
              Applying viral edits & zooms
            </span>
          </div>
        )}
      </div>

      {/* Right: Content & Details */}
      <div className="flex-1 p-4 md:p-5 flex flex-col bg-[#121214] overflow-hidden min-w-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-bold text-white leading-tight line-clamp-2 mb-2 break-words"
              title={clip.video_title_for_youtube_short}
            >
              {clip.video_title_for_youtube_short || 'Viral Clip Generated'}
            </h3>
            <div className="flex flex-wrap gap-2 text-[10px] text-zinc-500 font-mono">
              <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                {Math.floor(clip.end - clip.start)}s
              </span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                #shorts
              </span>
              <span className="bg-white/5 px-1.5 py-0.5 rounded border border-white/5 shrink-0">
                #viral
              </span>
            </div>
          </div>
          <div className="relative shrink-0 ml-2" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <MoreVertical size={14} className="text-zinc-500" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-50 min-w-[170px] py-1">
                <button
                  onClick={handleCopy}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                >
                  <Copy size={12} /> Copy Title + Caption
                </button>
                <button
                  onClick={handleDeleteVideoOnly}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete Video Only
                </button>
                <div className="border-t border-white/5 my-1" />
                <button
                  onClick={handleDeleteClip}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete Clip
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Descriptions Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 mb-4">
          {/* YouTube */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 mb-1.5 uppercase tracking-wider">
              <Youtube size={12} className="shrink-0" />{' '}
              <span className="truncate">YouTube Title</span>
            </div>
            <p className="text-xs text-zinc-300 select-all break-words">
              {clip.video_title_for_youtube_short || 'Viral Short Video'}
            </p>
          </div>

          {/* TikTok / IG */}
          <div className="bg-black/20 rounded-lg p-3 border border-white/5">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
              <Video size={12} className="text-cyan-400 shrink-0" />
              <span className="text-zinc-500">/</span>
              <Instagram size={12} className="text-pink-400 shrink-0" />
              <span className="truncate">Caption</span>
            </div>
            <p className="text-xs text-zinc-300 line-clamp-3 hover:line-clamp-none transition-all cursor-pointer select-all break-words">
              {clip.video_description_for_tiktok ||
                clip.video_description_for_instagram}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {editError && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-lg flex items-center gap-2">
            <AlertCircle size={12} className="shrink-0" />
            {editError}
          </div>
        )}

        {/* Actions Footer */}
        {showActions && (
          <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-white/5">
            <button
              onClick={handleAutoEdit}
              disabled={isEditing}
              className="col-span-1 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-1 truncate px-1"
            >
              {isEditing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {isEditing ? 'Editing...' : 'Auto Edit'}
            </button>

            <button
              onClick={() => setShowSubtitleModal(true)}
              disabled={isSubtitling}
              className="col-span-1 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-1 truncate px-1"
            >
              {isSubtitling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Type size={14} />
              )}
              {isSubtitling ? 'Adding...' : 'Editor'}
            </button>

            {/*
            <button
              onClick={() => setShowHookModal(true)}
              disabled={isHooking}
              className="col-span-1 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black rounded-lg text-xs font-bold shadow-lg shadow-yellow-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-1 truncate px-1"
            >
              {isHooking ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {isHooking ? 'Adding...' : 'Viral Hook'}
            </button>
            */}

            <button
              onClick={() => setShowTranslateModal(true)}
              disabled={isTranslating}
              className="col-span-1 py-2 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-400 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-green-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-1 truncate px-1"
            >
              {isTranslating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Languages size={14} />
              )}
              {isTranslating ? 'Translating...' : 'Dub Voice'}
            </button>

            <button
              onClick={() => setShowModal(true)}
              className="col-span-1 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 truncate px-2"
            >
              <Share2 size={14} className="shrink-0" /> Post
            </button>
            {!clip.video_deleted && (
              <button
                onClick={async (e) => {
                  e.preventDefault();
                  try {
                    const response = await fetch(currentVideoUrl);
                    if (!response.ok) throw new Error('Download failed');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = `clip-${index + 1}.mp4`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (err) {
                    console.error('Download error:', err);
                    if (currentVideoUrl) window.open(currentVideoUrl, '_blank');
                  }
                }}
                className="col-span-1 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-white/5 truncate px-2"
              >
                <Download size={14} className="shrink-0" /> Download
              </button>
            )}
            <button
              onClick={handleCopy}
              className="col-span-1 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 border border-white/5 truncate px-2"
            >
              <Copy size={14} className="shrink-0" /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Post Modal */}
      {showActions && showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#121214] border border-white/10 p-6 rounded-2xl w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-white mb-4">
              Post / Schedule
            </h3>

            {!uploadPostKey && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs rounded-lg flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <div>Configure API Key in Settings first.</div>
              </div>
            )}

            <div className="space-y-4 mb-6">
              {/* Title & Description */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Video Title
                </label>
                <input
                  type="text"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary/50 placeholder-zinc-600"
                  placeholder="Enter a catchy title..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Caption / Description
                </label>
                <textarea
                  value={postDescription}
                  onChange={(e) => setPostDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary/50 placeholder-zinc-600 resize-none"
                  placeholder="Write a caption for your post..."
                />
              </div>

              {/* Scheduling */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-white font-medium">
                    <Calendar size={16} className="text-purple-400" /> Schedule
                    Post
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isScheduling}
                      onChange={(e) => setIsScheduling(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {isScheduling && (
                  <div className="mt-3 animate-[fadeIn_0.2s_ease-out]">
                    <label className="block text-xs text-zinc-400 mb-1">
                      Select Date & Time
                    </label>
                    <div className="relative">
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 pl-9 text-sm text-white focus:outline-none focus:border-purple-500/50 [color-scheme:dark]"
                      />
                      <Clock
                        size={14}
                        className="absolute left-3 top-2.5 text-zinc-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-2">
                  Select Platforms
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                    <input
                      type="checkbox"
                      checked={platforms.tiktok}
                      onChange={(e) =>
                        setPlatforms({ ...platforms, tiktok: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-black/50 text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Video size={16} className="text-cyan-400" /> TikTok
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                    <input
                      type="checkbox"
                      checked={platforms.instagram}
                      onChange={(e) =>
                        setPlatforms({
                          ...platforms,
                          instagram: e.target.checked
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-black/50 text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Instagram size={16} className="text-pink-400" />{' '}
                      Instagram
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
                    <input
                      type="checkbox"
                      checked={platforms.youtube}
                      onChange={(e) =>
                        setPlatforms({
                          ...platforms,
                          youtube: e.target.checked
                        })
                      }
                      className="w-4 h-4 rounded border-zinc-600 bg-black/50 text-primary focus:ring-primary"
                    />
                    <div className="flex items-center gap-2 text-sm text-white">
                      <Youtube size={16} className="text-red-400" /> YouTube
                      Shorts
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {postResult && (
              <div
                className={`mb-4 p-3 rounded-lg text-xs flex items-start gap-2 ${postResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
              >
                {postResult.success ? (
                  <CheckCircle size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                )}
                <div>{postResult.msg}</div>
              </div>
            )}

            <button
              onClick={handlePost}
              disabled={posting || !uploadPostKey}
              className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2"
            >
              {posting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />{' '}
                  {isScheduling ? 'Scheduling...' : 'Publishing...'}
                </>
              ) : (
                <>
                  <Share2 size={16} />{' '}
                  {isScheduling ? 'Schedule Post' : 'Publish Now'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {showActions && (<>
        <SubtitleModal
          isOpen={showSubtitleModal}
          onClose={() => setShowSubtitleModal(false)}
          videoUrl={originalVideoUrl}
          jobId={jobId}
          clipIndex={index}
          existingHookConfig={activeLayers.hook}
          initialHookText={clip.viral_hook_text}
          onGenerateBackend={handleRemotionBackendSubtitle}
          isBackendProcessing={isSubtitling}
        />

        {/*
        <HookModal
          isOpen={showHookModal}
          onClose={() => setShowHookModal(false)}
          onGenerate={handleHook}
          isProcessing={isHooking}
          videoUrl={originalVideoUrl}
          initialText={clip.viral_hook_text}
          durationInSeconds={clip.end && clip.start ? clip.end - clip.start : 30}
          existingSubtitles={activeLayers.subtitles}
        />
        */}

        <TranslateModal
          isOpen={showTranslateModal}
          onClose={() => setShowTranslateModal(false)}
          onTranslate={handleTranslate}
          isProcessing={isTranslating}
          videoUrl={currentVideoUrl}
          hasApiKey={!!elevenLabsKey}
        />
      </>)}
    </div>
  );
}
