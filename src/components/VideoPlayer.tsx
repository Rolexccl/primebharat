import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, Play, Pause, RotateCcw, RotateCw, 
  Settings, PictureInPicture2, Lock, Unlock, AlertCircle,
  RefreshCcw, ScreenShare, Maximize, Minimize, Volume2, VolumeX, Volume1,
  MoreVertical, ChevronLeft, Menu
} from 'lucide-react';
import { Movie } from '../types';

interface VideoPlayerProps {
  movie: Movie;
  selectedUrl: string;
  onClose: () => void;
}

export default function VideoPlayer({ movie, selectedUrl, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isFitCover, setIsFitCover] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPip, setIsPip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('READY');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'speed' | 'chapters'>('main');
  const [hoveredChapter, setHoveredChapter] = useState<{ title: string; x: number } | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleFullscreen = async () => {
    if (isLocked) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
        // Attempt orientation lock after entering fullscreen
        const orientation = (window.screen as any).orientation;
        if (orientation?.lock) {
          await orientation.lock('landscape').catch((err: any) => console.log('Orientation lock failed:', err));
        }
      } else {
        document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen/Orientation error:", err);
    }
    resetControlsTimeout();
  };

  const toggleOrientation = async () => {
    if (isLocked) return;
    
    try {
      const orientation = (window.screen as any).orientation;
      if (orientation?.lock) {
        if (!isLandscape) {
          await orientation.lock('landscape').catch((err: any) => console.log('Orientation lock failed:', err));
          setIsLandscape(true);
        } else {
          await orientation.lock('portrait').catch((err: any) => console.log('Orientation lock failed:', err));
          setIsLandscape(false);
        }
      } else {
        // Fallback: Just toggle state for CSS rotation
        setIsLandscape(!isLandscape);
      }
    } catch (err) {
      console.log("Orientation API not supported or blocked:", err);
      setIsLandscape(!isLandscape);
    }
    resetControlsTimeout();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsLandscape(false);
        const orientation = (window.screen as any).orientation;
        if (orientation?.unlock) {
          orientation.unlock();
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      // Set landscape state to true to trigger CSS rotation fallback
      // since ScreenOrientation.lock is blocked in sandboxed iframes
      setIsLandscape(true);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      
      // Initialize Plyr with no default controls
      const player = new Plyr(video, {
        controls: [],
        clickToPlay: false,
        keyboard: { focused: true, global: true },
      });
      playerRef.current = player;

      // Handle HLS or Direct Video
      if (selectedUrl.includes('.m3u8')) {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(selectedUrl);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = selectedUrl;
        }
      } else {
        video.src = selectedUrl;
      }

      player.on('playing', () => {
        setIsPlaying(true);
        setError(null);
      });
      player.on('pause', () => setIsPlaying(false));
      
      const onLoadedMetadata = () => setDuration(video.duration);
      const onDurationChange = () => setDuration(video.duration);
      const onTimeUpdate = () => setCurrentTime(video.currentTime);
      const onEnterPip = () => setIsPip(true);
      const onLeavePip = () => setIsPip(false);

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('durationchange', onDurationChange);
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('enterpictureinpicture', onEnterPip);
      video.addEventListener('leavepictureinpicture', onLeavePip);

      player.on('waiting', () => setIsBuffering(true));
      player.on('playing', () => setIsBuffering(false));
      
      video.onerror = () => {
        const errorMsg = video.error?.code === 4 
          ? "Format not supported or Link expired. MKV files require specific browser support." 
          : "Failed to load video. Check your connection or the link.";
        setError(errorMsg);
        setIsBuffering(false);
      };

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('durationchange', onDurationChange);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('enterpictureinpicture', onEnterPip);
        video.removeEventListener('leavepictureinpicture', onLeavePip);
        if (playerRef.current) playerRef.current.destroy();
        if (hlsRef.current) hlsRef.current.destroy();
      };
    }
  }, [selectedUrl]);

  const lastClickTimeRef = useRef<number>(0);

  const handleVideoClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;
    
    if (now - lastClickTimeRef.current < DOUBLE_CLICK_DELAY) {
      // Double tap detected
      setIsFitCover(!isFitCover);
      resetControlsTimeout();
    } else {
      // Single tap
      togglePlay();
    }
    lastClickTimeRef.current = now;
  };

  const togglePlay = () => {
    if (isLocked || error) return;
    if (playerRef.current?.paused) {
      playerRef.current.play();
    } else {
      playerRef.current?.pause();
    }
    resetControlsTimeout();
  };

  const skip = (amount: number) => {
    if (isLocked || !playerRef.current || error) return;
    playerRef.current.forward(amount);
    resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || !videoRef.current || error) return;
    const time = parseFloat(e.target.value);
    
    // Update both video element and state
    videoRef.current.currentTime = time;
    setCurrentTime(time);
    
    // Also update Plyr if it's out of sync
    if (playerRef.current) {
      playerRef.current.currentTime = time;
    }
    
    resetControlsTimeout();
  };

  const togglePip = () => {
    if (isLocked || !playerRef.current || error) return;
    playerRef.current.pip = !playerRef.current.pip;
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (isLocked || !playerRef.current) return;
    const newMuted = !isMuted;
    playerRef.current.muted = newMuted;
    setIsMuted(newMuted);
    resetControlsTimeout();
  };

  const handleSpeedChange = (speed: number) => {
    if (playerRef.current) {
      playerRef.current.speed = speed;
      setPlaybackSpeed(speed);
    }
    setShowSettings(false);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || !playerRef.current) return;
    const newVolume = parseFloat(e.target.value);
    playerRef.current.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      playerRef.current.muted = false;
      setIsMuted(false);
    } else if (newVolume === 0 && !isMuted) {
      playerRef.current.muted = true;
      setIsMuted(true);
    }
    resetControlsTimeout();
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '00:00';
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleDownload = async () => {
    const videoUrl = videoRef.current?.currentSrc || selectedUrl;
    
    // Extract filename from URL or use movie title
    const urlPath = new URL(videoUrl).pathname;
    const fileName = urlPath.split('/').pop() || `${movie.title.replace(/\s+/g, '_')}.mp4`;
    
    setDownloadStatus("VERIFYING...");
    
    try {
      // 1. Check if the file is actually available on the source server
      const verifyResponse = await fetch(`/api/verify-url?url=${encodeURIComponent(videoUrl)}`);
      const verifyResult = await verifyResponse.json();
      
      if (!verifyResult.ok) {
        throw new Error("File not available on source server");
      }

      setDownloadStatus("STARTING...");
      
      // 2. Use our backend proxy to bypass CORS and force download
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(fileName)}`;
      
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = fileName; // Fallback
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setDownloadStatus("DOWNLOAD STARTED");
      setTimeout(() => {
        setDownloadStatus('READY');
        setDownloadProgress(0);
      }, 3000);

    } catch (error: any) {
      console.error('Download failed:', error);
      const errorMessage = error.message === "File not available on source server" 
        ? "FILE NOT FOUND" 
        : "DOWNLOAD FAILED";
        
      setDownloadStatus(errorMessage);
      
      // Fallback: Direct link (only if it wasn't a 404)
      if (error.message !== "File not available on source server") {
        window.open(videoUrl, '_blank');
      }

      setTimeout(() => {
        setDownloadStatus('READY');
        setDownloadProgress(0);
      }, 5000);
    }
  };

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={handleMouseMove}
      onClick={handleMouseMove}
      className={`fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden select-none ${!showControls ? 'cursor-none' : 'cursor-default'} ${isLandscape && isPortrait ? 'rotate-container' : ''}`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .rotate-container {
          width: 100vh !important;
          height: 100vw !important;
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) rotate(90deg) !important;
          z-index: 9999 !important;
        }
      `}} />
      {/* Video Element */}
      <div className="relative w-full h-full flex items-center justify-center">
        <video 
          ref={videoRef} 
          playsInline 
          preload="auto"
          className={`w-full h-full transition-all duration-300 ${isFitCover ? 'object-cover' : 'object-contain'} ${error ? 'opacity-20' : 'opacity-100'}`}
          onClick={handleVideoClick}
        />

        {/* Buffering Indicator */}
        <AnimatePresence>
          {isBuffering && !error && !isPip && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-10"
            >
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Picture in Picture Overlay */}
        <AnimatePresence>
          {isPip && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md z-40"
            >
              <div className="relative">
                <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center border border-red-600/20 animate-pulse">
                  <PictureInPicture2 className="text-red-600" size={40} />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-zinc-950" />
              </div>
              <h3 className="text-xl font-black text-white mt-6 uppercase italic tracking-tighter">Playing in Picture-in-Picture</h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Video is active in a floating window</p>
              
              <div className="flex gap-3 mt-8">
                <button
                  onClick={togglePip}
                  className="px-6 py-3 bg-white text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl"
                >
                  Back to Player
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-white/5 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
                >
                  Close Player
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error UI */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex items-center justify-center z-30 p-6"
            >
              <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] max-w-md text-center shadow-2xl">
                <div className="w-20 h-20 bg-red-600/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-600/20">
                  <AlertCircle className="text-red-600" size={40} />
                </div>
                <h3 className="text-2xl font-black text-white mb-3 uppercase italic tracking-tighter">Playback Error</h3>
                <p className="text-zinc-400 text-sm font-medium mb-8 leading-relaxed">
                  {error}
                  <br />
                  <span className="text-[10px] text-zinc-500 uppercase mt-2 block">Tip: Try downloading the file if it won't play.</span>
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all uppercase tracking-widest text-xs"
                  >
                    <RefreshCcw size={16} /> Retry Player
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full bg-white/5 text-white font-black py-4 rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-xs border border-white/10"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Controls Overlay */}
        <AnimatePresence>
          {showControls && !error && !isPip && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col justify-between p-6 bg-gradient-to-b from-black/60 via-transparent to-black/60"
            >
              {/* Top Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {!isLocked && (
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                      <X size={28} />
                    </button>
                  )}
                  <h2 className="text-white font-bold text-lg md:text-xl truncate max-w-[200px] md:max-w-md">
                    {movie.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {!isLocked && (
                    <button onClick={handleDownload} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white" title="Download">
                      <Download size={24} />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsLocked(!isLocked)} 
                    className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isLocked ? 'text-red-600 bg-white/10' : 'text-white'}`}
                    title={isLocked ? "Unlock Controls" : "Lock Controls"}
                  >
                    {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
                  </button>
                </div>
              </div>

              {/* Center Controls */}
              {!isLocked && (
                <div className="flex items-center justify-center gap-8 md:gap-16">
                  <div className="flex items-center gap-8 md:gap-12">
                    <button onClick={() => skip(-10)} className="relative p-2 hover:bg-white/10 rounded-full transition-colors text-white group">
                      <RotateCcw size={40} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black mt-1">10</span>
                    </button>

                    <button onClick={togglePlay} className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white hover:scale-110">
                      {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={() => skip(10)} className="relative p-2 hover:bg-white/10 rounded-full transition-colors text-white group">
                      <RotateCw size={40} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black mt-1">10</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Settings Menu */}
              <AnimatePresence>
                {showSettings && !isLocked && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute bottom-16 right-6 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-2 w-64 z-50 shadow-2xl"
                  >
                    <div className="space-y-1">
                      {settingsView === 'main' && (
                        <>
                          <button
                            onClick={handleDownload}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <Download size={18} />
                            <span>Download</span>
                          </button>

                          <div className="h-px bg-white/5 mx-2" />

                          <button
                            onClick={() => { setIsFitCover(!isFitCover); setShowSettings(false); }}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <Maximize size={18} />
                              <span>Fill Screen</span>
                            </div>
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${isFitCover ? 'bg-red-600' : 'bg-white/10'}`}>
                              <div className={`absolute top-1 w-2 h-2 bg-white rounded-full transition-all ${isFitCover ? 'left-5' : 'left-1'}`} />
                            </div>
                          </button>

                          <div className="h-px bg-white/5 mx-2" />

                          <button
                            onClick={() => setSettingsView('speed')}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <Settings size={18} />
                              <span>Playback Speed</span>
                            </div>
                            <span className="text-red-600 text-xs">{playbackSpeed === 1 ? 'Normal' : `${playbackSpeed}x`}</span>
                          </button>

                          {movie.chapters && movie.chapters.length > 0 && (
                            <button
                              onClick={() => setSettingsView('chapters')}
                              className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <Menu size={18} />
                                <span>Chapters</span>
                              </div>
                              <span className="text-zinc-500 text-xs">{movie.chapters.length}</span>
                            </button>
                          )}

                          <div className="h-px bg-white/5 mx-2" />

                          <button
                            onClick={togglePip}
                            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3"
                          >
                            <PictureInPicture2 size={18} />
                            <span>Picture in picture</span>
                          </button>
                        </>
                      )}

                      {settingsView === 'speed' && (
                        <div className="p-2">
                          <button 
                            onClick={() => setSettingsView('main')}
                            className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-3 ml-1"
                          >
                            <ChevronLeft size={14} /> Back
                          </button>
                          <div className="grid grid-cols-1 gap-1">
                            {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                              <button
                                key={speed}
                                onClick={() => { handleSpeedChange(speed); setSettingsView('main'); }}
                                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-between ${playbackSpeed === speed ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                              >
                                <span>{speed === 1 ? 'Normal' : `${speed}x`}</span>
                                {playbackSpeed === speed && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {settingsView === 'chapters' && (
                        <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                          <button 
                            onClick={() => setSettingsView('main')}
                            className="flex items-center gap-2 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-3 ml-1"
                          >
                            <ChevronLeft size={14} /> Back
                          </button>
                          <div className="space-y-1">
                            {movie.chapters?.map((chapter, idx) => (
                              <button
                                key={idx}
                                onClick={() => { 
                                  if (videoRef.current) videoRef.current.currentTime = chapter.time;
                                  setSettingsView('main');
                                  setShowSettings(false);
                                }}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 transition-colors group"
                              >
                                <div className="text-sm font-bold text-white group-hover:text-red-600 transition-colors">{chapter.title}</div>
                                <div className="text-[10px] font-mono text-zinc-500">{formatTime(chapter.time)}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Bar */}
              {!isLocked && (
                <div className="w-full px-4 pb-2 space-y-2">
                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                      </button>
                      <button onClick={() => skip(-10)} className="text-white/80 hover:text-white transition-colors" title="Back 10s">
                        <RotateCcw size={20} />
                      </button>
                      <button onClick={() => skip(10)} className="text-white/80 hover:text-white transition-colors" title="Forward 10s">
                        <RotateCw size={20} />
                      </button>
                      <div className="text-white font-mono text-sm tracking-tight ml-2">
                        {formatTime(currentTime)} <span className="text-white/40 mx-1">/</span> {duration > 0 ? formatTime(duration) : '00:00'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                      {/* Volume Control */}
                      <div className="flex items-center gap-2 group/volume">
                        <button 
                          onClick={toggleMute}
                          className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                        >
                          {isMuted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
                        </button>
                        <div className="w-0 group-hover/volume:w-24 transition-all duration-300 overflow-hidden flex items-center">
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="w-20 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        onClick={() => setIsFitCover(!isFitCover)}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isFitCover ? 'text-red-600 bg-white/5' : 'text-white'}`}
                        title={isFitCover ? 'Original Size' : 'Fill Screen'}
                      >
                        <Maximize size={20} />
                      </button>

                      <button 
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                        title="Fullscreen"
                      >
                        {document.fullscreenElement ? <Minimize size={20} /> : <Maximize size={20} />}
                      </button>

                      <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors text-white ${showSettings ? 'bg-white/10' : ''}`}
                      >
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar Row */}
                  <div className="relative w-full h-6 flex items-center group">
                    {/* Chapter Markers */}
                    <div className="absolute inset-x-0 h-1.5 flex items-center pointer-events-none z-20">
                      {movie.chapters?.map((chapter, idx) => (
                        <div 
                          key={idx}
                          className="absolute w-0.5 h-full bg-black/40"
                          style={{ left: `${(chapter.time / (duration || 1)) * 100}%` }}
                        />
                      ))}
                    </div>

                    {/* Chapter Hover Title */}
                    <AnimatePresence>
                      {hoveredChapter && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: -25 }}
                          exit={{ opacity: 0 }}
                          className="absolute bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-md whitespace-nowrap z-50 shadow-lg"
                          style={{ left: `${hoveredChapter.x}%`, transform: 'translateX(-50%)' }}
                        >
                          {hoveredChapter.title}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <input 
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      onMouseMove={(e) => {
                        if (!movie.chapters || !duration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * duration;
                        const chapter = [...movie.chapters].reverse().find(c => c.time <= x);
                        if (chapter) {
                          setHoveredChapter({ 
                            title: chapter.title, 
                            x: (chapter.time / duration) * 100 
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredChapter(null)}
                      className="absolute w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-600 outline-none z-10"
                    />
                    <div 
                      className="h-1 bg-red-600 rounded-full pointer-events-none absolute left-0 top-1/2 -translate-y-1/2"
                      style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Download Progress Overlay (if active) */}
      <AnimatePresence>
        {downloadProgress > 0 && downloadProgress < 100 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-0 left-0 right-0 bg-red-600 p-2 text-center text-[10px] font-black uppercase tracking-[0.3em] z-[600]"
          >
            {downloadStatus} {downloadProgress}%
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
