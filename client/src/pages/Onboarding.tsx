import React from 'react';
import { useStore } from '@/lib/store';
import { useLocation } from 'wouter';
import { ShieldAlert, ArrowRight, Target, Sun, Dumbbell, Utensils, Smile } from 'lucide-react';

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
        <div className="mb-8 p-6 rounded-full bg-red-500/10 animate-pulse shadow-[0_0_40px_rgba(239,68,68,0.2)]">
          <ShieldAlert className="w-16 h-16 text-red-500" />
        </div>
        
        <h1 className="text-4xl font-bold mb-2 tracking-tighter text-white">TRACE-9</h1>
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] mb-12 font-bold">
          System Initialization
        </p>

        <div className="bg-card border border-border/50 p-8 rounded-3xl mb-8 text-left space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50" />
          
          <h2 className="text-sm text-red-500 uppercase font-bold flex items-center gap-2">
            <ShieldAlert size={16} />
            Mandatory Disclaimer
          </h2>
          <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
            <p>
              Trace-9 provides highly personalized data analysis and self-experimentation hypotheses based on your inputs.
            </p>
            <p className="font-bold text-white">
              The insights and suggested interventions from this application are NOT a substitute for professional medical advice, diagnosis, or treatment.
            </p>
            <p className="text-xs text-gray-500 italic">
              Always seek the advice of a qualified healthcare provider with any questions you may have regarding a medical condition.
            </p>
          </div>
        </div>

        <button 
          onClick={handleDisclaimerAccept}
          className="w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-gray-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 group shadow-lg"
          data-testid="button-accept-disclaimer"
        >
          I ACCEPT & PROCEED
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-md mx-auto flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tighter mb-2">Target Setup</h1>
        <p className="text-muted-foreground text-sm font-medium">
          Define your baseline metrics for accurate analysis.
        </p>
      </div>

      <div className="space-y-8 flex-1">
        
        {/* Protein */}
        <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex justify-between items-center">
            <span className="flex items-center gap-2"><Utensils size={14} /> Protein Target</span>
            <span className="text-white text-lg">{targets.protein}g</span>
          </label>
          <input 
            type="range" 
            min="50" max="250" step="5"
            value={targets.protein}
            onChange={(e) => setLocalTargets({...targets, protein: parseInt(e.target.value)})}
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-white"
          />
        </div>

        {/* Gut Score */}
        <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Smile size={14} /> Target Gut Health
          </label>
          <div className="flex justify-between gap-2">
            {[1,2,3,4,5].map(v => (
              <button
                key={v}
                onClick={() => setLocalTargets({...targets, gut: v})}
                className={`flex-1 aspect-square rounded-xl font-bold text-lg transition-all ${
                  targets.gut === v 
                    ? 'bg-white text-black shadow-lg scale-110' 
                    : 'bg-secondary/30 text-gray-500 hover:bg-secondary'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Sun Exposure */}
        <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sun size={14} /> Sun Exposure Goal
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 1, label: 'None' },
              { val: 3, label: 'Partial' },
              { val: 5, label: 'Full' }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setLocalTargets({...targets, sun: opt.val})}
                className={`py-3 rounded-xl text-xs font-bold transition-all ${
                  targets.sun === opt.val 
                    ? 'bg-white text-black shadow-lg' 
                    : 'bg-secondary/30 text-gray-500 hover:bg-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

         {/* Exercise */}
         <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Dumbbell size={14} /> Target Intensity
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 1, label: 'Rest' },
              { val: 2, label: 'Lite' },
              { val: 4, label: 'Med' },
              { val: 5, label: 'Hard' }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setLocalTargets({...targets, exercise: opt.val})}
                className={`py-3 rounded-xl text-[10px] font-bold transition-all ${
                  targets.exercise === opt.val 
                    ? 'bg-white text-black shadow-lg' 
                    : 'bg-secondary/30 text-gray-500 hover:bg-secondary'
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
        className="mt-8 w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-gray-200 hover:scale-[1.02] transition-all shadow-lg"
        data-testid="button-complete-setup"
      >
        INITIALIZE DASHBOARD
      </button>
    </div>
  );
}
