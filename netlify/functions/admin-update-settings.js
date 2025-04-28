const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, update } = require('firebase/database');
const { 
  isAuthenticated, 
  unauthorizedResponse, 
  forbiddenResponse 
} = require('./utils/auth');
const { logUnauthorizedAccess } = require('./utils/securityLogs');

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

/**
 * وظيفة للتحقق من صحة إعدادات العد التنازلي
 */
function validateCountdownSettings(settings) {
  if (!settings) return false;
  
  // التحقق من وجود حقول إلزامية
  if (settings.enabled === undefined) return false;
  
  // إذا كان العد التنازلي مفعل، التحقق من وجود تاريخ مستهدف وعنوان
  if (settings.enabled) {
    if (!settings.targetDate || !settings.title) return false;
    
    // التحقق من صحة التاريخ
    const date = new Date(settings.targetDate);
    if (isNaN(date.getTime())) return false;
  }
  
  return true;
}

/**
 * وظيفة للتحقق من صحة إعدادات الشحن
 */
function validateShippingSettings(settings) {
  if (!settings) return false;
  
  // التحقق من عتبة الشحن المجاني (اختياري)
  if (settings.freeShippingThreshold !== undefined) {
    if (typeof settings.freeShippingThreshold !== 'number' || settings.freeShippingThreshold < 0) {
      return false;
    }
  }
  
  // التحقق من الحد الأدنى والأقصى للسعر (اختياري)
  if (settings.minPrice !== undefined) {
    if (typeof settings.minPrice !== 'number' || settings.minPrice < 0) {
      return false;
    }
  }
  
  if (settings.maxPrice !== undefined) {
    if (typeof settings.maxPrice !== 'number' || settings.maxPrice < 0) {
      return false;
    }
  }
  
  // التحقق من الولايات (إذا تم توفيرها)
  if (settings.provinces !== undefined) {
    if (!Array.isArray(settings.provinces)) return false;
    
    // التحقق من كل ولاية
    for (const province of settings.provinces) {
      if (!province.name || 
          typeof province.homeDeliveryPrice !== 'number' || 
          typeof province.officeDeliveryPrice !== 'number') {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * وظيفة للتحقق من صحة إعدادات وسائل التواصل الاجتماعي
 */
function validateSocialMediaSettings(settings) {
  if (!settings) return false;
  
  // التحقق من الحقل الإلزامي
  if (settings.enabled === undefined) return false;
  
  // التحقق من صحة الروابط (إذا كانت موجودة)
  const socialPlatforms = ['instagram', 'twitter', 'facebook', 'youtube', 'tiktok'];
  
  for (const platform of socialPlatforms) {
    if (settings[platform] !== undefined && typeof settings[platform] !== 'string') {
      return false;
    }
  }
  
  return true;
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
    // التحقق من المصادقة
    const authResult = isAuthenticated(event);
    if (!authResult.authenticated) {
      // تسجيل محاولة وصول غير مصرح بها
      return unauthorizedResponse('غير مصرح به', event, 'admin-settings-update');
    }
    
    // التحقق من صلاحيات المسؤول
    if (!authResult.user || !authResult.user.isAdmin) {
      return forbiddenResponse('يتطلب صلاحيات مسؤول', event, 'admin-settings-update');
    }
    
    // تحليل البيانات
    const requestBody = JSON.parse(event.body);
    const { section, settings } = requestBody;
    
    if (!section || !settings) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'البيانات غير مكتملة' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // التحقق من صحة الإعدادات حسب القسم
    let isValid = false;
    
    switch (section) {
      case 'countdownSettings':
        isValid = validateCountdownSettings(settings);
        break;
      case 'shippingSettings':
        isValid = validateShippingSettings(settings);
        break;
      case 'socialMedia':
        isValid = validateSocialMediaSettings(settings);
        break;
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, message: 'قسم غير معروف' }),
          headers: { 'Content-Type': 'application/json' }
        };
    }
    
    if (!isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'بيانات غير صالحة' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // تحديث البيانات في Firebase
    const updateRef = ref(database, `siteSettings/${section}`);
    await update(updateRef, settings);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'تم تحديث الإعدادات بنجاح' 
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في تحديث الإعدادات:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تحديث الإعدادات' 
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

exports.handler = Handler(handler, {
  cors: {
    origin: '*', // يجب تغييره للإنتاج للسماح فقط بالمجالات المصرح بها
    headers: ['Content-Type', 'Authorization'],
    credentials: true
  }
});