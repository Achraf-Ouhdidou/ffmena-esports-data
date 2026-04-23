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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
