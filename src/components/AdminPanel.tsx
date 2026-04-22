import React, { useState, useEffect } from 'react';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, limit, getDocs, writeBatch 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Movie, User } from '../types';
import { 
  LayoutGrid, PlusCircle, ShieldCheck, Search, Pencil, Trash2, X, 
  Menu, Play, Trash, Check, Globe, Calendar, FileText,
  Clapperboard, ListVideo, AlertTriangle, BrainCircuit, TrendingDown, TrendingUp, Scan,
  CircleUser
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, ToastContainer } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Tesseract from 'tesseract.js';
import 'react-toastify/dist/ReactToastify.css';

type ViewType = 'dashboard' | 'upload' | 'users' | 'requests' | 'security' | 'registrations';

export default function AdminPanel({ 
  onClose, 
  userIp, 
  onAuthorized,
  onLogoutAll
}: { 
  onClose: () => void;
  userIp: string;
  onAuthorized: () => void;
  onLogoutAll: () => void;
}) {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [userEditId, setUserEditId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Movie' | 'Series' | 'Banner'>('All');
  const [formData, setFormData] = useState({
    title: '',
    year: '',
    quality: 'HD',
    image: '',
    category: 'Movie',
    language: 'Kannada',
    links: [{ label: '720p', url: '' }]
  });

  const [userFormData, setUserFormData] = useState({
    userId: '',
    password: '',
    name: '',
    planName: 'Weekly (19 RS)',
    planPrice: '₹19',
    startDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    trxId: '',
    features: ['HD', 'Unlimited Movies']
  });
  const [isRenewalMode, setIsRenewalMode] = useState(false);

  const [movies, setMovies] = useState<Movie[]>([]);
  const [movieRequests, setMovieRequests] = useState<any[]>([]);
  const [memberRequests, setMemberRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUserSubmitting, setIsUserSubmitting] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  // Financial Stats State
  const [financeStats, setFinanceStats] = useState({
    revenue: 0,
    expenses: 1500, // Monthly Operating Cost
    breakdown: [
      { name: '90-Days', value: 0, color: '#2ecc71' },
      { name: 'Monthly', value: 0, color: '#2ecc71' },
      { name: 'Weekly', value: 0, color: '#2ecc71' },
      { name: 'Cost', value: -1500, color: '#e50914' }
    ]
  });

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
    const q = query(collection(db, "movieRequests"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMovieRequests(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
      calculateFinance(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "registrationRequests"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMemberRequests(list);
    });
    return () => unsubscribe();
  }, []);

  const calculateFinance = (userList: any[]) => {
    let rev = 0;
    let p90 = 0;
    let pMonth = 0;
    let pWeek = 0;
    const expenses = 1500;

    userList.forEach(u => {
      const amtPaid = parseFloat(u.amount || u.planPrice?.replace(/[^0-9.]/g, '') || '0');
      const plan = (u.planName || u.plan || "").toLowerCase();
      
      // Strict matching logic from template
      const isMatched = (plan.includes("149") && amtPaid === 149) || 
                        (plan.includes("55") && amtPaid === 55) || 
                        (plan.includes("19") && amtPaid === 19);

      if (isMatched) {
        if (plan.includes('90')) p90 += amtPaid;
        else if (plan.includes('monthly') || plan.includes('55')) pMonth += amtPaid;
        else pWeek += amtPaid;
        rev += amtPaid;
      }
    });

    setFinanceStats({
      revenue: rev,
      expenses,
      breakdown: [
        { name: 'Matched Rev', value: rev, color: '#2ecc71' },
        { name: 'Fixed Costs', value: -expenses, color: '#e50914' }
      ]
    });
  };

  const handleOcrScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrLoading(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      // Basic extraction logic matching the template
      const trxMatch = text.match(/(?:Txn|ID|Ref|UPI)[:\s]*([A-Z0-9]+)/i) || text.match(/[0-9]{12}/);
      const amtMatch = text.match(/(?:RS|Rs|INR|Total|Paid)[:\s]*([0-9,.]+)/i);

      if (amtMatch) {
        const val = parseFloat(amtMatch[1].replace(/,/g, ''));
        let plan = 'Basic';
        let expiry = '';
        const today = new Date();
        
        if (val >= 149) {
          plan = 'Ultimate';
          today.setDate(today.getDate() + 90);
        } else if (val >= 55) {
          plan = 'Premium';
          today.setDate(today.getDate() + 30);
        } else {
          plan = 'Basic';
          today.setDate(today.getDate() + 7);
        }
        
        expiry = today.toISOString().split('T')[0];
        
        setUserFormData(prev => ({
          ...prev,
          planPrice: `₹${val}`,
          planName: plan,
          expiryDate: expiry
        }));
      }

      toast.info("Receipt Scanned Successfully");
    } catch (error) {
      toast.error("OCR Failed: Could not process image");
    } finally {
      setIsOcrLoading(false);
    }
  };

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
      
      if (!data.value || data.value.trim() === "") {
        setPinStatus({ text: "● NO PIN SET", color: "#888" });
        setExpiryWarning(null);
      } else {
        setPinStatus({ text: "● SYSTEM PIN ACTIVE", color: "#2ecc71" });
        setPin(data.value);
        setExpiryWarning(null);
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
    
    try {
      await setDoc(doc(db, "config", "admin_pass"), { value: pin, updatedAt: serverTimestamp() });
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

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.userId || !userFormData.password) {
      toast.error("User ID and Password are required");
      return;
    }

    setIsUserSubmitting(true);
    try {
      const dataToSave = {
        userId: userFormData.userId.trim(),
        password: userFormData.password.trim(),
        name: userFormData.name.trim(),
        planName: userFormData.planName,
        planPrice: userFormData.planPrice,
        startDate: userFormData.startDate,
        expiryDate: userFormData.expiryDate,
        trxId: userFormData.trxId.trim(),
        features: userFormData.features.split(',').map(f => f.trim()).filter(f => f),
        updatedAt: serverTimestamp()
      };

      if (userEditId) {
        await updateDoc(doc(db, "users", userEditId), dataToSave);
        toast.success("User Updated");
      } else {
        await setDoc(doc(db, "users", userFormData.userId.trim()), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
        toast.success("User Created");
      }
      resetUserForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUserSubmitting(false);
    }
  };

  const prepareUserEdit = (user: any) => {
    setUserEditId(user.id);
    setUserFormData({
      userId: user.userId || '',
      password: user.password || '',
      name: user.name || '',
      planName: user.planName || 'Weekly (19 RS)',
      planPrice: user.planPrice || '₹19',
      startDate: user.startDate || new Date().toISOString().split('T')[0],
      expiryDate: user.expiryDate || '',
      trxId: user.trxId || '',
      features: Array.isArray(user.features) ? user.features.join(', ') : ''
    });
  };

  const resetUserForm = () => {
    setUserEditId(null);
    setUserFormData({
      userId: '',
      password: '',
      name: '',
      planName: 'Weekly (19 RS)',
      planPrice: '₹19',
      startDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      trxId: '',
      features: 'HD, Unlimited Movies'
    });
  };

  const handleUserDelete = async (id: string) => {
    if (window.confirm("Delete this user?")) {
      try {
        await deleteDoc(doc(db, "users", id));
        toast.info("User Deleted");
      } catch (error: any) {
        toast.error(error.message);
      }
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
        year: formData.year.trim(),
        quality: formData.quality,
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
      year: movie.year || '',
      quality: movie.quality || 'HD',
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

  const handleSolveRequest = async (id: string) => {
    try {
      await updateDoc(doc(db, "movieRequests", id), { status: 'solved' });
      toast.success("Marked as Solved");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (window.confirm("Reject and delete this request?")) {
      try {
        await deleteDoc(doc(db, "movieRequests", id));
        toast.info("Request Removed");
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  const handleClearSolvedRequests = async () => {
    if (!window.confirm("Clear all solved requests?")) return;
    try {
      const solved = movieRequests.filter(r => r.status === 'solved');
      const batch = writeBatch(db);
      solved.forEach(r => batch.delete(doc(db, "movieRequests", r.id)));
      await batch.commit();
      toast.info("Solved Requests Cleared");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setEditId(null);
    setFormData({
      title: '',
      year: '',
      quality: 'HD',
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

  useEffect(() => {
    // Auto Cleanup logic
    const today = new Date().toISOString().split('T')[0];
    const expiredUsers = users.filter(u => u.expiryDate && u.expiryDate < today);
    if (expiredUsers.length > 0) {
      expiredUsers.forEach(async (u) => {
        try {
          await deleteDoc(doc(db, "users", u.userId));
        } catch (error) {
          console.error("Error auto-cleaning user:", u.userId, error);
        }
      });
    }
  }, [users]);

  const stats = {
    total: movies.length,
    movies: movies.filter(m => m.category === 'Movie').length,
    series: movies.filter(m => m.category === 'Series').length,
    banners: movies.filter(m => m.category === 'Banner').length,
    pendingRequests: movieRequests.filter(r => r.status === 'pending').length,
    totalUsers: users.length
  };

  const handleApproveRegistration = async (req: any) => {
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, "users", req.userId);
      const reqRef = doc(db, "registrationRequests", req.id);
      
      batch.set(userRef, {
        name: req.name,
        password: req.password,
        planName: 'BASIC',
        planPrice: '₹0',
        startDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day trial
        createdAt: serverTimestamp(),
        isActive: true
      });
      
      batch.delete(reqRef);
      await batch.commit();
      toast.success(`Account approved for ${req.userId}`);
    } catch (err) {
      console.error(err);
      toast.error("Approval failed");
    }
  };

  const handleRejectRegistration = async (id: string) => {
    try {
      await deleteDoc(doc(db, "registrationRequests", id));
      toast.info("Request rejected");
    } catch (err) {
      console.error(err);
      toast.error("Rejection failed");
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#121212] text-white font-sans flex overflow-hidden">
      <ToastContainer position="top-right" theme="dark" aria-label="Notifications" />
      
      {/* Sidebar */}
      <aside className={`bg-[#0d0d0d] border-r border-[#222] transition-all duration-300 flex flex-col z-[510] ${isSidebarCollapsed ? 'w-0 -translate-x-full md:w-20 md:translate-x-0' : 'w-full md:w-[280px]'}`}>
        <div className="p-4 h-16 border-b border-[#222] flex items-center justify-between">
          {!isSidebarCollapsed && <span className="text-[#e50914] font-black text-sm tracking-widest italic">BHARAT PRIME | ELITE</span>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg md:hidden">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          <button 
            onClick={() => { setActiveView('dashboard'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest ${activeView === 'dashboard' ? 'bg-[#1f1f1f] text-white border-l-2 border-[#e50914]' : 'text-[#555] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <LayoutGrid size={16} />
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>
          <button 
            onClick={() => { setActiveView('upload'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest ${activeView === 'upload' ? 'bg-[#1f1f1f] text-white border-l-2 border-[#e50914]' : 'text-[#555] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <PlusCircle size={16} />
            {!isSidebarCollapsed && <span>Add Content</span>}
          </button>
          <button 
            onClick={() => { setActiveView('users'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest ${activeView === 'users' ? 'bg-[#1f1f1f] text-white border-l-2 border-[#e50914]' : 'text-[#555] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <ShieldCheck size={16} />
            {!isSidebarCollapsed && <span>Members</span>}
          </button>
          <button 
            onClick={() => { setActiveView('registrations'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest ${activeView === 'registrations' ? 'bg-[#1f1f1f] text-white border-l-2 border-[#e50914]' : 'text-[#555] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <div className="flex items-center gap-3">
              <CircleUser size={16} />
              {!isSidebarCollapsed && <span>Member Requests</span>}
            </div>
            {!isSidebarCollapsed && memberRequests.length > 0 && (
              <span className="bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                {memberRequests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setActiveView('requests'); if(window.innerWidth < 768) setIsSidebarCollapsed(true); }}
            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest ${activeView === 'requests' ? 'bg-[#1f1f1f] text-white border-l-2 border-[#e50914]' : 'text-[#555] hover:bg-[#1f1f1f] hover:text-white'}`}
          >
            <div className="flex items-center gap-3">
              <FileText size={16} />
              {!isSidebarCollapsed && <span>User Requests</span>}
            </div>
            {!isSidebarCollapsed && stats.pendingRequests > 0 && (
              <span className="bg-[#e50914] text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
                {stats.pendingRequests}
              </span>
            )}
          </button>
        </nav>

        <div className="p-3 border-t border-[#222]">
          <button onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-lg text-[#444] hover:bg-red-600/10 hover:text-red-500 transition-all font-black text-[9px] uppercase tracking-widest">
            <X size={16} />
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
              <button 
                onClick={() => setIsSidebarCollapsed(false)} 
                className="p-3 bg-[#1a1a1a] border border-[#222] rounded-xl md:hidden text-white hover:bg-red-600/10 transition-all"
              >
                <Menu size={20} />
              </button>
              <div>
                <h5 className="text-[#888] text-[10px] font-black uppercase tracking-[0.3em] mb-1">Control Center</h5>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                  {activeView === 'dashboard' ? 'Overview' : activeView === 'upload' ? 'Publish Content' : activeView === 'users' ? 'Member Access' : 'Inbound Requests'}
                </h2>
              </div>
            </div>
            
            <div className="relative w-full md:w-96 group">
              <i className="absolute left-5 top-1/2 -translate-y-1/2 text-[#555] group-focus-within:text-[#e50914] transition-colors">
                <Search size={18} />
              </i>
              <input 
                type="text" 
                placeholder="Search across all database..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-2xl py-4 pl-14 pr-6 focus:border-[#e50914] focus:bg-[#1a1a1a] outline-none transition-all text-sm font-bold shadow-2xl"
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
                <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#222] p-8 rounded-[1.5rem] relative overflow-hidden shadow-2xl">
                  <div className="relative z-10">
                    <h1 className="text-3xl font-black mb-1 uppercase tracking-tighter italic drop-shadow-2xl">Elite Control</h1>
                    <p className="text-[#444] font-black text-[9px] uppercase tracking-[0.4em] mb-10">System Management & Financial Logic.</p>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl hover:border-white/10 transition-all group shadow-2xl">
                        <h3 className="text-2xl font-black mb-1 group-hover:text-white transition-colors">{stats.total}</h3>
                        <span className="text-[8px] font-black text-[#444] uppercase tracking-[0.3em] group-hover:text-[#666]">TOTAL ASSETS</span>
                      </div>
                      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl hover:border-green-600/30 transition-all group shadow-2xl">
                        <h3 className="text-2xl font-black mb-1 text-green-500">{stats.totalUsers}</h3>
                        <span className="text-[8px] font-black text-[#444] uppercase tracking-[0.3em] group-hover:text-[#666]">ACTIVE MEMBERS</span>
                      </div>
                      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl hover:border-yellow-500/30 transition-all group shadow-2xl">
                        <h3 className="text-2xl font-black mb-1 text-yellow-500">{stats.pendingRequests}</h3>
                        <span className="text-[8px] font-black text-[#444] uppercase tracking-[0.3em] group-hover:text-[#666]">PENDING REQS</span>
                      </div>
                      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-2xl hover:border-red-600/30 transition-all group shadow-2xl">
                        <h3 className="text-2xl font-black mb-1 text-[#e50914]">{stats.movies}</h3>
                        <span className="text-[8px] font-black text-[#444] uppercase tracking-[0.3em] group-hover:text-[#666]">MOVIE ASSETS</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#e50914]/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
                </div>

                <div className="bg-[#111] border border-[#222] p-8 md:p-10 rounded-[2rem] shadow-2xl">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-10">
                    <div>
                      <h4 className="text-xl font-black uppercase italic tracking-tighter">Financial Analytics</h4>
                      <p className="text-[10px] font-black text-[#555] uppercase tracking-widest mt-1">Real-time revenue matching logic</p>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-[#555] uppercase tracking-widest mb-1">Total Revenue</p>
                        <h4 className="text-2xl font-black text-green-500">₹{financeStats.revenue}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-[#555] uppercase tracking-widest mb-1">Total Expenses</p>
                        <h4 className="text-2xl font-black text-red-600">₹{financeStats.expenses}</h4>
                      </div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financeStats.breakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#555" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                            tick={{ fontWeight: 800, textTransform: 'uppercase' }}
                          />
                          <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} tick={{ fontWeight: 800 }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px' }}
                            itemStyle={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}
                            cursor={{ fill: '#ffffff05' }}
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                            {financeStats.breakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-[#1a1a1a] border-l-4 border-blue-500 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-4">
                          <BrainCircuit size={20} className="text-blue-500" />
                          <h6 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">AI Financial Advisor</h6>
                        </div>
                        <p className="text-xs text-[#888] font-bold leading-relaxed">
                          {financeStats.revenue - financeStats.expenses > 0 
                            ? "Revenue successfully exceeds current operating costs. Scalability is healthy. Consider upgrading server bandwidth for growing user base."
                            : "System operating at deficit. Focus on membership retention and standardizing Ultimate Plan upgrades to cover ₹1500 monthly costs."}
                        </p>
                      </div>

                      <div className={`bg-[#1a1a1a] border border-[#222] p-6 rounded-2xl ${financeStats.revenue - financeStats.expenses > 0 ? 'border-green-600/30' : 'border-red-600/30'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          {financeStats.revenue - financeStats.expenses > 0 
                            ? <TrendingUp size={24} className="text-green-500" />
                            : <TrendingDown size={24} className="text-red-500" />
                          }
                          <h6 className="text-[10px] font-black uppercase tracking-widest text-[#555]">Business Status</h6>
                        </div>
                        <h4 className={`text-2xl font-black mb-2 ${financeStats.revenue - financeStats.expenses > 0 ? 'text-green-500' : 'text-red-600'}`}>
                          {financeStats.revenue - financeStats.expenses > 0 ? 'NET PROFIT' : 'FINANCIAL DEFICIT'}
                        </h4>
                        <p className="text-[10px] font-black text-[#444] uppercase tracking-widest">
                          Matched Balance: {Math.abs(financeStats.revenue - financeStats.expenses)} RS
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#141414] border border-[#222] p-5 rounded-2xl shadow-2xl"
              >
                <h4 className="text-sm font-black mb-5 flex items-center gap-3 italic">
                  <PlusCircle className="text-[#e50914]" size={18} /> {editId ? 'UPDATE CONTENT' : 'PUBLISH CONTENT'}
                </h4>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Title</label>
                      <input 
                        type="text" 
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium"
                        placeholder="Movie Name"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Print Quality</label>
                      <select 
                        value={formData.quality}
                        onChange={e => setFormData({...formData, quality: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium appearance-none"
                      >
                        <option value="HD">HD</option>
                        <option value="HQ">HQ</option>
                        <option value="HDTC">HDTC</option>
                        <option value="HDTS">HDTS</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Release Year</label>
                      <input 
                        type="text" 
                        value={formData.year}
                        onChange={e => setFormData({...formData, year: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium"
                        placeholder="Ex: 2026"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Image URL</label>
                      <input 
                        type="text" 
                        value={formData.image}
                        onChange={e => setFormData({...formData, image: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium"
                        placeholder="https://..."
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Category</label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full bg-[#1f1f1f] border border-[#333] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-medium appearance-none"
                      >
                        <option value="Movie">Movie</option>
                        <option value="Series">Web Series</option>
                        <option value="Banner">Banner</option>
                      </select>
                    </div>

                      {formData.category !== 'Banner' && (
                        <div className="space-y-1.5 lg:col-span-3">
                          <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Audio Language</label>
                          <select 
                            value={formData.language}
                            onChange={e => setFormData({...formData, language: e.target.value})}
                            className="w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-[#e50914] outline-none transition-all text-xs font-bold appearance-none"
                          >
                            <option value="Kannada">Kannada</option>
                            <option value="Tamil">Tamil</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Hindi">Hindi</option>
                            <option value="Malayalam">Malayalam</option>
                            <option value="English">English</option>
                            <option value="Multi">Multi-Audio</option>
                          </select>
                        </div>
                      )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Streaming Links</label>
                    <div className="space-y-2">
                      {formData.links.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input 
                            type="text" 
                            value={link.label}
                            onChange={e => updateLink(idx, 'label', e.target.value)}
                            className="w-24 bg-[#1f1f1f] border border-[#333] rounded-lg py-2 px-3 focus:border-[#e50914] outline-none transition-all text-[10px] font-bold"
                            placeholder="720p"
                          />
                          <input 
                            type="text" 
                            value={link.url}
                            onChange={e => updateLink(idx, 'url', e.target.value)}
                            className="flex-1 bg-[#1f1f1f] border border-[#333] rounded-lg py-2 px-3 focus:border-[#e50914] outline-none transition-all text-[10px] font-medium"
                            placeholder="URL"
                          />
                          <button 
                            type="button"
                            onClick={() => removeLinkRow(idx)}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button 
                      type="button" 
                      onClick={addLinkRow}
                      className="text-[9px] font-black text-[#888] hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
                    >
                      <PlusCircle size={12} /> Add Row
                    </button>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="flex-1 bg-[#e50914] hover:bg-[#ff0f1a] disabled:bg-[#8b0000] text-white font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(229,9,20,0.3)] active:scale-95 uppercase tracking-widest text-xs"
                    >
                      {isSubmitting ? 'PROCESSING...' : (editId ? 'UPDATE NOW' : 'PUBLISH NOW')}
                    </button>
                    {editId && (
                      <button 
                        type="button" 
                        onClick={resetForm}
                        className="px-8 bg-[#222] hover:bg-[#333] text-white font-black rounded-xl transition-all active:scale-95 uppercase tracking-widest text-xs"
                      >
                        DISCARD
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            )}

            {activeView === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* User Form */}
                <div className="bg-[#141414] border border-[#222] p-5 rounded-2xl shadow-2xl">
                  <div className="flex justify-between items-center mb-5">
                    <h4 className="text-sm font-black flex items-center gap-3 italic text-purple-500 tracking-tighter uppercase">
                      <ShieldCheck size={18} /> {userEditId ? 'UPDATE USER ACCOUNT' : 'MEMBER REGISTRATION'}
                    </h4>
                    {!userEditId && (
                      <button 
                        type="button"
                        onClick={() => setUserFormData({...userFormData, password: Math.random().toString(36).slice(-8).toUpperCase()})}
                        className="text-[9px] font-black text-[#888] hover:text-white uppercase tracking-widest transition-colors flex items-center gap-2"
                      >
                        <PlusCircle size={12} /> Auto-Generate Pass
                      </button>
                    )}
                  </div>
                  
                  <form onSubmit={handleUserSubmit} className="space-y-5">
                    <div className="grid md:grid-cols-3 gap-5">
                      {!userEditId && (
                        <div className="md:col-span-1">
                          <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1 mb-1.5 block">Scan Receipt (OCR)</label>
                          <div className="relative">
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleOcrScan}
                              className="hidden" 
                              id="receipt-upload"
                            />
                            <label 
                              htmlFor="receipt-upload"
                              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[#333] hover:border-blue-500/50 rounded-xl cursor-pointer transition-all bg-[#1a1a1a]/50 group h-[80px]"
                            >
                              {isOcrLoading ? (
                                <div className="flex flex-col items-center gap-1 text-blue-500 animate-pulse">
                                  <Scan size={16} className="animate-spin" />
                                  <span className="text-[8px] font-black uppercase tracking-widest">SCANNING...</span>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <Scan size={16} className="text-[#444] group-hover:text-blue-500 transition-colors" />
                                  <span className="text-[8px] font-black text-[#444] group-hover:text-white transition-colors uppercase tracking-widest text-center px-4">UPLOAD</span>
                                </div>
                              )}
                            </label>
                          </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Transaction ID</label>
                      <input 
                        type="text" 
                        value={userFormData.trxId}
                        onChange={e => setUserFormData({...userFormData, trxId: e.target.value})}
                        className={`w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold ${!userEditId ? 'h-[80px]' : ''}`}
                        placeholder="EX: BP_99..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Amount Paid</label>
                      <input 
                        type="number" 
                        value={userFormData.planPrice.replace(/[^0-9]/g, '')}
                        onChange={e => {
                          const val = e.target.value;
                          let plan = 'Weekly (19 RS)';
                          if(val === '149') plan = '90 Days (149 RS)';
                          else if(val === '55') plan = 'Monthly (55 RS)';
                          
                          setUserFormData({...userFormData, planPrice: `₹${val}`, planName: plan});
                        }}
                        className={`w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold ${!userEditId ? 'h-[80px]' : ''}`}
                        placeholder="149"
                      />
                    </div>

                      {/* Credentials Row */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">User ID</label>
                        <input 
                          type="text" 
                          value={userFormData.userId}
                          onChange={e => {
                            const id = e.target.value;
                            setUserFormData({...userFormData, userId: id});
                            const existingUser = users.find(u => u.userId === id);
                            if (existingUser) {
                              setIsRenewalMode(true);
                              setUserFormData({
                                ...userFormData,
                                userId: id,
                                name: existingUser.name || '',
                                password: existingUser.password || '',
                                startDate: new Date().toISOString().split('T')[0]
                              });
                            } else {
                              setIsRenewalMode(false);
                            }
                          }}
                          className={`w-full bg-[#111] border ${isRenewalMode ? 'border-blue-500' : 'border-[#222]'} rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold`}
                          placeholder="bp_user_123"
                          disabled={!!userEditId}
                        />
                        {isRenewalMode && (
                          <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-2 animate-pulse flex items-center gap-1">
                            <ShieldCheck size={12} /> ⚡ Existing User detected: Renewal Mode
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                          type="text" 
                          value={userFormData.name}
                          onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                          className="w-full bg-[#111] border border-[#222] rounded-xl py-4 px-5 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                          placeholder="MEMBER NAME"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Password</label>
                        <input 
                          type="text" 
                          value={userFormData.password}
                          onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                          className="w-full bg-[#111] border border-[#222] rounded-xl py-4 px-5 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                          placeholder="GENERATED"
                        />
                      </div>

                      {/* Plan Logic */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Subscription Plan</label>
                        <select 
                          value={userFormData.planName}
                          onChange={e => {
                            const val = e.target.value;
                            let price = '₹19';
                            let days = 7;
                            if (val === 'Monthly (55 RS)') { price = '₹55'; days = 30; }
                            if (val === '90 Days (149 RS)') { price = '₹149'; days = 90; }
                            
                            const expiry = new Date(new Date(userFormData.startDate).getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            setUserFormData({...userFormData, planName: val, planPrice: price, expiryDate: expiry});
                          }}
                          className="w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold appearance-none"
                        >
                          <option value="Weekly (19 RS)">Weekly (19 RS)</option>
                          <option value="Monthly (55 RS)">Monthly (55 RS)</option>
                          <option value="90 Days (149 RS)">90 Days (149 RS)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Start Date</label>
                        <input 
                          type="date" 
                          value={userFormData.startDate}
                          onChange={e => {
                            const start = e.target.value;
                            let days = 7;
                            if (userFormData.planName === 'Monthly (55 RS)') days = 30;
                            if (userFormData.planName === '90 Days (149 RS)') days = 90;
                            const expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                            setUserFormData({...userFormData, startDate: start, expiryDate: expiry});
                          }}
                          className="w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-[#555] uppercase tracking-widest ml-1">Expiry Date</label>
                        <input 
                          type="date" 
                          value={userFormData.expiryDate}
                          onChange={e => setUserFormData({...userFormData, expiryDate: e.target.value})}
                          className="w-full bg-[#111] border border-[#222] rounded-lg py-2.5 px-4 focus:border-blue-500 outline-none transition-all text-xs font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button 
                        type="submit" 
                        disabled={isUserSubmitting}
                        className="flex-1 bg-[#e50914] hover:bg-[#ff0f1a] disabled:bg-[#8b0000] text-white font-black py-5 rounded-2xl transition-all uppercase tracking-widest shadow-[0_0_30px_rgba(229,9,20,0.3)] active:scale-95"
                      >
                        {isUserSubmitting ? 'SYNCING...' : (userEditId ? 'UPDATE ACCOUNT' : 'SYNC TO CLOUD')}
                      </button>
                      <button 
                        type="button" 
                        onClick={resetUserForm}
                        className="px-10 bg-[#222] hover:bg-[#333] text-white font-black rounded-2xl transition-all active:scale-95 uppercase tracking-widest"
                      >
                        RESET
                      </button>
                    </div>
                  </form>
                </div>

                {/* User Table */}
                <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden shadow-2xl">
                  <div className="p-4 border-b border-[#222] flex justify-between items-center bg-zinc-900/50">
                    <h5 className="font-black text-[9px] uppercase tracking-[0.4em] text-[#e50914]">SYSTEM IDENTITY DATABASE</h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-black/40 text-[8px] font-black uppercase tracking-[0.3em] text-[#555]">
                        <tr>
                          <th className="p-4">Name</th>
                          <th className="p-4">ID</th>
                          <th className="p-4">Pass</th>
                          <th className="p-4 text-center">Plan</th>
                          <th className="p-4 text-center">Price</th>
                          <th className="p-4">Start</th>
                          <th className="p-4">Expiry</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#222]">
                        {users.map(user => (
                          <tr key={user.id} className="group hover:bg-white/[0.02] transition-colors border-b border-[#1a1a1a]">
                            <td className="p-4 font-bold text-white uppercase italic tracking-tighter text-[10px]">{user.name || 'GUEST USER'}</td>
                            <td className="p-4"><code className="text-[#3498db] text-[10px] font-bold uppercase">{user.userId}</code></td>
                            <td className="p-4"><code className="text-[#f1c40f] text-[10px] font-bold uppercase">{user.password || '---'}</code></td>
                            <td className="p-4 text-center">
                              <span className="bg-[#e50914] text-white text-[8px] font-black px-2 py-1 rounded uppercase tracking-tighter shadow-xl">
                                {user.planName || user.plan || 'BASIC'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-white font-black text-[10px]">{user.planPrice || '---'}</span>
                            </td>
                            <td className="p-4 text-[#888] text-[9px] font-bold">{user.startDate || 'N/A'}</td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter w-fit mb-1 ${user.expiryDate && new Date(user.expiryDate) < new Date() ? 'bg-red-600 text-white' : 'bg-green-600/10 text-green-500'}`}>
                                  {user.expiryDate && new Date(user.expiryDate) < new Date() ? 'EXPIRED' : 'ACTIVE'}
                                </span>
                                <span className="text-white font-black text-[9px] uppercase tracking-tighter italic">{user.expiryDate || user.expiry || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => prepareUserEdit(user)} className="p-1.5 text-[#3498db] hover:bg-[#3498db]/10 rounded-lg transition-all">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={() => handleUserDelete(user.id)} className="p-1.5 text-[#e50914] hover:bg-[#e50914]/10 rounded-lg transition-all">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'registrations' && (
              <motion.div 
                key="registrations"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h4 className="text-sm font-black italic flex items-center gap-3 uppercase tracking-widest text-[#e50914]">
                    <CircleUser size={18} /> MEMBER APPROVAL CENTER
                  </h4>
                </div>

                <div className="grid gap-3">
                  {memberRequests.length === 0 ? (
                    <div className="bg-[#111] border border-[#222] p-12 rounded-2xl text-center text-[#444] font-black uppercase tracking-[0.4em] text-[10px]">
                      No Pending Account Requests
                    </div>
                  ) : (
                    memberRequests.map((req) => (
                      <div 
                        key={req.id} 
                        className="bg-[#0d0d0d] border border-[#222] p-5 rounded-2xl transition-all hover:border-white/10 group shadow-lg"
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-5">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest">Candidate:</span>
                              <h5 className="text-[14px] font-black text-white uppercase italic tracking-tighter">{req.name}</h5>
                            </div>
                            <div className="flex flex-wrap gap-4 pt-2">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-1">Proposed ID</span>
                                <code className="text-[#3498db] text-xs font-bold uppercase bg-[#3498db]/5 px-2 py-1 rounded border border-[#3498db]/10">{req.userId}</code>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest mb-1">Access Key</span>
                                <code className="text-[#f1c40f] text-xs font-bold uppercase bg-[#f1c40f]/5 px-2 py-1 rounded border border-[#f1c40f]/10">{req.password}</code>
                              </div>
                            </div>
                            <div className="text-[8px] font-black text-zinc-800 uppercase tracking-widest pt-2">
                               Requested: {req.timestamp?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || 'Just Now'}
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col gap-2 justify-end">
                            <button 
                              onClick={() => handleApproveRegistration(req)}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/20 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button 
                              onClick={() => handleRejectRegistration(req.id)}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/20 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all"
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {activeView === 'requests' && (
              <motion.div 
                key="requests"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-6 px-2">
                  <h4 className="text-sm font-black italic flex items-center gap-2 uppercase tracking-widest text-zinc-400">
                    <ListVideo className="text-[#e50914]" size={16} /> Incoming Requests
                  </h4>
                  <button 
                    onClick={handleClearSolvedRequests}
                    className="text-[8px] font-black text-red-600 hover:text-red-500 uppercase tracking-[0.4em] border border-red-600/10 px-4 py-2 rounded-lg hover:bg-red-600/5 transition-all"
                  >
                    Wipe Processed
                  </button>
                </div>

                <div className="grid gap-3">
                  {movieRequests.length === 0 ? (
                    <div className="bg-[#111] border border-[#222] p-12 rounded-2xl text-center text-[#444] font-black uppercase tracking-[0.4em] text-[10px]">
                      Zero Active Requests
                    </div>
                  ) : (
                    movieRequests.map((req) => (
                      <div 
                        key={req.id} 
                        className={`bg-[#0d0d0d] border border-[#222] p-5 rounded-2xl transition-all hover:border-white/10 ${req.status === 'solved' ? 'border-l-2 border-l-green-500 opacity-60 scale-98' : ''}`}
                      >
                        <div className="flex flex-col md:flex-row justify-between gap-5">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h5 className="text-[13px] font-black text-white uppercase italic tracking-tighter">{req.title}</h5>
                              <span className="text-zinc-600 text-[10px] font-bold">({req.year || 'N/A'})</span>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-[8px] font-black bg-zinc-900 border border-white/5 text-zinc-500 px-2.5 py-1 rounded-md uppercase tracking-widest">{req.category}</span>
                              <span className="text-[8px] font-black bg-zinc-900 border border-white/5 text-zinc-500 px-2.5 py-1 rounded-md uppercase tracking-widest">{req.language || 'Any Language'}</span>
                            </div>
                            {req.note && (
                              <p className="text-cyan-500 text-[10px] font-medium mb-3 bg-cyan-500/5 p-3 rounded-xl border border-cyan-500/10 italic leading-relaxed">
                                {req.note}
                              </p>
                            )}
                            <div className="text-[8px] font-black text-zinc-800 uppercase tracking-widest">
                               USER: {req.userName || 'GUEST'} <span className="mx-1 opacity-20">|</span> SESSION: {req.timestamp?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || 'SYNCING'}
                            </div>
                          </div>
                          <div className="flex flex-row md:flex-col gap-2 justify-end">
                            {req.status !== 'solved' ? (
                              <button 
                                onClick={() => handleSolveRequest(req.id)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600 text-green-500 hover:text-white border border-green-600/20 px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.3em] transition-all"
                              >
                                <Check size={12} /> Resolve
                              </button>
                            ) : (
                              <span className="flex-1 md:flex-none bg-green-600/5 text-green-500/50 px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.3em] text-center border border-green-600/10 italic">
                                Processed
                              </span>
                            )}
                            <button 
                              onClick={() => handleDeleteRequest(req.id)}
                              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-zinc-900 hover:bg-red-600/10 hover:text-red-500 text-zinc-700 hover:border-red-600/20 border border-white/5 px-5 py-2.5 rounded-xl text-[8px] font-black uppercase tracking-[0.3em] transition-all"
                            >
                              <Trash size={12} /> Discard
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                        onClick={onLogoutAll}
                        className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-red-600/10 text-red-600 hover:bg-red-600/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-red-600/20 shadow-lg active:scale-95"
                      >
                        <Trash2 size={18} /> Force Logout All Users
                      </button>
                      
                      <p className="mt-4 text-[10px] text-[#444] font-bold leading-relaxed text-center uppercase tracking-widest">
                        Note: This will <span className="text-red-600">instantly terminate</span> all active user logins across all browsers.
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
                              src={movie.image || undefined} 
                              className="w-14 h-20 object-cover rounded-xl border border-[#333] shadow-lg group-hover:scale-105 transition-transform" 
                              alt="" 
                              referrerPolicy="no-referrer"
                              onError={(e: any) => e.target.src = 'https://via.placeholder.com/100x150?text=No+Img'}
                            />
                          </td>
                          <td className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="font-black text-lg tracking-tight group-hover:text-[#e50914] transition-colors">
                                {movie.title} <span className="text-[#555] text-xs font-bold">({movie.quality || 'N/A'})</span>
                              </div>
                              {movie.year && <span className="text-[#555] text-xs font-bold">({movie.year})</span>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${movie.category === 'Banner' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : movie.category === 'Series' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-red-600/10 text-red-600 border border-red-600/20'}`}>
                                {movie.category}
                              </span>
                              <span className="text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-[#e50914] text-white">
                                {movie.quality || 'HD'}
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
