import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Download, Play, Pause, RotateCcw, RotateCw, 
  Settings, PictureInPicture2, Lock, Unlock, AlertCircle,
  RefreshCcw, ScreenShare, Maximize, Minimize
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
  const [isFitCover, setIsFitCover] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('READY');
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);

  const toggleFullscreen = () => {
    if (isLocked) return;
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    resetControlsTimeout();
  };

  const toggleOrientation = async () => {
    if (isLocked) return;
    
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      }
      
      const orientation = (window.screen as any).orientation;
      if (orientation?.lock) {
        if (!isLandscape) {
          await orientation.lock('landscape');
          setIsLandscape(true);
        } else {
          await orientation.lock('portrait');
          setIsLandscape(false);
        }
      } else {
        // Fallback: Just toggle a state that we could use for CSS rotation if needed
        setIsLandscape(!isLandscape);
      }
    } catch (err) {
      console.error("Orientation lock failed:", err);
      // Fallback for browsers that don't support locking or if it fails
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
      player.on('timeupdate', () => setCurrentTime(player.currentTime));
      player.on('ready', () => setDuration(player.duration));
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
        if (playerRef.current) playerRef.current.destroy();
        if (hlsRef.current) hlsRef.current.destroy();
      };
    }
  }, [selectedUrl]);

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
    if (isLocked || !playerRef.current || error) return;
    const time = parseFloat(e.target.value);
    playerRef.current.currentTime = time;
    setCurrentTime(time);
    resetControlsTimeout();
  };

  const togglePip = () => {
    if (isLocked || !playerRef.current || error) return;
    playerRef.current.pip = !playerRef.current.pip;
    resetControlsTimeout();
  };

  const formatTime = (time: number) => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isLocked && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleDownload = async () => {
    const videoUrl = videoRef.current?.currentSrc || selectedUrl;
    setDownloadStatus("REQUESTING FILE...");
    
    try {
      const response = await fetch(videoUrl);
      if (!response.body) throw new Error('No body');
      
      const reader = response.body.getReader();
      const contentLength = +(response.headers.get('Content-Length') || 0);
      let receivedLength = 0;
      let chunks = []; 
      
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        
        if (contentLength) {
          const pct = Math.round((receivedLength / contentLength) * 100);
          setDownloadProgress(pct);
          setDownloadStatus("DOWNLOADING...");
        }
      }
      
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = selectedUrl.split('.').pop()?.split(/[?#]/)[0] || 'mp4';
      a.download = `${movie.title.replace(/\s+/g, '_')}_BharatPrime.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setDownloadStatus("SAVED TO DEVICE");
      setTimeout(() => setDownloadStatus('READY'), 3000);
      setDownloadProgress(0);
    } catch(e) { 
      setDownloadStatus("DOWNLOAD ERROR (CORS)");
      console.error(e);
      setTimeout(() => setDownloadStatus('READY'), 3000);
    }
  };

  return (
    <motion.div 
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden select-none"
    >
      {/* Video Element */}
      <div className="relative w-full h-full flex items-center justify-center">
        <video 
          ref={videoRef} 
          playsInline 
          preload="auto"
          className={`w-full h-full transition-all duration-300 ${isFitCover ? 'object-cover' : 'object-contain'} ${error ? 'opacity-20' : 'opacity-100'}`}
          onClick={togglePlay}
        />

        {/* Buffering Indicator */}
        <AnimatePresence>
          {isBuffering && !error && (
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
          {(showControls || isLocked) && !error && (
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
                    <button onClick={toggleOrientation} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white" title="Rotate">
                      <ScreenShare size={24} className={isLandscape ? 'rotate-90' : ''} />
                    </button>
                  )}
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
                  <button onClick={togglePip} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white hidden md:block">
                    <PictureInPicture2 size={32} />
                  </button>
                  
                  <div className="flex items-center gap-8 md:gap-12">
                    <button onClick={() => skip(-5)} className="relative p-2 hover:bg-white/10 rounded-full transition-colors text-white group">
                      <RotateCcw size={40} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black mt-1">5</span>
                    </button>

                    <button onClick={togglePlay} className="p-6 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white scale-125 hover:scale-150">
                      {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-1" />}
                    </button>

                    <button onClick={() => skip(10)} className="relative p-2 hover:bg-white/10 rounded-full transition-colors text-white group">
                      <RotateCw size={40} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black mt-1">10</span>
                    </button>
                  </div>

                  <button className="p-3 hover:bg-white/10 rounded-full transition-colors text-white hidden md:block">
                    <Settings size={32} />
                  </button>
                </div>
              )}

              {/* Bottom Bar */}
              {!isLocked && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-white font-mono text-sm min-w-[50px]">{formatTime(currentTime)}</span>
                    <div className="relative flex-1 h-6 flex items-center group">
                      <input 
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-red-600 outline-none"
                      />
                      <div 
                        className="h-1 bg-red-600 rounded-full pointer-events-none"
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-white font-mono text-sm min-w-[50px]">{formatTime(duration)}</span>
                    <button 
                      onClick={() => setIsFitCover(!isFitCover)}
                      className="px-4 py-1 bg-white/10 hover:bg-white/20 rounded text-white text-sm font-black uppercase tracking-widest transition-colors"
                    >
                      {isFitCover ? 'Fit' : 'Fill'}
                    </button>
                    <button 
                      onClick={toggleFullscreen}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
                      title="Fullscreen"
                    >
                      {document.fullscreenElement ? <Minimize size={20} /> : <Maximize size={20} />}
                    </button>
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
