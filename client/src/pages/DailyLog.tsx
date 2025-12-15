import React from 'react';
import { useLocation } from 'wouter';
import { ChevronLeft, Save, Moon, Activity, Sun, Dumbbell, Utensils, Smile } from 'lucide-react';
import { useLogs } from '@/hooks/useLogs';
import { useTargets } from '@/hooks/useTargets';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatIsoLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

function formatDisplayDate(date: Date) {
  const month = MONTHS_SHORT[date.getMonth()];
  const day = date.getDate();
  return `${month} ${day}${ordinal(day)}, ${date.getFullYear()}`;
}

export default function DailyLog() {
  const [, setLocation] = useLocation();
  const { targets } = useTargets();
  const { createLogAsync, isCreating } = useLogs();

  const today = React.useMemo(() => new Date(), []);

  const [formData, setFormData] = React.useState({
    sleep: 7.0,
    rhr: 60,
    hrv: 50,
    protein: targets?.proteinTarget || 100,
    gut: 4,
    sun: 3,
    exercise: 2,
    symptomScore: 2,
  });

  const SECTION_HELP: Record<string, string[]> = {
    'Wearables Data': [
      'These are your recovery signals for the day (trend matters more than any single number).',
      'Sleep and HRV are generally better higher; RHR is generally better lower (relative to your baseline).',
    ],
    'Lifestyle Inputs': [
      'These are controllable levers you can change day-to-day.',
      'Consistency beats perfection — aim for steady patterns across the week.',
    ],
    'Symptom Check': [
      'This anchors the charts: we compare your recovery + inputs against how you felt.',
      'Try to score severity the same way each day for better signal.',
    ],
  };

  // Uncontrolled inputs to avoid re-renders/focus loss for number/text fields.
  const rhrRef = React.useRef<HTMLInputElement>(null);
  const hrvRef = React.useRef<HTMLInputElement>(null);
  const symptomRef = React.useRef<HTMLInputElement>(null);

  const parseNumber = (value: string | undefined | null, fallback: number) => {
    if (!value) return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = parseInt(trimmed, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createLogAsync({
        date: formatIsoLocalDate(today),
        sleep: formData.sleep,
        rhr: parseNumber(rhrRef.current?.value, formData.rhr),
        hrv: parseNumber(hrvRef.current?.value, formData.hrv),
        protein: formData.protein,
        gut: formData.gut,
        sun: formData.sun,
        exercise: formData.exercise,
        symptomScore: formData.symptomScore,
        symptomName: symptomRef.current?.value?.trim() || '',
      });
      setLocation('/');
    } catch (error) {
      console.error('Failed to create log:', error);
    }
  };

  const InputSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon size={16} />
        <h3 className="mono-section-label">{title}</h3>
      </div>
      {SECTION_HELP[title]?.length ? (
        <div className="mono-body-muted space-y-1">
          {SECTION_HELP[title].map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
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
          <p className="text-xs text-muted-foreground font-medium">{formatDisplayDate(today)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        
        <InputSection title="Wearables Data" icon={Activity}>
          <div className="grid grid-cols-1 gap-4">
            <div className="mono-card p-6">
              <label className="mono-section-label mb-4 flex items-center gap-2 block">
                <Moon size={14} /> SLEEP DURATION
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="3" max="12" step="0.1"
                  value={formData.sleep}
                  onChange={e => setFormData(prev => ({...prev, sleep: parseFloat(e.target.value)}))}
                  className="flex-1 h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-secondary [&::-moz-range-track]:rounded-full"
                />
                <span className="text-3xl font-bold w-20 text-right tabular-nums">{formData.sleep}h</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="mono-card p-5">
                <label className="mono-section-label mb-2 block">RHR (BPM)</label>
                <input 
                  type="number"
                  inputMode="numeric"
                  defaultValue={formData.rhr}
                  ref={rhrRef}
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="mono-card p-5">
                <label className="mono-section-label mb-2 block">HRV (MS)</label>
                <input 
                  type="number"
                  inputMode="numeric"
                  defaultValue={formData.hrv}
                  ref={hrvRef}
                  className="w-full bg-secondary/50 rounded-xl px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
          </div>
        </InputSection>

        <InputSection title="Lifestyle Inputs" icon={Utensils}>
           {/* Protein */}
            <div className="mono-card p-6 mb-4">
              <label className="mono-section-label mb-4 block">PROTEIN INTAKE (G)</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="0" max="300" step="5"
                  value={formData.protein}
                  onChange={e => setFormData(prev => ({...prev, protein: parseInt(e.target.value)}))}
                  className="flex-1 h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-secondary [&::-moz-range-track]:rounded-full"
                />
                <span className="text-3xl font-bold w-20 text-right tabular-nums">{formData.protein}</span>
              </div>
           </div>

           {/* Toggles Grid */}
           <div className="grid grid-cols-2 gap-4">
             {/* Sun */}
             <div className="mono-card p-5 space-y-3">
               <label className="mono-section-label flex items-center gap-2 block">
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
                    onClick={() => setFormData(prev => ({...prev, sun: opt.val}))}
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
             <div className="mono-card p-5 space-y-3">
               <label className="mono-section-label flex items-center gap-2 block">
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
                    onClick={() => setFormData(prev => ({...prev, exercise: opt.val}))}
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
           <div className="mono-card p-6 mt-4">
             <label className="mono-section-label mb-4 block">GUT FEELING (1-5)</label>
             <div className="flex justify-between gap-2">
                {[1,2,3,4,5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, gut: v}))}
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
            <div className="mono-card p-6 space-y-6">
             <div>
              <label className="mono-section-label mb-4 flex justify-between">
                  <span>SEVERITY (1=BEST, 5=WORST)</span>
                  <span className="text-primary font-bold text-lg">{formData.symptomScore}</span>
               </label>
               <input 
                  type="range" min="1" max="5" step="1"
                  value={formData.symptomScore}
                  onChange={e => setFormData(prev => ({...prev, symptomScore: parseInt(e.target.value)}))}
                  className="w-full h-2 bg-transparent appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-secondary [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-secondary [&::-moz-range-track]:rounded-full"
                />
             </div>
             
             <div>
               <label className="mono-section-label mb-2 block">PRIMARY SYMPTOM (OPTIONAL)</label>
               <input 
                  type="text"
                  placeholder="e.g. Brain Fog, Joint Pain..."
                defaultValue=""
                ref={symptomRef}
                  className="w-full bg-secondary border border-transparent rounded-xl px-4 py-4 text-sm focus:border-primary/50 focus:outline-none placeholder:text-muted-foreground/50 transition-all"
               />
             </div>
           </div>
        </InputSection>

        <button 
          type="submit"
          disabled={isCreating}
          className="w-full bg-primary text-primary-foreground font-bold text-sm py-5 rounded-2xl hover:bg-white/90 hover:scale-[1.01] transition-all flex items-center justify-center gap-3 sticky bottom-20 shadow-[0_0_40px_rgba(255,255,255,0.1)] z-30"
        >
          <Save size={20} />
          LOG ENTRY
        </button>

      </form>
    </div>
  );
}
