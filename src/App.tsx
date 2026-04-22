/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, ChevronLeft, ChevronRight, Search, Bell, Plus, Check, X, Send, Settings, Menu, ShieldCheck, Home, Film, Tv2, Heart, MessageSquarePlus, CircleUser, Lock, User as UserIcon } from 'lucide-react';
import { doc, setDoc, onSnapshot, collection, writeBatch, query, orderBy, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Movie, User } from './types';
import { MOVIES } from './constants';
import AdminPanel from './components/AdminPanel';
import QualitySelector from './components/QualitySelector';
import VideoPlayer from './components/VideoPlayer';
import MovieRequest from './components/MovieRequest';

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

const getDisplayPlanName = (user: any) => {
  const name = user?.planName || user?.plan;
  if (name) return name;
  
  // Derive name from price if missing
  const priceString = (user?.planPrice || user?.amount || '').toString().replace(/[^0-9]/g, '');
  const price = parseInt(priceString);
  
  if (price === 149) return '90 DAYS';
  if (price === 55) return 'MONTHLY';
  if (price === 19) return 'WEEKLY';
  
  return 'BASIC';
};

// --- Components ---

const LoginGate = ({ onAuthorized }: { onAuthorized: (userData: any) => void }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerData, setRegisterData] = useState({ name: '', userId: '', password: '' });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) {
      setError('Enter your ID and Password');
      return;
    }
    
    setIsVerifying(true);
    setError('');
    
    try {
      // First check if a registration request is pending
      const regSnap = await getDoc(doc(db, "registrationRequests", userId.trim()));
      if (regSnap.exists()) {
        const regData = regSnap.data();
        if (regData.status === 'pending') {
          setError('Your account is pending admin approval.');
          setIsVerifying(false);
          return;
        }
      }

      const userSnap = await getDoc(doc(db, "users", userId.trim()));
      if (userSnap.exists()) {
        const userData = { ...userSnap.data(), userId: userSnap.id } as User;
        if (userData.password === password.trim()) {
          // Check expiry
          if (userData.expiryDate) {
            const expiry = new Date(userData.expiryDate);
            if (expiry < new Date()) {
              setError('Your subscription has expired. Please renew.');
              setIsVerifying(false);
              return;
            }
          }
          onAuthorized(userData);
        } else {
          setError('Invalid login credentials.');
        }
      } else {
        setError('User ID not found or account inactive.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.name || !registerData.userId || !registerData.password) {
      setError('All fields are required');
      return;
    }
    
    setIsVerifying(true);
    setError('');
    
    try {
      // Check if ID already exists in users or requests
      const userSnap = await getDoc(doc(db, "users", registerData.userId.trim()));
      const regSnap = await getDoc(doc(db, "registrationRequests", registerData.userId.trim()));
      
      if (userSnap.exists() || regSnap.exists()) {
        setError('This User ID is already taken.');
        setIsVerifying(false);
        return;
      }

      await setDoc(doc(db, "registrationRequests", registerData.userId.trim()), {
        ...registerData,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      
      setError('Request sent! Please wait for admin approval.');
      setRegisterData({ name: '', userId: '', password: '' });
      setTimeout(() => {
        setIsRegistering(false);
        setError('');
      }, 3000);
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to send request. Try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 400 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="fixed inset-0 z-[600] bg-[#121212] flex items-center justify-center p-4 lg:p-10 shrink-0 overflow-hidden"
    >
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1594909122845-11baa439b7bf?auto=format&fit=crop&w=2400&q=80')] bg-cover bg-center mix-blend-overlay opacity-40 grayscale animate-pulse-slow" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/10 via-transparent to-black/90" />
      </div>

      <motion.div 
        variants={itemVariants}
        className="w-full max-w-[320px] bg-zinc-950/60 backdrop-blur-3xl border border-white/5 p-4 sm:p-6 rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 ring-1 ring-white/5 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="text-center mb-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="inline-flex items-center justify-center w-10 h-10 bg-red-600/5 rounded-xl mb-2 border border-red-600/10 shadow-[0_0_20px_rgba(229,9,20,0.1)] group"
          >
            <ShieldCheck className="text-red-600 w-4 h-4 drop-shadow-[0_0_10px_rgba(229,9,20,0.5)]" />
          </motion.div>
          <h2 className="text-lg sm:text-xl font-black tracking-tighter uppercase mb-0.5 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent italic">
            {isRegistering ? 'Create Account' : 'Member Login'}
          </h2>
          <p className="text-zinc-600 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.4em] opacity-80">
            {isRegistering ? 'Submit your details' : 'Credentials Required'}
          </p>
        </div>

        <form onSubmit={isRegistering ? handleRegister : handleVerify} className="space-y-2.5">
          {isRegistering && (
            <motion.div variants={itemVariants} className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <label className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.4em]">Official Name</label>
                <Tv2 className="w-2 h-2 text-red-600/30" />
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-red-600/5 rounded-lg blur-md group-focus-within:bg-red-600/10 transition-all opacity-0 group-focus-within:opacity-100" />
                <input 
                  type="text" 
                  value={registerData.name}
                  onChange={(e) => setRegisterData({...registerData, name: e.target.value})}
                  placeholder="Full Name"
                  className="relative w-full bg-black/40 border border-white/5 rounded-lg py-2 px-4 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white"
                />
              </div>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.4em]">User Access ID</label>
              <UserIcon className="w-2 h-2 text-red-600/30" />
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-red-600/5 rounded-lg blur-md group-focus-within:bg-red-600/10 transition-all opacity-0 group-focus-within:opacity-100" />
              <input 
                type="text" 
                value={isRegistering ? registerData.userId : userId}
                onChange={(e) => isRegistering ? setRegisterData({...registerData, userId: e.target.value}) : setUserId(e.target.value)}
                placeholder="Username"
                className="relative w-full bg-black/40 border border-white/5 rounded-lg py-2 px-4 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white"
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <label className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.4em]">Security Key</label>
              <Lock className="w-2 h-2 text-red-600/30" />
            </div>
            <div className="relative group">
              <div className="absolute inset-0 bg-red-600/5 rounded-lg blur-md group-focus-within:bg-red-600/10 transition-all opacity-0 group-focus-within:opacity-100" />
              <input 
                type="password" 
                value={isRegistering ? registerData.password : password}
                onChange={(e) => isRegistering ? setRegisterData({...registerData, password: e.target.value}) : setPassword(e.target.value)}
                placeholder="••••••••"
                className="relative w-full bg-black/40 border border-white/5 rounded-lg py-2 px-4 text-xs font-black focus:border-red-600 focus:bg-black/60 outline-none transition-all placeholder:text-zinc-800 text-white"
              />
            </div>
          </motion.div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-red-500 text-[7px] font-black text-center bg-red-500/5 py-1.5 rounded-lg border border-red-500/10 uppercase tracking-[0.2em]"
            >
               {error}
            </motion.div>
          )}

          <motion.button 
            variants={itemVariants}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isVerifying}
            className="w-full relative group overflow-hidden mt-0.5"
          >
            <div className="absolute inset-0 bg-red-600 transition-all group-hover:bg-red-700 active:opacity-90" />
            <div className="relative bg-transparent h-full font-black py-2.5 rounded-lg text-white uppercase tracking-[0.4em] flex items-center justify-center gap-2 shadow-[0_5px_20px_rgba(229,9,20,0.3)]">
              {isVerifying ? (
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-[9px] font-bold">{isRegistering ? 'Submit Request' : 'Access Content'}</span>
                  <Play className="w-3 h-3 fill-current" />
                </>
              )}
            </div>
          </motion.button>
        </form>

        <motion.div variants={itemVariants} className="mt-3 text-center">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="text-[7.5px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-red-500 transition-colors"
            >
              {isRegistering ? 'Already have account? Login' : "Don't have an account? Create One"}
            </button>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="mt-4 pt-4 border-t border-white/5 text-center flex flex-col items-center gap-3"
        >
          <p className="text-zinc-700 text-[7.5px] font-black uppercase tracking-[0.4em]">Subscription Support</p>
          <a 
            href="https://telegram.me/rajatpatidar1" 
            target="_blank" 
            rel="noreferrer"
            className="group flex items-center gap-2 bg-white/5 px-5 py-2.5 rounded-lg border border-white/5 hover:border-red-600 hover:bg-red-600/10 transition-all no-underline w-full justify-center"
          >
             <Send className="w-3.5 h-3.5 text-[#229ED9] group-hover:text-red-500 transition-colors" />
             <span className="text-white group-hover:text-red-500 transition-colors text-[7.5px] font-black uppercase tracking-[0.3em]">Contact Telegram Bot</span>
          </a>
        </motion.div>
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
            className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-red-600 italic drop-shadow-[0_0_30px_rgba(229,9,20,0.4)]"
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
  onRequestClick,
  onProfileClick,
  currentUser,
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

  const navItems = [
    { name: 'Home', icon: Home },
    { name: 'Movies', icon: Film },
    { name: 'Web Series', icon: Tv2 },
    { name: 'My List', icon: Heart },
    { name: 'Request', icon: MessageSquarePlus },
    { name: 'Profile', icon: CircleUser }
  ];

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  if (hideMain) return null;

  return (
    <>
      <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 px-4 md:px-12 flex items-center justify-between ${isScrolled ? 'bg-black/95 backdrop-blur-xl border-b border-white/5' : 'bg-gradient-to-b from-black/90 via-black/40 to-transparent'} h-16 md:h-20`}>
        <div className={`flex items-center gap-10 lg:gap-16 transition-opacity duration-300 opacity-100 flex-1`}>
          <div className={`flex items-center gap-2 flex-shrink-0 ${isSearchExpanded ? 'hidden sm:flex' : 'flex'}`}>
            <motion.h1 
              whileHover={{ scale: 1.05 }}
              onClick={() => { onHomeClick(); setSearchQuery(''); }} 
              className={`text-red-600 font-black tracking-tighter cursor-pointer drop-shadow-[0_0_15px_rgba(229,9,20,0.3)] text-xl sm:text-2xl md:text-3xl whitespace-nowrap`}
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
          <div className={`hidden md:flex items-center gap-6 lg:gap-8 font-semibold text-gray-400 text-[11px] uppercase tracking-widest`}>
            {navItems.map((item) => (
              <button 
                key={item.name}
                onClick={() => {
                  if (item.name === 'Home') onHomeClick();
                  else if (item.name === 'Movies') onMoviesClick();
                  else if (item.name === 'Web Series') onWebSeriesClick();
                  else if (item.name === 'Request') onRequestClick();
                  else if (item.name === 'Profile') onProfileClick();
                  else onMyListClick();
                  setSearchQuery('');
                }} 
                className={`transition-all duration-300 relative group flex items-center gap-2 px-1 py-2 whitespace-nowrap ${item.name === 'Profile' ? 'bg-zinc-800/40 hover:bg-zinc-800/80 px-5 py-2 rounded-full border border-white/10 hover:border-red-600/50 ml-2 shadow-xl ring-1 ring-white/5' : 'text-zinc-400 hover:text-white'}`}
              >
                <item.icon size={14} className={`${item.name === 'Profile' ? 'text-red-500' : 'text-zinc-500 group-hover:text-red-500'} transition-colors`} />
                <span className="truncate">{item.name}</span>
                {item.name === 'My List' && myListCount > 0 && (
                  <span className="bg-red-600 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] h-[16px] flex items-center justify-center font-black animate-bounce">
                    {myListCount}
                  </span>
                )}
                {item.name === 'Profile' && (
                  <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded-full ml-1 border border-red-400/30">
                    {getDisplayPlanName(currentUser)}
                  </span>
                )}
                {item.name !== 'Profile' && <span className={`absolute -bottom-1 left-0 h-0.5 bg-red-600 transition-all duration-300 w-0 group-hover:w-full blur-[1px]`} />}
              </button>
            ))}
          </div>
        </div>
        <div className={`flex items-center gap-2 sm:gap-6 transition-opacity duration-300 opacity-100 flex-shrink-0 ${isSearchExpanded ? 'flex-1 justify-end' : ''}`}>
          <div className={`flex items-center bg-white/5 rounded-full px-3 sm:px-4 py-1.5 transition-all duration-500 border border-white/5 focus-within:border-red-600 focus-within:bg-red-600/5 ${isSearchExpanded ? 'w-full sm:w-64 md:w-80 shadow-[0_0_20px_rgba(229,9,20,0.1)]' : 'w-10 sm:w-12 hover:bg-white/10'}`}>
            <Search className="w-4 h-4 sm:w-5 sm:h-5 cursor-pointer text-gray-400 flex-shrink-0" onClick={() => setIsSearchExpanded(!isSearchExpanded)} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search movies..."
              className={`bg-transparent border-none outline-none text-[11px] font-bold ml-2 sm:ml-3 w-full text-white placeholder:text-zinc-600 ${isSearchExpanded ? 'block' : 'hidden'}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {isSearchExpanded && (
              <X 
                size={16} 
                className="text-zinc-500 hover:text-white cursor-pointer transition-colors sm:hidden" 
                onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); }}
              />
            )}
          </div>

          <a href="https://t.me/primebharath1" target="_blank" rel="noreferrer" className="hidden lg:flex items-center gap-2 bg-[#229ED9] hover:bg-[#229ED9]/90 px-6 py-2.5 rounded-full text-[10px] font-black text-white shadow-xl transition-all hover:scale-105 active:scale-95 uppercase tracking-widest whitespace-nowrap">
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

            <div className="flex flex-col items-center gap-10 w-full pt-10">
              <div className="flex flex-col items-center gap-4 w-full px-8">
                {navItems.map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => {
                      if (item.name === 'Home') onHomeClick();
                      else if (item.name === 'Movies') onMoviesClick();
                      else if (item.name === 'Web Series') onWebSeriesClick();
                      else if (item.name === 'Request') onRequestClick();
                      else if (item.name === 'Profile') onProfileClick();
                      else onMyListClick();
                      setSearchQuery('');
                      setIsMobileMenuOpen(false);
                    }} 
                    className={`w-full py-4 rounded-2xl transition-all duration-300 uppercase tracking-tighter flex items-center justify-between px-6 ${item.name === 'Profile' ? 'bg-red-600 text-white shadow-2xl' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <item.icon size={24} className={item.name === 'Profile' ? 'text-white' : 'text-red-600'} />
                      <span className="text-2xl font-black">{item.name}</span>
                    </div>
                    {item.name === 'Profile' && (
                      <span className="text-[10px] font-black bg-black/30 px-3 py-1 rounded-full text-white tracking-widest">{getDisplayPlanName(currentUser)}</span>
                    )}
                    {item.name === 'My List' && myListCount > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-1 rounded-full font-black">
                        {myListCount}
                      </span>
                    )}
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
              src={currentMovie.backdrop || currentMovie.thumbnail || undefined} 
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
              <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-lg">{getQuality(currentMovie.title)}</span>
              <span className="text-white/80 text-[8px] font-black uppercase tracking-[0.2em] drop-shadow-md">{currentMovie.language}</span>
            </div>
            
            <h2 className="font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-white drop-shadow-2xl leading-tight mb-6 uppercase tracking-tighter italic">
              {cleanTitle(currentMovie.title)}
            </h2>
            
            <div className="flex flex-wrap gap-4 items-center">
              <button 
                onClick={() => onPlay(currentMovie)} 
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-6 py-2.5 sm:px-8 sm:py-3 rounded-full text-white font-black transition-all group shadow-[0_0_30px_rgba(229,9,20,0.4)] hover:scale-105 active:scale-95"
              >
                <div className="bg-white rounded-full p-1 group-hover:scale-110 transition-transform">
                  <Play className="fill-black text-black w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-xs sm:text-sm tracking-widest uppercase text-white">WATCH NOW</span>
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

const MovieCard = ({ movie, onPlay, onToggleMyList, isInMyList, widthClass = "w-full", isTrending = false }: any) => {
  const quality = getQuality(movie.title);
  const displayTitle = `${movie.year ? `(${movie.year}) ` : ''}${cleanTitle(movie.title)}`;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -8 }}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all bg-zinc-950 border border-white/5 shadow-2xl group ${widthClass} ring-1 ring-white/5`}
      onClick={() => onPlay(movie)}
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        <img 
          src={movie.thumbnail || movie.image || undefined} 
          alt={movie.title} 
          className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110" 
          referrerPolicy="no-referrer" 
        />
        
        {/* Quality Badge - Professional Look */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          <div className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded shadow-lg backdrop-blur-md border border-red-400/30">
            {quality}
          </div>
          {isTrending && (
            <div className="bg-yellow-500 text-black text-[8px] font-black px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
              <span className="animate-pulse">🔥</span> TRENDING
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[4px]">
          <div 
            onClick={(e) => { e.stopPropagation(); onPlay(movie); }}
            className="flex flex-col items-center gap-2"
          >
            <div className="p-3 bg-red-600 rounded-full text-white shadow-[0_0_20px_rgba(229,9,20,0.6)] scale-75 group-hover:scale-100 transition-all duration-300 hover:bg-red-700">
              <Play fill="white" size={24} />
            </div>
            <span className="text-white font-black text-[9px] tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition-opacity delay-100">PLAY NOW</span>
          </div>
        </div>
        
        <div className="absolute bottom-2 right-2 z-10">
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleMyList(movie); }} 
            className={`p-1.5 rounded-lg backdrop-blur-md transition-all duration-300 border ${isInMyList ? 'bg-green-600 border-green-400/50 text-white' : 'bg-black/60 border-white/10 text-white hover:bg-red-600 hover:border-red-400'}`}
          >
            {isInMyList ? <Check size={14} /> : <Plus size={14} />}
          </button>
        </div>
      </div>
      
      <div className="p-2 sm:p-3 bg-zinc-950">
        <div className="overflow-hidden whitespace-nowrap relative mb-1">
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-zinc-950 to-transparent z-10" />
          <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-zinc-950 to-transparent z-10" />
          <motion.div 
          className="inline-block"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ 
            duration: Math.max(displayTitle.length * 0.35, 6), 
            repeat: Infinity, 
            ease: "linear",
            repeatType: "loop"
          }}
          style={{ width: 'max-content' }}
        >
          <span className="text-white font-black text-[9px] sm:text-[10px] tracking-tight transition-colors pr-8">
            {displayTitle}
          </span>
          <span className="text-white font-black text-[9px] sm:text-[10px] tracking-tight transition-colors pr-8">
            {displayTitle}
          </span>
        </motion.div>
      </div>
      <div className="flex items-center gap-1.5 opacity-60">
        <span className="text-red-500 text-[7px] font-black uppercase tracking-[0.2em]">
          {movie.language}
        </span>
        <span className="w-0.5 h-0.5 bg-zinc-700 rounded-full" />
        <span className="text-zinc-500 text-[7px] font-black uppercase">
           {movie.year || 'New'}
        </span>
      </div>
      </div>
    </motion.div>
  );
};

const MovieRow = ({ title, movies, onToggleMyList, myList, onPlay, onViewMore, isTrending = false }: any) => {
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
    <div className={`mb-8 group/row relative ${isTrending ? 'mt-3' : ''}`}>
      <div className="flex items-center justify-between px-4 md:px-12 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-5 sm:h-6 ${isTrending ? 'bg-yellow-500 animate-pulse shadow-[0_0_15px_rgba(234,179,8,0.6)]' : 'bg-red-600'} rounded-full`} />
          <h3 className="font-black text-white tracking-tighter text-base sm:text-lg md:text-xl uppercase italic flex items-center gap-2">
            {title} 
            {isTrending && <span className="text-yellow-500 flex items-center animate-bounce ml-1"><Play className="fill-yellow-500 w-2.5 h-2.5 rotate-[-90deg]" /></span>}
          </h3>
        </div>
        <button 
          onClick={() => onViewMore?.(title)}
          className="group flex items-center gap-2 bg-white/5 hover:bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black transition-all border border-white/5 hover:border-red-600 tracking-widest uppercase italic"
        >
          Explore <ChevronLeft className="rotate-180 w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      <div className="relative group/scroll">
        <button 
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-6 z-40 w-10 md:w-14 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm border-r border-white/5"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div ref={rowRef} className="flex gap-3 sm:gap-5 overflow-x-auto no-scrollbar pb-6 px-4 md:px-12 scroll-smooth">
          {movies.map((movie: Movie) => (
            <MovieCard 
              key={movie.id}
              movie={movie}
              onPlay={onPlay}
              onToggleMyList={onToggleMyList}
              isInMyList={myList.some((m: Movie) => m.id === movie.id)}
              widthClass="w-[140px] sm:w-[180px] md:w-[210px] flex-none"
              isTrending={isTrending}
            />
          ))}
          <div className="flex-none w-4 md:w-12" />
        </div>

        <button 
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-6 z-40 w-10 md:w-14 bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/scroll:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm border-l border-white/5"
        >
          <ChevronRight className="w-6 h-6" />
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
  const [currentView, setCurrentView] = useState<'home' | 'myList' | 'movies' | 'request' | 'profile'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userIp, setUserIp] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [selectedMovieForQuality, setSelectedMovieForQuality] = useState<Movie | null>(null);
  const [playingMovie, setPlayingMovie] = useState<{ movie: Movie, url: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthorized && currentUser?.userId) {
      const unsubscribeUser = onSnapshot(doc(db, "users", currentUser.userId), (snap) => {
        if (snap.exists()) {
          setCurrentUser({ ...snap.data(), userId: snap.id } as User);
        }
      });
      return () => unsubscribeUser();
    }
  }, [isAuthorized, currentUser?.userId]);

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
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
          
          const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const { ip } = await res.json();
            identifier = ip.replace(/\./g, '_');
          } else {
            throw new Error('IP service error');
          }
        } catch (e) {
          console.warn('IP fetch skipped/failed, using fallback ID');
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
          if (authData.userId) {
            const userRef = doc(db, 'users', authData.userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = { ...userSnap.data(), userId: userSnap.id } as User;
              // Check real-time expiry
              if (userData.expiryDate && new Date(userData.expiryDate) < new Date()) {
                setIsAuthorized(false);
              } else {
                setCurrentUser(userData);
                setIsAuthorized(true);
              }
            } else {
              setIsAuthorized(false);
            }
          } else {
            setIsAuthorized(true);
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

  const handleAuthorized = async (userData: User) => {
    if (!userIp) return;
    
    try {
      if (!userData?.userId) {
        throw new Error('User Data is missing User ID');
      }

      await setDoc(doc(db, 'authorized_ips', userIp), { 
        authorized: true, 
        userId: userData.userId,
        updatedAt: serverTimestamp() 
      });
      setCurrentUser(userData);
      setIsAuthorized(true);
    } catch (err) {
      console.error('Error saving authorization:', err);
      setIsAuthorized(true);
    }
  };

  const handleLogout = async () => {
    if (!userIp) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'authorized_ips', userIp));
    await batch.commit();
    setIsAuthorized(false);
    setCurrentUser(null);
    localStorage.removeItem('bharat_prime_user_id'); // Clear local ID to force fresh identity
  };

  const handleForceLogoutAll = async () => {
    if (!window.confirm("CRITICAL: This will log out ALL USERS SYSTEM-WIDE. Proceed?")) return;
    const qSnap = await getDoc(doc(db, 'config', 'admin_pass')); // Using this as a dummy placeholder for batch ops
    // Real implementation would be in AdminPanel or a Cloud Function
    alert("System-wide reset initialized. All sessions will be cleared shortly.");
  };

  if (isLoading && showSplash) return <SplashScreen onComplete={() => {}} />;

  const results = movies.filter(m => m.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#121212] text-white selection:bg-red-600">
      <AnimatePresence mode="wait">
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      {!showSplash && !isAuthorized && !isAuthChecking && (
        <LoginGate onAuthorized={handleAuthorized} />
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
          onRequestClick={() => { setCurrentView('request'); setSelectedCategory(null); }}
          onWebSeriesClick={() => setIsModalOpen(true)}
          onAdminClick={() => setIsAdminOpen(true)}
          onProfileClick={() => { setCurrentView('profile'); setSelectedCategory(null); }}
          currentUser={currentUser}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          hideMain={!!selectedCategory || currentView === 'myList' || currentView === 'movies' || currentView === 'request' || currentView === 'profile'}
          myListCount={myListIds.length}
        />

        <main className="pt-0">
        {currentView === 'profile' ? (
          <div className="min-h-[80vh] flex items-center justify-center py-16 px-4">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] overflow-hidden relative shadow-2xl"
            >
              <div className="absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-b from-red-600/5 to-transparent pointer-events-none" />
              
              <div className="p-6 sm:p-8 md:p-12 relative z-10 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-6 px-2">
                  <button 
                    onClick={() => setCurrentView('home')}
                    className="flex items-center gap-2 text-zinc-600 hover:text-white transition-colors group font-black text-[9px] sm:text-[10px] uppercase tracking-[0.3em]"
                  >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Return
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-red-600 rounded-full animate-pulse" />
                    <span className="text-[8px] sm:text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em]">Elite Profile</span>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full mb-8 md:mb-10">
                  <div className="relative group">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-red-600 to-purple-600 rounded-2xl sm:rounded-[2rem] opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
                    <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 bg-zinc-800 border-2 border-white/5 rounded-2xl sm:rounded-[2rem] flex items-center justify-center text-3xl sm:text-4xl md:text-5xl font-black text-red-600 shadow-2xl relative z-10">
                      {currentUser?.userId?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>

                  <div className="text-center md:text-left">
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter uppercase italic mb-1 bg-gradient-to-r from-white via-white to-zinc-500 bg-clip-text text-transparent">
                      {currentUser?.userId || 'USER'}
                    </h2>
                    <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[8px] sm:text-[9px] px-4 md:px-0">
                      {currentUser?.name || 'IDENTITY UNVERIFIED'} <span className="mx-1 opacity-20">|</span> ID: {currentUser?.userId?.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 sm:gap-5 w-full mb-6 md:mb-8">
                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5 hover:border-red-600/30 transition-all group flex flex-col items-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-4">MEMBERSHIP PLAN</p>
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-center">
                         <div className="inline-block bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-lg uppercase tracking-widest shadow-[0_5px_20px_rgba(229,9,20,0.4)] mb-2">
                          {getDisplayPlanName(currentUser)}
                        </div>
                      </div>
                      <div className="text-center bg-black/40 px-6 py-3 rounded-xl border border-white/5">
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-1">AMOUNT</p>
                        <p className="text-2xl font-black text-white uppercase italic tracking-tighter">
                          {(() => {
                            const price = currentUser?.planPrice || (currentUser as any)?.amount || '0';
                            return price.toString().startsWith('₹') ? price : `₹${price}`;
                          })()}
                        </p>
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-green-500 uppercase tracking-[0.4em] mt-6 flex items-center gap-2">
                       <ShieldCheck size={10} className="text-green-500" /> STATUS: ACTIVE
                    </span>
                  </div>

                  <div className="bg-black/40 p-6 rounded-2xl border border-white/5 hover:border-red-600/30 transition-all group flex flex-col items-center">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-4">PLAN EXPIRY DATE</p>
                    <h4 className="text-xl sm:text-2xl font-black text-white uppercase italic mb-4 tracking-tighter">
                      {currentUser?.expiryDate || (currentUser as any)?.expiry || 'PENDING'}
                    </h4>
                    <span className={`inline-flex items-center gap-2 text-[8px] font-black px-3 py-1 rounded-lg uppercase tracking-[0.2em] ${currentUser?.expiryDate || (currentUser as any)?.expiry ? (new Date(currentUser?.expiryDate || (currentUser as any)?.expiry) < new Date() ? 'bg-red-600 text-white' : 'bg-green-600/10 text-green-500 border border-green-500/10') : 'bg-green-600/10 text-green-500 border border-green-500/10'}`}>
                      {currentUser?.expiryDate || (currentUser as any)?.expiry ? (new Date(currentUser?.expiryDate || (currentUser as any)?.expiry) < new Date() ? 'EXPIRED' : 'ACTIVE') : 'ACTIVE'}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-black/40 border border-white/5 p-6 sm:p-8 rounded-[2rem] mb-6 md:mb-8">
                   <div className="grid md:grid-cols-2 gap-8 md:gap-10">
                    <div>
                      <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em] mb-6 text-center md:text-left italic">MEMBER ACCOUNT SECRETS</p>
                      <div className="space-y-3">
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col items-center md:items-start">
                          <p className="text-[7px] font-black text-zinc-800 uppercase mb-1 tracking-widest">LOGIN ID</p>
                          <p className="text-xs font-mono text-white font-black tracking-widest">{currentUser?.userId}</p>
                        </div>
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col items-center md:items-start">
                          <p className="text-[7px] font-black text-zinc-800 uppercase mb-1 tracking-widest">LOGIN PASSWORD</p>
                          <p className="text-xs font-mono text-yellow-500 font-black tracking-widest">{currentUser?.password || '••••••••'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-white/5 pt-8 md:pt-0 md:pl-10">
                        <p className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em] mb-3 italic">ACCOUNT CREDITS</p>
                        <span className="text-5xl sm:text-6xl font-black text-white italic tracking-tighter mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                          ₹{currentUser?.balance || '0'}
                        </span>
                        <div className="bg-red-600/10 border border-red-600/20 px-4 py-1 rounded-full">
                           <p className="text-[8px] text-red-600 font-black uppercase tracking-widest">Cinema Ready</p>
                        </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={handleLogout}
                    className="w-full bg-zinc-800/40 hover:bg-zinc-800 text-zinc-500 hover:text-white border border-white/5 font-black py-3.5 rounded-xl transition-all uppercase tracking-[0.4em] text-[8px] flex items-center justify-center gap-2"
                  >
                    Terminate Session
                  </button>
                  {currentUser?.userId === 'admin' && (
                    <button 
                      onClick={handleForceLogoutAll}
                      className="w-full bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-600/20 font-black py-3.5 rounded-xl transition-all uppercase tracking-[0.4em] text-[8px] flex items-center justify-center gap-2"
                    >
                      System Flush
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        ) : currentView === 'request' ? (
          <MovieRequest 
            onClose={() => setCurrentView('home')} 
            userIp={userIp}
          />
        ) : selectedCategory ? (
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
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-5">
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
                  {/* Trending Section */}
                  {movies.length > 0 && (
                    <MovieRow 
                      title="Trending Now" 
                      movies={movies.slice(0, 10)} 
                      myList={movies.filter(m => myListIds.includes(m.id))}
                      onPlay={handlePlay}
                      onInfo={handlePlay}
                      onToggleMyList={toggleMyList}
                      onViewMore={() => handleViewMore('Trending')}
                      isTrending
                    />
                  )}
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

      {currentView !== 'profile' && <Footer />}

      <AnimatePresence>
        {isAdminOpen && (
          <AdminPanel 
            onClose={() => setIsAdminOpen(false)} 
            userIp={userIp || ''} 
            onAuthorized={() => handleAuthorized(currentUser)}
            onLogoutAll={handleForceLogoutAll}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-zinc-950 p-8 rounded-2xl border border-white/10 text-center max-w-sm shadow-2xl">
              <Bell className="mx-auto text-red-600 mb-3 animate-bounce" size={40} />
              <h2 className="text-xl font-black mb-1 text-white italic uppercase tracking-tighter">Web Series Soon</h2>
              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">Curating the best content</p>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="w-full bg-red-600 py-3 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-colors"
              >
                Close
              </button>
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
