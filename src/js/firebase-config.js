const firebaseConfig = {
  apiKey: "AIzaSyCcEr967KBilLmusc66xT6JVBG9Qrj4yZY",
  authDomain: "arcomix-8db18.firebaseapp.com",
  projectId: "arcomix-8db18",
  storageBucket: "arcomix-8db18.firebasestorage.app",
  messagingSenderId: "1067090080221",
  appId: "1:1067090080221:web:9af76f421a5be106048634"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = (typeof firebase.auth === 'function') ? firebase.auth() : null;
