# Desafíos de Extensión: Mock Interview Copilot

¡Felicidades por completar la base de tu simulador de entrevistas! Si deseas llevar este proyecto al siguiente nivel y ganar puntos extra, te retamos a implementar las siguientes dos características profesionales.

---

## 🚀 Reto 1: Switch de Idioma (Español / Inglés)

### Objetivo
Permitir que el candidato seleccione en la pantalla inicial si desea que la entrevista se realice enteramente en **Español** o en **Inglés**.

### Guía de Implementación

1. **Modificar la UI de Bienvenida (`src/app/page.tsx`)**:
   Añade un estado en React para rastrear el idioma seleccionado:
   ```typescript
   const [language, setLanguage] = useState<'es' | 'en'>('es');
   ```
   Dibuja un selector visual o toggle y envíalo en el cuerpo del `fetch('/api/sessions')` al inicializar la sesión.

2. **Actualizar el Modelo de Firestore (`/sessions`)**:
   En `/api/sessions/route.ts`, recibe la propiedad `language` y guárdala en el documento principal de Firestore.

3. **Inyección Dinámica de Prompt (System Instruction)**:
   En `/api/sessions/route.ts`, parametriza la instrucción del sistema enviada a Vertex AI según el idioma elegido:
   ```typescript
   const systemInstruction = language === 'en' 
     ? `Act as a Senior Technical Recruiter evaluating a candidate for the role of ${technicalRole}...`
     : `Actúas como un Entrevistador Técnico Senior evaluando a un candidato para el rol de ${technicalRole}...`;
   ```

---

## 🎙️ Reto 2: Responder con Voz (Speech-to-Text)

### Objetivo
Añadir un botón de micrófono al lado de la caja de texto en la sala de chat. Al hacer clic, el navegador deberá escuchar la voz del estudiante, transcribirla en tiempo real e inyectar el texto en la caja de entrada para que este pueda revisarla y enviarla.

### Arquitectura Recomendada: Web Speech API (Browser Native)
Para evitar costos de red e infraestructura adicionales en GCP, utilizaremos la **Web Speech API** integrada nativamente en los navegadores modernos (Chrome, Safari, Edge).

### Código de Referencia para la UI (`InterviewRoomClient.tsx`)

Puedes inyectar la siguiente función y botón en tu cliente de chat para habilitar el micrófono:

```typescript
// 1. Declarar estado de grabación
const [isListening, setIsListening] = useState(false);

// 2. Función de transcripción nativa
const startVoiceRecognition = () => {
  // Verificar soporte del navegador
  const SpeechRecognition = 
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Tu navegador no soporta reconocimiento de voz nativo. Prueba con Google Chrome o Safari.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = session.language === 'en' ? 'en-US' : 'es-ES';
  recognition.interimResults = false;

  recognition.onstart = () => {
    setIsListening(true);
  };

  recognition.onerror = (event: any) => {
    console.error(event);
    setIsListening(false);
  };

  recognition.onend = () => {
    setIsListening(false);
  };

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    // Inyectar el texto en la caja de input
    setInputText((prev) => prev + " " + transcript);
  };

  recognition.start();
};
```

### 3. Modificaciones en la UI
Agrega un botón de micrófono `🎙️` al lado del botón de Enviar que invoque `startVoiceRecognition()`. Muestra un efecto visual de parpadeo (pulso rojo) en el botón mientras `isListening` sea verdadero para alertar al estudiante que el micrófono está activo.

---

## 🔊 Reto 3: Síntesis de Voz (Text-to-Speech) para el Entrevistador

### Objetivo
Hacer que el Entrevistador de IA (Gemini) **lea en voz alta** sus preguntas técnicas en cuanto estas aparezcan en la pantalla, adaptando su pronunciación si la entrevista está en inglés o español.

### Arquitectura Recomendada: Web Speech Synthesis API
Al igual que en el reto anterior, utilizaremos el motor de síntesis de voz nativo del navegador, el cual es 100% gratuito y no añade latencia de red.

### Guía de Implementación (`InterviewRoomClient.tsx`)

1. **Crear la función de reproducción**:
   Escribe esta función utilitaria en el componente cliente:
   ```typescript
   const speakText = (text: string) => {
     if (typeof window === 'undefined' || !window.speechSynthesis) return;

     // Cancelar lecturas previas en cola para evitar encabalgamiento de audios
     window.speechSynthesis.cancel();

     // Crear enunciado de voz
     const utterance = new SpeechSynthesisUtterance(text);

     // Adaptar el idioma de la voz (debe coincidir con la configuración del Reto 1)
     utterance.lang = session.language === 'en' ? 'en-US' : 'es-ES';

     // Hacer hablar al navegador
     window.speechSynthesis.speak(utterance);
   };
   ```

2. **Gatillar la reproducción al recibir mensajes**:
   En tu manejador de mensajes (`handleSubmit` o mediante un `useEffect` que vigile el historial), invoca `speakText(data.text)` inmediatamente después de agregar la respuesta del modelo al estado de `messages`.

### Preguntas de Reflexión para el Reporte de Laboratorio
*   ¿Qué ventajas de latencia y costos ofrece usar las APIs multimedia nativas del cliente (navegador) en comparación con hacer peticiones HTTPS a APIs de servicios cognitivos en la nube (como GCP Text-to-Speech)?
*   ¿Cómo afecta el rendimiento de un sistema serverless la delegación de tareas pesadas de procesamiento (como síntesis de voz y reconocimiento de audio) hacia los dispositivos de los usuarios finales?

