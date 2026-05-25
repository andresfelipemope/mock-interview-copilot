import { Firestore } from '@google-cloud/firestore';

// Evitar múltiples instancias en desarrollo (Hot Reloading)
const globalForFirestore = global as unknown as { firestore: Firestore };

export const db = globalForFirestore.firestore || new Firestore({
  projectId: process.env.GCP_PROJECT_ID,
  // Establecemos 'copilot-db' como la base de datos por defecto del laboratorio
  databaseId: process.env.FIRESTORE_DB_ID || 'copilot-db',
});

if (process.env.NODE_ENV !== 'production') {
  globalForFirestore.firestore = db;
}
