const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, serverTimestamp } = require('firebase/database');
const { 
  isAuthenticated,
  unauthorizedResponse,
  forbiddenResponse
} = require('./utils/auth');
const { parseUserAgent } = require('./utils/securityLogs');

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
 * تسجيل نشاط مستخدم
 * هذه الوظيفة تستخدم فقط للأنشطة المهمة مثل:
 * - تغيير كلمة مرور الموقع
 * - تغيير إعدادات المتجر
 * - عمليات الدفع
 * - وغيرها من الإجراءات الحساسة
 */
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
    // التحقق من وجود توقيع API صالح (للاستخدام من الخادم)
    const serverToken = event.headers['x-server-token'] || '';
    const isServerRequest = serverToken === process.env.SERVER_API_TOKEN;
    
    // إذا لم يكن طلبًا من الخادم، التحقق من المصادقة
    if (!isServerRequest) {
      const authResult = isAuthenticated(event);
      if (!authResult.authenticated) {
        return unauthorizedResponse('غير مصرح به', event, 'security-log-activity');
      }
      
      // التحقق من صلاحيات المسؤول
      if (!authResult.user || !authResult.user.isAdmin) {
        return forbiddenResponse('يتطلب صلاحيات مسؤول', event, 'security-log-activity');
      }
    }
    
    // تحليل البيانات
    const requestBody = JSON.parse(event.body);
    const { 
      action, 
      userId, 
      details, 
      severity = 'info',
      resourceType,
      resourceId
    } = requestBody;
    
    if (!action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'الإجراء مطلوب' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }
    
    // الحصول على معلومات العميل
    const ip = event.headers['client-ip'] || 
               event.headers['x-forwarded-for'] || 
               event.headers['x-real-ip'] || 
               'unknown';
    
    const userAgent = event.headers['user-agent'] || 'unknown';
    const deviceInfo = parseUserAgent(userAgent);
    
    // إنشاء بيانات السجل
    const logData = {
      action,
      userId: userId || 'anonymous',
      timestamp: Date.now(),
      dateTime: new Date().toISOString(),
      ip,
      userAgent,
      deviceInfo,
      details: details || {},
      severity,
      resourceType: resourceType || 'unknown',
      resourceId: resourceId || 'unknown',
      source: isServerRequest ? 'server' : 'client',
      requestPath: event.path,
      requestMethod: event.httpMethod
    };
    
    // دفع بيانات السجل إلى Firebase
    const activityLogsRef = ref(database, 'activityLogs');
    await push(activityLogsRef, logData);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'تم تسجيل النشاط بنجاح',
        logId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في تسجيل النشاط:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تسجيل النشاط'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// استخدام وحدة CORS المخصصة
const { applyCors } = require('./utils/cors');

// تصدير المعالج مع CORS متقدم
exports.handler = applyCors(handler);