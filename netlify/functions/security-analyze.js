// وظيفة Netlify لتحليل الأمان واكتشاف التهديدات المحتملة
const { handleCors } = require('./utils/cors');
const { detectThreats } = require('./utils/securityLogs');
const { requireAdmin } = require('./utils/auth');
const { createSuccessResponse, createErrorResponse } = require('./util');

/**
 * تحليل سجلات الوصول للكشف عن أنماط مشبوهة
 */
exports.handler = async (event, context) => {
  // معالجة CORS
  if (event.httpMethod === 'OPTIONS') {
    return handleCors(event, () => {});
  }

  try {
    // التحقق من المصادقة - هذه الوظيفة متاحة فقط للمسؤولين
    const authResult = await requireAdmin(event);
    if (!authResult.isAuthorized) {
      return authResult.error;
    }

    // اكتشاف التهديدات المحتملة
    const threats = await detectThreats();
    
    // إعداد رسائل وصفية استنادًا إلى التهديدات المكتشفة
    const threatSummaries = threats.map(threat => {
      if (threat.type === 'suspicious_login_ip') {
        return {
          type: 'محاولات تسجيل دخول مشبوهة من عنوان IP',
          details: `${threat.ip} (${threat.details.failedAttempts} محاولات فاشلة من أصل ${threat.details.totalAttempts})`,
          severity: threat.severity,
          recommendations: [
            'مراقبة عنوان IP هذا',
            'التحقق من سجلات الوصول الأخرى',
            'حظر عنوان IP إذا استمرت المحاولات المشبوهة'
          ]
        };
      } else if (threat.type === 'suspicious_login_email') {
        return {
          type: 'محاولات تسجيل دخول مشبوهة لحساب',
          details: `${threat.email} (${threat.details.failedAttempts} محاولات فاشلة من أصل ${threat.details.totalAttempts})`,
          severity: threat.severity,
          recommendations: [
            'التواصل مع المستخدم لتأكيد محاولات تسجيل الدخول',
            'تشجيع المستخدم على تغيير كلمة المرور',
            'تفعيل المصادقة الثنائية إذا كان ذلك متاحًا'
          ]
        };
      }
      
      return {
        type: threat.type,
        details: JSON.stringify(threat.details),
        severity: threat.severity,
        recommendations: ['مراجعة السجلات بشكل مفصل']
      };
    });
    
    // إرجاع النتائج
    const response = createSuccessResponse({
      success: true,
      message: threats.length > 0 ? 
        `تم اكتشاف ${threats.length} تهديدات محتملة` : 
        'لم يتم اكتشاف أي تهديدات',
      threatCount: threats.length,
      threatSummaries,
      threats,
      timestamp: new Date().toISOString()
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  } catch (error) {
    console.error('Error analyzing security:', error);
    
    const response = createErrorResponse(500, 'حدث خطأ أثناء تحليل الأمان', {
      error: error.message
    });
    
    // إضافة رؤوس CORS
    return handleCors(event, () => response);
  }
};