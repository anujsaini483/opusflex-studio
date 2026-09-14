import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  CloudUpload,
  Download,
  FileVideo,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

type DurationPreset = 'under15' | '15-30' | '30-60' | 'custom';
type Aspect = '9:16' | '1:1' | '16:9';
type CaptionPosition = 'top' | 'center' | 'bottom';
type CaptionWord = { text: string; start: number; end: number };
type AudioGraph = {
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
};
type Clip = {
  id: number;
  title: string;
  start: number;
  length: number;
  score: number;
  sourceName: string;
  createdAt: number;
};
type RenderedVideo = { blob: Blob; filename: string };

const queryClient = new QueryClient();
const DEMO_DURATION = 12;
const RECENT_STORAGE_KEY = 'opusflex-recent-videos';

const seedClips: Clip[] = [
  { id: 1, title: 'The perfect moment is a myth', start: 0, length: 4, score: 94, sourceName: 'Creator mindset demo', createdAt: 1 },
  { id: 2, title: 'Stop waiting to publish', start: 4, length: 4, score: 87, sourceName: 'Creator mindset demo', createdAt: 1 },
  { id: 3, title: 'Your first 10 ideas are bad', start: 8, length: 4, score: 81, sourceName: 'Creator mindset demo', createdAt: 1 },
];

function formatTime(seconds: number) {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function readRecentClips() {
  if (typeof window === 'undefined') return seedClips;
  try {
    const saved = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!saved) return seedClips;
    const parsed = JSON.parse(saved) as Clip[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedClips;
  } catch {
    return seedClips;
  }
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function downloadBlob(blob: Blob, filename: string) {
  const href = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(href), 1200);
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: string) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener(eventName, finish);
      resolve();
    };
    video.addEventListener(eventName, finish, { once: true });
    window.setTimeout(finish, 1200);
  });
}

async function ensureVideoReady(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(video.duration) || video.duration <= 0) {
    await waitForVideoEvent(video, 'loadedmetadata');
  }
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    await waitForVideoEvent(video, 'canplay');
  }
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  if (duration <= 0) throw new Error('video metadata is unavailable');
  return duration;
}

function getVideoCaptureStream(video: HTMLVideoElement) {
  const source = video as unknown as {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  return source.captureStream?.() ?? source.mozCaptureStream?.() ?? null;
}

function createDemoVideo() {
  const canvas = document.createElement('canvas');
  const demoWidth = 640;
  const demoHeight = 360;
  canvas.width = 1280;
  canvas.height = 720;
  const mimeType = getRecordingMimeType();
  const context = canvas.getContext('2d');
  if (!mimeType || !context || !canvas.captureStream) return Promise.resolve('');
  context.scale(canvas.width / demoWidth, canvas.height / demoHeight);

  const stream = canvas.captureStream(30);
  let audioContext: AudioContext | null = null;
  let demoOscillator: OscillatorNode | null = null;
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor) {
      audioContext = new AudioContextConstructor();
      const audioDestination = audioContext.createMediaStreamDestination();
      const gain = audioContext.createGain();
      demoOscillator = audioContext.createOscillator();
      demoOscillator.type = 'sine';
      demoOscillator.frequency.setValueAtTime(180, audioContext.currentTime);
      demoOscillator.frequency.linearRampToValueAtTime(240, audioContext.currentTime + DEMO_DURATION);
      gain.gain.value = 0.035;
      demoOscillator.connect(gain);
      gain.connect(audioDestination);
      audioDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      demoOscillator.start();
      void audioContext.resume();
    }
  } catch {
    audioContext = null;
    demoOscillator = null;
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];

  return new Promise<string>((resolve) => {
    let frame = 0;
    const totalFrames = DEMO_DURATION * 30;
    const draw = () => {
      const progress = frame / totalFrames;
      const gradient = context.createLinearGradient(0, 0, demoWidth, demoHeight);
      gradient.addColorStop(0, '#171b31');
      gradient.addColorStop(0.5, '#554779');
      gradient.addColorStop(1, '#171c31');
      context.fillStyle = gradient;
      context.fillRect(0, 0, demoWidth, demoHeight);

      const cardX = demoWidth * (0.22 + progress * 0.18);
      context.fillStyle = 'rgba(137, 109, 208, .3)';
      context.fillRect(cardX, 96, 230, 142);
      context.fillStyle = 'rgba(228, 240, 59, .9)';
      context.fillRect(cardX + 26, 130, 88, 6);
      context.fillStyle = 'rgba(243, 239, 255, .55)';
      context.fillRect(cardX + 26, 154, 142, 4);
      context.fillRect(cardX + 26, 174, 112, 4);
      context.fillStyle = 'rgba(64, 39, 61, .8)';
      context.fillRect(cardX + 26, 204, 54 + progress * 90, 5);
      context.fillStyle = '#e4f03b';
      context.fillRect(44 + progress * 120, 54, 58, 4);
      context.fillStyle = 'rgba(220, 207, 255, .7)';
      context.fillRect(42, 34, 94, 4);
      context.fillStyle = '#f3efff';
      context.font = '700 18px Inter, sans-serif';
      context.fillText(progress < 0.45 ? 'CREATOR MINDSET' : 'PUBLISH BEFORE PERFECT', 42, 315);
      frame += 1;
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      demoOscillator?.stop();
      void audioContext?.close();
      stream.getTracks().forEach((track) => track.stop());
      resolve('');
    };
    recorder.onstop = () => {
      demoOscillator?.stop();
      void audioContext?.close();
      stream.getTracks().forEach((track) => track.stop());
      resolve(URL.createObjectURL(new Blob(chunks, { type: mimeType })));
    };
    recorder.start(100);
    draw();
    const timer = window.setInterval(() => {
      draw();
      if (frame >= totalFrames) {
        window.clearInterval(timer);
        recorder.stop();
      }
    }, 33);
  });
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary resetKey="/">
          <Studio />
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function Studio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const demoUrlRef = useRef('');
  const sourceUrlsRef = useRef(new Set<string>());
  const clipSourceUrlsRef = useRef<Record<number, string>>({});
  const renderedVideosRef = useRef<Record<number, RenderedVideo>>({});
  const audioGraphsRef = useRef(new WeakMap<HTMLVideoElement, AudioGraph>());
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceDuration, setSourceDuration] = useState(DEMO_DURATION);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('under15');
  const [customDuration, setCustomDuration] = useState(15);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [clipCount, setClipCount] = useState(5);
  const [showCaption, setShowCaption] = useState(true);
  const [captionText, setCaptionText] = useState('Make the boring part visible');
  const [captionWords, setCaptionWords] = useState<CaptionWord[]>([]);
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>('bottom');
  const [captionColor, setCaptionColor] = useState('#E4F03B');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recentClips, setRecentClips] = useState<Clip[]>(readRecentClips);
  const [exportQueue, setExportQueue] = useState<number[]>([]);
  const [exportProgress, setExportProgress] = useState<Record<number, number>>({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    void createDemoVideo().then((url) => {
      if (!url || cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      demoUrlRef.current = url;
      sourceUrlsRef.current.add(url);
      setVideoUrl(url);
      setSourceDuration(DEMO_DURATION);
      const existing = readRecentClips();
      existing.forEach((clip) => {
        clipSourceUrlsRef.current[clip.id] = url;
      });
      setToast('Demo video ready');
    });
    return () => {
      cancelled = true;
      sourceUrlsRef.current.forEach((sourceUrl) => URL.revokeObjectURL(sourceUrl));
      sourceUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentClips.slice(0, 30)));
    } catch {
      // Local history is best-effort when browser storage is disabled.
    }
  }, [recentClips]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      void video.play().catch(() => {
        setPlaying(false);
        setToast('Press play again to start this video');
      });
    } else {
      video.pause();
    }
  }, [playing, videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateTime = () => setCurrentTime(video.currentTime);
    const loadMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setSourceDuration(video.duration);
      }
    };
    const ended = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', loadMetadata);
    video.addEventListener('ended', ended);
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', loadMetadata);
      video.removeEventListener('ended', ended);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(value + 10, 100);
        if (next < 100) return next;

        window.clearInterval(timer);
        const requestedLength = durationPreset === 'custom' ? customDuration : durationPreset === 'under15' ? 12 : durationPreset === '15-30' ? 24 : 45;
        const length = Math.max(1, Math.min(requestedLength, Math.max(1, sourceDuration - 0.2)));
        const maxStart = Math.max(0, sourceDuration - length);
        const step = clipCount > 1 ? maxStart / (clipCount - 1) : 0;
        const titles = [
          'The perfect moment is a myth',
          'Stop waiting to publish',
          'Your first 10 ideas are bad',
          'Make the boring part visible',
          'Consistency beats the algorithm',
          'The audience can feel your doubt',
        ];
        const sourceName = videoFile?.name ?? 'Creator mindset demo';
        const made = Array.from({ length: clipCount }, (_, index) => ({
          id: Date.now() + index,
          title: titles[index % titles.length],
          start: Math.round(Math.min(index * step, maxStart) * 10) / 10,
          length: Math.round(length * 10) / 10,
          score: Math.max(73, 96 - index * 4),
          sourceName,
          createdAt: Date.now(),
        }));
        made.forEach((clip) => {
          clipSourceUrlsRef.current[clip.id] = videoUrl;
        });
        setRecentClips((current) => [...made, ...current]);
        setProgress(100);
        setProcessing(false);
        setToast(`${made.length} videos ready`);
        return 100;
      });
    }, 140);
    return () => window.clearInterval(timer);
  }, [processing, clipCount, customDuration, durationPreset, sourceDuration, videoFile, videoUrl]);

  function handleFile(file?: File) {
    if (!file || !file.type.startsWith('video/')) {
      setToast('Please choose an MP4, MOV, or WebM video');
      return;
    }
    const url = URL.createObjectURL(file);
    sourceUrlsRef.current.add(url);
    setVideoFile(file);
    setVideoUrl(url);
    setSourceDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setToast('Video uploaded locally');
  }

  async function loadDemo() {
    setPlaying(false);
    const url = demoUrlRef.current || await createDemoVideo();
    if (!url) {
      setToast('This browser cannot create the demo video');
      return;
    }
    demoUrlRef.current = url;
    sourceUrlsRef.current.add(url);
    setVideoFile(null);
    setVideoUrl(url);
    setSourceDuration(DEMO_DURATION);
    setCurrentTime(0);
    setToast('Demo video loaded');
  }

  function resetWorkspace() {
    setProcessing(false);
    setProgress(0);
    setExportQueue([]);
    setExportProgress({});
    renderedVideosRef.current = {};
    void loadDemo();
    setToast('New project started');
  }

  function generateClips() {
    if (!videoUrl) {
      setToast('Upload a video first');
      return;
    }
    setProgress(0);
    setProcessing(true);
    setToast('Analyzing video locally…');
  }

  function generateCaptions() {
    const text = captionText.trim();
    if (!text) {
      setToast('Write caption text first');
      return;
    }
    const words = text.split(/\s+/).filter(Boolean);
    const wordDuration = Math.max(0.28, sourceDuration / Math.max(words.length, 1));
    setCaptionWords(words.map((word, index) => ({
      text: word,
      start: index * wordDuration,
      end: Math.min(sourceDuration, (index + 1) * wordDuration),
    })));
    setShowCaption(true);
    setToast('Timed captions generated locally');
  }

  function getCaptionLine(time: number) {
    if (!captionWords.length) return captionText.trim();
    const activeIndex = captionWords.findIndex((word) => time >= word.start && time <= word.end);
    if (activeIndex < 0) return '';
    return captionWords.slice(Math.max(0, activeIndex - 1), Math.min(captionWords.length, activeIndex + 2)).map((word) => word.text).join(' ');
  }

  async function getAudioTracksForExport(video: HTMLVideoElement) {
    const directStream = getVideoCaptureStream(video);
    const directTracks = directStream?.getAudioTracks() ?? [];
    if (directTracks.length > 0) return directTracks;
    const AudioContextConstructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return [];
    try {
      let graph = audioGraphsRef.current.get(video);
      if (!graph) {
        const context = new AudioContextConstructor();
        const source = context.createMediaElementSource(video);
        const destination = context.createMediaStreamDestination();
        source.connect(destination);
        graph = { context, destination };
        audioGraphsRef.current.set(video, graph);
      }
      await graph.context.resume();
      return graph.destination.stream.getAudioTracks();
    } catch {
      return [];
    }
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = Math.max(0, Math.min(sourceDuration, ((event.clientX - bounds.left) / bounds.width) * sourceDuration));
    setCurrentTime(next);
    if (videoRef.current) videoRef.current.currentTime = next;
  }

  function selectClip(clip: Clip) {
    setCurrentTime(clip.start);
    if (videoRef.current) videoRef.current.currentTime = clip.start;
  }

  function deleteClip(clip: Clip) {
    setRecentClips((current) => current.filter((item) => item.id !== clip.id));
    delete renderedVideosRef.current[clip.id];
    delete clipSourceUrlsRef.current[clip.id];
    setToast('Video removed from recent history');
  }

  async function downloadClip(clip: Clip, clipNumber: number) {
    const previous = renderedVideosRef.current[clip.id];
    if (previous) {
      downloadBlob(previous.blob, previous.filename);
      setToast('Download started');
      return;
    }
    if (exportProgress[clip.id] && exportProgress[clip.id] < 100) return;

    const mimeType = getRecordingMimeType();
    const sourceUrl = clipSourceUrlsRef.current[clip.id] ?? videoUrl;
    const video = sourceUrl === videoUrl ? videoRef.current : document.createElement('video');
    if (!mimeType || !video || !sourceUrl) {
      setToast('Upload the original source again to export this video');
      return;
    }

    const canvas = document.createElement('canvas');
    const targetDimensions = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080];
    const sourceLongEdge = Math.max(video.videoWidth || targetDimensions[0], video.videoHeight || targetDimensions[1]);
    const targetLongEdge = Math.max(targetDimensions[0], targetDimensions[1]);
    const outputScale = Math.min(1, sourceLongEdge / targetLongEdge);
    const dimensions = targetDimensions.map((dimension) => Math.max(2, Math.floor((dimension * outputScale) / 2) * 2));
    canvas.width = dimensions[0];
    canvas.height = dimensions[1];
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context || !canvas.captureStream) {
      setToast('Video export is not supported in this browser');
      return;
    }

    setExportQueue((current) => current.includes(clip.id) ? current : [...current, clip.id]);
    setExportProgress((current) => ({ ...current, [clip.id]: 1 }));
    const oldMuted = video.muted;
    const oldVolume = video.volume;
    if (video !== videoRef.current) {
      video.muted = false;
      video.volume = 0;
      video.playsInline = true;
      video.src = sourceUrl;
    }

    const loadedDuration = await ensureVideoReady(video);
    const oldTime = video.currentTime;
    const oldPlaying = playing;
    const duration = loadedDuration || sourceDuration;
    const start = Math.max(0, Math.min(clip.start, Math.max(0, duration - 0.05)));
    const availableLength = Math.max(0, duration - start);
    if (availableLength + 0.05 < clip.length) {
      setExportProgress((current) => ({ ...current, [clip.id]: 0 }));
      setToast(`This source has only ${formatTime(availableLength)} left from the selected start`);
      return;
    }
    const length = clip.length;
    let canvasStream: MediaStream | null = null;
    let sourceStream: MediaStream | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    const drawFrame = (elapsed: number) => {
      const width = canvas.width;
      const height = canvas.height;
      const targetAspect = width / height;
      const sourceAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      const movement = Math.sin((elapsed / length) * Math.PI * 2) * 0.07;
      const zoom = 1 + Math.sin((elapsed / length) * Math.PI) * 0.035;
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;
      let sourceX = 0;
      let sourceY = 0;
      if (sourceAspect > targetAspect) {
        sourceWidth = video.videoHeight * targetAspect / zoom;
        sourceX = (video.videoWidth - sourceWidth) * (0.5 + movement);
      } else {
        sourceHeight = video.videoWidth / targetAspect / zoom;
        sourceY = (video.videoHeight - sourceHeight) * 0.5;
      }
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

      const captionLine = getCaptionLine(start + elapsed);
      if (showCaption && captionLine) {
        const captionY = captionPosition === 'top' ? height * 0.16 : captionPosition === 'center' ? height * 0.5 : height * 0.82;
        context.font = `800 ${Math.max(28, Math.round(58 * (height / 1920)))}px Inter, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = Math.max(5, height / 260);
        context.strokeStyle = 'rgba(0,0,0,.82)';
        const maxTextWidth = width * 0.84;
        const captionLines: string[] = [];
        let line = '';
        captionLine.split(/\s+/).forEach((word) => {
          const candidate = line ? `${line} ${word}` : word;
          if (context.measureText(candidate).width > maxTextWidth && line) {
            captionLines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });
        if (line) captionLines.push(line);
        context.fillStyle = captionColor;
        const lineHeight = Math.max(34, Math.round(70 * (height / 1920)));
        captionLines.forEach((captionLineText, index) => {
          const lineY = captionY + (index - (captionLines.length - 1) / 2) * lineHeight;
          context.strokeText(captionLineText, width / 2, lineY);
          context.fillText(captionLineText, width / 2, lineY);
        });
      }
    };

    try {
      video.pause();
      video.currentTime = start;
      await waitForVideoEvent(video, 'seeked');
      video.muted = false;
      video.volume = 0;
      await video.play();
      canvasStream = canvas.captureStream(30);
      sourceStream = getVideoCaptureStream(video);
      const audioTracks = await getAudioTracksForExport(video);
      if (audioTracks.length === 0) {
        setToast('No audio track found in this source video');
      }
      stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      const pixels = canvas.width * canvas.height;
      const videoBitsPerSecond = pixels >= 1_500_000 ? 18_000_000 : pixels >= 800_000 ? 12_000_000 : 8_000_000;
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
      const chunks: BlobPart[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('recorder unavailable'));
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('recording failed'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      recorder.start(250);
      const startedAt = performance.now();
      const frameVideo = video as unknown as {
        requestVideoFrameCallback?: (callback: (now: number) => void) => number;
        cancelVideoFrameCallback?: (handle: number) => void;
      };
      const requestFrame = frameVideo.requestVideoFrameCallback;
      const cancelFrame = frameVideo.cancelVideoFrameCallback;
      const hasVideoFrameCallback = typeof requestFrame === 'function';
      const scheduleFrame = (callback: (now: number) => void) => requestFrame
        ? requestFrame.call(frameVideo, callback)
        : window.requestAnimationFrame(callback);
      let frameRequest = 0;
      let lastFallbackFrame = 0;
      let lastProgressUpdate = 0;
      await new Promise<void>((resolve) => {
        const renderFrame = (now: number) => {
          if (!hasVideoFrameCallback && now - lastFallbackFrame < 30) {
            frameRequest = window.requestAnimationFrame(renderFrame);
            return;
          }
          lastFallbackFrame = now;
          const elapsed = Math.min(length, (now - startedAt) / 1000);
          drawFrame(elapsed);
          if (now - lastProgressUpdate > 180 || elapsed >= length) {
            lastProgressUpdate = now;
            setExportProgress((current) => ({ ...current, [clip.id]: Math.min(96, Math.max(2, Math.round((elapsed / length) * 96))) }));
          }
          if (elapsed >= length) {
            if (hasVideoFrameCallback && cancelFrame) cancelFrame.call(frameVideo, frameRequest);
            resolve();
            return;
          }
          frameRequest = scheduleFrame(renderFrame);
        };
        frameRequest = scheduleFrame(renderFrame);
      });
      drawFrame(length);
      video.pause();
      recorder.stop();
      const blob = await finished;
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const filename = `Short_Clip_${clipNumber}.${extension}`;
      renderedVideosRef.current[clip.id] = { blob, filename };
      setExportProgress((current) => ({ ...current, [clip.id]: 100 }));
      downloadBlob(blob, filename);
      setToast(`${extension.toUpperCase()} download started`);
    } catch {
      setExportProgress((current) => ({ ...current, [clip.id]: 0 }));
      setToast('Export failed. Try the video again in Chrome or Safari.');
    } finally {
      canvasStream?.getTracks().forEach((track) => track.stop());
      sourceStream?.getTracks().forEach((track) => track.stop());
      video.pause();
      if (video === videoRef.current) {
        video.muted = oldMuted;
        video.volume = oldVolume;
        video.currentTime = oldTime;
        if (oldPlaying) void video.play().catch(() => undefined);
      } else {
        video.removeAttribute('src');
        video.load();
      }
    }
  }

  const previewRatio = aspect === '9:16' ? '9 / 16' : aspect === '1:1' ? '1 / 1' : '16 / 9';
  const progressFor = (clip: Clip) => exportProgress[clip.id];

  return (
    <div className="studio-noise min-h-[100dvh] overflow-x-hidden bg-[#11111b] text-[#e5e4ed]">
      <header className="flex h-[68px] items-center justify-between border-b border-[#29273a] bg-[#151521] px-3 sm:px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-black"><Sparkles size={18} /></div>
          <div>
            <div className="studio-display text-[17px] font-bold tracking-tight text-[#f4f2fb]">opus<span className="text-[#ab88ff]">flex</span> <span className="text-[#e4f03b]">AI</span></div>
            <div className="studio-mono text-[9px] uppercase tracking-[.18em] text-[#77738b]">simple video maker</div>
          </div>
        </div>
        <div className="hidden rounded-full border border-[#333047] bg-[#1b1a29] px-3 py-1.5 text-[11px] text-[#a7a3b4] sm:block">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#b8ff75]" />Works in your browser · No API key
        </div>
        <button data-testid="button-reset" onClick={resetWorkspace} className="rounded-md border border-[#343148] px-3 py-2 text-[11px] text-[#aaa5ba] hover:border-[#75659a] hover:text-white"><RotateCcw size={13} className="mr-1.5 inline" />New video</button>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-px bg-[#29273a] lg:grid-cols-[260px_minmax(0,1fr)_310px] xl:grid-cols-[290px_minmax(0,1fr)_340px]">
        <aside className="bg-[#161620] p-4 sm:p-5">
          <PanelTitle label="1 / Upload" title="Add your video" />
          <div
            data-testid="dropzone-video"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }}
            className={`mt-5 cursor-pointer rounded-xl border border-dashed p-6 text-center transition-colors ${dragging ? 'border-[#e4f03b] bg-[#e4f03b]/10' : 'border-[#49435e] bg-[#1d1b2a] hover:border-[#9b76ff]'}`}
          >
            <input ref={inputRef} data-testid="input-video-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#2a2542] text-[#a98bff]"><CloudUpload size={20} /></div>
            <div className="text-[13px] font-semibold text-[#e6e2f0]">{videoFile ? 'Change video' : 'Upload video'}</div>
            <div className="mt-1 text-[10px] text-[#807b90]">MP4, MOV, WebM · stays on device</div>
            {videoFile && <div className="mt-3 truncate rounded-md bg-[#12121b] px-2 py-1.5 text-left text-[10px] text-[#b1a9ca]"><FileVideo size={12} className="mr-1 inline text-[#e4f03b]" />{videoFile.name}</div>}
          </div>
          <button data-testid="button-load-demo" onClick={() => { void loadDemo(); }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#342f4b] py-2 text-[11px] text-[#b0a8c0] hover:border-[#7157ad] hover:text-white"><Upload size={13} />Use demo video</button>

          <div className="my-6 h-px bg-[#2d2a3c]" />
          <PanelTitle label="2 / Video length" title="How long should each clip be?" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([['under15', 'Under 15 sec'], ['15-30', '15–30 sec'], ['30-60', '30–60 sec'], ['custom', 'Custom']] as [DurationPreset, string][]).map(([value, label]) => (
              <button data-testid={`button-duration-${value}`} key={value} onClick={() => setDurationPreset(value)} className={`rounded-md border px-2 py-2.5 text-[10px] ${durationPreset === value ? 'border-[#9b76ff] bg-[#332853] text-white' : 'border-[#302d40] bg-[#1b1a27] text-[#868094] hover:border-[#51466d]'}`}>{label}</button>
            ))}
          </div>
          {durationPreset === 'custom' && <div className="mt-3 flex items-center gap-3"><input data-testid="input-custom-duration" type="range" min="5" max="90" value={customDuration} onChange={(event) => setCustomDuration(Number(event.target.value))} className="range-violet min-w-0 flex-1" /><span className="studio-mono w-12 text-right text-[11px] text-[#d9d0f3]">{customDuration}s</span></div>}

          <div className="mt-6">
            <PanelTitle label="3 / Number of videos" title="How many should we make?" />
            <div className="mt-3 flex gap-2">
              {[3, 5, 10].map((value) => <button data-testid={`button-clip-count-${value}`} key={value} onClick={() => setClipCount(value)} className={`flex-1 rounded-md border py-2 text-[10px] ${clipCount === value ? 'border-[#9b76ff] bg-[#332853] text-white' : 'border-[#302d40] bg-[#1b1a27] text-[#868094]'}`}>{value}</button>)}
            </div>
          </div>

          <div className="mt-6">
            <PanelTitle label="4 / Captions" title="Add text to your video" />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-[#c9c2d7]"><input data-testid="checkbox-caption" type="checkbox" checked={showCaption} onChange={(event) => setShowCaption(event.target.checked)} className="accent-[#e4f03b]" />Add caption</label>
            {showCaption && <div className="mt-3 space-y-2">
              <textarea data-testid="input-caption-text" value={captionText} onChange={(event) => setCaptionText(event.target.value)} rows={3} placeholder="Write your caption…" className="w-full resize-none rounded-md border border-[#332f43] bg-[#1b1a27] px-3 py-2 text-[11px] text-[#e9e3f3] outline-none focus:border-[#9b76ff]" />
              <button data-testid="button-generate-captions" onClick={generateCaptions} disabled={!videoUrl || !captionText.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-[#51466d] bg-[#241f35] py-2 text-[10px] font-semibold text-[#cdbdff] hover:border-[#9b76ff] disabled:opacity-50"><WandSparkles size={12} />Generate timed captions</button>
              <p className="text-[9px] leading-relaxed text-[#706a7d]">Splits your text into readable timed words locally. Audio from the uploaded video stays in the export.</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative"><select data-testid="select-caption-position" value={captionPosition} onChange={(event) => setCaptionPosition(event.target.value as CaptionPosition)} className="w-full appearance-none rounded-md border border-[#332f43] bg-[#1b1a27] px-3 py-2 text-[10px] text-[#c9c2d7]"><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select><ChevronDown size={13} className="pointer-events-none absolute right-2 top-2 text-[#797389]" /></div>
                <div className="flex items-center gap-2 rounded-md border border-[#332f43] bg-[#1b1a27] px-2"><input data-testid="input-caption-color" type="color" value={captionColor} onChange={(event) => setCaptionColor(event.target.value)} className="h-6 w-7 cursor-pointer border-0 bg-transparent" /><span className="studio-mono text-[9px] text-[#aaa3b6]">{captionColor}</span></div>
              </div>
            </div>}
          </div>

          <button data-testid="button-generate-clips" onClick={generateClips} disabled={processing || !videoUrl || sourceDuration <= 0} className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-3 text-[12px] font-bold text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Make 5 videos</button>
          {processing && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#28263a]"><div className="h-full rounded-full bg-[#e4f03b] transition-all" style={{ width: `${progress}%` }} /></div>}
        </aside>

        <section className="min-w-0 bg-[#11111a] p-4 sm:p-5 lg:p-7">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-4 flex items-center justify-between">
              <div><div className="studio-mono text-[9px] uppercase tracking-[.15em] text-[#82789d]">Preview</div><h1 className="studio-display mt-1 text-[20px] font-semibold text-white">{videoFile?.name ?? 'Creator mindset demo'}</h1></div>
              <div className="rounded-full border border-[#343148] px-3 py-1.5 text-[10px] text-[#8d879b]">Frame fills output</div>
            </div>
            <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-2xl border border-[#353149] bg-[#0c0d15] shadow-2xl" style={{ aspectRatio: previewRatio }}>
              {videoUrl ? <video ref={videoRef} src={videoUrl} onLoadedMetadata={(event) => { const duration = event.currentTarget.duration; if (Number.isFinite(duration) && duration > 0) setSourceDuration(duration); }} className="h-full w-full object-cover" muted playsInline preload="auto" /> : <DemoPlaceholder />}
              {showCaption && getCaptionLine(currentTime) && <div className={`pointer-events-none absolute left-1/2 w-[86%] -translate-x-1/2 text-center ${captionPosition === 'top' ? 'top-[12%]' : captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[10%]'}`}><span className="rounded-lg bg-black/60 px-3 py-2 text-[clamp(16px,3vw,30px)] font-extrabold text-white" style={{ color: captionColor, textShadow: '0 2px 4px rgba(0,0,0,.9)' }}>{getCaptionLine(currentTime)}</span></div>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button data-testid="button-playback" onClick={() => setPlaying((value) => !value)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">{playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}</button>
              <span className="studio-mono text-[11px] text-[#c4bfd0]">{formatTime(currentTime)} / {formatTime(sourceDuration)}</span>
              <div data-testid="timeline-scrubber" onClick={seek} className="relative h-1.5 min-w-[180px] flex-1 cursor-pointer rounded-full bg-[#302c44]"><div className="h-full rounded-full bg-[#a682ff]" style={{ width: `${sourceDuration ? (currentTime / sourceDuration) * 100 : 0}%` }} /><div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#e4f03b] bg-[#171622]" style={{ left: `calc(${sourceDuration ? (currentTime / sourceDuration) * 100 : 0}% - 6px)` }} /></div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[#292638] pt-4">
              <span className="text-[11px] text-[#8d879b]">Output ratio</span>
              <div className="flex gap-2">{(['9:16', '1:1', '16:9'] as Aspect[]).map((value) => <button data-testid={`button-aspect-${value.replace(':', '-')}`} key={value} onClick={() => setAspect(value)} className={`rounded-md border px-3 py-2 text-[10px] ${aspect === value ? 'border-[#e4f03b] bg-[#323518] text-[#eef28c]' : 'border-[#302d40] text-[#868094]'}`}>{value}</button>)}</div>
            </div>
            <p className="mt-3 text-center text-[10px] text-[#6f697d]">The video fills the selected frame. No small inset or empty bars.</p>
          </div>
        </section>

        <aside className="bg-[#161620] p-4 sm:p-5">
          <div className="flex items-end justify-between"><PanelTitle label="Recent videos" title="Your video history" /><span className="studio-mono text-[10px] text-[#777286]">{recentClips.length} saved</span></div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#777186]">New videos stay here until you delete them.</p>
          <div className="mt-5 space-y-2.5">
            {recentClips.length === 0 && <div className="rounded-lg border border-dashed border-[#3e3850] p-5 text-center text-[11px] text-[#777186]">Your generated videos will appear here.</div>}
            {recentClips.map((clip, index) => {
              const exported = progressFor(clip);
              return (
                <div data-testid={`card-clip-${clip.id}`} key={clip.id} className="rounded-lg border border-[#302d40] bg-[#1b1a27] p-3 hover:border-[#51466d]">
                  <button onClick={() => selectClip(clip)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[11px] font-semibold text-[#ddd9e6]">{clip.title}</div><div className="studio-mono mt-1 truncate text-[9px] text-[#777186]">{formatTime(clip.start)} – {formatTime(clip.start + clip.length)} · {clip.sourceName}</div></div><span className="shrink-0 text-[10px] font-bold text-[#e4f03b]">{clip.score}%</span></div>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button data-testid={`button-export-${clip.id}`} onClick={() => { void downloadClip(clip, index + 1); }} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-80"><Download size={14} /></button>
                    <button data-testid={`button-delete-${clip.id}`} onClick={() => deleteClip(clip)} className="grid w-9 place-items-center rounded-md border border-[#3b354b] text-[#93899f] hover:border-[#ff7f8a] hover:text-[#ff9aa1]"><Trash2 size={14} /></button>
                  </div>
                  {exported !== undefined && exported > 0 && exported < 100 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#373248]"><div className="h-full rounded-full bg-[#e4f03b] transition-[width]" style={{ width: `${exported}%` }} /></div>}
                </div>
              );
            })}
          </div>
        </aside>
      </main>
      {toast && <div data-testid="status-toast" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#5a4b7e] bg-[#29233d] px-4 py-2.5 text-[11px] text-[#eae3fb] shadow-2xl"><Check size={14} className="text-[#e4f03b]" />{toast}</div>}
    </div>
  );
}

function PanelTitle({ label, title }: { label: string; title: string }) {
  return <div><div className="studio-mono text-[9px] uppercase tracking-[.15em] text-[#82789d]">{label}</div><h2 className="studio-display mt-1 text-[16px] font-semibold tracking-tight text-[#e9e5f1]">{title}</h2></div>;
}

function DemoPlaceholder() {
  return <div className="relative grid h-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_70%_25%,rgba(155,118,255,.34),transparent_28%),linear-gradient(135deg,#16192d,#2c2747_55%,#151827)]">
    <div className="w-[58%] rounded-xl border border-[#a987ff]/30 bg-[#161526]/60 p-6 shadow-2xl backdrop-blur-sm">
      <div className="mb-5 h-1.5 w-16 rounded-full bg-[#e4f03b]" />
      <div className="space-y-2">
        <div className="h-2 w-4/5 rounded-full bg-[#e8e1fa]/60" />
        <div className="h-2 w-3/5 rounded-full bg-[#e8e1fa]/30" />
        <div className="h-2 w-2/5 rounded-full bg-[#e8e1fa]/20" />
      </div>
      <div className="mt-7 text-center text-[10px] uppercase tracking-[.18em] text-[#bcb1dc]">Preparing demo video</div>
    </div>
  </div>;
}

export default App;
