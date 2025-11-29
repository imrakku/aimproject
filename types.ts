export interface ScoringWeights {
  skillsMatch: number;
  experienceRelevance: number;
  qualifications: number;
  seniority: number;
  clarity: number;
}

export interface ProcessingFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  result?: CandidateAnalysis;
}

export interface AIResponseRaw {
  candidateName: string;
  skillsFound: string[];
  skillsMissing: string[];
  qualifications: string[];
  achievements: string[];
  experienceSummary: string;
  strengths: string[];
  weaknesses: string[];
  ratings: {
    skillsMatch: number; // 0-100
    experienceRelevance: number; // 0-100
    qualifications: number; // 0-100
    seniority: number; // 0-100
    clarity: number; // 0-100
  };
  reasoning: string;
}

export interface CandidateAnalysis extends AIResponseRaw {
  id: string;
  finalScore: number;
  fitLabel: 'High' | 'Medium' | 'Low';
}

export type FitLabel = 'High' | 'Medium' | 'Low';
