import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Layout, 
  Code as CodeIcon, 
  Eye, 
  Download, 
  RefreshCcw, 
  Monitor, 
  Smartphone, 
  Tablet,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Send,
  ArrowLeft,
  History,
  Save,
  Trash2,
  Clock,
  ExternalLink,
  Github,
  Settings,
  X,
  Key
} from 'lucide-react';
import { generateSiteStructure, modifySiteStructure, generateImage } from './services/gemini';
import { saveProject, listenToProjects, SavedProject, deleteProject } from './services/firebase';
import { GenerationStep, GeneratedSite } from './types';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [siteData, setSiteData] = useState<GeneratedSite | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [progress, setProgress] = useState(0);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const unsubscribe = listenToProjects((data) => {
      setProjects(data.sort((a, b) => b.timestamp - a.timestamp));
    });
    return () => unsubscribe();
  }, []);

  const saveApiKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowSettings(false);
  };

  const persistToFirebase = async (html: string, name: string, currentId?: string) => {
    try {
      const id = await saveProject(name, html, currentId);
      setProjectId(id);
    } catch (e) {
      console.error("Firebase save error", e);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(id);
        if (projectId === id) {
          setSiteData(null);
          setProjectId(undefined);
          setStep(GenerationStep.IDLE);
        }
      } catch (e) {
        console.error("Delete error", e);
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      setErrorMsg(null);
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(10);
      setSiteData(null);
      setProjectId(undefined);

      const { code, imagePrompts } = await generateSiteStructure(prompt, userApiKey);
      setProgress(40);

      setStep(GenerationStep.GENERATING_IMAGES);
      const generatedImages: string[] = [];
      const imagePromises = imagePrompts.map(p => generateImage(p, userApiKey));
      const results = await Promise.all(imagePromises);
      results.forEach(img => { if (img) generatedImages.push(img); });
      
      setProgress(80);
      setStep(GenerationStep.FINALIZING);

      let finalCode = code;
      generatedImages.forEach((img, idx) => {
        finalCode = finalCode.replace(`IMAGE_PLACEHOLDER_${idx + 1}`, img);
        finalCode = finalCode.split(`image_${idx + 1}.png`).join(img);
        finalCode = finalCode.split(`src="image_${idx + 1}"`).join(`src="${img}"`);
      });

      const newSite = {
        html: finalCode,
        css: '',
        js: '',
        images: generatedImages,
        title: prompt.substring(0, 30)
      };
      
      setSiteData(newSite);
      await persistToFirebase(finalCode, newSite.title);
      
      setStep(GenerationStep.COMPLETED);
      setProgress(100);
    } catch (error: any) {
      console.error(error);
      const detailedError = error.message || "An unexpected error occurred during generation.";
      setErrorMsg(detailedError.includes("API key not valid") ? "The provided API key is invalid. Please check your settings." : detailedError);
      setStep(GenerationStep.ERROR);
      setProgress(0);
    }
  };

  const handleModify = async () => {
    if (!editPrompt.trim() || !siteData) return;

    try {
      setErrorMsg(null);
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(20);

      const { code, imagePrompts } = await modifySiteStructure(siteData.html, editPrompt, userApiKey);
      setProgress(50);

      let finalCode = code;
      if (imagePrompts && imagePrompts.length > 0) {
        setStep(GenerationStep.GENERATING_IMAGES);
        const newImages: string[] = [];
        const imagePromises = imagePrompts.map(p => generateImage(p, userApiKey));
        const results = await Promise.all(imagePromises);
        results.forEach(img => { if (img) newImages.push(img); });

        newImages.forEach((img, idx) => {
          const placeholderPattern = new RegExp(`NEW_IMAGE_PLACEHOLDER_${idx + 1}|new_image_${idx + 1}.png`, 'g');
          finalCode = finalCode.replace(placeholderPattern, img);
        });
      }

      setSiteData({ ...siteData, html: finalCode });
      await persistToFirebase(finalCode, siteData.title, projectId);

      setEditPrompt('');
      setStep(GenerationStep.COMPLETED);
      setProgress(100);
    } catch (error: any) {
      console.error(error);
      const detailedError = error.message || "An unexpected error occurred during modification.";
      setErrorMsg(detailedError.includes("API key not valid") ? "The provided API key is invalid. Please check your settings." : detailedError);
      setStep(GenerationStep.ERROR);
      setProgress(0);
    }
  };

  const loadProject = (proj: SavedProject) => {
    setSiteData({
      html: proj.html,
      css: '',
      js: '',
      images: [],
      title: proj.name
    });
    setProjectId(proj.id);
    setStep(GenerationStep.COMPLETED);
    setShowHistory(false);
    setErrorMsg(null);
  };

  const downloadProject = () => {
    if (!siteData) return;
    const blob = new Blob([siteData.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-lg tracking-tight text-slate-900 leading-none">Gemini<span className="text-indigo-600">Builder</span></h1>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Production V1</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${showHistory ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
            title="API Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          {siteData && (
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('preview')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Preview
              </button>
              <button 
                onClick={() => setViewMode('code')}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'code' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Code
              </button>
            </div>
          )}
          
          {siteData && (
            <button 
              onClick={downloadProject}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
                  <Key className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">API Settings</h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8">
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Enter your <span className="text-indigo-600 font-bold">Google Gemini API Key</span> to enable high-speed website generation. Your key is stored locally in your browser.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gemini API Key</label>
                  <input 
                    type="password"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 text-sm font-mono focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={() => saveApiKey(userApiKey)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 active:scale-95"
                >
                  Save & Apply Key
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-4">
                  Don't have a key? Get one at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 font-bold hover:underline">Google AI Studio</a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* History Overlay */}
        {showHistory && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-all flex justify-start">
            <aside className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <h2 className="font-extrabold text-xl text-slate-900 flex items-center gap-3">
                  <div className="p-1.5 bg-indigo-100 rounded-lg"><Clock className="w-5 h-5 text-indigo-600" /></div>
                  History
                </h2>
                <button onClick={() => setShowHistory(false)} className="bg-white border shadow-sm rounded-full p-2 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {projects.length === 0 ? (
                  <div className="text-center py-24 flex flex-col items-center">
                    <div className="bg-slate-50 p-6 rounded-full mb-4">
                      <History className="w-12 h-12 text-slate-300" />
                    </div>
                    <p className="text-slate-900 font-bold mb-1">No Projects Found</p>
                    <p className="text-slate-400 text-xs px-12">Start by creating your first website with Gemini AI.</p>
                  </div>
                ) : (
                  projects.map((proj) => (
                    <div 
                      key={proj.id}
                      onClick={() => loadProject(proj)}
                      className={`group relative w-full text-left p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-xl ${projectId === proj.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-indigo-200'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 w-[85%]">{proj.name}</h4>
                         <button 
                           onClick={(e) => handleDelete(e, proj.id)}
                           className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Clock className="w-3 h-3" />
                        {new Date(proj.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}

        <aside className="w-full md:w-[340px] border-r bg-white p-6 overflow-y-auto flex-shrink-0 z-10">
          <div className="space-y-8">
            {!siteData || step === GenerationStep.IDLE ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Project Concept</label>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe your vision (e.g. A sleek portfolio for a UI designer with glassmorphism...)"
                    className="w-full h-40 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50/50 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-300"
                  />
                </div>
                <button 
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || (step !== GenerationStep.IDLE && step !== GenerationStep.COMPLETED)}
                  className="w-full bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-100 disabled:text-slate-300 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-200 active:scale-95"
                >
                  <Wand2 className="w-5 h-5" /> Generate Magic
                </button>
                {!userApiKey && !process.env.API_KEY && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-amber-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-[10px] font-bold uppercase tracking-tight leading-relaxed">
                      Missing API Key. Click the gear icon above to set your Gemini API Key.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <button 
                  onClick={() => { setSiteData(null); setStep(GenerationStep.IDLE); setProjectId(undefined); setErrorMsg(null); }}
                  className="w-full py-2 px-4 border-2 border-slate-100 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:border-indigo-100 hover:text-indigo-600 flex items-center justify-center gap-2 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" /> Start New Build
                </button>
                
                <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-2xl shadow-indigo-200">
                  <h3 className="text-white font-black text-sm flex items-center gap-2 mb-4 uppercase tracking-widest">
                    <Sparkles className="w-5 h-5" /> Refinement Lab
                  </h3>
                  <textarea 
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Tell AI to change anything..."
                    className="w-full h-32 p-4 rounded-2xl bg-white/10 text-white border-2 border-white/20 text-sm font-medium focus:ring-4 focus:ring-white/20 focus:border-white outline-none resize-none transition-all placeholder:text-white/40"
                  />
                  <button 
                    onClick={handleModify}
                    disabled={!editPrompt.trim() || (step !== GenerationStep.COMPLETED && step !== GenerationStep.ERROR)}
                    className="w-full mt-4 bg-white text-indigo-600 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                  >
                    {step === GenerationStep.GENERATING_CODE || step === GenerationStep.GENERATING_IMAGES || step === GenerationStep.FINALIZING ? (
                       <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                    ) : <Send className="w-4 h-4" />}
                    Update AI Site
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Live Synced</span>
                   </div>
                   {projectId && <span className="text-[10px] font-mono text-slate-300">#{projectId.slice(0, 8)}</span>}
                </div>
              </div>
            )}

            {step !== GenerationStep.IDLE && (
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{step === GenerationStep.COMPLETED ? 'System Ready' : 'AI Processing'}</span>
                  <span className="text-sm font-black text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div className={`h-full rounded-full transition-all duration-1000 ${step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-indigo-600 shadow-[0_0_15px_rgba(79,70,229,0.5)]'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <StatusStep label="Neural Analysis" active={step === GenerationStep.GENERATING_CODE} done={progress > 30} />
                  <StatusStep label="Structure Generation" active={step === GenerationStep.GENERATING_CODE} done={progress > 60} />
                  <StatusStep label="Visual Rendering" active={step === GenerationStep.GENERATING_IMAGES} done={progress > 90} />
                </div>
              </div>
            )}

            {step === GenerationStep.ERROR && (
              <div className="bg-red-50 p-5 rounded-2xl border-2 border-red-100 flex gap-4 text-red-700 animate-in fade-in zoom-in">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-black uppercase mb-1">System Fault</p>
                  <p className="font-medium opacity-80 leading-relaxed">{errorMsg || "The AI encountered a limit or connection issue. Please retry."}</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
          {siteData ? (
            <>
              {viewMode === 'preview' && (
                <div className="h-14 border-b bg-white/60 backdrop-blur-md flex items-center justify-center gap-6 z-10 shadow-sm">
                  <div className="flex bg-slate-100/80 p-1 rounded-xl">
                    <button onClick={() => setDevice('desktop')} className={`p-2 rounded-lg transition-all ${device === 'desktop' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-900'}`}>
                      <Monitor className="w-5 h-5" />
                    </button>
                    <button onClick={() => setDevice('tablet')} className={`p-2 rounded-lg transition-all ${device === 'tablet' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-900'}`}>
                      <Tablet className="w-5 h-5" />
                    </button>
                    <button onClick={() => setDevice('mobile')} className={`p-2 rounded-lg transition-all ${device === 'mobile' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-900'}`}>
                      <Smartphone className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto p-4 md:p-12 flex justify-center items-start">
                {viewMode === 'preview' ? (
                  <div 
                    className={`bg-white shadow-[0_40px_100px_rgba(0,0,0,0.1)] rounded-xl transition-all duration-700 overflow-hidden relative group ${
                      device === 'desktop' ? 'w-full max-w-6xl h-full' : 
                      device === 'tablet' ? 'w-[768px] h-full' : 
                      'w-[375px] h-[667px]'
                    }`}
                  >
                    <div className="h-6 bg-slate-50 border-b flex items-center px-4 gap-1.5">
                       <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                       <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                       <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                    </div>
                    <iframe ref={iframeRef} title="Preview" className="w-full h-[calc(100%-24px)] border-none" srcDoc={siteData.html} />
                  </div>
                ) : (
                  <div className="w-full max-w-6xl h-full bg-[#0d0d0d] rounded-[2rem] overflow-hidden shadow-2xl font-mono text-sm border-8 border-slate-900">
                    <div className="h-12 bg-[#1a1a1a] flex items-center px-6 border-b border-white/5 justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                        <span className="text-[10px] text-white/40 font-black uppercase tracking-widest ml-4">Source Output</span>
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(siteData.html);
                          alert('Copied to clipboard!');
                        }} 
                        className="text-[10px] font-black uppercase tracking-widest bg-white/10 hover:bg-indigo-600 text-white px-4 py-2 rounded-full transition-all active:scale-95"
                      >
                        Copy All
                      </button>
                    </div>
                    <textarea 
                      readOnly
                      className="w-full h-[calc(100%-48px)] bg-transparent text-indigo-300/60 p-8 outline-none resize-none leading-relaxed selection:bg-indigo-500/30"
                      value={siteData.html}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="relative mb-12">
                 <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full"></div>
                 <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center relative z-10 animate-bounce transition-all duration-[2000ms]">
                   <Layout className="w-14 h-14 text-indigo-600" />
                 </div>
                 <div className="absolute -top-4 -right-4 bg-indigo-600 p-3 rounded-2xl shadow-xl z-20 animate-pulse">
                   <Sparkles className="w-6 h-6 text-white" />
                 </div>
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Future-Ready <br/><span className="text-indigo-600">AI Web Architect</span></h2>
              <p className="text-slate-500 max-w-md text-sm font-medium leading-relaxed mb-12">
                Deploy pixel-perfect websites in seconds. From concepts to functional code, managed in the cloud and ready for Vercel.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
                 <ExampleButton 
                    title="Futuristic SaaS" 
                    desc="Dark theme with glass cards and neon gradients."
                    onClick={() => setPrompt("A premium dark SaaS landing page for an AI agent platform named 'Quantum'. Neon blue accents, glassmorphism features, and a pricing table.")}
                 />
                 <ExampleButton 
                    title="Portfolio Pro" 
                    desc="Minimal, high-contrast, typographic masterpiece."
                    onClick={() => setPrompt("A minimal, typographic portfolio for a creative director. Black and white theme, large headings, and a smooth scrolling gallery.")}
                 />
              </div>

              <div className="mt-12 flex items-center gap-6 opacity-30 grayscale pointer-events-none">
                 <div className="flex items-center gap-2 font-black text-slate-400 tracking-tighter text-xl italic"><Github className="w-6 h-6"/> Firebase</div>
                 <div className="flex items-center gap-2 font-black text-slate-400 tracking-tighter text-xl italic">Vercel Ready</div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const StatusStep = ({ label, active, done }: { label: string, active: boolean, done: boolean }) => (
  <div className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-xl transition-all">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
      done ? 'bg-green-100 text-green-600' : 
      active ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 
      'bg-white border-2 border-slate-100 text-slate-200'
    }`}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-indigo-500' : 'bg-slate-200'}`} />}
    </div>
    <span className={`text-[11px] font-black uppercase tracking-widest ${done ? 'text-slate-500' : active ? 'text-indigo-600' : 'text-slate-300'}`}>{label}</span>
  </div>
);

const ExampleButton = ({ title, desc, onClick }: { title: string, desc: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="p-6 bg-white border-2 border-slate-100 rounded-3xl text-left hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-100 transition-all group active:scale-95"
  >
    <div className="flex items-center gap-2 mb-2">
       <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
          <ExternalLink className="w-4 h-4" />
       </div>
       <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-sm uppercase tracking-tight">{title}</h3>
    </div>
    <p className="text-[11px] font-medium text-slate-400 leading-relaxed group-hover:text-slate-600 transition-colors">{desc}</p>
  </button>
);