// وظيفة تسجيل نشاط أمني
const { handleCors } = require('./utils/cors');
const { getIPFromRequest, getUserAgentFromRequest, createSuccessResponse, createErrorResponse } = require('./utils/util');
const { logSecurityActivity } = require('./utils/securityLogs');
const { extractAuthToken, verifyToken } = require('./utils/auth');

/**
 * وظيفة تسجيل نشاط أمني
 * تستخدم لتسجيل أنشطة المستخدمين المهمة مثل تسجيل الدخول، تغيير كلمة المرور، إلخ
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => ({
      statusCode: 204,
      body: ''
    }));
  }
  
  // التأكد من أن الطلب هو POST
  if (event.httpMethod !== 'POST') {
    const response = createErrorResponse(405, 'طريقة الطلب غير مسموح بها. استخدم POST.');
    return handleCors(event, () => response);
  }

  try {
    // استخراج معلومات العميل
    const ip = getIPFromRequest(event);
    const userAgent = getUserAgentFromRequest(event);
    
    // محاولة استخراج معلومات الطلب
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (error) {
      return handleCors(event, () => createErrorResponse(400, 'نص JSON غير صالح', { error: error.message }));
    }
    
    // التحقق من وجود البيانات المطلوبة
    if (!payload.action) {
      return handleCors(event, () => createErrorResponse(400, 'البيانات مفقودة: action مطلوب'));
    }
    
    // محاولة استخراج معلومات المستخدم من الرمز (إذا كان موجودًا)
    let userId = 'anonymous';
    const token = extractAuthToken(event);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.uid) {
        userId = decoded.uid;
      }
    }
    
    // استخدام معرف المستخدم من الطلب إذا تم توفيره
    if (payload.userId) {
      userId = payload.userId;
    }
    
    // تسجيل النشاط
    await logSecurityActivity(
      userId,
      payload.action,
      ip,
      userAgent,
      payload.details || {}
    );
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      success: true,
      message: 'تم تسجيل النشاط بنجاح',
      timestamp: new Date().toISOString()
    });
    
    return handleCors(event, () => response);
  } catch (error) {
    console.error('خطأ في تسجيل النشاط الأمني:', error);
    
    const response = createErrorResponse(500, 'حدث خطأ أثناء تسجيل النشاط الأمني', 
      { error: error.message }
    );
    
    return handleCors(event, () => response);
  }
};