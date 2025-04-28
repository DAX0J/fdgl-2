// وظيفة Netlify لتنظيف سجلات الأمان القديمة
const { handleCors } = require('./utils/cors');
const { cleanupOldLogs } = require('./utils/securityLogs');
const { requireAdmin } = require('./utils/auth');
const { createSuccessResponse, createErrorResponse } = require('./utils/util');

/**
 * تنظيف سجلات الأمان القديمة
 * هذه الوظيفة تزيل:
 * - سجلات تسجيل الدخول القديمة (أقدم من شهر)
 * - سجلات النشاط القديمة (أقدم من شهر)
 * - تلغي حظر عناوين IP التي لم تحاول تسجيل الدخول لمدة أسبوع
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
    // التحقق من المصادقة - هذه الوظيفة متاحة فقط للمسؤولين
    const authResult = await requireAdmin(event);
    if (!authResult.isAuthorized) {
      return authResult.error;
    }

    // تنظيف السجلات القديمة
    const results = await cleanupOldLogs();
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      success: true,
      message: 'تم تنظيف سجلات الأمان القديمة بنجاح',
      deletedRecords: results,
      timestamp: new Date().toISOString()
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  } catch (error) {
    console.error('Error cleaning up security logs:', error);
    
    const response = createErrorResponse(500, 'حدث خطأ أثناء تنظيف سجلات الأمان', {
      error: error.message
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  }
};