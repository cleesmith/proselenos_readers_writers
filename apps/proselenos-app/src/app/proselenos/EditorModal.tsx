// app/proselenos/EditorModal.tsx

/*
 * Editor modal component with sentence‑by‑sentence text‑to‑speech (TTS)
 * playback and sentence highlighting.  This version introduces a
 * `ttsOperationIdRef` to guard against stale TTS results: every time
 * the user starts or stops playback, the operation id is incremented.
 * Asynchronous synthesis routines capture the id at the moment they
 * begin and discard their results if the id has changed when they
 * resolve.  This prevents audio from cancelled operations from
 * unexpectedly playing later when the user clicks Speak again.
 */

'use client';

// import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showInputAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';

// Helper to strip Markdown formatting from a string.  Adapted from
// the developer's working website code.  See original comments in
// previous versions for details.
function stripMarkdown(md: string, options: any = {}): string {
  options = options || {};
  options.listUnicodeChar = options.hasOwnProperty('listUnicodeChar')
    ? options.listUnicodeChar
    : false;
  options.stripListLeaders = options.hasOwnProperty('stripListLeaders')
    ? options.stripListLeaders
    : true;
  options.gfm = options.hasOwnProperty('gfm') ? options.gfm : true;
  options.useImgAltText = options.hasOwnProperty('useImgAltText')
    ? options.useImgAltText
    : true;
  options.preserveBlockSpacing = options.hasOwnProperty('preserveBlockSpacing')
    ? options.preserveBlockSpacing
    : true;

  let output = md || '';
  // Remove horizontal rules
  output = output.replace(/^(-\s*?|\*\s*?|_\s*?){3,}\s*$/gm, '');
  try {
    // Handle list markers
    if (options.stripListLeaders) {
      if (options.listUnicodeChar) {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, options.listUnicodeChar + ' $1');
      } else {
        output = output.replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1');
      }
    }
    // Handle Markdown features
    if (options.gfm) {
      output = output
        .replace(/\n={2,}/g, '\n')
        .replace(/~{3}.*\n/g, '')
        .replace(/(`{3,})([\s\S]*?)\1/gm, function (_match: string, _p1: string, p2: string) {
          return p2.trim() + '%%CODEBLOCK_END%%\n';
        })
        .replace(/~~/g, '');
    }
    // Process main markdown elements
    output = output
      .replace(/<[^>]*>/g, '')
      .replace(/^[=\-]{2,}\s*$/g, '')
      .replace(/\[\^.+?\](\: .*?$)?/g, '')
      .replace(/\s{0,2}\[.*?\]: .*?$/g, '')
      .replace(/!\[(.*?)\][\[(].*?[\])]/g, options.useImgAltText ? '$1' : '')
      .replace(/\[(.*?)\][\[(].*?[\])]/g, '$1')
      .replace(/^\s*>+\s?/gm, function () {
        return options.preserveBlockSpacing ? '\n' : '';
      })
      .replace(/^([\s\t]*)([\*\-\+]|\d+\.)\s+/gm, '$1')
      .replace(/^\s{1,2}\[(.*?)\]: (\S+)( ".*?")?\s*$/g, '')
      .replace(/^(\n)?\s{0,}#{1,6}\s+| {0,}(\n)?\s{0,}#{0,} {0,}(\n)?\s{0,}$/gm, '$1$2$3')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/([\*_]{1,3})(\S.*?\S{0,1})\1/g, '$2')
      .replace(/`(.+?)`/g, '$1');
    // Final cleanup and spacing
    output = output
      .replace(/%%CODEBLOCK_END%%\n/g, '\n\n\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .replace(/\n{3}/g, '\n\n')
      .trim();
    return output;
  } catch (_error) {
    return md;
  }
}

interface EditorModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  currentProjectId: string | null;
  currentFileName: string | null;
  currentFilePath: string | null;
  editorContent: string;
  onClose: () => void;
  onContentChange: (content: string) => void;
  onSaveFile: (content: string, filename?: string) => Promise<string | void>;
  onBrowseFiles: () => void;
}

export default function EditorModal({
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  currentProjectId,
  currentFileName,
  currentFilePath,
  editorContent,
  onClose,
  onContentChange,
  onSaveFile,
  onBrowseFiles,
}: EditorModalProps) {
  // State for file saving and opening
  const [isSaving, setIsSaving] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  // TTS state variables – simplified
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentences, setSentences] = useState<string[]>([]);
  // Voice selection state
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-EmmaMultilingualNeural');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isClientHydrated, setIsClientHydrated] = useState(false);
  // Two-buffer system: current + next audio
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [nextAudio, setNextAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [_nextAudioUrl, setNextAudioUrl] = useState<string | null>(null);
  const [isGeneratingInitial, setIsGeneratingInitial] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [startSentenceIndex, setStartSentenceIndex] = useState<number | null>(null);
  // Maintain a ref that always reflects the most up‑to‑date start sentence index.
  const startSentenceRef = useRef<number | null>(null);
  // Single abort controller for background generation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref for immediate access to nextAudio (avoids React state timing issues)
  const nextAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  // Ref for the overlay container so we can scroll it
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // A ref to track the current TTS operation.  Each time a new Speak
  // operation begins (i.e. the user initiates playback from the start or
  // explicitly stops playback), this counter is incremented.  Asynchronous
  // synthesis routines capture the current value and check it when they
  // resolve; if the values differ, the result is discarded.
  const ttsOperationIdRef = useRef<number>(0);

  // Hydrate client on mount
  useEffect(() => {
    setIsClientHydrated(true);
  }, []);

  // Load available voices when client is ready
  useEffect(() => {
    if (!isClientHydrated || typeof window === 'undefined') return;
    const loadVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const edgeTTSModule: any = await import('edge-tts-universal');
        const { VoicesManager } = edgeTTSModule;
        const voicesManager = await VoicesManager.create();
        // Get English voices
        const englishVoices = voicesManager.find({ Language: 'en' });
        setAvailableVoices(englishVoices);
        // Load saved voice preference or use default
        const savedVoice = localStorage.getItem('proselenos-selected-voice');
        if (
          savedVoice &&
          englishVoices.some((voice: any) => voice.ShortName === savedVoice)
        ) {
          setSelectedVoice(savedVoice);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        // Keep default voice if loading fails
      } finally {
        setIsLoadingVoices(false);
      }
    };
    loadVoices();
  }, [isClientHydrated]);

  // Persist voice selection
  const handleVoiceChange = (voice: string) => {
    if (typeof window === 'undefined') return;
    setSelectedVoice(voice);
    localStorage.setItem('proselenos-selected-voice', voice);
  };

  // Count words in the editor
  const countWords = (text: string) => {
    return text
      .replace(/(\r\n|\r|\n)/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .length;
  };
  // Compute the current word count for display
  const wordCount = countWords(editorContent);

  // Save file handler
  const handleSave = async () => {
    if (!editorContent.trim()) {
      showAlert('Cannot save empty content!', 'error', undefined, isDarkMode);
      return;
    }
    if (currentFileName && currentFileName.match(/proselenos.*\.json$/i)) {
      showAlert('Cannot edit configuration files!', 'error', undefined, isDarkMode);
      return;
    }
    setIsSaving(true);
    try {
      if (currentFilePath) {
        await onSaveFile(editorContent);
        showAlert('✅ File updated successfully!', 'success', undefined, isDarkMode);
      } else {
        if (!currentProject || !currentProjectId) {
          showAlert('Please select a Project to save new files!', 'error', undefined, isDarkMode);
          return;
        }
        const defaultName = `manuscript_${new Date().toISOString().slice(0, 10)}`;
        const fileName = await showInputAlert(
          'Enter filename (without .txt extension):',
          defaultName,
          'Enter filename...',
          isDarkMode
        );
        if (!fileName) {
          setIsSaving(false);
          return;
        }
        const baseName = fileName.trim();
        const finalName = /\.txt$/i.test(baseName) ? baseName : `${baseName}.txt`;
        await onSaveFile(editorContent, finalName);
        showAlert('✅ File saved successfully!', 'success', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert('❌ Error saving file!', 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  // Open file handler
  const handleOpen = async () => {
    setIsOpening(true);
    try {
      onBrowseFiles();
    } finally {
      setIsOpening(false);
    }
  };

  // New handler: remove markdown from the `editor` content
  const handleCleanMarkdown = (): void => {
    const cleaned = stripMarkdown(editorContent);
    onContentChange(cleaned);
  };

  // Generate single sentence audio.  This helper performs a dynamic
  // import of edge‑tts‑universal to avoid loading the library during
  // server‑side rendering.  It does not check the operation id; that
  // responsibility belongs to the callers.
  const generateSentenceAudio = async (
    sentence: string
  ): Promise<{ audio: HTMLAudioElement; url: string } | null> => {
    if (!sentence.trim() || typeof window === 'undefined') return null;
    try {
      const edgeTTSModule: any = await import('edge-tts-universal');
      const TTSConstructor = edgeTTSModule.EdgeTTS;
      const tts = new TTSConstructor(sentence, selectedVoice);
      const result = await tts.synthesize();
      const audioBlob = new Blob([result.audio], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      return { audio, url: audioUrl };
    } catch (error) {
      console.error('Error generating sentence audio:', error);
      return null;
    }
  };

  // Generate next sentence in background (with state tracking and operation id check)
  const generateNextSentence = async (nextIndex: number, sentenceArray: string[]) => {
    if (nextIndex >= sentenceArray.length) return;
    if (isGeneratingNext) return;
    const sentence = sentenceArray[nextIndex];
    if (!sentence || !sentence.trim()) return;
    // Capture the operation id at the start of this generation
    const opIdAtStart = ttsOperationIdRef.current;
    // Cancel any previous background generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;
    setIsGeneratingNext(true);
    try {
      const result = await generateSentenceAudio(sentence);
      // If this generation was aborted or the operation has moved on, ignore the result
      if (newAbortController.signal.aborted || opIdAtStart !== ttsOperationIdRef.current) {
        return;
      }
      if (result) {
        nextAudioRef.current = result;
        setNextAudio(result.audio);
        setNextAudioUrl(result.url);
      } else {
        nextAudioRef.current = null;
      }
    } catch (error) {
      if (!newAbortController.signal.aborted) {
        console.error(`Error generating sentence ${nextIndex}:`, error);
      }
    } finally {
      setIsGeneratingNext(false);
    }
  };

  // Handle sentence completion and advance
  const advanceToNextSentence = async (
    finishedIndex: number,
    sentenceArray: string[]
  ) => {
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= sentenceArray.length) {
      // Completed all sentences
      cleanupAudio();
      return;
    }
    // Cleanup finished audio
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    // Check if nextAudio is ready (use ref for immediate access)
    const nextAudioData = nextAudioRef.current;
    if (!nextAudioData) {
      // Emergency: generate next sentence synchronously
      const sentence = sentenceArray[nextIndex];
      if (sentence && sentence.trim()) {
        // Capture the operation id at start of generation
        const opIdAtStart = ttsOperationIdRef.current;
        setIsGeneratingNext(true);
        const result = await generateSentenceAudio(sentence);
        setIsGeneratingNext(false);
        // If operation id changed during generation, ignore this result
        if (opIdAtStart !== ttsOperationIdRef.current) {
          return;
        }
        if (result) {
          setCurrentAudio(result.audio);
          setCurrentAudioUrl(result.url);
          setNextAudio(null);
          setNextAudioUrl(null);
          setCurrentSentenceIndex(nextIndex);
          // Mark speaking before playback
          setIsSpeaking(true);
          setIsPaused(false);
          // Start playing
          result.audio.onended = () => advanceToNextSentence(nextIndex, sentenceArray);
          result.audio.onerror = () => {
            showAlert('Audio playback error', 'error', undefined, isDarkMode);
            cleanupAudio();
          };
          await result.audio.play();
          // Start generating the sentence after this one
          generateNextSentence(nextIndex + 1, sentenceArray);
        } else {
          showAlert('Failed to generate next sentence', 'error', undefined, isDarkMode);
          cleanupAudio();
        }
      }
      return;
    }
    // Normal path: nextAudio is ready
    setCurrentAudio(nextAudioData.audio);
    setCurrentAudioUrl(nextAudioData.url);
    nextAudioRef.current = null;
    setNextAudio(null);
    setNextAudioUrl(null);
    setCurrentSentenceIndex(nextIndex);
    // Mark speaking before playback
    setIsSpeaking(true);
    setIsPaused(false);
    // Start playing immediately
    nextAudioData.audio.onended = () => advanceToNextSentence(nextIndex, sentenceArray);
    nextAudioData.audio.onerror = () => {
      showAlert('Audio playback error', 'error', undefined, isDarkMode);
      cleanupAudio();
    };
    await nextAudioData.audio.play();
    // Start generating the next sentence in background
    generateNextSentence(nextIndex + 1, sentenceArray);
  };

  // Main TTS handler (Speak/Pause/Resume)
  const handleSpeak = async (): Promise<void> => {
    // Prevent TTS during hydration or on the server
    if (!isClientHydrated || typeof window === 'undefined') {
      showAlert('TTS not available during page load', 'error', undefined, isDarkMode);
      return;
    }
    // Do nothing if the content is empty
    if (!editorContent.trim()) {
      showAlert('No content to read!', 'error', undefined, isDarkMode);
      return;
    }
    // If already speaking, toggle pause/resume
    if (isSpeaking && !isPaused) {
      handlePause();
      return;
    }
    if (isPaused) {
      handleResume();
      return;
    }
    // This is a fresh Speak request: increment the operation id
    ttsOperationIdRef.current += 1;
    const thisOpId = ttsOperationIdRef.current;
    // Split the document into sentences using exact ranges
    const ranges = getSentenceRangesFromOriginal(editorContent);
    const parsedSentences = ranges.map((r) => editorContent.slice(r.start, r.end));
    if (parsedSentences.length === 0) {
      showAlert('No sentences found!', 'error', undefined, isDarkMode);
      return;
    }
    // Save the sentences and decide where to start
    setSentences(parsedSentences);
    const startIndex = startSentenceRef.current ?? 0;
    setCurrentSentenceIndex(startIndex);
    // Generate and play the first sentence's audio
    const firstSentence = parsedSentences[startIndex];
    if (!firstSentence) return;
    setIsGeneratingInitial(true);
    const result0 = await generateSentenceAudio(firstSentence);
    setIsGeneratingInitial(false);
    // If the operation id has changed while we were generating, ignore this result
    if (thisOpId !== ttsOperationIdRef.current || !result0) {
      return;
    }
    setCurrentAudio(result0.audio);
    setCurrentAudioUrl(result0.url);
    // Mark as speaking before playback to ensure the highlight preview appears immediately
    setIsSpeaking(true);
    setIsPaused(false);
    result0.audio.onended = () => advanceToNextSentence(startIndex, parsedSentences);
    result0.audio.onerror = () => {
      showAlert('Audio playback error', 'error', undefined, isDarkMode);
      cleanupAudio();
    };
    await result0.audio.play();
    // If there’s another sentence after the current one, pre‑generate it
    if (parsedSentences.length > startIndex + 1) {
      generateNextSentence(startIndex + 1, parsedSentences);
    }
  };

  // Pause handler
  const handlePause = (): void => {
    if (currentAudio && isSpeaking && !isPaused) {
      currentAudio.pause();
      setIsPaused(true);
    }
  };
  // Resume handler
  const handleResume = (): void => {
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPaused(false);
    }
  };
  // Stop handler: stop audio and invalidate current operation
  const handleStop = (): void => {
    // Force stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    // Force stop any buffered audio
    if (nextAudio) {
      nextAudio.pause();
      nextAudio.currentTime = 0;
    }
    // Force stop ref‑stored audio
    if (nextAudioRef.current?.audio) {
      nextAudioRef.current.audio.pause();
      nextAudioRef.current.audio.currentTime = 0;
    }
    // Invalidate any in‑flight TTS promises
    ttsOperationIdRef.current += 1;
    cleanupAudio();
  };

  // Cleanup function for audio and TTS state
  const cleanupAudio = () => {
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    setSentences([]);
    setCurrentAudio(null);
    setNextAudio(null);
    setCurrentAudioUrl(null);
    setNextAudioUrl(null);
    setIsGeneratingInitial(false);
    setIsGeneratingNext(false);
    setStartSentenceIndex(null);
    startSentenceRef.current = null;
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        cleanupAudio();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop the audio and clean up, then scroll to top
  const handleStopAndScroll = () => {
    handleStop();
    // After stopping, scroll the editor container to the top
    const editorElement = document.querySelector('.w-md-editor') as HTMLElement | null;
    if (editorElement) {
      editorElement.scrollTop = 0;
      editorElement.scrollLeft = 0;
    }
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined') {
      handleStop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /*
   * Build a highlighted HTML string.  Instead of re‑splitting the editor
   * content (which can lead to off‑by‑one errors between the audio
   * sentences and the preview), we rely directly on the `sentences`
   * array for the TTS.  This guarantees that the highlighted
   * sentence always corresponds to the sentence currently being
   * spoken.  We preserve original spacing and blank lines by slicing
   * exact ranges from the original content.
   */
  const getHighlightedHtml = () => {
    if (sentences.length === 0) return '';
    const ranges = getSentenceRangesFromOriginal(editorContent);
    const startIdx = startSentenceIndex ?? 0;
    return ranges
      .slice(startIdx)
      .map((r, localIdx) => {
        const absoluteIdx = startIdx + localIdx;
        const textSlice = editorContent.slice(r.start, r.end);
        if (absoluteIdx === currentSentenceIndex && isSpeaking) {
          const bg = isDarkMode ? 'rgba(255, 255, 140, 0.28)' : 'rgba(255, 230, 0, 0.25)';
          return `<span data-current="true" style="background:${bg};">${textSlice}</span>`;
        }
        return textSlice;
      })
      .join('');
  };

  /*
   * Compute exact character ranges of sentences in the original
   * editorContent using the same regex used for splitting into
   * sentences.  This avoids mismatches caused by whitespace
   * normalization.
   */
  interface SentenceRange {
    start: number;
    end: number;
  }
  const getSentenceRangesFromOriginal = (text: string): SentenceRange[] => {
    const ranges: SentenceRange[] = [];
    // Match spaces following a sentence‑ending punctuation optionally followed
    // by a closing quote, or any sequence of newlines.  This ensures that
    // sentences ending in .", !", ?", etc. are properly detected.
    const regex = /(?<=[.!?]["'”’]?)\s+|\n+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const end = match.index + match[0].length;
      ranges.push({ start: lastIndex, end });
      lastIndex = end;
    }
    ranges.push({ start: lastIndex, end: text.length });
    return ranges.filter((r) => text.slice(r.start, r.end).trim().length > 0);
  };

  // Effect: scroll the highlighted sentence into view when it changes
  useEffect(() => {
    if (!isSpeaking) return;
    if (typeof window === 'undefined') return;
    const overlayEl = overlayRef.current;
    if (!overlayEl) return;
    const currentSpan = overlayEl.querySelector('span[data-current="true"]') as HTMLElement | null;
    if (currentSpan) {
      // Instead of placing the highlighted line flush against the bottom of the
      // container, offset the scroll position upward slightly so there is room
      // to show a few lines below the highlight.  We calculate a margin as a
      // fraction of the overlay height (25%) and subtract it from the
      // element's offsetTop.  Then we clamp within the scrollable range.
      const margin = overlayEl.clientHeight * 0.25;
      const desiredTop = currentSpan.offsetTop - margin;
      const maxScrollTop = overlayEl.scrollHeight - overlayEl.clientHeight;
      const newScrollTop = Math.max(0, Math.min(desiredTop, maxScrollTop));
      overlayEl.scrollTo({ top: newScrollTop, behavior: 'smooth' });
    }
  }, [isSpeaking, currentSentenceIndex, editorContent]);

  // Effect: detect clicks inside the editor and remember the sentence index
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const textarea = document.querySelector('.editor-textarea') as HTMLTextAreaElement | null;
    if (!textarea) return;
    const clickHandler = () => {
      const pos = textarea.selectionStart;
      const ranges = getSentenceRangesFromOriginal(editorContent);
      let idx = 0;
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        if (!range) continue;
        const { start, end } = range;
        if (pos >= start && pos <= end) {
          idx = i;
          break;
        }
      }
      setStartSentenceIndex(idx);
      startSentenceRef.current = idx;
      setCurrentSentenceIndex(idx);
    };
    textarea.addEventListener('click', clickHandler);
    return () => {
      textarea.removeEventListener('click', clickHandler);
    };
  }, [editorContent]);

  // Do not render anything if modal is closed
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1000,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.modalBg,
        color: theme.text,
        padding: '0.5rem',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left group: title, word count, and sentence progress */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>{currentFileName || 'New File'}</span>
          <span>{wordCount.toLocaleString()} words</span>
          {isSpeaking && sentences.length > 0 && (
            <span>
              (Sentence {currentSentenceIndex + 1} of {sentences.length})
              {isGeneratingNext && ' • Generating...'}
            </span>
          )}
        </div>
        {/* Right group: action buttons and voice selection */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <StyledSmallButton
            onClick={handleSave}
            disabled={isSaving}
            title={currentFilePath ? 'Update file' : 'Save as .txt'}
            theme={theme}
          >
            {isSaving ? 'Saving…' : currentFilePath ? 'Update' : 'Save as .txt'}
          </StyledSmallButton>
          <StyledSmallButton
            onClick={handleOpen}
            disabled={isOpening}
            title="Open file"
            theme={theme}
          >
            {isOpening ? 'Opening…' : 'Open'}
          </StyledSmallButton>
          {/* New button to strip Markdown formatting */}
          <StyledSmallButton
            onClick={handleCleanMarkdown}
            disabled={!editorContent || !editorContent.trim()}
            title="Remove Markdown formatting"
            theme={theme}
          >
            Clean MD
          </StyledSmallButton>
          <select
            value={selectedVoice}
            onChange={(e) => handleVoiceChange(e.target.value)}
            disabled={!isClientHydrated || isSpeaking || isLoadingVoices}
            title="Select voice for text-to-speech"
            style={{
              padding: '3px 6px',
              backgroundColor:
                !isClientHydrated || isSpeaking || isLoadingVoices ? '#6c757d' : theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor:
                !isClientHydrated || isSpeaking || isLoadingVoices ? 'not-allowed' : 'pointer',
              maxWidth: '140px',
            }}
          >
            {!isClientHydrated ? (
              <option>Initializing...</option>
            ) : isLoadingVoices ? (
              <option>Loading voices...</option>
            ) : (
              availableVoices.map((voice: any) => {
                const displayName = voice.ShortName
                  .replace(/^[a-z]{2}-[A-Z]{2}-/, '')
                  .replace(/Neural$|Multilingual$|MultilingualNeural$/, '')
                  .replace(/([A-Z])/g, ' $1')
                  .trim();
                const locale = voice.Locale?.replace('en-', '') || '';
                const gender = voice.Gender || '';
                return (
                  <option key={voice.ShortName} value={voice.ShortName}>
                    {displayName} ({locale} {gender})
                  </option>
                );
              })
            )}
          </select>
          <StyledSmallButton
            onClick={handleSpeak}
            disabled={!isClientHydrated || isLoadingVoices || isGeneratingInitial}
            title="Speak / Pause / Resume"
            theme={theme}
          >
            {!isClientHydrated
              ? 'Loading…'
              : isLoadingVoices
              ? 'Loading…'
              : isGeneratingInitial
              ? 'Generating…'
              : isSpeaking
              ? isPaused
                ? '▶️ Resume'
                : '⏸️ Pause'
              : '🔊 Speak'}
          </StyledSmallButton>
          <StyledSmallButton
            onClick={handleStopAndScroll}
            disabled={!isSpeaking && !isPaused}
            title="Stop speaking"
            theme={theme}
          >
            ⏹️ Quiet
          </StyledSmallButton>
          <StyledSmallButton
            onClick={() => {
              handleStop();
              onClose();
            }}
            theme={theme}
          >
            Close
          </StyledSmallButton>
        </div>
      </div>
      {/* Editor and overlay container */}
      <div
        style={{
          position: 'relative',
          marginTop: '0.5rem',
        }}
      >
        {/* Editor body: using a plain textarea to improve performance on large files */}
        <textarea
          className="editor-textarea"
          value={editorContent}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={`Write your content for ${currentProject || 'your project'}...`}
          style={{
            width: '100%',
            height: typeof window !== 'undefined' ? window.innerHeight - 200 : 400,
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: 'Georgia, serif',
            padding: '0.5rem',
            border: `1px solid ${theme.border}`,
            borderRadius: '4px',
            backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
            color: theme.text,
            resize: 'vertical',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
          }}
        />
        {/* Overlay: highlight preview on top of the editor when speaking */}
        {isSpeaking && sentences.length > 0 && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              padding: '0.5rem',
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
              color: theme.text,
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
          />
        )}
      </div>
    </div>
  );
}