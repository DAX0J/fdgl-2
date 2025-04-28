// وظيفة التحقق من حالة عنوان IP
const { handleCors } = require('./utils/cors');
const { getIPFromRequest } = require('./utils/util');
const { checkIPStatus } = require('./utils/securityLogs');

/**
 * وظيفة التحقق من حالة عنوان IP
 * تستخدم عنوان IP الخاص بالزائر وتتحقق مما إذا كان محظوراً أو معرضاً للتأخير المؤقت
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => {
      return {
        statusCode: 204,
        body: ''
      };
    });
  }
  
  // التأكد من أن الطلب هو GET
  if (event.httpMethod !== 'GET') {
    return handleCors(event, () => {
      return {
        statusCode: 405,
        body: JSON.stringify({ 
          success: false, 
          message: 'طريقة الطلب غير مسموح بها. استخدم GET.' 
        })
      };
    });
  }

  try {
    // الحصول على عنوان IP من الطلب
    const ip = getIPFromRequest(event);
    
    // التحقق من حالة عنوان IP
    const ipStatus = await checkIPStatus(ip);
    
    // إرجاع حالة عنوان IP
    return handleCors(event, () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          banned: ipStatus.banned,
          cooldown: ipStatus.cooldown
        })
      };
    });
  } catch (error) {
    console.error('خطأ في التحقق من حالة عنوان IP:', error);
    
    return handleCors(event, () => {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          message: 'حدث خطأ أثناء التحقق من حالة عنوان IP',
          error: error.message
        })
      };
    });
  }
};