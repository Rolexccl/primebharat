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
    <div className="min-h-screen bg-black pt-20 sm:pt-24 pb-20 px-4 md:px-12">
      <div className="max-w-xl mx-auto">
        <button 
          onClick={onClose}
          className="mb-6 flex items-center gap-2 text-zinc-600 hover:text-white transition-colors group"
        >
          <div className="p-1.5 bg-white/5 rounded-full group-hover:bg-red-600 transition-all border border-white/5">
            <ChevronLeft size={16} />
          </div>
          <span className="font-black uppercase tracking-[0.3em] text-[9px]">Return to Cinema</span>
        </button>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 p-6 sm:p-8 rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 ring-1 ring-white/5"
        >
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter italic uppercase mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
              Movie Request
            </h1>
            <p className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.4em] opacity-80">Tell us what's missing</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-1">Content Title</label>
                <input 
                  required
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Inception"
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 px-5 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-1">Launch Year</label>
                <input 
                  type="text" 
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2010"
                  className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 px-5 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-1">Category Type</label>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                  {(['Movie', 'Series'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-md font-black uppercase tracking-widest text-[8px] transition-all ${
                        type === t 
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                          : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {t === 'Series' ? 'Web Series' : t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-1">Language Choice</label>
                <div className="relative">
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-lg py-2.5 px-5 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all appearance-none text-white cursor-pointer"
                  >
                    <option value="" className="bg-zinc-900">Select...</option>
                    <option value="Hindi" className="bg-zinc-900">Hindi</option>
                    <option value="English" className="bg-zinc-900">English</option>
                    <option value="Kannada" className="bg-zinc-900">Kannada</option>
                    <option value="Telugu" className="bg-zinc-900">Telugu</option>
                    <option value="Tamil" className="bg-zinc-900">Tamil</option>
                    <option value="Malayalam" className="bg-zinc-900">Malayalam</option>
                    <option value="Other" className="bg-zinc-900">Other</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                    <ChevronLeft size={12} className="-rotate-90" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[7.5px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-1">Additional Details</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or details..."
                rows={2}
                className="w-full bg-black/40 border border-white/5 rounded-lg py-3 px-5 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white resize-none"
              />
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-black py-3.5 rounded-lg transition-all shadow-[0_5px_30px_rgba(229,9,20,0.3)] uppercase tracking-[0.4em] flex items-center justify-center gap-2 mt-3 text-[10px]"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={14} className="fill-current" />
                  Dispatch Request
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
