import { db } from '@/lib/firestore';
import { getGenAI } from '@/lib/vertex-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { candidateName, technicalRole, experienceLevel } = await req.json();

    if (!candidateName || !technicalRole || !experienceLevel) {
      return NextResponse.json(
        { error: 'Todos los campos (Nombre, Rol y Nivel) son requeridos.' },
        { status: 400 }
      );
    }

    const systemInstruction = `Actúas como un Entrevistador Técnico Senior experto en ${technicalRole} con nivel de experiencia ${experienceLevel}. 
Tu objetivo es realizar una entrevista técnica realista, rigurosa pero profesional y constructiva al candidato ${candidateName}.

Instrucciones críticas de comportamiento:
1. Preséntate brevemente de forma profesional en tu primer mensaje y da la bienvenida al candidato.
2. Realiza exactamente UNA pregunta técnica a la vez. Espera a que el candidato responda antes de evaluar y continuar con la siguiente.
3. Evalúa con precisión y rigor técnico la respuesta del candidato. Si hay algún error conceptual o de implementación, explícalo constructivamente de forma concisa y muestra la alternativa correcta.
4. Adapta la dificultad técnica de las preguntas estrictamente a su nivel (${experienceLevel}). Si es Senior, pregunta por diseño de sistemas, tradeoffs de escalabilidad, seguridad avanzada, costos y resiliencia en la nube. Si es Junior, enfócate en conceptos fundamentales, APIs y sintaxis básica.
5. Mantén un tono formal, profesional, empático y constructivo en todo momento.
6. Tras 4 o 5 interacciones de preguntas y respuestas, finaliza la entrevista de manera explícita indicando que ha concluido. Ofrece un reporte detallado con:
   - Fortalezas demostradas.
   - Áreas de mejora identificadas.
   - Una puntuación conceptual de 1 a 10 basada en su desempeño.`;

    // 1. Crear documento de sesión en Firestore con ID autogenerado
    const sessionRef = db.collection('sessions').doc();
    const sessionId = sessionRef.id;

    // 2. Usar el nuevo Google Gen AI SDK
    const ai = getGenAI();

    const initPrompt = `Inicia la entrevista técnica. Preséntate con formalidad corporativa ante el candidato ${candidateName}, dale la bienvenida a este espacio para evaluar su postulación como ${technicalRole} (${experienceLevel}), y realiza tu primera pregunta técnica sobre un tema base de este rol.`;

    // Llamar al método del nuevo SDK unificado
    const aiResult = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: initPrompt }] }],
      config: {
        systemInstruction: systemInstruction,
      }
    });


    const initialQuestion = aiResult.text || 
      `Hola ${candidateName}, bienvenido a tu entrevista técnica para el rol de ${technicalRole} (${experienceLevel}). Mi nombre es Gemini, seré tu evaluador hoy. Para comenzar, ¿podrías explicarnos qué consideraciones arquitectónicas priorizas al diseñar un servicio para que sea altamente disponible y tolerante a fallos?`;

    const now = new Date();

    // 3. Guardar datos principales de la sesión en Firestore
    await sessionRef.set({
      id: sessionId,
      candidateName,
      technicalRole,
      experienceLevel,
      status: 'active',
      systemInstructions: systemInstruction,
      createdAt: now,
      updatedAt: now,
      messageCount: 1,
    });

    // 4. Guardar la pregunta inicial generada por el modelo en la subcolección 'messages'
    const messageRef = sessionRef.collection('messages').doc();
    await messageRef.set({
      id: messageRef.id,
      timestamp: now,
      role: 'model',
      text: initialQuestion,
    });

    return NextResponse.json({
      sessionId,
      initialQuestion,
    });
  } catch (error: any) {
    console.error('Error al crear la sesión en Firestore:', error);
    return NextResponse.json(
      { error: 'Error interno al inicializar la sesión', details: error.message },
      { status: 500 }
    );
  }
}
