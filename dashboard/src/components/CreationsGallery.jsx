import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileDown,
  History,
  Loader2,
  MoreVertical,
  Play,
  RefreshCw,
  Trash2,
  Video
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../config';
import ResultCard from './ResultCard';

const ITEMS_PER_PAGE = 12;

const getYouTubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const STATUS_COLORS = {
  processing: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  queued: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
};

function CreationCard({
  creation,
  geminiApiKey,
  elevenLabsKey,
  uploadPostKey,
  uploadUserId,
  onDelete,
  onNewClip,
  onRetry,
  onClipDeleted,
  onDeleteAllVideos
}) {
  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const cardRef = useRef(null);
  const videoMenuRef = useRef(null);
  const firstClip = creation.clips?.[0];
  const clipCount = creation.clips?.length || 0;
  const date = new Date(creation.created_at).toLocaleDateString();
  const isYouTube = creation.source?.startsWith('http');
  const isFailed = creation.status === 'failed';
  const isProcessing = creation.status === 'processing';
  const sourceLabel = isYouTube
    ? creation.source.split('?')[0].split('/').slice(0, 3).join('/')
    : creation.source;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entries[0].target);
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  const handleRetry = async (e) => {
    e.stopPropagation();
    if (retrying) return;
    setRetrying(true);
    try {
      if (onRetry) {
        await onRetry(creation.job_id);
      }
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!showVideoMenu) return;
    const handler = (e) => {
      if (videoMenuRef.current && !videoMenuRef.current.contains(e.target)) {
        setShowVideoMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showVideoMenu]);

  const handleExportMetadata = (e) => {
    e.stopPropagation();
    const date = new Date(creation.created_at).toLocaleDateString();
    const clipsHtml = (creation.clips || []).map((clip, i) => `
      <div style="background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:16px;margin-bottom:12px;page-break-inside:avoid;">
        <h3 style="margin:0 0 8px 0;color:#e94560;font-size:14px;">
          Clip ${clip.clip_id || i + 1}
          ${clip.start != null && clip.end != null ? `<span style="color:#888;font-weight:400;font-size:12px;">  (${clip.end - clip.start}s)</span>` : ''}
          ${clip.derived ? ('<span style="color:#a855f7;font-size:11px;margin-left:8px;">[' + (clip.derived_type || 'Derived') + ']</span>') : ''}
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr><td style="color:#888;padding:4px 8px 4px 0;width:100px;vertical-align:top;white-space:nowrap;">YouTube Title</td>
              <td style="color:#eee;padding:4px 0;">${escapeHtml(clip.video_title_for_youtube_short || '')}</td></tr>
          <tr><td style="color:#888;padding:4px 8px 4px 0;vertical-align:top;white-space:nowrap;">TikTok Caption</td>
              <td style="color:#eee;padding:4px 0;white-space:pre-wrap;">${escapeHtml(clip.video_description_for_tiktok || '')}</td></tr>
          <tr><td style="color:#888;padding:4px 8px 4px 0;vertical-align:top;white-space:nowrap;">IG Caption</td>
              <td style="color:#eee;padding:4px 0;white-space:pre-wrap;">${escapeHtml(clip.video_description_for_instagram || '')}</td></tr>
          <tr><td style="color:#888;padding:4px 8px 4px 0;vertical-align:top;white-space:nowrap;">Hook Text</td>
              <td style="color:#eee;padding:4px 0;">${escapeHtml(clip.viral_hook_text || '')}</td></tr>
          <tr><td style="color:#888;padding:4px 8px 4px 0;vertical-align:top;white-space:nowrap;">Video File</td>
              <td style="color:#888;padding:4px 0;word-break:break-all;">${escapeHtml(clip.video_url || 'N/A')}</td></tr>
        </table>
      </div>
    `).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escapeHtml(creation.original_video_title || 'Untitled')} — Metadata</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f23;color:#eee;padding:24px;max-width:800px;margin:0 auto;}
  h1{font-size:20px;margin-bottom:4px;color:#fff;}
  .meta{color:#888;font-size:12px;margin-bottom:20px;}
  hr{border:none;border-top:1px solid #333;margin:16px 0;}
  @media print{body{background:#fff;color:#000;}h1{color:#000;}.meta{color:#666;}
    td{color:#333!important;}h3 span{color:#666!important;}
    div[style*="background:#1a1a2e"]{background:#f5f5f5!important;border-color:#ddd!important;}
    div[style*="border:1px solid #333"]{border-color:#ccc!important;}
    a{color:#06c!important;}}
</style></head>
<body>
  <h1>${escapeHtml(creation.original_video_title || 'Untitled')}</h1>
  <div class="meta">
    ${creation.source ? `Source: ${escapeHtml(creation.source)}<br>` : ''}
    Created: ${date}<br>
    ${(creation.clips || []).length} clip(s)
  </div>
  <hr>
  ${clipsHtml}
  <hr style="margin-top:24px;">
  <p style="color:#555;font-size:11px;text-align:center;">Generated by OpenShorts</p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(creation.original_video_title || 'creation').replace(/[^a-zA-Z0-9_-]/g, '_')}_metadata.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  return (
    <div
      ref={cardRef}
      className={`bg-surface border rounded-xl overflow-hidden transition-all group animate-[fadeIn_0.5s_ease-out] ${
        isFailed
          ? 'border-red-500/20 hover:border-red-500/30'
          : isProcessing
            ? 'border-amber-500/20 hover:border-amber-500/30'
            : 'border-white/5 hover:border-white/10'
      }`}
    >
      {/* Header / Thumbnail */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-black relative">
          {isVisible && firstClip?.video_url ? (
            <video
              src={getApiUrl(firstClip.video_url)}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
              <Play size={20} className="text-white/30" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-bold text-white truncate">
              {creation?.original_video_title || 'Untitled'}
            </h3>
            <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {clipCount} clips
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] text-zinc-500 truncate">
              {sourceLabel || 'Unknown source'}
            </p>
            <span
              className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                STATUS_COLORS[creation.status] || STATUS_COLORS.queued
              }`}
            >
              {creation.status}
              {isProcessing && creation.step ? `: ${creation.step}` : ''}
            </span>
          </div>
          <p className="text-[10px] text-zinc-600">{date}</p>
        </div>
        <div className="shrink-0 text-zinc-500 flex items-center gap-1">
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="p-1.5 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors disabled:opacity-50"
              title="Retry from Gemini step"
            >
              <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            onClick={handleExportMetadata}
            className="p-1.5 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Download metadata HTML"
          >
            <FileDown size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this creation and all its clips?')) {
                onDelete?.(creation.job_id);
              }
            }}
            className="p-1.5 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Delete creation"
          >
            <Trash2 size={15} />
          </button>
          <div className="relative" ref={videoMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowVideoMenu(!showVideoMenu);
              }}
              className="p-1.5 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
              title="More options"
            >
              <MoreVertical size={15} />
            </button>
            {showVideoMenu && (
              <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-white/10 rounded-lg shadow-xl z-50 min-w-[160px] py-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowVideoMenu(false);
                    if (confirm('Delete all video files for this creation? Metadata will be preserved.')) {
                      onDeleteAllVideos?.(creation.job_id);
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete All Videos
                </button>
              </div>
            )}
          </div>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Progress bar for processing creations */}
      {isProcessing && (
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-amber-500 transition-all duration-1000"
            style={{ width: `${creation.progress_pct || 0}%` }}
          />
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5 animate-[fadeIn_0.2s_ease-out]">
          {/* Original video title */}
          {creation.original_video_title && (
            <p className="text-[11px] text-zinc-400 mt-3 mb-1 truncate">
              Original: {creation.original_video_title}
            </p>
          )}

          {/* Original video player */}
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black mb-3 mt-2">
            {isYouTube ? (
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${getYouTubeId(creation.source)}?autoplay=0&mute=1&controls=1&loop=1&playlist=${getYouTubeId(creation.source)}&modestbranding=1&showinfo=0&rel=0`}
                title="Original Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : creation.source ? (
              <video
                src={getApiUrl('/uploads/' + creation.source)}
                className="w-full h-full object-contain"
                muted
                loop
                playsInline
                controls
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <Video size={32} className="text-white/20" />
              </div>
            )}
          </div>

          {/* Source link */}
          {isYouTube && (
            <a
              href={creation.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 mb-3"
            >
              <ExternalLink size={12} /> Open original on YouTube
            </a>
          )}
          {!isYouTube && creation.source && (
            <p className="text-[10px] text-zinc-500 mb-3 truncate">
              File: {creation.source.replace(/^[^_]+_/, '')}
            </p>
          )}

          {/* Step history for non-completed creations */}
          {(isProcessing || isFailed) && creation.steps_history?.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">
                Steps
              </p>
              <div className="flex flex-wrap gap-1">
                {creation.steps_history.map((s, i) => (
                  <span
                    key={i}
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                      s.step === creation.step && isProcessing
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                    }`}
                  >
                    {s.step}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clip grid */}
          <div className="grid grid-cols-2 gap-4">
            {creation.clips.map((clip, i) => (
              <ResultCard
                key={i}
                clip={clip}
                index={i}
                jobId={creation.job_id}
                geminiApiKey={geminiApiKey}
                elevenLabsKey={elevenLabsKey}
                uploadPostKey={uploadPostKey}
                uploadUserId={uploadUserId}
                onPlay={() => {}}
                onPause={() => {}}
                onNewClip={onNewClip}
                onClipDeleted={onClipDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CreationsGallery({
  geminiApiKey = '',
  elevenLabsKey = '',
  uploadPostKey = '',
  uploadUserId = ''
}) {
  const [creations, setCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const loaderRef = useRef(null);

  const fetchCreations = useCallback(
    async (currentOffset = 0, append = false) => {
      try {
        if (currentOffset === 0) setLoading(true);
        else setLoadingMore(true);

        const res = await fetch(
          getApiUrl(
            `/api/creations?limit=${ITEMS_PER_PAGE}&offset=${currentOffset}`
          )
        );
        if (!res.ok) throw new Error('Failed to fetch creations');
        const data = await res.json();

        if (append) {
          setCreations((prev) => [...prev, ...data.creations]);
        } else {
          setCreations(data.creations);
        }
        setHasMore(data.has_more);
        setOffset(currentOffset + data.creations.length);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  const handleNewClip = useCallback(async (jobId) => {
    try {
      const res = await fetch(getApiUrl(`/api/creations/${jobId}`));
      if (!res.ok) throw new Error('Failed to fetch');
      const updated = await res.json();
      setCreations((prev) =>
        prev.map((c) => (c.job_id === jobId ? updated : c))
      );
    } catch (err) {
      console.error('Failed to refresh creation:', err);
    }
  }, []);

  const handleRetry = useCallback(
    async (jobId) => {
      try {
        const res = await fetch(getApiUrl(`/api/process/retry/${jobId}`), {
          method: 'POST',
          headers: {
            'X-Gemini-Key': geminiApiKey,
            'Content-Type': 'application/json'
          }
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to retry');
        }
        const result = await res.json();
        // Update the creation entry to show processing status immediately
        setCreations((prev) =>
          prev.map((c) =>
            c.job_id === jobId
              ? {
                  ...c,
                  status: 'processing',
                  step: 'started',
                  progress_pct: 0,
                  clips: [],
                  steps_history: []
                }
              : c
          )
        );
      } catch (err) {
        alert('Retry failed: ' + err.message);
      }
    },
    [geminiApiKey]
  );

  const handleDelete = useCallback(async (jobId) => {
    try {
      const res = await fetch(getApiUrl(`/api/creations/${jobId}`), {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      setCreations((prev) => prev.filter((c) => c.job_id !== jobId));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }, []);

  const handleClipDeleted = useCallback((jobId, clipIndex, type) => {
    setCreations((prev) =>
      prev.map((c) => {
        if (c.job_id !== jobId) return c;
        if (type === 'clip') {
          const newClips = [...c.clips];
          newClips.splice(clipIndex, 1);
          return { ...c, clips: newClips };
        }
        const newClips = c.clips.map((clip, i) =>
          i === clipIndex ? { ...clip, video_url: null, video_deleted: true } : clip
        );
        return { ...c, clips: newClips };
      })
    );
  }, []);

  const handleDeleteAllVideos = useCallback(async (jobId) => {
    try {
      const res = await fetch(getApiUrl(`/api/creations/${jobId}/videos`), {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete videos');
      setCreations((prev) =>
        prev.map((c) =>
          c.job_id === jobId
            ? {
                ...c,
                clips: c.clips.map((clip) => ({
                  ...clip,
                  video_url: null,
                  video_deleted: true
                }))
              }
            : c
        )
      );
    } catch (err) {
      alert('Failed to delete videos: ' + err.message);
    }
  }, []);

  useEffect(() => {
    fetchCreations(0, false);
  }, [fetchCreations]);

  // Poll for processing creations
  useEffect(() => {
    const hasProcessing = creations.some((c) => c.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(() => {
      fetchCreations(0, false);
    }, 5000);
    return () => clearInterval(interval);
  }, [creations, fetchCreations]);

  useEffect(() => {
    if (!hasMore || loadingMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchCreations(offset, true);
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => {
      if (loaderRef.current) observer.unobserve(loaderRef.current);
    };
  }, [hasMore, loadingMore, loading, offset, fetchCreations]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-zinc-500 animate-[fadeIn_0.5s_ease-out]">
        <Loader2 size={32} className="animate-spin mb-4 text-primary" />
        <p>Loading creations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-red-400 p-6">
        <AlertCircle size={32} className="mb-4" />
        <p>Error loading creations: {error}</p>
        <button
          onClick={() => {
            setError(null);
            setOffset(0);
            fetchCreations(0, false);
          }}
          className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <History className="text-primary" /> My Creations
        </h1>
        <span className="text-xs bg-white/10 text-white px-3 py-1 rounded-full border border-white/5">
          {creations.length} {creations.length === 1 ? 'Creation' : 'Creations'}
          {hasMore ? '+' : ''}
        </span>
      </div>

      {creations.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-2">No creations yet.</p>
          <p className="text-sm">
            Process some videos and they'll show up here!
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 pb-10">
            {creations.map((creation, i) => (
              <CreationCard
                key={creation.job_id}
                creation={creation}
                geminiApiKey={geminiApiKey}
                elevenLabsKey={elevenLabsKey}
                uploadPostKey={uploadPostKey}
                uploadUserId={uploadUserId}
                onDelete={handleDelete}
                onNewClip={handleNewClip}
                onRetry={handleRetry}
                onClipDeleted={handleClipDeleted}
                onDeleteAllVideos={handleDeleteAllVideos}
              />
            ))}
          </div>
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-8">
              {loadingMore && (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Loading more...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
