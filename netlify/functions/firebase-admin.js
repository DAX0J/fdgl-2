const admin = require("firebase-admin");
const { getFirebaseConfig } = require("./utils/util");

// تهيئة تطبيق Firebase Admin إذا لم يتم تهيئته بالفعل
let firebaseApp;

function initializeFirebaseAdmin() {
  if (!firebaseApp) {
    // استخدام الحساب الخدمي إذا كان متوفرًا في متغيرات البيئة
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
      } catch (error) {
        console.error("Error initializing Firebase Admin with service account:", error);
        
        // استخدام التهيئة الافتراضية كخطة بديلة
        const config = getFirebaseConfig();
        firebaseApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: config.databaseURL
        });
      }
    } else {
      // استخدام أوراق اعتماد التطبيق الافتراضية
      const config = getFirebaseConfig();
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: config.databaseURL
      });
    }
  }
  
  return firebaseApp;
}

// إعادة المثيلات من Firebase Admin التي يمكن استخدامها في الوظائف
function getFirebaseAdminApp() {
  return initializeFirebaseAdmin();
}

function getFirebaseAdminAuth() {
  const app = initializeFirebaseAdmin();
  return app.auth();
}

function getFirebaseAdminDatabase() {
  const app = initializeFirebaseAdmin();
  return app.database();
}

function getFirebaseAdminFirestore() {
  const app = initializeFirebaseAdmin();
  return app.firestore();
}

function getFirebaseAdminStorage() {
  const app = initializeFirebaseAdmin();
  return app.storage();
}

// تصدير الدوال المساعدة
module.exports = {
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  getFirebaseAdminDatabase,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
};