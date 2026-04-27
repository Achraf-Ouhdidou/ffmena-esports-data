// ===== Firebase Configuration =====
// INSTRUCTIONS: Replace the config below with your Firebase project credentials.
// 1. Go to https://console.firebase.google.com/ and create a new project
// 2. Enable "Realtime Database" (set region, start in test mode)
// 3. Enable "Authentication" → "Email/Password" sign-in method
// 4. Create an admin user in Authentication → Users → Add User
// 5. Go to Project Settings → General → Your Apps → Web App → Register
// 6. Copy the firebaseConfig object here
// 7. Set Realtime Database rules to:
//    {
//      "rules": {
//        ".read": true,
//        ".write": "auth != null"
//      }
//    }

const firebaseConfig = {
  apiKey: "AIzaSyD7ruEHE68CiNKqSWlhCQHrsVc8YnpzDE8",
  authDomain: "test-63a46.firebaseapp.com",
  databaseURL: "https://test-63a46-default-rtdb.firebaseio.com",
  projectId: "test-63a46",
  storageBucket: "test-63a46.firebasestorage.app",
  messagingSenderId: "501755419382",
  appId: "1:501755419382:web:c7fe0e76a523add7e0aad7",
  measurementId: "G-XEN5LWECYQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
