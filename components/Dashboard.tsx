import React, { useState } from 'react';
import { CandidateAnalysis } from '../types';
import { Download, ChevronDown, ChevronUp, CheckCircle, XCircle, Award, MessageSquare, Mail, Copy, Loader2, FileText, Star } from 'lucide-react';
import { generateCSV, downloadCSV } from '../services/fileUtils';
import { generateInterviewQuestions, generateEmailDraft } from '../services/gemini';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface Props {
  candidates: CandidateAnalysis[];
}

const COLORS = ['#1e3a8a', '#d97706', '#ef4444']; // IIM Blue, Amber (Gold), Red

type TabType = 'analysis' | 'questions' | 'email';

const Dashboard: React.FC<Props> = ({ candidates }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');
  
  // Local state to store generated content so we don't re-fetch
  const [questionsMap, setQuestionsMap] = useState<Record<string, string[]>>({});
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [loadingAction, setLoadingAction] = useState<string | null>(null); // 'questions' or 'email'

  const stats = [
    { name: 'High Fit', value: candidates.filter(c => c.fitLabel === 'High').length },
    { name: 'Medium Fit', value: candidates.filter(c => c.fitLabel === 'Medium').length },
    { name: 'Low Fit', value: candidates.filter(c => c.fitLabel === 'Low').length },
  ];

  const handleDownload = () => {
    const csv = generateCSV(candidates);
    downloadCSV(csv, `cv_ranking_results_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const sortedCandidates = [...candidates].sort((a, b) => b.finalScore - a.finalScore);

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setActiveTab('analysis');
    }
  };

  const fetchQuestions = async (candidate: CandidateAnalysis) => {
    if (questionsMap[candidate.id]) return;
    setLoadingAction('questions');
    try {
      const qs = await generateInterviewQuestions(candidate);
      setQuestionsMap(prev => ({ ...prev, [candidate.id]: qs }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const fetchEmail = async (candidate: CandidateAnalysis) => {
    if (emailMap[candidate.id]) return;
    setLoadingAction('email');
    try {
      const type = candidate.fitLabel === 'High' || candidate.fitLabel === 'Medium' ? 'invite' : 'reject';
      const email = await generateEmailDraft(candidate, type);
      setEmailMap(prev => ({ ...prev, [candidate.id]: email }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTabChange = (candidate: CandidateAnalysis, tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'questions') fetchQuestions(candidate);
    if (tab === 'email') fetchEmail(candidate);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 md:col-span-2 flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Fit Distribution</h3>
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-gradient-to-br from-[#1e3a8a] to-[#172554] p-6 rounded-xl shadow-md text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Star className="w-24 h-24" />
          </div>
          <div>
            <h3 className="text-blue-200 font-medium mb-1 text-sm uppercase tracking-wide">Top Candidate</h3>
            <div className="text-xl font-bold truncate mt-2">{sortedCandidates[0]?.candidateName || "N/A"}</div>
            <div className="text-5xl font-bold mt-2 text-white">{sortedCandidates[0]?.finalScore.toFixed(0) || 0}<span className="text-lg font-normal text-blue-300">/100</span></div>
          </div>
          <button 
            onClick={handleDownload}
            className="mt-6 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors py-2.5 px-4 rounded-lg text-sm font-bold shadow-lg"
          >
            <Download className="w-4 h-4" /> Download Full Report
          </button>
        </div>
      </div>

      {/* Candidates List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            Candidates Ranked
            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{candidates.length} total</span>
        </h3>
        {sortedCandidates.map((candidate, idx) => (
          <div key={candidate.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md hover:border-blue-200">
            
            {/* Header Row */}
            <div 
              onClick={() => toggleExpand(candidate.id)}
              className="p-4 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-5">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm
                  ${idx === 0 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 ring-offset-2' : 'bg-slate-100 text-slate-600'}
                `}>
                  {idx + 1}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">{candidate.candidateName}</h4>
                  <div className="flex gap-3 text-xs mt-1 items-center">
                     <span className={`px-2.5 py-0.5 rounded-md font-semibold border ${
                       candidate.fitLabel === 'High' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                       candidate.fitLabel === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                       'bg-red-50 text-red-700 border-red-200'
                     }`}>
                       {candidate.fitLabel} Fit
                     </span>
                     <span className="text-slate-500 font-medium">Match Score: <span className="text-slate-900">{candidate.finalScore.toFixed(1)}</span></span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                 {/* Mini Chart for Attributes */}
                 <div className="hidden md:flex gap-1.5 h-10 items-end p-1">
                    {[
                      { l: 'Skills', v: candidate.ratings.skillsMatch, c: 'bg-blue-600' },
                      { l: 'Exp', v: candidate.ratings.experienceRelevance, c: 'bg-indigo-500' },
                      { l: 'Qual', v: candidate.ratings.qualifications, c: 'bg-violet-500' },
                    ].map((bar, i) => (
                      <div key={i} className="w-3 rounded-sm bg-slate-100 relative group h-full flex items-end overflow-hidden" title={`${bar.l}: ${bar.v}%`}>
                        <div 
                          className={`w-full rounded-sm ${bar.c} transition-all duration-500`} 
                          style={{ height: `${bar.v}%` }}
                        />
                      </div>
                    ))}
                 </div>
                 {expandedId === candidate.id ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedId === candidate.id && (
              <div className="border-t border-slate-100 bg-slate-50">
                
                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10">
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleTabChange(candidate, 'analysis'); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'analysis' ? 'text-[#1e3a8a] border-[#1e3a8a] bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                    >
                        <FileText className="w-4 h-4" /> Assessment
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleTabChange(candidate, 'questions'); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'questions' ? 'text-[#1e3a8a] border-[#1e3a8a] bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                    >
                        <MessageSquare className="w-4 h-4" /> Interview Guide
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleTabChange(candidate, 'email'); }}
                        className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors border-b-2 ${activeTab === 'email' ? 'text-[#1e3a8a] border-[#1e3a8a] bg-blue-50/30' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
                    >
                        <Mail className="w-4 h-4" /> Communication
                    </button>
                </div>

                <div className="p-6">
                
                {/* TAB 1: Analysis */}
                {activeTab === 'analysis' && (
                  <div className="animate-fade-in">
                    <div className="mb-6 bg-white p-5 rounded-lg border-l-4 border-blue-600 shadow-sm">
                      <h5 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" /> Executive Summary
                      </h5>
                      <p className="text-sm text-slate-700 leading-relaxed">{candidate.reasoning}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-emerald-500" /> Matched Competencies
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {candidate.skillsFound.map(s => (
                              <span key={s} className="px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 shadow-sm">{s}</span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <XCircle className="w-4 h-4 text-red-500" /> Missing Competencies
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {candidate.skillsMissing.length > 0 ? candidate.skillsMissing.map(s => (
                              <span key={s} className="px-2.5 py-1 bg-red-50 border border-red-100 rounded-md text-xs font-medium text-red-600">{s}</span>
                            )) : <span className="text-xs text-slate-500 italic">No significant gaps detected</span>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <h5 className="text-sm font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2">Key Strengths</h5>
                          <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 marker:text-emerald-500">
                            {candidate.strengths.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                          <h5 className="text-sm font-semibold text-slate-800 mb-3 border-b border-slate-100 pb-2">Areas for Investigation</h5>
                          <ul className="list-disc list-inside text-sm text-slate-600 space-y-2 marker:text-red-500">
                            {candidate.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                          <h5 className="text-sm font-bold text-slate-800 mb-2">Experience Overview</h5>
                          <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded border border-slate-100">{candidate.experienceSummary}</p>
                       </div>
                       <div>
                          <h5 className="text-sm font-bold text-slate-800 mb-2">Notable Achievements</h5>
                          <ul className="text-sm text-slate-600 space-y-2">
                            {candidate.achievements.map((a, i) => (
                               <li key={i} className="flex gap-2 items-start">
                                 <span className="text-blue-500 mt-1">•</span>
                                 <span>{a}</span>
                               </li>
                            ))}
                          </ul>
                       </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Interview Questions */}
                {activeTab === 'questions' && (
                  <div className="animate-fade-in space-y-6">
                     {loadingAction === 'questions' ? (
                       <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                         <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#1e3a8a]" />
                         <p className="text-sm font-medium">Generating interview guide...</p>
                       </div>
                     ) : (
                       questionsMap[candidate.id] ? (
                         <>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-4">
                               <div className="bg-amber-100 p-2 rounded-full h-fit text-amber-600"><MessageSquare className="w-4 h-4" /></div>
                               <div>
                                 <h5 className="text-amber-900 font-bold text-sm mb-1">Generated Interview Guide</h5>
                                 <p className="text-amber-800 text-sm">
                                   These questions are AI-generated to specifically target the candidate's missing skills ({candidate.skillsMissing.length}) and validate their strengths.
                                 </p>
                               </div>
                            </div>
                            <div className="space-y-4">
                              {questionsMap[candidate.id].map((q, i) => (
                                <div key={i} className="flex gap-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                                   <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-xs font-bold font-mono">
                                     {i+1}
                                   </span>
                                   <div className="flex-1">
                                      <p className="text-slate-800 text-sm font-medium pt-1.5">{q}</p>
                                      <div className="mt-2 pt-2 border-t border-slate-50">
                                         <p className="text-xs text-slate-400 uppercase font-semibold">Evaluator Notes:</p>
                                         <div className="h-16 border-b border-slate-100"></div>
                                      </div>
                                   </div>
                                </div>
                              ))}
                            </div>
                         </>
                       ) : <div className="text-center py-8 text-slate-400">Failed to load questions.</div>
                     )}
                  </div>
                )}

                {/* TAB 3: Email Action */}
                {activeTab === 'email' && (
                  <div className="animate-fade-in">
                    {loadingAction === 'email' ? (
                       <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                         <Loader2 className="w-8 h-8 animate-spin mb-3 text-[#1e3a8a]" />
                         <p className="text-sm font-medium">Drafting communication...</p>
                       </div>
                     ) : (
                       emailMap[candidate.id] ? (
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                           <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                              <span className="text-sm font-bold text-slate-700">Draft: {candidate.fitLabel === 'Low' ? 'Rejection' : 'Invitation'}</span>
                              <button 
                                onClick={() => navigator.clipboard.writeText(emailMap[candidate.id])}
                                className="text-[#1e3a8a] hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-colors"
                              >
                                <Copy className="w-3 h-3" /> Copy to Clipboard
                              </button>
                           </div>
                           <div className="p-6">
                              <textarea 
                                readOnly 
                                className="w-full h-80 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono leading-relaxed"
                                value={emailMap[candidate.id]}
                              />
                           </div>
                        </div>
                       ) : <div className="text-center py-8 text-slate-400">Failed to generate email.</div>
                     )}
                  </div>
                )}
                
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;