import { GoogleGenAI } from "@google/genai";

export const generateAISummary = async (
  faults: any[], 
  planned: any[], 
  shiftInfo: any
) => {
  // אתחול ה-SDK באמצעות מפתח מהסביבה (Vercel Environment Variables)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    פעל כבקר NOC בכיר. ערוך סיכום משמרת מקצועי וטכני בעברית.
    
    חוקים קשיחים:
    1. ללא אמוג'ים או אייקונים בכלל.
    2. לכל אתר ברשימה: ציין מספר אתר, שם אתר, סיבת ירידה, מה נעשה לטיפול, וזמן השבתה.
    3. אם צוין זמן גיבוי מצברים (בתקלות חשמל), חובה לכלול אותו בפירוט האתר.
    4. שמור על עברית רהוטה ומקצועית.
    
    נתונים:
    בקרים: ${shiftInfo.controllers.filter(Boolean).join(' ו-')}
    משמרת: ${shiftInfo.shiftType}
    תאריך: ${shiftInfo.date}
    
    תקלות:
    ${faults.map(f => `- אתר ${f.siteNumber} (${f.siteName}): סיבה: ${f.reason}, טיפול: ${f.treatment || 'בטיפול'}, זמן השבתה: ${f.downtime}${f.isPowerIssue ? `, גיבוי מצברים: ${f.batteryBackupTime}` : ''}`).join('\n')}
    
    עבודות יזומות:
    ${planned.map(p => `- ${p.description}`).join('\n')}
    
    הערות נוספות: ${shiftInfo.generalNotes || 'אין'}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("AI Generation failed:", error);
    return "שגיאה ביצירת סיכום ה-AI. וודא שהגדרת API_KEY ב-Vercel.";
  }
};