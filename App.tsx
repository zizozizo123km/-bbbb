
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
  Clock
} from 'lucide-react';
import { generateSiteStructure, modifySiteStructure, generateImage } from './services/gemini';
import { saveProject, listenToProjects, SavedProject } from './services/firebase';
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const unsubscribe = listenToProjects((data) => {
      setProjects(data.sort((a, b) => b.timestamp - a.timestamp));
    });
    return () => unsubscribe();
  }, []);

  const persistToFirebase = async (html: string, name: string, currentId?: string) => {
    try {
      const id = await saveProject(name, html, currentId);
      setProjectId(id);
    } catch (e) {
      console.error("Firebase save error", e);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(10);
      setSiteData(null);
      setProjectId(undefined);

      const { code, imagePrompts } = await generateSiteStructure(prompt);
      setProgress(40);

      setStep(GenerationStep.GENERATING_IMAGES);
      const generatedImages: string[] = [];
      const imagePromises = imagePrompts.map(p => generateImage(p));
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
    } catch (error) {
      console.error(error);
      setStep(GenerationStep.ERROR);
    }
  };

  const handleModify = async () => {
    if (!editPrompt.trim() || !siteData) return;

    try {
      setStep(GenerationStep.GENERATING_CODE);
      setProgress(20);

      const { code, imagePrompts } = await modifySiteStructure(siteData.html, editPrompt);
      setProgress(50);

      let finalCode = code;
      if (imagePrompts && imagePrompts.length > 0) {
        setStep(GenerationStep.GENERATING_IMAGES);
        const newImages: string[] = [];
        const imagePromises = imagePrompts.map(p => generateImage(p));
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
    } catch (error) {
      console.error(error);
      setStep(GenerationStep.ERROR);
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-800">Gemini<span className="text-indigo-600">Site</span></h1>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${showHistory ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            title="Project History"
          >
            <History className="w-5 h-5" />
            <span className="hidden md:inline">History</span>
          </button>

          {siteData && (
            <>
              <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button 
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${viewMode === 'code' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <CodeIcon className="w-4 h-4" /> Code
                </button>
              </div>
              
              <button 
                onClick={downloadProject}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* History Overlay */}
        {showHistory && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-all flex justify-start">
            <aside className="w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" /> Saved Projects
                </h2>
                <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {projects.length === 0 ? (
                  <div className="text-center py-20">
                    <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 text-sm">No saved projects yet.</p>
                  </div>
                ) : (
                  projects.map((proj) => (
                    <button 
                      key={proj.id}
                      onClick={() => loadProject(proj)}
                      className={`w-full text-left p-4 rounded-xl border transition-all hover:border-indigo-300 hover:shadow-md ${projectId === proj.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}
                    >
                      <h4 className="font-semibold text-slate-800 text-sm mb-1 truncate">{proj.name}</h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(proj.timestamp).toLocaleString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </aside>
          </div>
        )}

        <aside className="w-full md:w-80 border-r bg-white p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {!siteData || step === GenerationStep.IDLE ? (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Build a new website</label>
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A modern pizza restaurant with a menu, booking form and dark theme..."
                  className="w-full h-32 p-3 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                />
                <button 
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || (step !== GenerationStep.IDLE && step !== GenerationStep.COMPLETED)}
                  className="w-full mt-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  <Wand2 className="w-5 h-5" /> Generate
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button 
                  onClick={() => { setSiteData(null); setStep(GenerationStep.IDLE); setProjectId(undefined); }}
                  className="text-xs text-indigo-600 font-semibold flex items-center gap-1 hover:underline mb-2"
                >
                  <ArrowLeft className="w-3 h-3" /> New Website
                </button>
                
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4" /> Refine & Edit
                  </h3>
                  <textarea 
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g. Add a contact form, make the hero section blue..."
                    className="w-full h-24 p-2 border rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all"
                  />
                  <button 
                    onClick={handleModify}
                    disabled={!editPrompt.trim() || (step !== GenerationStep.COMPLETED && step !== GenerationStep.ERROR)}
                    className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    {step === GenerationStep.GENERATING_CODE || step === GenerationStep.GENERATING_IMAGES || step === GenerationStep.FINALIZING ? (
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : <Send className="w-3.5 h-3.5" />}
                    Apply Changes
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-2">
                   <span className="flex items-center gap-1"><Save className="w-3 h-3" /> Auto-saved to Firebase</span>
                   {projectId && <span className="opacity-60">ID: {projectId.slice(0, 8)}...</span>}
                </div>
              </div>
            )}

            {step !== GenerationStep.IDLE && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span>{step === GenerationStep.COMPLETED ? 'Status: Ready' : 'Processing'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${step === GenerationStep.ERROR ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="space-y-2">
                  <StatusStep label="Analyzing Request" active={step === GenerationStep.GENERATING_CODE} done={progress > 30} />
                  <StatusStep label="Coding" active={step === GenerationStep.GENERATING_CODE} done={progress > 50} />
                  <StatusStep label="Syncing Cloud" active={step === GenerationStep.FINALIZING} done={progress === 100} />
                </div>
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 bg-slate-100 relative overflow-hidden flex flex-col">
          {siteData ? (
            <>
              {viewMode === 'preview' && (
                <div className="h-12 border-b bg-white/80 backdrop-blur-sm flex items-center justify-center gap-4 z-10 shadow-sm">
                  <button onClick={() => setDevice('desktop')} className={`p-1.5 rounded-md transition-all ${device === 'desktop' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Monitor className="w-5 h-5" />
                  </button>
                  <button onClick={() => setDevice('tablet')} className={`p-1.5 rounded-md transition-all ${device === 'tablet' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Tablet className="w-5 h-5" />
                  </button>
                  <button onClick={() => setDevice('mobile')} className={`p-1.5 rounded-md transition-all ${device === 'mobile' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Smartphone className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center items-start">
                {viewMode === 'preview' ? (
                  <div 
                    className={`bg-white shadow-2xl rounded-sm transition-all duration-500 overflow-hidden ${
                      device === 'desktop' ? 'w-full max-w-6xl h-full' : 
                      device === 'tablet' ? 'w-[768px] h-full' : 
                      'w-[375px] h-[667px]'
                    }`}
                  >
                    <iframe ref={iframeRef} title="Preview" className="w-full h-full border-none" srcDoc={siteData.html} />
                  </div>
                ) : (
                  <div className="w-full max-w-6xl h-full bg-[#1e1e1e] rounded-xl overflow-hidden shadow-2xl font-mono text-sm">
                    <div className="h-10 bg-[#2d2d2d] flex items-center px-4 border-b border-[#3d3d3d] justify-between">
                      <span className="text-slate-400 flex items-center gap-2 text-xs font-semibold">
                        <span className="w-3 h-3 rounded-full bg-red-500/30"></span>
                        <span className="w-3 h-3 rounded-full bg-yellow-500/30"></span>
                        <span className="w-3 h-3 rounded-full bg-green-500/30"></span>
                        <span className="ml-2 uppercase tracking-widest opacity-50">Editor</span>
                      </span>
                      <button onClick={() => navigator.clipboard.writeText(siteData.html)} className="text-[10px] bg-white/5 hover:bg-white/10 text-white/50 px-2 py-1 rounded transition-all">Copy Code</button>
                    </div>
                    <textarea 
                      readOnly
                      className="w-full h-[calc(100%-40px)] bg-transparent text-indigo-300/80 p-6 outline-none resize-none leading-relaxed"
                      value={siteData.html}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 animate-bounce">
                <Layout className="w-10 h-10 text-indigo-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Cloud-Synced AI Design</h2>
              <p className="text-slate-500 max-w-md">
                Every modification you make is saved instantly. Access your history or build a new site using high-end LLM capabilities.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 max-w-xl text-left">
                 <button onClick={() => setPrompt("A premium dark-themed landing page for a futuristic AI startup named 'NeuroLink'. Features interactive hero, features grid, and glassmorphism.")} className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-indigo-300 hover:shadow-md transition-all group">
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors mb-1 text-sm">NeuroLink Startup</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Modern, dark, glassmorphic UI for high-tech SaaS.</p>
                 </button>
                 <button onClick={() => setPrompt("An elegant, high-end real estate website for luxury villas in Dubai. White & Gold theme, property slider, and agent booking.")} className="p-4 bg-white border border-slate-200 rounded-xl text-left hover:border-indigo-300 hover:shadow-md transition-all group">
                    <h3 className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors mb-1 text-sm">Luxury Real Estate</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">Elegant white/gold aesthetic for high-end properties.</p>
                 </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const StatusStep = ({ label, active, done }: { label: string, active: boolean, done: boolean }) => (
  <div className="flex items-center gap-3">
    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
      done ? 'bg-green-100 text-green-600' : 
      active ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 
      'bg-slate-100 text-slate-400'
    }`}>
      {done ? <CheckCircle2 className="w-3 h-3" /> : <div className={`w-1 h-1 rounded-full ${active ? 'bg-indigo-500' : 'bg-slate-400'}`} />}
    </div>
    <span className={`text-xs ${done ? 'text-slate-600 font-medium' : active ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>{label}</span>
  </div>
);
