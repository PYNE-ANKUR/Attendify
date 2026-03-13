# AttendX — Deployment Guide
## Firebase + Web Bluetooth Attendance System

---

## STEP 1 — Create a Firebase Project (5 minutes)

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it `attendx` → Continue
3. Disable Google Analytics (optional) → **Create project**

---

## STEP 2 — Enable Firebase Services

### Firestore Database
1. In Firebase Console → **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Next
4. Select a region close to your users (e.g., `asia-south1` for India) → **Enable**

### Authentication
1. **Build → Authentication** → **Get started**
2. **Sign-in method** → Enable **Email/Password** → Save

---

## STEP 3 — Get Your Firebase Config

1. Firebase Console → ⚙️ **Project Settings** (gear icon top-left)
2. Scroll to **"Your apps"** → Click **"</> Web"**
3. Register the app with name `AttendX` → **Register app**
4. Copy the `firebaseConfig` object shown — it looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "attendx-xxxxx.firebaseapp.com",
  projectId: "attendx-xxxxx",
  storageBucket: "attendx-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

---

## STEP 4 — Add Config to the App

Open `public/app.js` and replace the `FIREBASE_CONFIG` at the top:

```javascript
// Replace this block:
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  ...
};

// With your actual config:
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",         // ← your value
  authDomain:        "attendx-xxx.firebaseapp.com",
  projectId:         "attendx-xxx",
  storageBucket:     "attendx-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123...:web:abc..."
};
```

---

## STEP 5 — Install Firebase CLI & Deploy

Open your terminal in the `attendx/` folder:

```bash
# Install Firebase CLI (only once)
npm install -g firebase-tools

# Login to your Google account
firebase login

# Initialize project (run inside the attendx/ folder)
firebase init

# When prompted:
# ✅ Select: Firestore, Hosting
# ✅ Use existing project → select attendx-xxxxx
# ✅ Firestore rules file: firestore.rules (press Enter)
# ✅ Firestore indexes file: firestore.indexes.json (press Enter)
# ✅ Public directory: public (press Enter)
# ✅ Single-page app: Yes
# ✅ Overwrite index.html: No

# Deploy everything
firebase deploy
```

After deploy, you'll get a URL like:
**https://attendx-xxxxx.web.app** ← share this with your students!

---

## STEP 6 — Deploy Firestore Rules & Indexes

These are deployed automatically with `firebase deploy`, but you can also run:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only hosting
```

---

## HOW TO USE AFTER DEPLOYMENT

### Teacher
1. Open `https://your-app.web.app` on any device
2. Click **Educator** → login with email/password
3. Click **Start Attendance Session**
4. A 4-digit PIN appears → share it verbally or on screen
5. Watch students appear in real-time ✅

### Student
1. Open `https://your-app.web.app` on any device (phone, laptop, etc.)
2. Click **Student** → login with email/password + roll number
3. Enter the 4-digit PIN → click **Mark Attendance**
4. Done! Teacher sees your name instantly.

### Bluetooth (Optional — Chrome only)
- Students tap **"Auto-fill via Bluetooth"** to scan for teacher's device
- Requires: Chrome browser, HTTPS, Bluetooth enabled, ~10m range
- PIN is transmitted over BLE and auto-filled

---

## FIRESTORE DATA STRUCTURE

```
/sessions/{sessionId}
  code: "4821"
  teacherUid: "uid123"
  teacherName: "Dr. Sharma"
  className: "CS201"
  active: true
  startedAt: Timestamp
  expiresAt: Timestamp
  attendanceCount: 5

  /attendance/{studentUid}
    name: "Rahul Gupta"
    roll: "2024CS042"
    className: "CS201"
    time: "10:35 AM"
    date: "13/3/2026"
    markedAt: Timestamp

/users/{uid}
  name: "Dr. Sharma"
  role: "teacher"
  email: "..."
  
  /attendance/{docId}   ← student's personal history
    subject: "CS201"
    time: "10:35 AM"
    date: "13/3/2026"
```

---

## TROUBLESHOOTING

| Issue | Fix |
|-------|-----|
| "Firebase not configured" | Add your config to `app.js` FIREBASE_CONFIG |
| "Invalid PIN" | Make sure teacher's session is active |
| Bluetooth not working | Use Chrome on Android/Desktop, must be HTTPS |
| "Missing permissions" | Deploy firestore.rules with `firebase deploy --only firestore:rules` |
| Indexes error | Run `firebase deploy --only firestore:indexes` |

---

## FREE TIER LIMITS (Firebase Spark Plan)

| Resource | Free Limit | AttendX usage |
|----------|-----------|---------------|
| Firestore reads | 50,000/day | ~5 per student per session |
| Firestore writes | 20,000/day | ~2 per student per session |
| Hosting bandwidth | 10 GB/month | Very low |
| Auth users | Unlimited | ✅ |

The free tier easily supports hundreds of students per day.

---

Built with ❤️ using Firebase + Web Bluetooth API
