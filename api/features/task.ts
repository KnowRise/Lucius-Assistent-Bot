import { Type, FunctionDeclaration } from '@google/genai';

// --- GOOGLE TASKS / REMINDER TOOLS ---
const createNoteTaskTool: FunctionDeclaration = {
  name: 'createNoteTask',
  description: 'Membuat catatan tugas, reminder, atau to-do list baru di Google Tasks.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: 'Judul tugas/catatan/reminder' },
      notes: { type: Type.STRING, description: 'Rincian atau isi catatan opsional' },
      due: { type: Type.STRING, description: 'Tenggat waktu ISO string opsional (misal: 2026-09-22T18:00:00.000Z)' }
    },
    required: ['title'],
  },
};

const getNoteTasksTool: FunctionDeclaration = {
  name: 'getNoteTasks',
  description: 'Membaca daftar catatan/tugas/reminder yang belum selesai dari Google Tasks.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      showCompleted: { type: Type.BOOLEAN, description: 'Set true jika ingin menampilkan tugas yang sudah selesai' }
    },
  },
};

const completeNoteTaskTool: FunctionDeclaration = {
  name: 'completeNoteTask',
  description: 'Tandai catatan/tugas sebagai selesai di Google Tasks berdasarkan taskId.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'ID unik task dari Google Tasks' }
    },
    required: ['taskId'],
  },
};

const deleteNoteTaskTool: FunctionDeclaration = {
  name: 'deleteNoteTask',
  description: 'Menghapus tugas/catatan dari Google Tasks berdasarkan taskId.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: 'ID unik task yang akan dihapus' }
    },
    required: ['taskId'],
  },
};

export const taskTools = {
  createNoteTaskTool,
  getNoteTasksTool,
  completeNoteTaskTool,
  deleteNoteTaskTool
};