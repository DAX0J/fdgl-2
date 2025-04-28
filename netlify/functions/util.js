// ملف مساعد للنقطة المشتركة بين جميع وظائف Netlify Functions

// تكوين Firebase لجميع الوظائف
const getFirebaseConfig = () => {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "e2-com-10-2024-to-11-2024.firebaseapp.com",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: process.env.FIREBASE_PROJECT_ID || "e2-com-10-2024-to-11-2024",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "e2-com-10-2024-to-11-2024.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "859750456330",
    appId: process.env.FIREBASE_APP_ID || "1:859750456330:web:cb21a5c394917b470713f3",
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-KLPJPL70KN"
  };
};

// استخراج معلومات العميل من الطلب
const getClientInfo = (event) => {
  return {
    ip: event.headers['client-ip'] || 
        event.headers['x-forwarded-for'] || 
        event.headers['x-real-ip'] || 
        'unknown-ip',
    userAgent: event.headers['user-agent'] || 'unknown',
    origin: event.headers['origin'] || 'unknown',
    referer: event.headers['referer'] || 'unknown',
  };
};

// إنشاء استجابة خطأ قياسية
const createErrorResponse = (statusCode, message, additionalData = {}) => {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      message,
      ...additionalData
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

// إنشاء استجابة نجاح قياسية
const createSuccessResponse = (data = {}, statusCode = 200) => {
  return {
    statusCode,
    body: JSON.stringify({
      success: true,
      ...data
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

// تصدير الدوال المساعدة
module.exports = {
  getFirebaseConfig,
  getClientInfo,
  createErrorResponse,
  createSuccessResponse
};