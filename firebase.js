import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const appId = typeof __app_id !== 'undefined' ? __app_id : 'floor-paint-pro';
const CONFIG_KEY = 'FLOOR_PAINT_FIREBASE_CONFIG';
const FIRESTORE_WRITE_TIMEOUT_MS = 20000;
const defaultFirebaseConfig = {
  apiKey: 'AIzaSyBM8mNuQMZQagY_KifPZ3SpfbOlw5VQP_A',
  authDomain: 'webapp-871d3.firebaseapp.com',
  projectId: 'webapp-871d3',
  storageBucket: 'webapp-871d3.firebasestorage.app',
  messagingSenderId: '573892274147',
  appId: '1:573892274147:web:885676f9ce31ac4027a2d6',
  measurementId: 'G-BMT5V9YHYK'
};
let auth = null;
let db = null;
let unsubscribeFirestore = null;

function updateCloudStatus(message, connected = false) {
  const badge = document.getElementById('cloud-status-badge');
  const text = document.getElementById('cloud-status-text');
  badge.className = connected
    ? 'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
    : 'flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30';
  text.innerText = message;
}

function getJobsCollection() {
  return collection(db, 'artifacts', appId, 'public', 'data', 'painting_jobs');
}

function listenToFirestoreJobs() {
  if (!db || !auth?.currentUser) return;
  if (unsubscribeFirestore) unsubscribeFirestore();

  unsubscribeFirestore = onSnapshot(getJobsCollection(), (snapshot) => {
    const jobs = snapshot.docs.map((jobDoc) => ({
      id: jobDoc.id,
      ...jobDoc.data()
    }));
    window.jobsState = jobs;
    window.renderAllViews();
  }, (error) => {
    console.error('Firestore listener failed:', error);
    updateCloudStatus('Cloud දත්ත ලබාගැනීමේ දෝෂයක්');
    window.showToast(`Cloud දත්ත ලබාගත නොහැක: ${error.message}`, 'error');
  });
}

function notifyAuthState(configured, user = null, message = '') {
  window.updateAuthUI({
    configured,
    authenticated: Boolean(user),
    email: user?.email || '',
    message
  });
}

async function initializeFirebase() {
  let config;
  const customConfig = localStorage.getItem(CONFIG_KEY);
  try {
    if (typeof __firebase_config !== 'undefined') {
      config = JSON.parse(__firebase_config);
    } else if (customConfig) {
      config = JSON.parse(customConfig);
    } else {
      config = defaultFirebaseConfig;
    }
  } catch (error) {
    const message = `Firebase Config JSON වලංගු නොවේ: ${error.message}`;
    updateCloudStatus('Firebase සැකසුම අවශ්‍යයි');
    notifyAuthState(false, null, message);
    return;
  }

  if (!config) {
    updateCloudStatus('Firebase සැකසුම අවශ්‍යයි');
    notifyAuthState(false, null, 'පළමුව Firebase Cloud සැකසුම් තුළ ඔබේ Project Config එක ඇතුළත් කරන්න.');
    return;
  }

  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    notifyAuthState(true);

    onAuthStateChanged(auth, (user) => {
      if (user) {
        updateCloudStatus('Cloud සජීවීව සම්බන්ධයි (Live)', true);
        notifyAuthState(true, user);
        listenToFirestoreJobs();
      } else {
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
        window.jobsState = [];
        window.renderAllViews();
        updateCloudStatus('පුරනය වීම අවශ්‍යයි');
        notifyAuthState(true);
      }
    }, (error) => {
      console.error('Firebase authentication state failed:', error);
      updateCloudStatus('Firebase Authentication දෝෂයක්');
      notifyAuthState(false, null, `Firebase Authentication දෝෂයක්: ${error.message}`);
    });
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    updateCloudStatus('Firebase සම්බන්ධතාවය අසාර්ථකයි');
    notifyAuthState(false, null, `Firebase වෙත සම්බන්ධ විය නොහැක: ${error.message}`);
  }
}

window.firebaseSignIn = async function(email, password) {
  if (!auth) {
    throw new Error('Firebase Config සකසා නැත හෝ Firebase ආරම්භ වී නැත.');
  }
  await signInWithEmailAndPassword(auth, email, password);
};

window.firebaseSignOut = async function() {
  if (!auth) {
    throw new Error('Firebase Authentication සම්බන්ධ වී නැත.');
  }
  await signOut(auth);
};

window.cloudSaveJob = async function(jobData) {
  if (!db || !auth?.currentUser) {
    throw new Error('Cloud වෙත දත්ත සුරැකීමට පුරනය වන්න.');
  }
  if (window.location.protocol === 'file:') {
    const error = new Error('Firebase Cloud භාවිතා කිරීමට මෙම HTML ගොනුව file:// ලෙස නොව VS Code Live Server වැනි localhost web server එකකින් විවෘත කරන්න.');
    error.code = 'firebase/file-origin';
    throw error;
  }
  const jobRef = doc(getJobsCollection(), jobData.id);
  let timeoutId;
  try {
    await Promise.race([
      setDoc(jobRef, {
        ...jobData,
        updatedAt: new Date().toISOString()
      }),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          const error = new Error('Firestore did not confirm the save within 20 seconds.');
          error.code = 'firestore/write-timeout';
          reject(error);
        }, FIRESTORE_WRITE_TIMEOUT_MS);
      })
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
};

window.cloudDeleteJob = async function(jobId) {
  if (!db || !auth?.currentUser) {
    throw new Error('Cloud දත්ත මකා දැමීමට පුරනය වන්න.');
  }
  await deleteDoc(doc(getJobsCollection(), jobId));
};

window.addEventListener('load', initializeFirebase);
