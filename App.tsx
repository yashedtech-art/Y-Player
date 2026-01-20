
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Settings, Plus, Brain, 
  Trash2, Upload, MessageSquare, Camera, Sparkles, Bookmark, 
  FlipHorizontal, MonitorPlay, Pencil, Eraser, Video as VideoIcon, 
  History, Send, Search, Timer, Activity, Wind, Zap, Gauge, 
  ExternalLink, Users, Eye, EyeOff, Rotate3d, Layers, Share2,
  List, Palette, BarChart3, HelpCircle, ChevronRight, LayoutGrid, Cpu, X,
  RefreshCcw, ShieldAlert, Sparkle, User
} from 'lucide-react';
import { VideoFile, PlayerState, AIAnalysis, Chapter, ViewMode, SpatialLabel, LinkedReference, StyleMode, Poll } from './types';
import { analyzeSpatialScene, chatWithScene, semanticSearch, generateChapters, analyzeContentComplexity } from './services/geminiService';

export default function App() {
  // --- Core State ---
  const [playlist, setPlaylist] = useState<VideoFile[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(PlayerState.IDLE);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'ai' | 'chat' | 'chapters'>('vault');
  
  // --- Advanced AI Feature State ---
  const [viewMode, setViewMode] = useState<ViewMode>('Standard');
  const [styleMode, setStyleMode] = useState<StyleMode>('Default');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', text: string, speaker?: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeLabels, setActiveLabels] = useState<SpatialLabel[]>([]);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [ambilightColor, setAmbilightColor] = useState('rgba(59, 130, 246, 0.1)');
  const [smartSpeedActive, setSmartSpeedActive] = useState(false);
  const [smartSpeedReason, setSmartSpeedReason] = useState("");

  // --- Settings State ---
  const [aiFrequency, setAiFrequency] = useState(5000);
  const [isAmbilightEnabled, setIsAmbilightEnabled] = useState(true);
  const [isSmartThemeEnabled, setIsSmartThemeEnabled] = useState(false);
  const [accentColor, setAccentColor] = useState('#3b82f6'); 

  // Temporal Buffer
  const frameBuffer = useRef<{ timestamp: number, data: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingCtx = useRef<CanvasRenderingContext2D | null>(null);
  const isMouseDown = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  const currentVideo = currentVideoIndex !== null ? playlist[currentVideoIndex] : null;

  // --- Style Logic ---
  const styleFilters: Record<StyleMode, string> = {
    'Default': 'none',
    'Cinematic': 'contrast(1.1) saturate(1.2) brightness(0.9) sepia(0.1)',
    'Study': 'sepia(0.1) brightness(1.1) saturate(0.7) contrast(0.95)',
    'Neon': 'saturate(2) hue-rotate(15deg) contrast(1.2)',
    'Noir': 'grayscale(1) contrast(1.4) brightness(0.8)'
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const safePlay = async () => {
    if (videoRef.current) {
      try {
        playPromiseRef.current = videoRef.current.play();
        await playPromiseRef.current;
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') console.error("Playback error:", error);
      }
    }
  };

  const safePause = async () => {
    if (videoRef.current) {
      if (playPromiseRef.current) await playPromiseRef.current.catch(() => {});
      videoRef.current.pause();
    }
  };

  // --- Drawing Logic ---
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !drawingCtx.current || !canvasRef.current) return;
    isMouseDown.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    drawingCtx.current.beginPath();
    drawingCtx.current.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMouseDown.current || !drawingCtx.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    
    drawingCtx.current.lineTo(x, y);
    drawingCtx.current.stroke();
  };

  const stopDrawing = () => {
    isMouseDown.current = false;
  };

  const clearDrawings = () => {
    if (drawingCtx.current && canvasRef.current) {
      drawingCtx.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (canvasRef.current) {
      drawingCtx.current = canvasRef.current.getContext('2d');
      if (drawingCtx.current) {
        drawingCtx.current.strokeStyle = accentColor;
        drawingCtx.current.lineWidth = 4;
        drawingCtx.current.lineCap = 'round';
        drawingCtx.current.lineJoin = 'round';
      }
    }
  }, [isDrawing, accentColor]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Ambilight and Rolling Frame Buffer Effect
  useEffect(() => {
    if (playerState === PlayerState.PLAYING && videoRef.current) {
      const interval = setInterval(() => {
        if (!videoRef.current) return;
        
        // Extract dominant color for Ambilight and Smart Theme
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          
          if (isAmbilightEnabled) {
            setAmbilightColor(`rgba(${r}, ${g}, ${b}, 0.2)`);
          } else {
            setAmbilightColor('rgba(59, 130, 246, 0.1)');
          }

          if (isSmartThemeEnabled) {
            // Brighten up the extracted color a bit to ensure UI visibility
            const factor = 1.2;
            const nr = Math.min(255, Math.floor(r * factor));
            const ng = Math.min(255, Math.floor(g * factor));
            const nb = Math.min(255, Math.floor(b * factor));
            setAccentColor(rgbToHex(nr, ng, nb));
          }
        }

        const frameData = captureFrame(0.3);
        if (frameData) {
          frameBuffer.current.push({ timestamp: videoRef.current.currentTime, data: frameData });
          if (frameBuffer.current.length > 20) frameBuffer.current.shift();
        }
      }, aiFrequency);
      return () => clearInterval(interval);
    }
  }, [playerState, isAmbilightEnabled, isSmartThemeEnabled, aiFrequency]);

  // Smart Speed Analysis Loop
  useEffect(() => {
    let timer: number;
    const runAnalysis = async () => {
      if (smartSpeedActive && playerState === PlayerState.PLAYING && videoRef.current) {
        const frame = captureFrame(0.3);
        if (frame) {
          const result = await analyzeContentComplexity(frame, currentVideo?.name || "Untitled");
          let newRate = 1.0;
          if (result.score < 0.3) newRate = 1.5; 
          else if (result.score > 0.7) newRate = 0.8; 
          setPlaybackRate(newRate);
          setSmartSpeedReason(result.reason);
          if (videoRef.current) videoRef.current.playbackRate = newRate;
        }
      }
      timer = window.setTimeout(runAnalysis, 12000);
    };
    if (smartSpeedActive) runAnalysis();
    return () => clearTimeout(timer);
  }, [smartSpeedActive, playerState, currentVideo]);

  // --- Handlers ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newVideos: VideoFile[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      size: file.size
    }));
    setPlaylist(prev => [...prev, ...newVideos]);
    if (currentVideoIndex === null && newVideos.length > 0) setCurrentVideoIndex(0);
  };

  const captureFrame = (quality = 0.5): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  };

  const handleTriggerChapters = async () => {
    if (frameBuffer.current.length < 2) {
      alert("Neural sync incomplete. Allow more temporal data acquisition.");
      return;
    }
    setIsAnalyzing(true);
    const result = await generateChapters(frameBuffer.current);
    setChapters(result);
    setIsAnalyzing(false);
    setActiveTab('chapters');
  };

  const runQuantumAnalysis = async () => {
    if (!videoRef.current || isAnalyzing) return;
    setIsAnalyzing(true);
    const frame = captureFrame();
    if (frame) {
      const data = await analyzeSpatialScene(frame);
      if (data) {
        const newAnalysis: AIAnalysis = {
          timestamp: videoRef.current.currentTime,
          description: data.summary,
          type: 'scene',
          thumbnail: frame,
          labels: data.labels.map((l: any, i: number) => ({
            id: `label-${Date.now()}-${i}`,
            label: l.label,
            x: l.xmin,
            y: l.ymin,
            width: l.xmax - l.xmin,
            height: l.ymax - l.ymin
          }))
        };
        setAiAnalysis(prev => [newAnalysis, ...prev]);
        setActiveLabels(newAnalysis.labels || []);
        setTimeout(() => setActiveLabels([]), 5000);
      }
    }
    setIsAnalyzing(false);
  };

  const performSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const historyData = aiAnalysis.map(a => ({ timestamp: a.timestamp, description: a.description }));
    const targetTimestamp = await semanticSearch(searchQuery, historyData);
    if (targetTimestamp !== -1 && videoRef.current) {
      videoRef.current.currentTime = targetTimestamp;
      setIsSearchOpen(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !videoRef.current) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    const frame = captureFrame(0.4);
    if (frame) {
      const response = await chatWithScene(frame, msg);
      setChatMessages(prev => [...prev, { role: 'ai', text: response || "Analysis complete.", speaker: "Y SERIES AI" }]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const purgeSystemData = () => {
    if (confirm("Initiate total data purge? This cannot be undone.")) {
      setAiAnalysis([]);
      setChapters([]);
      setChatMessages([]);
      frameBuffer.current = [];
      setIsSettingsOpen(false);
      clearDrawings();
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden transition-all duration-1000" style={{ background: `radial-gradient(circle at center, ${ambilightColor} 0%, #050505 100%)` }}>
      
      {/* Sidebar */}
      <nav className="w-20 glass-panel flex flex-col items-center py-8 z-50">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1 shadow-lg cursor-pointer hover:scale-110 transition-transform" style={{ background: `linear-gradient(to top right, ${accentColor}, #818cf8)` }}>
          <User size={24} fill="white" />
        </div>
        <div className="mb-8">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">YS</span>
        </div>
        <div className="flex flex-col space-y-8">
          {[
            { id: 'vault', icon: VideoIcon, label: 'Vault' },
            { id: 'chapters', icon: List, label: 'Chapters' },
            { id: 'chat', icon: MessageSquare, label: 'Y SERIES Assistant' }
          ].map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className="p-4 rounded-2xl transition-all duration-300 group relative hover:bg-white/5" style={{ color: activeTab === item.id ? accentColor : '#525252' }}>
              <item.icon size={22} />
              <div className="absolute left-full ml-4 px-3 py-1.5 glass-panel rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[100]">{item.label}</div>
            </button>
          ))}
        </div>
        <div className="mt-auto space-y-6">
          <button onClick={() => setIsSearchOpen(true)} className="p-4 text-zinc-600 hover:text-white transition-all"><Search size={22} /></button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-4 text-zinc-600 hover:text-white transition-all"><Settings size={22} /></button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="flex-grow flex flex-col relative z-10">
        <header className="h-16 glass-panel border-b border-white/5 flex items-center justify-between px-10">
          <div className="flex items-center space-x-8">
             <div className="flex items-center space-x-3">
                {[1,2,3].map(i => <div key={i} className="w-1 h-3 rounded-full animate-bounce" style={{ backgroundColor: accentColor, animationDelay: `${i*0.2}s`, opacity: 0.5 }}></div>)}
                <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{ color: accentColor }}>Y SERIES QUANTUM</span>
             </div>
             <div className="h-4 w-[1px] bg-white/10"></div>
             <h2 className="text-xs font-bold truncate max-w-[200px] tracking-tight text-white/60 italic">{currentVideo?.name || "Ready for Input..."}</h2>
          </div>
          <div className="flex items-center space-x-4">
             <div className="flex glass-panel p-1 rounded-xl">
               {['Default', 'Cinematic', 'Study', 'Neon'].map(mode => (
                 <button key={mode} onClick={() => setStyleMode(mode as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${styleMode === mode ? 'text-white' : 'text-zinc-500 hover:text-white'}`} style={{ backgroundColor: styleMode === mode ? accentColor : '' }}>{mode}</button>
               ))}
             </div>
             <div className="h-4 w-[1px] bg-white/10"></div>
             <div className="flex glass-panel p-1 rounded-xl">
               {['Standard', 'Analysis', 'Cinema'].map(mode => (
                 <button key={mode} onClick={() => setViewMode(mode as any)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === mode ? 'text-white' : 'text-zinc-500 hover:text-white'}`} style={{ backgroundColor: viewMode === mode ? accentColor : '' }}>{mode}</button>
               ))}
             </div>
          </div>
        </header>

        <div className="flex-grow relative flex items-center justify-center p-10 overflow-hidden">
          {currentVideo ? (
            <div className={`relative w-full h-full rounded-[40px] overflow-hidden shadow-2xl transition-all duration-700 ${viewMode === 'Analysis' ? 'border-2' : 'border border-white/5'}`} style={{ borderColor: viewMode === 'Analysis' ? `${accentColor}40` : '' }}>
              <video
                ref={videoRef} src={currentVideo.url}
                className={`w-full h-full object-contain ${isMirrored ? 'scale-x-[-1]' : ''}`}
                style={{ filter: styleFilters[styleMode] }}
                onTimeUpdate={() => setProgress((videoRef.current?.currentTime || 0) / (videoRef.current?.duration || 1) * 100)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                onPlay={() => setPlayerState(PlayerState.PLAYING)}
                onPause={() => setPlayerState(PlayerState.PAUSED)}
                autoPlay
              />

              {/* Annotation Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                className={`absolute inset-0 z-20 w-full h-full cursor-crosshair ${isDrawing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                width={1920} height={1080}
              />

              {/* AI Overlay */}
              <div className="absolute inset-0 pointer-events-none z-30">
                 {activeLabels.map(label => (
                   <div key={label.id} className="absolute border-2 rounded-2xl animate-fade-in shadow-[0_0_20px_rgba(255,255,255,0.1)]" style={{ top: `${label.y / 10}%`, left: `${label.x / 10}%`, width: `${label.width / 10}%`, height: `${label.height / 10}%`, borderColor: `${accentColor}60`, background: `radial-gradient(circle, ${accentColor}10, transparent)` }}>
                     <div className="absolute -top-10 left-0 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-xl" style={{ backgroundColor: accentColor }}>{label.label}</div>
                   </div>
                 ))}
              </div>

              {smartSpeedActive && (
                <div className="absolute top-10 left-10 z-40 animate-fade-in">
                   <div className="flex items-center space-x-4 glass-panel px-6 py-3 rounded-full border" style={{ borderColor: `${accentColor}20` }}>
                      <Cpu size={16} className="animate-pulse" style={{ color: accentColor }} />
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: accentColor }}>{playbackRate.toFixed(1)}x {smartSpeedReason}</span>
                   </div>
                </div>
              )}

              <div className="absolute top-10 right-10 flex flex-col space-y-4 z-40">
                 <button onClick={() => setIsDrawing(!isDrawing)} className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center transition-all" style={{ backgroundColor: isDrawing ? accentColor : '', color: isDrawing ? 'white' : '#737373' }}><Pencil size={20} /></button>
                 {isDrawing && <button onClick={clearDrawings} className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center text-red-500"><Eraser size={20} /></button>}
                 <button onClick={runQuantumAnalysis} disabled={isAnalyzing} className={`w-14 h-14 rounded-2xl glass-panel flex items-center justify-center ${isAnalyzing ? 'animate-spin' : ''}`} style={{ color: isAnalyzing ? accentColor : '#737373' }}><Sparkles size={20} /></button>
                 <button onClick={handleTriggerChapters} className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center text-zinc-500 hover:text-white"><List size={20} /></button>
              </div>
            </div>
          ) : (
            <div className="text-center group">
               <div className="w-40 h-40 rounded-[60px] glass-panel flex items-center justify-center mx-auto mb-10 group-hover:scale-110 transition-all duration-700">
                  <Upload size={60} style={{ color: accentColor }} />
               </div>
               <h1 className="text-5xl font-black tracking-tighter mb-4">Y SERIES MEDIA CORE</h1>
               <p className="text-zinc-500 mb-8 max-w-md mx-auto">Upload your cinematic sequences for high-fidelity AI analysis and playback.</p>
               <button onClick={() => fileInputRef.current?.click()} className="px-12 py-5 text-white text-sm font-black rounded-3xl transition-all shadow-2xl" style={{ backgroundColor: accentColor }}>INITIALIZE INGRESS</button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={`glass-panel border-t border-white/5 px-12 py-8 relative transition-all duration-700 ${viewMode === 'Cinema' ? 'opacity-0 h-0 p-0 overflow-hidden' : 'h-44'}`}>
          <div className="relative h-2 w-full bg-white/5 rounded-full mb-10 group cursor-pointer">
            <div className="absolute inset-0 h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: accentColor }} />
            <input type="range" min="0" max="100" step="0.001" value={progress} onChange={(e) => {
              const time = (parseFloat(e.target.value) / 100) * (videoRef.current?.duration || 0);
              if (videoRef.current) videoRef.current.currentTime = time;
            }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" />
          </div>
          <div className="flex items-center justify-between">
             <div className="flex items-center space-x-12">
                <button onClick={() => playerState === PlayerState.PLAYING ? safePause() : safePlay()} className="w-14 h-14 glass-panel border-white/10 text-white rounded-2xl flex items-center justify-center hover:scale-105 transition-all">
                   {playerState === PlayerState.PLAYING ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                </button>
                <div className="font-mono text-sm">
                   <span style={{ color: accentColor }}>{formatTime(videoRef.current?.currentTime || 0)}</span>
                   <span className="opacity-20 px-2">/</span>
                   <span className="opacity-50">{formatTime(duration)}</span>
                </div>
                <div className="flex items-center space-x-4">
                   <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-600 hover:text-white transition-colors">
                      {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                   </button>
                   <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-24" style={{ accentColor }} />
                </div>
             </div>
             <div className="flex items-center space-x-6">
                <div className="relative">
                   <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="flex items-center space-x-2 px-5 py-2.5 glass-panel rounded-2xl text-[10px] font-black uppercase tracking-widest" style={{ color: showSpeedMenu ? accentColor : '#525252' }}>
                      <Gauge size={16} /> <span>{playbackRate.toFixed(1)}X</span>
                   </button>
                   {showSpeedMenu && (
                     <div className="absolute bottom-16 right-0 w-44 glass-panel rounded-3xl p-3 flex flex-col space-y-1 animate-fade-in z-[100]">
                        <button onClick={() => setSmartSpeedActive(!smartSpeedActive)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest mb-1 ${smartSpeedActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-zinc-500'}`}>SMART: {smartSpeedActive ? 'ON' : 'OFF'}</button>
                        {[0.5, 1, 1.25, 2].map(r => (
                          <button key={r} onClick={() => { setPlaybackRate(r); if(videoRef.current) videoRef.current.playbackRate = r; setShowSpeedMenu(false); }} className={`px-4 py-2 rounded-xl text-left text-xs font-black transition-all ${playbackRate === r && !smartSpeedActive ? 'text-white' : 'text-zinc-500 hover:bg-white/5'}`} style={{ backgroundColor: playbackRate === r && !smartSpeedActive ? accentColor : '' }}>{r}x</button>
                        ))}
                     </div>
                   )}
                </div>
                <button onClick={() => setIsMirrored(!isMirrored)} className="p-4 glass-panel rounded-2xl" style={{ color: isMirrored ? accentColor : '#525252' }}><FlipHorizontal size={20} /></button>
                <button onClick={() => videoRef.current?.requestPictureInPicture()} className="p-4 glass-panel rounded-2xl text-zinc-600"><MonitorPlay size={20} /></button>
                <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : videoRef.current?.parentElement?.requestFullscreen()} className="p-4 glass-panel rounded-2xl text-zinc-600"><Maximize size={20} /></button>
             </div>
          </div>
        </div>
      </main>

      {/* Sidebar Content */}
      <aside className={`transition-all duration-700 glass-panel border-l border-white/5 flex flex-col z-50 overflow-hidden ${viewMode === 'Cinema' ? 'w-0 opacity-0' : 'w-[400px] p-8'}`}>
        {activeTab === 'vault' && (
          <div className="flex flex-col h-full animate-fade-in">
             <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black italic uppercase">Media Vault</h3>
                <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 glass-panel rounded-xl text-zinc-500 hover:text-white flex items-center justify-center"><Plus size={20} /></button>
             </div>
             <div className="flex-grow space-y-4 overflow-y-auto pr-2">
                {playlist.map((video, idx) => (
                  <div key={video.id} onClick={() => setCurrentVideoIndex(idx)} className="p-5 rounded-3xl border bg-white/5 transition-all cursor-pointer group" style={{ borderColor: currentVideoIndex === idx ? `${accentColor}40` : 'transparent' }}>
                     <div className="flex items-center space-x-6">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: currentVideoIndex === idx ? accentColor : '#000' }}><VideoIcon size={24} /></div>
                        <div className="flex-grow overflow-hidden">
                           <p className={`text-sm font-black truncate ${currentVideoIndex === idx ? 'text-white' : 'text-zinc-500'}`}>{video.name}</p>
                           <p className="text-[9px] font-bold text-zinc-700 mt-1 uppercase">{(video.size/1024/1024).toFixed(1)} MB</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setPlaylist(prev => prev.filter(v => v.id !== video.id)); }} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-800 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}
        {activeTab === 'chapters' && (
          <div className="flex flex-col h-full animate-fade-in">
             <h3 className="text-2xl font-black italic uppercase mb-10">Chapters</h3>
             <div className="space-y-3 overflow-y-auto pr-2">
                {chapters.map((ch, i) => (
                  <button key={i} onClick={() => videoRef.current && (videoRef.current.currentTime = ch.timestamp)} className="w-full p-5 rounded-3xl glass-card text-left flex items-center justify-between group">
                     <div>
                        <p className="text-[9px] font-black mb-1" style={{ color: accentColor }}>{formatTime(ch.timestamp)}</p>
                        <p className="text-xs font-black text-zinc-300">{ch.title}</p>
                     </div>
                     <ChevronRight size={16} className="text-zinc-700 group-hover:text-white" />
                  </button>
                ))}
             </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full animate-fade-in relative">
             <div className="flex items-center space-x-4 mb-10">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}><Brain size={24} style={{ color: accentColor }} /></div>
                <h3 className="text-sm font-black uppercase tracking-widest">Y SERIES Assistant</h3>
             </div>
             <div className="flex-grow space-y-6 overflow-y-auto pr-2 pb-24">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`max-w-[85%] p-5 rounded-3xl text-xs font-black tracking-tight ${msg.role === 'user' ? 'bg-white text-black' : 'glass-card text-zinc-300'}`}>
                        {msg.speaker && <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: accentColor }}>{msg.speaker}</div>}
                        {msg.text}
                     </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
             </div>
             <form onSubmit={handleChat} className="absolute bottom-0 left-0 right-0 bg-black/50 p-4 rounded-3xl backdrop-blur-md">
                <div className="relative">
                   <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Query the Y SERIES core..." className="w-full glass-panel rounded-2xl px-6 py-4 text-xs font-black focus:outline-none pr-14" style={{ borderColor: chatInput ? `${accentColor}40` : '' }} />
                   <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 text-white rounded-xl flex items-center justify-center" style={{ backgroundColor: accentColor }}><Send size={18} /></button>
                </div>
             </form>
          </div>
        )}
      </aside>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6 animate-fade-in">
           <div className="w-full max-w-xl glass-panel rounded-[40px] p-10 border border-white/10 animate-in zoom-in-95 duration-500 shadow-4xl">
              <div className="flex items-center justify-between mb-12">
                 <div className="flex items-center space-x-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: accentColor }}><Settings size={28} /></div>
                    <h2 className="text-2xl font-black italic uppercase">Y SERIES System Core</h2>
                 </div>
                 <button onClick={() => setIsSettingsOpen(false)} className="w-12 h-12 glass-panel rounded-2xl flex items-center justify-center text-zinc-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="space-y-8">
                 <div className="space-y-4">
                    <div className="flex justify-between uppercase text-[10px] font-black text-zinc-400 tracking-widest"><span>Neural Frequency</span><span style={{ color: accentColor }}>{aiFrequency/1000}s</span></div>
                    <input type="range" min="1000" max="10000" step="500" value={aiFrequency} onChange={(e) => setAiFrequency(parseInt(e.target.value))} className="w-full" style={{ accentColor }} />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-5 glass-panel rounded-3xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Ambilight</span>
                            <span className="text-xs font-black">Reactive Glow</span>
                        </div>
                        <button onClick={() => setIsAmbilightEnabled(!isAmbilightEnabled)} className={`w-12 h-6 rounded-full relative transition-all duration-500 ${isAmbilightEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                           <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all duration-500 ${isAmbilightEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-5 glass-panel rounded-3xl border border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Smart Theme</span>
                            <span className="text-xs font-black">AI Color Sync</span>
                        </div>
                        <button onClick={() => setIsSmartThemeEnabled(!isSmartThemeEnabled)} className={`w-12 h-6 rounded-full relative transition-all duration-500 ${isSmartThemeEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}>
                           <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all duration-500 ${isSmartThemeEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                 </div>

                 {!isSmartThemeEnabled && (
                    <div className="space-y-4 animate-fade-in">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Manual Accent</label>
                        <div className="flex space-x-4">
                        {['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'].map(hex => (
                            <button key={hex} onClick={() => setAccentColor(hex)} className={`w-10 h-10 rounded-full transition-all hover:scale-110 ${accentColor === hex ? 'ring-4 ring-white ring-offset-4 ring-offset-black' : ''}`} style={{ backgroundColor: hex }} />
                        ))}
                        </div>
                    </div>
                 )}

                 {isSmartThemeEnabled && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center space-x-4 animate-fade-in">
                        <Sparkle size={16} className="text-emerald-400 animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Y SERIES Engine active</p>
                    </div>
                 )}

                 <button onClick={purgeSystemData} className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-center space-x-3 hover:bg-red-500 hover:text-white transition-all"><ShieldAlert size={16} /><span>Total Core Purge</span></button>
              </div>
           </div>
        </div>
      )}

      {/* Semantic Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-10 animate-fade-in">
           <div className="w-full max-w-4xl">
              <form onSubmit={performSemanticSearch}>
                 <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Retrieve Y SERIES memories..." className="w-full bg-transparent border-b-2 px-10 py-10 text-4xl font-black tracking-tighter focus:outline-none transition-all" style={{ borderColor: accentColor }} />
                 <div className="mt-10 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.4em] text-zinc-700">
                    <button type="button" onClick={() => setIsSearchOpen(false)} className="hover:text-white">Abort Retrieval</button>
                    <span style={{ color: accentColor }}>Memory Retrieval Active</span>
                 </div>
              </form>
           </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="video/*" multiple />
    </div>
  );
}
