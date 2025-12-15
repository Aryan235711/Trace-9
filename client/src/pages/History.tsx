import React from 'react';
import { format, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { FlaskConical, Check, X, Clock, PlusCircle, ArrowRight } from 'lucide-react';
import { useInterventions, useActiveIntervention } from '@/hooks/useInterventions';
import { useEntitlements } from '@/hooks/useEntitlements';
import { FeatureGate } from '@/components/FeatureGate';
import { useLocation } from 'wouter';

export default function History() {
  const { interventions, createInterventionAsync, checkInInterventionAsync, isCreating, isCheckingIn } = useInterventions();
  const { activeIntervention } = useActiveIntervention();
  const { entitlements } = useEntitlements();
  const [, setLocation] = useLocation();
  const past = interventions?.filter(i => i.result) || [];
  const [newInterventionText, setNewInterventionText] = React.useState('');

  const unlockDay = activeIntervention ? startOfDay(new Date(activeIntervention.endDate)) : null;
  const today = startOfDay(new Date());

  const daysRemaining = unlockDay ? Math.max(0, differenceInCalendarDays(unlockDay, today)) : 0;
  const isInterventionComplete = Boolean(unlockDay && daysRemaining <= 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInterventionText.trim()) return;
    
    const startDate = startOfDay(new Date());
    const endDate = addDays(startDate, 7);
    
    try {
      await createInterventionAsync({
        hypothesisText: newInterventionText,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      setNewInterventionText('');
    } catch (error) {
      console.error('Failed to create intervention:', error);
    }
  };

  const handleCheckIn = async (result: 'Yes' | 'No' | 'Partial') => {
    if (!activeIntervention?.id) return;
    try {
      await checkInInterventionAsync({ id: activeIntervention.id, result });
    } catch (error) {
      console.error('Failed to check in intervention:', error);
    }
  };

  return (
    <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-28">
      
       {/* HEADER */}
       <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interventions</h1>
          <p className="text-sm font-medium text-muted-foreground">
              7-day experiments to test what changes your symptoms.
          </p>
        </div>
      </div>

      {/* ACTIVE / CREATE INTERVENTION (GATED) */}
      <section>
        <h2 className="mono-section-label mb-4 flex items-center gap-2">
          Current Experiment
        </h2>

        <FeatureGate
          allowed={entitlements.canCreateInterventions}
          label="Interventions are Pro"
          ctaLabel="Upgrade"
          onUpgrade={() => setLocation('/upgrade')}
        >
          {activeIntervention ? (
            <div className="bg-card border border-flag-yellow/30 p-6 rounded-3xl shadow-[0_0_30px_rgba(234,179,8,0.05)] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-flag-yellow/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <h3 className="font-bold text-xl leading-tight mb-1">"{activeIntervention.hypothesisText}"</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-flag-yellow/10 text-flag-yellow text-[10px] font-bold uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-flag-yellow animate-pulse" />
                    {isInterventionComplete ? 'Ready to check in' : 'In progress'}
                  </span>
                  <div className="text-xs text-muted-foreground mt-2">
                    {isInterventionComplete
                      ? 'Your experiment window is complete. Log the outcome to unlock new insights.'
                      : 'Keep logging daily. New insights are paused while this experiment is active.'}
                  </div>
                  {!isInterventionComplete && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Today’s action: complete your Daily Log.
                    </div>
                  )}
                </div>
                <div className="bg-secondary/50 p-2 rounded-full">
                  <Clock className="text-flag-yellow w-5 h-5" />
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-xs font-medium opacity-80 relative z-10">
                <div>
                  <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Started</span>
                  {format(new Date(activeIntervention.startDate), 'MMM dd, yyyy')}
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Ends</span>
                  {format(new Date(activeIntervention.endDate), 'MMM dd, yyyy')}
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <span className="block text-muted-foreground text-[10px] uppercase tracking-wider mb-0.5">Status</span>
                  {isInterventionComplete ? 'Complete' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`}
                </div>
              </div>

              <div className="pt-6 border-t border-border/50 relative z-10">
                <p className="mono-section-label text-center mb-2">Log outcome</p>
                <div className="text-xs text-muted-foreground/80 text-center mb-4">
                  {isInterventionComplete
                    ? 'How did it go overall?'
                    : `Check-in unlocks in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (on ${format(unlockDay!, 'MMM dd, yyyy')}).`}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => handleCheckIn('Yes')}
                    disabled={!isInterventionComplete || isCheckingIn}
                    className="p-4 rounded-2xl border border-border/50 hover:border-flag-green hover:bg-flag-green/10 hover:text-flag-green transition-all flex flex-col items-center gap-2 group bg-card/50"
                  >
                    <div className="p-2 rounded-full bg-secondary group-hover:bg-flag-green/20 transition-colors">
                      <Check size={18} />
                    </div>
                    <span className="text-[10px] font-bold">WORKED</span>
                  </button>
                  <button 
                    onClick={() => handleCheckIn('Partial')}
                    disabled={!isInterventionComplete || isCheckingIn}
                     className="p-4 rounded-2xl border border-border/50 hover:border-flag-yellow hover:bg-flag-yellow/10 hover:text-flag-yellow transition-all flex flex-col items-center gap-2 group bg-card/50"
                  >
                    <div className="p-2 rounded-full bg-secondary group-hover:bg-flag-yellow/20 transition-colors">
                      <FlaskConical size={18} />
                    </div>
                     <span className="text-[10px] font-bold">UNCLEAR</span>
                  </button>
                  <button 
                    onClick={() => handleCheckIn('No')}
                    disabled={!isInterventionComplete || isCheckingIn}
                     className="p-4 rounded-2xl border border-border/50 hover:border-flag-red hover:bg-flag-red/10 hover:text-flag-red transition-all flex flex-col items-center gap-2 group bg-card/50"
                  >
                    <div className="p-2 rounded-full bg-secondary group-hover:bg-flag-red/20 transition-colors">
                      <X size={18} />
                    </div>
                     <span className="text-[10px] font-bold">FAILED</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-dashed border-border p-8 rounded-3xl text-center space-y-6">
               <div className="mx-auto w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
                 <PlusCircle className="text-muted-foreground w-6 h-6" />
               </div>
               <div className="space-y-2">
                 <h3 className="font-bold text-foreground">No active experiments</h3>
                 <p className="text-sm text-muted-foreground">
                   Keep logging daily — Trace starts an intervention when it detects a consistent pattern. You can also start one manually.
                 </p>
               </div>
               
               <form onSubmit={handleCreate} className="space-y-3 relative">
                 <input 
                    type="text" 
                    placeholder="e.g. Increase protein to 150g..."
                    value={newInterventionText}
                    onChange={(e) => setNewInterventionText(e.target.value)}
                    className="w-full bg-secondary/30 border border-transparent rounded-xl px-4 py-4 text-sm focus:bg-secondary focus:border-primary/20 focus:outline-none placeholder:text-muted-foreground/50 transition-all pr-12"
                 />
                 <button 
                  type="submit"
                  disabled={!newInterventionText.trim() || isCreating}
                  className="absolute right-2 top-2 bottom-2 aspect-square bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:bg-white/90 disabled:opacity-0 disabled:scale-90 transition-all"
                 >
                   <ArrowRight size={18} />
                 </button>
               </form>
            </div>
          )}
        </FeatureGate>
      </section>

      {/* HISTORY LIST */}
      <section>
        <h2 className="mono-section-label mb-4 flex items-center gap-2">
          Past Experiments
        </h2>
        
        <div className="space-y-3">
          {past.length === 0 && (
            <p className="text-sm text-muted-foreground/50 italic text-center py-8">No completed experiments yet.</p>
          )}

          {past.map((int) => (
            <div key={int.id} className="bg-card border border-border/50 p-5 rounded-2xl flex justify-between items-center group hover:border-border transition-colors">
              <div>
                <p className="font-bold text-sm mb-1 group-hover:text-white transition-colors">{int.hypothesisText}</p>
                <p className="text-[10px] font-medium text-muted-foreground">
                  {format(new Date(int.startDate), 'MMM dd')} - {format(new Date(int.endDate), 'MMM dd')}
                </p>
              </div>
              <div className={`px-3 py-1.5 text-[10px] font-bold rounded-full border ${
                int.result === 'Yes' ? 'text-flag-green border-flag-green/30 bg-flag-green/10' :
                int.result === 'No' ? 'text-flag-red border-flag-red/30 bg-flag-red/10' :
                'text-flag-yellow border-flag-yellow/30 bg-flag-yellow/10'
              }`}>
                {int.result?.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
