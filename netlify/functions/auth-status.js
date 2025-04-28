const { Handler } = require('@netlify/functions');
const { 
  isAuthenticated, 
  extractAuthToken,
  verifyToken
} = require('./utils/auth');
const { handleCors } = require('./utils/cors');
const { createSuccessResponse, createErrorResponse } = require('./utils/util');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');

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
  // التأكد من أن الطلب هو GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'الطريقة غير مسموح بها' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    // التحقق إذا كان المستخدم مصادق عليه
    const authenticated = isAuthenticated(event);
    
    // استخراج معلومات المستخدم من الرمز
    let isAdmin = false;
    let userEmail = null;
    
    // إذا كان المستخدم مصادقًا عليه، نتحقق من صلاحياته
    if (authenticated) {
      const token = extractAuthToken(event);
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          userEmail = decoded.email;
          isAdmin = decoded.isAdmin === true;
          
          // التحقق من وجود البريد الإلكتروني في قائمة المسؤولين
          if (isAdmin && userEmail) {
            try {
              const adminEmailsRef = ref(database, 'authorizedAdminEmails');
              const snapshot = await get(adminEmailsRef);
              const authorizedEmails = snapshot.val() || {};
              
              isAdmin = Object.keys(authorizedEmails).includes(userEmail);
            } catch (firebaseError) {
              console.error('خطأ Firebase:', firebaseError);
              // في حالة خطأ، نعتبر المستخدم غير مسؤول
              isAdmin = false;
            }
          }
        }
      }
    }
    
    // الحصول على حالة حماية كلمة المرور
    let isProtectionEnabled = true; // افتراضيًا
    try {
      const protectionSnapshot = await get(ref(database, 'siteSettings/passwordProtection/enabled'));
      isProtectionEnabled = protectionSnapshot.val() !== false; // إذا كانت null تكون مفعلة
    } catch (firebaseError) {
      console.error('خطأ في الحصول على حالة الحماية:', firebaseError);
      // في حالة الخطأ، نفترض أن الحماية مفعلة
    }
    
    return createSuccessResponse({ 
      authenticated: authenticated,
      isAdmin: isAdmin,
      passwordProtectionEnabled: isProtectionEnabled
    });
  } catch (error) {
    console.error('خطأ في التحقق من حالة المصادقة:', error);
    
    return createErrorResponse(500, 'خطأ في الخادم أثناء التحقق من حالة المصادقة');
  }
};

// تغليف المعالج الأساسي بمعالج CORS
const wrappedHandler = (event, context) => {
  // التعامل مع طلبات OPTIONS بشكل خاص
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }
  
  // معالجة الطلب مع دعم CORS
  return handleCors(event, () => handler(event, context));
};

exports.handler = wrappedHandler;