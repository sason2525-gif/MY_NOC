import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Wifi, WifiOff, User, Zap, FileText, AlertCircle, 
  Smartphone, Trash2, CheckCircle2, XCircle, Edit3, 
  ClipboardCheck, Sparkles, Clock, ExternalLink, ShieldCheck 
} from 'lucide-react';
import { ShiftType, SiteFault, PlannedWork, GeneralNote } from './types';
import { getCurrentShift, Card } from './constants';
import { generateAISummary } from './geminiService';
import { 
  getShiftId, syncFaults, syncPlanned, syncNotes, syncShiftDetails, 
  dbAddFault, dbUpdateFault, dbDeleteFault, dbAddPlanned, 
  dbDeletePlanned, dbAddNote, dbDeleteNote, dbUpdateShiftDetails, db
} from './firebaseService';

const App: React.FC = () => {
  const [today] = useState(new Date().toLocaleDateString('he-IL'));
  const currentShiftType = getCurrentShift() as ShiftType;
  const shiftDocId = getShiftId(today, currentShiftType);

  const [faults, setFaults] = useState<SiteFault[]>([]);
  const [plannedWorks, setPlannedWorks] = useState<PlannedWork[]>([]);
  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [controllers, setControllers] = useState<[string, string]>(['', '']);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const [faultForm, setFaultForm] = useState({
    siteNumber: '', siteName: '', reason: '', downtime: '', isPower: false, battery: ''
  });
  const [newPlanned, setNewPlanned] = useState('');
  const [newNote, setNewNote] = useState('');

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!db) return;
    
    const unsubFaults = syncFaults(shiftDocId, 
      (data) => {
        setFaults(data as SiteFault[]);
        setIsConnected(true);
        setIndexError(null);
      },
      (err) => {
        if (err.message?.includes('index')) {
          const linkMatch = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
          setIndexError(linkMatch ? linkMatch[0] : "חסר אינדקס ב-Firebase.");
        }
      }
    );

    const unsubPlanned = syncPlanned(shiftDocId, (data) => {
      setPlannedWorks(data as PlannedWork[]);
    });

    const unsubNotes = syncNotes(shiftDocId, (data) => {
      setNotes(data as GeneralNote[]);
    });

    const unsubShift = syncShiftDetails(shiftDocId, (data) => {
      if (data.controllers) setControllers(data.controllers);
    });

    return () => {
      unsubFaults();
      unsubPlanned();
      unsubNotes();
      unsubShift();
    };
  }, [shiftDocId]);

  const updateControllersCloud = (newControllers: [string, string]) => {
    setControllers(newControllers);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      dbUpdateShiftDetails(shiftDocId, { controllers: newControllers });
    }, 1000);
  };

  const addFault = async () => {
    if (!faultForm.siteNumber || !faultForm.siteName) return;
    await dbAddFault(shiftDocId, {
      siteNumber: faultForm.siteNumber,
      siteName: faultForm.siteName,
      reason: faultForm.reason,
      downtime: faultForm.downtime,
      isPowerIssue: faultForm.isPower,
      batteryBackupTime: faultForm.battery,
      status: 'open',
      treatment: ''
    });
    setFaultForm({ siteNumber: '', siteName: '', reason: '', downtime: '', isPower: false, battery: '' });
  };

  const addPlanned = async () => {
    if (!newPlanned.trim()) return;
    await dbAddPlanned(shiftDocId, newPlanned);
    setNewPlanned('');
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await dbAddNote(shiftDocId, newNote);
    setNewNote('');
  };

  const buildSummaryText = (isWhatsApp: boolean) => {
    const b = (t: string) => isWhatsApp ? `*${t}*` : t;
    let text = `${b(`סיכום משמרת NOC - ${currentShiftType}`)}\nתאריך: ${today}\nבקרים: ${controllers.filter(Boolean).join(' ו- ')}\n\n`;
    
    const closed = faults.filter(f => f.status === 'closed');
    const open = faults.filter(f => f.status === 'open');
    
    text += `${b('תקלות שנסגרו:')}\n${closed.length ? closed.map((f, i) => `${i+1}. אתר ${f.siteNumber} (${f.siteName})`).join('\n') : 'אין'}\n\n`;
    text += `${b('תקלות פתוחות:')}\n${open.length ? open.map((f, i) => `${i+1}. אתר ${f.siteNumber} (${f.siteName})`).join('\n') : 'אין'}\n\n`;
    text += `${b('עבודות יזומות:')}\n${plannedWorks.length ? plannedWorks.map((p, i) => `${i+1}. ${p.description}`).join('\n') : 'אין'}\n\n`;
    text += `${b('אירועים חריגים:')}\n${notes.length ? notes.map((n, i) => `${i+1}. ${n.content}`).join('\n') : 'אין'}`;
    
    if (aiResult) {
      text += `\n\n${b('סיכום AI:')}\n${aiResult}`;
    }
    
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {indexError && (
        <div className="bg-amber-500 text-white p-4 text-sm font-bold flex items-center justify-between animate-in fade-in duration-500">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} />
            <span>חסר אינדקס ב-Firebase. לחץ על הקישור ליצירה:</span>
          </div>
          {indexError.startsWith('http') && (
            <a href={indexError} target="_blank" rel="noreferrer" className="bg-white text-amber-600 px-3 py-1 rounded-lg flex items-center gap-1 hover:bg-amber-50 transition shadow-sm font-bold">
              יצירת אינדקס <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black text-gray-800 tracking-tight">ControlShift</h1>
                <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-blue-100">noc1</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {isConnected ? (
                  <div className="flex items-center gap-1.5 text-green-500 text-[11px] font-bold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    מחובר לסנכרון ענן
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-400 text-[11px] font-bold animate-pulse">
                    <WifiOff size={12} /> ממתין לחיבור...
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                setIsAiLoading(true);
                const res = await generateAISummary(faults, plannedWorks, { 
                  controllers, 
                  shiftType: currentShiftType, 
                  date: today, 
                  generalNotes: notes.map(n => n.content).join(', ') 
                });
                if (res) setAiResult(res);
                setIsAiLoading(false);
              }}
              className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50"
              disabled={isAiLoading}
            >
              <Sparkles size={18} /> {isAiLoading ? "מנתח נתונים..." : "סיכום AI"}
            </button>
            <button 
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildSummaryText(true))}`, '_blank')}
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100"
            >
              ווטסאפ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><User size={18} className="text-blue-500" /> צוות בקרים (מסונכרן)</h2>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="שם בקר א'" 
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" 
                value={controllers[0]} 
                onChange={e => updateControllersCloud([e.target.value, controllers[1]])} 
              />
              <input 
                type="text" 
                placeholder="שם בקר ב'" 
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" 
                value={controllers[1]} 
                onChange={e => updateControllersCloud([controllers[0], e.target.value])} 
              />
            </div>
          </Card>
          
          <Card>
            <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Zap size={18} className="text-orange-500" /> עבודות יזומות (מסונכרן)</h2>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="תיאור העבודה..." className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={newPlanned} onChange={e => setNewPlanned(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanned()} />
              <button onClick={addPlanned} className="bg-gray-800 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold hover:bg-black transition">+</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
              {plannedWorks.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs border border-gray-100">
                  <span className="font-medium">{p.description}</span>
                  <button onClick={() => dbDeletePlanned(p.id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={14}/></button>
                </div>
              ))}
              {plannedWorks.length === 0 && <p className="text-center text-gray-300 text-[10px] py-2 italic">אין עבודות רשומות</p>}
            </div>
          </Card>

          <Card>
            <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><FileText size={18} className="text-gray-400" /> הערות חופשיות (מסונכרן)</h2>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="הערה חדשה..." className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} />
              <button onClick={addNote} className="bg-gray-800 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold hover:bg-black transition">+</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {notes.map(n => (
                <div key={n.id} className="flex justify-between items-start bg-gray-50 p-2.5 rounded-xl text-xs border border-gray-100">
                  <span className="font-medium flex-1 pl-2">{n.content}</span>
                  <button onClick={() => dbDeleteNote(n.id)} className="text-gray-300 hover:text-red-500 transition pt-0.5"><Trash2 size={14}/></button>
                </div>
              ))}
              {notes.length === 0 && <p className="text-center text-gray-300 text-[10px] py-2 italic">אין הערות רשומות</p>}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-t-4 border-t-blue-600 shadow-md">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800"><AlertCircle className="text-blue-600" /> דיווח תקלה חדשה</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input type="text" placeholder="מספר אתר" className="p-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={faultForm.siteNumber} onChange={e => setFaultForm({...faultForm, siteNumber: e.target.value})} />
              <input type="text" placeholder="שם אתר" className="p-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={faultForm.siteName} onChange={e => setFaultForm({...faultForm, siteName: e.target.value})} />
              <input type="text" placeholder="סיבת ירידה (למשל: תקשורת)" className="p-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={faultForm.reason} onChange={e => setFaultForm({...faultForm, reason: e.target.value})} />
              <input type="text" placeholder="זמן השבתה (למשל: 12:45)" className="p-3.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" value={faultForm.downtime} onChange={e => setFaultForm({...faultForm, downtime: e.target.value})} />
            </div>
            <div className="flex items-center gap-6 mb-6">
              <label className="flex items-center gap-2.5 font-bold text-sm cursor-pointer select-none text-gray-600">
                <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" checked={faultForm.isPower} onChange={e => setFaultForm({...faultForm, isPower: e.target.checked})} />
                תקלת חשמל / חב"ח
              </label>
              {faultForm.isPower && (
                <div className="flex-1 animate-in slide-in-from-right-2 duration-300">
                  <input type="text" placeholder="זמן גיבוי נותר (למשל: 4 שעות)" className="w-full p-2.5 bg-orange-50 border border-orange-100 rounded-xl text-sm outline-none focus:border-orange-500 font-bold text-orange-700" value={faultForm.battery} onChange={e => setFaultForm({...faultForm, battery: e.target.value})} />
                </div>
              )}
            </div>
            <button onClick={addFault} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-blue-700 transition shadow-xl shadow-blue-100 active:scale-[0.99]">שלח דיווח לענן</button>
          </Card>

          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-black text-gray-800 flex items-center gap-2">
                <Smartphone size={20} className="text-blue-600"/> אתרים בטיפול ({faults.length})
              </h3>
              <button 
                onClick={() => { 
                  navigator.clipboard.writeText(buildSummaryText(false)); 
                  setCopyStatus(true); 
                  setTimeout(()=>setCopyStatus(false),2000); 
                }} 
                className="text-xs bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-all font-bold shadow-sm active:scale-95"
              >
                <ClipboardCheck size={14} className={copyStatus ? "text-green-500" : "text-gray-400"} />
                {copyStatus ? "הועתק!" : "העתק סיכום נקי"}
              </button>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden border-separate">
              <table className="w-full text-right">
                <thead className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase border-b">
                  <tr>
                    <th className="px-6 py-4">פרטי אתר</th>
                    <th className="px-6 py-4">סיבה ומצב</th>
                    <th className="px-6 py-4">פעולות בטיפול</th>
                    <th className="px-6 py-4">השבתה</th>
                    <th className="px-6 py-4 text-center">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {faults.map(f => (
                    <tr key={f.id} className={`${f.status === 'closed' ? 'bg-green-50/40 opacity-70' : 'hover:bg-gray-50/50'} transition-all duration-300`}>
                      <td className="px-6 py-5">
                        <div className="font-black text-gray-800 text-sm">{f.siteNumber}</div>
                        <div className="text-[11px] text-gray-400 font-bold">{f.siteName}</div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-semibold text-gray-700">{f.reason}</div>
                        {f.isPowerIssue && <div className="text-[10px] bg-orange-100 text-orange-700 font-black px-1.5 py-0.5 rounded-md mt-1.5 inline-block">🔋 גיבוי: {f.batteryBackupTime}</div>}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 group">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-b border-dashed border-gray-200 text-sm outline-none py-1 focus:border-blue-500 transition-colors" 
                            value={f.treatment} 
                            onChange={e => dbUpdateFault(f.id, { treatment: e.target.value })} 
                            placeholder="עדכן טיפול..." 
                          />
                          <Edit3 size={12} className="text-gray-200 group-hover:text-blue-400 transition" />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-gray-300" />
                          <input 
                            type="text" 
                            className="w-20 bg-transparent border-b border-dashed border-gray-200 text-sm font-black text-gray-600 outline-none py-1 focus:border-blue-500 transition-colors text-center" 
                            value={f.downtime} 
                            onChange={e => dbUpdateFault(f.id, { downtime: e.target.value })} 
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => dbUpdateFault(f.id, { status: f.status === 'open' ? 'closed' : 'open' })} 
                            className={`p-2 rounded-xl transition-all shadow-sm active:scale-90 ${f.status === 'closed' ? 'bg-green-600 text-white shadow-green-100' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                            title={f.status === 'closed' ? 'פתח מחדש' : 'סגור תקלה'}
                          >
                            {f.status === 'closed' ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
                          </button>
                          <button onClick={() => confirm("למחוק את הדיווח לצמיתות?") && dbDeleteFault(f.id)} className="p-2 text-gray-200 hover:text-red-500 transition active:scale-90">
                            <Trash2 size={18}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {faults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4 text-gray-300">
                          <div className="bg-gray-50 p-6 rounded-full">
                            <ShieldCheck size={48} className="opacity-20" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-bold italic">כל האתרים תקינים - אין תקלות רשומות</p>
                            {!isConnected && <p className="text-[10px] text-red-400 font-bold animate-pulse">ממתין לחיבור ענן...</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {aiResult && (
            <Card className="border-r-4 border-r-indigo-500 bg-indigo-50/30">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-black text-indigo-900 flex items-center gap-2">
                  <Sparkles size={20} /> סיכום משמרת (AI)
                </h3>
                <button 
                  onClick={() => setAiResult(null)}
                  className="text-indigo-300 hover:text-indigo-600 transition"
                >
                  <XCircle size={18} />
                </button>
              </div>
              <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap font-medium">
                {aiResult}
              </div>
            </Card>
          )}
        </div>
      </main>
      
      <footer className="mt-auto py-8 text-center border-t border-gray-100 bg-white">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
            <span>NOC ControlShift Engine</span>
            <span className="h-1 w-1 bg-gray-300 rounded-full"></span>
            <span className="text-blue-500">noc1 stable</span>
          </div>
          <p className="text-[9px] text-gray-300 font-medium">פלטפורמת סנכרון בקרת רשת בזמן אמת • גרסה 1.0.1</p>
        </div>
      </footer>
    </div>
  );
};

export default App;