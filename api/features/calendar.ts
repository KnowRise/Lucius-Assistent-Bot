import { Type, FunctionDeclaration } from '@google/genai';

// --- CALENDAR TOOLS ---
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

const getCalendarEventsTool: FunctionDeclaration = {
  name: 'getCalendarEvents',
  description: 'Melihat atau membaca daftar agenda/jadwal pengguna di Google Calendar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      timeMin: { type: Type.STRING, description: 'Batas awal waktu pencarian format ISO string' },
      timeMax: { type: Type.STRING, description: 'Batas akhir waktu pencarian format ISO string' }
    },
    required: ['timeMin', 'timeMax'],
  },
};

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

const deleteCalendarEventTool: FunctionDeclaration = {
  name: 'deleteCalendarEvent',
  description: 'Menghapus acara atau jadwal dari Google Calendar berdasarkan eventId.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      eventId: { type: Type.STRING, description: 'ID unik acara Google Calendar' }
    },
    required: ['eventId'],
  },
};

export const calendarTools = {
  createCalendarEventTool,
  getCalendarEventsTool,
  updateCalendarEventTool,
  deleteCalendarEventTool
};