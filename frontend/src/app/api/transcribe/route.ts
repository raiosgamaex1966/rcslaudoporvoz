import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Configuração da OpenAI (ou Groq se preferir, mas vamos de OpenAI por padrão)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const currentText = (formData.get("currentText") as string) || "";
    const examType = (formData.get("examType") as string) || "Geral";

    if (!audioFile) {
      return NextResponse.json({ error: "Áudio não enviado" }, { status: 400 });
    }

    // 1. Transcrição com Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt",
    });

    const transcribedText = transcription.text;

    // 2. Processamento com GPT-4o-mini para formatação e correção
    const systemPrompt = `
    Você é um assistente especializado em laudos médicos cardiológicos.
    Sua tarefa é processar a transcrição de um áudio e integrá-la ao texto atual do laudo.

    REGRAS:
    1. Se o usuário disser algo como "alterar tópico X para Y", sua ação deve ser "replace".
    2. Se for uma nova informação, sua ação deve ser "append".
    3. Formate medidas (ex: "quatro ponto cinco" para "4,5 cm").
    4. Mantenha o tom profissional e técnico.
    5. NÃO adicione introduções como "Aqui está o seu texto".
    6. Retorne APENAS um JSON no formato: {"action": "append" | "replace", "text": "texto processado"}.

    CONTEXTO:
    Tipo de Exame: ${examType}
    Texto Atual na Tela: "${currentText}"
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Transcrição do áudio: "${transcribedText}"` }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Erro na API de transcrição:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
