const { Handler } = require('@netlify/functions');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, update, set, query, orderByChild, limitToLast } = require('firebase/database');
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
 * تحليل سجلات الوصول للكشف عن أنماط مشبوهة
 */
const analyzeAccessLogs = async () => {
  try {
    // الحصول على السجلات الأخيرة (آخر 100 سجل)
    const accessLogsRef = query(
      ref(database, 'accessLogs'),
      orderByChild('timestamp'),
      limitToLast(100)
    );
    
    const snapshot = await get(accessLogsRef);
    
    if (!snapshot.exists()) {
      return {
        success: true,
        message: 'لا توجد سجلات للتحليل',
        threats: []
      };
    }
    
    const logs = [];
    snapshot.forEach((childSnapshot) => {
      logs.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    
    // تحليل IP وإحصاء المحاولات الفاشلة
    const ipAttempts = {};
    
    logs.forEach(log => {
      const ip = log.ip;
      if (!ipAttempts[ip]) {
        ipAttempts[ip] = {
          count: 0,
          resources: new Set(),
          timestamps: []
        };
      }
      
      ipAttempts[ip].count++;
      if (log.resource) ipAttempts[ip].resources.add(log.resource);
      ipAttempts[ip].timestamps.push(log.timestamp);
    });
    
    // الكشف عن المحاولات المتكررة من نفس IP
    const threats = [];
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    for (const [ip, data] of Object.entries(ipAttempts)) {
      // تجاهل 'unknown-ip'
      if (ip === 'unknown-ip') continue;
      
      // المحاولات المتكررة من نفس IP خلال ساعة
      const recentAttempts = data.timestamps.filter(timestamp => (now - timestamp) < ONE_HOUR);
      
      if (recentAttempts.length >= 10) {
        threats.push({
          ip,
          type: 'brute_force',
          confidence: 'high',
          reason: `${recentAttempts.length} محاولة وصول فاشلة خلال الساعة الماضية`,
          resources: Array.from(data.resources),
          recommendedAction: 'block_ip'
        });
      } else if (recentAttempts.length >= 5) {
        threats.push({
          ip,
          type: 'brute_force',
          confidence: 'medium',
          reason: `${recentAttempts.length} محاولة وصول فاشلة خلال الساعة الماضية`,
          resources: Array.from(data.resources),
          recommendedAction: 'monitor'
        });
      }
    }
    
    // تحليل أنماط الوصول من أجهزة غير معتادة
    const emailDevices = {};
    
    // تحليل محاولات تسجيل الدخول
    const loginAttemptsRef = query(
      ref(database, 'loginAttempts'),
      orderByChild('timestamp'),
      limitToLast(50)
    );
    
    const loginSnapshot = await get(loginAttemptsRef);
    
    if (loginSnapshot.exists()) {
      loginSnapshot.forEach((childSnapshot) => {
        const attempt = childSnapshot.val();
        
        if (!attempt.email) return;
        
        if (!emailDevices[attempt.email]) {
          emailDevices[attempt.email] = new Set();
        }
        
        const deviceId = `${attempt.deviceInfo.browser}_${attempt.deviceInfo.os}_${attempt.deviceInfo.device}`;
        emailDevices[attempt.email].add(deviceId);
      });
      
      // الكشف عن تسجيلات دخول من أجهزة متعددة
      for (const [email, devices] of Object.entries(emailDevices)) {
        if (devices.size >= 3) {
          threats.push({
            email,
            type: 'unusual_login',
            confidence: 'medium',
            reason: `تسجيل دخول من ${devices.size} أجهزة مختلفة`,
            recommendedAction: 'monitor'
          });
        }
      }
    }
    
    // اتخاذ إجراءات للتهديدات ذات الثقة العالية
    const highThreats = threats.filter(threat => threat.confidence === 'high' && threat.recommendedAction === 'block_ip');
    
    if (highThreats.length > 0) {
      for (const threat of highThreats) {
        // تحديث حالة IP في قاعدة البيانات
        const ipStatusRef = ref(database, `ipStatus/${threat.ip.replace(/\./g, '_')}`);
        await set(ipStatusRef, {
          ip: threat.ip,
          banned: true,
          reason: threat.reason,
          timestamp: now,
          banExpiry: now + (24 * 60 * 60 * 1000) // حظر لمدة 24 ساعة
        });
      }
    }
    
    return {
      success: true,
      message: 'تم تحليل السجلات بنجاح',
      totalLogs: logs.length,
      threatCount: threats.length,
      actionsTaken: highThreats.length,
      threats
    };
  } catch (error) {
    console.error('خطأ في تحليل السجلات:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء تحليل السجلات',
      error: error.message
    };
  }
};

/**
 * وظيفة لتحليل السجلات واكتشاف التهديدات المحتملة
 */
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
    // التحقق من المصادقة
    const authResult = isAuthenticated(event);
    if (!authResult.authenticated) {
      return unauthorizedResponse('غير مصرح به', event, 'security-analyze');
    }
    
    // التحقق من صلاحيات المسؤول
    if (!authResult.user || !authResult.user.isAdmin) {
      return forbiddenResponse('يتطلب صلاحيات مسؤول', event, 'security-analyze');
    }
    
    // تحليل السجلات
    const analysisResult = await analyzeAccessLogs();
    
    return {
      statusCode: 200,
      body: JSON.stringify(analysisResult),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في تحليل الأمان:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء تحليل الأمان'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// استخدام وحدة CORS المخصصة
const { applyCors } = require('./utils/cors');

// تصدير المعالج مع CORS متقدم
exports.handler = applyCors(handler);