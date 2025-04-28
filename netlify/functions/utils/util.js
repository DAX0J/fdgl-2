// ملف مساعد للوظائف المتنوعة
const jwt = require('jsonwebtoken');

/**
 * معالجة عنوان IP ليكون آمنًا للاستخدام كمسار في Firebase
 * Firebase لا يسمح بالنقاط في مسارات قاعدة البيانات، لذلك نستبدلها بـ _
 * @param {string} ip عنوان IP
 * @returns {string} عنوان IP آمن للاستخدام كمسار
 */
const sanitizeIPForFirebase = (ip) => {
  if (!ip) return 'unknown';
  return ip.replace(/\./g, '_');
};

/**
 * استخراج عنوان IP من كائن الحدث
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {string} عنوان IP
 */
const getIPFromRequest = (event) => {
  let ip = event.headers['client-ip'] || 
           event.headers['x-forwarded-for'] || 
           event.requestContext?.identity?.sourceIp ||
           event.ip ||
           'unknown';
  
  // في حالة وجود قائمة من عناوين IP، استخدام العنوان الأول
  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }
  
  return ip;
};

/**
 * الحصول على User-Agent من كائن الحدث
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {string} User-Agent
 */
const getUserAgentFromRequest = (event) => {
  return event.headers['user-agent'] || event.headers['User-Agent'] || 'unknown';
};

/**
 * الحصول على معلومات العميل من كائن الحدث
 * @param {object} event كائن الحدث من Netlify Function
 * @returns {{ip: string, userAgent: string}} معلومات العميل
 */
const getClientInfo = (event) => {
  return {
    ip: getIPFromRequest(event),
    userAgent: getUserAgentFromRequest(event)
  };
};

/**
 * إنشاء استجابة نجاح
 * @param {object} data بيانات الاستجابة
 * @param {number} statusCode رمز الحالة (اختياري، الافتراضي: 200)
 * @returns {object} استجابة نجاح
 */
const createSuccessResponse = (data, statusCode = 200) => {
  return {
    statusCode,
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

/**
 * إنشاء استجابة خطأ
 * @param {number} statusCode رمز الحالة
 * @param {string} message رسالة الخطأ
 * @param {object} additionalData بيانات إضافية (اختياري)
 * @returns {object} استجابة خطأ
 */
const createErrorResponse = (statusCode, message, additionalData = {}) => {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      message,
      ...additionalData
    }),
    headers: {
      'Content-Type': 'application/json'
    }
  };
};

module.exports = {
  sanitizeIPForFirebase,
  getIPFromRequest,
  getUserAgentFromRequest,
  getClientInfo,
  createSuccessResponse,
  createErrorResponse
};