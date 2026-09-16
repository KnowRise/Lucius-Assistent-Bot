import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Validasi Metode
  if (req.method !== 'POST') return res.status(200).send('OK');

  // 2. Ekstraksi Payload dengan Safe Navigation
  const message = req.body?.message;
  if (!message?.text) return res.status(200).send('OK');

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    // 3. Proses Gemini (Paksa tipe env variabel menjadi string)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(userText);
    const replyText = result.response.text();

    // 4. Balas ke Telegram
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: replyText })
    });

  } catch (error) {
    console.error("Error processing request:", error);
  }

  // 5. Tutup koneksi agar Vercel tidak timeout
  res.status(200).send('OK');
}