# Documento de Implantação: Sistema Pró Coração (Laudos Médicos)

Este documento centraliza todas as diretrizes, arquitetura e passos para a construção do sistema de laudos médicos com inteligência artificial. Ele serve como um guia definitivo para o projeto, garantindo que o progresso não seja perdido.

## 1. Visão Geral e Arquitetura

O sistema utilizará uma arquitetura moderna dividida em três pilares principais, combinando a agilidade do ecossistema JavaScript/TypeScript com o poder do Python para Inteligência Artificial.

```text
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Navegador)                   │
│         Next.js (React) — interface do médico            │
│   Captura áudio → envia p/ backend → exibe transcrição   │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTPS / WebSocket
        ┌─────────────▼──────────────┐
        │     BACKEND API            │
        │  Node.js + Express         │  ← autenticação,
        │  (ou Next.js API Routes)   │    rotas, sessões,
        │                            │    lógica de negócio
        └──────┬──────────┬──────────┘
               │          │
    ┌──────────▼──┐  ┌────▼──────────────┐
    │  Supabase   │  │  Python Service   │
    │  (Postgres) │  │  (FastAPI)        │
    │             │  │                   │
    │ • pacientes │  │ • Whisper (STT)   │
    │ • laudos    │  │ • LLM (formatação)│
    │ • médicos   │  │ • Processamento   │
    │ • auth      │  │   de áudio        │
    │ • storage   │  └───────────────────┘
    └─────────────┘
```

### Por que essa stack?
- **Node.js/Next.js:** Ideal para a API principal, rotas em tempo real, integração fluida com Supabase e interfaces interativas.
- **Python (FastAPI):** Insubstituível para IA e áudio. Modelos como o Whisper da OpenAI e SDKs de LLM (Groq, Anthropic, LangChain) funcionam nativamente e de forma mais otimizada em Python.
- **Supabase (PostgreSQL):** Banco de dados robusto, autenticação nativa, e armazenamento em bucket (Storage) para os arquivos de áudio, com cota gratuita inicial muito generosa.

## 2. Estrutura do Banco de Dados (Supabase)

O banco de dados relacional (PostgreSQL) será estruturado com as seguintes tabelas principais:

```sql
-- Clínicas
CREATE TABLE clinicas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  logo_url TEXT
);

-- Médicos (vinculados ao auth do Supabase)
CREATE TABLE medicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  crm TEXT NOT NULL,
  especialidade TEXT,
  clinica_id UUID REFERENCES clinicas(id),
  assinatura_url TEXT
);

-- Pacientes
CREATE TABLE pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  cpf TEXT UNIQUE,
  clinica_id UUID REFERENCES clinicas(id)
);

-- Laudos
CREATE TABLE laudos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id UUID REFERENCES pacientes(id),
  medico_id UUID REFERENCES medicos(id),
  tipo_exame TEXT,
  achados TEXT,
  conclusao TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'rascunho', -- rascunho | finalizado | assinado
  criado_em TIMESTAMP DEFAULT NOW(),
  assinado_em TIMESTAMP
);

-- Áudios gravados
CREATE TABLE audio_gravacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  laudo_id UUID REFERENCES laudos(id),
  arquivo_url TEXT,
  transcricao_bruta TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

## 3. Estratégia de Inteligência Artificial

O fluxo de processamento do laudo será dividido em duas etapas de IA:

### Etapa A: Transcrição (Speech-to-Text)
O áudio gravado pelo médico será enviado para o **Whisper**.
- **Recomendação Inicial:** Usar a **API do Groq**, pois oferece processamento ultrarrápido do Whisper com limites gratuitos generosos, ideal para o MVP (Mínimo Produto Viável).
- **Alternativas:** API da OpenAI (paga por uso, super barata) ou Whisper local (exige servidor dedicado com mais memória).

### Etapa B: Formatação e Estruturação Médica (LLM)
O texto "cru" retornado pelo Whisper será processado por um **LLM (Large Language Model)** para adequação ao formato médico.
- **Exemplo:** 
  - *Entrada bruta:* "ventrículo esquerdo com dimensões normais fração de ejeção de sessenta e cinco por cento"
  - *Saída formatada:* "Ventrículo esquerdo com dimensões normais. Fração de ejeção de 65%, dentro dos parâmetros da normalidade."
- **Recomendação:** Utilizar **Claude API (Anthropic)** ou **OpenAI (GPT-4o-mini)** com um "System Prompt" altamente especializado em cardiologia e laudos de ecocardiograma/eletrocardiograma.

## 4. Estrutura de Diretórios Recomendada

```text
Sistema Pró Coração/
├── frontend/               ← Next.js (React)
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── pacientes/
│   │   │   └── laudos/
│   │   │       ├── novo/       ← tela principal com voz baseada no html atual
│   │   │       └── [id]/       ← visualizar/imprimir
│   │   └── components/
│   │       ├── ui/
│   │       ├── Recorder.tsx    ← Lógica de gravação
│   │       └── LaudoForm.tsx
│
├── api-service/            ← Python + FastAPI (Processamento IA)
│   ├── main.py
│   ├── whisper_client.py   ← Integração com Groq/Whisper
│   ├── llm_client.py       ← Integração com Claude/OpenAI
│   └── requirements.txt
│
└── supabase/               ← Configurações e Migrations do BD
    └── migrations/
```
*Nota: Para simplificar a infraestrutura inicial, a "Backend API" (Node.js) será implementada utilizando as **API Routes do próprio Next.js** (dentro da pasta `frontend/src/app/api/`), reduzindo a quantidade de servidores separados a manter.*

## 5. Passos para Implantação (Roadmap de Execução)

Abaixo está o plano de ação passo a passo para construir o sistema. Você pode acompanhar este plano ao longo do desenvolvimento:

- [ ] **Fase 1: Configuração do Supabase**
  - [ ] Criar projeto no Supabase.
  - [ ] Executar scripts SQL para criar as tabelas (Clínicas, Médicos, Pacientes, Laudos).
  - [ ] Configurar políticas de segurança (RLS).
  - [ ] Criar um Bucket no Storage para armazenar os arquivos de áudio `.webm` ou `.wav`.

- [ ] **Fase 2: Serviço de IA (Python)**
  - [ ] Criar ambiente virtual Python.
  - [ ] Configurar FastAPI.
  - [ ] Criar rota de recepção de áudio (`/transcribe`).
  - [ ] Integrar com Groq (Whisper) para transcrição.
  - [ ] Integrar com provedor LLM para formatação do texto.
  - [ ] Testar a API Python localmente.

- [ ] **Fase 3: Frontend & API Node (Next.js)**
  - [ ] Inicializar projeto Next.js com TailwindCSS e TypeScript.
  - [ ] Configurar integração com Supabase Client.
  - [ ] Adaptar o `laudo_medico.html` atual para componentes React.
  - [ ] Implementar a lógica de gravação de áudio no navegador (MediaRecorder API).
  - [ ] Criar a rota de API interna do Next.js que faz a ponte entre o Frontend e a API Python de IA.
  - [ ] Salvar os dados (áudio no Storage, texto no Banco de Dados).

- [ ] **Fase 4: Polimento e Hospedagem**
  - [ ] Validar fluxo completo: Gravar -> Transcrever -> Formatar -> Salvar.
  - [ ] Hospedar o Frontend na Vercel (Grátis).
  - [ ] Hospedar o Serviço Python no Railway ou Render.
  - [ ] Testes finais com áudios reais.

---
*Este documento é a sua "bóia de salvação" do projeto. Todo o contexto arquitetural está salvo aqui e pode ser usado por qualquer inteligência artificial ou desenvolvedor no futuro.*
