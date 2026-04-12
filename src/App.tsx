/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Search, Bell, Plus, Check, X, Send, Settings, Menu, ShieldCheck } from 'lucide-react';
import { doc, setDoc, onSnapshot, collection, writeBatch, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Movie } from './types';
import { MOVIES } from './constants';
import AdminPanel from './components/AdminPanel';
import QualitySelector from './components/QualitySelector';
import VideoPlayer from './components/VideoPlayer';

// --- Helpers ---

const getQuality = (title: string) => {
  const t = title.toLowerCase();
  if (t.endsWith('hdtc')) return 'HDTC';
  if (t.endsWith('hdts')) return 'HDTS';
  if (t.endsWith('hq')) return 'HQ';
  if (t.endsWith('hdrip')) return 'HDRip';
  if (t.endsWith('hd')) return 'HD';
  if (t.includes('hdtc')) return 'HDTC';
  if (t.includes('hdts')) return 'HDTS';
  if (t.includes('hq')) return 'HQ';
  if (t.includes('hdrip')) return 'HDRip';
  if (t.includes('hd')) return 'HD';
  return 'HD';
};

const cleanTitle = (title: string) => {
  return title.replace(/\s+(HDTC|HDTS|HQ|HDRip|HD|WEB-DL|BluRay)$/i, '').trim();
};

// --- Components ---

const PasswordGate = ({ onAuthorized }: { onAuthorized: () => void }) => {
  const [inputPin, setInputPin] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin) return;
    
    setIsVerifying(true);
    setError('');
    
    try {
      const snap = await getDoc(doc(db, "config", "admin_pass"));
      if (snap.exists()) {
        const data = snap.data();
        const now = new Date();
        const expiry = data.expiresAt ? data.expiresAt.toDate() : null;
        
        if (expiry && now > expiry) {
          setError('The PIN has expired. Please get a new one from Telegram.');
        } else if (data.value === inputPin) {
          onAuthorized();
        } else {
          setError('Invalid PIN. Please check our Telegram channel.');
        }
      } else {
        setError('System error: PIN not set. Contact admin.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[600] bg-black flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600/20 via-transparent to-transparent" />
      </div>

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-zinc-900/50 backdrop-blur-2xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/10 rounded-2xl mb-4 border border-red-600/20">
            <ShieldCheck className="text-red-600 w-8 h-8" />
          </div>
          <h2 className="text-3xl font-black tracking-tighter italic uppercase mb-2">Access Protocol</h2>
          <p className="text-zinc-500 text-sm font-medium">Enter the daily PIN to unlock Bharat Prime</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Daily PIN</label>
            <input 
              type="text" 
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value)}
              placeholder="----"
              className="w-full bg-black/50 border border-white/10 rounded-2xl py-5 text-center text-3xl font-black tracking-[0.5em] focus:border-red-600 outline-none transition-all placeholder:text-zinc-800"
            />
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20"
            >
              {error}
            </motion.p>
          )}

          <button 
            type="submit"
            disabled={isVerifying}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white font-black py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(229,9,20,0.3)] active:scale-95 uppercase tracking-widest flex items-center justify-center gap-3"
          >
            {isVerifying ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Unlock Access
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-4">Don't have the PIN?</p>
          <a 
            href="https://telegram.me/primebharath" 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-[#229ED9] hover:bg-[#1e8ec4] px-6 py-3 rounded-xl font-black text-white shadow-lg transition-all hover:scale-105 active:scale-95 text-xs uppercase tracking-widest"
          >
            <Send className="w-4 h-4 fill-current" />
            Get PIN on Telegram
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const words = ["BHARAT", "PRIME"];
  
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden"
    >
      <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ 
              duration: 1.2, 
              delay: i * 0.6,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="text-6xl sm:text-9xl font-black tracking-tighter text-red-600 italic drop-shadow-[0_0_50px_rgba(229,9,20,0.5)]"
          >
            {word}
          </motion.span>
        ))}
        
        <motion.div 
          initial={{ x: "-100%", opacity: 0 }}
          animate={{ x: "200%", opacity: [0, 0.5, 0] }}
          transition={{ duration: 2.5, delay: 1.2, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
        />
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 1 }}
        className="absolute bottom-12 flex flex-col items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-[2px] bg-red-600/30" />
          <span className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500">Premium Cinema</span>
          <div className="w-12 h-[2px] bg-red-600/30" />
        </div>
        
        <div className="w-48 h-[1px] bg-zinc-900 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "linear" }}
            className="h-full bg-red-600 shadow-[0_0_10px_rgba(229,9,20,0.5)]"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

const Navbar = ({ 
  onWebSeriesClick, 
  onMyListClick, 
  onHomeClick,
  onMoviesClick,
  onAdminClick,
  searchQuery,
  setSearchQuery,
  hideMain,
  myListCount
}: any) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  if (hideMain) return null;

  return (
    <>
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 px-4 md:px-12 flex items-center justify-between ${isScrolled ? 'bg-black/95 backdrop-blur-xl border-b border-white/5' : 'bg-gradient-to-b from-black/90 via-black/40 to-transparent'} h-16 md:h-20`}>
        <div className={`flex items-center gap-4 md:gap-8 transition-opacity duration-300 opacity-100`}>
          <div className="flex items-center gap-2">
            <motion.h1 
              whileHover={{ scale: 1.05 }}
              onClick={() => { onHomeClick(); setSearchQuery(''); }} 
              className={`text-red-600 font-black tracking-tighter cursor-pointer drop-shadow-[0_0_15px_rgba(229,9,20,0.3)] text-xl sm:text-2xl md:text-3xl`}
            >
              BHARAT PRIME
            </motion.h1>
            <button 
              onClick={onAdminClick}
              className="opacity-0 hover:opacity-100 p-2 text-gray-600 transition-opacity hidden sm:block"
              title="Admin Panel"
            >
              <Settings size={16} />
            </button>
          </div>
          <div className={`hidden md:flex items-center gap-6 font-semibold text-gray-400 text-sm uppercase tracking-widest`}>
            {['Home', 'Movies', 'Web Series', 'My List'].map((item) => (
              <button 
                key={item}
                onClick={() => {
                  if (item === 'Home') onHomeClick();
                  else if (item === 'Movies') onMoviesClick();
                  else if (item === 'Web Series') onWebSeriesClick();
                  else onMyListClick();
                  setSearchQuery('');
                }} 
                className={`transition-all duration-300 relative group hover:text-white flex items-center gap-2`}
              >
                {item}
                {item === 'My List' && myListCount > 0 && (
                  <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-black">
                    {myListCount}
                  </span>
                )}
                <span className={`absolute -bottom-1 left-0 h-0.5 bg-red-600 transition-all duration-300 w-0 group-hover:w-full`} />
              </button>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-2 sm:gap-5 transition-opacity duration-300 opacity-100`}>
          <div className={`flex items-center bg-white/10 rounded-full px-3 sm:px-4 py-1.5 transition-all duration-500 focus-within:bg-red-600/10 ${isSearchExpanded ? 'w-32 sm:w-48 md:w-72 border-red-600 ring-2 ring-red-600/20' : 'w-10 sm:w-12 border-white/10'}`}>
            <Search className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer text-gray-400" onClick={() => setIsSearchExpanded(!isSearchExpanded)} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              className={`bg-transparent border-none outline-none text-xs sm:text-sm ml-2 sm:ml-3 w-full text-white ${isSearchExpanded ? 'block' : 'hidden'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <a href="https://t.me/primebharath1" target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-2 bg-[#229ED9] px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg">
            <Send className="w-3 h-3 fill-current" /> Join Telegram
          </a>

          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: '-100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl md:hidden flex flex-col items-center justify-start pt-24 gap-12 p-6 h-[100dvh]"
          >
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-4 text-white bg-white/10 rounded-full hover:bg-red-600 transition-all duration-300"
            >
              <X size={32} />
            </button>

            <div className="flex flex-col items-center gap-10 w-full">
              <h2 className="text-red-600 font-black text-4xl tracking-tighter mb-4 drop-shadow-[0_0_25px_rgba(229,9,20,0.5)] italic">
                BHARAT PRIME
              </h2>
              
              <div className="flex flex-col items-center gap-6">
                {['Home', 'Movies', 'Web Series', 'My List'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => {
                      if (item === 'Home') onHomeClick();
                      else if (item === 'Movies') onMoviesClick();
                      else if (item === 'Web Series') onWebSeriesClick();
                      else onMyListClick();
                      setSearchQuery('');
                      setIsMobileMenuOpen(false);
                    }} 
                    className="text-3xl font-black text-gray-400 hover:text-white transition-all duration-300 uppercase tracking-tighter"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto pb-12 w-full flex justify-center">
              <a 
                href="https://t.me/primebharath1" 
                target="_blank" 
                rel="noreferrer" 
                className="flex items-center gap-4 bg-[#229ED9] px-12 py-5 rounded-2xl text-xl font-black text-white shadow-lg"
              >
                <Send className="w-6 h-6 fill-current" /> Join Telegram
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const HeroBanner = ({ movies, onPlay }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const bannerMovies = movies.filter((m: any) => m.category === 'Banner').length > 0
    ? movies.filter((m: any) => m.category === 'Banner')
    : movies.slice(0, 5);

  useEffect(() => {
    if (bannerMovies.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % bannerMovies.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerMovies.length]);

  if (bannerMovies.length === 0) return <div className="h-[60vh] sm:h-[70vh] bg-black" />;
  const currentMovie = bannerMovies[currentIndex];

  return (
    <div className="md:px-12 pt-16 md:pt-24">
      <div className="relative w-full h-[60vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] md:rounded-2xl overflow-hidden shadow-2xl border-b md:border border-white/5">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentMovie.id} 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            transition={{ duration: 0.8 }}
            className="absolute inset-0"
          >
            <img 
              src={currentMovie.backdrop || currentMovie.thumbnail} 
              alt="" 
              className="w-full h-full object-contain md:object-cover object-center bg-black" 
              referrerPolicy="no-referrer" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        {/* Banner Content */}
        <div className="absolute inset-0 flex flex-col justify-end items-center px-6 sm:px-12 pb-12 md:pb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={`content-${currentMovie.id}`}
            className="flex flex-col items-center max-w-3xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-lg">{getQuality(currentMovie.title)}</span>
              <span className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em] drop-shadow-md">{currentMovie.language}</span>
            </div>
            
            <h2 className="font-black text-2xl sm:text-4xl md:text-5xl lg:text-6xl text-white drop-shadow-2xl leading-tight mb-6 uppercase tracking-tighter italic">
              {cleanTitle(currentMovie.title)}
            </h2>
            
            <div className="flex flex-wrap gap-4 items-center">
              <button 
                onClick={() => onPlay(currentMovie)} 
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-8 py-3 sm:px-12 sm:py-4 rounded-full text-white font-black transition-all group shadow-[0_0_40px_rgba(229,9,20,0.6)] hover:scale-105 active:scale-95"
              >
                <div className="bg-white rounded-full p-1 group-hover:scale-110 transition-transform">
                  <Play className="fill-black text-black w-3 h-3 sm:w-5 sm:h-5" />
                </div>
                <span className="text-sm sm:text-lg tracking-widest uppercase">WATCH NOW</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Slider Dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
          {bannerMovies.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-500 ${currentIndex === idx ? 'w-10 bg-red-600 shadow-[0_0_10px_rgba(229,9,20,0.8)]' : 'w-2 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const MovieCard = ({ movie, onPlay, onToggleMyList, isInMyList, widthClass = "w-full" }: any) => {
  const quality = getQuality(movie.title);
  const displayTitle = `${movie.year ? `(${movie.year}) ` : ''}${cleanTitle(movie.title)} ${quality}`;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -5 }}
      className={`relative rounded-2xl overflow-hidden cursor-pointer transition-all bg-white shadow-xl group ${widthClass}`}
      onClick={() => onPlay(movie)}
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        <img 
          src={movie.thumbnail || movie.image} 
          alt={movie.title} 
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110" 
          referrerPolicy="no-referrer" 
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
          <div 
            onClick={(e) => { e.stopPropagation(); onPlay(movie); }}
            className="flex flex-col items-center gap-2"
          >
            <div className="p-4 bg-red-600 rounded-full text-white shadow-2xl scale-75 group-hover:scale-100 transition-all duration-300 hover:bg-red-700">
              <Play fill="white" size={28} />
            </div>
            <span className="text-white font-black text-[10px] tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity delay-100">WATCH NOW</span>
          </div>
        </div>
        <div className="absolute top-3 right-3 z-10">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleMyList(movie); }} 
            className={`p-2 rounded-full backdrop-blur-md transition-all duration-300 ${isInMyList ? 'bg-green-500/90 text-white' : 'bg-black/40 text-white hover:bg-red-600'}`}
          >
            {isInMyList ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
      
      <div className="p-3 sm:p-4 bg-white group-hover:bg-zinc-900 transition-all duration-300">
        <div className="overflow-hidden whitespace-nowrap relative">
          <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white group-hover:from-zinc-900 to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white group-hover:from-zinc-900 to-transparent z-10" />
          <motion.div 
            className="inline-block"
            animate={{ 
              x: ["0%", "-50%"],
            }}
            transition={{ 
              duration: Math.max(displayTitle.length * 0.3, 5), 
              repeat: Infinity, 
              ease: "linear",
              repeatType: "loop"
            }}
            style={{ width: 'max-content' }}
          >
            <span className="text-black font-black text-xs sm:text-sm md:text-base leading-tight group-hover:text-white transition-colors pr-12">
              {displayTitle}
            </span>
            <span className="text-black font-black text-xs sm:text-sm md:text-base leading-tight group-hover:text-white transition-colors pr-12">
              {displayTitle}
            </span>
          </motion.div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-red-600 text-[10px] sm:text-xs font-black uppercase tracking-wider group-hover:text-red-500">
            {movie.language}
          </span>
          <span className="w-1 h-1 bg-gray-300 rounded-full" />
          <span className="text-gray-500 text-[10px] sm:text-xs font-bold group-hover:text-gray-400 uppercase">
            {quality}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const MovieRow = ({ title, movies, onToggleMyList, myList, onPlay, onViewMore }: any) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.8 
        : scrollLeft + clientWidth * 0.8;
      
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  return (
    <div className="mb-16 group/row relative">
      <div className="flex items-center justify-between px-4 md:px-12 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-red-600 rounded-full" />
          <h3 className="font-black text-white tracking-tight text-xl sm:text-2xl md:text-3xl uppercase italic">
            {title} <span className="text-gray-500 font-normal not-italic lowercase ml-1">Movies</span>
          </h3>
        </div>
        <button 
          onClick={() => onViewMore?.(title)}
          className="group flex items-center gap-2 bg-white/5 hover:bg-red-600 text-white px-5 py-2 rounded-full text-sm font-black transition-all border border-white/10 hover:border-red-600"
        >
          VIEW ALL <ChevronLeft className="rotate-180 w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      <div className="relative group/scroll">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-8 z-40 w-12 md:w-16 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <div ref={rowRef} className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar pb-8 px-4 md:px-12 scroll-smooth">
          {movies.map((movie: Movie) => (
            <MovieCard 
              key={movie.id}
              movie={movie}
              onPlay={onPlay}
              onToggleMyList={onToggleMyList}
              isInMyList={myList.some((m: Movie) => m.id === movie.id)}
              widthClass="w-[150px] sm:w-[200px] md:w-[240px] flex-none"
            />
          ))}
          <div className="flex-none w-4 md:w-12" />
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-8 z-40 w-12 md:w-16 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="bg-zinc-950 border-t border-white/5 pt-10 md:pt-16 pb-8 px-4 md:px-12 mt-10 md:mt-20">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-10 md:mb-12">
      <div className="space-y-4">
        <h2 className="text-red-600 font-black text-2xl md:text-3xl tracking-tighter">BHARAT PRIME</h2>
        <p className="text-gray-500 text-xs md:text-sm leading-relaxed max-w-xs">
          The ultimate destination for premium Indian cinema. Stream your favorite movies and series in high quality, anytime, anywhere.
        </p>
      </div>
      
      <div className="space-y-4 md:space-y-6">
        <h3 className="text-white font-bold uppercase tracking-widest text-[10px] md:text-xs">Stay Connected</h3>
        <p className="text-gray-500 text-xs md:text-sm">Join our community for the latest movie releases and exclusive updates.</p>
        <a 
          href="https://t.me/primebharath1" 
          target="_blank" 
          rel="noreferrer" 
          className="inline-flex items-center gap-3 bg-[#229ED9] hover:bg-[#1e8ec4] px-5 py-2.5 md:px-6 md:py-3 rounded-xl font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 text-sm"
        >
          <Send className="w-4 h-4 md:w-5 md:h-5 fill-current" /> Join Telegram Channel
        </a>
      </div>
    </div>
    
    <div className="pt-6 md:pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-gray-600 text-[10px] md:text-xs font-medium">
        © {new Date().getFullYear()} BHARAT PRIME. All rights reserved.
      </p>
    </div>
  </footer>
);

// --- Main App ---

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [myListIds, setMyListIds] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<'home' | 'myList' | 'movies'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [userIp, setUserIp] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [selectedMovieForQuality, setSelectedMovieForQuality] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<{ movie: Movie, url: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const q = query(collection(db, "movies"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => {
            const data = d.data();
            return { 
              id: d.id, 
              ...data,
              thumbnail: data.thumbnail || data.image || '',
              videoUrl: data.videoUrl || data.link || '',
              backdrop: data.backdrop || data.thumbnail || data.image || ''
            } as Movie;
          });
          
          if (list.length === 0 && isLoading) {
            const batch = writeBatch(db);
            MOVIES.forEach((movie) => {
              const docRef = doc(collection(db, 'movies'), movie.id);
              batch.set(docRef, { ...movie, createdAt: serverTimestamp() });
            });
            batch.commit();
          }
          
          setMovies(list);
          setIsLoading(false);
        });

        // Get user identifier (IP with fallback to LocalStorage ID)
        let identifier = '';
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const { ip } = await res.json();
          identifier = ip.replace(/\./g, '_');
        } catch (e) {
          console.warn('IP fetch failed, using fallback ID:', e);
          // Fallback to a persistent random ID if IP fetch fails (e.g. due to CORS or adblockers)
          let fallbackId = localStorage.getItem('bharat_prime_user_id');
          if (!fallbackId) {
            fallbackId = 'user_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('bharat_prime_user_id', fallbackId);
          }
          identifier = fallbackId;
        }
        
        setUserIp(identifier);

        // Check authorization status by identifier (Source of truth)
        const authSnap = await getDoc(doc(db, 'authorized_ips', identifier));
        if (authSnap.exists()) {
          const authData = authSnap.data();
          const now = new Date();
          const expiry = authData.expiresAt ? authData.expiresAt.toDate() : null;
          
          if (expiry && now > expiry) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
        setIsAuthChecking(false);

        // Fetch user-specific "My List" based on identifier
        onSnapshot(doc(db, 'user_lists', identifier), (doc) => {
          if (doc.exists()) {
            setMyListIds(doc.data().movieIds || []);
          } else {
            setMyListIds([]);
          }
        });

        setTimeout(() => setShowSplash(false), 3500);

        return () => unsubscribe();
      } catch (err) {
        console.error('Initialization error:', err);
        setIsLoading(false);
        setShowSplash(false);
      }
    };
    init();
  }, []);

  const handlePlay = async (movie: Movie) => {
    setSelectedMovieForQuality(movie);
  };

  const handleQualitySelect = (movie: Movie, url: string) => {
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    setPlayingMovie({ movie, url: finalUrl });
    setSelectedMovieForQuality(null);
  };

  const toggleMyList = async (movie: Movie) => {
    if (!userIp) return;
    const updated = myListIds.includes(movie.id) ? myListIds.filter(id => id !== movie.id) : [...myListIds, movie.id];
    await setDoc(doc(db, 'user_lists', userIp), { movieIds: updated }, { merge: true });
  };

  const filterByLang = (lang: string) => movies.filter(m => m.language === lang);

  const handleViewMore = (category: string) => {
    setSelectedCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthorized = async () => {
    if (!userIp) return;
    
    // Set expiry to next 7 AM (matching the PIN logic)
    let expiry = new Date();
    expiry.setHours(7, 0, 0, 0);
    if (new Date() > expiry) expiry.setDate(expiry.getDate() + 1);
    
    try {
      await setDoc(doc(db, 'authorized_ips', userIp), { 
        authorized: true, 
        expiresAt: expiry,
        updatedAt: serverTimestamp() 
      });
      setIsAuthorized(true);
    } catch (err) {
      console.error('Error saving authorization:', err);
      // Fallback to local state if Firestore fails
      setIsAuthorized(true);
    }
  };

  if (isLoading && showSplash) return <SplashScreen onComplete={() => {}} />;

  const results = movies.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-black text-white selection:bg-red-600">
      <AnimatePresence mode="wait">
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {!showSplash && !isAuthorized && !isAuthChecking && (
        <PasswordGate onAuthorized={handleAuthorized} />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: (showSplash || (!isAuthorized && !isAuthChecking)) ? 0 : 1 }}
        transition={{ duration: 1 }}
        className={(showSplash || (!isAuthorized && !isAuthChecking)) ? "pointer-events-none" : ""}
      >
        <Navbar 
          onHomeClick={() => { setCurrentView('home'); setSelectedCategory(null); }}
          onMoviesClick={() => { setCurrentView('movies'); setSelectedCategory(null); }}
          onMyListClick={() => { setCurrentView('myList'); setSelectedCategory(null); }}
          onWebSeriesClick={() => setIsModalOpen(true)}
          onAdminClick={() => setIsAdminOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          hideMain={!!selectedCategory || currentView === 'myList' || currentView === 'movies'}
          myListCount={myListIds.length}
        />

        <main className="pt-0">
        {selectedCategory ? (
          <div className="pb-20 pt-8 md:pt-12 px-4 md:px-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setSelectedCategory(null); setSearchQuery(''); }}
                  className="p-3 bg-white/5 hover:bg-red-600 rounded-full text-white transition-all border border-white/10 hover:border-red-600"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-2xl sm:text-4xl font-black text-red-600 uppercase tracking-tighter italic">
                  {selectedCategory} <span className="text-white not-italic">Movies</span>
                </h2>
              </div>

              <div className="flex items-center bg-white/5 rounded-full px-6 py-3 w-full md:w-96 border border-white/10 focus-within:border-red-600 transition-all backdrop-blur-sm">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCategory}...`}
                  className="bg-transparent border-none outline-none ml-3 w-full text-white text-sm font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
              {filterByLang(selectedCategory).filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                <MovieCard 
                  key={m.id}
                  movie={m}
                  onPlay={handlePlay}
                  onToggleMyList={toggleMyList}
                  isInMyList={myListIds.includes(m.id)}
                />
              ))}
            </div>
          </div>
        ) : currentView === 'movies' ? (
          <div className="pb-20 pt-8 md:pt-12 px-4 md:px-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setCurrentView('home'); setSearchQuery(''); }}
                  className="p-3 bg-white/5 hover:bg-red-600 rounded-full text-white transition-all border border-white/10 hover:border-red-600"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-2xl sm:text-4xl font-black text-red-600 uppercase tracking-tighter italic">MOVIES</h2>
              </div>

              <div className="flex items-center bg-white/5 rounded-full px-6 py-3 w-full md:w-96 border border-white/10 focus-within:border-red-600 transition-all backdrop-blur-sm">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search movies..."
                  className="bg-transparent border-none outline-none ml-3 w-full text-white text-sm font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            {searchQuery ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
                {movies.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                  <MovieCard 
                    key={m.id}
                    movie={m}
                    onPlay={handlePlay}
                    onToggleMyList={toggleMyList}
                    isInMyList={myListIds.includes(m.id)}
                  />
                ))}
              </div>
            ) : (
              ['Kannada', 'Hindi', 'Telugu', 'Tamil'].map((lang) => (
                <MovieRow 
                  key={lang}
                  title={lang} 
                  movies={filterByLang(lang)} 
                  myList={movies.filter(m => myListIds.includes(m.id))}
                  onPlay={handlePlay}
                  onInfo={handlePlay}
                  onToggleMyList={toggleMyList}
                  onViewMore={handleViewMore}
                />
              ))
            )}
          </div>
        ) : currentView === 'myList' ? (
          <div className="pb-20 pt-8 md:pt-12 px-4 md:px-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setCurrentView('home'); setSearchQuery(''); }}
                  className="p-3 bg-white/5 hover:bg-red-600 rounded-full text-white transition-all border border-white/10 hover:border-red-600"
                >
                  <ChevronLeft size={24} />
                </button>
                <h2 className="text-2xl sm:text-4xl font-black text-red-600 uppercase italic">MY LIST</h2>
              </div>

              <div className="flex items-center bg-white/5 rounded-full px-6 py-3 w-full md:w-96 border border-white/10 focus-within:border-red-600 transition-all backdrop-blur-sm">
                <Search className="w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search in your list..."
                  className="bg-transparent border-none outline-none ml-3 w-full text-white text-sm font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {myListIds.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
                {movies
                  .filter(m => myListIds.includes(m.id))
                  .filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(m => (
                    <MovieCard 
                      key={m.id}
                      movie={m}
                      onPlay={handlePlay}
                      onToggleMyList={toggleMyList}
                      isInMyList={true}
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg sm:text-xl">Your list is empty. Add some movies to see them here!</p>
              </div>
            )}
          </div>
        ) : searchQuery ? (
          <div className="px-4 md:px-12 pt-24 md:pt-32 pb-20">
            <h2 className="text-2xl sm:text-4xl font-black mb-8 text-white uppercase italic">
              Search Results for: <span className="text-red-600">"{searchQuery}"</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-8">
              {results.map(m => (
                <MovieCard 
                  key={m.id}
                  movie={m}
                  onPlay={handlePlay}
                  onToggleMyList={toggleMyList}
                  isInMyList={myListIds.includes(m.id)}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            {currentView === 'home' && (
              <>
                <HeroBanner movies={movies} onPlay={handlePlay} />
                <div className="pb-20 mt-4 sm:mt-8">
                  {['Kannada', 'Hindi', 'Telugu', 'Tamil'].map((lang) => (
                    <MovieRow 
                      key={lang}
                      title={lang} 
                      movies={filterByLang(lang)} 
                      myList={movies.filter(m => myListIds.includes(m.id))}
                      onPlay={handlePlay}
                      onInfo={handlePlay}
                      onToggleMyList={toggleMyList}
                      onViewMore={handleViewMore}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <Footer />

      <AnimatePresence>
        {isAdminOpen && (
          <AdminPanel 
            onClose={() => setIsAdminOpen(false)} 
            userIp={userIp}
            onAuthorized={handleAuthorized}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-zinc-900 p-10 rounded-2xl border border-white/10 text-center max-w-sm">
              <Bell className="mx-auto text-red-600 mb-4 animate-bounce" size={48} />
              <h2 className="text-2xl font-bold mb-2">Web Series Coming Soon</h2>
              <p className="text-gray-400 mb-6">We are currently curating the best series for you.</p>
              <button onClick={() => setIsModalOpen(false)} className="w-full bg-red-600 py-3 rounded-lg font-bold">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <QualitySelector 
        movie={selectedMovieForQuality}
        onClose={() => setSelectedMovieForQuality(null)}
        onSelect={handleQualitySelect}
      />

      <AnimatePresence>
        {playingMovie && (
          <VideoPlayer 
            movie={playingMovie.movie}
            selectedUrl={playingMovie.url}
            onClose={() => setPlayingMovie(null)}
          />
        )}
      </AnimatePresence>
      </motion.div>
    </div>
  );
}
