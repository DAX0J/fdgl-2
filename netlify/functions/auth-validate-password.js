const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get } = require('firebase/database');
const { 
  checkLoginAttempts, 
  recordFailedLoginAttempt, 
  resetLoginAttempts,
  generateToken,
  createResponseWithCookie
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
    // الحصول على معلومات العميل
    const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown-ip';
    const userAgent = event.headers['user-agent'] || 'unknown-ua';

    // التحقق من محاولات تسجيل الدخول
    const loginCheck = checkLoginAttempts(ip);
    if (!loginCheck.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: loginCheck.reason }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // إضافة تأخير إذا كان هناك محاولات فاشلة سابقة
    if (loginCheck.delay) {
      await new Promise(resolve => setTimeout(resolve, loginCheck.delay));
    }

    // تحليل معلومات الطلب
    const requestBody = JSON.parse(event.body);
    const { password } = requestBody;

    if (!password) {
      // تسجيل محاولة فاشلة بسبب عدم وجود كلمة مرور
      recordFailedLoginAttempt(ip, userAgent);
      
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'كلمة المرور مطلوبة' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // الحصول على كلمة المرور من Firebase
    const passwordSnapshot = await get(ref(database, 'siteSettings/passwordProtection/password'));
    const correctPassword = passwordSnapshot.val();

    // التحقق إذا كان الحماية بكلمة المرور مفعلة
    const protectionSnapshot = await get(ref(database, 'siteSettings/passwordProtection/enabled'));
    const isProtectionEnabled = protectionSnapshot.val();

    if (!isProtectionEnabled) {
      // إذا كانت حماية كلمة المرور معطلة، قم بإنشاء رمز دخول مباشرة
      const token = generateToken({ authorized: true, timestamp: Date.now() });
      
      return createResponseWithCookie(200, { 
        success: true, 
        message: 'تم تجاوز التحقق من كلمة المرور (الحماية معطلة)',
        token 
      }, 'authToken', token);
    }

    // التحقق من صحة كلمة المرور
    if (password === correctPassword) {
      // إعادة تعيين محاولات تسجيل الدخول الفاشلة
      resetLoginAttempts(ip);
      
      // إنشاء رمز JWT
      const token = generateToken({ authorized: true, timestamp: Date.now() });
      
      // إرجاع استجابة ناجحة مع كوكي آمنة
      return createResponseWithCookie(200, { 
        success: true, 
        message: 'تم التحقق من كلمة المرور بنجاح',
        token 
      }, 'authToken', token);
    } else {
      // تسجيل محاولة فاشلة
      recordFailedLoginAttempt(ip, userAgent);
      
      // إرجاع استجابة فشل
      return {
        statusCode: 401,
        body: JSON.stringify({ 
          success: false, 
          message: 'كلمة المرور غير صحيحة' 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  } catch (error) {
    console.error('خطأ في التحقق من كلمة المرور:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء التحقق'
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