import React, { useState, useEffect, useRef } from 'react';
import { Joyride, Step } from 'react-joyride';
import { 
  Sparkles, 
  History, 
  HelpCircle, 
  LogOut, 
  User, 
  Settings, 
  ChevronRight, 
  Send,
  LayoutDashboard,
  Image as ImageIcon,
  Sun,
  Moon,
  Camera,
  X,
  Clock,
  Palette,
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';
import { SketchCanvas } from './components/SketchCanvas';
import { StyleSelector } from './components/StyleSelector';
import { AIOutput } from './components/AIOutput';
import { ArtStyle, ArtGeneration } from './types';
import { ART_STYLES, TUTORIAL_STEPS } from './constants';
import { generateArt } from './services/gemini';
import { cn } from './lib/utils';
import confetti from 'canvas-confetti';

import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  updateProfile,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  deleteDoc,
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  addDoc,
  handleFirestoreError,
  OperationType
} from './firebase';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error} (${parsed.operationType})`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <X className="text-white w-12 h-12" />
          </div>
          <h1 className="text-3xl font-black uppercase italic mb-2">Oops!</h1>
          <p className="text-zinc-500 max-w-md mb-8">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:scale-105 transition-transform"
          >
            Reload Studio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ArtStyle>('Anime');
  const [sketch, setSketch] = useState<string>('');
  const [useAsReference, setUseAsReference] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [view, setView] = useState<'studio' | 'gallery' | 'admin' | 'settings'>('studio');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [showProfile, setShowProfile] = useState(false);
  const [history, setHistory] = useState<ArtGeneration[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  
  // Auth State
  const [user, setUser] = useState<{ uid: string; email: string; role: string; photoURL?: string; displayName: string; bio?: string; emailVerified: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: profile.displayName || firebaseUser.displayName || 'Creator',
              role: profile.role || 'user',
              photoURL: profile.photoURL || firebaseUser.photoURL || '',
              bio: profile.bio || '',
              emailVerified: firebaseUser.emailVerified
            });
          } else {
            // Create new profile if it doesn't exist
            const newProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || 'Creator',
              role: (firebaseUser.email === 'anujjha403495@gmail.com' || firebaseUser.email?.includes('admin')) ? 'admin' : 'user',
              photoURL: firebaseUser.photoURL || '',
              bio: 'New AI artist on the block.',
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
            setUser({ ...newProfile, emailVerified: firebaseUser.emailVerified });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync History from Firestore
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'sketches'),
      where('userId', '==', user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArtGeneration));
      // Sort in memory to avoid composite index requirement
      items.sort((a, b) => b.createdAt - a.createdAt);
      setHistory(items);
      setGalleryError(null);
    }, (error) => {
      // Log specific index error for developer/admin
      if (error.code === 'failed-precondition' || error.message.includes('index')) {
        const indexMsg = "Firestore Index Missing: A composite index is required for 'sketches' collection (userId ASC, createdAt DESC).";
        console.error(indexMsg);
        setGalleryError("Gallery query failed. This usually means a Firestore Index is still being created. Please wait a few minutes.");
      } else {
        setGalleryError("Failed to load gallery history.");
      }
      handleFirestoreError(error, OperationType.LIST, 'sketches');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme || 'dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    if (!email || !password || !displayName) {
      setAuthError("All fields are required.");
      return;
    }
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await sendEmailVerification(result.user);
      setAuthSuccess("Verification email sent! Please check your inbox.");
      setAuthMode('login');
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthSuccess("Password reset link sent to your email.");
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setView('studio');
    setEmail('');
    setPassword('');
    setDisplayName('');
  };

  const convertToJpeg = (dataUrl: string, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', quality));
        }
      };
      img.src = dataUrl;
    });
  };

  const handleGenerate = async () => {
    const canGenerate = prompt.trim() || (useAsReference && sketch);
    if (!canGenerate || !user) return;
    
    setIsGenerating(true);
    setGeneratedImage('');
    
    try {
      const result = await generateArt(prompt, style, useAsReference ? sketch : undefined);
      setGeneratedImage(result);
      
      // Convert to JPEG for Firestore to stay under 1MB limit
      const firestoreImage = await convertToJpeg(result, 0.7);
      
      const sketchRef = doc(collection(db, 'sketches'));
      const newGen: any = {
        id: sketchRef.id,
        userId: user.uid,
        prompt,
        style,
        imageUrl: firestoreImage,
        createdAt: Date.now(),
        analytics: {
          width: 1024,
          height: 1024,
          model: 'Gemini 2.5 Flash'
        }
      };

      if (useAsReference && sketch) {
        newGen.sketchUrl = sketch;
      }
      
      try {
        await setDoc(sketchRef, newGen);
        // Success feedback
        console.log("Art saved to gallery successfully:", sketchRef.id);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'sketches');
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: theme === 'dark' ? ['#ffffff', '#000000', '#facc15'] : ['#000000', '#ffffff', '#3b82f6']
      });
    } catch (error) {
      console.error(error);
      alert("Failed to generate art. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(null);
    try {
      await deleteDoc(doc(db, 'sketches', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sketches/${id}`);
    }
  };

  const handleProfileUpdate = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: user.displayName,
        bio: user.bio,
        photoURL: user.photoURL
      });
      alert("Settings saved successfully!");
      setView('studio');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const photoURL = reader.result as string;
        setUser({ ...user, photoURL });
        try {
          await updateDoc(doc(db, 'users', user.uid), { photoURL });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const steps: Step[] = TUTORIAL_STEPS.map(s => ({
    ...s,
    placement: 'auto',
    disableBeacon: true,
  }));

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center p-6 transition-colors duration-500">
        <div className="max-w-md w-full space-y-8">
          <div className="w-20 h-20 bg-black dark:bg-white rounded-2xl flex items-center justify-center mx-auto rotate-12 shadow-2xl">
            <Sparkles className="text-white dark:text-black w-12 h-12" />
          </div>
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter uppercase italic">Visionary</h1>
            <p className="text-zinc-500 text-lg mt-2">Professional AI Art Studio</p>
          </div>
          
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-6">
            <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <button 
                onClick={() => setAuthMode('login')}
                className={cn("flex-1 py-2 text-sm font-bold uppercase tracking-widest transition-colors", authMode === 'login' ? "text-blue-500 border-b-2 border-blue-500" : "text-zinc-500")}
              >
                Login
              </button>
              <button 
                onClick={() => setAuthMode('signup')}
                className={cn("flex-1 py-2 text-sm font-bold uppercase tracking-widest transition-colors", authMode === 'signup' ? "text-blue-500 border-b-2 border-blue-500" : "text-zinc-500")}
              >
                Signup
              </button>
            </div>

            {authError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                <X size={16} />
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-500 text-xs rounded-xl flex items-center gap-2">
                <Sparkles size={16} />
                {authSuccess}
              </div>
            )}

            <form onSubmit={authMode === 'signup' ? handleEmailSignup : authMode === 'login' ? handleEmailLogin : handlePasswordReset} className="space-y-4">
              {authMode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Display Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {authMode !== 'forgot' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              {authMode === 'login' && (
                <button 
                  type="button"
                  onClick={() => setAuthMode('forgot')}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Forgot Password?
                </button>
              )}

              <button 
                type="submit"
                className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-xl"
              >
                {authMode === 'login' ? 'Login' : authMode === 'signup' ? 'Create Account' : 'Reset Password'}
              </button>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div></div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest text-zinc-500"><span className="bg-zinc-50 dark:bg-zinc-950 px-2">Or continue with</span></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full py-4 bg-white dark:bg-zinc-800 text-black dark:text-white border border-zinc-200 dark:border-zinc-700 font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user.emailVerified && user.email.includes('@')) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-20 h-20 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto rotate-12 shadow-2xl">
            <Send className="text-white w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Verify Your Email</h1>
          <p className="text-zinc-500 text-lg">We've sent a verification link to <span className="font-bold text-black dark:text-white">{user.email}</span>. Please verify your account to continue.</p>
          <div className="space-y-4">
            <button 
              onClick={async () => {
                await sendEmailVerification(auth.currentUser!);
                alert("Verification email resent!");
              }}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:scale-105 transition-transform"
            >
              Resend Email
            </button>
            <button 
              onClick={handleLogout}
              className="w-full py-4 bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-bold rounded-xl hover:scale-105 transition-transform"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-500 font-sans selection:bg-blue-500 selection:text-white",
      theme === 'dark' ? "bg-black text-zinc-100" : "bg-zinc-50 text-zinc-900"
    )}>
      <Joyride
        steps={steps}
        run={showTutorial}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn(
            "max-w-sm w-full p-8 rounded-3xl border shadow-2xl space-y-6 animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
          )}>
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="text-red-500 w-8 h-8" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black uppercase italic">Delete Creation?</h3>
              <p className="text-zinc-500 text-sm">This action cannot be undone. This masterpiece will be removed from your history forever.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 px-6 rounded-xl font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 px-6 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 h-16 border-b z-50 px-6 flex items-center justify-between transition-colors duration-500",
        theme === 'dark' ? "bg-black/80 border-zinc-800" : "bg-white/80 border-zinc-200",
        "backdrop-blur-md"
      )}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('studio')}>
            <Sparkles className="w-6 h-6" />
            <span className="font-black tracking-tighter uppercase italic text-xl">Visionary</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <button 
              onClick={() => setView('studio')}
              className={cn("transition-colors", view === 'studio' ? "text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white")}
            >
              Studio
            </button>
            <button 
              onClick={() => setView('gallery')}
              className={cn("transition-colors gallery-nav", view === 'gallery' ? "text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white")}
            >
              Gallery
            </button>
            {user.role === 'admin' && (
              <button 
                onClick={() => setView('admin')}
                className={cn("transition-colors", view === 'admin' ? "text-blue-500" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white")}
              >
                Admin
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setShowTutorial(true)}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <HelpCircle size={20} />
          </button>
          <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />
          
          <div className="relative group">
            <button 
              onClick={() => setShowProfile(!showProfile)}
              className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 overflow-hidden"
            >
              {user.photoURL ? (
                <img src={user.photoURL} className="w-full h-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </button>
            
            {showProfile && (
              <div className={cn(
                "absolute top-full right-0 mt-2 w-64 rounded-2xl border shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200",
                theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
              )}>
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="relative group/avatar">
                    <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} className="w-full h-full object-cover" />
                      ) : (
                        <User size={32} className="text-zinc-400" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/avatar:opacity-100 rounded-full cursor-pointer transition-opacity">
                      <Camera size={20} className="text-white" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                    </label>
                  </div>
                  <div className="text-center">
                    <h4 className="font-bold">{user.displayName}</h4>
                    <p className="text-xs text-zinc-500">{user.email}</p>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <button 
                    onClick={() => {
                      setView('settings');
                      setShowProfile(false);
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
                  >
                    <Settings size={16} />
                    Account Settings
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors text-sm"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-6 max-w-[1600px] mx-auto">
        {view === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Panel: Controls */}
            <div className="lg:col-span-4 space-y-8">
              <StyleSelector 
                selectedStyle={style} 
                onSelect={setStyle} 
              />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Prompt</h3>
                <div className="relative prompt-input">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your vision... (e.g. 'A futuristic city floating in pink clouds')"
                    className={cn(
                      "w-full h-32 border rounded-xl p-4 text-sm transition-all resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600" : "bg-white border-zinc-200 text-black placeholder:text-zinc-400"
                    )}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || (!prompt.trim() && !(useAsReference && sketch))}
                    className={cn(
                      "absolute bottom-4 right-4 p-3 rounded-lg transition-all disabled:opacity-50 generate-button",
                      theme === 'dark' ? "bg-white text-black hover:scale-105" : "bg-black text-white hover:scale-105"
                    )}
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl border space-y-4",
                theme === 'dark' ? "bg-zinc-900/50 border-zinc-800/50" : "bg-white border-zinc-200 shadow-sm"
              )}>
                <div className="flex items-center gap-2 text-zinc-400">
                  <LayoutDashboard size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Active Settings</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase">Style</p>
                    <p className="text-sm font-bold">{style}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500 uppercase">Reference</p>
                    <p className={cn("text-sm font-bold", useAsReference ? "text-green-500" : "text-zinc-400")}>
                      {useAsReference ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Canvas & Output */}
            <div className="lg:col-span-8 space-y-12">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Sketchboard</h3>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest">
                    <ImageIcon size={12} />
                    Full Canvas Usable
                  </div>
                </div>
                <SketchCanvas 
                  onExport={setSketch} 
                  useAsReference={useAsReference}
                  onToggleReference={setUseAsReference}
                />
                <div className={cn(
                  "p-4 rounded-xl border flex items-center justify-between transition-all",
                  useAsReference ? "bg-green-500/5 border-green-500/20" : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      useAsReference ? "bg-green-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    )}>
                      <Camera size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Use Sketch as Reference</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest">AI will follow your drawing</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setUseAsReference(!useAsReference)}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-colors",
                      useAsReference ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      useAsReference ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

              <div className="space-y-6">
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">AI Masterpiece</h3>
                <AIOutput 
                  imageUrl={generatedImage} 
                  isGenerating={isGenerating} 
                  onRegenerate={handleGenerate}
                />
                {generatedImage && (
                  <button 
                    onClick={() => setView('gallery')}
                    className="w-full py-3 flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-bold uppercase italic tracking-widest text-xs"
                  >
                    <History size={14} />
                    Saved to Gallery - View History
                  </button>
                )}
                {!generatedImage && !isGenerating && (
                  <div className={cn(
                    "w-full aspect-square border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-colors",
                    theme === 'dark' ? "bg-zinc-900/30 border-zinc-800 text-zinc-600" : "bg-zinc-100 border-zinc-300 text-zinc-400"
                  )}>
                    <ImageIcon size={48} strokeWidth={1} />
                    <p className="text-sm font-medium">Your generated art will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === 'gallery' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic">History & Analytics</h2>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Clock size={16} />
                <span>{history.length} Creations</span>
              </div>
            </div>
            
            {galleryError ? (
              <div className="py-20 text-center space-y-4">
                <div className="p-4 bg-red-500/10 text-red-500 rounded-xl max-w-md mx-auto">
                  <p className="font-bold">Error Loading Gallery</p>
                  <p className="text-sm opacity-80">{galleryError}</p>
                </div>
              </div>
            ) : history.length === 0 ? (
              <div className="py-20 text-center space-y-4">
                <History size={48} className="mx-auto text-zinc-300" />
                <p className="text-zinc-500">No history yet. Start creating in the Studio!</p>
                <button 
                  onClick={() => setView('studio')}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
                >
                  Go to Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {history.map((item) => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "group relative rounded-2xl overflow-hidden border transition-all hover:scale-[1.02]",
                      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
                    )}
                  >
                    <div className="aspect-square relative overflow-hidden">
                      <img 
                        src={item.imageUrl} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-between">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-2 bg-white text-red-500 rounded-full hover:scale-110 transition-transform"
                            title="Delete from History"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = item.imageUrl;
                              link.download = `visionary-art-${item.id}.jpg`;
                              link.click();
                            }}
                            className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                            title="Quick Download"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setPrompt(item.prompt);
                              setStyle(item.style);
                              setGeneratedImage(item.imageUrl);
                              setView('studio');
                            }}
                            className="p-2 bg-white text-black rounded-full hover:scale-110 transition-transform"
                            title="Open in Studio for more download options"
                          >
                            <ImageIcon size={16} />
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-white">
                            <Palette size={14} />
                            <span className="text-xs font-bold uppercase tracking-widest">{item.style}</span>
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-3 italic">"{item.prompt}"</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-zinc-800/10 dark:border-zinc-800">
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>{item.analytics.model}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'admin' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <h2 className="text-3xl font-black tracking-tighter uppercase italic">Admin Dashboard</h2>
            <div className={cn(
              "rounded-2xl border overflow-hidden",
              theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-sm"
            )}>
              <table className="w-full text-left">
                <thead className={cn(
                  "text-[10px] uppercase tracking-widest text-zinc-500",
                  theme === 'dark' ? "bg-zinc-800/50" : "bg-zinc-50"
                )}>
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  <tr>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" /> : <User size={14} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{user.displayName}</p>
                          <p className="text-xs text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded uppercase">Admin</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-green-500 font-medium">Active</span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">Manage</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic">Account Settings</h2>
              <button 
                onClick={() => setView('studio')}
                className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="space-y-6">
                <div className="relative group/settings-avatar w-32 h-32 mx-auto">
                  <div className="w-full h-full rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border-2 border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-2xl">
                    {user.photoURL ? (
                      <img src={user.photoURL} className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-zinc-400" />
                    )}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover/settings-avatar:opacity-100 rounded-3xl cursor-pointer transition-opacity">
                    <Camera size={24} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                  </label>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Current Role</p>
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    user.role === 'admin' ? "bg-blue-500 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  )}>
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="md:col-span-2 space-y-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Display Name</label>
                    <input 
                      type="text" 
                      value={user.displayName}
                      onChange={(e) => setUser({ ...user, displayName: e.target.value })}
                      className={cn(
                        "w-full p-4 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-black"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Email Address</label>
                    <input 
                      type="email" 
                      value={user.email}
                      disabled
                      className={cn(
                        "w-full p-4 border rounded-xl font-medium opacity-50 cursor-not-allowed",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-black"
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">Bio</label>
                    <textarea 
                      value={user.bio}
                      onChange={(e) => setUser({ ...user, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      className={cn(
                        "w-full h-32 p-4 border rounded-xl font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all",
                        theme === 'dark' ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-black"
                      )}
                    />
                  </div>
                </div>

                <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Advanced Permissions</h4>
                      <p className="text-xs text-zinc-500">Request additional access to professional tools.</p>
                    </div>
                    {user.role !== 'admin' && (
                      <button className="px-6 py-2 bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform">
                        Request Admin
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold">Delete Account</h4>
                      <p className="text-xs text-zinc-500">Permanently remove all your art and data.</p>
                    </div>
                    <button 
                      onClick={async () => {
                        if (window.confirm("Are you sure? This will delete your profile data. (Sketches will remain but be orphaned)")) {
                          try {
                            await deleteDoc(doc(db, 'users', user.uid));
                            await signOut(auth);
                            setUser(null);
                            alert("Account data deleted.");
                          } catch (error: any) {
                            handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}`);
                          }
                        }
                      }}
                      className="px-6 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={handleProfileUpdate}
                    className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-bold rounded-2xl hover:scale-105 transition-transform shadow-xl"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12 px-6 mt-12">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-50">
            <Sparkles size={16} />
            <span className="font-black tracking-tighter uppercase italic">Visionary</span>
          </div>
          <div className="flex gap-8 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
            <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <p className="text-[10px] text-zinc-600 font-medium">© 2026 Visionary AI Art Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
