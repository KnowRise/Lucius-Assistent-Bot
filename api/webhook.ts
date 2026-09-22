import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

// 1. TOOL CREATE
const createCalendarEventTool: FunctionDeclaration = {
  name: 'createCalendarEvent',
  description: 'Membuat acara atau jadwal baru di Google Calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: 'Judul acara' },
      startTime: { type: Type.STRING, description: 'Waktu mulai format ISO string' },
      endTime: { type: Type.STRING, description: 'Waktu selesai format ISO string' },
      description: { type: Type.STRING, description: 'Deskripsi opsional' }
    },
    required: ['summary', 'startTime', 'endTime'],
  },
};

// 2. TOOL GET / LIST
const getCalendarEventsTool: FunctionDeclaration = {
  name: 'getCalendarEvents',
  description: 'Melihat atau membaca daftar agenda/jadwal pengguna di Google Calendar dalam rentang waktu tertentu.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeMin: { type: Type.STRING, description: 'Batas awal waktu pencarian format ISO string' },
      timeMax: { type: Type.STRING, description: 'Batas akhir waktu pencarian format ISO string' }
    },
    required: ['timeMin', 'timeMax'],
  },
};

// 3. TOOL UPDATE
const updateCalendarEventTool: FunctionDeclaration = {
  name: 'updateCalendarEvent',
  description: 'Mengubah jadwal yang sudah ada berdasarkan eventId.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: { type: Type.STRING, description: 'ID unik acara dari Google Calendar' },
      summary: { type: Type.STRING, description: 'Judul acara baru (opsional)' },
      startTime: { type: Type.STRING, description: 'Waktu mulai baru format ISO string (opsional)' },
      endTime: { type: Type.STRING, description: 'Waktu selesai baru format ISO string (opsional)' }
    },
    required: ['eventId'],
  },
};

// 4. TOOL DELETE (Fitur Baru)
const deleteCalendarEventTool: FunctionDeclaration = {
  name: 'deleteCalendarEvent',
  description: 'Menghapus acara atau jadwal dari Google Calendar berdasarkan eventId.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: { type: Type.STRING, description: 'ID unik acara dari Google Calendar yang akan dihapus' }
    },
    required: ['eventId'],
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const message = req.body?.message;
  if (!message?.text) return res.status(200).send('OK');

  const chatId = message.chat.id;
  const userText = message.text;
  const allowedId = parseInt(process.env.ALLOWED_CHAT_ID as string);

  if (chatId !== allowedId) return res.status(200).send('OK');

  try {
    const nowIso = new Date().toISOString();

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userText,
      config: {
        systemInstruction: `Kamu adalah Lucius, asisten eksekutif tingkat tinggi. Waktu saat ini (WIB / Asia/Jakarta): ${nowIso}.

ATURAN 1: MODE EKSEKUTOR (Jadwal & Agenda)
- Gunakan 'createCalendarEvent' untuk membuat jadwal baru.
- Gunakan 'getCalendarEvents' untuk membaca agenda.
- Gunakan 'updateCalendarEvent' untuk merubah jadwal.
- Gunakan 'deleteCalendarEvent' untuk menghapus jadwal.
*PENTING*: Jika pengguna minta mengubah atau menghapus jadwal tapi kamu BELUM tahu eventId-nya, panggil 'getCalendarEvents' terlebih dahulu untuk mencari jadwalnya dan mendapatkan eventId.

ATURAN 2: MODE PENASIHAT (Ide, Strategi, Curhat, Alasan)
Jika pengguna meminta pendapat atau mengeluh, jadilah cermin yang brutal, bongkar blind spot, dan berikan strategi taktis tanpa basa-basi.`,
        tools: [{ 
          functionDeclarations: [
            createCalendarEventTool, 
            getCalendarEventsTool, 
            updateCalendarEventTool,
            deleteCalendarEventTool
          ] 
        }],
      },
    });

    let finalReply = '';
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args as any;

      if (call.name === 'createCalendarEvent') {
        await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: args.summary,
            description: args.description || 'Dibuat oleh Lucius',
            start: { dateTime: args.startTime, timeZone: 'Asia/Jakarta' },
            end: { dateTime: args.endTime, timeZone: 'Asia/Jakarta' },
          },
        });
        finalReply = `[EKSEKUSI SUKSES]\nJadwal "${args.summary}" berhasil dicatat!`;

      } else if (call.name === 'getCalendarEvents') {
        const eventsRes = await calendar.events.list({
          calendarId: 'primary',
          timeMin: args.timeMin,
          timeMax: args.timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        });
        
        const events = eventsRes.data.items || [];
        if (events.length === 0) {
          finalReply = 'Tidak ada agenda di rentang waktu tersebut.';
        } else {
          finalReply = 'Daftar Agenda:\n' + events.map((e, idx) => 
            `${idx + 1}. ${e.summary} (${e.start?.dateTime || e.start?.date}) [ID: ${e.id}]`
          ).join('\n');
        }

      } else if (call.name === 'updateCalendarEvent') {
        const updateBody: any = {};
        if (args.summary) updateBody.summary = args.summary;
        if (args.startTime) updateBody.start = { dateTime: args.startTime, timeZone: 'Asia/Jakarta' };
        if (args.endTime) updateBody.end = { dateTime: args.endTime, timeZone: 'Asia/Jakarta' };

        await calendar.events.patch({
          calendarId: 'primary',
          eventId: args.eventId,
          requestBody: updateBody,
        });
        finalReply = `[EKSEKUSI SUKSES]\nJadwal dengan ID "${args.eventId}" berhasil diperbarui!`;

      } else if (call.name === 'deleteCalendarEvent') {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: args.eventId,
        });
        finalReply = `[EKSEKUSI SUKSES]\nJadwal dengan ID "${args.eventId}" berhasil dihapus dari Google Calendar.`;
      }
    } else {
      finalReply = response.text || 'Tidak ada balasan.';
    }

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: finalReply }),
    });

  } catch (error) {
    console.error('Error processing request:', error);
  }

  res.status(200).send('OK');
}