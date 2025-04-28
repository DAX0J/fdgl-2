/**
 * This script tests Firebase Authentication functionality
 * It's for development purposes only to verify our implementation
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getDatabase, ref, get } = require('firebase/database');

// Your web app's Firebase configuration
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
const auth = getAuth(app);
const database = getDatabase(app);

// Test function for Firebase Authentication
async function testFirebaseAuth() {
  // Sample credentials - you should replace these with your actual test credentials
  const email = 'test@example.com';
  const password = 'test123456';
  
  try {
    console.log('====================================');
    console.log('Firebase Authentication Test');
    console.log('====================================');
    
    // Test sign-in
    console.log(`\nAttempting to sign in with email: ${email}`);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Sign-in successful!');
    console.log('User details:', JSON.stringify({
      uid: userCredential.user.uid,
      email: userCredential.user.email,
      emailVerified: userCredential.user.emailVerified,
    }, null, 2));
    
    // Test checking authorized admins
    console.log('\nChecking if user is in authorized admins list...');
    const adminEmailsRef = ref(database, 'authorizedAdminEmails');
    const snapshot = await get(adminEmailsRef);
    const authorizedEmails = snapshot.val() || {};
    
    if (authorizedEmails[email]) {
      console.log('✅ User is an authorized admin!');
    } else {
      console.log('❌ User is NOT an authorized admin!');
    }
    
    // Test sign-out
    console.log('\nAttempting to sign out...');
    await signOut(auth);
    console.log('✅ Sign-out successful!');
    
    console.log('\n====================================');
    console.log('Test completed successfully!');
    console.log('====================================');
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
    console.log('\n====================================');
    console.log('Test failed!');
    console.log('====================================');
  }
}

// Run the test
testFirebaseAuth();