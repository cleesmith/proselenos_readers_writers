'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  extractChapters,
  extractMetadata,
  extractMP3FromM4B,
  formatTime,
  getChapterIndex,
  type PlayerChapter,
  type M4BMetadata,
} from './audiobookService';

interface AudiobookPlayerProps {
  m4bData: Uint8Array;
  bookTitle: string;
  onClose: () => void;
}

const AudiobookPlayer: React.FC<AudiobookPlayerProps> = ({ m4bData, bookTitle, onClose }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const chapterListRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [chapters, setChapters] = useState<PlayerChapter[]>([]);
  const [metadata, setMetadata] = useState<M4BMetadata>({
    title: '',
    artist: '',
    album: '',
    coverBlob: null,
  });
  const [audioSrc, setAudioSrc] = useState<string>('');

  // Parse M4B on mount
  useEffect(() => {
    // Copy into a plain ArrayBuffer (m4bData.buffer may be SharedArrayBuffer)
    const buffer = new ArrayBuffer(m4bData.byteLength);
    new Uint8Array(buffer).set(m4bData);

    const parsedChapters = extractChapters(buffer);
    const parsedMeta = extractMetadata(buffer);
    const mp3Blob = extractMP3FromM4B(buffer);

    setChapters(parsedChapters);
    setMetadata(parsedMeta);

    // Create audio source URL
    const sourceBlob = mp3Blob || new Blob([new Uint8Array(buffer)], { type: 'audio/mp4' });
    const url = URL.createObjectURL(sourceBlob);
    setAudioSrc(url);

    return () => {
      // Cleanup URLs on unmount
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set audio src when ready
  useEffect(() => {
    if (audioSrc && audioRef.current) {
      audioRef.current.src = audioSrc;
      audioRef.current.load();
    }
  }, [audioSrc]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (chapters.length) {
        const idx = getChapterIndex(chapters, audio.currentTime);
        setCurrentChapterIndex(idx);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [chapters]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekTo(Math.max(0, (audioRef.current?.currentTime || 0) - 10));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekTo(Math.min(audioRef.current?.duration || 0, (audioRef.current?.currentTime || 0) + 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Scroll active chapter into view
  useEffect(() => {
    if (!chapterListRef.current) return;
    const active = chapterListRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentChapterIndex]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying((p) => !p);
  }, [playing]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const goToChapter = useCallback(
    (idx: number) => {
      if (chapters[idx]) {
        seekTo(chapters[idx].start);
        setCurrentChapterIndex(idx);
        if (!playing && audioRef.current) {
          audioRef.current.play();
          setPlaying(true);
        }
      }
    },
    [chapters, playing, seekTo],
  );

  const prevChapter = useCallback(() => {
    if (chapters.length === 0) return;
    const currentCh = chapters[currentChapterIndex];
    if (currentCh && (audioRef.current?.currentTime || 0) - currentCh.start > 3) {
      seekTo(currentCh.start);
    } else if (currentChapterIndex > 0) {
      goToChapter(currentChapterIndex - 1);
    }
  }, [chapters, currentChapterIndex, seekTo, goToChapter]);

  const nextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      goToChapter(currentChapterIndex + 1);
    }
  }, [chapters.length, currentChapterIndex, goToChapter]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      seekTo(pct * duration);
    },
    [duration, seekTo],
  );

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const displayTitle = metadata.title || bookTitle;
  const nowPlayingText = chapters.length ? `Playing: ${chapters[currentChapterIndex]?.title || ''}` : '';

  return (
    <div className='fixed inset-0 z-[60] flex flex-col bg-base-300'>
      {/* Hidden audio element */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} preload='metadata' />

      {/* Player content — centered */}
      <div className='flex-1 overflow-y-auto flex items-start justify-center p-4'>
        <div className='w-full max-w-lg'>
          <div className='bg-base-200 rounded-2xl overflow-hidden shadow-2xl'>
            {/* Info bar */}
            <div className='px-5 pt-3 pb-1 relative'>
              <button
                onClick={onClose}
                className='absolute top-2 right-2 btn btn-ghost btn-sm btn-circle'
                title='Close'
              >
                <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                  <line x1='18' y1='6' x2='6' y2='18' />
                  <line x1='6' y1='6' x2='18' y2='18' />
                </svg>
              </button>
              <div className='text-base-content text-[15px] font-bold leading-tight tracking-tight pr-8'>
                {displayTitle}
              </div>
              {metadata.artist && (
                <div className='text-amber-600 text-xs mt-0.5'>{metadata.artist}</div>
              )}
              {nowPlayingText && (
                <div className='text-base-content/50 text-[11px] mt-0.5 italic'>
                  {nowPlayingText}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className='px-5 pt-1.5 pb-3'>
              {/* Progress bar */}
              <div
                ref={progressRef}
                className='w-full h-1 bg-base-300 rounded-sm cursor-pointer relative mb-1 group'
                onClick={handleProgressClick}
              >
                <div
                  className='h-full bg-gradient-to-r from-amber-700 to-amber-500 rounded-sm relative'
                  style={{ width: `${progressPct}%`, transition: 'width 0.15s linear' }}
                >
                  <div className='absolute -right-1 -top-0.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)] opacity-0 group-hover:opacity-100 transition-opacity' />
                </div>
                {/* Chapter ticks */}
                {duration > 0 &&
                  chapters.slice(1).map((ch, i) => (
                    <div
                      key={i}
                      className='absolute -top-px w-0.5 h-1.5 bg-amber-500/40 rounded-sm pointer-events-none'
                      style={{ left: `${(ch.start / duration) * 100}%` }}
                    />
                  ))}
              </div>

              {/* Time row */}
              <div className='flex justify-between text-[10px] text-base-content/40 font-mono mb-1.5 select-none'>
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(duration - currentTime)}</span>
              </div>

              {/* Transport buttons */}
              <div className='flex items-center justify-center gap-3'>
                {/* Prev chapter */}
                <button
                  onClick={prevChapter}
                  className='text-base-content/40 hover:text-amber-500 transition-colors p-1'
                  title='Previous chapter'
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                    <path d='M6 6h2v12H6zm3.5 6l8.5 6V6z' />
                  </svg>
                </button>

                {/* Back 30s */}
                <button
                  onClick={() => seekTo(Math.max(0, currentTime - 30))}
                  className='text-base-content/40 hover:text-amber-500 transition-colors p-1'
                  title='Back 30s'
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                    <path d='M1 4v6h6' />
                    <path d='M3.51 15a9 9 0 1 0 2.13-9.36L1 10' />
                    <text x='8' y='16.5' fontSize='7.5' fill='currentColor' stroke='none' fontWeight='bold' textAnchor='middle'>
                      30
                    </text>
                  </svg>
                </button>

                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className='bg-amber-500 text-base-300 w-10 h-10 rounded-full flex items-center justify-center shadow-[0_3px_14px_rgba(245,158,11,0.25)] hover:scale-105 active:scale-95 transition-transform'
                >
                  {playing ? (
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                      <path d='M6 4h4v16H6zm8 0h4v16h-4z' />
                    </svg>
                  ) : (
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor'>
                      <path d='M8 5v14l11-7z' />
                    </svg>
                  )}
                </button>

                {/* Forward 30s */}
                <button
                  onClick={() => seekTo(Math.min(duration, currentTime + 30))}
                  className='text-base-content/40 hover:text-amber-500 transition-colors p-1'
                  title='Forward 30s'
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                    <path d='M23 4v6h-6' />
                    <path d='M20.49 15a9 9 0 1 1-2.13-9.36L23 10' />
                    <text x='11' y='16.5' fontSize='7.5' fill='currentColor' stroke='none' fontWeight='bold' textAnchor='middle'>
                      30
                    </text>
                  </svg>
                </button>

                {/* Next chapter */}
                <button
                  onClick={nextChapter}
                  className='text-base-content/40 hover:text-amber-500 transition-colors p-1'
                  title='Next chapter'
                >
                  <svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
                    <path d='M16 6h2v12h-2zm-3.5 6L4 6v12z' />
                  </svg>
                </button>

              </div>
            </div>

            {/* Chapter list */}
            <div
              ref={chapterListRef}
              className='border-t border-base-content/10 max-h-[420px] overflow-y-auto'
            >
              {chapters.length > 0 ? (
                <>
                  <div className='px-5 pt-2.5 pb-1.5 text-[10px] uppercase tracking-[2px] text-base-content/40 font-mono sticky top-0 bg-base-200 z-[5]'>
                    Chapters ({chapters.length})
                  </div>
                  {chapters.map((ch, i) => (
                    <div
                      key={i}
                      data-active={i === currentChapterIndex}
                      onClick={() => goToChapter(i)}
                      className={`flex items-center gap-2.5 px-5 py-[7px] cursor-pointer transition-colors border-l-[3px] ${
                        i === currentChapterIndex
                          ? 'bg-base-300 border-l-amber-500'
                          : 'border-l-transparent hover:bg-base-300/50'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono min-w-[20px] ${
                          i === currentChapterIndex ? 'text-amber-500' : 'text-base-content/40'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={`flex-1 text-[13px] ${
                          i === currentChapterIndex ? 'text-amber-500' : 'text-base-content'
                        }`}
                      >
                        {ch.title}
                      </span>
                      <span className='text-[10px] text-base-content/40 font-mono'>
                        {formatTime(ch.start)}
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                <div className='p-6 text-center text-base-content/40 text-[13px] italic'>
                  No chapter markers found in this file
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudiobookPlayer;
