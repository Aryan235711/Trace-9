import React from 'react';
import { useStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { FlaskConical, Check, X, Clock } from 'lucide-react';

export default function History() {
  const { pastInterventions, activeIntervention, startIntervention, completeIntervention } = useStore();
  const [newInterventionText, setNewInterventionText] = React.useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInterventionText.trim()) return;
    startIntervention(newInterventionText);
    setNewInterventionText('');
  };

  return (
    <div className="p-4 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
       {/* HEADER */}
       <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tighter">INTERVENTION LOG</h1>
        <p className="text-xs font-mono text-muted-foreground">
          EXPERIMENTAL HISTORY & ACTIVE TESTS
        </p>
      </div>

      {/* ACTIVE INTERVENTION CARD */}
      <section>
        <h2 className="font-mono text-xs text-muted-foreground mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-flag-yellow inline-block animate-pulse"></span>
          CURRENT EXPERIMENT
        </h2>

        {activeIntervention ? (
          <div className="bg-card border border-flag-yellow/30 p-5 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-lg leading-tight">"{activeIntervention.text}"</h3>
              <Clock className="text-flag-yellow w-5 h-5" />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-mono opacity-70">
              <div>
                <span className="block text-muted-foreground">STARTED</span>
                {format(parseISO(activeIntervention.startDate), 'MMM dd, yyyy')}
              </div>
              <div className="text-right">
                <span className="block text-muted-foreground">ENDS</span>
                {format(parseISO(activeIntervention.endDate), 'MMM dd, yyyy')}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs font-mono mb-2 text-center">EARLY CHECK-IN / COMPLETE</p>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => completeIntervention('Yes')}
                  className="p-3 border border-gray-800 hover:border-flag-green hover:bg-flag-green/10 hover:text-flag-green transition-all flex flex-col items-center gap-1"
                >
                  <Check size={16} />
                  <span className="text-[10px] font-bold">WORKED</span>
                </button>
                <button 
                  onClick={() => completeIntervention('Partial')}
                   className="p-3 border border-gray-800 hover:border-flag-yellow hover:bg-flag-yellow/10 hover:text-flag-yellow transition-all flex flex-col items-center gap-1"
                >
                  <FlaskConical size={16} />
                   <span className="text-[10px] font-bold">UNCLEAR</span>
                </button>
                <button 
                  onClick={() => completeIntervention('No')}
                   className="p-3 border border-gray-800 hover:border-flag-red hover:bg-flag-red/10 hover:text-flag-red transition-all flex flex-col items-center gap-1"
                >
                  <X size={16} />
                   <span className="text-[10px] font-bold">FAILED</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-gray-800 p-6 text-center space-y-4">
             <p className="text-sm text-muted-foreground">No active experiments.</p>
             <form onSubmit={handleCreate} className="space-y-2">
               <input 
                  type="text" 
                  placeholder="Define a new hypothesis..."
                  value={newInterventionText}
                  onChange={(e) => setNewInterventionText(e.target.value)}
                  className="w-full bg-black border border-gray-800 p-2 text-sm focus:border-white focus:outline-none"
               />
               <button 
                type="submit"
                disabled={!newInterventionText}
                className="w-full bg-white text-black font-mono text-xs font-bold py-3 hover:bg-gray-200 disabled:opacity-50"
               >
                 START 7-DAY TEST
               </button>
             </form>
          </div>
        )}
      </section>

      {/* HISTORY LIST */}
      <section>
        <h2 className="font-mono text-xs text-muted-foreground mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-gray-700 inline-block"></span>
          PAST LOGS
        </h2>
        
        <div className="space-y-3">
          {pastInterventions.length === 0 && (
            <p className="text-xs text-gray-600 italic">No completed interventions yet.</p>
          )}

          {pastInterventions.map((int) => (
            <div key={int.id} className="bg-card border border-border p-4 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
              <div>
                <p className="font-bold text-sm mb-1">{int.text}</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {format(parseISO(int.startDate), 'MMM dd')} - {format(parseISO(int.endDate), 'MMM dd')}
                </p>
              </div>
              <div className={`px-2 py-1 text-[10px] font-bold font-mono border ${
                int.result === 'Yes' ? 'text-flag-green border-flag-green' :
                int.result === 'No' ? 'text-flag-red border-flag-red' :
                'text-flag-yellow border-flag-yellow'
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
