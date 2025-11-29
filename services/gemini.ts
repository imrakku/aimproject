import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIResponseRaw, CandidateAnalysis } from '../types';

const MODEL_NAME = 'gemini-2.5-flash';

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING, description: "The full name of the candidate extracted from the CV." },
    skillsFound: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of technical and soft skills found in the CV that match or are relevant to the JD."
    },
    skillsMissing: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of important skills mentioned in the JD that are absent in the CV."
    },
    qualifications: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Degrees, certifications, and educational background found."
    },
    achievements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key achievements, preferably with metrics (numbers, percentages)."
    },
    experienceSummary: { type: Type.STRING, description: "A concise summary of the candidate's relevant experience history." },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of key strengths relative to the JD."
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of potential weaknesses or gaps relative to the JD."
    },
    ratings: {
      type: Type.OBJECT,
      properties: {
        skillsMatch: { type: Type.NUMBER, description: "Score 0-100 based on how well skills match." },
        experienceRelevance: { type: Type.NUMBER, description: "Score 0-100 based on relevance of experience." },
        qualifications: { type: Type.NUMBER, description: "Score 0-100 based on educational fit." },
        seniority: { type: Type.NUMBER, description: "Score 0-100 based on seniority level fit." },
        clarity: { type: Type.NUMBER, description: "Score 0-100 based on CV formatting and clarity." }
      },
      required: ["skillsMatch", "experienceRelevance", "qualifications", "seniority", "clarity"]
    },
    reasoning: { type: Type.STRING, description: "A short paragraph explaining the rationale behind the scores." }
  },
  required: ["candidateName", "skillsFound", "skillsMissing", "qualifications", "achievements", "experienceSummary", "strengths", "weaknesses", "ratings", "reasoning"]
};

export const analyzeCandidate = async (
  jdBase64: string,
  jdMimeType: string,
  cvBase64: string,
  cvMimeType: string
): Promise<AIResponseRaw> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are an expert technical recruiter.
      I will provide you with a Job Description (JD) and a Candidate CV.
      Your task is to extract information and score the candidate against the JD.
      
      Be strict but fair. Look for semantic matches in skills (e.g., 'React' matches 'React.js').
      If the CV is unreadable or not a CV, return a low score and indicate this in the reasoning.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: jdMimeType,
              data: jdBase64
            }
          },
          { text: "Above is the Job Description. Below is the Candidate CV." },
          {
            inlineData: {
              mimeType: cvMimeType,
              data: cvBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      }
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    const data = JSON.parse(response.text) as AIResponseRaw;
    return data;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      candidateName: "Unknown Candidate (Parse Error)",
      skillsFound: [],
      skillsMissing: [],
      qualifications: [],
      achievements: [],
      experienceSummary: "Failed to process this file.",
      strengths: [],
      weaknesses: ["File could not be analyzed by AI"],
      ratings: {
        skillsMatch: 0,
        experienceRelevance: 0,
        qualifications: 0,
        seniority: 0,
        clarity: 0
      },
      reasoning: "An error occurred during AI processing. Please check the file format or try again."
    };
  }
};

export const generateInterviewQuestions = async (candidate: CandidateAnalysis): Promise<string[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Based on the following candidate analysis, generate 5 interview questions.
    
    Candidate: ${candidate.candidateName}
    Missing Skills: ${candidate.skillsMissing.join(', ')}
    Weaknesses: ${candidate.weaknesses.join(', ')}
    Strengths: ${candidate.strengths.join(', ')}

    The questions should specifically probe the candidate's missing skills and weaknesses to verify if they are actual gaps or just missing from the CV. Include 1 behavioral question based on their strengths.
    Return ONLY a JSON array of strings.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { role: 'user', parts: [{ text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const generateEmailDraft = async (candidate: CandidateAnalysis, type: 'reject' | 'invite'): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Write a professional ${type === 'invite' ? 'interview invitation' : 'rejection'} email for a candidate named ${candidate.candidateName}.
    
    Context:
    - Role: (Implied from context, keep generic or use placeholders like [Role Name])
    - Key Strengths detected: ${candidate.strengths.slice(0, 2).join(', ')}
    - Overall Fit: ${candidate.fitLabel}
    
    Keep it polite, professional, and concise. Do not include subject lines, just the body.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { role: 'user', parts: [{ text: prompt }] }
  });

  return response.text || "Could not generate email.";
};
