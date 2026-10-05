import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const SYSTEM_INSTRUCTION = `You are "WeCare AI", the smart, warm, highly helpful, and conversational AI healthcare assistant for WeCare Hospital (functioning with conversational excellence like ChatGPT for health & hospital guidance).

IMPORTANT RULES:
1. STRICTLY ONE QUESTION AT A TIME:
   - When the user asks a question, answer ONLY that specific question!
   - Do NOT combine or dump unasked information (e.g., do NOT mention emergency SOS 108 or app download unless the user asked about emergency or downloading the app).
   - Keep answers clear, direct, well-spaced, and concise.

2. DETAILED STEP-BY-STEP EXPLANATION DIRECTLY IN CHAT:
   - When the user asks "Appointment kaise book karein?" or how to book an appointment:
     Explain the steps clearly RIGHT HERE IN THE CHAT:
     * Step 1: Website ke upar "Book Appointment" button par click karein.
     * Step 2: Apna Department (jaise Cardiology, Pediatrics) aur Doctor select karein.
     * Step 3: Date aur Morning/Evening time slot choose karein.
     * Step 4: Patient details (Naam, Phone, Umar, Health problem) bharein.
     * Step 5: "Confirm Booking" par click karein — turant aapko Booking ID aur Digital OPD Pass mil jayega!
     Aap patient dashboard me apna pass download ya print bhi kar sakte hain.

3. PERSONAL & GENERAL CHATTING (LIKE CHATGPT):
   - If the user asks personal, conversational, or general health questions (e.g., "Mujhe sar dard hai kya karu?", "Aap kaise ho?", "Fever ke gharelu upay", "Healthy diet tips", "Mujhe weakness lag rahi hai"):
     * Answer empathetically, intelligently, and helpfully like ChatGPT.
     * Provide helpful guidance, precautions, or simple home remedies.
     * Kindly advise consulting a specialist doctor if symptoms persist.

4. EMERGENCY HANDLING:
   - ONLY mention emergency SOS 108 if the user explicitly describes severe emergency symptoms (acute chest pain, breathing difficulty, heavy bleeding, accident) or asks about emergency services.

5. HOSPITAL FACTS (Akhatwade, near Nagardeola, Dist Jalgaon 425001):
   - OPD Timings: Mon-Sat, 9:00 AM to 8:00 PM.
   - Key Doctors: Dr. Rajesh Sharma (Cardiology, ₹800), Dr. Priya Patel (Pediatrics, ₹600), Dr. Amit Verma (Orthopedics, ₹750), Dr. Ananya Sen (Neurology, ₹900), Dr. Sneha Kulkarni (Gynecology, ₹700), Dr. Vikram Malhotra (General Surgery, ₹850).
   - Mobile App: Can be downloaded as APK by tapping the download icon in the header.

Language: Always reply in the same language the user uses (Hindi, Hinglish, Marathi, or English).`;

// Intelligent fallback response generator if Gemini API is unreachable or rate limited
function getHospitalKnowledgeFallback(userMessage: string): { reply: string; suggestedActions?: string[] } {
  const query = userMessage.toLowerCase().trim();

  // 1. Appointment booking steps query
  if (query.includes('book') || query.includes('appointment') || query.includes('अपॉइंटमेंट') || query.includes('बुक') || query.includes('boking') || query.includes('slot') || query.includes('step')) {
    return {
      reply: `🏥 **Appointment Book Karne Ke Steps:**\n\n1. **Step 1:** Upar ya doctor card par **"Book Appointment"** button dabayein.\n2. **Step 2:** Department (jaise Cardiology, Ortho) aur Doctor chunein.\n3. **Step 3:** Date aur available Morning/Evening slot select karein.\n4. **Step 4:** Patient ka naam, umar, phone aur takleef bharein.\n5. **Step 5:** **"Confirm Booking"** par click karein — turant aapka Booking ID aur Digital OPD Pass ban jayega!\n\nKya aapko kisi doctor ke baare me poochna hai?`,
      suggestedActions: ['Doctors List & Fees', 'Hospital Timings']
    };
  }

  // 2. Doctor list & fees query
  if (query.includes('doctor') || query.includes('डॉक्टर') || query.includes('specialist') || query.includes('fee') || query.includes('sharma') || query.includes('patel')) {
    return {
      reply: `👨‍⚕️ **WeCare Hospital ke Specialists & Fees:**\n\n- **Dr. Rajesh Sharma, MD** (Cardiology - Dil) - ₹800\n- **Dr. Priya Patel, MD** (Pediatrics - Bachhe) - ₹600\n- **Dr. Amit Verma, MS** (Orthopedics - Haddi/Jod) - ₹750\n- **Dr. Ananya Sen, DM** (Neurology - Brain) - ₹900\n- **Dr. Sneha Kulkarni, MD** (Gynecology - Mahila Rog) - ₹700\n- **Dr. Vikram Malhotra, MS** (Surgery) - ₹850\n\nAap website ke **"Doctors"** tab par jakar sabhi doctors dekh sakte hain.`,
      suggestedActions: ['How to book appointment?', 'Hospital Timings']
    };
  }

  // 3. Emergency query
  if (query.includes('emergency') || query.includes('108') || query.includes('ambulance') || query.includes('urgent') || query.includes('इमरजेंसी')) {
    return {
      reply: `🚨 **24/7 WeCare Emergency & Ambulance:**\n\n- **Direct SOS Ambulance:** 📞 **108** (Toll-Free, 24 Ghante Active)\n- **Emergency Desk:** +91 98220 12345\n- **Address:** Akhatwade, near Nagardeola, Dist Jalgaon 425001.\n\nKisi bhi serious problem me turant 108 par call karein ya direct casualty room pahuchein.`,
      suggestedActions: ['Hospital Location', 'Call Helpline']
    };
  }

  // 4. Download app query
  if (query.includes('download') || query.includes('apk') || query.includes('app') || query.includes('डाउनलोड') || query.includes('install')) {
    return {
      reply: `📱 **WeCare Mobile App (APK) Download:**\n\n- Website ke upar diye gaye **Download Icon** par tap karein.\n- Tap karte hi direct **WeCare-Hospital.apk** download ho jayegi.\n- Android phone par screen par "Install" ka option aayega, jisse app home screen par set ho jayegi!\n- iPhone users Safari Share me "Add to Home Screen" kar sakte hain.`,
      suggestedActions: ['How to book appointment?', 'Doctors List & Fees']
    };
  }

  // 5. Timings & location query
  if (query.includes('address') || query.includes('location') || query.includes('kahan') || query.includes('timing') || query.includes('पता') || query.includes('samay')) {
    return {
      reply: `📍 **WeCare Hospital Pata & Timings:**\n\n- **Pata:** Akhatwade, near Nagardeola, Dist Jalgaon, Maharashtra - 425001.\n- **OPD Samay:** Somwar se Shanivar, Subah 9:00 AM se Raat 8:00 PM.\n- **Emergency/Casualty:** 24 Ghante khula rehta hai.\n- **Visiting Hours:** 10:00 AM – 12:00 PM | 05:00 PM – 07:30 PM.`,
      suggestedActions: ['How to book appointment?', 'Doctors List & Fees']
    };
  }

  // 6. Conversational / Personal query fallback (like ChatGPT)
  if (query.includes('namaste') || query.includes('hello') || query.includes('hi') || query.includes('kaise ho') || query.includes('who are you') || query.includes('kaun ho')) {
    return {
      reply: `Namaste! 🙏 Main WeCare Hospital ka AI Healthcare Assistant hoon.\n\nMain theek hoon! Aap bataiye aaj main aapki kya madad kar sakta hoon? Aap mujhse appointment booking ke steps, doctor details, ya apni health se juda koi bhi sawal pooch sakte hain.`,
      suggestedActions: ['How to book appointment?', 'Doctors List & Fees', 'Hospital Timings']
    };
  }

  // 7. Health symptom inquiry fallback
  if (query.includes('dard') || query.includes('pain') || query.includes('fever') || query.includes('bukhar') || query.includes('sar') || query.includes('headache') || query.includes('cough') || query.includes('sardi')) {
    return {
      reply: `Aapki takleef sunkar chinta hui. Kripya dhyan rakhein:\n\n1. Paryaapt paani piyein aur aaram karein.\n2. Bina doctor ki salah ke koi heavy dawai na lein.\n3. Agar takleef 1-2 din se jyada hai ya tez hai, to turant hamare hospital me doctor se checkup karwayein.\n\nAap website par hamare General Physician ya specialist doctor ke sath appointment book kar sakte hain.`,
      suggestedActions: ['How to book appointment?', 'Doctors List & Fees']
    };
  }

  return {
    reply: `Aapka sawal mil gaya hai. WeCare Hospital me appointment booking, specialist doctors, OPD timing ya kisi bhi health guidance ke liye aap mujhse specific sawal pooch sakte hain. Main ek-ek karke aapki poori madad karunga!`,
    suggestedActions: ['How to book appointment?', 'Doctors List & Fees', 'Hospital Timings']
  };
}

// POST /api/chat endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // If Gemini client is initialized, attempt Gemini call
    if (ai) {
      try {
        // Construct conversation contents with history
        const contents: any[] = [];
        if (Array.isArray(history)) {
          for (const item of history.slice(-6)) {
            if (item.role === 'user' || item.role === 'assistant') {
              contents.push({
                role: item.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: item.text || item.content || '' }],
              });
            }
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }],
        });

        // Try gemini-3.1-flash-lite first for lightning fast response
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
            maxOutputTokens: 600,
          },
        });

        if (response && response.text) {
          return res.json({
            reply: response.text,
            source: 'gemini-ai',
          });
        }
      } catch (geminiError: any) {
        console.warn('Gemini primary model encountered error, checking fallback:', geminiError?.message || geminiError);

        // Try gemini-3.8-flash as secondary
        try {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: message,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.7,
              maxOutputTokens: 600,
            },
          });
          if (fallbackRes && fallbackRes.text) {
            return res.json({
              reply: fallbackRes.text,
              source: 'gemini-ai-secondary',
            });
          }
        } catch (secondaryErr: any) {
          console.warn('Gemini secondary failed, using knowledge fallback:', secondaryErr?.message);
        }
      }
    }

    // Knowledge-base fallback
    const fallback = getHospitalKnowledgeFallback(message);
    return res.json({
      reply: fallback.reply,
      suggestedActions: fallback.suggestedActions,
      source: 'wecare-knowledge-engine',
    });
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    const fallback = getHospitalKnowledgeFallback(req.body?.message || '');
    return res.json({
      reply: fallback.reply,
      suggestedActions: fallback.suggestedActions,
      source: 'wecare-knowledge-engine',
    });
  }
});

// Serve frontend in dev (via Vite middleware) or prod (via static files)
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WeCare Hospital Server running on http://0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
