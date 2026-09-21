import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { google } from "googleapis";

// Setup Auth Google Calendar
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
const calendar = google.calendar({ version: "v3", auth: oauth2Client });

// Inisialisasi SDK Baru (@google/genai)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// Definisi Tool Google Calendar
const createCalendarEventTool: FunctionDeclaration = {
  name: "createCalendarEvent",
  description: "Membuat acara atau jadwal baru di Google Calendar pengguna.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "Judul acara atau kegiatan",
      },
      startTime: {
        type: Type.STRING,
        description:
          "Waktu mulai dalam format ISO string (contoh: 2026-09-22T14:00:00+07:00)",
      },
      endTime: {
        type: Type.STRING,
        description:
          "Waktu selesai dalam format ISO string (contoh: 2026-09-22T15:00:00+07:00)",
      },
      description: {
        type: Type.STRING,
        description: "Deskripsi opsional untuk acara",
      },
    },
    required: ["summary", "startTime", "endTime"],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const message = req.body?.message;
  if (!message?.text) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const userText = message.text;
  const allowedId = parseInt(process.env.ALLOWED_CHAT_ID as string);

  // Whitelist Chat ID
  if (chatId !== allowedId) {
    console.warn(`Akses ilegal ditolak dari ID: ${chatId}`);
    return res.status(200).send("OK");
  }

  try {
    const nowIso = new Date().toISOString();

    // Panggil model dengan SDK baru (@google/genai)
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash", // Atau gemini-3.6-flash sesuai ketersediaan tier lu
      contents: userText,
      config: {
        systemInstruction: `Kamu adalah Lucius, asisten eksekutif tingkat tinggi dan penasihat strategis yang kejam dan jujur.

Waktu saat ini (WIB / Asia/Jakarta) adalah: ${nowIso}.

ATURAN 1: MODE EKSEKUSI (Kalender, Notes, Tugas Harian)
Jika saya memberikan perintah administratif/rutinitas (seperti membuat jadwal), SELALU gunakan tool 'createCalendarEvent'. Hitung waktu ISO string secara presisi berdasarkan waktu saat ini. Eksekusi dengan cepat, presisi, dan tanpa penceramahan.

ATURAN 2: MODE PENASIHAT (Ide, Strategi, Curhat, Alasan)
Jika saya meminta pendapat, mengeluh, atau merencanakan sesuatu, jadilah cermin yang brutal. Tantang pemikiran saya, serang blind spot yang saya hindari, dan berikan rencana taktis yang memprioritaskan tindakan nyata.`,
        tools: [{ functionDeclarations: [createCalendarEventTool] }],
      },
    });

    let finalReply = "";

    // Cek apakah Gemini meminta eksekusi Function Calling
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "createCalendarEvent") {
        const args = call.args as any;

        // Eksekusi API Google Calendar
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: args.summary,
            description: args.description || "Dibuat oleh Lucius Bot",
            start: { dateTime: args.startTime, timeZone: "Asia/Jakarta" },
            end: { dateTime: args.endTime, timeZone: "Asia/Jakarta" },
          },
        });

        finalReply = `[EKSEKUSI SUKSES]\nJadwal "${args.summary}" telah dicatat di Google Calendar.\nWaktu: ${args.startTime} s/d ${args.endTime}`;
      }
    } else {
      finalReply = response.text || "Tidak ada respons dari model.";
    }

    // Balas ke Telegram
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: finalReply }),
    });
  } catch (error) {
    console.error("Error processing request:", error);
  }

  res.status(200).send("OK");
}
