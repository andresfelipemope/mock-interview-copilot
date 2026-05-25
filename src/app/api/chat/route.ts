import { db } from '@/lib/firestore';
import { getGenAI } from '@/lib/vertex-ai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { sessionId, messageText } = await req.json();

    if (!sessionId || !messageText) {
      return NextResponse.json(
        { error: 'El ID de la sesión y el texto del mensaje son requeridos.' },
        { status: 400 }
      );
    }

    // 1. Recuperar la sesión activa desde Firestore
    const sessionRef = db.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'La sesión especificada no existe.' },
        { status: 404 }
      );
    }

    const sessionData = sessionDoc.data()!;

    // 2. Recuperar todo el historial de la subcolección 'messages' ordenado cronológicamente
    const messagesSnapshot = await sessionRef
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messagesList: any[] = [];
    messagesSnapshot.forEach((doc) => {
      messagesList.push(doc.data());
    });

    // 3. Mapear el historial al esquema del SDK (roles 'user' y 'model')
    const history = messagesList.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    }));

    // 4. Instanciar el nuevo SDK unificado de Google Gen AI
    const ai = getGenAI();

    // 5. Iniciar la sesión de chat con el historial reconstruido y configuración
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: history,
      config: {
        systemInstruction: sessionData.systemInstructions,
        temperature: 0.75,
        maxOutputTokens: 2048,
      }
    });


    // 6. Enviar el nuevo mensaje a Vertex AI
    const result = await chat.sendMessage({
      message: messageText,
    });
    
    const aiResponseText = result.text || 
      'Disculpa, he tenido una desconexión momentánea con el servidor de IA. ¿Podrías replantear tu última respuesta?';

    const now = new Date();

    // 7. Persistir el mensaje del usuario en Firestore (timestamp inmediato previo)
    const userMsgRef = sessionRef.collection('messages').doc();
    await userMsgRef.set({
      id: userMsgRef.id,
      timestamp: new Date(now.getTime() - 1000), // Garantiza orden cronológico
      role: 'user',
      text: messageText,
    });

    // 8. Persistir la respuesta de la IA en la base de datos
    const aiMsgRef = sessionRef.collection('messages').doc();
    await aiMsgRef.set({
      id: aiMsgRef.id,
      timestamp: now,
      role: 'model',
      text: aiResponseText,
    });

    // 9. Actualizar metadatos de actualización y conteo de la sesión
    await sessionRef.update({
      updatedAt: now,
      messageCount: (sessionData.messageCount || 0) + 2,
    });

    return NextResponse.json({
      text: aiResponseText,
    });
  } catch (error: any) {
    console.error('Error crítico en el flujo de chat:', error);
    return NextResponse.json(
      { error: 'Error al procesar la respuesta con el modelo de lenguaje', details: error.message },
      { status: 500 }
    );
  }
}
