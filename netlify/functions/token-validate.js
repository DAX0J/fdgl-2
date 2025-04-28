const { Handler } = require('@netlify/functions');
const { 
  isAuthenticated, 
  unauthorizedResponse,
  verifyToken
} = require('./utils/auth');
const { logUnauthorizedAccess } = require('./utils/securityLogs');

/**
 * وظيفة للتحقق من صحة الرمز المقدم
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
    // استخراج الرمز من الطلب
    const authResult = isAuthenticated(event);
    
    if (!authResult.authenticated) {
      // تسجيل محاولة وصول غير مصرح بها
      return unauthorizedResponse('غير مصرح به', event, 'token-validation');
    }
    
    // إرجاع معلومات الرمز المصادق عليه
    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        user: authResult.user,
        expires: authResult.expires
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  } catch (error) {
    console.error('خطأ في التحقق من الرمز:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم أثناء التحقق من الرمز'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};

// استخدام وحدة CORS المخصصة
const { applyCors } = require('./utils/cors');

// تصدير المعالج مع CORS متقدم
exports.handler = applyCors(handler);