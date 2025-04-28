import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSecurity } from '@/contexts/SecurityContext';

const NewUnlockSiteModal: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
  
  const { 
    isUnlocked, 
    isPasswordProtectionEnabled, 
    unlockSite, 
    ipBanned, 
    ipCooldown,
    checkIPStatus 
  } = useSecurity();
  
  // التحقق من الحالة عند تحميل المكون
  useEffect(() => {
    const checkStatus = async () => {
      await checkIPStatus();
    };
    
    checkStatus();
  }, [checkIPStatus]);
  
  // معالجة حالة التأخير
  useEffect(() => {
    if (ipCooldown) {
      const remainingTime = Math.ceil((ipCooldown - Date.now()) / 1000);
      
      if (remainingTime > 0) {
        setCooldownSeconds(remainingTime);
        
        // بدء العد التنازلي
        const interval = setInterval(() => {
          setCooldownSeconds(prev => {
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
      setCooldownSeconds(null);
    }
  }, [ipCooldown]);
  
  // إذا كان الموقع غير محمي أو تم فتحه بالفعل، لا تعرض الشاشة
  if (!isPasswordProtectionEnabled || isUnlocked) {
    return null;
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // منع الإرسال إذا كان هناك تأخير
    if (cooldownSeconds !== null) {
      return;
    }
    
    // منع الإرسال إذا كان عنوان IP محظور
    if (ipBanned) {
      setError('تم حظر وصولك بسبب محاولات غير صحيحة متكررة. يرجى التواصل مع المسؤول.');
      return;
    }
    
    if (!password.trim()) {
      setError('الرجاء إدخال كلمة المرور');
      return;
    }
    
    setLoading(true);
    
    try {
      const success = await unlockSite(password);
      
      if (!success) {
        setError('كلمة المرور غير صحيحة');
        
        // التحقق من حالة IP مرة أخرى
        await checkIPStatus();
      }
    } catch (error) {
      setError('حدث خطأ أثناء التحقق من كلمة المرور');
      console.error('Error during password validation:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-black border border-neutral-800 p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-xl md:text-2xl uppercase tracking-wider mb-2">محتوى مقيد</h1>
          <p className="text-neutral-400 text-sm">هذا المحتوى محمي بكلمة مرور</p>
        </div>
        
        {ipBanned ? (
          <div className="bg-red-900/50 border border-red-900 text-white p-4 mb-4">
            <p className="text-sm">
              تم حظر وصولك بسبب محاولات غير صحيحة متكررة. يرجى التواصل مع المسؤول.
            </p>
          </div>
        ) : cooldownSeconds !== null ? (
          <div className="bg-amber-900/50 border border-amber-900 text-white p-4 mb-4">
            <p className="text-sm">
              محاولات كثيرة خاطئة. يرجى المحاولة مرة أخرى بعد {cooldownSeconds} ثانية.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-900/50 border border-red-900 text-white p-3">
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm">
                كلمة المرور
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black border-neutral-800 w-full"
                placeholder="أدخل كلمة المرور"
                disabled={loading || cooldownSeconds !== null}
              />
            </div>
            
            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-neutral-200"
              disabled={loading || cooldownSeconds !== null || ipBanned}
            >
              {loading ? 'جاري التحقق...' : 'دخول'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default NewUnlockSiteModal;