import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Download } from 'lucide-react';
import { Movie } from '../types';

interface QualitySelectorProps {
  movie: Movie | null;
  onClose: () => void;
  onSelect: (movie: Movie, url: string) => void;
}

export default function QualitySelector({ movie, onClose, onSelect }: QualitySelectorProps) {
  if (!movie) return null;

  const qualities = movie.links && movie.links.length > 0 
    ? movie.links 
    : [
        { label: '1.4 GB', url: movie.videoUrl },
        { label: '700 MB', url: movie.videoUrl },
        { label: '400 MB', url: movie.videoUrl }
      ];

  const handleDownload = (url: string, label: string) => {
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    const a = document.createElement('a');
    a.href = finalUrl;
    const extension = finalUrl.split('.').pop()?.split(/[?#]/)[0] || 'mp4';
    a.download = `${movie.title.replace(/\s+/g, '_')}_${label}.${extension}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="w-full max-w-md bg-[#1a1a1a] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-[4/3] sm:aspect-video w-full">
            <img src={movie.image || movie.thumbnail || undefined} alt={movie.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight uppercase italic tracking-tight drop-shadow-2xl">
                {movie.title} {movie.year ? `(${movie.year})` : ''} {movie.language ? movie.language.toUpperCase() : ''} {movie.quality || ''}
              </h2>
            </div>
          </div>
          <div className="p-4 sm:p-6 space-y-3">
            <div className="space-y-2.5">
              {qualities.map((q) => (
                <div key={q.label} className="flex gap-2">
                  <button
                    onClick={() => onSelect(movie, q.url)}
                    className="flex-1 flex items-center gap-4 bg-[#222] hover:bg-[#2a2a2a] transition-all p-3.5 sm:p-4 rounded-xl sm:rounded-2xl group border border-white/5 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-600 rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(229,9,20,0.3)] group-hover:scale-105 transition-transform">
                      <Play className="fill-white text-white ml-0.5" size={16} />
                    </div>
                    <div className="text-left">
                      <span className="block text-sm sm:text-base font-black text-white uppercase italic tracking-tighter">{q.label}</span>
                      <span className="text-[8px] sm:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Stream Now</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload(q.url, q.label)}
                    className="px-4 sm:px-5 bg-[#222] hover:bg-[#2a2a2a] text-zinc-400 hover:text-white rounded-xl sm:rounded-2xl transition-all flex items-center justify-center border border-white/5 active:scale-[0.98]"
                    title="Download"
                  >
                    <Download size={18} className="sm:w-[20px] sm:h-[20px]" />
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={onClose} 
              className="w-full bg-[#222] hover:bg-[#2a2a2a] text-white font-black py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all text-xs sm:text-sm uppercase tracking-[0.3em] border border-white/5 mt-2 active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
