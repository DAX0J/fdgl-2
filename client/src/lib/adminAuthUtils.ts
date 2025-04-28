import { readData, writeData, updateData, pushData } from './firebase';
import { UAParser } from 'ua-parser-js';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

// Helper function to sanitize IP addresses for Firebase paths
// Firebase paths can't contain ".", "#", "$", "[", or "]"
const sanitizeIPForFirebase = (ip: string): string => {
  return ip.replace(/\./g, '_');
};

interface LoginAttempt {
  ip: string;
  email: string;
  timestamp: number;
  userAgent: string;
  success: boolean;
  deviceInfo: {
    browser: string;
    os: string;
    device: string;
  };
}

interface IPStatus {
  ip: string;
  failedAttempts: number;
  lastAttemptTime: number;
  cooldownUntil: number | null;
  banned: boolean;
}

/**
 * Track a login attempt in Firebase
 */
export const trackLoginAttempt = async (email: string, success: boolean): Promise<void> => {
  try {
    // Get IP address from client-side (this is not 100% reliable, but it's what we have client-side)
    // In a real production app, you'd use server-side tracking for this
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const ip = ipData.ip;

    // Parse user agent for device info
    const parser = new UAParser();
    const uaResult = parser.getResult();
    
    const loginAttempt: LoginAttempt = {
      ip,
      email,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      success,
      deviceInfo: {
        browser: `${uaResult.browser.name || 'Unknown'} ${uaResult.browser.version || ''}`.trim(),
        os: `${uaResult.os.name || 'Unknown'} ${uaResult.os.version || ''}`.trim(),
        device: uaResult.device.vendor 
          ? `${uaResult.device.vendor} ${uaResult.device.model || ''}`.trim()
          : 'Desktop/Unknown'
      }
    };

    // Store the login attempt in Firebase
    await pushData('adminLoginAttempts', loginAttempt);
    
    // If login failed, update the IP status
    if (!success) {
      await updateIPStatus(ip);
    }
  } catch (error) {
    console.error('Error tracking login attempt:', error);
    // Don't throw, as this is a background operation and shouldn't affect the user experience
  }
};

/**
 * Check if an IP is banned or in cooldown
 */
export const checkIPStatus = async (): Promise<{ banned: boolean; cooldown: number | null }> => {
  try {
    // Get IP address
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    const ip = ipData.ip;
    
    // Sanitize IP for Firebase path
    const safeIP = sanitizeIPForFirebase(ip);
    
    // Check if IP exists in Firebase
    const snapshot = await readData(`bannedIPs/${safeIP}`);
    const ipStatus = snapshot.val() as IPStatus | null;
    
    if (!ipStatus) {
      return { banned: false, cooldown: null };
    }
    
    // Check if IP is banned
    if (ipStatus.banned) {
      return { banned: true, cooldown: null };
    }
    
    // Check if IP is in cooldown
    if (ipStatus.cooldownUntil && ipStatus.cooldownUntil > Date.now()) {
      return { banned: false, cooldown: ipStatus.cooldownUntil };
    }
    
    return { banned: false, cooldown: null };
  } catch (error) {
    console.error('Error checking IP status:', error);
    // Default to not banned in case of error to prevent locking out users
    return { banned: false, cooldown: null };
  }
};

/**
 * Update IP status after a failed login attempt
 */
const updateIPStatus = async (ip: string): Promise<void> => {
  try {
    // Sanitize IP for Firebase path
    const safeIP = sanitizeIPForFirebase(ip);
    
    // Check if IP exists in Firebase
    const snapshot = await readData(`bannedIPs/${safeIP}`);
    const ipStatus = snapshot.val() as IPStatus | null;
    
    const now = Date.now();
    
    if (!ipStatus) {
      // First failed attempt
      await writeData(`bannedIPs/${safeIP}`, {
        ip,
        failedAttempts: 1,
        lastAttemptTime: now,
        cooldownUntil: null,
        banned: false
      });
      return;
    }
    
    // Update existing IP status
    const updatedStatus: IPStatus = {
      ...ipStatus,
      failedAttempts: ipStatus.failedAttempts + 1,
      lastAttemptTime: now
    };
    
    // Apply cooldown if threshold reached (2 failed attempts)
    if (updatedStatus.failedAttempts === 2) {
      updatedStatus.cooldownUntil = now + 60000; // 1 minute cooldown
    }
    
    // Ban IP if threshold reached (5 failed attempts)
    if (updatedStatus.failedAttempts >= 5) {
      updatedStatus.banned = true;
    }
    
    await writeData(`bannedIPs/${safeIP}`, updatedStatus);
  } catch (error) {
    console.error('Error updating IP status:', error);
  }
};

/**
 * Authenticate admin with Firebase Authentication
 */
export const authenticateAdmin = async (email: string, password: string): Promise<boolean> => {
  const auth = getAuth();
  
  try {
    // Attempt to authenticate with Firebase
    await signInWithEmailAndPassword(auth, email, password);
    
    // Track successful login attempt
    await trackLoginAttempt(email, true);
    
    return true;
  } catch (error) {
    console.error('Firebase authentication error:', error);
    
    // Track failed login attempt
    await trackLoginAttempt(email, false);
    
    return false;
  }
};