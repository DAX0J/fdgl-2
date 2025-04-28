const { 
  isAuthenticated, 
  extractAuthToken,
  verifyToken
} = require('./utils/auth');
const { handleCors } = require('./utils/cors');
const { createSuccessResponse, createErrorResponse } = require('./utils/util');

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
    // التحقق إذا كان المستخدم مصادق عليه
    const authenticated = isAuthenticated(event);
    
    if (!authenticated) {
      return createErrorResponse(401, 'غير مصرح به - الجلسة منتهية أو غير صالحة');
    }
    
    // استخراج معلومات من الرمز
    const token = extractAuthToken(event);
    const decoded = token ? verifyToken(token) : null;
    
    // إرجاع معلومات الرمز المصادق عليه
    return createSuccessResponse({
      valid: true,
      user: decoded || {},
      expires: decoded?.exp || 0
    });
  } catch (error) {
    console.error('خطأ في التحقق من الرمز:', error);
    return createErrorResponse(500, 'خطأ في الخادم أثناء التحقق من الرمز');
  }
};

// تغليف المعالج الأساسي بمعالج CORS
const wrappedHandler = (event, context) => {
  // التعامل مع طلبات OPTIONS بشكل خاص
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }
  
  // معالجة الطلب مع دعم CORS
  return handleCors(event, () => handler(event, context));
};

exports.handler = wrappedHandler;