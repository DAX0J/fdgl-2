// ملف تهيئة Firebase Admin SDK للاستخدام في وظائف Netlify
const admin = require('firebase-admin');

// خيارات التهيئة الافتراضية للحساب المؤقت
const defaultServiceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID || "e2-com-10-2024-to-11-2024",
};

// تخزين مؤقت لتطبيق Firebase Admin لمنع التهيئة المتكررة
let firebaseAdminApp = null;

/**
 * تهيئة تطبيق Firebase Admin
 * @returns {admin.app.App} تطبيق Firebase Admin
 */
function initializeFirebaseAdmin() {
  // تجنب التهيئة المتكررة
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }
  
  try {
    // خيارات التهيئة
    const options = {
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
    };

    // التحقق من وجود اعتماد حساب الخدمة
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        // محاولة تحليل اعتماد حساب الخدمة من متغير البيئة
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        options.credential = admin.credential.cert(serviceAccount);
      } catch (parseError) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', parseError);
        // استخدام الاعتماد الافتراضي إذا فشل التحليل
        options.credential = admin.credential.cert(defaultServiceAccount);
      }
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      // استخدام مسار ملف اعتماد حساب الخدمة
      try {
        const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        options.credential = admin.credential.cert(serviceAccount);
      } catch (requireError) {
        console.error('Error loading service account from path:', requireError);
        // استخدام الاعتماد الافتراضي إذا فشل التحميل
        options.credential = admin.credential.cert(defaultServiceAccount);
      }
    } else {
      // استخدام معلومات الاعتماد المضمنة (مناسب للتطوير فقط)
      options.credential = admin.credential.cert(defaultServiceAccount);
      console.warn('Using default service account configuration. This is suitable for development only.');
    }

    // تهيئة تطبيق Firebase Admin
    firebaseAdminApp = admin.initializeApp(options);
    
    return firebaseAdminApp;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw new Error(`Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * الحصول على تطبيق Firebase Admin
 * @returns {admin.app.App} تطبيق Firebase Admin
 */
function getFirebaseAdminApp() {
  if (!firebaseAdminApp) {
    return initializeFirebaseAdmin();
  }
  return firebaseAdminApp;
}

/**
 * الحصول على خدمة المصادقة من Firebase Admin
 * @returns {admin.auth.Auth} خدمة المصادقة
 */
function getFirebaseAdminAuth() {
  return getFirebaseAdminApp().auth();
}

/**
 * الحصول على خدمة قاعدة البيانات من Firebase Admin
 * @returns {admin.database.Database} خدمة قاعدة البيانات
 */
function getFirebaseAdminDatabase() {
  return getFirebaseAdminApp().database();
}

/**
 * الحصول على خدمة Firestore من Firebase Admin
 * @returns {admin.firestore.Firestore} خدمة Firestore
 */
function getFirebaseAdminFirestore() {
  return getFirebaseAdminApp().firestore();
}

/**
 * الحصول على خدمة التخزين من Firebase Admin
 * @returns {admin.storage.Storage} خدمة التخزين
 */
function getFirebaseAdminStorage() {
  return getFirebaseAdminApp().storage();
}

module.exports = {
  initializeFirebaseAdmin,
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  getFirebaseAdminDatabase,
  getFirebaseAdminFirestore,
  getFirebaseAdminStorage
};