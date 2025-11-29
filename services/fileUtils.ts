import { CandidateAnalysis } from '../types';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateCSV = (candidates: CandidateAnalysis[]): string => {
  const headers = [
    'Rank',
    'Name',
    'Total Score',
    'Fit Label',
    'Skills Match (0-100)',
    'Experience (0-100)',
    'Qualifications (0-100)',
    'Strengths',
    'Weaknesses'
  ];

  const rows = candidates
    .sort((a, b) => b.finalScore - a.finalScore)
    .map((c, index) => [
      (index + 1).toString(),
      `"${c.candidateName.replace(/"/g, '""')}"`,
      c.finalScore.toFixed(1),
      c.fitLabel,
      c.ratings.skillsMatch.toString(),
      c.ratings.experienceRelevance.toString(),
      c.ratings.qualifications.toString(),
      `"${c.strengths.join('; ').replace(/"/g, '""')}"`,
      `"${c.weaknesses.join('; ').replace(/"/g, '""')}"`
    ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
