import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { 
  Mic, 
  Square, 
  Printer, 
  Plus, 
  Trash2, 
  Check, 
  Loader2, 
  AlertCircle,
  LogOut,
  User,
  Heart
} from "lucide-react";

export default function LaudoMedico() {
  const [currentExam, setCurrentExam] = useState("Ecocardiograma");
  const [examDetails, setExamDetails] = useState("");
  const [currentSection, setCurrentSection] = useState("findings");
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("O texto reconhecido aparecerá aqui...");
  const [micStatus, setMicStatus] = useState("Clique no microfone para começar");

  const [patientName, setPatientName] = useState("");
  const [patientDOB, setPatientDOB] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorCRM, setDoctorCRM] = useState("");
  const [doctorSpec, setDoctorSpec] = useState("");

  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");
  const [fullDateTime, setFullDateTime] = useState("");
  const [browserNotice, setBrowserNotice] = useState(false);

  // References for contenteditable sections
  const findingsRef = useRef<HTMLDivElement>(null);
  const conclusionRef = useRef<HTMLDivElement>(null);
  const observationsRef = useRef<HTMLDivElement>(null);
  
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const supabase = createClientComponentClient();
  const router = useRouter();

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setSession(session);
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setFullDateTime(
        now.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }) +
        " · " +
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
      setDateStr(now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }));
      setTimeStr(now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  const getAge = (dobString: string) => {
    if (!dobString) return "—";
    const bd = new Date(dobString + "T00:00:00");
    const age = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${bd.toLocaleDateString("pt-BR")} (${age} anos)`;
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioToAPI(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMicStatus('🔴 Gravando... fale o laudo (clique novamente para enviar)');
      setInterimText('Gravando áudio... (Fale claramente)');
    } catch (err) {
      console.error("Erro ao acessar microfone", err);
      setBrowserNotice(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setMicStatus('Processando áudio com Inteligência Artificial...');
      setInterimText('Aguarde, a IA (Whisper + GPT) está transcrevendo e formatando...');
    }
  };

  const sendAudioToAPI = async (audioBlob: Blob) => {
    try {
      // Pegar o texto atual da seção para a IA poder fazer correções contextuais
      let currentText = '';
      if (currentSection === "findings" && findingsRef.current) currentText = findingsRef.current.innerText;
      if (currentSection === "conclusion" && conclusionRef.current) currentText = conclusionRef.current.innerText;
      if (currentSection === "observations" && observationsRef.current) currentText = observationsRef.current.innerText;

      const formData = new FormData();
      formData.append("audio", audioBlob, "gravacao.webm");
      formData.append("section", currentSection);
      formData.append("examType", currentExam + (examDetails ? " detalhado como: " + examDetails : ""));
      formData.append("currentText", currentText.trim());

      const apiUrl = "/api/transcribe";
      
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      
      if (data.text) {
        setInterimText(`✅ Processamento concluído.`);
        
        if (data.action === 'replace') {
          // Substituir todo o conteúdo da seção (para edições/correções)
          let el;
          if (currentSection === "findings" && findingsRef.current) el = findingsRef.current;
          if (currentSection === "conclusion" && conclusionRef.current) el = conclusionRef.current;
          if (currentSection === "observations" && observationsRef.current) el = observationsRef.current;
          if (el) {
            el.innerHTML = data.text
              .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
              .replace(/\n/g, '<br>');
          }
        } else {
          // Adicionar ao final (comportamento padrão)
          appendToSection(data.text);
        }
      } else {
        setInterimText("Erro ao processar: " + (data.error || "Resposta inválida da IA"));
      }
    } catch (error: any) {
      console.error("Erro na API", error);
      setInterimText("Erro no Frontend: " + error.message);
    } finally {
      setTimeout(() => {
        setMicStatus('Clique no microfone para começar');
        setInterimText('O texto reconhecido aparecerá aqui...');
      }, 5000);
    }
  };

  const appendToSection = (text: string) => {
    let el;
    if (currentSection === "findings" && findingsRef.current) el = findingsRef.current;
    if (currentSection === "conclusion" && conclusionRef.current) el = conclusionRef.current;
    if (currentSection === "observations" && observationsRef.current) el = observationsRef.current;
    
    if (el) {
      const curText = el.innerText.trim();
      const sep = curText.length > 0 && !el.innerHTML.endsWith('&nbsp;') && !el.innerHTML.endsWith(' ') ? ' ' : '';
      
      // Converter markdown (**) em HTML <b> e quebras de linha em <br>
      let htmlText = text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
        
      el.innerHTML = el.innerHTML + sep + htmlText;
      
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const addTopic = () => {
    let el;
    if (currentSection === "findings" && findingsRef.current) el = findingsRef.current;
    if (currentSection === "conclusion" && conclusionRef.current) el = conclusionRef.current;
    if (currentSection === "observations" && observationsRef.current) el = observationsRef.current;
    
    if (el) {
      const curHtml = el.innerHTML;
      const curText = el.innerText;
      
      // Procurar o maior número atual
      const matches = curText.match(/(?:^|\n)(\d+)\./g);
      let nextNum = 1;
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const lastNum = parseInt(lastMatch.replace(/\D/g, ''));
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      
      const prefix = curText.trim().length > 0 ? '<br>' : '';
      el.innerHTML = curHtml + prefix + `<b>${nextNum}.</b>&nbsp;`;
      
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const clearCurrentSection = () => {
    if (confirm('Limpar a seção atual?')) {
      if (currentSection === "findings" && findingsRef.current) findingsRef.current.innerText = '';
      if (currentSection === "conclusion" && conclusionRef.current) conclusionRef.current.innerText = '';
      if (currentSection === "observations" && observationsRef.current) observationsRef.current.innerText = '';
    }
  };

  const clearAll = () => {
    if (confirm('Limpar todo o conteúdo do laudo?')) {
      if (findingsRef.current) findingsRef.current.innerText = '';
      if (conclusionRef.current) conclusionRef.current.innerText = '';
      if (observationsRef.current) observationsRef.current.innerText = '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <>
      <div className="topbar no-print">
        <div className="topbar-brand">
          <Heart className="text-red-500 fill-red-500 w-6 h-6" />
          <div>
            <div className="topbar-title">Sistema de Laudo por Voz</div>
            <div className="topbar-sub">Pro Coração · Laudos Digitais</div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm font-bold text-slate-800 flex items-center justify-end gap-1">
              <User className="w-3 h-3" /> {session?.user?.email}
            </div>
            <div className="text-[0.65rem] text-slate-500 uppercase tracking-wider">{fullDateTime}</div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-all text-sm font-medium border border-slate-200"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </div>

      <div className="app">
        <div className="sidebar">
          <div>
            <div className="section-label">Tipo de Exame</div>
            <div className="exam-chips">
              {['Ecocardiograma', 'Eletrocardiograma', 'Imagem', 'Laboratório', 'Holter', 'Outro'].map(exam => (
                <button
                  key={exam}
                  className={`chip ${currentExam === exam ? 'active' : ''}`}
                  onClick={() => setCurrentExam(exam)}
                >
                  {exam}
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: "12px" }}>
              <label>Detalhes do Exame (Opcional)</label>
              <input type="text" placeholder="Ex: Transtorácico com Doppler" value={examDetails} onChange={e => setExamDetails(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="section-label">Dados do Paciente</div>
            <div className="field-group">
              <div className="field">
                <label>Nome completo</label>
                <input type="text" placeholder="José Alves da Silva" value={patientName} onChange={e => setPatientName(e.target.value)} />
              </div>
              <div className="field">
                <label>Data de nascimento</label>
                <input type="date" value={patientDOB} onChange={e => setPatientDOB(e.target.value)} />
              </div>
              <div className="field">
                <label>Médico solicitante</label>
                <input type="text" placeholder="Dr. Nome Sobrenome" value={solicitante} onChange={e => setSolicitante(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="section-label">Médico Laudador</div>
            <div className="field-group">
              <div className="field">
                <label>Nome completo</label>
                <input type="text" placeholder="Dr. Carlos Mendes" value={doctorName} onChange={e => setDoctorName(e.target.value)} />
              </div>
              <div className="field">
                <label>CRM</label>
                <input type="text" placeholder="CRM/RJ 12345" value={doctorCRM} onChange={e => setDoctorCRM(e.target.value)} />
              </div>
              <div className="field">
                <label>Especialidade</label>
                <input type="text" placeholder="Cardiologista" value={doctorSpec} onChange={e => setDoctorSpec(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Gravar em</span>
              <button onClick={addTopic} style={{ cursor: 'pointer', background: 'var(--crimson-light)', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.6rem', fontWeight: 'bold' }}>
                + Novo Tópico
              </button>
            </div>
            <div className="section-chips">
              <button className={`sec-chip ${currentSection === 'findings' ? 'active' : ''}`} onClick={() => setCurrentSection('findings')}>Achados</button>
              <button className={`sec-chip ${currentSection === 'conclusion' ? 'active' : ''}`} onClick={() => setCurrentSection('conclusion')}>Conclusão</button>
              <button className={`sec-chip ${currentSection === 'observations' ? 'active' : ''}`} onClick={() => setCurrentSection('observations')}>Observações</button>
            </div>
          </div>

          <div>
            <div className="section-label">Ditado por Voz</div>
            <div className="mic-area">
              <button className={`mic-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording} title="Clique para gravar">
                {isRecording ? '⏹️' : '🎙️'}
              </button>
              <div className={`mic-status ${isRecording ? 'active' : ''}`}>{micStatus}</div>
              <div className="interim-box">{interimText}</div>
            </div>
            {browserNotice && (
              <div className="notice warn">
                ⚠️ Seu navegador não suporta reconhecimento de voz nativo.
              </div>
            )}
          </div>

          <div>
            <div className="section-label">Ações</div>
            <div className="action-btns">
              <button className="btn btn-gold" onClick={handlePrint}>
                <span className="ico">🖨️</span> Imprimir Laudo
              </button>
              <button className="btn btn-outline" onClick={clearCurrentSection}>
                <span className="ico">🗑️</span> Limpar Seção Atual
              </button>
              <button className="btn btn-danger" onClick={clearAll}>
                <span className="ico">⚠️</span> Limpar Tudo
              </button>
            </div>
          </div>
        </div>

        <div className="main">
          <div className="laudo-card">
            <div className="toolbar-row print-hide">
              <span>📋 Pré-visualização do Laudo · Clique em qualquer campo de texto para editar manualmente</span>
            </div>

            <div id="printArea">
              <div className="laudo-header">
                <div className="clinic-info">
                  <div className="clinic-name">
                    <span className="clinic-logo-heart">♥</span>
                    Pro Coração
                  </div>
                  <div className="clinic-sub">Cardiologia &amp; Diagnóstico por Imagem</div>
                </div>
                <div className="laudo-date-box">
                  <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Data do Exame</span>
                  <strong>{dateStr}</strong>
                  <span style={{ color: "var(--gray)", fontSize: "0.78rem" }}>{timeStr}</span>
                </div>
              </div>

              <div className="patient-bar">
                <div className="patient-field">
                  <label>Paciente</label>
                  <span>{patientName || '—'}</span>
                </div>
                <div className="patient-field">
                  <label>Data de Nascimento / Idade</label>
                  <span>{patientDOB ? getAge(patientDOB) : '—'}</span>
                </div>
                <div className="patient-field">
                  <label>Médico Solicitante</label>
                  <span>{solicitante || '—'}</span>
                </div>
              </div>

              <div style={{ textAlign: "center", margin: "20px 0", borderBottom: "2px solid #f1f5f9", paddingBottom: "10px" }}>
                <h2 style={{ fontSize: "1.4rem", fontWeight: "bold", textTransform: "uppercase", color: "var(--primary)" }}>
                  {currentExam} {examDetails ? `- ${examDetails}` : ''}
                </h2>
              </div>

              <div className="laudo-body">
                <div className="laudo-section">
                  <div className="laudo-section-title">Achados / Descrição do Exame</div>
                  <div className={`editable-section ${currentSection === 'findings' ? 'target' : ''}`}
                    ref={findingsRef} contentEditable suppressContentEditableWarning
                    data-placeholder="Descreva os achados do exame aqui..."
                    onClick={() => setCurrentSection('findings')}></div>
                </div>

                <div className="laudo-section">
                  <div className="laudo-section-title">Conclusão</div>
                  <div className={`editable-section ${currentSection === 'conclusion' ? 'target' : ''}`}
                    ref={conclusionRef} contentEditable suppressContentEditableWarning
                    data-placeholder="Conclusão e impressão diagnóstica..."
                    onClick={() => setCurrentSection('conclusion')}></div>
                </div>

                <div className="laudo-section">
                  <div className="laudo-section-title">Observações</div>
                  <div className={`editable-section ${currentSection === 'observations' ? 'target' : ''}`}
                    ref={observationsRef} contentEditable suppressContentEditableWarning
                    data-placeholder="Observações adicionais..."
                    onClick={() => setCurrentSection('observations')}></div>
                </div>
              </div>

              <div className="signature-area">
                <div className="signature-block">
                  <div className="sig-line"></div>
                  <div className="sig-name">{doctorName ? `Dr. ${doctorName}` : 'Dr. ________________'}</div>
                  <div className="sig-crm">{doctorCRM ? `CRM: ${doctorCRM}` : 'CRM: ________________'}</div>
                  <div className="sig-crm" style={{ marginTop: "2px", fontStyle: "italic" }}>{doctorSpec}</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className={`voice-indicator ${isRecording ? 'show' : ''}`}>
        <span className="rec-dot"></span> Gravando...
      </div>
    </>
  );
}
