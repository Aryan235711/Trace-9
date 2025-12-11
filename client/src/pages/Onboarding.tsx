import React from 'react';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import { ShieldAlert, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const { acceptDisclaimer, setTargets, hasAcceptedDisclaimer } = useStore();
  const [step, setStep] = React.useState<'disclaimer' | 'goals'>('disclaimer');
  const [location, setLocation] = useLocation();

  // Goals State
  const [targets, setLocalTargets] = React.useState({
    protein: 100,
    gut: 5,
    sun: 5,
    exercise: 5
  });

  const handleDisclaimerAccept = () => {
    acceptDisclaimer();
    setStep('goals');
  };

  const handleGoalsSubmit = () => {
    setTargets(targets);
    setLocation('/');
  };

  if (step === 'disclaimer') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="mb-8 p-4 border border-red-500/20 rounded-full bg-red-900/10 animate-pulse">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2 tracking-tighter">TRACE-9</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest mb-8">
          System Initialization
        </p>

        <div className="border border-border p-6 bg-card mb-8 text-left space-y-4 shadow-2xl">
          <h2 className="font-mono text-sm text-red-500 uppercase font-bold border-b border-red-900/30 pb-2">
            Mandatory Disclaimer
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Trace-9 provides highly personalized data analysis and self-experimentation hypotheses based on your inputs.
          </p>
          <p className="text-sm text-gray-300 leading-relaxed font-bold">
            The insights and suggested interventions from this application are NOT a substitute for professional medical advice, diagnosis, or treatment.
          </p>
          <p className="text-xs text-gray-500 italic">
            Always seek the advice of a qualified healthcare provider with any questions you may have regarding a medical condition.
          </p>
        </div>

        <button 
          onClick={handleDisclaimerAccept}
          className="w-full bg-white text-black font-mono font-bold py-4 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 group"
          data-testid="button-accept-disclaimer"
        >
          I ACCEPT & PROCEED
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 max-w-md mx-auto flex flex-col">
      <h1 className="text-2xl font-bold mb-1 tracking-tighter">TARGET SETUP</h1>
      <p className="text-muted-foreground font-mono text-xs mb-8">
        DEFINE YOUR BASELINE METRICS
      </p>

      <div className="space-y-8 flex-1">
        
        {/* Protein */}
        <div className="space-y-2">
          <label className="font-mono text-xs uppercase text-gray-400 flex justify-between">
            <span>Daily Protein Target</span>
            <span className="text-white">{targets.protein}g</span>
          </label>
          <input 
            type="range" 
            min="50" max="250" step="5"
            value={targets.protein}
            onChange={(e) => setLocalTargets({...targets, protein: parseInt(e.target.value)})}
            className="w-full accent-white h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Gut Score */}
        <div className="space-y-2">
          <label className="font-mono text-xs uppercase text-gray-400">
            Target Gut Health (1-5)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5].map(v => (
              <button
                key={v}
                onClick={() => setLocalTargets({...targets, gut: v})}
                className={`h-12 border font-mono font-bold transition-all ${
                  targets.gut === v 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Sun Exposure */}
        <div className="space-y-2">
          <label className="font-mono text-xs uppercase text-gray-400">
            Daily Sun Exposure Goal
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 1, label: 'NONE' },
              { val: 3, label: 'PARTIAL' },
              { val: 5, label: 'FULL' }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setLocalTargets({...targets, sun: opt.val})}
                className={`h-12 border font-mono text-xs font-bold transition-all ${
                  targets.sun === opt.val 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

         {/* Exercise */}
         <div className="space-y-2">
          <label className="font-mono text-xs uppercase text-gray-400">
            Target Intensity
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 1, label: 'REST' },
              { val: 2, label: 'LITE' },
              { val: 4, label: 'MED' },
              { val: 5, label: 'HARD' }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setLocalTargets({...targets, exercise: opt.val})}
                className={`h-12 border font-mono text-[10px] font-bold transition-all ${
                  targets.exercise === opt.val 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent text-gray-500 border-gray-800 hover:border-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      <button 
        onClick={handleGoalsSubmit}
        className="mt-8 w-full bg-white text-black font-mono font-bold py-4 hover:bg-gray-200 transition-colors"
        data-testid="button-complete-setup"
      >
        INITIALIZE DASHBOARD
      </button>
    </div>
  );
}
