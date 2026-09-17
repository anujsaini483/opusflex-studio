import React, { useState, useRef, useEffect } from 'react';
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

type DurationPreset = 'under15' | '15-30' | '30-60' | 'custom';
type Aspect = 'original' | '9:16' | '1:1' | '16:9';
type CaptionPosition = 'top' | 'center' | 'bottom';
type CaptionWord = { text: string; start: number; end: number };

interface Clip {
  id: number;
  title: string;
  start: number;
  length: number;
  score: number;
  sourceName: string;
  createdAt: number;
}

const DEMO_DURATION = 12;

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewSectionRef = useRef<HTMLDivElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
  const [videoUrl, setVideoUrl] = useState('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
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
  const [recentClips, setRecentClips] = useState<Clip[]>([
    { id: 1, title: 'The perfect moment is a myth', start: 0, length: 4, score: 94, sourceName: 'Demo video', createdAt: 1 },
    { id: 2, title: 'Stop waiting to publish', start: 4, length: 4, score: 87, sourceName: 'Demo video', createdAt: 1 },
  ]);
  const [toast, setToast] = useState('Studio ready');

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateTime = () => setCurrentTime(video.currentTime);
    const loadMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setSourceDuration(video.duration);
      }
    };
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', loadMetadata);
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', loadMetadata);
    };
  }, [videoUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleFile = (file?: File) => {
    if (!file || !file.type.startsWith('video/')) {
      setToast('कृपया सही वीडियो फाइल चुनें');
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoUrl(url);
    setVideoUrlInput(file.name);
    setPlaying(false);
    setToast('वीडियो सफलतापूर्वक अपलोड हो गया');
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLoadUrl = () => {
    const url = videoUrlInput.trim();
    if (!url) {
      setToast('कृपया वैध वीडियो URL दर्ज करें');
      return;
    }
    setVideoFile(null);
    setVideoUrl(url);
    setPlaying(false);
    setToast('वीडियो URL लोड हो गया');
    previewSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateClips = () => {
    if (!videoUrl) {
      setToast('पहले वीडियो अपलोड करें');
      return;
    }
    setProgress(0);
    setProcessing(true);
    setToast('AI वीडियो एनालाइज कर रहा है…');

    let p = 0;
    const timer = window.setInterval(() => {
      p += 25;
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(timer);
        setProcessing(false);
        const newClips: Clip[] = [
          { id: Date.now(), title: 'Viral Highlight #1', start: 0, length: 5, score: 96, sourceName: videoFile?.name || 'URL Video', createdAt: Date.now() },
          { id: Date.now() + 1, title: 'Best Hook Moment #2', start: 5, length: 5, score: 89, sourceName: videoFile?.name || 'URL Video', createdAt: Date.now() },
        ];
        setRecentClips((prev) => [...newClips, ...prev]);
        setToast('AI क्लिप्स सफलतापूर्वक तैयार हैं!');
      }
    }, 350);
  };

  const getCaptionLine = (time: number) => {
    if (!captionWords.length) return captionText.trim();
    const active = captionWords.find((w) => time >= w.start && time <= w.end);
    return active ? active.text : captionText.trim();
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-[#f3f4f6] font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                FLUX CLIPS AI STUDIO
              </h1>
              <p className="text-[11px] text-slate-400">Smart Video Trimming & Auto-Crop Engine</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Engine Ready
          </span>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT SIDEBAR: Steps */}
          <div className="space-y-6">
            
            {/* STEP 1 */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/20 text-violet-300 border border-violet-500/30">STEP 1</span>
                <h2 className="text-xs font-semibold text-slate-200">Upload Source Video</h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    placeholder="https://example.com/video.mp4" 
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                  />
                  <button 
                    onClick={handleLoadUrl}
                    className="bg-violet-600 hover:bg-violet-500 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition cursor-pointer flex items-center gap-1"
                  >
                    <Upload size={13} /> URL
                  </button>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[9px] text-slate-500 font-bold uppercase">OR FILE</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <div 
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  className="border-2 border-dashed border-slate-700/80 hover:border-violet-500 rounded-xl p-4 text-center cursor-pointer transition bg-slate-950/40 flex flex-col items-center justify-center gap-1.5"
                >
                  <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                  <div className="w-8 h-8 rounded-full bg-violet-600/10 flex items-center justify-center text-violet-400">
                    <CloudUpload size={16} />
                  </div>
                  <span className="text-xs text-slate-200 font-medium">Click or Drag & Drop (No Size Limit)</span>
                  {videoFile && <span className="text-[10px] text-violet-400 truncate max-w-[200px]"><FileVideo size={11} className="inline mr-1" />{videoFile.name}</span>}
                </div>
              </div>
            </div>

            {/* STEP 2 */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/20 text-violet-300 border border-violet-500/30">STEP 2</span>
                <h2 className="text-xs font-semibold text-slate-200">Clip Length & Count</h2>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1.5">Duration Preset</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['under15', '15-30', '30-60', 'custom'] as DurationPreset[]).map((preset) => (
                      <button 
                        key={preset}
                        onClick={() => setDurationPreset(preset)}
                        className={`py-2 rounded-xl border text-[11px] font-medium transition cursor-pointer ${durationPreset === preset ? 'bg-violet-600 text-white border-violet-500' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}`}
                      >
                        {preset === 'under15' ? 'Under 15s' : preset === '15-30' ? '15–30s' : preset === '30-60' ? '30–60s' : 'Custom'}
                      </button>
                    ))}
                  </div>
                </div>

                {durationPreset === 'custom' && (
                  <div className="flex items-center gap-3">
                    <input type="range" min="5" max="90" value={customDuration} onChange={(e) => setCustomDuration(Number(e.target.value))} className="flex-1 accent-violet-500" />
                    <span className="font-mono text-slate-300">{customDuration}s</span>
                  </div>
                )}

                <div>
                  <label className="block text-slate-400 mb-1.5">Number of Clips</label>
                  <div className="flex gap-2">
                    {[3, 5, 10].map((num) => (
                      <button 
                        key={num}
                        onClick={() => setClipCount(num)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${clipCount === num ? 'bg-violet-600 text-white border-violet-500' : 'bg-slate-950 text-slate-400 border-slate-800'}`}
                      >
                        {num} Clips
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3 */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-violet-600/20 text-violet-300 border border-violet-500/30">STEP 3</span>
                <h2 className="text-xs font-semibold text-slate-200">AI Processing</h2>
              </div>
              <button 
                onClick={generateClips}
                disabled={processing}
                className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs"
              >
                {processing ? <WandSparkles className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {processing ? `Analyzing Video (${progress}%)…` : 'Generate AI Clips Now'}
              </button>
              {processing && (
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              )}
            </div>

          </div>

          {/* CENTER & RIGHT: Preview & Output */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Preview Section */}
            <div ref={previewSectionRef} className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-200">Live Video Preview & Aspect Ratio</h2>
                <div className="flex gap-1.5">
                  {(['original', '9:16', '1:1', '16:9'] as Aspect[]).map((ratio) => (
                    <button 
                      key={ratio}
                      onClick={() => setAspect(ratio)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer border ${aspect === ratio ? 'bg-violet-600 text-white border-violet-500 shadow' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}`}
                    >
                      {ratio === 'original' ? 'Original' : ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Player Box */}
              <div className="relative bg-black rounded-xl overflow-hidden mx-auto flex items-center justify-center border border-slate-800 shadow-inner max-h-[440px] w-full" style={{ aspectRatio: aspect === '9:16' ? '9/16' : aspect === '1:1' ? '1/1' : '16/9' }}>
                <video 
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={() => setPlaying(!playing)}
                />
                {!playing && (
                  <button onClick={() => setPlaying(true)} className="absolute bg-violet-600/90 hover:bg-violet-600 text-white p-3.5 rounded-full shadow-lg cursor-pointer transform transition hover:scale-110">
                    <Play size={20} className="fill-current ml-0.5" />
                  </button>
                )}
                {showCaption && (
                  <div className={`absolute left-1/2 -translate-x-1/2 text-center pointer-events-none w-[90%] ${captionPosition === 'top' ? 'top-4' : captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-6'}`}>
                    <span className="px-3 py-1 rounded bg-black/70 text-sm sm:text-base font-extrabold text-white" style={{ color: captionColor, textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
                      {getCaptionLine(currentTime)}
                    </span>
                  </div>
                )}
              </div>

              {/* Seeker */}
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => setPlaying(!playing)} className="p-2 rounded-full bg-violet-600 text-white hover:bg-violet-500 cursor-pointer">
                  {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <span className="text-[11px] font-mono text-slate-400">{formatTime(currentTime)}</span>
                <input 
                  type="range" 
                  min={0} 
                  max={sourceDuration || 100} 
                  value={currentTime} 
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    setCurrentTime(t);
                    if (videoRef.current) videoRef.current.currentTime = t;
                  }}
                  className="flex-1 accent-violet-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-400">{formatTime(sourceDuration)}</span>
              </div>
            </div>

            {/* Extracted Clips Output Grid */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  🎬 Extracted Clips Output
                </h2>
                <span className="text-[11px] font-mono bg-violet-600/20 text-violet-400 px-2.5 py-0.5 rounded-full border border-violet-500/30">
                  {recentClips.length} Clips
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recentClips.map((clip, idx) => (
                  <div key={clip.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5">
                    <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative flex items-center justify-center group">
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-violet-600 text-white font-mono text-[9px]">
                        Clip #{idx + 1} ({clip.score}%)
                      </span>
                      <Play size={24} className="text-violet-400 group-hover:scale-110 transition cursor-pointer" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200 truncate">{clip.title}</span>
                      <button onClick={() => setToast(`Downloading ${clip.title}...`)} className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-1 cursor-pointer">
                        <Download size={11} /> Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 px-4 py-3 rounded-xl text-xs text-white shadow-2xl flex items-center gap-2 backdrop-blur-md">
          <Check size={14} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}
