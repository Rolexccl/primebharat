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
          <div className="relative aspect-video w-full">
            <img src={movie.image || movie.thumbnail || undefined} alt={movie.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{movie.title}</h2>
            </div>
          </div>
          <div className="p-6 pt-2 space-y-4">
            <div className="space-y-2">
              {qualities.map((q) => (
                <div key={q.label} className="flex gap-2">
                  <button
                    onClick={() => onSelect(movie, q.url)}
                    className="flex-1 flex items-center gap-4 bg-[#2a2a2a] hover:bg-[#333] transition-all p-4 rounded-2xl group"
                  >
                    <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center group-hover:bg-red-600 transition-colors">
                      <Play className="fill-white text-white ml-1" size={18} />
                    </div>
                    <div className="text-left">
                      <span className="block text-base font-black text-white uppercase italic tracking-tight">{q.label}</span>
                      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Stream Now</span>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload(q.url, q.label)}
                    className="p-4 bg-[#2a2a2a] hover:bg-white/10 rounded-2xl transition-all text-white flex items-center justify-center border border-white/5"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest border border-white/10">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
