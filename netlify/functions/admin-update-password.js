const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');
const { 
  isAuthenticated, 
  getUserFromRequest,
  unauthorizedResponse,
  forbiddenResponse
} = require('./utils/auth');

// Firebase تكوين
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "e2-com-10-2024-to-11-2024.firebaseapp.com",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.FIREBASE_PROJECT_ID || "e2-com-10-2024-to-11-2024",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "e2-com-10-2024-to-11-2024.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "859750456330",
  appId: process.env.FIREBASE_APP_ID || "1:859750456330:web:cb21a5c394917b470713f3",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-KLPJPL70KN"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const handler = async (event, context) => {
  // التأكد من أن الطلب هو POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'الطريقة غير مسموح بها' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    // التحقق إذا كان المستخدم مصادق عليه
    const authenticated = isAuthenticated(event);
    if (!authenticated) {
      return unauthorizedResponse('الجلسة منتهية أو غير صالحة');
    }
    
    // الحصول على معلومات المستخدم
    const user = getUserFromRequest(event);
    
    // التحقق إذا كان المستخدم مسؤول
    if (!user || user.admin !== true) {
      return forbiddenResponse('يجب أن تكون مسؤول للوصول إلى هذه الواجهة');
    }
    
    // تحليل معلومات الطلب
    const requestBody = JSON.parse(event.body);
    const { password, enabled } = requestBody;
    
    // تسجيل الإجراء قبل تنفيذه
    console.log(`تحديث إعدادات كلمة المرور - تمكين: ${enabled !== undefined ? enabled : 'لم يتغير'}, كلمة المرور: ${password ? 'تم تحديثها' : 'لم تتغير'}`);
    
    // تحديث إعدادات كلمة المرور في Firebase
    if (password !== undefined) {
      await set(ref(database, 'siteSettings/passwordProtection/password'), password);
    }
    
    if (enabled !== undefined) {
      await set(ref(database, 'siteSettings/passwordProtection/enabled'), enabled);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'تم تحديث إعدادات كلمة المرور بنجاح'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في تحديث إعدادات كلمة المرور:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تحديث إعدادات كلمة المرور'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

exports.handler = Handler(handler, {
  cors: {
    origin: '*',  // يجب تغييره للإنتاج للسماح فقط بالمجالات المصرح بها
    headers: ['Content-Type', 'Authorization'],
    credentials: true
  }
});