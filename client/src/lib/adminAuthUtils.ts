import { UAParser } from 'ua-parser-js';
import api, { getApiUrl } from '@/lib/api';

interface IPStatus {
  banned: boolean;
  cooldown: number | null;
}

/**
 * Track a login attempt using the security-log-activity serverless function
 */
export const trackLoginAttempt = async (email: string, success: boolean): Promise<void> => {
  try {
    // Parse user agent for device info
    const parser = new UAParser();
    const uaResult = parser.getResult();
    
    const deviceInfo = {
      browser: `${uaResult.browser.name || 'Unknown'} ${uaResult.browser.version || ''}`.trim(),
      os: `${uaResult.os.name || 'Unknown'} ${uaResult.os.version || ''}`.trim(),
      device: uaResult.device.vendor 
        ? `${uaResult.device.vendor} ${uaResult.device.model || ''}`.trim()
        : 'Desktop/Unknown'
    };

    // Call the serverless function to log the activity
    const response = await fetch(`${getApiUrl()}/security-log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: success ? 'admin_login_success' : 'admin_login_failure',
        details: {
          email,
          userAgent: navigator.userAgent,
          deviceInfo,
          timestamp: Date.now()
        }
      }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
  } catch (error) {
    console.error('Error tracking login attempt:', error);
    // Don't throw, as this is a background operation and shouldn't affect the user experience
  }
};

/**
 * Check if an IP is banned or in cooldown using the check-ip-status serverless function
 */
export const checkIPStatus = async (): Promise<IPStatus> => {
  try {
    const response = await fetch(`${getApiUrl()}/check-ip-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    
    return {
      banned: data.banned || false,
      cooldown: data.cooldown || null
    };
  } catch (error) {
    console.error('Error checking IP status:', error);
    // Default to not banned in case of error to prevent locking out users
    return { banned: false, cooldown: null };
  }
};