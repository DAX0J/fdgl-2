const admin = require("firebase-admin");

// تكوين Firebase الافتراضي
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "e2-com-10-2024-to-11-2024.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.FIREBASE_PROJECT_ID || "e2-com-10-2024-to-11-2024",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "e2-com-10-2024-to-11-2024.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "859750456330",
  appId: process.env.FIREBASE_APP_ID || "1:859750456330:web:cb21a5c394917b470713f3"
};

// تهيئة تطبيق Firebase Admin (نمط Singleton)
let firebaseApp;

function initializeFirebaseAdmin() {
  if (!admin.apps.length) {
    // إذا لم يتم تهيئة التطبيق بعد

    try {
      // محاولة استخدام بيانات حساب الخدمة إذا كانت متوفرة
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: firebaseConfig.databaseURL
        });
      } else {
        // استخدام بيانات الاعتماد الافتراضية
        firebaseApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: firebaseConfig.databaseURL
        });
      }
      console.log("Firebase Admin initialized successfully");
    } catch (error) {
      console.error("Error initializing Firebase Admin:", error);
      
      // محاولة التهيئة بطريقة مبسطة
      try {
        firebaseApp = admin.initializeApp({
          databaseURL: firebaseConfig.databaseURL
        });
        console.log("Firebase Admin initialized with minimal config");
      } catch (fallbackError) {
        console.error("Failed to initialize Firebase Admin with fallback:", fallbackError);
        throw new Error("Could not initialize Firebase Admin");
      }
    }
  } else {
    // إذا كان التطبيق مهيأ بالفعل، استخدم التطبيق الموجود
    firebaseApp = admin.app();
  }
  
  return firebaseApp;
}

// واجهات الخدمات
function getFirebaseAdminApp() {
  return initializeFirebaseAdmin();
}

function getFirebaseAdminAuth() {
  return initializeFirebaseAdmin().auth();
}

function getFirebaseAdminDatabase() {
  return initializeFirebaseAdmin().database();
}

function getFirebaseAdminFirestore() {
  return initializeFirebaseAdmin().firestore();
}

function getFirebaseAdminStorage() {
  return initializeFirebaseAdmin().storage();
}

// تصدير الدوال
module.exports = {
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  getFirebaseAdminDatabase,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage,
  firebaseConfig
};