import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, limit, getDocs, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Movie } from '../types';
import { 
  LayoutGrid, PlusCircle, ShieldCheck, Search, Pencil, Trash2, X, 
  Menu, Play, Trash, Check, Globe, Calendar, FileText,
  Clapperboard, ListVideo, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type ViewType = 'dashboard' | 'upload' | 'security';

export default function AdminPanel({ 
  onClose, 
  userIp, 
  onAuthorized 
}: { 
  onClose: () => void;
  userIp: string;
  onAuthorized: () => void;
}) {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Movie' | 'Series' | 'Banner'>('All');
  const [formData, setFormData] = useState({
    title: '',
    image: '',
    category: 'Movie',
    language: 'Kannada',
    links: [{ label: '720p', url: '' }]
  });
  const [movies, setMovies] = useState<Movie[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security State
  const [pin, setPin] = useState('');
  const [pinStatus, setPinStatus] = useState({ text: '● CHECKING SYSTEM...', color: '#888' });
  const [pinHistory, setPinHistory] = useState<any[]>([]);
  const [expiryWarning, setExpiryWarning] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "movies"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setMovies(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    checkPassStatus();
    const historyRef = collection(db, "config", "admin_pass", "history");
    const q = query(historyRef, orderBy("updatedAt", "desc"), limit(10));
    const unsubscribe = onSnapshot(q, (snap) => {
      const history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPinHistory(history);
    });
    return () => unsubscribe();
  }, []);

  const checkPassStatus = async () => {
    const snap = await getDoc(doc(db, "config", "admin_pass"));
    if (snap.exists()) {
      const data = snap.data();
      const now = new Date();
      const expiry = data.expiresAt ? data.expiresAt.toDate() : null;
      
      if (!data.value || data.value.trim() === "") {
        setPinStatus({ text: "● NO PIN SET", color: "#888" });
        setExpiryWarning(null);
      } else if (expiry && now > expiry) {
        setPinStatus({ text: "● SYSTEM PIN EXPIRED", color: "#ff4d4d" });
        setPin("");
        setExpiryWarning("System PIN has expired! Please update it immediately to maintain access.");
      } else {
        setPinStatus({ text: "● SYSTEM PIN ACTIVE", color: "#2ecc71" });
        setPin(data.value);
        
        // Check if expiring soon (less than 3 hours)
        if (expiry) {
          const diffMs = expiry.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours < 3) {
            const minutes = Math.round((diffHours % 1) * 60);
            const hours = Math.floor(diffHours);
            setExpiryWarning(`Warning: System PIN expires in ${hours}h ${minutes}m. Please update it soon.`);
          } else {
            setExpiryWarning(null);
          }
        }
      }
    } else {
      setPinStatus({ text: "● NO PIN SET", color: "#888" });
      setExpiryWarning(null);
    }
  };

  const handleSavePin = async () => {
    if (!pin) {
      toast.error("Please enter a PIN");
      return;
    }
    
    let expiry = new Date();
    expiry.setHours(7, 0, 0, 0);
    if (new Date() > expiry) expiry.setDate(expiry.getDate() + 1);
    
    try {
      await setDoc(doc(db, "config", "admin_pass"), { value: pin, expiresAt: expiry, updatedAt: serverTimestamp() });
      await addDoc(collection(db, "config", "admin_pass", "history"), { pin, updatedAt: serverTimestamp() });
      
      // Force logout all other users by clearing the authorized_ips collection
      // This ensures that when the PIN changes, everyone must re-enter the new PIN
      const sessionsRef = collection(db, "authorized_ips");
      const qSnap = await getDocs(sessionsRef);
      const batch = writeBatch(db);
      qSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();

      // Re-authorize the admin's current IP so they don't get asked for the PIN again
      if (onAuthorized) {
        onAuthorized();
      }
      
      toast.success("PIN Saved & All Sessions Reset");
      checkPassStatus();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleClearPinHistory = async () => {
    if (!window.confirm("Wipe all PIN history?")) return;
    try {
      const historyRef = collection(db, "config", "admin_pass", "history");
      const qSnap = await getDocs(historyRef);
      const batch = writeBatch(db);
      qSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast.info("History Cleared");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleClearAllSessions = async () => {
    if (!window.confirm("This will log out ALL users immediately. Continue?")) return;
    try {
      const sessionsRef = collection(db, "authorized_ips");
      const qSnap = await getDocs(sessionsRef);
      const batch = writeBatch(db);
      qSnap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      
      // Also clear local storage for the admin
      localStorage.removeItem('bharat_prime_authorized');
      localStorage.removeItem('bharat_prime_expiry');
      
      toast.success("All user sessions cleared!");
      // Re-authorize admin if they were already authorized
      if (onAuthorized) onAuthorized();
    } catch (error: any) {
      toast.error("Failed to clear sessions: " + error.message);
    }
  };

  const addLinkRow = () => {
    setFormData({
      ...formData,
      links: [...formData.links, { label: '', url: '' }]
    });
  };

  const removeLinkRow = (index: number) => {
    const newLinks = formData.links.filter((_, i) => i !== index);
    setFormData({ ...formData, links: newLinks.length > 0 ? newLinks : [{ label: '', url: '' }] });
  };

  const updateLink = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...formData.links];
    (newLinks[index] as any)[field] = value;
    setFormData({ ...formData, links: newLinks });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = formData.links.filter(l => l.url);

    if (!formData.title || !formData.image) {
      toast.error("Title and Image URL are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const dataToSave = {
        title: formData.title.trim(),
        image: formData.image.trim(),
        category: formData.category,
        language: formData.category === 'Banner' ? '' : formData.language,
        links: validLinks,
        updatedAt: serverTimestamp()
      };

      if (editId) {
        await updateDoc(doc(db, "movies", editId), dataToSave);
        toast.success("Database Updated");
      } else {
        await addDoc(collection(db, "movies"), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
        toast.success("Content Published!");
      }
      resetForm();
      setActiveView('dashboard');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepareEdit = (movie: any) => {
    setEditId(movie.id);
    setFormData({
      title: movie.title || '',
      image: movie.image || '',
      category: movie.category || 'Movie',
      language: movie.language || 'Kannada',
      links: movie.links && movie.links.length > 0 ? movie.links : [{ label: '720p', url: '' }]
    });
    setActiveView('upload');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this?")) {
      try {
        await deleteDoc(doc(db, "movies", id));
        toast.info("Content Deleted");
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      title: '',
      image: '',
      category: 'Movie',
      language: 'Kannada',
      links: [{ label: '720p', url: '' }]
    });
  };

  const filteredMovies = movies.filter(m => {
    const matchesSearch = m.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || m.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: movies.length,
    movies: movies.filter(m => m.category === 'Movie').length,
    series: movies.filter(m => m.category === 'Series').length,
    banners: movies.filter(m => m.category === 'Banner').length
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#0a0a0a] text-white font-sans flex overflow-hidden">
      <ToastContainer position="top-right" theme="dark" aria-label="Notifications" />
      
      {/* Sidebar */}
      <aside className={`bg-[#111] border-r border-[#222] transition-all duration-300 flex flex-col z-[510] ${isSidebarCollapsed ? 'w-0 -translate-x-full md:w-20 md:translate-x-0' : 'w-full md:w-[280px]'}`}>
        <div className="p-6 h-20 border-b border-[#222] flex items-center justify-between">
          {!isSidebarCollapsed && <span className="text-[#e50914] font-black text-xl tracking-wider">BHARAT PRIME</span>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg md:hidden">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => { setActiveView('dashboard'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-medium text-sm ${activeView === 'dashboard' ? 'bg-[#1f1f1f] text-white border-l-4 border-[#e50914]' : 'text-[#aaa] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <LayoutGrid size={20} />
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>
          <button 
            onClick={() => { setActiveView('upload'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-medium text-sm ${activeView === 'upload' ? 'bg-[#1f1f1f] text-white border-l-4 border-[#e50914]' : 'text-[#aaa] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <PlusCircle size={20} />
            {!isSidebarCollapsed && <span>Add Content</span>}
          </button>
          <button 
            onClick={() => { setActiveView('security'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-medium text-sm ${activeView === 'security' ? 'bg-[#1f1f1f] text-white border-l-4 border-[#e50914]' : 'text-[#aaa] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <ShieldCheck size={20} />
            {!isSidebarCollapsed && <span>Security Settings</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-[#222]">
          <button onClick={onClose} className="w-full flex items-center gap-3 p-4 rounded-xl text-[#aaa] hover:bg-red-600/10 hover:text-red-500 transition-all font-medium text-sm">
            <X size={20} />
            {!isSidebarCollapsed && <span>Close Admin</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          
          {/* Expiry Warning Banner */}
          <AnimatePresence>
            {expiryWarning && (
              <motion.div 
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="text-red-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-red-500 text-sm font-bold">{expiryWarning}</p>
                  </div>
                  <button 
                    onClick={() => setActiveView('security')}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-black px-4 py-2 rounded-lg transition-all uppercase tracking-widest"
                  >
                    Update Now
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 bg-[#1a1a1a] rounded-lg md:hidden">
                <Menu size={24} />
              </button>
              <div>
                <h5 className="text-[#888] text-xs font-black uppercase tracking-[0.2em] mb-1">Control Center</h5>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                  {activeView === 'dashboard' ? 'System Overview' : activeView === 'upload' ? 'Content Publisher' : 'Security Protocol'}
                </h2>
              </div>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555]" size={18} />
              <input 
                type="text" 
                placeholder="Search data..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#222] rounded-xl py-3 pl-12 pr-4 focus:border-[#e50914] outline-none transition-all text-sm"
              />
            </div>
          </header>

          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#222] p-8 md:p-12 rounded-[2rem] relative overflow-hidden">
                  <div className="relative z-10">
                    <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tighter">Welcome Back, Admin</h1>
                    <p className="text-[#888] font-medium">Your streaming platform control center is ready.</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl hover:border-[#e50914]/30 transition-colors group">
                        <h3 className="text-3xl font-black mb-1 group-hover:text-[#e50914] transition-colors">{stats.total}</h3>
                        <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">Total Content</span>
                      </div>
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl hover:border-red-500/30 transition-colors group">
                        <h3 className="text-3xl font-black mb-1 text-red-600">{stats.movies}</h3>
                        <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">Movies</span>
                      </div>
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl hover:border-blue-500/30 transition-colors group">
                        <h3 className="text-3xl font-black mb-1 text-blue-500">{stats.series}</h3>
                        <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">Series</span>
                      </div>
                      <div className="bg-[#111] border border-[#222] p-6 rounded-2xl hover:border-yellow-500/30 transition-colors group">
                        <h3 className="text-3xl font-black mb-1 text-yellow-500">{stats.banners}</h3>
                        <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">Banners</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#e50914]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>
              </motion.div>
            )}

            {activeView === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-[#141414] border border-[#222] p-8 rounded-[2rem] shadow-2xl"
              >
                <h4 className="text-xl font-black mb-8 flex items-center gap-3 italic">
                  <PlusCircle className="text-[#e50914]" /> {editId ? 'UPDATE CONTENT' : 'PUBLISH CONTENT'}
                </h4>
                
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-[#555] uppercase tracking-widest ml-1">Title</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-sm font-medium"
                        placeholder="Movie Name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#555] uppercase tracking-widest ml-1">Image URL</label>
                      <input 
                        type="text" 
                        value={formData.image}
                        onChange={e => setFormData({...formData, image: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-sm font-medium"
                        placeholder="https://..."
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#555] uppercase tracking-widest ml-1">Category</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-sm font-medium appearance-none"
                      >
                        <option value="Movie">Movie</option>
                        <option value="Series">Web Series</option>
                        <option value="Banner">Banner</option>
                      </select>
                    </div>

                    {formData.category !== 'Banner' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-[#555] uppercase tracking-widest ml-1">Language</label>
                        <select 
                          value={formData.language}
                          onChange={e => setFormData({...formData, language: e.target.value})}
                          className="w-full bg-[#1f1f1f] border border-[#333] rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-sm font-medium appearance-none"
                        >
                          <option value="Kannada">Kannada</option>
                          <option value="Telugu">Telugu</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Tamil">Tamil</option>
                          <option value="Malayalam">Malayalam</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#555] uppercase tracking-widest ml-1">Streaming Links</label>
                    <div className="space-y-3">
                      {formData.links.map((link, idx) => (
                        <div key={idx} className="flex gap-3">
                          <input 
                            type="text" 
                            value={link.label}
                            onChange={e => updateLink(idx, 'label', e.target.value)}
                            className="w-32 bg-[#1f1f1f] border border-[#333] rounded-xl py-3 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-bold"
                            placeholder="720p"
                          />
                          <input 
                            type="text" 
                            value={link.url}
                            onChange={e => updateLink(idx, 'url', e.target.value)}
                            className="flex-1 bg-[#1f1f1f] border border-[#333] rounded-xl py-3 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium"
                            placeholder="URL"
                          />
                          <button 
                            type="button"
                            onClick={() => removeLinkRow(idx)}
                            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      type="button" 
                      onClick={addLinkRow}
                      className="text-[10px] font-black text-[#888] hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      <PlusCircle size={14} /> Add Row
                    </button>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 bg-[#e50914] hover:bg-[#ff0f1a] disabled:bg-[#8b0000] text-white font-black py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(229,9,20,0.3)] active:scale-95 uppercase tracking-widest"
                    >
                      {isSubmitting ? 'PROCESSING...' : (editId ? 'UPDATE NOW' : 'PUBLISH NOW')}
                    </button>
                    {editId && (
                      <button 
                        type="button" 
                        onClick={resetForm}
                        className="px-10 bg-[#222] hover:bg-[#333] text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest"
                      >
                        DISCARD
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            )}

            {activeView === 'security' && (
              <motion.div 
                key="security"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-xl mx-auto"
              >
                <div className="bg-[#141414] border border-[#222] p-8 rounded-[2rem] shadow-2xl text-center">
                  <h4 className="text-xl font-black mb-8 flex items-center justify-center gap-3 italic">
                    <ShieldCheck className="text-[#e50914]" /> SYSTEM SECURITY
                  </h4>
                  
                  <div className="bg-[#111] border border-[#333] p-8 rounded-3xl space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-[#555] uppercase tracking-[0.3em]">Daily Pin</label>
                      <input 
                        type="text" 
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full bg-[#1f1f1f] border border-[#444] rounded-2xl py-5 text-center text-2xl font-black tracking-[0.5em] focus:border-[#e50914] outline-none transition-all"
                        placeholder="----"
                      />
                    </div>
                    
                    <button 
                      onClick={handleSavePin}
                      className="w-full bg-[#e50914] hover:bg-[#ff0f1a] text-white font-black py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(229,9,20,0.3)] active:scale-95 uppercase tracking-widest"
                    >
                      SAVE PIN
                    </button>
                    
                    <div className="py-3 rounded-xl bg-black text-[10px] font-black tracking-widest" style={{ color: pinStatus.color }}>
                      {pinStatus.text}
                    </div>
                  </div>

                  <div className="mt-10 bg-black border border-[#222] rounded-2xl overflow-hidden">
                    <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-b border-[#222]">
                      <span className="text-[10px] font-black text-[#888] uppercase tracking-widest">Pin Logs (Recent 10)</span>
                      <button onClick={handleClearPinHistory} className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest">Clear All</button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-4 space-y-3">
                      {pinHistory.length === 0 ? (
                        <div className="text-center text-[#444] py-8 text-xs font-bold uppercase tracking-widest">No logs available</div>
                      ) : (
                        pinHistory.map((log, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-[#111] last:border-0">
                            <span className="text-sm font-black tracking-widest">{log.pin}</span>
                            <span className="text-[10px] font-bold text-[#444] uppercase">
                              {log.updatedAt?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || "..."}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-10 bg-[#111] border border-[#222] p-8 rounded-3xl">
                    <h6 className="text-[10px] font-black text-[#555] uppercase tracking-[0.3em] mb-6">Session Management</h6>
                    <div className="space-y-4">
                      <button 
                        onClick={handleClearAllSessions}
                        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-red-600/10 text-red-600 hover:bg-red-600/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-red-600/20 shadow-lg active:scale-95"
                      >
                        <Trash2 size={18} /> Force Logout All Users
                      </button>
                      
                      <p className="mt-4 text-[10px] text-[#444] font-bold leading-relaxed text-center uppercase tracking-widest">
                        Note: Saving a new PIN <span className="text-red-600">automatically resets</span> all active user sessions.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Logs Section - Always visible at bottom */}
          <section className="mt-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h5 className="text-xl font-black italic flex items-center gap-3">
                <ListVideo className="text-[#e50914]" /> LIVE LOGS
              </h5>
              
              <div className="flex bg-[#111] p-1 rounded-xl border border-[#222] overflow-x-auto no-scrollbar">
                {['All', 'Movie', 'Series', 'Banner'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter as any)}
                    className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === filter ? 'bg-[#e50914] text-white shadow-lg' : 'text-[#555] hover:text-white'}`}
                  >
                    {filter === 'Series' ? 'Web Series' : filter === 'Banner' ? 'Banners' : filter === 'Movie' ? 'Movies' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-[2rem] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <tbody className="divide-y divide-[#1a1a1a]">
                    {filteredMovies.length === 0 ? (
                      <tr>
                        <td className="py-20 text-center text-[#444] font-black uppercase tracking-[0.3em]">No data found</td>
                      </tr>
                    ) : (
                      filteredMovies.map(movie => (
                        <tr key={movie.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="p-6 w-24">
                            <img 
                              src={movie.image} 
                              className="w-14 h-20 object-cover rounded-xl border border-[#333] shadow-lg group-hover:scale-105 transition-transform" 
                              alt="" 
                              referrerPolicy="no-referrer"
                              onError={(e: any) => e.target.src = 'https://via.placeholder.com/100x150?text=No+Img'}
                            />
                          </td>
                          <td className="p-6">
                            <div className="font-black text-lg tracking-tight mb-2 group-hover:text-[#e50914] transition-colors">{movie.title}</div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${movie.category === 'Banner' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : movie.category === 'Series' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-red-600/10 text-red-600 border border-red-600/20'}`}>
                                {movie.category}
                              </span>
                              {movie.language && (
                                <span className="text-[9px] font-black bg-[#1f1f1f] text-[#888] px-3 py-1 rounded-full uppercase tracking-widest border border-[#333]">
                                  {movie.language}
                                </span>
                              )}
                              <span className="text-[9px] font-black bg-[#1f1f1f] text-[#555] px-3 py-1 rounded-full uppercase tracking-widest border border-[#333]">
                                {movie.links?.length || 0} Links
                              </span>
                            </div>
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex gap-3 justify-end">
                              <button onClick={() => prepareEdit(movie)} className="p-3 bg-[#1a1a1a] text-blue-400 hover:bg-blue-400/10 rounded-xl transition-all active:scale-90 border border-[#222]">
                                <Pencil size={18} />
                              </button>
                              <button onClick={() => handleDelete(movie.id)} className="p-3 bg-[#1a1a1a] text-red-500 hover:bg-red-500/10 rounded-xl transition-all active:scale-90 border border-[#222]">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
