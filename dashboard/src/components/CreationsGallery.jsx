import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Loader2,
  Play
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../config';
import ResultCard from './ResultCard';

const ITEMS_PER_PAGE = 12;

function CreationCard({
  creation,
  geminiApiKey,
  elevenLabsKey,
  uploadPostKey,
  uploadUserId
}) {
  const [expanded, setExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);
  const firstClip = creation.clips?.[0];
  const clipCount = creation.clips?.length || 0;
  const date = new Date(creation.created_at).toLocaleDateString();
  const sourceLabel = creation.source?.startsWith('http')
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

  return (
    <div
      ref={cardRef}
      className="bg-surface border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-all group animate-[fadeIn_0.5s_ease-out]"
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
              {firstClip?.video_title_for_youtube_short || 'Untitled'}
            </h3>
            <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
              {clipCount} clips
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 truncate">
            {sourceLabel || 'Unknown source'}
          </p>
          <p className="text-[10px] text-zinc-600">{date}</p>
        </div>
        <div className="shrink-0 text-zinc-500">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded clip grid with full ResultCards */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5 animate-[fadeIn_0.2s_ease-out]">
          {creation.source?.startsWith('http') && (
            <a
              href={creation.source}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 mb-3 mt-3"
            >
              <ExternalLink size={12} /> Source
            </a>
          )}
          <div className="grid grid-cols-3 gap-4">
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

  useEffect(() => {
    fetchCreations(0, false);
  }, [fetchCreations]);

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
