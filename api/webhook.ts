import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";
import { google } from "googleapis";
import { calendarTools } from "./features/calendar";
import { taskTools } from "./features/task";

// Setup Auth Google
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Inisialisasi Service Calendar & Tasks
const calendar = google.calendar({ version: "v3", auth: oauth2Client });
const tasks = google.tasks({ version: "v1", auth: oauth2Client });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const message = req.body?.message;
  if (!message?.text) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const userText = message.text;
  const allowedId = parseInt(process.env.ALLOWED_CHAT_ID as string);

  if (chatId !== allowedId) return res.status(200).send("OK");

  try {
    const nowIso = new Date().toISOString();

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: userText,
      config: {
        systemInstruction: `Kamu adalah Lucius, asisten eksekutif tingkat tinggi. Waktu saat ini (WIB / Asia/Jakarta): ${nowIso}.

ATURAN 1: MODE EKSEKUTOR
- Kalender: Gunakan 'createCalendarEvent', 'getCalendarEvents', 'deleteCalendarEvent'.
- Task / Notes / Reminder: Gunakan 'createNoteTask' (untuk membuat), 'getNoteTasks' (untuk membaca), 'completeNoteTask' (untuk menandai selesai), 'deleteNoteTask' (untuk menghapus).
*PENTING*: Jika pengguna minta menyelesaikan atau menghapus task tapi kamu BELUM tahu taskId-nya, panggil 'getNoteTasks' terlebih dahulu.

ATURAN 2: MODE PENASIHAT (Ide, Strategi, Curhat, Alasan)
Jika pengguna meminta pendapat atau mengeluh, jadilah cermin yang brutal, bongkar blind spot, dan berikan rencana taktis tanpa basa-basi.`,
        tools: [
          {
            functionDeclarations: [
              calendarTools.createCalendarEventTool,
              calendarTools.getCalendarEventsTool,
              calendarTools.updateCalendarEventTool,
              calendarTools.deleteCalendarEventTool,
              taskTools.createNoteTaskTool,
              taskTools.getNoteTasksTool,
              taskTools.completeNoteTaskTool,
              taskTools.deleteNoteTaskTool,
            ],
          },
        ],
      },
    });

    let finalReply = "";
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args as any;

      // --- EKSKUSI CALENDAR ---
      if (call.name === "createCalendarEvent") {
        await calendar.events.insert({
          calendarId: "primary",
          requestBody: {
            summary: args.summary,
            description: args.description || "Dibuat oleh Lucius",
            start: { dateTime: args.startTime, timeZone: "Asia/Jakarta" },
            end: { dateTime: args.endTime, timeZone: "Asia/Jakarta" },
          },
        });
        finalReply = `[EKSEKUSI CALENDAR SUKSES]\nJadwal "${args.summary}" berhasil dicatat!`;
      } else if (call.name === "getCalendarEvents") {
        const eventsRes = await calendar.events.list({
          calendarId: "primary",
          timeMin: args.timeMin,
          timeMax: args.timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        const events = eventsRes.data.items || [];
        finalReply =
          events.length === 0
            ? "Tidak ada agenda di rentang waktu tersebut."
            : "Daftar Agenda:\n" +
              events
                .map(
                  (e, idx) =>
                    `${idx + 1}. ${e.summary} (${e.start?.dateTime || e.start?.date}) [ID: ${e.id}]`,
                )
                .join("\n");
      } else if (call.name === "deleteCalendarEvent") {
        await calendar.events.delete({
          calendarId: "primary",
          eventId: args.eventId,
        });
        finalReply = `[EKSEKUSI CALENDAR SUKSES]\nJadwal ID "${args.eventId}" berhasil dihapus.`;

        // --- EKSEKUSI TASKS / REMINDER ---
      } else if (call.name === "createNoteTask") {
        await tasks.tasks.insert({
          tasklist: "@default",
          requestBody: {
            title: args.title,
            notes: args.notes || "Dicatat oleh Lucius",
            due: args.due || undefined,
          },
        });
        finalReply = `[EKSEKUSI TASK SUKSES]\nCatatan/Tugas "${args.title}" berhasil disimpan di Google Tasks!`;
      } else if (call.name === "getNoteTasks") {
        const taskRes = await tasks.tasks.list({
          tasklist: "@default",
          showCompleted: args.showCompleted || false,
        });
        const itemTasks = taskRes.data.items || [];
        finalReply =
          itemTasks.length === 0
            ? "Tidak ada tugas/catatan aktif."
            : "Daftar Tugas / Reminder:\n" +
              itemTasks
                .map(
                  (t, idx) =>
                    `${idx + 1}. [${t.status === "completed" ? "X" : " "}] ${t.title} [ID: ${t.id}]`,
                )
                .join("\n");
      } else if (call.name === "completeNoteTask") {
        await tasks.tasks.patch({
          tasklist: "@default",
          task: args.taskId,
          requestBody: { status: "completed" },
        });
        finalReply = `[EKSEKUSI TASK SUKSES]\nTugas ID "${args.taskId}" berhasil ditandai selesai!`;
      } else if (call.name === "deleteNoteTask") {
        await tasks.tasks.delete({
          tasklist: "@default",
          task: args.taskId,
        });
        finalReply = `[EKSEKUSI TASK SUKSES]\nTugas ID "${args.taskId}" berhasil dihapus dari Google Tasks.`;
      }
    } else {
      finalReply = response.text || "Tidak ada balasan.";
    }

    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: finalReply }),
      },
    );
  } catch (error) {
    console.error("Error processing request:", error);
  }

  res.status(200).send("OK");
}
