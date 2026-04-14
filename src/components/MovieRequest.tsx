import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Send, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface MovieRequestProps {
  onClose: () => void;
  userIp: string | null;
}

export default function MovieRequest({ onClose, userIp }: MovieRequestProps) {
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [type, setType] = useState<'Movie' | 'Series'>('Movie');
  const [language, setLanguage] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'movieRequests'), {
        title: name,
        year,
        category: type === 'Series' ? 'Web Series' : 'Movie',
        language,
        note: notes,
        status: 'pending',
        timestamp: serverTimestamp(),
        userName: userIp || 'anonymous'
      });

      if (type === 'Series') {
        setShowComingSoon(true);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showComingSoon) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-zinc-900 border border-white/10 p-12 rounded-[2.5rem] text-center max-w-md w-full shadow-2xl"
        >
          <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
            <Send className="text-cyan-500" size={40} />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">Web Series Coming Soon</h2>
          <p className="text-zinc-400 font-medium mb-8">We are currently curating the best series for you. Stay tuned!</p>
          <button 
            onClick={() => {
              setShowComingSoon(false);
              setType('Movie');
            }}
            className="w-full bg-white text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-zinc-900 border border-white/10 p-12 rounded-[2.5rem] text-center max-w-md w-full shadow-2xl"
        >
          <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-green-500/20">
            <CheckCircle2 className="text-green-500" size={40} />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">Request Sent!</h2>
          <p className="text-zinc-400 font-medium">We've received your request. We'll try to add it as soon as possible!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-12 pb-20 px-4 md:px-12">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={onClose}
          className="mb-4 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
        >
          <div className="p-2 bg-white/5 rounded-full group-hover:bg-red-600 transition-all">
            <ChevronLeft size={20} />
          </div>
          <span className="font-black uppercase tracking-widest text-xs">Back to Home</span>
        </button>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase mb-4">
              <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                BHARAT PRIME Movie Request
              </span>
            </h1>
            <p className="text-zinc-400 text-lg font-medium">Request your favorite movies and we'll add them!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-zinc-300 uppercase tracking-widest ml-1">Name Movie/Series:</label>
                <input 
                  required
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name.."
                  className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-cyan-500 outline-none transition-all placeholder:text-zinc-600 font-medium"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-zinc-300 uppercase tracking-widest ml-1">Release Year:</label>
                <input 
                  type="text" 
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Ex: 2025"
                  className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-cyan-500 outline-none transition-all placeholder:text-zinc-600 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-4">
                <label className="text-sm font-black text-zinc-300 uppercase tracking-widest ml-1">Type:</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['Movie', 'Series'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border ${
                        type === t 
                          ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white border-transparent shadow-lg shadow-purple-500/20' 
                          : 'bg-zinc-800/50 text-zinc-500 border-white/5 hover:border-white/20'
                      }`}
                    >
                      {t === 'Series' ? 'Web Series' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-zinc-300 uppercase tracking-widest ml-1">Language:</label>
                <div className="relative">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-cyan-500 outline-none transition-all appearance-none font-medium"
                  >
                    <option value="" className="bg-zinc-900">Select language</option>
                    <option value="Hindi" className="bg-zinc-900">Hindi</option>
                    <option value="English" className="bg-zinc-900">English</option>
                    <option value="Kannada" className="bg-zinc-900">Kannada</option>
                    <option value="Telugu" className="bg-zinc-900">Telugu</option>
                    <option value="Tamil" className="bg-zinc-900">Tamil</option>
                    <option value="Malayalam" className="bg-zinc-900">Malayalam</option>
                    <option value="Other" className="bg-zinc-900">Other</option>
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <ChevronLeft size={20} className="-rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-black text-zinc-300 uppercase tracking-widest ml-1">Notes:</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests"
                rows={3}
                className="w-full bg-zinc-800/50 border border-white/10 rounded-2xl py-4 px-6 text-white focus:border-cyan-500 outline-none transition-all placeholder:text-zinc-600 font-medium resize-none"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 hover:scale-[1.02] active:scale-[0.98] text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-purple-500/20 uppercase tracking-[0.2em] flex items-center justify-center gap-3 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center gap-3">
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={20} className="fill-current" />
                    Send Request
                  </>
                )}
              </div>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
