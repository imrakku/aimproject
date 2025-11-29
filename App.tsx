import React, { useState, useEffect } from 'react';
import { Upload, FileText, Check, Loader2, Play, RefreshCw, X, Trash2, CloudUpload, Eye, ShieldCheck, GraduationCap, Bot } from 'lucide-react';
import { ProcessingFile, CandidateAnalysis, ScoringWeights } from './types';
import { fileToBase64 } from './services/fileUtils';
import { analyzeCandidate } from './services/gemini';
import ScoringConfig from './components/ScoringConfig';
import Dashboard from './components/Dashboard';

// Initial default weights
const DEFAULT_WEIGHTS: ScoringWeights = {
  skillsMatch: 35,
  experienceRelevance: 30,
  qualifications: 15,
  seniority: 10,
  clarity: 10
};

const App: React.FC = () => {
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFiles, setCvFiles] = useState<ProcessingFile[]>([]);
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<CandidateAnalysis[]>([]);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);

  // Preview State
  const [previewFile, setPreviewFile] = useState<ProcessingFile | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedWeights = localStorage.getItem('cv_ranker_weights');
    const savedResults = localStorage.getItem('cv_ranker_results');
    
    if (savedWeights) {
      try {
        setWeights(JSON.parse(savedWeights));
      } catch (e) { console.error("Failed to parse saved weights"); }
    }
    
    if (savedResults) {
      try {
        setResults(JSON.parse(savedResults));
      } catch (e) { console.error("Failed to parse saved results"); }
    }
  }, []);

  // Save to LocalStorage whenever critical data changes
  useEffect(() => {
    localStorage.setItem('cv_ranker_weights', JSON.stringify(weights));
  }, [weights]);

  useEffect(() => {
    if (results.length > 0) {
        localStorage.setItem('cv_ranker_results', JSON.stringify(results));
    }
  }, [results]);

  // Recalculate scores whenever weights change, without re-analyzing
  useEffect(() => {
    if (results.length > 0) {
      const updatedResults = results.map(r => calculateFinalScore(r, weights));
      // Only update if scores actually changed to avoid loop (simple comparison)
      const currentScores = results.map(r => r.finalScore).join(',');
      const newScores = updatedResults.map(r => r.finalScore).join(',');
      if (currentScores !== newScores) {
        setResults(updatedResults);
      }
    }
  }, [weights, results.length]); // Depend on weights and results count

  const clearAllData = () => {
    if (window.confirm("Are you sure? This will clear all results and uploaded files.")) {
      setResults([]);
      setCvFiles([]);
      setJdFile(null);
      localStorage.removeItem('cv_ranker_results');
    }
  };

  const calculateFinalScore = (candidate: CandidateAnalysis, w: ScoringWeights): CandidateAnalysis => {
    const totalWeight = Object.values(w).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return candidate;

    const rawScore = 
      (candidate.ratings.skillsMatch * w.skillsMatch) +
      (candidate.ratings.experienceRelevance * w.experienceRelevance) +
      (candidate.ratings.qualifications * w.qualifications) +
      (candidate.ratings.seniority * w.seniority) +
      (candidate.ratings.clarity * w.clarity);
    
    const finalScore = rawScore / totalWeight; // Normalize to 0-100

    let fitLabel: 'High' | 'Medium' | 'Low' = 'Low';
    if (finalScore >= 80) fitLabel = 'High';
    else if (finalScore >= 50) fitLabel = 'Medium';

    return { ...candidate, finalScore, fitLabel };
  };

  const handleJdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setJdFile(e.target.files[0]);
    }
  };

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    // Only accept basic text/pdf based on extension roughly or just try to process everything
    const newFiles: ProcessingFile[] = fileArray.map((f: File) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      status: 'pending'
    }));
    setCvFiles(prev => [...prev, ...newFiles]);
  };

  const handleCvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  // Drag and Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeCv = (id: string) => {
    setCvFiles(prev => prev.filter(f => f.id !== id));
  };

  const openPreview = async (file: ProcessingFile) => {
    setPreviewFile(file);
    if (file.file.type === 'application/pdf' || file.file.name.toLowerCase().endsWith('.pdf')) {
      setPreviewUrl(URL.createObjectURL(file.file));
      setPreviewContent(null);
    } else {
      try {
        const text = await file.file.text();
        setPreviewContent(text);
        setPreviewUrl(null);
      } catch (e) {
        setPreviewContent("Error reading file content. Preview only supports PDF and Text files.");
      }
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewContent(null);
  };

  const startAnalysis = async () => {
    if (!jdFile || cvFiles.length === 0) return;

    setIsProcessing(true);
    setResults([]); 

    try {
      const jdBase64 = await fileToBase64(jdFile);
      const jdMime = jdFile.type || (jdFile.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');

      const tempResults: CandidateAnalysis[] = [];

      for (let i = 0; i < cvFiles.length; i++) {
        setCurrentProcessingIndex(i);
        const cv = cvFiles[i];
        
        // Update status to processing
        setCvFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

        try {
            const cvBase64 = await fileToBase64(cv.file);
            const cvMime = cv.file.type || (cv.file.name.endsWith('.pdf') ? 'application/pdf' : 'text/plain');

            // --- API CALL ---
            const rawAnalysis = await analyzeCandidate(jdBase64, jdMime, cvBase64, cvMime);
            
            // Initial Score Calculation
            const fullResult: CandidateAnalysis = calculateFinalScore({
                ...rawAnalysis,
                id: cv.id,
                finalScore: 0, // Placeholder
                fitLabel: 'Low' // Placeholder
            }, weights);

            tempResults.push(fullResult);
            setResults(prev => [...prev, fullResult]);
            
            // Update status to completed
            setCvFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'completed' } : f));

        } catch (error) {
            console.error(error);
            setCvFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Failed to analyze' } : f));
        }
      }
    } catch (error) {
      console.error("Global Error", error);
    } finally {
      setIsProcessing(false);
      setCurrentProcessingIndex(-1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      {/* Brand Header */}
      <header className="bg-[#1e3a8a] text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-2 rounded-md shadow-sm border border-white/20">
               <Bot className="w-8 h-8 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold tracking-tight text-white leading-tight">AIM PROJECT</h1>
              <span className="text-[11px] text-blue-200 font-medium tracking-wide">Submitted to Prof. Anuj Jain</span>
            </div>
            <div className="h-8 w-px bg-blue-700 mx-2 hidden md:block"></div>
            <div className="hidden md:block">
               <h2 className="text-sm font-medium text-blue-100 flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-amber-400" />
                 Smart Recruitment System
               </h2>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {results.length > 0 && (
               <button onClick={clearAllData} className="text-xs text-white/80 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 border border-white/20">
                 <Trash2 className="w-3 h-3" /> Start New Session
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1400px] mx-auto px-6 py-8">
        
        {/* Main Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Sidebar: Upload & Controls */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Control Panel Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                    <CloudUpload className="w-5 h-5 text-[#1e3a8a]" />
                    Upload Documents
                  </h2>
               </div>
               
               <div className="p-6 space-y-6">
                   {/* JD Upload */}
                   <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        1. Job Description
                     </label>
                     <div className={`group relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${jdFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 hover:border-[#1e3a8a] hover:bg-slate-50'}`}>
                        <input type="file" onChange={handleJdUpload} className="hidden" id="jd-upload" accept=".pdf,.txt" />
                        <label htmlFor="jd-upload" className="cursor-pointer block w-full">
                          {jdFile ? (
                            <div className="flex items-center gap-3">
                              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{jdFile.name}</p>
                                <p className="text-xs text-emerald-600">Ready for analysis</p>
                              </div>
                              <button onClick={(e) => {e.preventDefault(); setJdFile(null);}} className="text-slate-400 hover:text-red-500 p-1">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 py-3">
                              <span className="text-sm font-medium text-slate-600 group-hover:text-[#1e3a8a]">Select PDF or Text File</span>
                              <span className="text-xs text-slate-400">Standard Job Description format</span>
                            </div>
                          )}
                        </label>
                     </div>
                   </div>

                   {/* CV Uploads (Drag & Drop) */}
                   <div>
                     <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            2. Candidate CVs
                        </label>
                        <span className="text-xs text-slate-400">{cvFiles.length} files added</span>
                     </div>
                     
                     <div
                       onDragOver={handleDragOver}
                       onDragLeave={handleDragLeave}
                       onDrop={handleDrop}
                       className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ease-in-out mb-4 ${
                         isDragging 
                           ? 'border-[#1e3a8a] bg-blue-50/50 scale-[1.01] shadow-inner' 
                           : 'border-slate-300 hover:border-[#1e3a8a] hover:bg-slate-50'
                       }`}
                     >
                         <input 
                           type="file" 
                           onChange={handleCvUpload} 
                           className="hidden" 
                           id="cv-upload" 
                           accept=".pdf,.txt" 
                           multiple 
                         />
                         <label htmlFor="cv-upload" className="cursor-pointer flex flex-col items-center justify-center gap-3">
                             <div className={`p-3 rounded-full transition-colors ${isDragging ? 'bg-[#1e3a8a] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                 <CloudUpload className="w-6 h-6" />
                             </div>
                             <div>
                                 <p className="font-medium text-slate-700">Drag & Drop CVs here</p>
                                 <p className="text-xs text-slate-500 mt-1">or click to browse local files</p>
                             </div>
                         </label>
                     </div>

                     {/* File List with Progress */}
                     {cvFiles.length > 0 && (
                       <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-[250px] overflow-y-auto custom-scrollbar">
                         {cvFiles.map((f, idx) => (
                           <div key={f.id} className="group flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                                  <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${
                                      f.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                                      f.status === 'error' ? 'bg-red-100 text-red-600' :
                                      f.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                                      'bg-slate-200 text-slate-500'
                                  }`}>
                                      {f.status === 'completed' ? <Check className="w-4 h-4" /> :
                                       f.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                       <FileText className="w-4 h-4" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <div className="flex justify-between items-center">
                                         <p className="text-sm font-medium text-slate-700 truncate">{f.file.name}</p>
                                         <span className="text-[10px] text-slate-400 ml-2">{(f.file.size / 1024).toFixed(0)}KB</span>
                                      </div>
                                      
                                      {/* Status Bar or Error */}
                                      {f.status === 'processing' ? (
                                        <div className="h-1 w-full bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                                           <div className="h-full bg-blue-500 animate-progress origin-left w-full"></div>
                                        </div>
                                      ) : f.status === 'error' ? (
                                        <p className="text-[10px] text-red-500 mt-0.5 truncate">{f.error}</p>
                                      ) : null}
                                  </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openPreview(f)} className="p-1.5 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600" title="Preview">
                                   <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => removeCv(f.id)} disabled={f.status === 'processing'} className="p-1.5 hover:bg-red-50 rounded text-slate-500 hover:text-red-600">
                                   <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                           </div>
                         ))}
                       </div>
                     )}
               </div>

               {/* Action Footer */}
               <div className="p-4 bg-slate-50 border-t border-slate-200">
                 <button
                    onClick={startAnalysis}
                    disabled={isProcessing || !jdFile || cvFiles.length === 0}
                    className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition-all ${
                      isProcessing || !jdFile || cvFiles.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#1e3a8a] text-white hover:bg-[#172554] hover:shadow-md'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing... ({currentProcessingIndex + 1}/{cvFiles.length})
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Run Evaluation
                      </>
                    )}
                  </button>
               </div>
            </div>

            <div className="text-center">
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Secure • Confidential • AI-Powered</p>
            </div>

          </div>

          {/* Right Content: Results */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <ScoringConfig weights={weights} setWeights={setWeights} disabled={isProcessing} />
            
            {results.length > 0 ? (
              <Dashboard candidates={results} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 min-h-[400px]">
                 <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md mb-6 relative p-4">
                   <Bot className="w-12 h-12 text-[#1e3a8a]" />
                   <div className="absolute -bottom-1 -right-1 bg-amber-400 rounded-full p-1.5 border-2 border-white">
                     <RefreshCw className="w-4 h-4 text-white" />
                   </div>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">Awaiting Documents</h3>
                 <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                   Please upload a Job Description and Candidate CVs to begin the AI-driven evaluation process.
                 </p>
                 <div className="flex gap-8 text-sm text-slate-400">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                       <span>Semantic Matching</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                       <span>Gap Analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                       <span>Interview Guide</span>
                    </div>
                 </div>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 mt-auto border-t border-slate-800">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
           <div className="flex items-center gap-3">
              <div className="p-1 bg-white/10 rounded">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-slate-300 font-semibold">AIM Project</p>
                <p className="text-xs">Smart Recruitment Solution</p>
              </div>
           </div>
           <div className="text-right">
              <p>&copy; {new Date().getFullYear()} AIM Project. All rights reserved.</p>
              <p className="text-xs mt-1 text-slate-500">CV Evaluation System • Powered by Google Gemini</p>
           </div>
        </div>
      </footer>

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity" onClick={closePreview} />
          <div className="relative w-full max-w-5xl h-[85vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-50 text-[#1e3a8a] rounded-lg">
                   <FileText className="w-5 h-5" />
                 </div>
                 <div>
                   <h3 className="font-semibold text-slate-800">{previewFile.file.name}</h3>
                   <p className="text-xs text-slate-500">{(previewFile.file.size / 1024).toFixed(1)} KB • {previewFile.file.type || 'Unknown Type'}</p>
                 </div>
              </div>
              <button 
                onClick={closePreview}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden relative">
               {previewUrl ? (
                 <iframe src={previewUrl} className="w-full h-full border-none" title="PDF Preview" />
               ) : (
                 <div className="w-full h-full overflow-auto p-8">
                   <div className="bg-white shadow-sm border border-slate-200 min-h-full p-10 rounded-xl max-w-4xl mx-auto">
                     <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 leading-relaxed">
                       {previewContent}
                     </pre>
                   </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;