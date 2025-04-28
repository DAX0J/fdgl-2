// وظيفة Netlify لتسجيل نشاط أمني مهم
const { handleCors } = require('./utils/cors');
const { logSecurityActivity } = require('./utils/securityLogs');
const { requireAuth } = require('./utils/auth');
const { createSuccessResponse, createErrorResponse, getClientInfo } = require('./utils/util');

/**
 * تسجيل نشاط مستخدم
 * هذه الوظيفة تستخدم فقط للأنشطة المهمة مثل:
 * - تغيير كلمة مرور الموقع
 * - تغيير إعدادات المتجر
 * - عمليات الدفع
 * - وغيرها من الإجراءات الحساسة
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => {});
  }
  
  // التأكد من أن الطلب هو POST
  if (event.httpMethod !== 'POST') {
    const response = createErrorResponse(405, 'طريقة الطلب غير مسموح بها. استخدم POST.');
    return handleCors(event, () => response);
  }

  try {
    // التحقق من المصادقة
    const authResult = await requireAuth(event);
    
    // استخراج معلومات العميل
    const clientInfo = getClientInfo(event);
    
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
    
    // تحديد معرف المستخدم (إما من المصادقة أو من الطلب)
    const userId = authResult.isAuthorized ? 
      authResult.user.uid : 
      payload.userId || 'anonymous';
    
    // تسجيل النشاط
    await logSecurityActivity(
      userId,
      payload.action,
      clientInfo.ip,
      clientInfo.userAgent,
      payload.details || {}
    );
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      success: true,
      message: 'تم تسجيل النشاط بنجاح',
      timestamp: new Date().toISOString()
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  } catch (error) {
    console.error('Error logging security activity:', error);
    
    const response = createErrorResponse(500, 'حدث خطأ أثناء تسجيل النشاط', {
      error: error.message
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  }
};