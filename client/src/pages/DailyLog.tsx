import React from 'react';
import { useStore, Flag } from '@/lib/store';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ChevronLeft, Save, Moon, Activity, Heart, Sun, Dumbbell, Utensils, Smile } from 'lucide-react';

export default function DailyLog() {
  const { addLog, targets } = useStore();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = React.useState({
    sleep: 7.0,
    rhr: 60,
    hrv: 50,
    protein: targets.protein,
    gut: 4,
    sun: 3,
    exercise: 2,
    symptomScore: 2,
    symptomName: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Quick mock flagging logic (matches spec basically)
    const getFlag = (val: number, target: number, isLowerBetter = false): Flag => {
        const ratio = val / target;
        // Simplified for prototype
        if (ratio >= 0.9) return 'GREEN';
        if (ratio >= 0.8) return 'YELLOW';
        return 'RED';
    };

    addLog({
      date: format(new Date(), 'yyyy-MM-dd'),
      rawValues: formData,
      processedState: {
        sleep: getFlag(formData.sleep, 7.5),
        rhr: getFlag(60, formData.rhr), // RHR lower is better generally but for spec logic using placeholder
        hrv: getFlag(formData.hrv, 50),
        protein: getFlag(formData.protein, targets.protein),
        gut: formData.gut >= 4 ? 'GREEN' : formData.gut === 3 ? 'YELLOW' : 'RED',
        sun: formData.sun === 5 ? 'GREEN' : formData.sun === 3 ? 'YELLOW' : 'RED',
        exercise: formData.exercise >= 4 ? 'GREEN' : formData.exercise >= 2 ? 'YELLOW' : 'RED',
        symptomScore: formData.symptomScore <= 2 ? 'GREEN' : formData.symptomScore === 3 ? 'YELLOW' : 'RED',
        symptomName: 'GREEN'
      }
    });

    setLocation('/');
  };

  const InputSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} />
        <h3 className="font-bold text-xs uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="p-6 min-h-screen bg-background pb-32">
       <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setLocation('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Log</h1>
          <p className="text-xs text-muted-foreground font-medium">{format(new Date(), 'MMM do, yyyy')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        
        <InputSection title="Wearables Data" icon={Activity}>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
              <label className="block text-xs font-bold text-muted-foreground mb-4 flex items-center gap-2">
                <Moon size={14} /> SLEEP DURATION
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="3" max="12" step="0.1"
                  value={formData.sleep}
                  onChange={e => setFormData({...formData, sleep: parseFloat(e.target.value)})}
                  className="flex-1 h-12 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full"
                />
                <span className="text-3xl font-bold w-20 text-right tabular-nums">{formData.sleep}h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border/50 p-5 rounded-3xl shadow-sm">
                <label className="block text-xs font-bold text-muted-foreground mb-2">RHR (BPM)</label>
                <input 
                  type="number"
                  value={formData.rhr}
                  onChange={e => setFormData({...formData, rhr: parseInt(e.target.value)})}
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="bg-card border border-border/50 p-5 rounded-3xl shadow-sm">
                <label className="block text-xs font-bold text-muted-foreground mb-2">HRV (MS)</label>
                <input 
                  type="number"
                  value={formData.hrv}
                  onChange={e => setFormData({...formData, hrv: parseInt(e.target.value)})}
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>
        </InputSection>

        <InputSection title="Lifestyle Inputs" icon={Utensils}>
           {/* Protein */}
           <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm mb-4">
              <label className="block text-xs font-bold text-muted-foreground mb-4">PROTEIN INTAKE (G)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="0" max="300" step="5"
                  value={formData.protein}
                  onChange={e => setFormData({...formData, protein: parseInt(e.target.value)})}
                  className="flex-1 h-12 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full"
                />
                <span className="text-3xl font-bold w-20 text-right tabular-nums">{formData.protein}</span>
              </div>
           </div>

           {/* Toggles Grid */}
           <div className="grid grid-cols-2 gap-4">
             {/* Sun */}
             <div className="bg-card border border-border/50 p-5 rounded-3xl shadow-sm space-y-3">
               <label className="block text-xs font-bold text-muted-foreground flex items-center gap-2">
                 <Sun size={14} /> SUN EXPOSURE
               </label>
               <div className="flex flex-col gap-2">
                 {[
                   {val: 5, label: 'Full'},
                   {val: 3, label: 'Partial'},
                   {val: 1, label: 'None'}
                 ].map(opt => (
                   <button
                    key={opt.val}
                    type="button"
                    onClick={() => setFormData({...formData, sun: opt.val})}
                    className={`text-xs font-bold py-3 rounded-xl border transition-all ${
                      formData.sun === opt.val 
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-white/5' 
                        : 'bg-transparent border-border/50 text-muted-foreground hover:bg-secondary/50'
                    }`}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
             </div>

             {/* Exercise */}
             <div className="bg-card border border-border/50 p-5 rounded-3xl shadow-sm space-y-3">
               <label className="block text-xs font-bold text-muted-foreground flex items-center gap-2">
                 <Dumbbell size={14} /> EXERCISE
               </label>
               <div className="flex flex-col gap-2">
                 {[
                   {val: 5, label: 'Hard'},
                   {val: 4, label: 'Medium'},
                   {val: 2, label: 'Light'},
                   {val: 1, label: 'Rest'}
                 ].map(opt => (
                   <button
                    key={opt.val}
                    type="button"
                    onClick={() => setFormData({...formData, exercise: opt.val})}
                    className={`text-xs font-bold py-3 rounded-xl border transition-all ${
                      formData.exercise === opt.val 
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-white/5' 
                        : 'bg-transparent border-border/50 text-muted-foreground hover:bg-secondary/50'
                    }`}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
             </div>
           </div>
           
           {/* Gut Score */}
           <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm mt-4">
             <label className="block text-xs font-bold text-muted-foreground mb-4">GUT FEELING (1-5)</label>
             <div className="flex justify-between gap-2">
                {[1,2,3,4,5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({...formData, gut: v})}
                    className={`flex-1 aspect-square rounded-2xl flex items-center justify-center font-bold text-lg border transition-all ${
                      formData.gut === v 
                        ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-white/10 scale-110' 
                        : 'bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {v}
                  </button>
                ))}
             </div>
           </div>
        </InputSection>

        <InputSection title="Symptom Check" icon={Smile}>
           <div className="bg-card border border-border/50 p-6 rounded-3xl shadow-sm space-y-6">
             <div>
               <label className="flex justify-between text-xs font-bold text-muted-foreground mb-4">
                  <span>SEVERITY (1=BEST, 5=WORST)</span>
                  <span className="text-primary font-bold text-lg">{formData.symptomScore}</span>
               </label>
               <input 
                  type="range" min="1" max="5" step="1"
                  value={formData.symptomScore}
                  onChange={e => setFormData({...formData, symptomScore: parseInt(e.target.value)})}
                  className="w-full h-12 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full"
                />
             </div>
             
             <div>
               <label className="block text-xs font-bold text-muted-foreground mb-2">PRIMARY SYMPTOM (OPTIONAL)</label>
               <input 
                  type="text"
                  placeholder="e.g. Brain Fog, Joint Pain..."
                  value={formData.symptomName}
                  onChange={e => setFormData({...formData, symptomName: e.target.value})}
                  className="w-full bg-secondary/30 border border-transparent rounded-xl px-4 py-4 text-sm focus:bg-secondary focus:border-primary/20 focus:outline-none placeholder:text-muted-foreground/50 transition-all"
               />
             </div>
           </div>
        </InputSection>

        <button 
          type="submit"
          className="w-full bg-primary text-primary-foreground font-bold text-sm py-5 rounded-2xl hover:bg-white/90 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 sticky bottom-20 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
        >
          <Save size={20} />
          LOG ENTRY
        </button>

      </form>
    </div>
  );
}
