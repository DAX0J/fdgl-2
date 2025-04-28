// ملف للتعامل مع سجلات الأمان وتتبع محاولات المصادقة
const { getFirebaseAdminDatabase } = require('../firebase-admin');

/**
 * تنظيف مسار عنوان IP لاستخدامه في Firebase
 * يستبدل كل النقاط بالشرطات السفلية لتلبية متطلبات مسارات Firebase
 * @param {string} ip عنوان IP الأصلي
 * @returns {string} عنوان IP المُنظّف للاستخدام كمفتاح في Firebase
 */
function sanitizeIPForFirebase(ip) {
  return ip.replace(/\./g, '_');
}

/**
 * تسجيل محاولة تسجيل الدخول
 * @param {string} email البريد الإلكتروني المستخدم في محاولة تسجيل الدخول
 * @param {string} ip عنوان IP الخاص بالمستخدم
 * @param {string} userAgent معلومات متصفح المستخدم
 * @param {boolean} success ما إذا كانت محاولة تسجيل الدخول ناجحة
 * @param {object} deviceInfo معلومات جهاز المستخدم
 * @returns {Promise<boolean>} نجاح أو فشل تسجيل المحاولة
 */
async function trackLoginAttempt(email, ip, userAgent, success, deviceInfo = {}) {
  try {
    const db = getFirebaseAdminDatabase();
    const loginAttemptsRef = db.ref('security/loginAttempts');
    
    // إنشاء معرف فريد للسجل
    const timestamp = Date.now();
    const id = `${timestamp}_${sanitizeIPForFirebase(ip)}_${success ? 'success' : 'fail'}`;
    
    // تسجيل محاولة تسجيل الدخول
    await loginAttemptsRef.child(id).set({
      id,
      email,
      ip,
      timestamp,
      userAgent,
      success,
      deviceInfo: deviceInfo || {
        browser: 'Unknown',
        os: 'Unknown',
        device: 'Unknown'
      }
    });
    
    // إذا فشلت محاولة تسجيل الدخول، قم بتحديث حالة IP
    if (!success) {
      await updateIPStatus(ip);
    }
    
    return true;
  } catch (error) {
    console.error('Error logging login attempt:', error);
    return false;
  }
}

/**
 * تحديث حالة IP بعد محاولة فاشلة
 * @param {string} ip عنوان IP للتحديث
 * @returns {Promise<object|null>} حالة IP المحدثة أو فارغ في حالة الخطأ
 */
async function updateIPStatus(ip) {
  try {
    const db = getFirebaseAdminDatabase();
    const safeIP = sanitizeIPForFirebase(ip);
    const ipStatusRef = db.ref(`security/ipStatus/${safeIP}`);
    
    // الحصول على حالة IP الحالية
    const snapshot = await ipStatusRef.once('value');
    const currentStatus = snapshot.val() || { failedAttempts: 0, lastAttemptTime: 0 };
    
    const now = Date.now();
    const cooldownTime = 15 * 60 * 1000; // 15 دقيقة
    const banThreshold = 5; // عدد المحاولات الفاشلة قبل الحظر
    
    // إعادة تعيين العداد إذا كان آخر محاولة منذ أكثر من ساعة
    if (now - currentStatus.lastAttemptTime > 60 * 60 * 1000) {
      currentStatus.failedAttempts = 1;
    } else {
      currentStatus.failedAttempts += 1;
    }
    
    // تحديث حالة IP
    const updatedStatus = {
      ip,
      failedAttempts: currentStatus.failedAttempts,
      lastAttemptTime: now,
      cooldownUntil: currentStatus.failedAttempts >= 3 ? now + cooldownTime : null,
      banned: currentStatus.failedAttempts >= banThreshold
    };
    
    await ipStatusRef.set(updatedStatus);
    
    return updatedStatus;
  } catch (error) {
    console.error('Error updating IP status:', error);
    return null;
  }
}

/**
 * التحقق من حالة IP
 * @param {string} ip عنوان IP للتحقق منه
 * @returns {Promise<object>} حالة IP
 */
async function checkIPStatus(ip) {
  try {
    const db = getFirebaseAdminDatabase();
    const safeIP = sanitizeIPForFirebase(ip);
    const ipStatusRef = db.ref(`security/ipStatus/${safeIP}`);
    
    const snapshot = await ipStatusRef.once('value');
    const status = snapshot.val();
    
    if (!status) {
      return { banned: false, cooldown: null };
    }
    
    const now = Date.now();
    
    return {
      banned: status.banned === true,
      cooldown: status.cooldownUntil && status.cooldownUntil > now ? status.cooldownUntil : null
    };
  } catch (error) {
    console.error('Error checking IP status:', error);
    return { banned: false, cooldown: null };
  }
}

/**
 * تسجيل نشاط أمني
 * @param {string} userId معرف المستخدم (إذا كان متاحًا)
 * @param {string} actionType نوع النشاط
 * @param {string} description وصف النشاط
 * @param {object} additionalInfo معلومات إضافية
 * @returns {Promise<boolean>} نجاح أو فشل تسجيل النشاط
 */
async function logSecurityActivity(userId, actionType, description, additionalInfo = {}) {
  try {
    const db = getFirebaseAdminDatabase();
    const securityLogsRef = db.ref('security/activityLogs');
    
    const timestamp = Date.now();
    const id = `${timestamp}_${userId || 'anonymous'}_${actionType}`;
    
    await securityLogsRef.child(id).set({
      id,
      userId: userId || 'anonymous',
      actionType,
      description,
      timestamp,
      additionalInfo
    });
    
    return true;
  } catch (error) {
    console.error('Error logging security activity:', error);
    return false;
  }
}

/**
 * تنظيف سجلات قديمة
 * @param {number} olderThan عمر السجلات بالمللي ثانية
 * @returns {Promise<boolean>} نجاح أو فشل عملية التنظيف
 */
async function cleanOldLogs(olderThan = 30 * 24 * 60 * 60 * 1000) { // 30 يوم افتراضيًا
  try {
    const db = getFirebaseAdminDatabase();
    const loginAttemptsRef = db.ref('security/loginAttempts');
    const activityLogsRef = db.ref('security/activityLogs');
    
    const now = Date.now();
    const cutoffTime = now - olderThan;
    
    // تنظيف سجلات تسجيل الدخول القديمة
    const loginAttempts = await loginAttemptsRef.orderByChild('timestamp').endAt(cutoffTime).once('value');
    const loginPromises = [];
    
    loginAttempts.forEach((child) => {
      loginPromises.push(loginAttemptsRef.child(child.key).remove());
    });
    
    // تنظيف سجلات النشاط القديمة
    const activityLogs = await activityLogsRef.orderByChild('timestamp').endAt(cutoffTime).once('value');
    const activityPromises = [];
    
    activityLogs.forEach((child) => {
      activityPromises.push(activityLogsRef.child(child.key).remove());
    });
    
    // تنفيذ جميع عمليات الحذف
    await Promise.all([...loginPromises, ...activityPromises]);
    
    // إلغاء حظر عناوين IP التي لم تحاول تسجيل الدخول لمدة أسبوع
    const ipStatusRef = db.ref('security/ipStatus');
    const oldIPs = await ipStatusRef
      .orderByChild('lastAttemptTime')
      .endAt(now - (7 * 24 * 60 * 60 * 1000)) // أسبوع
      .once('value');
    
    const ipPromises = [];
    
    oldIPs.forEach((child) => {
      const status = child.val();
      if (status.banned) {
        ipPromises.push(
          ipStatusRef.child(child.key).update({
            banned: false,
            cooldownUntil: null,
            failedAttempts: 0
          })
        );
      }
    });
    
    await Promise.all(ipPromises);
    
    return true;
  } catch (error) {
    console.error('Error cleaning old logs:', error);
    return false;
  }
}

module.exports = {
  trackLoginAttempt,
  updateIPStatus,
  checkIPStatus,
  logSecurityActivity,
  cleanOldLogs,
  sanitizeIPForFirebase
};