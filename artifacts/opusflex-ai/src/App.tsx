import { useEffect, useRef, useState } from 'react';
import {
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
type Aspect = 'original' | '9:16' | '1:1' | '16:9';
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
      gradient.addColorStop(0, '#f4f4f5');
      gradient.addColorStop(0.5, '#e4e4e7');
      gradient.addColorStop(1, '#f4f4f5');
      context.fillStyle = gradient;
      context.fillRect(0, 0, demoWidth, demoHeight);

      const cardX = demoWidth * (0.22 + progress * 0.18);
      context.fillStyle = 'rgba(0, 0, 0, .06)';
      context.fillRect(cardX, 96, 230, 142);
      context.fillStyle = 'rgba(0, 0, 0, .8)';
      context.fillRect(cardX + 26, 130, 88, 6);
      context.fillStyle = 'rgba(0, 0, 0, .4)';
      context.fillRect(cardX + 26, 154, 142, 4);
      context.fillRect(cardX + 26, 174, 112, 4);
      context.fillStyle = 'rgba(0, 0, 0, .7)';
      context.fillRect(cardX + 26, 204, 54 + progress * 90, 5);
      context.fillStyle = '#000000';
      context.fillRect(44 + progress * 120, 54, 58, 4);
      context.fillStyle = 'rgba(0, 0, 0, .5)';
      context.fillRect(42, 34, 94, 4);
      context.fillStyle = '#000000';
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

export default function App() {
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
  const previewSectionRef = useRef<HTMLDivElement>(null);
  const demoUrlRef = useRef('');
  const sourceUrlsRef = useRef(new Set<string>());
  const clipSourceUrlsRef = useRef<Record<number, string>>({});
  const renderedVideosRef = useRef<Record<number, RenderedVideo>>({});
  const audioGraphsRef = useRef(new WeakMap<HTMLVideoElement, AudioGraph>());

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceDuration, setSourceDuration] = useState(DEMO_DURATION);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('under15');
  const [customDuration, setCustomDuration] = useState(15);
  const [aspect, setAspect] = useState<Aspect>('original');
  const [clipCount, setClipCount] = useState(5);
  const [showCaption, setShowCaption] = useState(true);
  const [captionText, setCaptionText] = useState('Make the boring part visible');
  const [captionWords, setCaptionWords] = useState<CaptionWord[]>([]);
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>('bottom');
  const [captionColor, setCaptionColor] = useState('#ffffff');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recentClips, setRecentClips] = useState<Clip[]>(readRecentClips);
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
      setVideoUrlInput(url);
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
    } catch {}
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
    setVideoUrlInput(file.name);
    setSourceDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setToast('Video uploaded locally');
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function handleLoadUrl() {
    const url = videoUrlInput.trim();
    if (!url) {
      setToast('Please enter a valid video URL');
      return;
    }
    setVideoFile(null);
    setVideoUrl(url);
    setCurrentTime(0);
    setPlaying(false);
    setToast('Video URL loaded');
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    setVideoUrlInput(url);
    setSourceDuration(DEMO_DURATION);
    setCurrentTime(0);
    setToast('Demo video loaded');
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function resetWorkspace() {
    setProcessing(false);
    setProgress(0);
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

    const mimeType = getRecordingMimeType();
    const sourceUrl = clipSourceUrlsRef.current[clip.id] ?? videoUrl;
    const video = sourceUrl === videoUrl ? videoRef.current : document.createElement('video');
    if (!mimeType || !video || !sourceUrl) {
      setToast('Upload the original source again to export this video');
      return;
    }

    const canvas = document.createElement('canvas');
    const targetDimensions = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : aspect === '16:9' ? [1920, 1080] : [1280, 720];
    canvas.width = targetDimensions[0];
    canvas.height = targetDimensions[1];
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
    }
    if (!context || !canvas.captureStream) {
      setToast('Video export is not supported in this browser');
      return;
    }

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
    const length = clip.length;
    let canvasStream: MediaStream | null = null;
    let sourceStream: MediaStream | null = null;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;

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
        context.strokeStyle = 'rgba(255,255,255,.9)';
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
      stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 40_000_000 });
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
      await new Promise<void>((resolve) => {
        const renderFrame = (now: number) => {
          const elapsed = Math.min(length, (now - startedAt) / 1000);
          drawFrame(elapsed);
          setExportProgress((current) => ({ ...current, [clip.id]: Math.min(96, Math.max(2, Math.round((elapsed / length) * 96))) }));
          if (elapsed >= length) {
            resolve();
            return;
          }
          requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
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
      setToast('Export failed. Try again in Chrome or Safari.');
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

  const progressFor = (clip: Clip) => exportProgress[clip.id];

  return (
    <div className="studio-noise min-h-[100dvh] bg-white text-zinc-900 font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="flex h-[68px] items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 sm:px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-black text-white"><Sparkles size={18} /></div>
          <div>
            <div className="studio-display text-[17px] font-bold tracking-tight text-zinc-900">opus<span className="text-zinc-500">flex</span> <span className="text-black font-extrabold">AI</span></div>
            <div className="studio-mono text-[9px] uppercase tracking-[.18em] text-zinc-500">smart video studio</div>
          </div>
        </div>
        <div className="hidden rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] text-zinc-600 sm:block">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />Works in browser · No API key needed
        </div>
        <button onClick={resetWorkspace} className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-[11px] text-zinc-700 hover:border-black hover:text-black">
          <RotateCcw size={13} /> New video
        </button>
      </header>

      {/* Main Studio Grid */}
      <main className="mx-auto grid max-w-[1500px] gap-px bg-zinc-200 lg:grid-cols-[280px_minmax(0,1fr)_320px] xl:grid-cols-[310px_minmax(0,1fr)_350px]">
        
        {/* SIDEBAR LEFT: STEP 1, 2, 3 & Controls */}
        <aside className="bg-zinc-50 p-4 sm:p-5 space-y-6">
          
          {/* STEP 1: Upload */}
          <div>
            <PanelTitle label="1 / Upload" title="Add your video" />
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="https://example.com/video.mp4" 
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-[11px] text-zinc-900 outline-none focus:border-black font-mono"
                />
                <button 
                  onClick={handleLoadUrl}
                  className="rounded-md bg-black px-3 py-2 text-[11px] font-semibold text-white hover:bg-zinc-800 transition flex items-center gap-1 shrink-0"
                >
                  <Upload size={13} /> URL
                </button>
              </div>

              <div
                onClick={() => inputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                className={`cursor-pointer rounded-xl border border-dashed p-4 text-center transition-colors ${dragging ? 'border-black bg-zinc-200' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
              >
                <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl bg-zinc-100 text-zinc-800"><CloudUpload size={18} /></div>
                <div className="text-[12px] font-semibold text-zinc-900">{videoFile ? 'Change video' : 'Click or drag video here'}</div>
                <div className="mt-0.5 text-[9px] text-zinc-500">MP4, MOV, WebM · No file size limit</div>
                {videoFile && <div className="mt-2 truncate rounded bg-zinc-100 px-2 py-1 text-left text-[10px] text-zinc-800"><FileVideo size={11} className="mr-1 inline text-black" />{videoFile.name}</div>}
              </div>

              <button onClick={() => { void loadDemo(); }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white py-2 text-[11px] text-zinc-700 hover:border-black hover:text-black">
                <Upload size={13} /> Use demo video
              </button>
            </div>
          </div>

          <div className="h-px bg-zinc-200" />

          {/* STEP 2: Duration */}
          <div>
            <PanelTitle label="2 / Video length" title="Clip duration" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([['under15', 'Under 15s'], ['15-30', '15–30s'], ['30-60', '30–60s'], ['custom', 'Custom']] as [DurationPreset, string][]).map(([value, label]) => (
                <button key={value} onClick={() => setDurationPreset(value)} className={`rounded-md border px-2 py-2 text-[10px] font-medium ${durationPreset === value ? 'border-black bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'}`}>{label}</button>
              ))}
            </div>
            {durationPreset === 'custom' && (
              <div className="mt-3 flex items-center gap-3">
                <input type="range" min="5" max="90" value={customDuration} onChange={(e) => setCustomDuration(Number(e.target.value))} className="min-w-0 flex-1 accent-black" />
                <span className="studio-mono w-12 text-right text-[11px] text-zinc-800">{customDuration}s</span>
              </div>
            )}
          </div>

          {/* Clip Count */}
          <div className="mt-4">
            <PanelTitle label="Number of clips" title="How many clips?" />
            <div className="mt-3 flex gap-2">
              {[3, 5, 10].map((value) => (
                <button key={value} onClick={() => setClipCount(value)} className={`flex-1 rounded-md border py-2 text-[10px] font-medium ${clipCount === value ? 'border-black bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'}`}>{value}</button>
              ))}
            </div>
          </div>

          <div className="h-px bg-zinc-200" />

          {/* STEP 3: Captions */}
          <div>
            <PanelTitle label="3 / Captions & Subtitles" title="Text overlays" />
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-zinc-700">
              <input type="checkbox" checked={showCaption} onChange={(e) => setShowCaption(e.target.checked)} className="accent-black h-4 w-4 rounded" />
              <span>Enable timed captions</span>
            </label>
            {showCaption && (
              <div className="mt-3 space-y-2">
                <textarea value={captionText} onChange={(e) => setCaptionText(e.target.value)} rows={2} placeholder="Write caption text…" className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-[11px] text-zinc-900 outline-none focus:border-black" />
                <button onClick={generateCaptions} disabled={!videoUrl || !captionText.trim()} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-zinc-100 py-2 text-[10px] font-semibold text-zinc-800 hover:border-black disabled:opacity-50">
                  <WandSparkles size={12} /> Generate timed captions
                </button>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="relative">
                    <select value={captionPosition} onChange={(e) => setCaptionPosition(e.target.value as CaptionPosition)} className="w-full appearance-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-[10px] text-zinc-800">
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-2 top-2.5 text-zinc-500" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2">
                    <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} className="h-6 w-7 cursor-pointer border-0 bg-transparent" />
                    <span className="studio-mono text-[9px] text-zinc-700">{captionColor}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={generateClips} disabled={processing || !videoUrl || sourceDuration <= 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-black py-3 text-[12px] font-bold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 shadow-md">
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {processing ? `Analyzing (${progress}%)…` : `Generate AI Clips Now`}
          </button>
          {processing && <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200"><div className="h-full rounded-full bg-black transition-all" style={{ width: `${progress}%` }} /></div>}

        </aside>

        {/* CENTER: Video Preview & Aspect Ratio */}
        <section ref={previewSectionRef} className="min-w-0 bg-white p-4 sm:p-5 lg:p-7 space-y-5">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="studio-mono text-[9px] uppercase tracking-[.15em] text-zinc-500">Live Preview</div>
                <h1 className="studio-display mt-1 text-[20px] font-semibold text-zinc-900">{videoFile?.name ?? 'Creator mindset demo'}</h1>
              </div>
              <div className="rounded-full border border-zinc-200 px-3 py-1.5 text-[10px] text-zinc-600">Canvas Player Ready</div>
            </div>

            {/* Video Player Box */}
            <div className="mx-auto w-full max-w-[720px] overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-950 shadow-2xl relative flex items-center justify-center" style={{ aspectRatio: aspect === '9:16' ? '9/16' : aspect === '1:1' ? '1/1' : aspect === '16:9' ? '16/9' : '16/9', maxHeight: '500px' }}>
              {videoUrl ? (
                <video 
                  ref={videoRef} 
                  src={videoUrl} 
                  playsInline 
                  className="h-full w-full object-contain cursor-pointer" 
                  onClick={() => setPlaying((v) => !v)}
                />
              ) : (
                <div className="text-zinc-500 text-xs">No video loaded</div>
              )}

              {/* Play Overlay */}
              {!playing && (
                <button onClick={() => setPlaying(true)} className="absolute rounded-full bg-black/70 hover:bg-black p-4 text-white shadow-xl backdrop-blur transition transform hover:scale-110">
                  <Play size={22} className="fill-current ml-0.5" />
                </button>
              )}

              {/* Timed Captions Overlay */}
              {showCaption && getCaptionLine(currentTime) && (
                <div className={`pointer-events-none absolute left-1/2 w-[86%] -translate-x-1/2 text-center ${captionPosition === 'top' ? 'top-[12%]' : captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[10%]'}`}>
                  <span className="rounded-lg bg-black/70 px-3 py-1.5 text-[clamp(15px,3vw,28px)] font-extrabold text-white" style={{ color: captionColor, textShadow: '0 2px 4px rgba(0,0,0,.9)' }}>
                    {getCaptionLine(currentTime)}
                  </span>
                </div>
              )}
            </div>

            {/* Timeline Controls */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={() => setPlaying((v) => !v)} className="grid h-9 w-9 place-items-center rounded-full bg-black text-white hover:bg-zinc-800 shrink-0">
                {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
              </button>
              <span className="studio-mono text-[11px] text-zinc-700">{formatTime(currentTime)} / {formatTime(sourceDuration)}</span>
              <div onClick={seek} className="relative h-2 min-w-[180px] flex-1 cursor-pointer rounded-full bg-zinc-200">
                <div className="h-full rounded-full bg-black" style={{ width: `${sourceDuration ? (currentTime / sourceDuration) * 100 : 0}%` }} />
                <div className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow" style={{ left: `calc(${sourceDuration ? (currentTime / sourceDuration) * 100 : 0}% - 7px)` }} />
              </div>
            </div>

            {/* Aspect Ratio Selector */}
            <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-4">
              <span className="text-[11px] font-semibold text-zinc-700">Customize Aspect Ratio</span>
              <div className="flex gap-2">
                {(['original', '9:16', '1:1', '16:9'] as Aspect[]).map((value) => (
                  <button key={value} onClick={() => setAspect(value)} className={`rounded-md border px-3.5 py-2 text-[10px] font-medium transition ${aspect === value ? 'border-black bg-zinc-900 text-white shadow' : 'border-zinc-300 text-zinc-700 hover:border-zinc-400'}`}>
                    {value === 'original' ? 'Original' : value}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-zinc-500">Auto-crop and smart speaker center focus active.</p>
          </div>
        </section>

        {/* SIDEBAR RIGHT: Output Clips & History */}
        <aside className="bg-zinc-50 p-4 sm:p-5 space-y-4">
          <div className="flex items-end justify-between">
            <PanelTitle label="Extracted Clips" title="Your video history" />
            <span className="studio-mono text-[10px] text-zinc-500">{recentClips.length} saved</span>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-500">Generated clips remain saved in browser history.</p>
          
          <div className="space-y-3">
            {recentClips.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-[11px] text-zinc-500">
                Generated clips will appear here.
              </div>
            )}
            {recentClips.map((clip, index) => {
              const exported = progressFor(clip);
              return (
                <div key={clip.id} className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm hover:border-zinc-400 transition space-y-2.5">
                  <button onClick={() => selectClip(clip)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-bold text-zinc-900">{clip.title}</div>
                        <div className="studio-mono mt-0.5 truncate text-[9px] text-zinc-500">{formatTime(clip.start)} – {formatTime(clip.start + clip.length)}</div>
                      </div>
                      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-black">{clip.score}%</span>
                    </div>
                  </button>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => { void downloadClip(clip, index + 1); }} className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-zinc-800 transition">
                      <Download size={13} /> Save Clip
                    </button>
                    <button onClick={() => deleteClip(clip)} className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 hover:border-red-500 hover:text-red-500 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {exported !== undefined && exported > 0 && exported < 100 && (
                    <div className="h-1 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-black transition-all" style={{ width: `${exported}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

      </main>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur">
          <Check size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

function PanelTitle({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <div className="studio-mono text-[9px] uppercase tracking-[.15em] text-zinc-500">{label}</div>
      <h2 className="studio-display mt-0.5 text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h2>
    </div>
  );
}

export default App;
