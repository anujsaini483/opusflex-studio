import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlignCenter, ArrowDownToLine, ArrowLeftRight, AudioWaveform,
  BarChart3, Check, ChevronDown, CircleHelp, CloudUpload, Code2, Download,
  FileVideo, Film, Focus, FolderOpen, Gauge, GripVertical, Hash, Layers3,
  LayoutGrid, Maximize2, Menu, Mic2, Minus, MonitorPlay, Move, Pause,
  Play, Plus, Radio, Redo2, RotateCcw, Scissors, Settings2, SlidersHorizontal,
  Sparkles, Split, Square, Subtitles, Target, Trash2, Upload, WandSparkles,
  X, Zap, ZoomIn
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

type DurationPreset = 'under15' | '15-30' | '30-60' | 'custom';
type Aspect = '9:16' | '1:1' | '16:9';
type CutStyle = 'hook' | 'topic' | 'equal';
type CaptionPreset = 'MrBeast Bold' | 'Hormozi Style' | 'Minimal Clean' | 'Cyber Neon';
type Clip = { id: number; title: string; start: number; length: number; score: number; color: string; status?: string };
type Word = { text: string; start: number; end: number; color: string };
type RenderedVideo = { blob: Blob; mimeType: string; filename: string };

const queryClient = new QueryClient();
const DEMO_DURATION = 187;

const initialWords: Word[] = [
  { text: 'The', start: 8.2, end: 8.48, color: 'default' },
  { text: 'biggest', start: 8.5, end: 8.92, color: 'active' },
  { text: 'mistake', start: 8.95, end: 9.4, color: 'default' },
  { text: 'creators', start: 9.46, end: 9.78, color: 'default' },
  { text: 'make', start: 9.82, end: 10.15, color: 'default' },
  { text: 'is', start: 10.2, end: 10.42, color: 'default' },
  { text: 'waiting', start: 10.5, end: 10.95, color: 'default' },
  { text: 'for', start: 11.0, end: 11.18, color: 'default' },
  { text: 'perfect.', start: 11.23, end: 11.82, color: 'default' },
];

const seedClips: Clip[] = [
  { id: 1, title: 'The perfect moment is a myth', start: 8, length: 26, score: 94, color: '#9b76ff', status: 'ready' },
  { id: 2, title: 'Stop waiting to publish', start: 54, length: 31, score: 87, color: '#e2ef3a', status: 'ready' },
  { id: 3, title: 'Your first 10 ideas are bad', start: 102, length: 24, score: 81, color: '#69c5ff', status: 'ready' },
];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
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
  window.setTimeout(() => window.URL.revokeObjectURL(href), 1000);
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish, { once: true });
    video.currentTime = time;
    window.setTimeout(finish, 500);
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(9.4);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('15-30');
  const [customDuration, setCustomDuration] = useState(30);
  const [aspect, setAspect] = useState<Aspect>('9:16');
  const [clipCount, setClipCount] = useState(5);
  const [cutStyle, setCutStyle] = useState<CutStyle>('hook');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clips, setClips] = useState<Clip[]>(seedClips);
  const [selectedClipId, setSelectedClipId] = useState(1);
  const [speakerFocus, setSpeakerFocus] = useState(true);
  const [motionZoom, setMotionZoom] = useState(false);
  const [splitScreen, setSplitScreen] = useState(false);
  const [captionPreset, setCaptionPreset] = useState<CaptionPreset>('MrBeast Bold');
  const [captionFont, setCaptionFont] = useState('Montserrat');
  const [captionSize, setCaptionSize] = useState(56);
  const [captionPosition, setCaptionPosition] = useState('Lower third');
  const [activeWordColor, setActiveWordColor] = useState('#E4F03B');
  const [words, setWords] = useState<Word[]>(initialWords);
  const [activeWord, setActiveWord] = useState(1);
  const [exportQueue, setExportQueue] = useState<number[]>([]);
  const [exportProgress, setExportProgress] = useState<Record<number, number>>({});
  const renderedVideosRef = useRef<Record<number, RenderedVideo>>({});
  const [toast, setToast] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'source' | 'edit' | 'clips'>('edit');

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? clips[0];
  const activeCaption = words[activeWord]?.text ?? 'biggest';
  const videoIsLoaded = Boolean(videoUrl);

  useEffect(() => {
    if (!processing) return;
    const interval = window.setInterval(() => {
      setProgress((current) => {
        const next = Math.min(current + 8, 100);
        if (next === 100) {
          window.clearInterval(interval);
          window.setTimeout(() => {
            const length = durationPreset === 'custom' ? customDuration : durationPreset === 'under15' ? 12 : durationPreset === '15-30' ? 24 : 43;
            const titles = ['The perfect moment is a myth', 'Stop waiting to publish', 'Your first 10 ideas are bad', 'The audience can feel your doubt', 'Make the boring part visible', 'Consistency beats the algorithm'];
            const colors = ['#9b76ff', '#e2ef3a', '#69c5ff', '#ff8b98', '#e7a65b', '#85ddac'];
            const made = Array.from({ length: clipCount }, (_, index) => ({
              id: Date.now() + index,
              title: titles[index % titles.length],
              start: Math.min(8 + index * 31, DEMO_DURATION - length),
              length,
              score: Math.max(73, 96 - index * 4),
              color: colors[index % colors.length],
              status: 'ready',
            }));
            setClips(made);
            setSelectedClipId(made[0].id);
            setProcessing(false);
            setToast(`${made.length} clips are ready to review`);
          }, 450);
        }
        return next;
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [processing, clipCount, durationPreset, customDuration]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        const next = time + 0.25;
        if (next >= DEMO_DURATION) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const wordIndex = words.findIndex((word) => currentTime >= word.start && currentTime <= word.end);
    if (wordIndex >= 0) setActiveWord(wordIndex);
  }, [currentTime, words]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => () => {
    if (videoUrl) window.URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  function handleFile(file?: File) {
    if (!file || !file.type.startsWith('video/')) {
      setToast('Choose a video file to load into the edit bay');
      return;
    }
    if (videoUrl) window.URL.revokeObjectURL(videoUrl);
    const url = window.URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setCurrentTime(0);
    setToast('Source loaded locally — ready to cut');
  }

  function updateWord(index: number, patch: Partial<Word>) {
    setWords((current) => current.map((word, wordIndex) => wordIndex === index ? { ...word, ...patch } : word));
  }

  async function downloadClip(clip: Clip, clipNumber: number) {
    const previous = renderedVideosRef.current[clip.id];
    if (previous) {
      downloadBlob(previous.blob, previous.filename);
      setToast('Download started — check your Gallery or Downloads');
      return;
    }

    if (exportProgress[clip.id] && exportProgress[clip.id] < 100) return;

    const mimeType = getRecordingMimeType();
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const canvasSize = aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080];
    canvas.width = canvasSize[0];
    canvas.height = canvasSize[1];
    const context = canvas.getContext('2d');

    if (!mimeType || !canvas.captureStream || !context) {
      setToast('This browser cannot render a downloadable video from canvas');
      return;
    }

    setExportQueue((queue) => queue.includes(clip.id) ? queue : [...queue, clip.id]);
    setExportProgress((state) => ({ ...state, [clip.id]: 1 }));

    const wasPlaying = playing;
    const oldVideoTime = video?.currentTime ?? 0;
    const renderLength = videoUrl ? clip.length : Math.min(5, clip.length);
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const stopped = new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('MediaRecorder failed'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    const drawFrame = () => {
      const width = canvas.width;
      const height = canvas.height;
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, '#171b31');
      background.addColorStop(0.52, '#504475');
      background.addColorStop(1, '#171c31');
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      if (video && videoUrl && video.readyState >= 2 && video.videoWidth > 0) {
        const sourceAspect = video.videoWidth / video.videoHeight;
        const targetAspect = width / height;
        let sourceWidth = video.videoWidth;
        let sourceHeight = video.videoHeight;
        let sourceX = 0;
        let sourceY = 0;
        if (sourceAspect > targetAspect) {
          sourceWidth = video.videoHeight * targetAspect;
          sourceX = (video.videoWidth - sourceWidth) * (speakerFocus ? 0.42 : 0.5);
        } else {
          sourceHeight = video.videoWidth / targetAspect;
          sourceY = (video.videoHeight - sourceHeight) * 0.5;
        }
        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
      } else {
        context.fillStyle = 'rgba(137, 109, 208, .22)';
        context.beginPath();
        context.ellipse(width * 0.51, height * 0.52, width * 0.28, height * 0.3, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(201, 159, 147, .9)';
        context.beginPath();
        context.ellipse(width * 0.51, height * 0.35, width * 0.18, height * 0.14, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(94, 67, 88, .85)';
        context.beginPath();
        context.ellipse(width * 0.51, height * 0.6, width * 0.27, height * 0.3, 0, 0, Math.PI * 2);
        context.fill();
      }

      const captionY = captionPosition === 'Top' ? height * 0.18 : captionPosition === 'Center' ? height * 0.52 : height * 0.78;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `${captionPreset === 'Minimal Clean' ? 500 : 800} ${Math.round(captionSize * (height / 1920))}px ${captionFont}`;
      context.lineWidth = Math.max(4, height / 240);
      context.strokeStyle = 'rgba(10, 10, 16, .9)';
      context.strokeText(activeCaption, width / 2, captionY);
      context.fillStyle = activeWordColor;
      context.fillText(activeCaption, width / 2, captionY);
      if (splitScreen) {
        context.strokeStyle = 'rgba(228, 240, 59, .8)';
        context.lineWidth = Math.max(2, height / 480);
        context.strokeRect(width * 0.06, height * 0.06, width * 0.88, height * 0.41);
        context.strokeRect(width * 0.06, height * 0.53, width * 0.88, height * 0.41);
      }
    };

    try {
      if (video && videoUrl) {
        video.pause();
        await seekVideo(video, clip.start);
        await video.play();
      }

      recorder.start(100);
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const frameTimer = window.setInterval(() => {
          drawFrame();
          const elapsed = (performance.now() - startedAt) / 1000;
          const nextProgress = Math.min(96, Math.max(2, Math.round((elapsed / renderLength) * 96)));
          setExportProgress((state) => ({ ...state, [clip.id]: nextProgress }));
          if (elapsed >= renderLength) {
            window.clearInterval(frameTimer);
            resolve();
          }
        }, 33);
      });
      drawFrame();
      recorder.stop();
      const blob = await stopped;
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const filename = `Short_Clip_${clipNumber}.${extension}`;
      renderedVideosRef.current[clip.id] = { blob, mimeType, filename };
      setExportProgress((state) => ({ ...state, [clip.id]: 100 }));
      downloadBlob(blob, filename);
      setToast(`${extension === 'mp4' ? 'MP4' : 'WebM fallback'} download started — check your Gallery`);
    } catch {
      setExportProgress((state) => ({ ...state, [clip.id]: 0 }));
      setToast('Video render failed — try a shorter clip or another browser');
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      if (video) {
        video.pause();
        video.currentTime = oldVideoTime;
        if (wasPlaying) void video.play().catch(() => undefined);
      }
    }
  }

  function downloadAll() {
    const payload = new Blob([clips.map((clip) => `${clip.title} — ${formatTime(clip.start)} — ${clip.length}s`).join('\n')], { type: 'application/zip' });
    const href = window.URL.createObjectURL(payload);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'opusflex-shorts.zip';
    anchor.click();
    window.URL.revokeObjectURL(href);
    setToast('Download All Clips queued as local ZIP');
  }

  function seekTimeline(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = ((event.clientX - bounds.left) / bounds.width) * DEMO_DURATION;
    setCurrentTime(Math.max(0, Math.min(DEMO_DURATION, next)));
  }

  const captionStyle = useMemo(() => ({
    fontFamily: captionFont,
    fontSize: `${Math.max(18, captionSize / 2.25)}px`,
    fontWeight: captionPreset === 'Minimal Clean' ? 500 : 800,
    letterSpacing: captionPreset === 'Cyber Neon' ? '0.05em' : '-0.03em',
    textTransform: captionPreset === 'Hormozi Style' ? 'uppercase' as const : 'none' as const,
    textShadow: captionPreset === 'Cyber Neon' ? `0 0 16px ${activeWordColor}` : '0 2px 3px rgba(0,0,0,.8)',
  }), [captionFont, captionSize, captionPreset, activeWordColor]);

  return (
    <div className="studio-noise min-h-[100dvh] bg-[#11111b] text-[#e5e4ed] selection:bg-[#9b76ff]/30">
      <header className="sticky top-0 z-50 flex h-[68px] items-center justify-between border-b border-[#29273a] bg-[#151521]/95 px-4 backdrop-blur-xl lg:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-[#e4f03b] text-[#13131c] shadow-[0_0_26px_rgba(228,240,59,.2)]">
            <Zap size={19} strokeWidth={3} />
          </div>
          <div>
            <div className="studio-display text-[17px] font-bold tracking-tight text-[#f4f2fb]">opus<span className="text-[#ab88ff]">flex</span> <span className="text-[#e4f03b]">AI</span></div>
            <div className="studio-mono hidden text-[9px] uppercase tracking-[.18em] text-[#77738b] sm:block">browser edit bay / v1.4</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#333047] bg-[#1b1a29] px-3 py-1.5 text-[11px] text-[#a7a3b4] md:flex">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#b8ff75]" />
          Local engine online <span className="text-[#5e5a71]">·</span> No API key
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="button-help" onClick={() => setToast('OpusFlex runs entirely in this browser — your source stays on this device')} className="hidden rounded-lg p-2 text-[#858196] hover:bg-[#252337] hover:text-[#e8e3f4] sm:block"><CircleHelp size={18} /></button>
          <button data-testid="button-settings" onClick={() => setToast('Studio preferences are saved for this session')} className="rounded-lg p-2 text-[#858196] hover:bg-[#252337] hover:text-[#e8e3f4]"><Settings2 size={18} /></button>
          <div className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-[#a27cff]/40 bg-[#30274e] text-xs font-semibold text-[#cfc1ff]">JR</div>
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-68px)]">
        <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-3 border-r border-[#29273a] bg-[#14141f] py-5 lg:flex">
          <SideIcon icon={<LayoutGrid size={19} />} label="Studio" active onClick={() => setToast('Studio workspace')} />
          <SideIcon icon={<Film size={19} />} label="Projects" onClick={() => setToast('Projects are local to this session')} />
          <SideIcon icon={<BarChart3 size={19} />} label="Insights" onClick={() => setToast('Insights will appear after your first export')} />
          <div className="mt-auto">
            <SideIcon icon={<Code2 size={19} />} label="Shortcuts" onClick={() => setToast('Shortcuts: Space play · R render · D download')} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex items-center justify-between border-b border-[#272537] bg-[#171622] px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
              <button data-testid="button-mobile-menu" onClick={() => setMobilePanel(mobilePanel === 'edit' ? 'source' : 'edit')} className="rounded-md p-1 text-[#8a849d] hover:bg-[#27253a] lg:hidden"><Menu size={19} /></button>
              <div>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#e4e1ed]"><span className="h-1.5 w-1.5 rounded-full bg-[#e4f03b]" /> New project</div>
                <div className="studio-mono mt-0.5 text-[10px] text-[#777388]">{videoFile?.name ?? 'Creator mindset — podcast demo'} <span className="text-[#504d61]">·</span> {formatTime(DEMO_DURATION)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-[#777388] md:inline">Autosaved just now</span>
              <button data-testid="button-reset" onClick={() => { setClips(seedClips); setSelectedClipId(1); setCurrentTime(9.4); setToast('Demo project restored'); }} className="rounded-md border border-[#343148] px-2.5 py-1.5 text-[11px] text-[#aaa5ba] hover:border-[#5f4c90] hover:text-[#e6e0fb]"><RotateCcw size={12} className="mr-1.5 inline" />Reset</button>
            </div>
          </div>

          <div className="hidden border-b border-[#2a2838] bg-[#171622] px-4 py-2 md:block lg:px-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[.14em] text-[#716c81]">
              <span className="rounded bg-[#28253b] px-2 py-1 text-[#9f91cb]">01</span> Source
              <div className="h-px w-8 bg-[#3a3650]" />
              <span className="rounded bg-[#28253b] px-2 py-1 text-[#9f91cb]">02</span> Cut engine
              <div className="h-px w-8 bg-[#3a3650]" />
              <span className="rounded bg-[#28253b] px-2 py-1 text-[#9f91cb]">03</span> Style
              <div className="h-px w-8 bg-[#3a3650]" />
              <span className="rounded bg-[#28253b] px-2 py-1 text-[#9f91cb]">04</span> Export
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[minmax(260px,310px)_minmax(410px,1fr)_minmax(280px,330px)]">
            <section className={`${mobilePanel === 'source' ? 'block' : 'hidden'} border-b border-[#2a2838] bg-[#161620] p-4 xl:block xl:min-h-[calc(100dvh-145px)] xl:border-b-0 xl:border-r`}>
              <PanelHeading eyebrow="01 / SOURCE" title="Drop your recording" icon={<CloudUpload size={15} />} />
              <div
                data-testid="dropzone-video"
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files[0]); }}
                className={`group relative mt-4 cursor-pointer overflow-hidden rounded-xl border border-dashed p-5 text-center transition-all ${dragging ? 'border-[#e4f03b] bg-[#e4f03b]/[.07]' : 'border-[#49435e] bg-[#1d1b2a] hover:border-[#9b76ff] hover:bg-[#232039]'}`}
              >
                <input ref={inputRef} data-testid="input-video-file" type="file" accept="video/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-xl bg-[#2a2542] text-[#a98bff] transition-transform group-hover:-translate-y-1"><Upload size={18} /></div>
                <div className="text-[12px] font-semibold text-[#e6e2f0]">{videoFile ? 'Replace source video' : 'Drop video or browse'}</div>
                <div className="mt-1 text-[10px] text-[#807b90]">MP4, MOV, WebM · stays on device</div>
                {videoFile && <div className="mt-3 truncate rounded-md bg-[#12121b] px-2 py-1.5 text-left text-[10px] text-[#b1a9ca]"><FileVideo size={12} className="mr-1 inline text-[#e4f03b]" />{videoFile.name}</div>}
              </div>
              <button data-testid="button-load-demo" onClick={() => { setVideoFile(null); setVideoUrl(''); setCurrentTime(9.4); setToast('Creator mindset demo loaded'); }} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#342f4b] py-2 text-[11px] font-medium text-[#b0a8c0] hover:border-[#7157ad] hover:text-[#e7defa]"><Sparkles size={13} className="text-[#e4f03b]" />Load instant demo</button>

              <div className="mt-6">
                <SectionLabel label="Source preview" trailing={videoIsLoaded ? 'LOCAL FILE' : 'DEMO SOURCE'} />
                <div className="relative mt-2 aspect-video overflow-hidden rounded-lg border border-[#38334d] bg-[#202237]">
                  {videoIsLoaded ? <video ref={videoRef} src={videoUrl} className="h-full w-full object-cover" muted playsInline /> : <DemoFrame compact />}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-[#101018]/90 to-transparent px-2 pb-2 pt-5">
                    <button data-testid="button-source-play" onClick={() => setPlaying((state) => !state)} className="grid h-7 w-7 place-items-center rounded-full bg-[#e4f03b] text-[#17171d]">{playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</button>
                    <span className="studio-mono text-[10px] text-[#d8d5df]">{formatTime(currentTime)} / {formatTime(DEMO_DURATION)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <SectionLabel label="Clip recipe" trailing="FAST PRESET" />
                <SettingGroup label="Target duration">
                  <div className="grid grid-cols-2 gap-1.5">
                    {([['under15', 'Under 15s'], ['15-30', '15–30s'], ['30-60', '30–60s'], ['custom', 'Custom']] as [DurationPreset, string][]).map(([value, label]) => (
                      <button data-testid={`button-duration-${value}`} key={value} onClick={() => setDurationPreset(value)} className={`rounded-md border px-2 py-2 text-[10px] transition-colors ${durationPreset === value ? 'border-[#9b76ff] bg-[#332853] text-[#eee8ff]' : 'border-[#302d40] bg-[#1b1a27] text-[#868094] hover:border-[#51466d]'}`}>{label}</button>
                    ))}
                  </div>
                  {durationPreset === 'custom' && <div className="mt-3 flex items-center gap-3"><input data-testid="input-custom-duration" aria-label="Custom duration" type="range" min="10" max="90" value={customDuration} onChange={(event) => setCustomDuration(Number(event.target.value))} className="range-violet min-w-0 flex-1" /><span className="studio-mono w-12 text-right text-[11px] text-[#d9d0f3]">{customDuration}s</span></div>}
                </SettingGroup>
                <SettingGroup label="Aspect ratio">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['9:16', '1:1', '16:9'] as Aspect[]).map((value) => <button data-testid={`button-aspect-${value.replace(':', '-')}`} key={value} onClick={() => setAspect(value)} className={`rounded-md border px-2 py-2 text-[10px] ${aspect === value ? 'border-[#e4f03b] bg-[#323518] text-[#eef28c]' : 'border-[#302d40] bg-[#1b1a27] text-[#868094] hover:border-[#51466d]'}`}><span className={`mr-1 inline-block border border-current align-middle ${value === '9:16' ? 'h-3.5 w-2' : value === '1:1' ? 'h-3 w-3' : 'h-2.5 w-4'}`} />{value}</button>)}
                  </div>
                </SettingGroup>
                <SettingGroup label="Number of clips">
                  <div className="flex gap-1.5">
                    {[3, 5, 10].map((value) => <button data-testid={`button-clip-count-${value}`} key={value} onClick={() => setClipCount(value)} className={`flex-1 rounded-md border py-2 text-[10px] ${clipCount === value ? 'border-[#9b76ff] bg-[#332853] text-[#eee8ff]' : 'border-[#302d40] bg-[#1b1a27] text-[#868094]'}`}>{value} clips</button>)}
                  </div>
                </SettingGroup>
                <SettingGroup label="Cut strategy">
                  <div className="relative"><select data-testid="select-cut-style" value={cutStyle} onChange={(event) => setCutStyle(event.target.value as CutStyle)} className="w-full appearance-none rounded-md border border-[#332f43] bg-[#1b1a27] px-3 py-2 text-[11px] text-[#c9c2d7] outline-none focus:border-[#9b76ff]"><option value="hook">Viral Hook First</option><option value="topic">Topic Shift Cut</option><option value="equal">Equal Segment Cut</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-[#797389]" /></div>
                </SettingGroup>
                <button data-testid="button-generate-clips" onClick={() => { setProgress(0); setProcessing(true); setToast('Scanning transcript and finding hooks…'); }} disabled={processing} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e4f03b] py-3 text-[12px] font-bold text-[#18191a] shadow-[0_6px_22px_rgba(228,240,59,.12)] hover:bg-[#f0f76d]">{processing ? <><Activity size={15} className="animate-pulse" />Analyzing {progress}%</> : <><WandSparkles size={15} />Generate {clipCount} clips</>}</button>
                {processing && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#28263a]"><div className="h-full rounded-full bg-[#e4f03b] transition-all duration-200" style={{ width: `${progress}%` }} /></div>}
              </div>
            </section>

            <section className={`${mobilePanel === 'edit' ? 'block' : 'hidden'} min-w-0 border-b border-[#2a2838] bg-[#11111a] xl:block xl:border-b-0`}>
              <div className="flex items-center justify-between border-b border-[#2a2838] px-4 py-3 lg:px-5">
                <PanelHeading eyebrow="02 / EDIT BAY" title="Frame & timing" icon={<Focus size={15} />} />
                <div className="flex items-center gap-1.5">
                  <button data-testid="button-undo" onClick={() => setToast('Undo is local to this edit session')} className="rounded-md p-1.5 text-[#7f7a91] hover:bg-[#242235] hover:text-[#d8d0e8]"><Redo2 size={15} className="rotate-180" /></button>
                  <button data-testid="button-redo" onClick={() => setToast('Nothing to redo')} className="rounded-md p-1.5 text-[#7f7a91] hover:bg-[#242235] hover:text-[#d8d0e8]"><Redo2 size={15} /></button>
                </div>
              </div>
              <div className="p-4 lg:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] text-[#a6a1b3]"><span className="h-2 w-2 rounded-full bg-[#e4f03b]" /> Playback preview</div>
                  <div className="flex items-center gap-1.5">
                    <span className="studio-mono text-[10px] text-[#767185]">{aspect}</span>
                    <button data-testid="button-fullscreen" onClick={() => setToast('Fullscreen preview is available in the browser player')} className="rounded p-1 text-[#777187] hover:bg-[#242235]"><Maximize2 size={14} /></button>
                  </div>
                </div>
                <div className="grid min-h-[390px] grid-cols-[minmax(0,1fr)_150px] gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
                  <div className="relative overflow-hidden rounded-xl border border-[#353149] bg-[#1b1c2c] shadow-[inset_0_0_60px_rgba(89,72,156,.08)]">
                    <DemoFrame />
                    <div className="scan-line absolute left-0 right-0 top-0 h-[28%] border-b border-[#c1a5ff]/40 bg-gradient-to-b from-transparent to-[#b291ff]/[.05]" />
                    <div className="pointer-events-none absolute inset-[13%_27%] border border-[#e4f03b] shadow-[0_0_0_999px_rgba(5,5,12,.17)]">
                      <span className="absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2 border-[#e4f03b]" /><span className="absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2 border-[#e4f03b]" /><span className="absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2 border-[#e4f03b]" /><span className="absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2 border-[#e4f03b]" />
                      <div className="absolute -right-11 top-1/2 -translate-y-1/2 rounded bg-[#e4f03b] px-1 py-0.5 text-[8px] font-bold text-[#17171d]">9:16 CROP</div>
                    </div>
                    {splitScreen && <div className="absolute inset-y-0 right-0 w-1/2 border-l-2 border-[#e4f03b] bg-[#6f63a0]/30"><div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-[9px] font-semibold uppercase tracking-widest text-[#efeaff]">Split B</div></div>}
                    <div className="absolute bottom-4 left-1/2 w-[88%] -translate-x-1/2 text-center">
                      <div className={`mx-auto inline-block rounded px-2 py-1 leading-[.95] ${captionPreset === 'Cyber Neon' ? 'bg-[#14141e]/60 text-[#e4f03b]' : captionPreset === 'Minimal Clean' ? 'bg-transparent text-white' : 'bg-[#17171d]/75 text-white'}`} style={captionStyle}>
                        <span>{activeCaption} </span><span style={{ color: activeWordColor }}>{words[(activeWord + 1) % words.length]?.text}</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between"><span className="studio-mono rounded bg-[#14141c]/70 px-1.5 py-1 text-[9px] text-[#cbc7d4]">{formatTime(currentTime)}</span><span className="rounded bg-[#14141c]/70 px-1.5 py-1 text-[9px] text-[#e4f03b]">LIVE CAPTION</span></div>
                  </div>
                  <div className="relative overflow-hidden rounded-xl border border-[#353149] bg-[#1a1928]">
                    <DemoFrame vertical />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#151420] via-transparent to-transparent" />
                    <div className="absolute bottom-5 left-3 right-3 text-center" style={{ ...captionStyle, fontSize: `${Math.max(13, captionSize / 3.6)}px` }}><span>{activeCaption}</span> <span style={{ color: activeWordColor }}>{words[(activeWord + 1) % words.length]?.text}</span></div>
                    <div className="absolute left-2 top-2 rounded bg-[#171622]/75 px-1.5 py-1 text-[8px] text-[#b3acc4]">SHORT PREVIEW</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-[#292638] pb-3">
                  <button data-testid="button-playback" onClick={() => setPlaying((state) => !state)} className="grid h-8 w-8 place-items-center rounded-full bg-[#e4f03b] text-[#191a1b] hover:bg-[#f0f76d]">{playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}</button>
                  <span className="studio-mono mr-1 text-[11px] text-[#c4bfd0]">{formatTime(currentTime)} <span className="text-[#625d72]">/</span> {formatTime(DEMO_DURATION)}</span>
                  <div data-testid="timeline-scrubber" onClick={seekTimeline} className="relative h-1.5 min-w-[120px] flex-1 cursor-pointer rounded-full bg-[#302c44]"><div className="h-full rounded-full bg-[#a682ff]" style={{ width: `${(currentTime / DEMO_DURATION) * 100}%` }} /><div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[#e4f03b] bg-[#171622]" style={{ left: `calc(${(currentTime / DEMO_DURATION) * 100}% - 6px)` }} /></div>
                  <button data-testid="button-speaker-focus" onClick={() => setSpeakerFocus((state) => !state)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${speakerFocus ? 'border-[#a37dff] bg-[#2d2446] text-[#d8caff]' : 'border-[#332f43] text-[#777287]'}`}><Target size={12} />Focus {speakerFocus ? 'ON' : 'OFF'}</button>
                  <button data-testid="button-motion-zoom" onClick={() => setMotionZoom((state) => !state)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${motionZoom ? 'border-[#a37dff] bg-[#2d2446] text-[#d8caff]' : 'border-[#332f43] text-[#777287]'}`}><ZoomIn size={12} />Zoom {motionZoom ? 'ON' : 'OFF'}</button>
                  <button data-testid="button-split-screen" onClick={() => setSplitScreen((state) => !state)} className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] ${splitScreen ? 'border-[#e4f03b] bg-[#303516] text-[#e7ef99]' : 'border-[#332f43] text-[#777287]'}`}><Split size={12} />Split</button>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between"><SectionLabel label="Transcript / word timing" /><button data-testid="button-retranscribe" onClick={() => setToast('Transcript is already synced to the demo source')} className="text-[10px] text-[#9f87dc] hover:text-[#cbbbff]"><AudioWaveform size={12} className="mr-1 inline" />Re-sync</button></div>
                  <div data-testid="transcript-editor" className="rounded-lg border border-[#332f45] bg-[#181722] p-3">
                    <div className="flex flex-wrap gap-x-1.5 gap-y-2">
                      {words.map((word, index) => <button data-testid={`button-transcript-word-${index}`} key={`${word.text}-${index}`} onClick={() => { setActiveWord(index); setCurrentTime(word.start); }} className={`rounded px-1.5 py-1 text-[11px] transition-colors ${activeWord === index ? 'bg-[#e4f03b] font-bold text-[#17171d]' : word.color === 'active' ? 'bg-[#33284b] text-[#cbb9ff]' : 'text-[#bdb7c8] hover:bg-[#29263b] hover:text-white'}`}>{word.text}</button>)}
                    </div>
                    <div className="mt-3 grid grid-cols-[1fr_66px_66px] items-center gap-2 border-t border-[#2c293d] pt-3">
                      <div><label className="mb-1 block text-[9px] uppercase tracking-[.12em] text-[#747083]">Active word</label><input data-testid="input-active-word" value={words[activeWord]?.text ?? ''} onChange={(event) => updateWord(activeWord, { text: event.target.value })} className="w-full rounded border border-[#39344a] bg-[#211f2e] px-2 py-1.5 text-[11px] text-[#e4dfec] outline-none focus:border-[#9b76ff]" /></div>
                      <div><label className="mb-1 block text-[9px] uppercase tracking-[.12em] text-[#747083]">In</label><input data-testid="input-word-start" type="number" step=".1" value={words[activeWord]?.start ?? 0} onChange={(event) => updateWord(activeWord, { start: Number(event.target.value) })} className="w-full rounded border border-[#39344a] bg-[#211f2e] px-2 py-1.5 text-[10px] text-[#e4dfec] outline-none focus:border-[#9b76ff]" /></div>
                      <div><label className="mb-1 block text-[9px] uppercase tracking-[.12em] text-[#747083]">Out</label><input data-testid="input-word-end" type="number" step=".1" value={words[activeWord]?.end ?? 0} onChange={(event) => updateWord(activeWord, { end: Number(event.target.value) })} className="w-full rounded border border-[#39344a] bg-[#211f2e] px-2 py-1.5 text-[10px] text-[#e4dfec] outline-none focus:border-[#9b76ff]" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={`${mobilePanel === 'clips' ? 'block' : 'hidden'} border-b border-[#2a2838] bg-[#161620] p-4 xl:block xl:min-h-[calc(100dvh-145px)] xl:border-b-0 xl:border-l`}>
              <PanelHeading eyebrow="03 / FINISHING" title="Style & output" icon={<SlidersHorizontal size={15} />} />
              <div className="mt-4">
                <SectionLabel label="Caption preset" />
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {(['MrBeast Bold', 'Hormozi Style', 'Minimal Clean', 'Cyber Neon'] as CaptionPreset[]).map((preset) => <button data-testid={`button-caption-${preset.toLowerCase().replaceAll(' ', '-')}`} key={preset} onClick={() => setCaptionPreset(preset)} className={`rounded-md border px-2 py-2.5 text-left text-[10px] ${captionPreset === preset ? 'border-[#9b76ff] bg-[#31264c] text-[#eee7ff]' : 'border-[#302d40] bg-[#1b1a27] text-[#858095] hover:border-[#51466d]'}`}><span className={`mb-1 block h-2.5 w-10 rounded-sm ${preset === 'Cyber Neon' ? 'bg-[#e4f03b]' : preset === 'Minimal Clean' ? 'bg-[#e8e4f0]' : preset === 'Hormozi Style' ? 'bg-[#ff8d8d]' : 'bg-[#9b76ff]'}`} />{preset}</button>)}
                </div>
                <SettingGroup label="Font">
                  <div className="relative"><select data-testid="select-caption-font" value={captionFont} onChange={(event) => setCaptionFont(event.target.value)} className="w-full appearance-none rounded-md border border-[#332f43] bg-[#1b1a27] px-3 py-2 text-[11px] text-[#c9c2d7] outline-none focus:border-[#9b76ff]"><option>Inter</option><option>Montserrat</option><option>Poppins</option><option>Impact</option><option>Comic Sans MS</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-2.5 text-[#797389]" /></div>
                </SettingGroup>
                <SettingGroup label={`Size / ${captionSize}px`}><input data-testid="input-caption-size" aria-label="Caption size" type="range" min="28" max="86" value={captionSize} onChange={(event) => setCaptionSize(Number(event.target.value))} className="range-violet w-full" /></SettingGroup>
                <SettingGroup label="Position">
                  <div className="flex gap-1.5">{['Top', 'Center', 'Lower third'].map((position) => <button data-testid={`button-caption-position-${position.toLowerCase().replaceAll(' ', '-')}`} key={position} onClick={() => setCaptionPosition(position)} className={`flex-1 rounded-md border py-2 text-[10px] ${captionPosition === position ? 'border-[#9b76ff] bg-[#332853] text-[#eee8ff]' : 'border-[#302d40] bg-[#1b1a27] text-[#858095]'}`}>{position}</button>)}</div>
                </SettingGroup>
                <SettingGroup label="Active word color">
                  <div className="flex items-center gap-2 rounded-md border border-[#332f43] bg-[#1b1a27] p-1.5"><input data-testid="input-active-word-color" aria-label="Active word color" type="color" value={activeWordColor} onChange={(event) => setActiveWordColor(event.target.value)} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent" /><span className="studio-mono text-[10px] text-[#aaa3b6]">{activeWordColor.toUpperCase()}</span><div className="ml-auto h-4 w-4 rounded-full" style={{ background: activeWordColor }} /></div>
                </SettingGroup>
              </div>

              <div className="my-5 h-px bg-[#2d2a3c]" />
              <div className="flex items-center justify-between"><SectionLabel label="Generated clips" trailing={`${clips.length} READY`} /><button data-testid="button-sort-clips" onClick={() => setClips((current) => [...current].sort((a, b) => b.score - a.score))} className="text-[10px] text-[#8d82ad] hover:text-[#c8b7f9]">Sort score <ChevronDown size={12} className="inline" /></button></div>
              <div className="mt-2 space-y-2">
                {clips.map((clip, index) => <ClipCard key={clip.id} clip={clip} index={index} selected={clip.id === selectedClipId} exported={exportQueue.includes(clip.id)} exportProgress={exportProgress[clip.id]} onSelect={() => { setSelectedClipId(clip.id); setCurrentTime(clip.start); }} onPreview={() => { setSelectedClipId(clip.id); setCurrentTime(clip.start); setPlaying(true); setToast(`Previewing “${clip.title}”`); }} onDownload={() => { void downloadClip(clip, index + 1); }} />)}
              </div>
              <div className="mt-4 rounded-lg border border-[#37324a] bg-[#1b1929] p-3">
                <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#ddd8e8]"><Gauge size={14} className="text-[#e4f03b]" /> Export queue</div><span className="studio-mono text-[10px] text-[#777286]">{exportQueue.length}/{clips.length}</span></div>
                {exportQueue.length === 0 ? <div className="mt-2 text-[10px] leading-relaxed text-[#7e788d]">Render a clip to add it here. Exports are assembled locally with browser Blob APIs.</div> : <div className="mt-2 space-y-1.5">{exportQueue.map((id) => { const queued = clips.find((clip) => clip.id === id); return queued ? <div key={id} className="flex items-center justify-between text-[10px] text-[#aaa3b6]"><span className="max-w-[145px] truncate">{queued.title}</span><span className="studio-mono text-[#e4f03b]">{exportProgress[id] >= 100 ? 'READY' : `${exportProgress[id] ?? 0}%`}</span></div> : null; })}</div>}
              </div>
              <div className="mt-3 flex gap-2 rounded-lg border border-[#302d41] bg-[#1a1926] p-2.5 text-[10px] leading-relaxed text-[#777186]"><Radio size={14} className="mt-0.5 shrink-0 text-[#9c7cff]" /><span><strong className="font-medium text-[#a69db9]">Browser-only processing.</strong> MP4 is used when this browser supports native MP4 recording; otherwise OpusFlex uses a video/webm; codecs=vp9 fallback.</span></div>
              <button data-testid="button-download-all" onClick={downloadAll} disabled={clips.length === 0} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-[#4a435e] bg-[#211e2d] py-2 text-[10px] font-semibold text-[#aaa2bb] hover:border-[#74678e] hover:text-[#e9e1f7]"><Download size={13} />Download All Clips (.zip)</button>
            </section>
          </div>
        </main>
      </div>

      <nav className="sticky bottom-0 z-40 flex items-center justify-around border-t border-[#2b293a] bg-[#171622]/95 p-2 backdrop-blur-xl lg:hidden">
        <MobileTab active={mobilePanel === 'source'} label="Source" icon={<Upload size={16} />} onClick={() => setMobilePanel('source')} />
        <MobileTab active={mobilePanel === 'edit'} label="Edit bay" icon={<Scissors size={16} />} onClick={() => setMobilePanel('edit')} />
        <MobileTab active={mobilePanel === 'clips'} label="Output" icon={<Layers3 size={16} />} onClick={() => setMobilePanel('clips')} />
      </nav>
      {toast && <div data-testid="status-toast" className="fixed bottom-20 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-[#5a4b7e] bg-[#29233d] px-4 py-2.5 text-[11px] text-[#eae3fb] shadow-2xl lg:bottom-5"><Check size={14} className="text-[#e4f03b]" />{toast}</div>}
    </div>
  );
}

function SideIcon({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return <button data-testid={`button-nav-${label.toLowerCase()}`} onClick={onClick} title={label} className={`group relative grid h-10 w-10 place-items-center rounded-lg ${active ? 'bg-[#342951] text-[#bf9fff]' : 'text-[#716c82] hover:bg-[#242236] hover:text-[#beb4d5]'}`}>{icon}<span className="pointer-events-none absolute left-12 z-10 hidden whitespace-nowrap rounded bg-[#29253b] px-2 py-1 text-[10px] text-[#ddd6ec] group-hover:block">{label}</span></button>;
}

function PanelHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ReactNode }) {
  return <div className="flex items-start gap-2.5"><div className="mt-0.5 grid h-6 w-6 place-items-center rounded-md bg-[#2e2546] text-[#af8dff]">{icon}</div><div><div className="studio-mono text-[9px] tracking-[.15em] text-[#82789d]">{eyebrow}</div><h2 className="studio-display mt-0.5 text-[15px] font-semibold tracking-tight text-[#e9e5f1]">{title}</h2></div></div>;
}

function SectionLabel({ label, trailing }: { label: string; trailing?: string }) {
  return <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.13em] text-[#8d879b]"><span>{label}</span>{trailing && <span className="studio-mono text-[9px] font-normal tracking-normal text-[#625d71]">{trailing}</span>}</div>;
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mt-4"><label className="mb-1.5 block text-[10px] font-medium text-[#958ea3]">{label}</label>{children}</div>;
}

function DemoFrame({ compact = false, vertical = false }: { compact?: boolean; vertical?: boolean }) {
  return <div className={`relative h-full w-full overflow-hidden ${vertical ? 'bg-[#3b335e]' : 'bg-[#20243b]'}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(161,125,255,.36),transparent_33%),linear-gradient(125deg,#161b2f_10%,#45406c_48%,#222b48_88%)]" />
    <div className={`absolute ${vertical ? 'bottom-[12%] left-[22%] h-[57%] w-[58%]' : 'bottom-[11%] left-[22%] h-[65%] w-[38%]'} rounded-[45%_45%_35%_35%] bg-gradient-to-br from-[#c69f93] via-[#8a6070] to-[#3f324c] opacity-90 shadow-[12px_0_32px_rgba(12,12,27,.35)]`} />
    <div className={`absolute ${vertical ? 'bottom-[56%] left-[31%] h-[25%] w-[40%]' : 'bottom-[57%] left-[29%] h-[31%] w-[24%]'} rounded-[48%] bg-[#b87f77] shadow-[inset_-9px_-4px_0_rgba(45,30,55,.22)]`} />
    <div className="absolute bottom-[31%] left-[28%] h-[3px] w-[18%] rotate-[5deg] rounded-full bg-[#4a2f3e]" />
    {!compact && <><div className="absolute left-[8%] top-[14%] h-1 w-14 rounded-full bg-[#d2b8ff]/45" /><div className="absolute right-[8%] top-[25%] h-1 w-8 rounded-full bg-[#e4f03b]/55" /><div className="absolute bottom-[8%] right-[10%] text-[9px] uppercase tracking-[.24em] text-[#dfd2ff]/65">creator mindset</div></>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c17]/70 via-transparent to-[#9892cf]/10" />
  </div>;
}

function ClipCard({ clip, index, selected, exported, exportProgress, onSelect, onPreview, onDownload }: { clip: Clip; index: number; selected: boolean; exported: boolean; exportProgress?: number; onSelect: () => void; onPreview: () => void; onDownload: () => void }) {
  return <div data-testid={`card-clip-${clip.id}`} onClick={onSelect} className={`clip-card-enter group cursor-pointer rounded-lg border p-2.5 transition-all ${selected ? 'border-[#9b76ff] bg-[#29213f] shadow-[inset_3px_0_0_#a37cff]' : 'border-[#302d40] bg-[#1b1a27] hover:border-[#51466d]'}`} style={{ animationDelay: `${index * 55}ms` }}>
    <div className="flex gap-2.5">
      <div className="relative h-[54px] w-[39px] shrink-0 overflow-hidden rounded bg-[#363252]"><DemoFrame vertical compact /><span className="absolute bottom-1 left-1 rounded bg-[#13131c]/80 px-1 text-[8px] text-[#ddd7ee]">{formatTime(clip.start)}</span></div>
      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="truncate text-[11px] font-semibold text-[#ddd9e6]">{clip.title}</div><div className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-[#e4f03b]"><Zap size={10} fill="currentColor" />{clip.score}</div></div><div className="studio-mono mt-1 text-[9px] text-[#777186]">{formatTime(clip.start)} — {formatTime(clip.start + clip.length)} <span className="mx-1 text-[#4d485e]">·</span>{clip.length}s</div><div className="mt-2 flex items-center gap-1"><button data-testid={`button-preview-clip-${clip.id}`} onClick={(event) => { event.stopPropagation(); onPreview(); }} className="rounded bg-[#29253b] px-2 py-1 text-[9px] text-[#c9b9f7] hover:bg-[#3c3157]"><Play size={9} className="mr-1 inline" />Preview</button></div></div>
    </div>
    <button data-testid={`button-download-clip-${clip.id}`} onClick={(event) => { event.stopPropagation(); onDownload(); }} disabled={exportProgress !== undefined && exportProgress > 0 && exportProgress < 100} className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-[10px] font-bold transition-colors ${exportProgress !== undefined && exportProgress >= 100 ? 'bg-[#2e3a1a] text-[#e4f03b]' : 'bg-[#e4f03b] text-[#17171d] hover:bg-[#f0f76d] disabled:cursor-wait disabled:opacity-90'}`}>
      {exportProgress !== undefined && exportProgress > 0 && exportProgress < 100 ? <><Activity size={12} className="animate-pulse" />Rendering MP4: {exportProgress}%...</> : exportProgress !== undefined && exportProgress >= 100 ? <><Check size={12} />Download Complete!</> : <>📱 Download MP4 to Gallery</>}
    </button>
    {exported && exportProgress !== undefined && exportProgress < 100 && <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#373248]"><div className="h-full rounded-full bg-[#e4f03b] transition-[width] duration-150" style={{ width: `${exportProgress}%` }} /></div>}
  </div>;
}

function MobileTab({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button data-testid={`button-mobile-${label.toLowerCase().replace(' ', '-')}`} onClick={onClick} className={`flex min-w-[76px] flex-col items-center gap-1 rounded-lg px-4 py-1.5 text-[10px] ${active ? 'bg-[#332853] text-[#cfbcff]' : 'text-[#827b91]'}`}>{icon}{label}</button>;
}

export default App;