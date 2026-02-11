import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Wifi, WifiOff, User, Zap, FileText, AlertCircle, 
  Smartphone, Trash2, CheckCircle2, XCircle, Edit3, 
  ClipboardCheck, Sparkles, Clock 
} from 'lucide-react';
import { ShiftType, SiteFault, PlannedWork } from './types';
import { getCurrentShift, Card } from './constants';
import { generateAISummary } from './geminiService';
import { 
  getShiftId, syncFaults, syncPlanned, dbAddFault, dbUpdateFault, 
  dbDeleteFault, dbAddPlanned, dbDeletePlanned, db
} from './firebaseService';

const App: React.FC = () => {
  const [today] = useState(new Date().toLocaleDateString('he-IL'));
  const currentShiftType = getCurrentShift() as ShiftType;
  const shiftDocId = getShiftId(today, currentShiftType);

  const [faults, setFaults] = useState<SiteFault[]>([]);
  const [plannedWorks, setPlannedWorks] = useState<PlannedWork[]>([]);
  const [controllers, setControllers] = useState<[string, string]>(['', '']);
  const [generalNotes, setGeneralNotes] = useState('');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  const [faultForm, setFaultForm] = useState({
    siteNumber: '', siteName: '', reason: '', downtime: '', isPower: false, battery: ''
  });
  const [newPlanned, setNewPlanned] = useState('');

  useEffect(() => {
    if (!db) return;
    const unsubFaults = syncFaults(shiftDocId, (data) => {
      setFaults(data as SiteFault[]);
      setIsConnected(true);
    });
    const unsubPlanned = syncPlanned(shiftDocId, (data) => {
      setPlannedWorks(data as PlannedWork[]);
    });
    return () => {
      unsubFaults();
      unsubPlanned();
    };
  }, [shiftDocId]);

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

  const buildSummary = (isWhatsApp: boolean) => {
    const b = (t: string) => isWhatsApp ? `*${t}*` : t;
    let text = `${b(`סיכום משמרת NOC - ${currentShiftType}`)}\nתאריך: ${today}\nבקרים: ${controllers.filter(Boolean).join(' ו- ')}\n\n`;
    
    const closed = faults.filter(f => f.status === 'closed');
    const open = faults.filter(f => f.status === 'open');

    text += `${b('תקלות שנסגרו:')}\n`;
    if (closed.length) {
      closed.forEach((f, i) => {
        text += `${i+1}. אתר ${f.siteNumber} (${f.siteName}) | השבתה: ${f.downtime} | טיפול: ${f.treatment || 'בוצע'}\n`;
      });
    } else text += "אין\n";

    text += `\n${b('תקלות פתוחות:')}\n`;
    if (open.length) {
      open.forEach((f, i) => {
        text += `${i+1}. אתר ${f.siteNumber} (${f.siteName}) | סיבה: ${f.reason} | השבתה: ${f.downtime}${f.isPowerIssue ? ` | גיבוי: ${f.batteryBackupTime}` : ''}\n`;
      });
    } else text += "אין\n";

    text += `\n${b('עבודות יזומות:')}\n`;
    if (plannedWorks.length) {
      plannedWorks.forEach((p, i) => text += `${i+1}. ${p.description}\n`);
    } else text += "אין\n";

    text += `\n${b('אירועים חריגים:')}\n${generalNotes || 'אין'}`;
    return text;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {!db && (
        <div className="bg-red-500 text-white text-center py-2 text-[10px] font-bold">
          שים לב: עליך להגדיר את מפתחות ה-Firebase בקובץ firebaseService.ts כדי שהנתונים יישמרו!
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 rounded-xl text-white">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-800">ControlShift Sync</h1>
                {isConnected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-400 animate-pulse" />}
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">בסיס נתונים משותף בזמן אמת</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={async () => {
                setIsAiLoading(true);
                const res = await generateAISummary(faults, plannedWorks, { controllers, shiftType: currentShiftType, date: today, generalNotes });
                if (res) setGeneralNotes(res);
                setIsAiLoading(false);
              }}
              className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-100 transition"
            >
              <Sparkles size={18} /> {isAiLoading ? "מנתח..." : "סיכום AI"}
            </button>
            <button 
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildSummary(true))}`, '_blank')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 transition"
            >
              ווטסאפ
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <User size={18} className="text-blue-500" />
              <h2 className="font-bold text-gray-700">צוות בקרים</h2>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="בקר א'" className="w-full p-2 bg-gray-50 border rounded-lg text-sm" value={controllers[0]} onChange={e => setControllers([e.target.value, controllers[1]])} />
              <input type="text" placeholder="בקר ב'" className="w-full p-2 bg-gray-50 border rounded-lg text-sm" value={controllers[1]} onChange={e => setControllers([controllers[0], e.target.value])} />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <Zap size={18} className="text-orange-500" />
              <h2 className="font-bold text-gray-700">עבודות יזומות</h2>
            </div>
            <div className="flex gap-2 mb-4">
              <input type="text" placeholder="תיאור העבודה..." className="flex-1 p-2 border rounded-lg text-sm" value={newPlanned} onChange={e => setNewPlanned(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlanned()} />
              <button onClick={addPlanned} className="bg-gray-800 text-white p-2 rounded-lg">+</button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {plannedWorks.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg text-xs">
                  <span>{p.description}</span>
                  <button onClick={() => dbDeletePlanned(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
              <FileText size={18} className="text-gray-400" />
              <h2 className="font-bold text-gray-700">אירועים חריגים</h2>
            </div>
            <textarea 
              rows={8} 
              className="w-full p-3 bg-gray-50 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="כתוב הערות משותפות..."
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
            />
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-t-4 border-t-blue-600">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><AlertCircle className="text-blue-600" /> דיווח תקלה חדשה</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input type="text" placeholder="מספר אתר" className="p-3 border rounded-xl text-sm" value={faultForm.siteNumber} onChange={e => setFaultForm({...faultForm, siteNumber: e.target.value})} />
              <input type="text" placeholder="שם אתר" className="p-3 border rounded-xl text-sm" value={faultForm.siteName} onChange={e => setFaultForm({...faultForm, siteName: e.target.value})} />
              <input type="text" placeholder="סיבת ירידה" className="p-3 border rounded-xl text-sm" value={faultForm.reason} onChange={e => setFaultForm({...faultForm, reason: e.target.value})} />
              <input type="text" placeholder="זמן השבתה" className="p-3 border rounded-xl text-sm" value={faultForm.downtime} onChange={e => setFaultForm({...faultForm, downtime: e.target.value})} />
            </div>
            <div className="flex items-center gap-6 mb-4">
              <label className="flex items-center gap-2 font-bold text-sm cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4" checked={faultForm.isPower} onChange={e => setFaultForm({...faultForm, isPower: e.target.checked})} />
                תקלת חשמל / חב"ח
              </label>
              {faultForm.isPower && (
                <input type="text" placeholder="זמן גיבוי" className="flex-1 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm" value={faultForm.battery} onChange={e => setFaultForm({...faultForm, battery: e.target.value})} />
              )}
            </div>
            <button onClick={addFault} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100">שלח למסד הנתונים המשותף</button>
          </Card>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-2">
              <h3 className="font-bold text-gray-700 flex items-center gap-2"><Smartphone size={18} className="text-blue-500"/> אתרים בטיפול ({faults.length})</h3>
              <button 
                onClick={() => { navigator.clipboard.writeText(buildSummary(false)); setCopyStatus(true); setTimeout(()=>setCopyStatus(false),2000); }}
                className="text-xs bg-white border border-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition font-bold"
              >
                <ClipboardCheck size={14} className={copyStatus ? "text-green-500" : "text-gray-400"} />
                {copyStatus ? "הועתק למקלדת" : "העתק סיכום נקי"}
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-right border-collapse">
                <thead className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase border-b">
                  <tr>
                    <th className="px-4 py-3">אתר</th>
                    <th className="px-4 py-3">סיבה</th>
                    <th className="px-4 py-3">טיפול</th>
                    <th className="px-4 py-3">השבתה</th>
                    <th className="px-4 py-3 text-center">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {faults.map(f => (
                    <tr key={f.id} className={f.status === 'closed' ? 'bg-green-50/50' : 'hover:bg-gray-50 transition'}>
                      <td className="px-4 py-4">
                        <div className="font-bold text-gray-800 text-sm">{f.siteNumber}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{f.siteName}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium">
                        {f.reason}
                        {f.isPowerIssue && <div className="text-[10px] text-orange-600 font-bold mt-1">🔋 גיבוי: {f.batteryBackupTime}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 group">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-b border-dashed border-gray-200 text-sm focus:border-blue-500 outline-none py-1" 
                            value={f.treatment} 
                            onChange={e => dbUpdateFault(f.id, { treatment: e.target.value })}
                            placeholder="הכנס טיפול..."
                          />
                          <Edit3 size={12} className="text-gray-200 group-hover:text-gray-400" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 group">
                          <input 
                            type="text" 
                            className="w-full bg-transparent border-b border-dashed border-gray-200 text-sm font-bold text-gray-600 focus:border-blue-500 outline-none py-1" 
                            value={f.downtime} 
                            onChange={e => dbUpdateFault(f.id, { downtime: e.target.value })}
                            placeholder="זמן..."
                          />
                          <Clock size={12} className="text-gray-100 group-hover:text-gray-300" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => dbUpdateFault(f.id, { status: f.status === 'open' ? 'closed' : 'open' })}
                            className={`p-2 rounded-xl transition shadow-sm ${f.status === 'closed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'}`}
                          >
                            {f.status === 'closed' ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
                          </button>
                          <button onClick={() => confirm("מחיקה סופית?") && dbDeleteFault(f.id)} className="p-2 text-gray-200 hover:text-red-500 transition">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {faults.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-300 italic text-sm">אין תקלות פעילות במשמרת</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 text-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">NOC Dashboard • Sync v2.0 • Powered by Firebase Cloud</p>
      </footer>
    </div>
  );
};

export default App;