import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
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
            <img src={movie.image || movie.thumbnail} alt={movie.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent" />
            <div className="absolute bottom-4 left-6 right-6">
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">{movie.title}</h2>
            </div>
          </div>
          <div className="p-6 pt-2 space-y-4">
            <div className="space-y-2">
              {qualities.map((q) => (
                <button
                  key={q.label}
                  onClick={() => onSelect(movie, q.url)}
                  className="w-full flex items-center gap-6 bg-[#2a2a2a] hover:bg-[#333] transition-all p-5 rounded-2xl group"
                >
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                    <Play className="fill-white text-white ml-1" size={20} />
                  </div>
                  <div className="text-left">
                    <span className="block text-lg font-black text-white uppercase italic tracking-tight">{q.label}</span>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">High Quality Stream</span>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all text-sm uppercase tracking-widest border border-white/10">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
