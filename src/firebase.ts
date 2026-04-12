import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use the firestoreDatabaseId from the config if it exists, otherwise use the default
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export default app;
