'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, 
  Bot, 
  User, 
  ArrowLeft, 
  Terminal, 
  Cpu, 
  Database, 
  Cloud,
  Loader2,
  Award,
  Mic,
  Play,
  Square
} from 'lucide-react';

function selectChipmunkVoice(language?: 'es' | 'en'): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const langPrefix = language === 'en' ? 'en' : 'es';
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));

  const chipmunkPatterns = [
    /alvin/i,
    /ardilla|squirrel/i,
    /chipmunk|helium/i,
    /child|niñ|kid|infantil/i,
    /zira|paulina|helena|laura/i,
  ];

  for (const pattern of chipmunkPatterns) {
    const match = langVoices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  const highPitchHints = [/female|mujer|woman|femenin/i, /compact|mobile/i];
  for (const pattern of highPitchHints) {
    const match = langVoices.find((v) => pattern.test(v.name));
    if (match) return match;
  }

  return langVoices[0] ?? voices[0] ?? null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface Session {
  id: string;
  candidateName: string;
  technicalRole: string;
  experienceLevel: string;
  language: 'es' | 'en';
  status: string;
  language?: 'es' | 'en';
}

interface InterviewRoomClientProps {
  session: Session;
  initialMessages: Message[];
}

export default function InterviewRoomClient({ session, initialMessages }: InterviewRoomClientProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const spokenMessageIdsRef = useRef<Set<string>>(new Set());
  const chipmunkVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const speakText = (text: string, messageId?: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setPlayingMessageId(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = session.language === 'en' ? 'en-US' : 'es-ES';
    utterance.pitch = 2;
    utterance.rate = 1.25;

    const voice =
      chipmunkVoiceRef.current ?? selectChipmunkVoice(session.language);
    if (voice) utterance.voice = voice;

    if (messageId) {
      utterance.onstart = () => setPlayingMessageId(messageId);
      utterance.onend = () => setPlayingMessageId(null);
      utterance.onerror = () => setPlayingMessageId(null);
    }

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setPlayingMessageId(null);
  };

  const startVoiceRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Tu navegador no soporta reconocimiento de voz nativo. Prueba con Google Chrome o Safari.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = session.language === 'en' ? 'en-US' : 'es-ES';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onerror = (event) => {
      console.error(event);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadVoices = () => {
      chipmunkVoiceRef.current = selectChipmunkVoice(session.language);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, [session.language]);

  useEffect(() => {
    const modelMessages = messages.filter(
      (m) => m.role === 'model' && !m.text.startsWith('🚨')
    );
    const lastModel = modelMessages[modelMessages.length - 1];
    if (!lastModel || spokenMessageIdsRef.current.has(lastModel.id)) return;

    spokenMessageIdsRef.current.add(lastModel.id);
    speakText(lastModel.text, lastModel.id);
  }, [messages, session.language]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const userText = inputText.trim();
    setInputText('');
    setSending(true);

    // 1. Optimistic Update: Renderizar mensaje del usuario localmente al instante
    const userMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      text: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      // 2. Hacer POST al API route
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          messageText: userText,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al transmitir el mensaje');
      }

      const data = await response.json();

      // 3. Renderizar la respuesta del entrevistador (AI)
      const aiMsg: Message = {
        id: `temp-ai-${Date.now()}`,
        role: 'model',
        text: data.text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: `temp-err-${Date.now()}`,
        role: 'model',
        text: '🚨 [GCP Sandbox Error]: No se pudo establecer conexión con Vertex AI. Por favor, verifica que tu Service Account local (`gcp-key.json`) tenga el rol `roles/aiplatform.user` y que la cuota de tu proyecto de GCP esté activa.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-[90vh] max-w-7xl mx-auto w-full gap-6 p-4 md:p-6 relative z-10">
      
      {/* PANEL LATERAL: INFORMACIÓN DEL LABORATORIO DE NUBE */}
      <aside className="w-full md:w-80 flex flex-col gap-4">
        
        {/* INFO DE LA SESIÓN */}
        <div className="glass p-5 rounded-2xl border border-gray-800 relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-400 transition-colors w-fit font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Salir de la sala
          </button>

          <div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-2 py-0.5 rounded tracking-wide uppercase">
              Evaluación Activa
            </span>
            <h2 className="text-xl font-bold text-white mt-2 leading-tight">
              {session.technicalRole}
            </h2>
            <div className="flex gap-2 items-center mt-1 text-xs text-gray-400 font-mono">
              <span>Nivel:</span>
              <span className="text-emerald-400 font-semibold">{session.experienceLevel}</span>
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-3 text-xs space-y-2.5">
            <div className="flex justify-between items-center text-gray-400">
              <span>Candidato:</span>
              <span className="text-white font-medium">{session.candidateName}</span>
            </div>
            <div className="flex justify-between items-center text-gray-400">
              <span>ID Sesión:</span>
              <span className="text-indigo-300 font-mono text-[10px] truncate max-w-[120px]" title={session.id}>
                {session.id}
              </span>
            </div>
          </div>
        </div>

        {/* MONITOR DE ARQUITECTURA SERVERLESS (EDUCACIONAL) */}
        <div className="glass p-5 rounded-2xl border border-gray-800 flex-1 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            Monitor del Sandbox GCP
          </h3>

          <div className="space-y-3.5 flex-1">
            <div className="bg-black/40 rounded-xl p-3 border border-gray-800/60 flex items-start gap-2.5">
              <Cloud className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Cómputo Serverless</div>
                <div className="text-xs text-white font-medium mt-0.5">Google Cloud Run</div>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Módulo 4: 100% Serverless
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-xl p-3 border border-gray-800/60 flex items-start gap-2.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Persistencia NoSQL</div>
                <div className="text-xs text-white font-medium mt-0.5">Cloud Firestore</div>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Módulo 2: Stateless Sessions
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-xl p-3 border border-gray-800/60 flex items-start gap-2.5">
              <Cpu className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-bold text-pink-300 uppercase tracking-wider">Motor Cognitivo</div>
                <div className="text-xs text-white font-medium mt-0.5">Vertex AI Gemini</div>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Módulo 3: SDK Integration
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-3.5 text-xs text-indigo-300 leading-relaxed font-sans">
            <div className="flex gap-2 items-center font-bold text-white mb-1">
              <Award className="w-4 h-4 text-indigo-400" />
              Tip Académico:
            </div>
            Intenta responder de forma detallada, explicando los tradeoffs. El evaluador de IA está configurado para retarte técnicamente.
          </div>
        </div>

      </aside>

      {/* PANEL DE CHAT PRINCIPAL */}
      <section className="flex-1 glass rounded-2xl border border-gray-800 flex flex-col overflow-hidden relative">
        
        {/* Cabecera del Chat */}
        <div className="px-5 py-4 border-b border-gray-800 bg-gray-950/40 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center relative shadow-inner">
              <Bot className="w-5.5 h-5.5 text-indigo-400" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Evaluador Técnico Gemini</div>
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span>En Línea</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400 font-mono">Modo Entrevista</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-gray-900 border border-gray-800 text-gray-400 font-mono px-2 py-1 rounded">
              GCP API: Vertex AI
            </span>
          </div>
        </div>

        {/* Historial de Mensajes */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => {
            const isAI = msg.role === 'model';
            const canPlay = isAI && !msg.text.startsWith('🚨');
            const isPlaying = playingMessageId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${isAI ? 'mr-auto text-left' : 'ml-auto text-right flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div className={`w-8.5 h-8.5 rounded-full shrink-0 flex items-center justify-center border shadow-sm ${
                  isAI 
                    ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  {isAI ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                </div>

                {/* Burbuja */}
                <div className="space-y-1">
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow ${
                    isAI 
                      ? 'bg-gray-900/60 border border-gray-800/80 text-gray-100 rounded-tl-sm' 
                      : 'bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 border border-indigo-500/30 text-white rounded-tr-sm'
                  }`}>
                    {msg.text}
                  </div>
                  <div className={`flex items-center gap-2 px-1 ${isAI ? '' : 'justify-end'}`}>
                    <span className="text-[9px] text-gray-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {canPlay && (
                      <button
                        type="button"
                        onClick={() =>
                          isPlaying ? stopSpeaking() : speakText(msg.text, msg.id)
                        }
                        title={isPlaying ? 'Detener reproducción' : 'Escuchar mensaje del entrevistador'}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                          isPlaying
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-gray-800/80 text-gray-400 hover:text-indigo-300 hover:bg-gray-800 border border-gray-700/80'
                        }`}
                      >
                        {isPlaying ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3 h-3 fill-current" />
                        )}
                        {isPlaying ? 'Detener' : 'Escuchar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Indicador de que la IA está escribiendo */}
          {sending && (
            <div className="flex gap-3 max-w-[80%] mr-auto text-left items-start">
              <div className="w-8.5 h-8.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div className="bg-gray-900/60 border border-gray-800/80 p-4 rounded-2xl rounded-tl-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-gray-400 font-mono animate-pulse">Gemini está analizando tu respuesta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Caja de Input de Mensajes */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 bg-gray-950/20">
          <div className="relative flex items-center bg-gray-900/60 border border-gray-800 rounded-xl focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/35 transition-all p-1">
            <input
              type="text"
              required
              disabled={sending}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={sending ? 'Espera a que el entrevistador responda...' : 'Escribe tu respuesta técnica aquí...'}
              className="flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder-gray-500 focus:outline-none disabled:cursor-not-allowed"
            />
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                type="button"
                onClick={startVoiceRecognition}
                disabled={sending || isListening}
                title="Dictar respuesta con el micrófono"
                className={`relative p-2.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed ${
                  isListening
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-800 disabled:text-gray-600'
                }`}
              >
                <Mic className="w-4.5 h-4.5" />
                {isListening && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                )}
              </button>
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-600 text-white p-2.5 rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_0_10px_rgba(99,102,241,0.2)]"
              >
                {sending ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <Send className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 px-1">
            <span>
              {isListening
                ? 'Escuchando… habla ahora y revisa el texto antes de enviar'
                : 'Presiona Enter para enviar · usa el micrófono para dictar'}
            </span>
            <span>Autenticación: Cloud Service Account</span>
          </div>
        </form>

      </section>

    </div>
  );
}
