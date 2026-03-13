# Attendify

Attendify is a **Smart Student Attendance System** that allows teachers to mark and track student attendance using **Bluetooth-based proximity detection**. Instead of traditional manual attendance, students can automatically mark their presence when they are physically near the teacher’s device during a class session.

This system helps reduce proxy attendance and saves valuable class time by automating the attendance process.

---

## 🚀 Features

* 📡 Bluetooth-based attendance detection
* 🧑‍🏫 Teacher-controlled attendance sessions
* 📋 Real-time list of students present in a session
* ☁️ Attendance records stored securely using Firebase
* ⏱ Session-based attendance tracking

---

## 🛠 Tech Stack

Frontend

* HTML
* CSS
* JavaScript

Backend / Database

* Firebase Firestore

Connectivity

* Bluetooth API

---

## 📂 Project Structure

```
Attendify
│
├── public
│   ├── index.html
│   ├── app.js
│   └── style.css
│
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
└── DEPLOYMENT_GUIDE.md
```

---

## ⚙️ How It Works

1. The **teacher starts an attendance session**.
2. Students nearby **connect through Bluetooth**.
3. The system detects proximity and **marks attendance automatically**.
4. The teacher can **view a list of students who marked attendance for that session**.
5. Attendance data is stored in **Firebase Firestore**.

---

## 📅 Project Development Timeline

The full development workflow, milestones, and task tracking for Attendify are maintained on Notion.

Development Timeline:
https://www.notion.so/ATTENDIFY-3221c1e305fa8009a8adf222aefe93c1

---

## 🖥 Installation

Clone the repository:

```
git clone https://github.com/PYNE-ANKUR/Attendify.git
```

Go to the project directory:

```
cd Attendify
```

Install dependencies:

```
npm install
```

---

## ☁️ Deployment

This project is deployed using Firebase Hosting.

```
firebase login
firebase init
firebase deploy
```

---

## 📌 Future Improvements

* Student authentication system
* Bluetooth device verification
* Attendance analytics dashboard
* Export attendance reports
* Mobile application integration

---

## 🤝 Contributing

Contributions are welcome!
Feel free to open issues or submit pull requests.

---

## 📄 License

This project is licensed under the MIT License.
