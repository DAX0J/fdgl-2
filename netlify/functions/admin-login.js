const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, get, set } = require('firebase/database');
const { 
  checkLoginAttempts, 
  recordFailedLoginAttempt, 
  resetLoginAttempts,
  generateToken,
  createResponseWithCookie
} = require('./utils/auth');
const { sanitizeIPForFirebase, getIPFromRequest } = require('./utils/util');
const { trackLoginAttempt, updateIPStatus, checkIPStatus } = require('./utils/securityLogs');

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
const auth = getAuth(app);

/**
 * استخراج معلومات المتصفح والجهاز من User-Agent
 */
function parseUserAgent(userAgent) {
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Unknown';

  if (!userAgent) return { browser, os, device };

  // تحليل المتصفح
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) browser = 'Internet Explorer';

  // تحليل نظام التشغيل
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'MacOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // تحليل الجهاز
  if (userAgent.includes('Mobile')) device = 'Mobile';
  else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) device = 'Tablet';
  else device = 'Desktop';

  return { browser, os, device };
}

// تمت إزالة تعريفات الوظائف المكررة trackLoginAttempt و updateIPStatus و checkIPStatus
// والاعتماد بدلاً من ذلك على الوظائف المستوردة من ملف utils/securityLogs.js

/**
 * التحقق من صلاحية البريد الإلكتروني للمسؤول
 */
async function isAuthorizedAdmin(email) {
  if (!email) return false;
  
  try {
    const adminEmailsRef = ref(database, 'authorizedAdminEmails');
    const snapshot = await get(adminEmailsRef);
    const authorizedEmails = snapshot.val() || {};
    
    return Object.keys(authorizedEmails).includes(email);
  } catch (error) {
    console.error('خطأ في التحقق من صلاحية البريد الإلكتروني للمسؤول:', error);
    return false;
  }
}

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
    const ip = getIPFromRequest(event);
    const userAgent = event.headers['user-agent'] || 'unknown-ua';

    // التحقق من حالة IP
    const ipStatus = await checkIPStatus(ip);
    if (ipStatus.banned) {
      return {
        statusCode: 403,
        body: JSON.stringify({ 
          success: false, 
          message: 'تم حظر هذا العنوان IP بسبب العديد من محاولات تسجيل الدخول الفاشلة.' 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    if (ipStatus.cooldown) {
      const remainingTime = Math.ceil((ipStatus.cooldown - Date.now()) / (1000 * 60));
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          success: false, 
          message: `العديد من محاولات تسجيل الدخول الفاشلة. يرجى المحاولة مرة أخرى بعد ${remainingTime} دقيقة.` 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // التحقق من محاولات تسجيل الدخول المحلية
    const loginCheck = checkLoginAttempts(ip);
    if (!loginCheck.allowed) {
      return {
        statusCode: 429,
        body: JSON.stringify({ 
          success: false, 
          message: loginCheck.reason 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // إضافة تأخير إذا كان هناك محاولات فاشلة سابقة
    if (loginCheck.delay) {
      await new Promise(resolve => setTimeout(resolve, loginCheck.delay));
    }

    // تحليل معلومات الطلب
    const requestBody = JSON.parse(event.body);
    const { email, password } = requestBody;

    if (!email || !password) {
      // تسجيل محاولة فاشلة
      recordFailedLoginAttempt(ip, userAgent);
      await trackLoginAttempt(email || 'unknown-email', ip, userAgent, false);
      
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          message: 'البريد الإلكتروني وكلمة المرور مطلوبين' 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // التحقق من صلاحية البريد الإلكتروني للمسؤول
    const isAdmin = await isAuthorizedAdmin(email);
    if (!isAdmin) {
      // تسجيل محاولة فاشلة - بريد إلكتروني غير مصرح به
      recordFailedLoginAttempt(ip, userAgent);
      await trackLoginAttempt(email, ip, userAgent, false);
      
      return {
        statusCode: 403,
        body: JSON.stringify({ 
          success: false, 
          message: 'غير مصرح لهذا البريد الإلكتروني بالوصول كمسؤول' 
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    try {
      // محاولة تسجيل الدخول باستخدام Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // تسجيل محاولة ناجحة
      resetLoginAttempts(ip);
      await trackLoginAttempt(email, ip, userAgent, true);
      
      // إنشاء رمز JWT
      const token = generateToken({ 
        authorized: true, 
        admin: true,
        email: email,
        uid: user.uid, 
        timestamp: Date.now() 
      });
      
      // إرجاع استجابة ناجحة مع كوكي آمنة
      return createResponseWithCookie(200, { 
        success: true, 
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: {
          email: user.email,
          uid: user.uid
        } 
      }, 'adminAuthToken', token);
    } catch (error) {
      // تسجيل محاولة فاشلة - خطأ في المصادقة
      recordFailedLoginAttempt(ip, userAgent);
      await trackLoginAttempt(email, ip, userAgent, false);
      
      let errorMessage = 'خطأ في تسجيل الدخول';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'تم تعطيل الوصول بسبب العديد من محاولات تسجيل الدخول الفاشلة. يرجى المحاولة مرة أخرى لاحقًا.';
      }
      
      return {
        statusCode: 401,
        body: JSON.stringify({ 
          success: false, 
          message: errorMessage
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
  } catch (error) {
    console.error('خطأ في تسجيل دخول المسؤول:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء محاولة تسجيل الدخول'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// استخدام وظيفة handleCors المحسنة من utils/cors
const { handleCors } = require('./utils/cors');

exports.handler = async (event, context) => {
  // معالجة CORS للطلبات المسبقة (OPTIONS)
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }
  
  // معالجة الطلب الأساسي مع دعم CORS
  const result = await handler(event, context);
  return handleCors(event, () => result);
};