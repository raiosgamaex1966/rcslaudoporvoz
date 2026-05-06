from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="Sistema Pró Coração API de IA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/")
def read_root():
    return {"message": "API de Processamento de Laudos Pró Coração Online!"}

@app.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    section: str = Form(...),
    examType: str = Form(...),
    currentText: str = Form(default="")
):
    import json
    try:
        # 1. Salvar arquivo temporariamente
        temp_file_path = f"temp_{audio.filename}"
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # 2. Transcrição com Whisper (Groq)
        with open(temp_file_path, "rb") as file:
            transcription = groq_client.audio.transcriptions.create(
              file=(temp_file_path, file.read()),
              model="whisper-large-v3",
              language="pt",
              response_format="text"
            )
        
        texto_bruto = str(transcription)

        # 3. Formatação com LLM (OpenAI) — prompt com contexto da tela atual
        contexto_tela = f"\n\nTEXTO ATUAL NA TELA (seção '{section}'):\n{currentText}" if currentText else ""

        prompt = f"""Você é um assistente médico de ditado. Sua função é transcrever e formatar o que o médico ditou para um laudo de {examType}.

REGRAS INEGOCIÁVEIS:
1. TRANSCREVA FIELMENTE o que o médico disse. NÃO invente, NÃO acrescente, NÃO reformule.
2. PONTUAÇÃO DITADA: converta palavras em símbolos (não escreva a palavra):
   - "vírgula" → ,
   - "ponto" ou "ponto final" → . e pule uma linha (\n)
   - "dois pontos" → :
   - "abre parênteses" / "fecha parênteses" → ( )
3. NÚMEROS E MEDIDAS: converta por extenso em numeral (ex: "quatro vírgula cinco centímetros" → 4,5 cm, "sessenta por cento" → 60%).
4. ORTOGRAFIA MÉDICA: corrija apenas erros do reconhecimento de voz em termos médicos (ex: "Costofênico" → "Costofrênico").
5. NÃO coloque negrito, NÃO coloque dois pontos após o achado, NÃO reformate a estrutura. Escreva o texto simples como o médico falou.
6. CORREÇÕES: se o médico disser "correção", "digo" ou "minto" → use apenas a versão corrigida, ignore o erro anterior.

MODO DE EDIÇÃO (use quando o médico quiser alterar algo já digitado):
- Se o médico disser "alterar o tópico X para ..." ou "corrigir o tópico X para ..." ou "o tópico X deve ser ..." → isso é uma EDIÇÃO.
- Nesse caso, leia o TEXTO ATUAL DA TELA abaixo, localize o tópico mencionado, substitua apenas aquela linha pelo novo texto, e retorne o texto COMPLETO da seção já corrigido.
- Retorne: {{"action": "replace", "texto_formatado": "texto completo da seção com a correção aplicada"}}
- Para ditado normal (sem edição): retorne {{"action": "append", "texto_formatado": "apenas o novo texto a adicionar"}}
{contexto_tela}

Texto bruto ditado pelo médico agora:
{texto_bruto}

Responda SOMENTE com o JSON, sem explicações."""

        completion = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        resultado_str = completion.choices[0].message.content
        resultado = json.loads(resultado_str)

        action = resultado.get("action", "append")
        texto_formatado = resultado.get("texto_formatado", "")

        # Limpar arquivo temp
        os.remove(temp_file_path)

        return {
            "status": "success", 
            "action": action,
            "texto_bruto": texto_bruto,
            "texto_formatado": texto_formatado
        }
    except Exception as e:
        print(f"Erro: {e}")
        if os.path.exists(f"temp_{audio.filename}"):
            os.remove(f"temp_{audio.filename}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
