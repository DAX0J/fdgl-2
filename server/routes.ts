import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

// Authentication middleware to check if the user has a valid session token
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // قائمة المسارات التي لا تتطلب مصادقة
  const noAuthPaths = [
    // مسارات API القديمة
    '/api/auth/validate-password',
    '/api/auth/check-protection',
    '/api/auth/get-current-password',
    
    // مسارات API الجديدة للتوافق مع Netlify Functions
    '/api/auth-validate-password',
    '/api/auth-check-protection',
    '/api/auth-status',
    
    // الموارد الثابتة
    '/favicon.ico',
    '/assets/',
    '/_vite'
  ];

  // تخطي التحقق للمسارات المسموح بها وجميع الموارد الثابتة
  if (noAuthPaths.some(path => req.path.startsWith(path)) || 
      req.path.includes('assets') || 
      req.path.includes('vite') || 
      req.path.includes('.js') || 
      req.path.includes('.css') ||
      req.path.includes('.png') ||
      req.path.includes('.jpg') ||
      req.path.includes('.svg') ||
      req.path.includes('.json')) {
    // تخطي المصادقة للمسارات المسموح بها
    return next();
  }

  // تخطي المصادقة للموارد اللازمة لتحميل الصفحة
  if (req.method === 'GET' && (
      req.path === '/' || 
      req.path === '/favicon.ico' || 
      req.path.startsWith('/_vite'))) {
    return next();
  }
  
  // في بيئة التطوير، السماح بالوصول إلى جميع وظائف API للاختبار
  if (process.env.NODE_ENV !== 'production' && req.path.startsWith('/api/')) {
    console.log(`Development mode: Skipping auth for API path: ${req.path}`);
    return next();
  }

  // التحقق إذا كانت حماية كلمة المرور مفعلة
  const isProtectionEnabled = await storage.checkPasswordProtectionEnabled();
  if (!isProtectionEnabled) {
    // حماية كلمة المرور معطلة، السماح بالوصول
    return next();
  }

  // الحصول على الرمز من الهيدرات أو الكوكيز
  const token = req.headers['authorization'] as string | undefined ||
                req.headers['x-auth-token'] as string | undefined ||
                req.cookies?.authToken;
  
  // التحقق من صلاحية الرمز
  const isValidToken = await storage.validateSessionToken(token);
  
  // إذا لم يكن هناك رمز أو كان الرمز غير صالح، رفض الطلب
  if (!isValidToken) {
    // إذا كان هذا طلب API، إرجاع خطأ JSON
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ message: 'Unauthorized - Password required' });
    }
    
    // بالنسبة للطلبات غير الـ API، خدمة صفحة HTML الرئيسية
    // هذا يسمح للتوجيه على جانب العميل بالتعامل مع شاشة كلمة المرور
    return next();
  }
  
  console.log(`Access granted for path: ${req.path}`);
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply authentication middleware to all requests
  app.use(requireAuth);
  
  // توجيه جميع طلبات API إلى وظائف Netlify
  app.use('/api', async (req, res, next) => {
    // قائمة وظائف Netlify المعتمدة
    const netlifyFunctions = [
      'auth-check-protection',
      'auth-validate-password',
      'auth-status',
      'admin-login',
      'admin-logout',
      'admin-update-password',
      'admin-update-settings',
      'auth-test',
      'test-firebase',
      'security-analyze',
      'security-cleanup',
      'security-log-activity',
      'token-validate'
    ];
    
    // استخراج اسم الوظيفة من المسار
    const functionName = req.path.substring(1); // Remove the leading slash
    
    if (netlifyFunctions.includes(functionName)) {
      console.log(`Redirecting API request to Netlify Function: ${functionName}`);
      // في بيئة التطوير، نواصل إلى المسار التالي. في بيئة الإنتاج، سيتم تحويل هذا الطلب إلى Netlify Functions
      return next();
    }
    
    // الرد على أي مسارات API أخرى غير معتمدة
    return res.status(404).json({ 
      success: false, 
      message: `API endpoint not found: ${req.path}. Use Netlify Functions for API endpoints.`
    });
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
