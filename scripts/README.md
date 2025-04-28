# Admin Security Setup

This directory contains scripts for setting up and managing admin security features.

## Setting Up Admin Authentication

To set up Firebase Authentication for admin access and initialize the required security structures in Firebase Realtime Database:

1. Run the admin setup script:
```
node scripts/setupAdmin.js
```

2. Follow the prompts to enter an admin email and password.

3. The script will:
   - Create a user in Firebase Authentication with the provided credentials
   - Add the email to the list of authorized admin emails in the Realtime Database
   - Initialize the required database structures for IP blocking and login tracking

## After Setup

After completing the setup, you can now:

1. Login to the admin panel at `/gatekeeper-x9f2` using the credentials you provided
2. The system will automatically track login attempts and block IPs that make too many failed attempts
3. Login information will be stored securely in Firebase

## Security Features Implemented

- Admin route changed from `/admin` to `/gatekeeper-x9f2`
- Admin authentication now uses Firebase Authentication
- All login attempts are tracked silently
- IP-based cooldown system: After 2 failed attempts, cooldown for 1 minute
- IP-based ban system: After 5 failed attempts, IP is blocked completely
- Detailed login tracking includes device fingerprinting, IP addresses, and timestamps