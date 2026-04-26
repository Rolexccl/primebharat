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
  CircleUser, ChevronRight, RefreshCw, UserCheck, Film, LogOut, Clock, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast, ToastContainer } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Tesseract from 'tesseract.js';
import 'react-toastify/dist/ReactToastify.css';

type ViewType = 'dashboard' | 'upload' | 'users' | 'requests' | 'security' | 'registrations' | 'plan-requests' | 'settings';

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
  const [upgradeRequests, setUpgradeRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemSettings, setSystemSettings] = useState({ upiId: '', merchantName: 'Bharat Prime' });
  const [searchQuery, setSearchQuery] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
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
    const q = query(collection(db, "requests"), orderBy("timestamp", "desc"));
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

  useEffect(() => {
    const q = query(collection(db, "upgradeRequests"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUpgradeRequests(list);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "config"), (docSnap) => {
      if (docSnap.exists()) {
        setSystemSettings(docSnap.data() as any);
      } else {
        // Initialize with defaults if doesn't exist
        setDoc(doc(db, "system", "config"), { 
          upiId: '', 
          merchantName: 'Bharat Prime',
          updatedAt: serverTimestamp()
        });
      }
    });
    return () => unsub();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "system", "config"), {
        ...systemSettings,
        updatedAt: serverTimestamp()
      });
      toast.success("System Configuration Saved");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

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
        const today = new Date();
        let plan = '';
        if (val >= 149) {
          plan = '90 Days (149 RS)';
          today.setDate(today.getDate() + 90);
        } else if (val >= 55) {
          plan = 'Monthly (55 RS)';
          today.setDate(today.getDate() + 30);
        } else {
          plan = 'Weekly (19 RS)';
          today.setDate(today.getDate() + 7);
        }
        
        const expiry = today.toISOString().split('T')[0];
        
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
        plan: userFormData.planName,
        planName: userFormData.planName,
        planPrice: userFormData.planPrice,
        amount: userFormData.planPrice.replace(/\D/g, ''),
        startDate: userFormData.startDate,
        expiry: userFormData.expiryDate,
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
    setActiveView('users'); // Ensure view switches to form
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
      await updateDoc(doc(db, "requests", id), { status: 'solved' });
      toast.success("Marked as Solved");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (window.confirm("Reject and delete this request?")) {
      try {
        await deleteDoc(doc(db, "requests", id));
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
      solved.forEach(r => batch.delete(doc(db, "requests", r.id)));
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
    const matchesSearch = (m.title?.toLowerCase().includes(inventorySearch.toLowerCase()) || m.title?.toLowerCase().includes(searchQuery.toLowerCase()));
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
      
      const plan = req.plan || req.planName || 'Weekly (19 RS)';
      let price = '₹19';
      let days = 7;
      if (plan === 'Monthly (55 RS)') { price = '₹55'; days = 30; }
      if (plan === '90 Days (149 RS)') { price = '₹149'; days = 90; }

      const startDate = new Date().toISOString().split('T')[0];
      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      batch.set(userRef, {
        name: req.name,
        password: req.password,
        plan,
        planName: plan, // Keep both for safety
        planPrice: price,
        amount: price.replace(/\D/g, ''), // Match user snippet
        startDate,
        expiry,
        expiryDate: expiry, // Keep both for safety
        trxId: req.transactionId || '',
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

  const handleApprovePlanRequest = async (req: any) => {
    try {
      const userRef = doc(db, "users", req.userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        toast.error("User not found");
        return;
      }

      const userData = userSnap.data();
      let currentExpiry = new Date(userData.expiryDate || userData.expiry || Date.now());
      if (currentExpiry < new Date()) currentExpiry = new Date();

      const planName = req.planName || '';
      let daysToAdd = 7;
      let price = '₹19';
      
      if (planName.includes('Monthly') || planName.includes('55')) {
        daysToAdd = 30;
        price = '₹55';
      } else if (planName.includes('90') || planName.includes('149')) {
        daysToAdd = 90;
        price = '₹149';
      }

      currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);
      const newExpiry = currentExpiry.toISOString().split('T')[0];

      const updateData: any = {
        expiry: newExpiry,
        expiryDate: newExpiry,
        plan: planName,
        planName: planName,
        planPrice: price,
        amount: price.replace(/\D/g, ''),
        trxId: req.transactionId || '',
        updatedAt: serverTimestamp()
      };

      await updateDoc(userRef, updateData);
      await deleteDoc(doc(db, "upgradeRequests", req.id));
      toast.success(`Plan upgraded to ${planName} for ${req.userId}`);
    } catch (err) {
      console.error(err);
      toast.error("Approval failed");
    }
  };

  const handleRejectPlanRequest = async (id: string) => {
    try {
      await deleteDoc(doc(db, "upgradeRequests", id));
      toast.info("Request rejected and removed");
    } catch (err) {
      console.error(err);
      toast.error("Rejection failed");
    }
  };

  const handleClearExpiredUsers = async () => {
    if (!window.confirm("CRITICAL: This will permanently delete ALL expired members from the database. Proceed?")) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const expired = users.filter(u => (u.expiryDate || u.expiry) && (u.expiryDate || u.expiry) < today);
      if (expired.length === 0) {
        toast.info("No expired members found");
        return;
      }
      const batch = writeBatch(db);
      expired.forEach(u => batch.delete(doc(db, "users", u.id)));
      await batch.commit();
      toast.success(`${expired.length} Expired members purged`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleClearPlanRequests = async () => {
    if (!window.confirm("Clear all processed plan requests?")) return;
    try {
      const processed = upgradeRequests.filter(r => r.status !== 'pending');
      const batch = writeBatch(db);
      processed.forEach(r => batch.delete(doc(db, "upgradeRequests", r.id)));
      await batch.commit();
      toast.info("Requests Cleared");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#050505] text-gray-200 font-sans flex overflow-hidden">
      <ToastContainer position="top-right" theme="dark" autoClose={3000} aria-label="Notifications" />
      
      {/* Drawer Wrapper for Mobile */}
      <div className="drawer lg:drawer-open w-full h-full">
        <input id="admin-drawer" type="checkbox" className="drawer-toggle" checked={!isSidebarCollapsed} onChange={(e) => setIsSidebarCollapsed(!e.target.checked)} />
        
        {/* Main Content */}
        <div className="drawer-content flex flex-col h-full overflow-hidden bg-[#0a0a0a]">
          {/* Header */}
          <header className="flex justify-between items-center p-6 lg:p-8 border-b border-white/5 bg-[#050505]/50 backdrop-blur-md z-20">
            <div className="flex items-center gap-4">
              <label htmlFor="admin-drawer" className="btn btn-ghost btn-circle lg:hidden">
                <Menu size={20} />
              </label>
              <div>
                <h2 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.5em] mb-1 italic opacity-60">Elite Command Center</h2>
                <h1 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter">
                  {activeView === 'dashboard' ? 'Inertia Overview' : 
                   activeView === 'registrations' ? 'Member Approvals' : 
                   activeView === 'upload' ? 'Database Matrix' : 
                   activeView === 'users' ? 'Onboarding Deck' : 
                   activeView === 'requests' ? 'Content Requests' : 
                   activeView === 'plan-requests' ? 'Upgrade Requests' : 'Security Shield'}
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search anything..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input input-sm h-10 w-64 pl-10 bg-zinc-900 border-white/5 focus:border-[#e50914] transition-all text-xs font-bold" 
                />
              </div>
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="avatar placeholder ring-1 ring-white/10 ring-offset-base-100 ring-offset-2 rounded-full cursor-pointer">
                  <div className="bg-red-600 text-white rounded-full w-10 font-black italic">
                    <span>AD</span>
                  </div>
                </div>
                <ul tabIndex={0} className="dropdown-content z-50 menu p-2 shadow-2xl bg-zinc-900 border border-white/5 rounded-xl w-52 mt-4">
                  <li><a onClick={() => setActiveView('settings')} className="text-[9px] font-black uppercase tracking-[0.2em] py-3 hover:bg-blue-600/10 transition-colors">System Settings</a></li>
                  <li><a onClick={() => setActiveView('security')} className="text-[9px] font-black uppercase tracking-[0.2em] py-3 hover:bg-red-600/10 transition-colors">Security Matrix</a></li>
                  <li><a onClick={onClose} className="text-[9px] font-black uppercase tracking-[0.2em] py-3 text-red-500 hover:bg-red-500/10">Terminate Session</a></li>
                </ul>
              </div>
            </div>
          </header>

          {/* Scrollable View Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeView === 'dashboard' && (
                <motion.div 
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: 'Total Assets', value: stats.total, color: 'border-red-600', text: 'text-white' },
                      { label: 'Active Members', value: stats.totalUsers, color: 'border-green-500', text: 'text-green-500' },
                      { label: 'Pending Requests', value: stats.pendingRequests, color: 'border-yellow-500', text: 'text-yellow-500' },
                      { label: 'Live Movies', value: stats.movies, color: 'border-blue-500', text: 'text-blue-500' }
                    ].map((s, i) => (
                      <div key={i} className={`glass-card p-6 border-b-4 ${s.color} hover:translate-y-[-4px] transition-all duration-300`}>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{s.label}</p>
                        <div className={`text-4xl font-black mt-2 tracking-tighter ${s.text}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Main Analytics Hub */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 glass-card p-8">
                      <div className="flex justify-between items-center mb-10">
                        <div>
                          <h3 className="text-lg font-black uppercase italic tracking-tighter">Matched Revenue Analytics</h3>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Live subscription-payment delta</p>
                        </div>
                        <div className="badge badge-error badge-outline px-4 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg">Real-Time</div>
                      </div>
                      <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={financeStats.breakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              stroke="#444" 
                              fontSize={9} 
                              tickLine={false} 
                              axisLine={false}
                              tick={{ fontWeight: 900, textTransform: 'uppercase' }}
                              dy={10}
                            />
                            <YAxis stroke="#444" fontSize={9} tickLine={false} axisLine={false} tick={{ fontWeight: 900 }} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="glass-card p-4 border-white/5 backdrop-blur-2xl shadow-2xl">
                                      <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">{payload[0].payload.name}</p>
                                      <p className="text-lg font-black text-white italic" style={{ color: payload[0].payload.color }}>₹{payload[0].value}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={55}>
                              {financeStats.breakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="glass-card p-6 bg-blue-600/5 border-blue-500/20">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-blue-600 rounded-xl"><BrainCircuit className="w-5 h-5 text-white" /></div>
                          <h4 className="font-black text-[10px] text-blue-400 uppercase tracking-widest">AI Financial Insights</h4>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed italic font-medium">
                          {financeStats.revenue - financeStats.expenses > 0 
                            ? "Revenue matching logic confirms profitability. Current burn rate is sustainable against verified subscription IDs."
                            : "Operational burn exceeds matched revenue. Suggest increasing '90-Day VIP' conversions to offset overhead."}
                        </p>
                      </div>

                      <div className="glass-card p-6 border-white/5 bg-zinc-900/30">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-zinc-800 rounded-xl"><Film className="w-5 h-5 text-zinc-400" /></div>
                          <h4 className="font-black text-[10px] text-zinc-400 uppercase tracking-widest">Core Framework Logs</h4>
                        </div>
                        <ul className="space-y-3">
                          {[
                            'Enhanced Content Request Logic',
                            'Universal UPI Sync Engine',
                            'Real-time UTR Verification Hook',
                            'Elite System Config Matrix',
                            'Automated OCR Plan Verification'
                          ].map((log, i) => (
                            <li key={i} className="flex items-start gap-3 text-[10px] font-bold text-zinc-500 uppercase tracking-tight">
                              <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1 shrink-0" />
                              {log}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className={`glass-card p-6 transition-all duration-500 border-l-4 ${financeStats.revenue - financeStats.expenses > 0 ? 'border-green-500' : 'border-red-600'}`}>
                        <h4 className="font-black text-sm uppercase tracking-widest mb-1 italic">Financial Health</h4>
                        <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                          {financeStats.revenue - financeStats.expenses > 0 ? 'STATUS: SOLVENT' : 'STATUS: DEFICIT'}
                        </p>
                        <div className="mt-6 flex items-baseline gap-2">
                          <span className={`text-4xl font-black italic tracking-tighter ${financeStats.revenue - financeStats.expenses > 0 ? 'text-green-500' : 'text-red-600'}`}>
                            {Math.abs(financeStats.revenue - financeStats.expenses)}
                          </span>
                          <span className="text-xs font-black opacity-30 uppercase tracking-widest">RS DELTA</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            {activeView === 'upload' && (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Media Metadata Section */}
                  <div className="glass-card p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2.5 bg-red-600 rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.4)]"><Clapperboard className="text-white w-5 h-5" /></div>
                      <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Media Intelligence Metadata</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Universal Title</label>
                        <input 
                          type="text" 
                          value={formData.title}
                          onChange={e => setFormData({...formData, title: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black placeholder:text-zinc-800 text-white"
                          placeholder="Ex: Avatar: Frontiers of Pandora"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Streaming Quality</label>
                        <select 
                          value={formData.quality}
                          onChange={e => setFormData({...formData, quality: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black appearance-none cursor-pointer text-white"
                        >
                          <option value="HD">HD HIGH</option>
                           <option value="HQ">HQ ULTRA</option>
                           <option value="HDTC">HDTC CAM</option>
                           <option value="HDTS">HDTS BOOTLEG</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Release Cycle</label>
                        <input 
                          type="text" 
                          value={formData.year}
                          onChange={e => setFormData({...formData, year: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black text-white"
                          placeholder="2026"
                        />
                      </div>

                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Cinematic Poster URL</label>
                        <input 
                          type="text" 
                          value={formData.image}
                          onChange={e => setFormData({...formData, image: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-4 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black text-white"
                          placeholder="https://image-server.com/..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Content Category</label>
                        <select 
                          value={formData.category}
                          onChange={e => setFormData({...formData, category: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black appearance-none cursor-pointer text-white"
                        >
                          <option value="Movie">Featured Movie</option>
                          <option value="Series">Web Series</option>
                          <option value="Banner">Promo Banner</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Audio Profile</label>
                        <select 
                          value={formData.language}
                          onChange={e => setFormData({...formData, language: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-[#e50914] outline-none transition-all text-xs font-black appearance-none cursor-pointer text-white"
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
                    </div>
                  </div>

                  {/* Resource Links Section */}
                  <div className="glass-card p-8 flex flex-col">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2.5 bg-blue-600 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)]"><Globe className="text-white w-5 h-5" /></div>
                      <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">System Resource Links</h3>
                    </div>

                    <div className="flex-1 space-y-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                      {formData.links.map((link, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx} 
                          className="flex gap-3 items-center bg-white/[0.03] p-3 rounded-xl border border-white/5 group hover:border-blue-500/30 transition-all shadow-lg"
                        >
                          <div className="flex flex-col gap-1 w-20">
                            <label className="text-[7px] font-black text-zinc-600 uppercase">Res</label>
                            <input 
                              type="text" 
                              value={link.label}
                              onChange={e => updateLink(idx, 'label', e.target.value)}
                              className="w-full bg-transparent border-none text-[10px] font-black text-[#e50914] outline-none focus:ring-0 p-0"
                              placeholder="720p"
                            />
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[7px] font-black text-zinc-600 uppercase">Stream Source URL</label>
                            <input 
                              type="text" 
                              value={link.url}
                              onChange={e => updateLink(idx, 'url', e.target.value)}
                              className="w-full bg-transparent border-none text-[10px] font-medium text-zinc-300 outline-none focus:ring-0 p-0"
                              placeholder="https://cdn.resource.com/..."
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeLinkRow(idx)}
                            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-8 space-y-5">
                      <button 
                        type="button" 
                        onClick={addLinkRow}
                        className="w-full btn btn-ghost h-12 border-2 border-dashed border-zinc-800 hover:border-blue-500/50 hover:bg-blue-600/5 text-[9px] font-black uppercase tracking-widest gap-3 rounded-xl transition-all"
                      >
                        <PlusCircle size={14} /> Add Resolution Matrix Row
                      </button>

                      <div className="flex gap-4 pt-4 border-t border-white/5">
                        <button 
                          onClick={handleSubmit}
                          disabled={isSubmitting}
                          className="flex-1 btn bg-red-600 border-none hover:bg-red-700 text-white font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl shadow-[0_10px_30px_rgba(229,9,20,0.3)] active:scale-95 transition-all"
                        >
                          {isSubmitting ? 'SYNCING DATABASE...' : (editId ? 'UPDATE CONTENT PROFILE' : 'PUBLISH LIVE CONTENT')}
                        </button>
                        {editId && (
                          <button 
                            type="button" 
                            onClick={resetForm}
                            className="btn bg-zinc-800 border-none hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest h-14 px-8 rounded-2xl transition-all"
                          >
                            DISCARD
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inventory Overview */}
                <div className="space-y-6 pt-10 border-t border-white/5">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-6 px-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-zinc-800 rounded-xl"><ListVideo className="text-white w-4 h-4" /></div>
                      <h4 className="text-sm font-black uppercase italic tracking-tighter text-white">Global Content Inventory</h4>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                        <input 
                          type="text"
                          placeholder="Search titles..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="bg-zinc-900 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-[10px] font-bold outline-none focus:border-red-600 w-48 transition-all"
                        />
                      </div>
                      <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5 backdrop-blur-sm">
                        {['All', 'Movie', 'Series', 'Banner'].map((filter) => (
                          <button
                            key={filter}
                            onClick={() => setActiveFilter(filter as any)}
                            className={`px-6 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeFilter === filter ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-zinc-600 hover:text-white'}`}
                          >
                            {filter === 'Series' ? 'Series' : filter === 'Banner' ? 'Promo' : filter === 'Movie' ? 'Film' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="table w-full border-separate border-spacing-y-2 px-4">
                        <tbody className="space-y-2">
                          {filteredMovies.map(movie => (
                            <tr 
                              key={movie.id} 
                              onClick={() => prepareEdit(movie)}
                              className="bg-white/[0.02] hover:bg-white/[0.04] transition-all group border-none shadow-sm rounded-2xl overflow-hidden cursor-pointer"
                            >
                              <td className="p-4 w-20 rounded-l-2xl">
                                <div className="relative group/poster overflow-hidden rounded-xl">
                                  <img 
                                    src={movie.image || undefined} 
                                    className="w-12 h-16 object-cover border border-white/5 shadow-xl group-hover:scale-110 transition-transform duration-500" 
                                    alt="" 
                                    referrerPolicy="no-referrer"
                                    onError={(e: any) => e.target.src = 'https://via.placeholder.com/100x150?text=No+Img'}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                                    <Film size={12} className="text-white" />
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col gap-1.5">
                                  <div className="font-black text-[13px] text-white uppercase italic tracking-tighter group-hover:text-red-500 transition-colors">
                                    {movie.title} <span className="text-zinc-600 font-bold ml-1">({movie.year || '2026'})</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <span className={`text-[8px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest ${movie.category === 'Banner' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : movie.category === 'Series' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-red-600/10 text-red-600 border border-red-600/20'}`}>
                                      {movie.category}
                                    </span>
                                    <span className="text-[8px] font-black bg-white/5 text-zinc-500 px-2.5 py-1 rounded-md uppercase tracking-widest border border-white/5">
                                      {movie.quality || 'HD'}
                                    </span>
                                    {movie.language && (
                                      <span className="text-[8px] font-black bg-white/5 text-zinc-500 px-2.5 py-1 rounded-md uppercase tracking-widest border border-white/5">
                                        {movie.language}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right rounded-r-2xl">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={(e) => { e.stopPropagation(); prepareEdit(movie); }} className="p-3 bg-blue-600/5 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all active:scale-95 border border-blue-600/10 shadow-lg">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(movie.id); }} className="p-3 bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all active:scale-95 border border-red-600/10 shadow-lg">
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
                </div>
              </motion.div>
            )}

            {activeView === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Member Onboarding Section */}
                  <div className="glass-card p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-600 rounded-xl shadow-[0_0_15px_rgba(22,163,74,0.4)]"><CircleUser className="text-white w-5 h-5" /></div>
                        <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Member Onboarding Matrix</h3>
                      </div>
                      {userFormData.userId && users.find(u => u.userId === userFormData.userId) && (
                        <div className="badge badge-success badge-outline px-4 py-3 text-[8px] font-black uppercase tracking-widest animate-pulse">RENEWAL MODE</div>
                      )}
                    </div>

                    <form className="grid grid-cols-2 gap-6" onSubmit={(e) => { e.preventDefault(); handleUserSubmit(e); }}>
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Universal Member ID</label>
                        <input 
                          type="text" 
                          value={userFormData.userId}
                          onChange={e => setUserFormData({...userFormData, userId: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-4 px-5 focus:border-green-500 outline-none transition-all text-xs font-black placeholder:text-zinc-800 text-white"
                          placeholder="Ex: PRIME_USER_77"
                          disabled={!!userEditId}
                        />
                      </div>

                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Full Member Name</label>
                        <input 
                          type="text" 
                          value={userFormData.name}
                          onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-4 px-5 focus:border-green-500 outline-none transition-all text-xs font-black placeholder:text-zinc-800 text-white"
                          placeholder="MEMBER NAME"
                        />
                      </div>

                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Access Key (Auth Pass)</label>
                        <input 
                          type="text" 
                          value={userFormData.password}
                          onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-4 px-5 focus:border-green-500 outline-none transition-all text-xs font-black placeholder:text-zinc-800 text-white"
                          placeholder="GENERATED-KEY-..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Subscription Tier</label>
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
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-green-500 outline-none transition-all text-xs font-black appearance-none cursor-pointer text-white"
                        >
                          <option value="Weekly (19 RS)">Weekly (19 RS)</option>
                          <option value="Monthly (55 RS)">Monthly (55 RS)</option>
                          <option value="90 Days (149 RS)">90 Days (149 RS)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Paid Amount (RS)</label>
                        <input 
                          type="text" 
                          value={userFormData.planPrice}
                          readOnly
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-green-500 outline-none transition-all text-xs font-black opacity-50 cursor-not-allowed text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Activation Date</label>
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
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-green-500 outline-none transition-all text-xs font-black appearance-none text-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Lifecycle Termination</label>
                        <input 
                          type="date" 
                          value={userFormData.expiryDate}
                          readOnly
                          className="w-full bg-[#050505] border border-white/5 rounded-xl py-3 px-5 focus:border-zinc-800 outline-none transition-all text-xs font-black opacity-50 cursor-not-allowed text-white"
                        />
                      </div>

                      <div className="col-span-2 pt-6 flex gap-4">
                        <button 
                          type="submit"
                          disabled={isUserSubmitting || !userFormData.userId}
                          className="flex-1 btn bg-green-600 border-none hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl shadow-[0_10px_30px_rgba(22,163,74,0.3)] active:scale-95 transition-all"
                        >
                          {isUserSubmitting ? 'SYNCING...' : (userEditId ? 'UPDATE MEMBER PROFILE' : 'DEPLOY ACCESS CREDENTIALS')}
                        </button>
                        <button 
                          type="button" 
                          onClick={resetUserForm}
                          className="btn bg-zinc-800 border-none hover:bg-zinc-700 text-white font-black text-[10px] uppercase tracking-widest h-14 px-8 rounded-2xl"
                        >
                          FLUSH
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* OCR Scanning Intelligence */}
                  <div className="glass-card p-8 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-[80px] rounded-full group-hover:bg-blue-600/10 transition-all duration-500"></div>
                    
                    <div className="relative z-10 text-center w-full max-w-sm">
                      <div className="w-20 h-20 bg-blue-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-all duration-500 border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.15)]">
                        {isOcrLoading ? <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /> : <Scan className="w-8 h-8 text-blue-500" />}
                      </div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">RECEIPT SYNC (AI VISION)</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed mb-8">
                        Deploy a payment verification screenshot to automatically extract subscription metadata.
                      </p>

                      <label className="w-full flex items-center justify-center gap-3 bg-[#050505] border-2 border-dashed border-zinc-800 hover:border-blue-500/50 hover:bg-blue-600/5 transition-all p-8 rounded-3xl cursor-pointer">
                        <div className="flex flex-col items-center">
                          <PlusCircle className="w-6 h-6 text-blue-500 mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">Scan Receipt Data</span>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleOcrScan} 
                          className="hidden" 
                          disabled={isOcrLoading}
                        />
                      </label>

                      {isOcrLoading && (
                        <div className="mt-8 w-full">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-[#e50914] mb-2">
                            <span>Scanning Matrix</span>
                            <span>PROCESSING...</span>
                          </div>
                          <progress className="progress progress-error w-full h-1 bg-zinc-900" value="70" max="100"></progress>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Member Database Table */}
                <div className="glass-card overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="text-sm font-black uppercase italic tracking-widest text-green-500 flex items-center gap-2">
                      <ShieldCheck size={16} /> VERIFIED MEMBER DATABASE
                    </h3>
                    <button 
                      onClick={handleClearExpiredUsers}
                      className="text-[8px] font-black text-red-600 hover:text-red-500 uppercase tracking-[0.4em] border border-red-600/10 px-4 py-2 rounded-lg hover:bg-red-600/5 transition-all"
                    >
                      Purge Expired
                    </button>
                  </div>
                  <div className="overflow-x-auto p-4 custom-scrollbar">
                    <table className="table w-full border-separate border-spacing-y-2">
                      <thead className="bg-[#050505] text-[8px] font-black uppercase tracking-[0.3em] text-[#444]">
                        <tr>
                          <th className="rounded-l-lg p-4">Member ID</th>
                          <th className="p-4">Active Plan</th>
                          <th className="p-4">Paid Amt</th>
                          <th className="p-4">Expiry Timeline</th>
                          <th className="rounded-r-lg p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {users.map(user => {
                          const isExpired = (user.expiryDate || user.expiry) && new Date(user.expiryDate || user.expiry) < new Date();
                          return (
                            <tr key={user.id} className="bg-white/[0.02] hover:bg-white/[0.04] transition-all group border-none shadow-xl">
                              <td className="p-4 rounded-l-xl">
                                <div className="flex flex-col">
                                  <span className="text-[11px] font-black italic uppercase tracking-tighter text-white">{user.name || 'GUEST'}</span>
                                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{user.userId}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="badge badge-success border-green-600/30 text-green-500 bg-green-600/5 text-[8px] font-black uppercase px-3 py-3 rounded-lg">
                                  {user.plan || user.planName || "VIP Access"}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="text-[10px] font-black text-white">{user.planPrice || (user.amount ? `₹${user.amount}` : '---')}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col gap-1">
                                  <span className={`text-[9px] font-black uppercase tracking-widest ${isExpired ? 'text-red-500' : 'text-zinc-500'}`}>
                                    {isExpired ? 'EXPIRED' : (user.expiryDate || user.expiry || 'N/A')}
                                  </span>
                                  {(user.expiryDate || user.expiry) && (
                                    <div className="w-24 h-1 bg-zinc-900 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${isExpired ? 'bg-red-600' : 'bg-green-500'}`} 
                                        style={{ width: `${Math.max(0, Math.min(100, (new Date(user.expiryDate || user.expiry).getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000) * 100))}%` }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-right rounded-r-xl">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => prepareUserEdit(user)} className="p-3 bg-blue-600/5 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-blue-600/10 active:scale-90 shadow-lg">
                                    <Pencil size={14} />
                                  </button>
                                  <button onClick={() => handleUserDelete(user.userId)} className="p-3 bg-red-600/5 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all border border-red-600/10 active:scale-90 shadow-lg">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
                <div className="glass-card overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                      <h3 className="text-sm font-black uppercase italic tracking-widest text-[#e50914] flex items-center gap-2">
                        <UserCheck size={16} /> REGISTRATION APPROVAL CENTER
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Pending user authentication requests</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto p-4 custom-scrollbar">
                    <table className="table w-full border-separate border-spacing-y-2">
                      <thead className="bg-[#050505] text-[8px] font-black uppercase tracking-[0.3em] text-[#444]">
                        <tr>
                          <th className="rounded-l-lg p-4">Candidate Identity</th>
                          <th className="p-4">Access Key</th>
                          <th className="p-4">Plan Request</th>
                          <th className="p-4">Transaction ID</th>
                          <th className="p-4">Timestamp</th>
                          <th className="rounded-r-lg p-4 text-right">Operational Actions</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {memberRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-20 text-zinc-700 font-black uppercase tracking-[0.5em] text-[10px]">
                              Zero Pending Requests
                            </td>
                          </tr>
                        ) : (
                          memberRequests.map((req) => (
                            <tr key={req.id} className="bg-white/[0.02] hover:bg-white/[0.04] transition-all group border-none shadow-xl">
                              <td className="p-4 rounded-l-xl">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                    <span className="text-[11px] font-black italic uppercase tracking-tighter text-white">{req.name}</span>
                                  </div>
                                  <div className="flex flex-col px-3">
                                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none">UID: {req.userId}</span>
                                    <span className="text-[8px] text-blue-500 font-black uppercase tracking-widest mt-0.5 leading-none">PASS: {req.password}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <code className="text-blue-500 text-[10px] font-black bg-blue-500/10 px-3 py-1 rounded-md border border-blue-500/20">{req.password}</code>
                              </td>
                              <td className="p-4">
                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded border border-red-600/20 text-red-500 bg-red-600/5`}>
                                  {req.plan || "90 Days VIP"}
                                </span>
                              </td>
                              <td className="p-4">
                                {req.transactionId ? (
                                  <code className="text-yellow-500 text-[9px] font-black bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">{req.transactionId}</code>
                                ) : (
                                  <span className="text-[8px] text-zinc-600 font-black italic uppercase tracking-widest italic opacity-40">N/A</span>
                                )}
                              </td>
                              <td className="p-4 text-zinc-600 text-[9px] font-black uppercase tracking-widest">
                                {req.timestamp?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || 'SYNCING...'}
                              </td>
                              <td className="p-4 text-right rounded-r-xl">
                                <div className="flex gap-2 justify-end">
                                  <button onClick={() => handleApproveRegistration(req)} className="btn btn-xs h-9 px-4 bg-green-600 border-none hover:bg-green-700 text-white font-black uppercase text-[8px] tracking-widest rounded-lg shadow-lg shadow-green-600/20">
                                    APPROVE
                                  </button>
                                  <button onClick={() => handleRejectRegistration(req.id)} className="btn btn-xs h-9 px-4 bg-zinc-800 border-none hover:bg-zinc-700 text-red-500 font-black uppercase text-[8px] tracking-widest rounded-lg">
                                    DENY
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
              </motion.div>
            )}

            {activeView === 'plan-requests' && (
              <motion.div 
                key="plan-requests"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="glass-card overflow-hidden">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <div>
                      <h3 className="text-sm font-black uppercase italic tracking-widest text-blue-500 flex items-center gap-2">
                        <Calendar size={16} /> UPGRADE & EXTENSION REQUESTS
                      </h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Extensions and Upgrades</p>
                    </div>
                    <button 
                      onClick={handleClearPlanRequests}
                      className="text-[8px] font-black text-red-600 hover:text-red-500 uppercase tracking-[0.4em] border border-red-600/10 px-4 py-2 rounded-lg hover:bg-red-600/5 transition-all"
                    >
                      Clear Processed
                    </button>
                  </div>
                  <div className="overflow-x-auto p-4 custom-scrollbar">
                    <table className="table w-full border-separate border-spacing-y-2">
                      <thead className="bg-[#050505] text-[8px] font-black uppercase tracking-[0.3em] text-[#444]">
                        <tr>
                          <th className="rounded-l-lg p-4">Member Identity (ID/PASS)</th>
                          <th className="p-4">Transaction UTR</th>
                          <th className="p-4">Current Configuration</th>
                          <th className="p-4">Upgrade Path (Target)</th>
                          <th className="p-4">Request Meta</th>
                          <th className="rounded-r-lg p-4 text-right">Operational Actions</th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {upgradeRequests.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-20 text-zinc-700 font-black uppercase tracking-[0.5em] text-[10px]">
                              Zero Plan Requests
                            </td>
                          </tr>
                        ) : (
                          upgradeRequests.map((req) => {
                            const targetUser = users.find(u => u.userId === req.userId);
                            return (
                              <tr key={req.id} className={`bg-white/[0.02] hover:bg-white/[0.04] transition-all group border-none shadow-xl ${req.status !== 'pending' ? 'opacity-40 grayscale' : ''}`}>
                                <td className="p-4 rounded-l-xl">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                      <span className="text-[11px] font-black italic uppercase tracking-tighter text-white">{req.userName || targetUser?.name || 'Anonymous'}</span>
                                    </div>
                                    <div className="flex flex-col px-3">
                                      <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest leading-none">UID: {req.userId}</span>
                                      <span className="text-[8px] text-blue-400 font-black uppercase tracking-widest mt-0.5 leading-none">PASS: {targetUser?.password || '••••'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  {req.transactionId ? (
                                    <code className="text-yellow-500 text-[10px] font-black bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20 shadow-lg">{req.transactionId}</code>
                                  ) : (
                                    <span className="text-[8px] text-zinc-600 font-black italic uppercase tracking-widest opacity-40">N/A</span>
                                  )}
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <div className="text-[9px] font-black text-white/50 uppercase tracking-tighter">{targetUser?.plan || 'Standard Access'}</div>
                                    <div className="text-[7px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={8} className="text-red-500/60" /> {targetUser?.expiryDate || 'EXPIRY N/A'}
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1">
                                      <ArrowUpRight size={10} className="text-green-500" />
                                      <span className="text-[10px] font-black text-green-500 uppercase italic tracking-tighter">{req.planName}</span>
                                    </div>
                                    <span className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mt-0.5">
                                      Price: {req.planName?.includes('Weekly') ? '₹19' : req.planName?.includes('Monthly') ? '₹55' : '₹149'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-col gap-1">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md inline-block w-fit ${req.status === 'approved' ? 'bg-green-500/10 text-green-500' : req.status === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500 animate-pulse'}`}>
                                      {req.status}
                                    </span>
                                    <span className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest">
                                      {req.timestamp?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || 'SYNCING...'}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-4 text-right rounded-r-xl">
                                  {req.status === 'pending' && (
                                    <div className="flex gap-2 justify-end">
                                      <button onClick={() => handleApprovePlanRequest(req)} className="btn btn-xs h-9 px-4 bg-green-600 border-none hover:bg-green-700 text-white font-black uppercase text-[8px] tracking-widest rounded-lg shadow-lg shadow-green-600/20 active:scale-95">
                                        APPROVE
                                      </button>
                                      <button onClick={() => handleRejectPlanRequest(req.id)} className="btn btn-xs h-9 px-4 bg-zinc-800 border-none hover:bg-zinc-700 text-red-500 font-black uppercase text-[8px] tracking-widest rounded-lg active:scale-95">
                                        DENY
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeView === 'requests' && (
              <motion.div 
                key="requests"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-[#e50914] rounded-xl shadow-[0_0_15px_rgba(229,9,20,0.4)]"><ListVideo className="text-white w-5 h-5" /></div>
                    <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Content Requests Hub</h4>
                  </div>
                  <button 
                    onClick={handleClearSolvedRequests}
                    className="text-[8px] font-black text-red-600 hover:text-red-500 uppercase tracking-[0.4em] border border-red-600/10 px-4 py-2 rounded-lg hover:bg-red-600/5 transition-all"
                  >
                    Wipe Processed
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {movieRequests.length === 0 ? (
                    <div className="col-span-full glass-card p-16 text-center text-zinc-700 font-black uppercase tracking-[0.5em] text-[10px]">
                      Zero Active Requests
                    </div>
                  ) : (
                    movieRequests.map((req) => (
                      <motion.div 
                        key={req.id} 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`glass-card p-6 transition-all group relative overflow-hidden border-l-4 ${req.status === 'solved' ? 'border-zinc-800 opacity-40 grayscale' : 'border-red-600 hover:border-red-500'}`}
                      >
                        <div className="absolute top-0 right-0 p-2 opacity-5"><ListVideo size={48} /></div>
                        
                        <div className="flex flex-col h-full">
                          <div className="mb-4">
                            <div className="flex items-center gap-3 mb-1">
                              <h5 className="text-sm font-black text-white uppercase italic tracking-tighter group-hover:text-red-500 transition-colors">
                                {req.title}
                              </h5>
                              <span className="text-zinc-600 text-[9px] font-bold">({req.year || '2026'})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-[7px] font-black bg-white/5 border border-white/5 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">{req.category}</span>
                              <span className="text-[7px] font-black bg-white/5 border border-white/5 text-zinc-500 px-2 py-0.5 rounded uppercase tracking-widest">{req.language || 'Multi'}</span>
                            </div>
                          </div>

                          {req.note && (
                            <div className="flex-1 text-blue-400 text-[10px] font-medium mb-4 bg-blue-500/5 p-3 rounded-lg border border-blue-500/10 italic leading-relaxed">
                              "{req.note}"
                            </div>
                          )}

                          <div className="mt-auto space-y-4">
                            <div className="text-[8px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                              <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
                              By: {req.userName || 'GUEST'} <span className="opacity-20">|</span> {req.timestamp?.toDate().toLocaleString([], {month:'short', day:'numeric'}) || 'SYNCING'}
                            </div>

                            <div className="flex gap-2">
                              {req.status !== 'solved' ? (
                                <button 
                                  onClick={() => handleSolveRequest(req.id)}
                                  className="flex-1 btn btn-xs h-9 bg-green-600 border-none hover:bg-green-700 text-white font-black text-[8px] uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-green-600/10"
                                >
                                  Resolve
                                </button>
                              ) : (
                                <div className="flex-1 flex items-center justify-center bg-zinc-900 text-zinc-600 rounded-lg text-[8px] font-black uppercase tracking-widest h-9 border border-white/5">
                                  Done
                                </div>
                              )}
                              <button 
                                onClick={() => handleDeleteRequest(req.id)}
                                className="px-3 bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all border border-white/5"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

             {activeView === 'settings' && (
               <motion.div 
                 key="settings"
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="space-y-8"
               >
                 <div className="max-w-2xl">
                   <div className="glass-card p-8">
                     <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg"><Globe size={20} className="text-white" /></div>
                        <div>
                          <h3 className="text-lg font-black uppercase italic tracking-tighter text-white">Universal Payment Settings</h3>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Configure UPI and Merchant metadata</p>
                        </div>
                     </div>

                     <form onSubmit={handleSaveSettings} className="space-y-6">
                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Universal UPI ID</label>
                         <input 
                           type="text" 
                           value={systemSettings.upiId}
                           onChange={e => setSystemSettings({...systemSettings, upiId: e.target.value})}
                           className="w-full bg-[#050505] border border-white/5 rounded-2xl py-4 px-6 focus:border-blue-500 outline-none transition-all text-xs font-black text-white"
                           placeholder="Ex: merchant@upi"
                         />
                         <p className="text-[8px] text-zinc-600 font-bold uppercase mt-2 ml-1 italic tracking-widest">
                           * QR code will only be visible to users if this ID is active.
                         </p>
                       </div>

                       <div className="space-y-2">
                         <label className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Merchant Display Name</label>
                         <input 
                           type="text" 
                           value={systemSettings.merchantName}
                           onChange={e => setSystemSettings({...systemSettings, merchantName: e.target.value})}
                           className="w-full bg-[#050505] border border-white/5 rounded-2xl py-4 px-6 focus:border-blue-500 outline-none transition-all text-xs font-black text-white"
                           placeholder="Bharat Prime"
                         />
                       </div>

                       <button 
                         type="submit"
                         className="w-full btn bg-blue-600 border-none hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.3)] active:scale-95 transition-all mt-6"
                       >
                         Save System Configuration
                       </button>
                     </form>
                   </div>
                 </div>
               </motion.div>
             )}

            {activeView === 'security' && (
              <motion.div 
                key="security"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-xl mx-auto"
              >
                <div className="glass-card p-10 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>
                  
                  <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-red-500/20 shadow-[0_0_20px_rgba(229,9,20,0.15)]">
                    <ShieldCheck className="text-red-500 w-8 h-8" />
                  </div>
                  
                  <h4 className="text-xl font-black uppercase italic tracking-tighter text-white mb-8">System Access Firewall</h4>
                  
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Operational PIN Authorization</label>
                      <input 
                        type="text" 
                        value={pin}
                        onChange={e => setPin(e.target.value)}
                        className="w-full bg-[#050505] border border-white/5 rounded-2xl py-6 text-center text-3xl font-black tracking-[0.8em] focus:border-red-600 outline-none transition-all text-white placeholder:text-zinc-900"
                        placeholder="----"
                        maxLength={4}
                      />
                    </div>
                    
                    <button 
                      onClick={handleSavePin}
                      className="w-full btn bg-red-600 border-none hover:bg-red-700 text-white font-black h-16 rounded-2xl transition-all shadow-[0_10px_30px_rgba(229,9,20,0.3)] active:scale-95 text-[10px] uppercase tracking-[0.3em]"
                    >
                      UPDATE SECURITY GATE
                    </button>
                    
                    {pinStatus.text && (
                      <div className="py-4 rounded-xl bg-black border border-white/5 text-[9px] font-black tracking-[0.3em] uppercase animate-pulse" style={{ color: pinStatus.color }}>
                         {pinStatus.text}
                      </div>
                    )}
                  </div>

                  <div className="mt-12 bg-black/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div className="bg-white/5 p-4 flex justify-between items-center border-b border-white/5">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Pin Access History</span>
                      <button onClick={handleClearPinHistory} className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest">Clear Logs</button>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                      {pinHistory.length === 0 ? (
                        <div className="text-center text-zinc-800 py-10 text-[10px] font-black uppercase tracking-[0.5em]">No Access Logs</div>
                      ) : (
                        pinHistory.map((log, i) => (
                          <div key={i} className="flex justify-between items-center py-3 border-b border-white/[0.02] last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors">
                            <span className="text-sm font-black tracking-widest text-zinc-300 italic">{log.pin}</span>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase">
                              {log.updatedAt?.toDate().toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) || "..."}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mt-12 pt-8 border-t border-white/5">
                    <button 
                      onClick={onLogoutAll}
                      className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-red-600/5 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-red-600/10 active:scale-95"
                    >
                      <LogOut size={16} /> EMERGENCY LOGOUT ALL SESSIONS
                    </button>
                    <p className="mt-6 text-[9px] text-zinc-600 font-bold leading-relaxed text-center uppercase tracking-widest opacity-60">
                      Warning: Terminates all active connections immediately.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="drawer-side z-50">
          <label htmlFor="admin-drawer" aria-label="close sidebar" className="drawer-overlay"></label>
          <div className="w-72 min-h-full bg-[#050505] border-r border-white/5 text-gray-400 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-12 px-2">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(229,9,20,0.5)] border border-white/10 group-hover:scale-105 transition-transform">
                <ShieldCheck className="text-white w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">BHARAT<span className="text-red-600">PRIME</span></h1>
                <p className="text-[7px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">Command Unit</p>
              </div>
            </div>

            <nav className="flex-1 space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
                { id: 'registrations', label: 'Approvals', icon: UserCheck, badge: memberRequests.length },
                { id: 'plan-requests', label: 'Upgrades', icon: Calendar, badge: upgradeRequests.filter(r => r.status === 'pending').length },
                { id: 'upload', label: 'Add Content', icon: ListVideo },
                { id: 'users', label: 'Members', icon: ShieldCheck },
                { id: 'requests', label: 'Content Requests', icon: FileText, badge: stats.pendingRequests },
                { id: 'settings', label: 'Settings', icon: Globe }
              ].map((item) => (
                <a 
                  key={item.id}
                  onClick={() => setActiveView(item.id as ViewType)}
                  className={`flex items-center justify-between p-4 rounded-xl hover:bg-red-600/5 transition-all cursor-pointer group ${activeView === item.id ? 'bg-red-600/10 border-l-4 border-red-600 text-white font-black italic' : 'text-zinc-500'}`}
                >
                  <div className="flex items-center gap-4">
                    <item.icon size={18} className={activeView === item.id ? 'text-red-500' : 'group-hover:text-white transition-colors'} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="badge badge-error badge-sm text-[8px] font-black text-white rounded-md animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </a>
              ))}
            </nav>

            <div className="mt-10 glass-card p-5 bg-red-600/5 border-red-900/20">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <ShieldCheck size={12} /> Security Shield
              </p>
              <p className="text-[9px] font-bold text-zinc-600 leading-relaxed uppercase tracking-tighter">
                Admin session is encrypted and verified via System Auth ID.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
