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
  { id: 1, title: 'Viral Hook #1: The core message', start: 0, length: 4, score: 96, sourceName: 'Demo video', createdAt: 1 },
  { id: 2, title: 'Viral Hook #2: Key takeaway', start: 4, length: 4, score: 89, sourceName: 'Demo video', createdAt: 1 },
  { id: 3, title: 'Viral Hook #3: Final punchline', start: 8, length: 4, score: 84, sourceName: 'Demo video', createdAt: 1 },
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
    'video/webm;codecs=vp9,opus',
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
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.5, '#1e1b4b');
      gradient.addColorStop(1, '#0f172a');
      context.fillStyle = gradient;
      context.fillRect(0, 0, demoWidth, demoHeight);

      context.fillStyle = '#ffffff';
      context.font = '700 24px Inter, sans-serif';
      context.fillText(progress < 0.5 ? 'FLUX CLIPS AI DEMO' : 'SMART AUTO-CROP ENGINE', 60, 180);
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
  const [aspect, setAspect] = useState<Aspect>('9:16'); // Default to Shorts 9:16
  const [clipCount, setClipCount] = useState(5);
  const [showCaption, setShowCaption] = useState(true);
  const [captionText, setCaptionText] = useState('🔥 AI Viral Hook Detected');
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
      setToast('FLUX CLIPS AI Engine Ready');
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
        setToast('Press play again to start video');
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

  // AI Clip Generation based on actual source duration
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(() => {
      setProgress((value) => {
        const next = Math.min(value + 15, 100);
        if (next < 100) return next;

        window.clearInterval(timer);
        const requestedLength = durationPreset === 'custom' ? customDuration : durationPreset === 'under15' ? 12 : durationPreset === '15-30' ? 24 : 45;
        const length = Math.max(3, Math.min(requestedLength, Math.max(1, sourceDuration - 0.2)));
        const maxStart = Math.max(0, sourceDuration - length);
        const step = clipCount > 1 ? maxStart / (clipCount - 1) : 0;
        
        const hookTitles = [
          '🔥 Viral Hook: The Secret Revealed',
          '⚡ Best Moment: Must Watch',
          '🚀 High Retention Highlight',
          '💡 Core Value & Insight',
          '🎯 Peak Engagement Segment',
          '⭐ Ultimate Takeaway Moment'
        ];
        
        const sourceName = videoFile?.name ?? 'Uploaded Video';
        const made = Array.from({ length: clipCount }, (_, index) => ({
          id: Date.now() + index,
          title: hookTitles[index % hookTitles.length],
          start: Math.round(Math.min(index * step, maxStart) * 10) / 10,
          length: Math.round(length * 10) / 10,
          score: Math.max(82, 98 - index * 3),
          sourceName,
          createdAt: Date.now(),
        }));
        
        made.forEach((clip) => {
          clipSourceUrlsRef.current[clip.id] = videoUrl;
        });
        
        setRecentClips((current) => [...made, ...current]);
        setProgress(100);
        setProcessing(false);
        setToast(`✨ ${made.length} AI vertical shorts generated successfully!`);
        return 100;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [processing, clipCount, customDuration, durationPreset, sourceDuration, videoFile, videoUrl]);

  function handleFile(file?: File) {
    if (!file || !file.type.startsWith('video/')) {
      setToast('Please choose a valid video file');
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
    setToast('Video uploaded successfully');
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
      setToast('Could not load demo video');
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
    setToast('AI detecting hooks & reframing to vertical…');
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
    setToast('Timed captions applied');
  }

  function getCaptionLine(time: number) {
    if (!captionWords.length) return captionText.trim();
    const activeIndex = captionWords.findIndex((word) => time >= word.start && time <= word.end);
    if (activeIndex < 0) return captionText.trim();
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
    setToast('Clip removed from history');
  }

  // True Auto-Crop Export (Canvas rendering to 9:16 vertical shorts with audio & captions)
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
      setToast('Export requires a valid video source');
      return;
    }

    const canvas = document.createElement('canvas');
    // Set target dimensions based on selected aspect ratio
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
      
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;
      let sourceX = 0;
      let sourceY = 0;

      // Smart Auto-Crop Logic for Vertical 9:16 Shorts
      if (sourceAspect > targetAspect) {
        // Landscape to Vertical: Crop center strip
        sourceWidth = video.videoHeight * targetAspect;
        sourceX = (video.videoWidth - sourceWidth) / 2;
      } else {
        // Vertical or Square
        sourceHeight = video.videoWidth / targetAspect;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }

      // Draw background / filled frame
      context.fillStyle = '#080c14';
      context.fillRect(0, 0, width, height);

      // Draw cropped video frame
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

      // Render Subtitles / Captions on Export
      const captionLine = getCaptionLine(start + elapsed);
      if (showCaption && captionLine) {
        const captionY = captionPosition === 'top' ? height * 0.16 : captionPosition === 'center' ? height * 0.5 : height * 0.82;
        context.font = `800 ${Math.max(32, Math.round(64 * (height / 1920)))}px Inter, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = Math.max(6, height / 240);
        context.strokeStyle = 'rgba(0,0,0,0.9)';
        context.fillStyle = captionColor;
        
        // Text wrapping for short captions
        const maxTextWidth = width * 0.86;
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

        const lineHeight = Math.max(40, Math.round(75 * (height / 1920)));
        captionLines.forEach((textLine, idx) => {
          const lineY = captionY + (idx - (captionLines.length - 1) / 2) * lineHeight;
          context.strokeText(textLine, width / 2, lineY);
          context.fillText(textLine, width / 2, lineY);
        });
      }
    };

    try {
      video.pause();
      video.currentTime = start;
      await waitForVideoEvent(video, 'seeked');
      video.muted = false;
      video.volume = 1; // Ensure sound is active for recording
      await video.play();

      canvasStream = canvas.captureStream(30);
      sourceStream = getVideoCaptureStream(video);
      const audioTracks = await getAudioTracksForExport(video);
      
      // Combine canvas video track with original audio tracks
      stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
      
      const chunks: BlobPart[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        if (!recorder) return reject(new Error('recorder unavailable'));
        recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
        recorder.onerror = () => reject(new Error('recording failed'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      
      recorder.start(250);
      const startedAt = performance.now();
      
      await new Promise<void>((resolve) => {
        const check = () => {
          const elapsed = Math.min(length, (performance.now() - startedAt) / 1000);
          drawFrame(elapsed);
          setExportProgress((current) => ({ ...current, [clip.id]: Math.min(96, Math.round((elapsed / length) * 96)) }));
          if (elapsed >= length) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });

      video.pause();
      recorder.stop();
      const blob = await finished;
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const filename = `AI_Vertical_Short_${clipNumber}.${extension}`;
      
      renderedVideosRef.current[clip.id] = { blob, filename };
      setExportProgress((current) => ({ ...current, [clip.id]: 100 }));
      downloadBlob(blob, filename);
      setToast('🚀 Vertical Short rendered & downloaded successfully!');
    } catch {
      setExportProgress((current) => ({ ...current, [clip.id]: 0 }));
      setToast('Export failed. Please try again.');
    } finally {
      canvasStream?.getTracks().forEach((track) => track.stop());
      sourceStream?.getTracks().forEach((track) => track.stop());
      video.pause();
      if (video === videoRef.current) {
        video.muted = oldMuted;
        video.volume = oldVolume;
        video.currentTime = oldTime;
        if (oldPlaying) void video.play().catch(() => {});
      } else {
        video.removeAttribute('src');
        video.load();
      }
    }
  }

  const progressFor = (clip: Clip) => exportProgress[clip.id];

  return (
    <div className="min-h-[100dvh] bg-[#080c14] text-[#f3f4f6] font-sans selection:bg-violet-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center space-x-3">
            <div className="rounded-xl bg-violet-600 p-2 text-white shadow-lg shadow-violet-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400 bg-clip-text text-transparent">
                FLUX CLIPS AI
              </h1>
              <p className="text-[10px] text-gray-400 font-medium">AI Auto-Crop & Multi-Clip Generator</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
              <span className="mr-2 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Engine Ready
            </span>
            <button onClick={resetWorkspace} className="flex items-center gap-1.5 rounded-xl border border-gray-800 bg-slate-950 px-3 py-1.5 text-xs text-gray-300 hover:border-violet-500 hover:text-white transition cursor-pointer">
              <RotateCcw size={13} /> Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Dashboard */}
      <main className="mx-auto max-w-4xl w-full px-4 py-6 space-y-6">

        {/* STEP 1: Upload Source Video */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-violet-600/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300 border border-violet-500/30">STEP 1</span>
            <h2 className="text-sm font-semibold text-gray-200">Upload Source Video</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
                placeholder="https://example.com/video.mp4" 
                className="flex-1 rounded-xl border border-gray-800 bg-slate-950 px-3.5 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-violet-500 font-mono"
              />
              <button 
                type="button" 
                onClick={handleLoadUrl}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-violet-600/20"
              >
                <Upload size={14} /> Upload URL
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-800"></div>
              <span className="flex-shrink mx-4 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">OR UPLOAD FILE</span>
              <div className="flex-grow border-t border-gray-800"></div>
            </div>

            <label 
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition ${
                dragging ? 'border-violet-500 bg-violet-950/20' : 'border-gray-700/80 bg-slate-950/40 hover:border-violet-500'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/10 text-violet-400">
                <CloudUpload size={20} />
              </div>
              <span className="text-xs text-gray-200 font-medium">Click or Drag & Drop local video here (No File Size Limit)</span>
              <input ref={inputRef} type="file" accept="video/*" onChange={(e) => handleFile(e.target.files?.[0])} className="hidden" />
              {videoFile && <div className="mt-1 flex items-center gap-1 text-[11px] text-violet-400"><FileVideo size={13} />{videoFile.name}</div>}
            </label>

            <button 
              onClick={() => { void loadDemo(); }}
              className="w-full rounded-xl border border-gray-800 bg-slate-950/60 py-2 text-center text-xs text-gray-400 hover:border-violet-500 hover:text-white transition cursor-pointer"
            >
              Or load sample demo video
            </button>
          </div>
        </div>

        {/* STEP 2: Video Preview & Customize Aspect Ratio */}
        <div ref={previewSectionRef} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-violet-600/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300 border border-violet-500/30">STEP 2</span>
            <h2 className="text-sm font-semibold text-gray-200">Video Preview & Customize Aspect Ratio</h2>
          </div>
          
          <div className="grid grid-cols-4 gap-2">
            {(['original', '9:16', '1:1', '16:9'] as Aspect[]).map((ratio) => (
              <button 
                key={ratio}
                onClick={() => setAspect(ratio)}
                className={`py-2 rounded-xl text-xs font-medium transition text-center border cursor-pointer ${
                  aspect === ratio 
                    ? 'bg-violet-600 text-white border-violet-500 shadow-md' 
                    : 'bg-slate-950 text-gray-400 hover:text-white border-gray-800'
                }`}
              >
                {ratio === 'original' ? 'Original' : ratio}
                <span className="block text-[9px] opacity-70">
                  {ratio === 'original' ? 'Source Ratio' : ratio === '9:16' ? 'Reels/Shorts' : ratio === '1:1' ? 'Square' : 'Landscape'}
                </span>
              </button>
            ))}
          </div>

          {/* Dynamic Aspect Ratio Preview Container */}
          <div 
            className="relative bg-black rounded-xl overflow-hidden mx-auto flex items-center justify-center border border-gray-800 shadow-inner transition-all duration-300 w-full"
            style={aspect === '9:16' ? { aspectRatio: '9/16', maxHeight: '520px', maxWidth: '292px' } : aspect === '1:1' ? { aspectRatio: '1/1', maxHeight: '480px' } : aspect === '16:9' ? { aspectRatio: '16/9', maxHeight: '420px' } : {}}
          >
            {videoUrl ? (
              <video 
                ref={videoRef}
                src={videoUrl}
                playsInline
                className="h-full w-full object-cover cursor-pointer"
                onClick={() => setPlaying((v) => !v)}
              />
            ) : (
              <div className="flex h-64 items-center justify-center text-xs text-gray-500">No video loaded</div>
            )}

            {!playing && (
              <button 
                onClick={() => setPlaying(true)}
                className="absolute rounded-full bg-violet-600/80 hover:bg-violet-600 p-4 text-white shadow-lg backdrop-blur transition transform hover:scale-110 cursor-pointer"
              >
                <Play size={20} className="fill-current ml-0.5" />
              </button>
            )}

            {showCaption && getCaptionLine(currentTime) && (
              <div className={`pointer-events-none absolute left-1/2 w-[86%] -translate-x-1/2 text-center ${captionPosition === 'top' ? 'top-[12%]' : captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-[10%]'}`}>
                <span className="rounded-lg bg-black/70 px-3 py-1.5 text-[clamp(14px,2.5vw,24px)] font-extrabold text-white" style={{ color: captionColor, textShadow: '0 2px 4px rgba(0,0,0,.9)' }}>
                  {getCaptionLine(currentTime)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">{formatTime(currentTime)}</span>
              <div onClick={seek} className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-gray-800">
                <div className="h-full rounded-full bg-violet-500" style={{ width: `${sourceDuration ? (currentTime / sourceDuration) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-mono text-gray-400">{formatTime(sourceDuration)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                <input type="checkbox" defaultChecked className="accent-violet-500 w-4 h-4 rounded" />
                <span>Smart Auto-Reframe & Speaker Focus</span>
              </label>
              <button onClick={() => setPlaying((v) => !v)} className="flex items-center gap-1.5 text-violet-400 hover:underline cursor-pointer">
                {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Play Preview'}
              </button>
            </div>
          </div>
        </div>

        {/* STEP 3: Clip Length & Subtitle Settings */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-violet-600/20 px-2.5 py-1 text-[11px] font-semibold text-violet-300 border border-violet-500/30">STEP 3</span>
            <h2 className="text-sm font-semibold text-gray-200">Clip Length & Subtitle Settings</h2>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-gray-400 mb-1.5">Max Clip Duration / Length</label>
              <select 
                value={durationPreset} 
                onChange={(e) => setDurationPreset(e.target.value as DurationPreset)}
                className="w-full bg-slate-950 border border-gray-800 rounded-xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="under15">Under 15 Seconds (Shorts/Reels)</option>
                <option value="15-30">15 - 30 Seconds</option>
                <option value="30-60">30 - 60 Seconds</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-gray-400">Speech-to-Text Captions Text</label>
              <div className="flex gap-2">
                <textarea 
                  value={captionText} 
                  onChange={(e) => setCaptionText(e.target.value)}
                  rows={2}
                  className="flex-1 bg-slate-950 border border-gray-800 rounded-xl px-3 py-2 text-gray-200 resize-none focus:outline-none focus:border-violet-500"
                />
                <button 
                  onClick={generateCaptions}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-gray-200 hover:bg-slate-700 transition flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <WandSparkles size={13} /> Apply
                </button>
              </div>
            </div>

            <button 
              onClick={generateClips}
              disabled={processing || !videoUrl}
              className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {processing ? `AI Analyzing Hooks & Cropping (${progress}%)…` : '✨ Generate AI Vertical Clips Now'}
            </button>
            {processing && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                <div className="h-full bg-violet-500 transition-all duration-150" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>

        {/* Extracted Clips Output Grid */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 backdrop-blur-xl space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              🎬 Extracted AI Vertical Clips Output
            </h2>
            <span className="rounded-full bg-violet-600/20 px-2.5 py-0.5 text-xs text-violet-400 border border-violet-500/30 font-mono">
              {recentClips.length}
            </span>
          </div>

          <div>
            {recentClips.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-800 bg-slate-950/40 py-10 text-center text-gray-500 space-y-2">
                <p className="text-xs">No clips generated yet.</p>
                <p className="text-[10px] text-gray-600">Load a video & click "Generate AI Vertical Clips Now".</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recentClips.map((clip, index) => {
                  const percent = progressFor(clip);
                  return (
                    <div key={clip.id} className="rounded-xl border border-gray-800 bg-slate-950 p-3 space-y-2">
                      <div onClick={() => selectClip(clip)} className="relative aspect-[9/16] cursor-pointer overflow-hidden rounded-lg bg-black flex items-center justify-center group shadow-md">
                        <span className="absolute top-2 left-2 rounded bg-violet-600/90 px-2 py-0.5 font-mono text-[9px] text-white">
                          Clip #{index + 1} ({clip.score}% AI Score)
                        </span>
                        <Play size={28} className="text-violet-400 opacity-90 group-hover:scale-110 transition" />
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-gray-300 truncate max-w-[110px]">{clip.title}</span>
                        <div className="flex gap-1.5">
                          <button 
                            onClick={() => { void downloadClip(clip, index + 1); }}
                            className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-white hover:bg-violet-500 transition cursor-pointer font-semibold"
                          >
                            <Download size={12} /> Save
                          </button>
                          <button 
                            onClick={() => deleteClip(clip)}
                            className="rounded-lg border border-gray-800 p-1 text-gray-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      {percent !== undefined && percent > 0 && percent < 100 && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-gray-800">
                          <div className="h-full bg-violet-500" style={{ width: `${percent}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-gray-800 bg-slate-900 px-4 py-3 text-xs text-white shadow-2xl backdrop-blur-md">
          <Check size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
