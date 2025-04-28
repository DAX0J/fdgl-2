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
  
  // إعادة توجيه طلبات API إلى وظائف Netlify المحلية (ملاحظة: يستخدم هذا فقط في بيئة التطوير)
  app.use('/api', async (req, res, next) => {
    // تفقد إذا كان الطلب موجه إلى إحدى وظائف API التي قمنا بتنفيذها في Netlify Functions
    const netlifyFunctions = [
      'auth-check-protection',
      'auth-validate-password',
      'auth-status',
      'admin-login',
      'admin-logout',
      'admin-update-password',
      'admin-update-settings'
    ];
    
    // استخراج اسم الوظيفة من المسار
    const functionName = req.path.substring(1); // Remove the leading slash
    
    if (netlifyFunctions.includes(functionName)) {
      console.log(`Redirecting API request to Netlify Function: ${functionName}`);
      // إعادة توجيه الطلب إلى الرافعة المحلية الخاصة بـ Express (المسار الحالي سيخدم الغرض)
      return next();
    }
    
    // استمر بالطلبات الأخرى إلى المسارات المحددة أدناه
    next();
  });
  
  // Authentication routes
  app.post('/api/auth-validate-password', async (req, res) => {
    try {
      console.log('Validating password request received');
      const { password } = req.body;
      
      if (!password) {
        console.log('No password provided in request');
        return res.status(400).json({ success: false, message: 'Password is required' });
      }
      
      console.log('Checking password validity');
      const isValid = await storage.validatePassword(password);
      
      if (isValid) {
        console.log('Password validated successfully');
        // Generate a session token
        const token = await storage.generateSessionToken(req.ip || 'unknown');
        console.log('Generated session token:', token);
        
        // Return success with token
        return res.status(200).json({ 
          success: true, 
          message: 'Password validated successfully',
          token 
        });
      } else {
        console.log('Invalid password provided');
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid password'
        });
      }
    } catch (error) {
      console.error('Error validating password:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error during validation'
      });
    }
  });
  
  // Check if password protection is enabled
  app.get('/api/auth-check-protection', async (req, res) => {
    try {
      const isEnabled = await storage.checkPasswordProtectionEnabled();
      // تحقق من وجود رمز المصادقة في الطلب
      const token = req.headers['authorization'] || req.cookies?.authToken;
      const isAuthenticated = token ? await storage.validateSessionToken(token) : false;
      
      return res.status(200).json({ 
        enabled: isEnabled,
        authenticated: isAuthenticated
      });
    } catch (error) {
      console.error('Error checking password protection:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error checking protection status'
      });
    }
  });
  
  // التحقق من حالة المصادقة
  app.get('/api/auth-status', async (req, res) => {
    try {
      // التحقق من رمز المصادقة
      const token = req.headers['authorization'] || req.cookies?.authToken;
      const isAuthenticated = token ? await storage.validateSessionToken(token) : false;
      
      // الحصول على حالة حماية كلمة المرور
      const isProtectionEnabled = await storage.checkPasswordProtectionEnabled();
      
      // في النموذج الأولي، نفترض أن المستخدم ليس مسؤولاً
      // في التنفيذ الكامل، ستحتاج إلى التحقق من رمز المسؤول والبريد الإلكتروني
      const isAdmin = false;
      
      return res.status(200).json({
        authenticated: isAuthenticated,
        isAdmin: isAdmin,
        passwordProtectionEnabled: isProtectionEnabled
      });
    } catch (error) {
      console.error('Error checking auth status:', error);
      return res.status(500).json({ 
        error: 'Server error checking authentication status'
      });
    }
  });
  
  // Get current password (only for development/testing purposes)
  app.get('/api/auth/get-current-password', async (req, res) => {
    try {
      const password = await storage.getSitePassword();
      console.log('Current password is:', password);
      return res.status(200).json({ 
        password: password,
        note: 'This API is for development/testing only and should be removed in production'
      });
    } catch (error) {
      console.error('Error getting current password:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error getting current password'
      });
    }
  });
  
  // Admin routes to manage password settings
  app.post('/api/admin-update-password', async (req, res) => {
    try {
      const { password, enabled } = req.body;
      
      if (password !== undefined) {
        await storage.setSitePassword(password);
      }
      
      if (enabled !== undefined) {
        await storage.setPasswordProtection(enabled);
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Password settings updated'
      });
    } catch (error) {
      console.error('Error updating password settings:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error updating password settings'
      });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
