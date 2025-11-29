import React from 'react';
import { ScoringWeights } from '../types';
import { Sliders } from 'lucide-react';

interface Props {
  weights: ScoringWeights;
  setWeights: (w: ScoringWeights) => void;
  disabled: boolean;
}

const ScoringConfig: React.FC<Props> = ({ weights, setWeights, disabled }) => {
  const handleChange = (key: keyof ScoringWeights, value: number) => {
    setWeights({ ...weights, [key]: value });
  };

  // Explicitly cast to number[] to fix TS error: Operator '+' cannot be applied to types 'unknown' and 'unknown'.
  const total = (Object.values(weights) as number[]).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-md text-[#1e3a8a]">
                <Sliders className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Evaluation Criteria</h3>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-md ${total === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          Total: {total}%
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {Object.entries(weights).map(([key, val]) => (
          <div key={key} className="space-y-3">
            <div className="flex justify-between text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span>{val}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={val}
              onChange={(e) => handleChange(key as keyof ScoringWeights, parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a8a] disabled:opacity-50 hover:accent-blue-700 transition-all"
            />
          </div>
        ))}
      </div>
      {total !== 100 && (
         <p className="text-xs text-amber-600 mt-4 text-right font-medium">* Ensure total weight equals 100% for accurate scoring.</p>
      )}
    </div>
  );
};

export default ScoringConfig;