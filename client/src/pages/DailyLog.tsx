import React from 'react';
import { useStore, Flag } from '@/lib/store';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { ChevronLeft, Save } from 'lucide-react';

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

  const InputSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="space-y-4 pt-4 border-t border-border first:border-0 first:pt-0">
      <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );

  return (
    <div className="p-4 min-h-screen bg-background pb-32">
       <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setLocation('/')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">DAILY LOG</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        <InputSection title="Wearables Data">
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-card border border-border p-4">
              <label className="block text-xs font-mono text-gray-400 mb-2">SLEEP DURATION (HRS)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="3" max="12" step="0.1"
                  value={formData.sleep}
                  onChange={e => setFormData({...formData, sleep: parseFloat(e.target.value)})}
                  className="flex-1 accent-white h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono text-xl font-bold w-16 text-right">{formData.sleep}h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border p-4">
                <label className="block text-xs font-mono text-gray-400 mb-2">RHR (BPM)</label>
                <input 
                  type="number"
                  value={formData.rhr}
                  onChange={e => setFormData({...formData, rhr: parseInt(e.target.value)})}
                  className="w-full bg-black border-b border-gray-700 text-2xl font-bold py-1 focus:outline-none focus:border-white transition-colors"
                />
              </div>
              <div className="bg-card border border-border p-4">
                <label className="block text-xs font-mono text-gray-400 mb-2">HRV (MS)</label>
                <input 
                  type="number"
                  value={formData.hrv}
                  onChange={e => setFormData({...formData, hrv: parseInt(e.target.value)})}
                  className="w-full bg-black border-b border-gray-700 text-2xl font-bold py-1 focus:outline-none focus:border-white transition-colors"
                />
              </div>
            </div>
          </div>
        </InputSection>

        <InputSection title="Manual Inputs">
           {/* Protein */}
           <div className="bg-card border border-border p-4">
              <label className="block text-xs font-mono text-gray-400 mb-2">PROTEIN INTAKE (G)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="0" max="300" step="5"
                  value={formData.protein}
                  onChange={e => setFormData({...formData, protein: parseInt(e.target.value)})}
                  className="flex-1 accent-white h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono text-xl font-bold w-16 text-right">{formData.protein}</span>
              </div>
           </div>

           {/* Toggles Grid */}
           <div className="grid grid-cols-2 gap-4">
             {/* Sun */}
             <div className="bg-card border border-border p-4 space-y-2">
               <label className="block text-xs font-mono text-gray-400">SUN EXPOSURE</label>
               <div className="flex flex-col gap-2">
                 {[
                   {val: 5, label: 'FULL'},
                   {val: 3, label: 'PARTIAL'},
                   {val: 1, label: 'NONE'}
                 ].map(opt => (
                   <button
                    key={opt.val}
                    type="button"
                    onClick={() => setFormData({...formData, sun: opt.val})}
                    className={`text-[10px] font-bold py-2 border ${
                      formData.sun === opt.val ? 'bg-white text-black border-white' : 'border-gray-800 text-gray-500'
                    }`}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
             </div>

             {/* Exercise */}
             <div className="bg-card border border-border p-4 space-y-2">
               <label className="block text-xs font-mono text-gray-400">EXERCISE</label>
               <div className="flex flex-col gap-2">
                 {[
                   {val: 5, label: 'HARD'},
                   {val: 4, label: 'MED'},
                   {val: 2, label: 'LITE'},
                   {val: 1, label: 'NONE'}
                 ].map(opt => (
                   <button
                    key={opt.val}
                    type="button"
                    onClick={() => setFormData({...formData, exercise: opt.val})}
                    className={`text-[10px] font-bold py-2 border ${
                      formData.exercise === opt.val ? 'bg-white text-black border-white' : 'border-gray-800 text-gray-500'
                    }`}
                   >
                     {opt.label}
                   </button>
                 ))}
               </div>
             </div>
           </div>
           
           {/* Gut Score */}
           <div className="bg-card border border-border p-4">
             <label className="block text-xs font-mono text-gray-400 mb-2">GUT FEELING (1-5)</label>
             <div className="flex justify-between gap-2">
                {[1,2,3,4,5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({...formData, gut: v})}
                    className={`flex-1 aspect-square flex items-center justify-center font-bold border ${
                      formData.gut === v ? 'bg-white text-black border-white' : 'border-gray-800 text-gray-500'
                    }`}
                  >
                    {v}
                  </button>
                ))}
             </div>
           </div>
        </InputSection>

        <InputSection title="Symptom Check">
           <div className="bg-card border border-border p-4 space-y-4">
             <div>
               <label className="flex justify-between text-xs font-mono text-gray-400 mb-2">
                  <span>SEVERITY (1=BEST, 5=WORST)</span>
                  <span className="text-white font-bold">{formData.symptomScore}</span>
               </label>
               <input 
                  type="range" min="1" max="5" step="1"
                  value={formData.symptomScore}
                  onChange={e => setFormData({...formData, symptomScore: parseInt(e.target.value)})}
                  className="w-full accent-white h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
             </div>
             
             <div>
               <label className="block text-xs font-mono text-gray-400 mb-2">PRIMARY SYMPTOM (OPTIONAL)</label>
               <input 
                  type="text"
                  placeholder="e.g. Brain Fog, Joint Pain..."
                  value={formData.symptomName}
                  onChange={e => setFormData({...formData, symptomName: e.target.value})}
                  className="w-full bg-black border border-gray-800 p-3 text-sm focus:border-white focus:outline-none placeholder:text-gray-700"
               />
             </div>
           </div>
        </InputSection>

        <button 
          type="submit"
          className="w-full bg-white text-black font-mono font-bold py-4 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 sticky bottom-20 shadow-xl"
        >
          <Save size={18} />
          LOG ENTRY
        </button>

      </form>
    </div>
  );
}
