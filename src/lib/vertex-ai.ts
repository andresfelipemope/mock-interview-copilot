import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!aiInstance) {
    const projectId = process.env.GCP_PROJECT_ID;
    
    // Inicialización del nuevo SDK unificado de Google Gen AI para Vertex AI
    aiInstance = new GoogleGenAI({
      vertexai: true,
      project: projectId || 'build-time-fallback-project-id',
      location: process.env.GCP_LOCATION || 'us-central1',
    });
  }
  return aiInstance;
}
