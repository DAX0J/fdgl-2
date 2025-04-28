import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSecurity } from '@/contexts/SecurityContext';

const NewAdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  
  const navigate = useNavigate();
  const { loginAdmin, ipBanned, ipCooldown, checkIPStatus } = useSecurity();
  
  // التحقق من حالة IP عند تحميل المكون
  useEffect(() => {
    const checkIPStatusOnMount = async () => {
      await checkIPStatus();
    };
    
    checkIPStatusOnMount();
  }, [checkIPStatus]);
  
  // معالجة حالة التأخير
  useEffect(() => {
    if (ipCooldown) {
      const remainingSeconds = Math.ceil((ipCooldown - Date.now()) / 1000);
      
      if (remainingSeconds > 0) {
        setCooldownRemaining(remainingSeconds);
        
        // بدء العد التنازلي
        const interval = setInterval(() => {
          setCooldownRemaining(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => clearInterval(interval);
      }
    } else {
      setCooldownRemaining(null);
    }
  }, [ipCooldown]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // منع الإرسال أثناء التأخير
    if (cooldownRemaining !== null) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const success = await loginAdmin(email, password);
      
      if (success) {
        navigate('/gatekeeper-x9f2/dashboard');
      } else {
        // التحقق من حالة IP بعد الفشل
        await checkIPStatus();
        
        if (ipBanned) {
          setError('تم حظر عنوان IP الخاص بك بسبب محاولات فاشلة متكررة. يرجى التواصل مع المسؤول.');
        } else if (ipCooldown) {
          const remainingSeconds = Math.ceil((ipCooldown - Date.now()) / 1000);
          setError(`عدد كبير من المحاولات الفاشلة. يرجى المحاولة مرة أخرى بعد ${remainingSeconds} ثانية.`);
        } else {
          setError('فشل تسجيل الدخول. يرجى التحقق من بيانات الاعتماد الخاصة بك والمحاولة مرة أخرى.');
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
      console.error('Login error:', err);
      
      // التحقق من حالة IP
      await checkIPStatus();
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="max-w-md w-full bg-black border border-gray-800 p-8">
        <h2 className="text-xl uppercase tracking-wider mb-6 text-center">وصول المسؤول الآمن</h2>
        
        {error && <p className="bg-red-900 text-white p-3 mb-4 text-sm">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-6 p-3 border border-gray-800 bg-black/50 text-sm">
            <p className="mb-2">تم تنفيذ تدابير أمنية معززة.</p>
            <p>يتم تسجيل جميع محاولات تسجيل الدخول مع:</p>
            <ul className="list-disc list-inside ml-2 mt-1 text-gray-400">
              <li>عنوان IP</li>
              <li>معلومات الجهاز</li>
              <li>الطابع الزمني</li>
            </ul>
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm mb-1">البريد الإلكتروني</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-black border-gray-800"
              placeholder="أدخل البريد الإلكتروني للمسؤول"
              autoComplete="off"
              disabled={loading || cooldownRemaining !== null || ipBanned}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm mb-1">كلمة المرور</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-black border-gray-800"
              placeholder="أدخل كلمة مرور المسؤول" 
              autoComplete="off"
              disabled={loading || cooldownRemaining !== null || ipBanned}
            />
          </div>
          
          <Button
            type="submit"
            disabled={loading || cooldownRemaining !== null || ipBanned}
            className="w-full bg-white text-black hover:bg-gray-200"
          >
            {loading ? 'جاري المصادقة...' : cooldownRemaining !== null 
              ? `فترة تهدئة: ${cooldownRemaining} ثانية متبقية` 
              : 'تسجيل الدخول الآمن'}
          </Button>
          
          <div className="text-center mt-4">
            <a href="/" className="text-sm text-gray-400 hover:text-white">
              العودة إلى الموقع
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewAdminLogin;