# Luxury Streetwear E-commerce Platform

A cutting-edge luxury streetwear e-commerce platform designed for modern fashion enthusiasts, combining advanced user experience features with intuitive design.

## Features

- **Modern User Interface**: React.js frontend with TypeScript and Tailwind CSS
- **Responsive Design**: Mobile-first approach for a seamless experience across all devices
- **Secure Authentication**: Enhanced admin authentication system with Firebase
- **Product Management**: Comprehensive system for managing product inventory
- **Order Processing**: Streamlined order management workflow
- **Real-time Data**: Firebase Realtime Database integration

## Tech Stack

- **Frontend**: React.js, TypeScript, Tailwind CSS
- **Backend**: Express.js
- **Database**: Firebase Realtime Database
- **Authentication**: Firebase Authentication
- **Styling**: Shadcn UI Components

## Admin Security System

Recently implemented enhanced security features for the admin panel:

### Key Security Features

1. **Hidden Admin Route**
   - Changed from `/admin` to `/gatekeeper-x9f2` for added security
   - Makes it harder for potential attackers to discover the admin panel

2. **Firebase Authentication**
   - Admin credentials stored and authenticated through Firebase Auth
   - No hardcoded credentials in the codebase
   - Managed directly from Firebase console for added security

3. **Login Attempt Tracking**
   - All login attempts are silently logged with detailed information:
     - IP address
     - Device fingerprint (browser, OS, device type)
     - Timestamp
     - Success/failure status
   - Data stored in Firebase for security monitoring

4. **Cooldown System**
   - After 2 failed login attempts, enforces a 1-minute cooldown period
   - Prevents brute force attacks by limiting the rate of attempts

5. **IP Banning System**
   - After 5 failed login attempts, the IP address is permanently blocked
   - Banned IPs stored in Firebase Realtime Database
   - Manual management available through Firebase console

### Setup Instructions

First-time setup of the admin security system:

1. Run the admin setup script:
   ```
   node scripts/setupAdmin.js
   ```

2. Follow the prompts to create an admin account with Firebase Authentication

3. The admin can now login at `/gatekeeper-x9f2` with the provided credentials

See the detailed documentation in `scripts/README.md` for more information.