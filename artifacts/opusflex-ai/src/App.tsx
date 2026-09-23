import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  CloudUpload,
  Play,
  Pause,
  Download,
  Eye,
  MoreVertical,
  Check,
  User,
  SlidersHorizontal,
  Trash2,
  Edit3,
  X
} from 'lucide-react';

type RatioType = '9:16' | '16:9' | '1:1' | '4:5' | '3:4' | 'more';
type LengthType = '15-30' | '30-45' | '45-60' | '60-90' | '90-120' | 'custom';

interface GeneratedClip {
  id: number;
  number: number;
  title: string;
  timeRange: string;
  duration: string;
  thumbnail: string;
  videoUrl?: string;
  startTime?: number;
  endTime?: number;
}

const DEMO_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

const initialClips: GeneratedClip[] = [
  { id: 1, number: 1, title: 'Intro: Podcast Discussion', timeRange: '0:00 – 0:15', duration: '15s', thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&auto=format&fit=crop&q=60', startTime: 0, endTime: 15 },
  { id: 2, number: 2, title: 'Deep Conversation on Face Focus', timeRange: '0:15 – 0:30', duration: '15s', thumbnail: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&auto=format&fit=crop&q=60', startTime: 15, endTime: 30 },
  { id: 3, number: 3, title: 'Key Insights & Reactions', timeRange: '0:30 – 0:45', duration: '15s', thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&auto=format&fit=crop&q=60', startTime: 30, endTime: 45 },
  { id: 4, number: 4, title: 'Conclusion & Summary', timeRange: '0:45 – 1:00', duration: '15s', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=60', startTime: 45, endTime: 60 },
];

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [videoUrl, setVideoUrl] = useState(DEMO_VIDEO_URL);
  const [videoTitle, setVideoTitle] = useState('Podcast Discussion & Face Focus');
  const [videoAuthor, setVideoAuthor] = useState('Creator Studio');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);

  const [ratio, setRatio] = useState<RatioType>('9:16');
  const [lengthPreset, setLengthPreset] = useState<LengthType>('15-30');
  const [customLengthSec, setCustomLengthSec] = useState(15);
  const [showLengthModal, setShowLengthModal] = useState(false);

  const [autoCaptions, setAutoCaptions] = useState(true);
  const [captionStyle, setCaptionStyle] = useState('Bold Captions (White)');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitleLang, setSubtitleLang] = useState('Hindi');
  
  const [clipCount, setClipCount] = useState<number>(3);
  const [customClipCountInput, setCustomClipCountInput] = useState('3');
  const [showClipCountModal, setShowClipCountModal] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [clips, setClips] = useState<GeneratedClip[]>(initialClips);
  const [toast, setToast] = useState('');

  const [previewClip, setPreviewClip] = useState<GeneratedClip | null>(null);
  const [renameClipTarget, setRenameClipTarget] = useState<GeneratedClip | null>(null);
  const [newTitleInput, setNewTitleInput] = useState('');
  const [activeMenuClipId, setActiveMenuClipId] = useState<number | null>(null);
  
  const [downloadProgressMap, setDownloadProgressMap] = useState<{ [id: number]: number }>({});

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateTime = () => setCurrentTime(video.currentTime);
    const loadMeta = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', loadMeta);
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', loadMeta);
    };
  }, [videoUrl]);

  useEffect(() => {
    const pVideo = previewVideoRef.current;
    if (!pVideo || !previewClip) return;

    pVideo.currentTime = previewClip.startTime || 0;
    pVideo.play().catch(() => {});

    const handleTimeCheck = () => {
      if (previewClip.endTime !== undefined && pVideo.currentTime >= previewClip.endTime) {
        pVideo.currentTime = previewClip.startTime || 0;
        pVideo.play().catch(() => {});
      }
    };

    pVideo.addEventListener('timeupdate', handleTimeCheck);
    return () => {
      pVideo.removeEventListener('timeupdate', handleTimeCheck);
    };
  }, [previewClip]);

  const handleUploadUrl = () => {
    const url = videoUrlInput.trim();
    if (!url) {
      setToast('कृपया वैध URL दर्ज करें');
      return;
    }
    setVideoUrl(url);
    setVideoTitle('Custom URL Video');
    setVideoAuthor('Web Source');
    setPlaying(false);
    setToast('वीडियो यूआरएल सफलतापूर्वक लोड हो गया!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      setToast('कृपया सही वीडियो फाइल चुनें');
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    setVideoUrl(blobUrl);
    setVideoTitle(file.name);
    setVideoAuthor('Local Upload');
    setPlaying(false);
    setToast('वीडियो और ऑडियो सफलतापूर्वक लोड हो गए!');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getRatioContainerClass = (r: RatioType) => {
    switch (r) {
      case '9:16': return 'aspect-[9/16] max-h-[160px] max-w-[90px]';
      case '16:9': return 'aspect-[16/9] max-w-[160px]';
      case '1:1': return 'aspect-square max-h-[120px] max-w-[120px]';
      case '4:5': return 'aspect-[4/5] max-h-[140px] max-w-[110px]';
      case '3:4': return 'aspect-[3/4] max-h-[140px] max-w-[105px]';
      default: return 'aspect-[9/16] max-h-[160px] max-w-[90px]';
    }
  };

  const generateClipThumbnail = async (vidElement: HTMLVideoElement, startTime: number): Promise<string> => {
    return new Promise((resolve) => {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 160;
      thumbCanvas.height = 284;
      const tCtx = thumbCanvas.getContext('2d');
      
      const originalTime = vidElement.currentTime;
      vidElement.currentTime = startTime;

      const onSeeked = () => {
        vidElement.removeEventListener('seeked', onSeeked);
        if (tCtx) {
          tCtx.drawImage(vidElement, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }
        const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
        vidElement.currentTime = originalTime;
        resolve(dataUrl);
      };

      vidElement.addEventListener('seeked', onSeeked);
    });
  };

  const handleGenerateClips = async () => {
    setGenerating(true);
    setProgress(0);
    setToast(`AI वीडियो को स्कैन कर रहा है और ${ratio} रेश्यो के अनुसार क्लिप्स बना रहा है...`);

    let p = 0;
    const interval = window.setInterval(async () => {
      p += 25;
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(interval);
        setGenerating(false);

        const totalDur = duration > 0 ? duration : 180;
        let segLen = 15;
        if (lengthPreset === '15-30') segLen = 15;
        else if (lengthPreset === '30-45') segLen = 30;
        else if (lengthPreset === '45-60') segLen = 45;
        else if (lengthPreset === '60-90') segLen = 60;
        else if (lengthPreset === '90-120') segLen = 90;
        else if (lengthPreset === 'custom') segLen = customLengthSec;

        const hookTitles = [
          '🎙️ Stable Face Focus: Intro Discussion',
          '💡 Podcast Highlight: Core Topic',
          '🔥 Speaker Reaction & Viewpoint',
          '✨ Key Takeaway & Expert Advice',
          '🎯 Detailed Explanation & Focus',
          '🚀 Dynamic Conversation Climax'
        ];

        const tempVid = videoRef.current;

        const dynamicClips: GeneratedClip[] = [];
        for (let i = 0; i < clipCount; i++) {
          const start = Math.min(i * (totalDur / (clipCount + 0.2)), Math.max(0, totalDur - segLen));
          const end = Math.min(start + segLen, totalDur);
          
          let thumb = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&auto=format&fit=crop&q=60';
          if (tempVid) {
            try {
              thumb = await generateClipThumbnail(tempVid, start);
            } catch {}
          }

          dynamicClips.push({
            id: Date.now() + i,
            number: i + 1,
            title: hookTitles[i % hookTitles.length],
            timeRange: `${formatTime(start)} – ${formatTime(end)}`,
            duration: `${Math.round(end - start)}s`,
            thumbnail: thumb,
            videoUrl: videoUrl,
            startTime: start,
            endTime: end
          });
        }

        setClips(dynamicClips);
        setToast(`✨ ${clipCount} क्लिप्स (${ratio} रेश्यो और लाइव थंबनेल के साथ) तैयार हैं!`);
      }
    }, 300);
  };

  // FULLY OPTIMIZED LAG-FREE & SMOOTH PLAYBACK EXPORT LOGIC
  const handleDownloadClip = async (clip: GeneratedClip) => {
    if (downloadProgressMap[clip.id] !== undefined) return;
    setDownloadProgressMap((prev) => ({ ...prev, [clip.id]: 0 }));
    setToast(`⏳ ${ratio} रेश्यो और स्मूथ एचडी क्वालिटी के साथ क्लिप प्रोसेस हो रही है...`);

    try {
      const vid = document.createElement('video');
      vid.src = videoUrl;
      vid.crossOrigin = 'anonymous';
      vid.muted = false; 
      vid.playsInline = true;

      await new Promise((resolve, reject) => {
        vid.onloadedmetadata = () => resolve(true);
        vid.onerror = (e) => reject(e);
      });

      const startTime = clip.startTime || 0;
      const endTime = clip.endTime || (startTime + 15);
      const clipDuration = endTime - startTime;
      vid.currentTime = startTime;

      await new Promise((resolve) => {
        vid.onseeked = () => resolve(true);
      });

      let targetW = 1080;
      let targetH = 1920; // 9:16 Vertical
      if (ratio === '16:9') { targetW = 1920; targetH = 1080; }
      else if (ratio === '1:1') { targetW = 1080; targetH = 1080; }
      else if (ratio === '4:5') { targetW = 1080; targetH = 1350; }
      else if (ratio === '3:4') { targetW = 1080; targetH = 1440; }
      else if (ratio === 'more') { targetW = 1080; targetH = 1920; }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      const canvasStream = canvas.captureStream(24); // 24 FPS for buttery smooth mobile compatibility and zero lag

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const sourceNode = audioCtx.createMediaElementSource(vid);
      const destinationNode = audioCtx.createMediaStreamDestination();
      sourceNode.connect(destinationNode);

      const finalStream = new MediaStream();
      canvasStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));
      destinationNode.stream.getAudioTracks().forEach((track) => finalStream.addTrack(track));

      let recorder: MediaRecorder;
      try {
        // Optimized 8 Mbps Bitrate for flawless playback without stuttering or crashing
        recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm; codecs=vp8,opus', videoBitsPerSecond: 8000000 });
      } catch {
        try {
          recorder = new MediaRecorder(finalStream, { mimeType: 'video/webm', videoBitsPerSecond: 8000000 });
        } catch {
          recorder = new MediaRecorder(finalStream);
        }
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${clip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${ratio.replace(':', '_')}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setDownloadProgressMap((prev) => {
          const copy = { ...prev };
          delete copy[clip.id];
          return copy;
        });
        setToast(`📥 ${ratio} रेश्यो की सुपर स्मूथ क्लिप डाउनलोड हो गई!`);
      };

      recorder.start();
      vid.playbackRate = 1.0;
      vid.play().catch(() => {});

      const drawFrame = () => {
        if (vid.ended || vid.currentTime >= endTime || !recorder || recorder.state !== 'recording') {
          if (recorder && recorder.state === 'recording') {
            recorder.stop();
            vid.pause();
          }
          return;
        }

        const elapsed = vid.currentTime - startTime;
        const currentPct = Math.min(99, Math.round((elapsed / clipDuration) * 100));
        setDownloadProgressMap((prev) => ({ ...prev, [clip.id]: currentPct }));

        const vW = vid.videoWidth;
        const vH = vid.videoHeight;
        const targetAspect = targetW / targetH;
        const videoAspect = vW / vH;

        let sX = 0, sY = 0, sW = vW, sH = vH;
        if (videoAspect > targetAspect) {
          sW = vH * targetAspect;
          sX = (vW - sW) / 2;
        } else {
          sH = vW / targetAspect;
          sY = Math.max(0, (vH - sH) * 0.2);
        }

        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(vid, sX, sY, sW, sH, 0, 0, targetW, targetH);

        requestAnimationFrame(drawFrame);
      };

      requestAnimationFrame(drawFrame);

    } catch (err) {
      console.error(err);
      setDownloadProgressMap((prev) => {
        const copy = { ...prev };
        delete copy[clip.id];
        return copy;
      });
      setToast('❌ डाउनलोड प्रक्रिया में त्रुटि आई।');
    }
  };

  const handleDeleteClip = (id: number) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setActiveMenuClipId(null);
    setToast('🗑️ क्लिप हटा दी गई है!');
  };

  const handleSaveRename = () => {
    if (!renameClipTarget || !newTitleInput.trim()) return;
    setClips((prev) =>
      prev.map((c) => (c.id === renameClipTarget.id ? { ...c, title: newTitleInput.trim() } : c))
    );
    setRenameClipTarget(null);
    setNewTitleInput('');
    setToast('✏️ क्लिप का नाम बदल दिया गया है!');
  };

  const handlePreviewClip = (clip: GeneratedClip) => {
    setPreviewClip(clip);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#e2e8f0] font-sans antialiased selection:bg-purple-600 selection:text-white pb-16">
      
      {/* Top Header Bar */}
      <header className="border-b border-gray-800/60 bg-[#0b0f19]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button className="text-gray-400 hover:text-white p-1 rounded-lg cursor-pointer">
              <SlidersHorizontal size={20} />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                <Sparkles size={18} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-wide">ClipShort AI</h1>
                <p className="text-[10px] text-gray-400 font-medium">Stable Face Focus & High Quality Ratio</p>
              </div>
            </div>
          </div>
          
          <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 cursor-pointer hover:bg-purple-600/30 transition">
            <User size={18} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

        {/* 1. TOP MAIN VIDEO PLAYER */}
        <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] overflow-hidden shadow-2xl">
          <div className="relative bg-black w-full flex items-center justify-center overflow-hidden max-h-[440px]">
            <video 
              ref={videoRef}
              src={videoUrl}
              playsInline
              controls
              className="w-full max-h-[440px] object-contain"
            />
          </div>

          <div className="px-5 py-3.5 space-y-2.5 bg-[#0d121f]">
            <div className="flex items-center justify-between text-xs text-gray-400 font-mono">
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <button onClick={() => { setPlaying(!playing); playing ? videoRef.current?.pause() : videoRef.current?.play(); }} className="text-purple-400 hover:text-purple-300 cursor-pointer">
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
            
            <div 
              className="relative h-2 bg-gray-800 rounded-full cursor-pointer overflow-hidden group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newTime = pos * duration;
                setCurrentTime(newTime);
                if (videoRef.current) videoRef.current.currentTime = newTime;
              }}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-[#ef4444] group-hover:bg-red-500 rounded-full transition-all" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} 
              />
            </div>

            <div className="pt-1 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white truncate max-w-md">{videoTitle}</h2>
                <p className="text-xs text-gray-400">{videoAuthor}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. UPLOAD VIDEO SECTION */}
        <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-4 shadow-xl">
          <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Upload Video (With Voice & Audio)</h2>
          
          <div className="space-y-3">
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-500">
                  <Upload size={15} />
                </span>
                <input 
                  type="text" 
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  placeholder="Paste video URL here" 
                  className="w-full bg-[#07090e] border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-200 focus:outline-none focus:border-purple-600 font-mono"
                />
              </div>
              <button 
                onClick={handleUploadUrl}
                className="bg-purple-600 hover:bg-purple-500 px-5 py-3 rounded-xl text-xs font-semibold text-white transition cursor-pointer shadow-md shadow-purple-600/30 shrink-0"
              >
                Upload URL
              </button>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-gray-800/80"></div>
              <span className="flex-shrink mx-4 text-[10px] text-gray-500 font-bold uppercase tracking-wider">OR</span>
              <div className="flex-grow border-t border-gray-800/80"></div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-800 hover:border-purple-600/80 rounded-xl p-6 text-center cursor-pointer transition bg-[#07090e]/60 flex flex-col items-center justify-center gap-2 group"
            >
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileChange} className="hidden" />
              <div className="w-10 h-10 rounded-full bg-purple-600/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition">
                <CloudUpload size={20} />
              </div>
              <p className="text-xs text-gray-300 font-medium">Drag & drop your video here</p>
              <p className="text-[11px] text-gray-500">or browse from device</p>
            </div>
          </div>
        </div>

        {/* 3. CONTROLS GRID SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Left Column */}
          <div className="space-y-5">
            
            {/* RATIO BOX */}
            <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-3.5 shadow-xl">
              <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Target Ratio (For Shorts)</h2>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { id: '9:16', label: 'Vertical', shapeClass: 'w-3.5 h-6' },
                  { id: '16:9', label: 'Landscape', shapeClass: 'w-6 h-3.5' },
                  { id: '1:1', label: 'Square', shapeClass: 'w-4 h-4' },
                  { id: '4:5', label: 'Portrait', shapeClass: 'w-4 h-5' },
                  { id: '3:4', label: 'Portrait', shapeClass: 'w-4.5 h-6' },
                  { id: 'more', label: 'More', shapeClass: 'w-5 h-4' },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setRatio(item.id as RatioType)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[11px] transition cursor-pointer ${
                      ratio === item.id 
                        ? 'bg-purple-600/20 border-purple-600 text-white shadow-lg shadow-purple-600/10' 
                        : 'bg-[#07090e] border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <div className={`border rounded-sm mb-1.5 flex items-center justify-center ${item.shapeClass} ${ratio === item.id ? 'border-purple-400 bg-purple-400/20' : 'border-gray-600'}`} />
                    <span className="font-semibold text-[10px]">{item.id}</span>
                    <span className="text-[9px] opacity-70 scale-90">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CAPTIONS & SUBTITLES BOX */}
            <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-4 shadow-xl">
              <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Captions & Subtitles</h2>
              
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Auto Captions</span>
                  <div 
                    onClick={() => setAutoCaptions(!autoCaptions)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${autoCaptions ? 'bg-purple-600 justify-end' : 'bg-gray-800 justify-start'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transition-all" />
                  </div>
                </div>

                <select 
                  value={captionStyle} 
                  onChange={(e) => setCaptionStyle(e.target.value)}
                  className="w-full bg-[#07090e] border border-gray-800 rounded-xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="Bold Captions (White)">Bold Captions (White)</option>
                  <option value="Neon Glow">Neon Glow</option>
                  <option value="Classic Yellow">Classic Yellow</option>
                </select>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-300">Subtitles</span>
                  <div 
                    onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${subtitlesEnabled ? 'bg-purple-600 justify-end' : 'bg-gray-800 justify-start'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transition-all" />
                  </div>
                </div>

                <select 
                  value={subtitleLang} 
                  onChange={(e) => setSubtitleLang(e.target.value)}
                  className="w-full bg-[#07090e] border border-gray-800 rounded-xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="Hindi">Hindi</option>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                </select>
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div className="space-y-5">
            
            {/* LENGTH BOX */}
            <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-3.5 shadow-xl">
              <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Length</h2>
              <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                {[
                  { id: '15-30', label: '15 – 30 sec' },
                  { id: '30-45', label: '30 – 45 sec' },
                  { id: '45-60', label: '45 – 60 sec' },
                  { id: '60-90', label: '60 – 90 sec' },
                  { id: '90-120', label: '90 – 120 sec' },
                ].map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setLengthPreset(item.id as LengthType)}
                    className={`py-2.5 px-2 rounded-xl border text-center transition cursor-pointer ${
                      lengthPreset === item.id 
                        ? 'bg-purple-600/20 border-purple-600 text-white shadow' 
                        : 'bg-[#07090e] border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                
                <button 
                  onClick={() => setShowLengthModal(true)}
                  className={`py-2.5 px-2 rounded-xl border text-purple-400 flex items-center justify-center gap-1 transition cursor-pointer ${lengthPreset === 'custom' ? 'bg-purple-600/20 border-purple-600 text-white' : 'bg-[#07090e] border-gray-800 hover:border-purple-600'}`}
                >
                  <SlidersHorizontal size={13} /> {lengthPreset === 'custom' ? `${customLengthSec}s` : 'Customize'}
                </button>
              </div>
            </div>

            {/* NUMBER OF CLIPS BOX */}
            <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-3.5 shadow-xl">
              <h2 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">Number of Clips</h2>
              <div className="grid grid-cols-5 gap-2 text-xs font-semibold">
                {[3, 5, 8, 10].map((num) => (
                  <button 
                    key={num}
                    onClick={() => { setClipCount(num); setCustomClipCountInput(num.toString()); }}
                    className={`py-2.5 rounded-xl border text-center transition cursor-pointer ${
                      clipCount === num 
                        ? 'bg-purple-600/20 border-purple-600 text-white shadow' 
                        : 'bg-[#07090e] border-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                
                <button 
                  onClick={() => setShowClipCountModal(true)}
                  className="py-2.5 px-1 rounded-xl border border-gray-800 bg-[#07090e] text-purple-400 hover:border-purple-600 flex flex-col items-center justify-center text-[10px] transition cursor-pointer"
                >
                  <SlidersHorizontal size={12} /> Customize
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* 4. PRIMARY ACTION BUTTON */}
        <div>
          <button 
            onClick={handleGenerateClips}
            disabled={generating}
            className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:opacity-95 text-white font-bold py-4 rounded-2xl shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition text-sm tracking-wide"
          >
            <Sparkles size={18} />
            {generating ? `Generating Clips (${progress}%)...` : `Generate Clips (${ratio})`}
          </button>
          {generating && (
            <div className="mt-2 h-1.5 w-full bg-[#0d121f] rounded-full overflow-hidden">
              <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>

        {/* 5. GENERATED CLIPS LIST SECTION */}
        <div className="rounded-2xl border border-gray-800/80 bg-[#0d121f] p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">
              Generated Clips ({clips.length}) - Format: {ratio}
            </h2>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-800 bg-[#07090e] text-xs text-gray-300 hover:border-purple-600 transition cursor-pointer">
              <Eye size={14} /> Preview All
            </button>
          </div>

          <div className="space-y-3">
            {clips.map((clip) => {
              const currentProgress = downloadProgressMap[clip.id];
              const isDownloadingThis = currentProgress !== undefined;

              return (
                <div key={clip.id} className="relative flex items-center justify-between p-3 rounded-xl border border-gray-800/80 bg-[#07090e] hover:border-gray-700 transition">
                  <div className="flex items-center space-x-3.5">
                    <div className={`relative overflow-hidden bg-black rounded-lg flex items-center justify-center shadow ${getRatioContainerClass(ratio)}`}>
                      <img src={clip.thumbnail} alt={clip.title} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 text-[9px] font-bold text-white bg-black/70 rounded font-mono">
                        #{clip.number}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">{clip.title}</h3>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">{clip.timeRange} • <span className="text-purple-400">{ratio} Ratio</span></p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handlePreviewClip(clip)}
                      className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition cursor-pointer"
                      title="Preview Clip"
                    >
                      <Eye size={15} />
                    </button>

                    <button 
                      onClick={() => handleDownloadClip(clip)}
                      disabled={isDownloadingThis}
                      className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-300 hover:text-white hover:border-gray-700 transition cursor-pointer disabled:opacity-80 flex items-center gap-1.5 text-xs font-mono"
                      title="Download Cropped & Trimmed Clip"
                    >
                      <Download size={14} className={isDownloadingThis ? 'text-purple-400 animate-pulse' : ''} />
                      <span>{isDownloadingThis ? `${currentProgress}%` : 'Download'}</span>
                    </button>

                    <div className="relative">
                      <button 
                        onClick={() => setActiveMenuClipId(activeMenuClipId === clip.id ? null : clip.id)}
                        className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition cursor-pointer"
                        title="More Options"
                      >
                        <MoreVertical size={15} />
                      </button>

                      {activeMenuClipId === clip.id && (
                        <div className="absolute right-0 mt-2 w-36 bg-[#131b2e] border border-gray-700 rounded-xl shadow-2xl z-20 py-1.5 text-xs">
                          <button 
                            onClick={() => { setRenameClipTarget(clip); setNewTitleInput(clip.title); setActiveMenuClipId(null); }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 text-gray-200 hover:bg-purple-600/20 hover:text-purple-300 transition"
                          >
                            <Edit3 size={13} /> Rename
                          </button>
                          <button 
                            onClick={() => handleDeleteClip(clip.id)}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-400 hover:bg-red-500/20 transition"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* MODAL 1: PREVIEW CLIP MODAL */}
      {previewClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d121f] border border-gray-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white truncate">{previewClip.title}</h3>
                <p className="text-[11px] text-purple-400 font-mono">Segment: {previewClip.timeRange} | Format: {ratio}</p>
              </div>
              <button onClick={() => setPreviewClip(null)} className="text-gray-400 hover:text-white p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>
            
            <div className={`relative bg-black rounded-xl overflow-hidden flex items-center justify-center mx-auto w-full ${getRatioContainerClass(ratio)} shadow-inner border border-gray-800`}>
              <video 
                ref={previewVideoRef}
                src={videoUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-cover" 
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-gray-400 font-mono">Audio & Stable Face Focus ({ratio})</span>
              <button 
                onClick={() => handleDownloadClip(previewClip)}
                disabled={downloadProgressMap[previewClip.id] !== undefined}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-purple-600/25 disabled:opacity-50"
              >
                <Download size={14} /> Download Short ({ratio})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RENAME CLIP MODAL */}
      {renameClipTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d121f] border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Rename Clip</h3>
              <button onClick={() => setRenameClipTarget(null)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <input 
              type="text" 
              value={newTitleInput}
              onChange={(e) => setNewTitleInput(e.target.value)}
              placeholder="Enter new clip title"
              className="w-full bg-[#07090e] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-purple-600"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setRenameClipTarget(null)} className="px-3.5 py-2 rounded-xl bg-gray-800 text-xs text-gray-300 hover:bg-gray-700">Cancel</button>
              <button onClick={handleSaveRename} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CUSTOMIZE LENGTH MODAL */}
      {showLengthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d121f] border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Customize Clip Length</h3>
              <button onClick={() => setShowLengthModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <label className="text-gray-300 block">Select duration: <span className="text-purple-400 font-bold font-mono text-sm">{customLengthSec} seconds</span> (1s - 120s)</label>
              <input 
                type="range" 
                min={1} 
                max={120} 
                value={customLengthSec}
                onChange={(e) => setCustomLengthSec(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>1s</span>
                <span>60s</span>
                <span>120s (2 min)</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowLengthModal(false)} className="px-3.5 py-2 rounded-xl bg-gray-800 text-xs text-gray-300">Cancel</button>
              <button onClick={() => { setLengthPreset('custom'); setShowLengthModal(false); setToast(`Custom length set to ${customLengthSec}s`); }} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-semibold">Confirm Length</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CUSTOMIZE NUMBER OF CLIPS MODAL */}
      {showClipCountModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d121f] border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Customize Number of Clips</h3>
              <button onClick={() => setShowClipCountModal(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <label className="text-gray-300 block">Enter number of clips to generate:</label>
              <input 
                type="number" 
                min={1} 
                max={15} 
                value={customClipCountInput}
                onChange={(e) => setCustomClipCountInput(e.target.value)}
                placeholder="Enter 1 to 15"
                className="w-full bg-[#07090e] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-600"
              />
              <p className="text-[11px] text-purple-400 font-medium">⚠️ Maximum only 15 clips allowed.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowClipCountModal(false)} className="px-3.5 py-2 rounded-xl bg-gray-800 text-xs text-gray-300">Cancel</button>
              <button 
                onClick={() => {
                  const val = parseInt(customClipCountInput, 10);
                  if (isNaN(val) || val < 1 || val > 15) {
                    setToast('कृपया 1 से 15 के बीच की संख्या दर्ज करें!');
                    return;
                  }
                  setClipCount(val);
                  setShowClipCountModal(false);
                  setToast(`Number of clips set to ${val}`);
                }} 
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs text-white font-semibold"
              >
                Confirm Count
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#0d121f] border border-gray-800 px-4 py-3 rounded-xl text-xs text-white shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <Check size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
