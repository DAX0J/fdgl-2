const { Handler } = require('@netlify/functions');
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

/**
 * تسجيل محاولة تسجيل الدخول في Firebase
 */
async function trackLoginAttempt(email, ip, userAgent, success) {
  try {
    const deviceInfo = parseUserAgent(userAgent);
    
    // إنشاء كائن محاولة تسجيل الدخول
    const loginAttempt = {
      ip: ip,
      email: email,
      timestamp: Date.now(),
      userAgent: userAgent,
      success: success,
      deviceInfo: deviceInfo
    };
    
    // تسجيل محاولة تسجيل الدخول في Firebase
    const attemptRef = ref(database, `loginAttempts/${Date.now()}`);
    await set(attemptRef, loginAttempt);
    
    // تحديث حالة IP إذا كانت محاولة فاشلة
    if (!success) {
      await updateIPStatus(ip);
    }
  } catch (error) {
    console.error('خطأ في تسجيل محاولة تسجيل الدخول:', error);
  }
}

/**
 * تحديث حالة IP بعد محاولة فاشلة
 */
async function updateIPStatus(ip) {
  try {
    // الحصول على حالة IP الحالية
    const ipStatusRef = ref(database, `ipStatus/${ip.replace(/\./g, '_')}`);
    const ipStatusSnapshot = await get(ipStatusRef);
    const ipStatus = ipStatusSnapshot.val() || {
      ip: ip,
      failedAttempts: 0,
      lastAttemptTime: 0,
      cooldownUntil: null,
      banned: false
    };
    
    // تحديث عدد المحاولات الفاشلة
    ipStatus.failedAttempts += 1;
    ipStatus.lastAttemptTime = Date.now();
    
    // التحقق إذا كان يجب وضع IP في فترة تهدئة
    if (ipStatus.failedAttempts >= 5 && !ipStatus.cooldownUntil) {
      // وضع IP في فترة تهدئة لمدة 10 دقائق
      ipStatus.cooldownUntil = Date.now() + 10 * 60 * 1000;
    }
    
    // التحقق إذا كان يجب حظر IP
    if (ipStatus.failedAttempts >= 20 && !ipStatus.banned) {
      ipStatus.banned = true;
    }
    
    // حفظ حالة IP المحدثة
    await set(ipStatusRef, ipStatus);
  } catch (error) {
    console.error('خطأ في تحديث حالة IP:', error);
  }
}

/**
 * التحقق من حالة IP
 */
async function checkIPStatus(ip) {
  try {
    const ipStatusRef = ref(database, `ipStatus/${ip.replace(/\./g, '_')}`);
    const ipStatusSnapshot = await get(ipStatusRef);
    const ipStatus = ipStatusSnapshot.val();
    
    if (!ipStatus) {
      return { banned: false, cooldown: null };
    }
    
    return {
      banned: ipStatus.banned === true,
      cooldown: ipStatus.cooldownUntil && ipStatus.cooldownUntil > Date.now() ? 
        ipStatus.cooldownUntil : null
    };
  } catch (error) {
    console.error('خطأ في التحقق من حالة IP:', error);
    return { banned: false, cooldown: null };
  }
}

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
    const ip = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown-ip';
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

exports.handler = Handler(handler, {
  cors: {
    origin: '*',  // يجب تغييره للإنتاج للسماح فقط بالمجالات المصرح بها
    headers: ['Content-Type', 'Authorization'],
    credentials: true
  }
});