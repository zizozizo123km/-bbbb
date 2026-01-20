
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Layout, Code as CodeIcon, Eye, Download, RefreshCcw, Monitor, 
  Smartphone, Tablet, CheckCircle2, AlertCircle, Wand2, Send, ArrowLeft, 
  History, Trash2, Clock, Settings, X, Key, Globe
} from 'lucide-react';
import { generateCode, modifyCode } from './ai/codeGenerator';
import { generateSiteImage } from './ai/imageGenerator';
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
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('gemini_api_key') || process.env.API_KEY || '');
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

  const handleGenerate = async () => {
    if (!prompt.trim() || !userApiKey) {
      if (!userApiKey) setShowSettings(true);
      return;
    }

    try {
      setErrorMsg(null);
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(20);

      const result = await generateCode(prompt, userApiKey);
      setProgress(50);

      setStep(GenerationStep.GENERATING_IMAGES);
      const images: string[] = [];
      for (let i = 0; i < result.imagePrompts.length; i++) {
        setProgress(50 + (i * 10));
        const img = await generateSiteImage(result.imagePrompts[i], userApiKey);
        if (img) images.push(img);
      }

      let finalHtml = result.code;
      images.forEach((img, idx) => {
        finalHtml = finalHtml.replace(`IMAGE_PLACEHOLDER_${idx + 1}`, img);
      });

      const newSite = { html: finalHtml, css: '', js: '', images, title: prompt.substring(0, 30) };
      setSiteData(newSite);
      const id = await saveProject(newSite.title, finalHtml);
      setProjectId(id);
      
      setStep(GenerationStep.COMPLETED);
      setProgress(100);
    } catch (error: any) {
      setErrorMsg(error.message);
      setStep(GenerationStep.ERROR);
    }
  };

  const handleModify = async () => {
    if (!editPrompt.trim() || !siteData || !userApiKey) return;
    try {
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(30);
      const result = await modifyCode(siteData.html, editPrompt, userApiKey);
      setSiteData({ ...siteData, html: result.code });
      await saveProject(siteData.title, result.code, projectId);
      setEditPrompt('');
      setStep(GenerationStep.COMPLETED);
      setProgress(100);
    } catch (error: any) {
      setErrorMsg(error.message);
      setStep(GenerationStep.ERROR);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans selection:bg-indigo-100">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-black text-xl tracking-tighter text-slate-900">GEMINI<span className="text-indigo-600">ARCHITECT</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setShowHistory(!showHistory)} className="p-2 text-slate-400 hover:text-indigo-600 transition-all">
            <History className="w-5 h-5" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-all">
            <Settings className="w-5 h-5" />
          </button>
          {siteData && (
            <button 
              onClick={() => {
                const blob = new Blob([siteData.html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'website.html';
                a.click();
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-slate-100">
            <div className="flex justify-between mb-6">
              <h3 className="font-black text-lg uppercase tracking-widest text-slate-900">API Key Config</h3>
              <button onClick={() => setShowSettings(false)}><X className="w-5 h-5" /></button>
            </div>
            <input 
              type="password" 
              value={userApiKey} 
              onChange={(e) => setUserApiKey(e.target.value)} 
              placeholder="Paste Gemini API Key" 
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl mb-4 outline-none focus:border-indigo-600 transition-all font-mono"
            />
            <button onClick={() => saveApiKey(userApiKey)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100">Save Configuration</button>
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {showHistory && (
          <aside className="w-80 border-r bg-white h-full overflow-y-auto animate-in slide-in-from-left duration-300">
             <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
               <span className="font-black text-xs uppercase tracking-widest text-slate-400">Project History</span>
               <button onClick={() => setShowHistory(false)}><ArrowLeft className="w-4 h-4" /></button>
             </div>
             <div className="p-4 space-y-2">
               {projects.map(p => (
                 <div key={p.id} onClick={() => { setSiteData({ html: p.html, css: '', js: '', images: [], title: p.name }); setProjectId(p.id); setStep(GenerationStep.COMPLETED); setShowHistory(false); }} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${projectId === p.id ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-50 hover:border-indigo-100'}`}>
                   <p className="font-bold text-sm text-slate-900 line-clamp-1">{p.name}</p>
                   <p className="text-[10px] text-slate-400 uppercase font-black mt-1">{new Date(p.timestamp).toLocaleDateString()}</p>
                 </div>
               ))}
             </div>
          </aside>
        )}

        <aside className="w-[360px] border-r bg-white p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {!siteData || step === GenerationStep.IDLE ? (
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Build Instructions</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="E.g. A sleek crypto dashboard with live charts..."
                  className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-600 transition-all resize-none text-sm"
                />
                <button 
                  onClick={handleGenerate}
                  disabled={step !== GenerationStep.IDLE && step !== GenerationStep.COMPLETED}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-600 transition-all disabled:opacity-50"
                >
                  <Wand2 className="w-5 h-5" /> Generate Site
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-indigo-600 rounded-[2.5rem] p-6 shadow-xl shadow-indigo-100">
                   <h4 className="text-white font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><RefreshCcw className="w-4 h-4"/> AI Refinement</h4>
                   <textarea 
                     value={editPrompt}
                     onChange={(e) => setEditPrompt(e.target.value)}
                     placeholder="Change the hero color to red..."
                     className="w-full h-32 bg-white/10 border border-white/20 rounded-2xl p-4 text-white text-sm outline-none placeholder:text-white/40 focus:bg-white/20 transition-all"
                   />
                   <button onClick={handleModify} className="w-full bg-white text-indigo-600 py-3 rounded-xl font-black uppercase text-[10px] mt-4 shadow-lg active:scale-95 transition-all">Update Structure</button>
                </div>
                <button onClick={() => { setSiteData(null); setStep(GenerationStep.IDLE); }} className="w-full py-3 text-slate-400 font-bold text-xs uppercase hover:text-indigo-600 transition-all">Create New Build</button>
              </div>
            )}

            {step !== GenerationStep.IDLE && (
              <div className="pt-6 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Architect Progress</span>
                  <span className="text-xs font-black text-indigo-600">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-medium leading-relaxed">{errorMsg}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 bg-slate-50 relative flex flex-col">
          {siteData ? (
            <>
              <div className="h-14 border-b bg-white flex items-center justify-center gap-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setDevice('desktop')} className={`p-1.5 rounded-md ${device === 'desktop' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Monitor className="w-4 h-4" /></button>
                  <button onClick={() => setDevice('tablet')} className={`p-1.5 rounded-md ${device === 'tablet' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Tablet className="w-4 h-4" /></button>
                  <button onClick={() => setDevice('mobile')} className={`p-1.5 rounded-md ${device === 'mobile' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}><Smartphone className="w-4 h-4" /></button>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setViewMode('preview')} className={`px-4 py-1 text-[10px] font-black uppercase ${viewMode === 'preview' ? 'bg-white rounded-md shadow-sm text-indigo-600' : 'text-slate-400'}`}>Preview</button>
                  <button onClick={() => setViewMode('code')} className={`px-4 py-1 text-[10px] font-black uppercase ${viewMode === 'code' ? 'bg-white rounded-md shadow-sm text-indigo-600' : 'text-slate-400'}`}>Code</button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-6 md:p-12 flex justify-center items-center">
                {viewMode === 'preview' ? (
                  <div className={`bg-white shadow-2xl rounded-2xl transition-all duration-500 overflow-hidden border-8 border-slate-900/5 ${device === 'desktop' ? 'w-full h-full' : device === 'tablet' ? 'w-[768px] h-full' : 'w-[375px] h-full max-h-[667px]'}`}>
                    <iframe className="w-full h-full border-none" srcDoc={siteData.html} title="Preview" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#0d0d0d] rounded-2xl overflow-hidden shadow-2xl p-6 font-mono text-xs text-indigo-300 overflow-y-auto">
                    <pre><code>{siteData.html}</code></pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-24 h-24 bg-indigo-600/10 rounded-[2.5rem] flex items-center justify-center mb-8 animate-pulse">
                 <Globe className="w-10 h-10 text-indigo-600" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 uppercase">AI Architecture Studio</h2>
              <p className="text-slate-400 max-w-sm font-medium leading-relaxed">
                Describe your vision and let Gemini 3 Pro build your next production-ready website with pixel-perfect precision.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
