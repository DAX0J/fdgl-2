const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove, query, orderByChild, endAt } = require('firebase/database');
const { 
  isAuthenticated, 
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

/**
 * تنظيف سجلات الأمان القديمة
 */
const cleanupSecurityLogs = async () => {
  try {
    const now = Date.now();
    
    // حذف سجلات الوصول الأقدم من 30 يومًا
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const accessLogsRef = query(
      ref(database, 'accessLogs'),
      orderByChild('timestamp'),
      endAt(thirtyDaysAgo)
    );
    
    const accessSnapshot = await get(accessLogsRef);
    let accessCount = 0;
    
    if (accessSnapshot.exists()) {
      const batch = [];
      accessSnapshot.forEach((childSnapshot) => {
        batch.push(remove(ref(database, `accessLogs/${childSnapshot.key}`)));
        accessCount++;
      });
      
      await Promise.all(batch);
    }
    
    // حذف سجلات النشاط الأقدم من 90 يومًا (نحتفظ بها لفترة أطول)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
    const activityLogsRef = query(
      ref(database, 'activityLogs'),
      orderByChild('timestamp'),
      endAt(ninetyDaysAgo)
    );
    
    const activitySnapshot = await get(activityLogsRef);
    let activityCount = 0;
    
    if (activitySnapshot.exists()) {
      const batch = [];
      activitySnapshot.forEach((childSnapshot) => {
        batch.push(remove(ref(database, `activityLogs/${childSnapshot.key}`)));
        activityCount++;
      });
      
      await Promise.all(batch);
    }
    
    // تحديث حالة IP (إزالة الحظر المنتهي)
    const ipStatusRef = ref(database, 'ipStatus');
    const ipSnapshot = await get(ipStatusRef);
    let unbannedCount = 0;
    
    if (ipSnapshot.exists()) {
      const batch = [];
      ipSnapshot.forEach((childSnapshot) => {
        const ipStatus = childSnapshot.val();
        
        // إذا كان الحظر قد انتهى (تاريخ انتهاء سابق للوقت الحالي)
        if (ipStatus.banned && ipStatus.banExpiry && ipStatus.banExpiry < now) {
          batch.push(remove(ref(database, `ipStatus/${childSnapshot.key}`)));
          unbannedCount++;
        }
      });
      
      await Promise.all(batch);
    }
    
    return {
      success: true,
      message: 'تم تنظيف السجلات بنجاح',
      deletedRecords: {
        accessLogs: accessCount,
        activityLogs: activityCount,
        unbannedIPs: unbannedCount
      }
    };
  } catch (error) {
    console.error('خطأ في تنظيف السجلات:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء تنظيف السجلات',
      error: error.message
    };
  }
};

/**
 * وظيفة لتنظيف سجلات الأمان القديمة والمنتهية
 */
const handler = async (event, context) => {
  // يمكن استدعاؤها عبر الطلبات المجدولة (CRON) أو يدوياً
  const isCronRequest = event.headers['x-cron-token'] === process.env.CRON_SECRET_TOKEN;
  
  // إذا لم تكن مهمة مجدولة، نتحقق من المصادقة
  if (!isCronRequest) {
    // التأكد من أن الطلب هو POST للطلبات اليدوية
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'الطريقة غير مسموح بها' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // التحقق من المصادقة
    const authResult = isAuthenticated(event);
    if (!authResult.authenticated) {
      return unauthorizedResponse('غير مصرح به', event, 'security-cleanup');
    }
    
    // التحقق من صلاحيات المسؤول
    if (!authResult.user || !authResult.user.isAdmin) {
      return forbiddenResponse('يتطلب صلاحيات مسؤول', event, 'security-cleanup');
    }
  }
  
  try {
    const result = await cleanupSecurityLogs();
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في تنظيف السجلات:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تنظيف السجلات'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// استخدام وحدة CORS المخصصة
const { applyCors } = require('./utils/cors');

// تصدير المعالج مع CORS متقدم
exports.handler = applyCors(handler);