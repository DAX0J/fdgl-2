/**
 * This script initializes the admin authentication and security settings in Firebase
 * Run it once to set up the authorized admin emails and other security configurations.
 */

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const readline = require('readline');

// Your web app's Firebase configuration - same as used in the app
const firebaseConfig = {
  apiKey: "AIzaSyBoBqVU1lvtuNZ2FlAZgdYCA4BaMlNy1pw",
  authDomain: "e2-com-10-2024-to-11-2024.firebaseapp.com",
  databaseURL: "https://e2-com-10-2024-to-11-2024-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "e2-com-10-2024-to-11-2024",
  storageBucket: "e2-com-10-2024-to-11-2024.firebasestorage.app",
  messagingSenderId: "859750456330",
  appId: "1:859750456330:web:cb21a5c394917b470713f3",
  measurementId: "G-KLPJPL70KN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupAdmin() {
  console.log('====================================');
  console.log('Admin Authentication Setup');
  console.log('====================================');
  console.log('This script will set up Firebase Authentication for admin access.');
  console.log('You will need to provide an email and password for admin login.');
  console.log('This information will be used to create an admin user in Firebase Authentication.');
  console.log('====================================\n');

  // Ask for admin email and password
  rl.question('Enter admin email: ', async (email) => {
    rl.question('Enter admin password (min 6 characters): ', async (password) => {
      try {
        // Create user in Firebase Authentication
        console.log('\nCreating admin user in Firebase Authentication...');
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Admin user created successfully in Firebase Authentication');

        // Add email to authorized admin emails in Realtime Database
        console.log('\nAdding email to authorized admin list in Realtime Database...');
        const adminEmailsRef = ref(database, 'authorizedAdminEmails');
        const adminData = {};
        adminData[email] = true;
        await set(adminEmailsRef, adminData);
        console.log('✅ Email added to authorized admin list');

        // Initialize banned IPs structure in Realtime Database
        console.log('\nInitializing banned IPs structure in Realtime Database...');
        const bannedIPsRef = ref(database, 'bannedIPs');
        await set(bannedIPsRef, {});
        console.log('✅ Banned IPs structure initialized');

        console.log('\n====================================');
        console.log('Setup completed successfully!');
        console.log('You can now log in to the admin panel using the provided email and password.');
        console.log('====================================');
        
        rl.close();
        process.exit(0);
      } catch (error) {
        console.error('\n❌ Error during setup:', error.message);
        
        if (error.code === 'auth/email-already-in-use') {
          console.log('\nThe email is already registered in Firebase Authentication.');
          console.log('Adding it to the authorized admins list anyway...');
          
          // Still add the email to authorized admins
          const adminEmailsRef = ref(database, 'authorizedAdminEmails');
          const adminData = {};
          adminData[email] = true;
          await set(adminEmailsRef, adminData);
          console.log('✅ Email added to authorized admin list');
          
          // Initialize banned IPs structure if needed
          console.log('\nInitializing banned IPs structure in Realtime Database...');
          const bannedIPsRef = ref(database, 'bannedIPs');
          await set(bannedIPsRef, {});
          console.log('✅ Banned IPs structure initialized');
          
          console.log('\n====================================');
          console.log('Setup completed with warnings.');
          console.log('You can now log in to the admin panel using the existing account.');
          console.log('====================================');
        } else {
          console.log('\nSetup failed. Please check the error and try again.');
        }
        
        rl.close();
        process.exit(1);
      }
    });
  });
}

// Run the setup
setupAdmin();