-- Extensão para gerar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clínicas
CREATE TABLE IF NOT EXISTS clinicas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  endereco TEXT,
  logo_url TEXT
);

-- Médicos (vinculados ao auth do Supabase)
CREATE TABLE IF NOT EXISTS medicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  crm TEXT NOT NULL,
  especialidade TEXT,
  clinica_id UUID REFERENCES clinicas(id),
  assinatura_url TEXT
);

-- Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  data_nascimento DATE,
  cpf TEXT UNIQUE,
  clinica_id UUID REFERENCES clinicas(id)
);

-- Laudos
CREATE TABLE IF NOT EXISTS laudos (
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
CREATE TABLE IF NOT EXISTS audio_gravacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  laudo_id UUID REFERENCES laudos(id),
  arquivo_url TEXT,
  transcricao_bruta TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);
