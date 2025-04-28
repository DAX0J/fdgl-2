// ملف مساعد للتعامل مع سجلات الأمان
const { getFirebaseAdminDatabase } = require('../firebase-admin');
const { sanitizeIPForFirebase } = require('./util');

/**
 * تسجيل محاولة تسجيل دخول
 * @param {string} email البريد الإلكتروني المستخدم في المحاولة
 * @param {string} ip عنوان IP
 * @param {string} userAgent متصفح المستخدم
 * @param {boolean} success هل نجحت المحاولة
 * @returns {Promise<void>}
 */
async function trackLoginAttempt(email, ip, userAgent, success) {
  try {
    const db = getFirebaseAdminDatabase();
    const safeIP = sanitizeIPForFirebase(ip);
    const now = Date.now();
    
    // تخزين محاولة تسجيل الدخول في سجل المحاولات
    const loginRef = db.ref(`security/loginAttempts/${safeIP}`).push();
    
    await loginRef.set({
      email: email || 'unknown',
      timestamp: now,
      userAgent: userAgent || 'unknown',
      success: success || false
    });
    
    // إذا فشلت المحاولة، قم بتحديث عداد المحاولات الفاشلة
    if (!success) {
      const ipStatsRef = db.ref(`security/ipStats/${safeIP}`);
      const snapshot = await ipStatsRef.once('value');
      const stats = snapshot.val() || { failedAttempts: 0, lastFailedAttempt: 0 };
      
      // زيادة عدد المحاولات الفاشلة
      stats.failedAttempts = (stats.failedAttempts || 0) + 1;
      stats.lastFailedAttempt = now;
      
      // تحديث الإحصائيات
      await ipStatsRef.set(stats);
      
      // إذا وصلت المحاولات الفاشلة إلى حد معين، فرض تأخير أو حظر
      if (stats.failedAttempts >= 10) {
        await updateIPStatus(safeIP, { banned: true, reason: 'Too many failed login attempts', bannedAt: now });
      } else if (stats.failedAttempts >= 5) {
        const cooldownUntil = now + (30 * 60 * 1000); // 30 دقيقة
        await updateIPStatus(safeIP, { cooldownUntil });
      }
    } else {
      // في حالة النجاح، إعادة تعيين عداد المحاولات الفاشلة
      const ipStatsRef = db.ref(`security/ipStats/${safeIP}`);
      await ipStatsRef.update({
        failedAttempts: 0,
        lastSuccessfulLogin: now
      });
      
      // إزالة أي حظر أو تأخير
      await updateIPStatus(safeIP, { banned: false, cooldownUntil: null });
    }
  } catch (error) {
    console.error('Error tracking login attempt:', error);
  }
}

/**
 * تسجيل نشاط أمني
 * @param {string} userId معرف المستخدم (إذا كان متاحًا)
 * @param {string} actionType نوع النشاط
 * @param {string} ip عنوان IP
 * @param {string} userAgent متصفح المستخدم
 * @param {object} additionalInfo معلومات إضافية
 * @returns {Promise<void>}
 */
async function logSecurityActivity(userId, actionType, ip, userAgent, additionalInfo = {}) {
  try {
    const db = getFirebaseAdminDatabase();
    const safeIP = sanitizeIPForFirebase(ip);
    const now = Date.now();
    
    // إنشاء سجل النشاط
    const activityLog = {
      userId: userId || 'anonymous',
      actionType,
      ip: safeIP,
      userAgent: userAgent || 'unknown',
      timestamp: now,
      details: additionalInfo
    };
    
    // تخزين السجل في قاعدة البيانات
    const activityRef = db.ref(`security/activityLogs`).push();
    await activityRef.set(activityLog);
    
    return true;
  } catch (error) {
    console.error('Error logging security activity:', error);
    return false;
  }
}

/**
 * تحديث حالة عنوان IP
 * @param {string} ip عنوان IP (يجب أن يكون قد مر بمعالجة sanitizeIPForFirebase)
 * @param {object} status حالة IP الجديدة 
 * @returns {Promise<void>}
 */
async function updateIPStatus(ip, status) {
  try {
    const db = getFirebaseAdminDatabase();
    const ipStatusRef = db.ref(`security/ipStatus/${ip}`);
    
    // التحقق من الحالة الحالية
    const snapshot = await ipStatusRef.once('value');
    const currentStatus = snapshot.val() || {};
    
    // دمج الحالة الحالية مع الحالة الجديدة
    const newStatus = {
      ...currentStatus,
      ...status,
      lastUpdated: Date.now()
    };
    
    // تحديث الحالة
    await ipStatusRef.set(newStatus);
    
    return true;
  } catch (error) {
    console.error('Error updating IP status:', error);
    return false;
  }
}

/**
 * التحقق من حالة عنوان IP
 * @param {string} ip عنوان IP
 * @returns {Promise<{banned: boolean, cooldown: number|null}>} حالة الحظر والتأخير
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
 * تنظيف سجلات الأمان القديمة
 * @returns {Promise<{loginAttempts: number, activityLogs: number, ipBans: number}>} عدد السجلات التي تم حذفها
 */
async function cleanupOldLogs() {
  try {
    const db = getFirebaseAdminDatabase();
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000); // شهر واحد
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000); // أسبوع واحد
    
    // تنظيف سجلات تسجيل الدخول القديمة
    const loginAttemptsRef = db.ref('security/loginAttempts');
    const loginAttemptSnapshot = await loginAttemptsRef.once('value');
    let loginAttemptsDeleted = 0;
    
    // حذف محاولات تسجيل الدخول القديمة
    const loginPromises = [];
    loginAttemptSnapshot.forEach(ipSnapshot => {
      const ipRef = loginAttemptsRef.child(ipSnapshot.key);
      
      ipSnapshot.forEach(attemptSnapshot => {
        const attempt = attemptSnapshot.val();
        
        if (attempt && attempt.timestamp && attempt.timestamp < oneMonthAgo) {
          loginPromises.push(
            ipRef.child(attemptSnapshot.key).remove()
            .then(() => { loginAttemptsDeleted++; })
          );
        }
      });
    });
    
    // تنظيف سجلات النشاط القديمة
    const activityLogsRef = db.ref('security/activityLogs');
    const activitySnapshot = await activityLogsRef.once('value');
    let activityLogsDeleted = 0;
    
    // حذف سجلات النشاط القديمة
    const activityPromises = [];
    activitySnapshot.forEach(logSnapshot => {
      const log = logSnapshot.val();
      
      if (log && log.timestamp && log.timestamp < oneMonthAgo) {
        activityPromises.push(
          activityLogsRef.child(logSnapshot.key).remove()
          .then(() => { activityLogsDeleted++; })
        );
      }
    });
    
    // إلغاء حظر عناوين IP التي لم تحاول تسجيل دخول لمدة أسبوع
    const ipStatusRef = db.ref('security/ipStatus');
    const ipStatusSnapshot = await ipStatusRef.once('value');
    let ipBansRemoved = 0;
    
    // حذف الحظر عن عناوين IP
    const ipPromises = [];
    ipStatusSnapshot.forEach(ipSnapshot => {
      const ipStatus = ipSnapshot.val();
      const ipStatsRef = db.ref(`security/ipStats/${ipSnapshot.key}`);
      
      // التحقق من آخر محاولة فاشلة
      ipStatsRef.once('value').then(statsSnapshot => {
        const stats = statsSnapshot.val();
        
        if (!stats || !stats.lastFailedAttempt || stats.lastFailedAttempt < oneWeekAgo) {
          // إذا لم تكن هناك محاولات فاشلة حديثة، قم بإلغاء الحظر
          if (ipStatus.banned) {
            ipPromises.push(
              ipStatusRef.child(ipSnapshot.key).update({ banned: false, cooldownUntil: null, unbannedAt: now })
              .then(() => { ipBansRemoved++; })
            );
          }
        }
      });
    });
    
    // انتظار انتهاء جميع العمليات
    await Promise.all([...loginPromises, ...activityPromises, ...ipPromises]);
    
    return {
      loginAttempts: loginAttemptsDeleted,
      activityLogs: activityLogsDeleted,
      ipBans: ipBansRemoved
    };
  } catch (error) {
    console.error('Error cleaning up old logs:', error);
    return {
      loginAttempts: 0,
      activityLogs: 0,
      ipBans: 0,
      error: error.message
    };
  }
}

module.exports = {
  trackLoginAttempt,
  logSecurityActivity,
  updateIPStatus,
  checkIPStatus,
  cleanupOldLogs
};