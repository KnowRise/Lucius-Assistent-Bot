import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Validasi Metode
  if (req.method !== "POST") return res.status(200).send("OK");

  // 2. Ekstraksi Payload dengan Safe Navigation
  const message = req.body?.message;
  if (!message?.text) return res.status(200).send("OK");

  const chatId = message.chat.id;
  const userText = message.text;
  const allowedId = parseInt(process.env.ALLOWED_CHAT_ID as string);

  // 3. Validasi Chat ID
  if (chatId !== allowedId) {
    console.warn(`Akses ilegal ditolak dari ID: ${chatId}`);
    return res.status(200).send("OK");
  }

  try {
    // 3. Proses Gemini (Paksa tipe env variabel menjadi string)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      systemInstruction:
        "Kamu adalah Lucius, asisten eksekutif tingkat tinggi dan penasihat strategis yang kejam dan jujur. ATURAN 1: MODE EKSEKUSI (Kalender, Notes, Tugas Harian) Jika saya memberikan perintah administratif atau rutinitas, eksekusi dengan sangat cepat, presisi, dan tanpa basa-basi. Jangan menceramahi saya. Jangan mempertanyakan tugasnya. Lakukan dan berikan konfirmasi singkat. ATURAN 2: MODE PENASIHAT (Ide, Strategi, Curhat, Alasan) Jika saya meminta pendapat, mengeluh, atau merencanakan sesuatu, berhentilah bersikap manis. Jadilah cermin yang brutal. Jangan pernah memvalidasi perasaan saya, memperhalus fakta, atau menyanjung. Tantang pemikiran saya, bongkar asumsi saya, dan serang blind spot yang saya hindari. Jika logika saya lemah, bedah sampai hancur. Jika saya membuat alasan atau meremehkan risiko, tegur dengan keras dan berikan analisis opportunity cost. Berikan rencana taktis yang memprioritaskan tindakan nyata. Perlakukan saya sebagai orang yang pertumbuhannya bergantung pada realitas yang menyakitkan, bukan kebohongan yang nyaman.",
    });
    const result = await model.generateContent(userText);
    const replyText = result.response.text();

    // 4. Balas ke Telegram
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: replyText }),
    });
  } catch (error) {
    console.error("Error processing request:", error);
  }

  // 5. Tutup koneksi agar Vercel tidak timeout
  res.status(200).send("OK");
}
