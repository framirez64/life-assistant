import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getVertexAI, Schema } from "@firebase/vertexai";

const firebaseConfig = {
  apiKey: "AIzaSyAWSO4UNbYjm0-ENCv2IIsGf4qNygGDsCo",
  authDomain: "frankai-ebb54.firebaseapp.com",
  projectId: "frankai-ebb54",
  storageBucket: "frankai-ebb54.firebasestorage.app",
  messagingSenderId: "353311236660",
  appId: "1:353311236660:web:682d1d3d74fd1fdd636061",
  measurementId: "G-6PXDMMLJKN"
};

export const app = initializeApp(firebaseConfig);

const database = getFirestore(app);
const analytics = getAnalytics(app);
const vertexAI = getVertexAI(app);

// 3) Pass that into your model’s generationConfig:

export { database, analytics, vertexAI, Schema };
