
// Ensure we are using the modular Firebase SDK (v9+)
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, get, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAmPFwV1ld4H6CWukHtEoKPg9E2tHWkyxE",
  authDomain: "not-b25f1.firebaseapp.com",
  databaseURL: "https://not-b25f1-default-rtdb.firebaseio.com",
  projectId: "not-b25f1",
  storageBucket: "not-b25f1.firebasestorage.app",
  messagingSenderId: "554877315906",
  appId: "1:554877315906:web:234309f8a149e60afd36db",
  measurementId: "G-9PLRDRTYND"
};

// Initialize Firebase with the modular SDK
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface SavedProject {
  id: string;
  name: string;
  html: string;
  timestamp: number;
}

// Function to save or update a project
export const saveProject = async (name: string, html: string, existingId?: string): Promise<string> => {
  const projectsRef = ref(db, 'projects');
  let id = existingId;
  
  if (!id) {
    const newProjectRef = push(projectsRef);
    id = newProjectRef.key!;
  }

  const projectData: SavedProject = {
    id,
    name,
    html,
    timestamp: Date.now()
  };

  await set(ref(db, `projects/${id}`), projectData);
  return id;
};

// Function to delete a project
export const deleteProject = async (id: string): Promise<void> => {
  const projectRef = ref(db, `projects/${id}`);
  await remove(projectRef);
};

// Function to fetch all projects
export const getProjects = async (): Promise<SavedProject[]> => {
  const projectsRef = ref(db, 'projects');
  const snapshot = await get(projectsRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data) as SavedProject[];
  }
  return [];
};

// Real-time listener for projects
export const listenToProjects = (callback: (projects: SavedProject[]) => void) => {
  const projectsRef = ref(db, 'projects');
  return onValue(projectsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(Object.values(data) as SavedProject[]);
    } else {
      callback([]);
    }
  });
};
