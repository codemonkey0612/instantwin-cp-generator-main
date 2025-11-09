import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import "firebase/compat/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA3DxxmUyHgRj9Jyx8FEfJl28uohvmakE4",
  authDomain: "instantwin-app.com",
  projectId: "instantwin-cp-generator",
  storageBucket: "instantwin-cp-generator.firebasestorage.app",
  messagingSenderId: "540864841035",
  appId: "1:540864841035:web:1000b871933c309f1354ce",
};

// Initialize Firebase, but only if it hasn't been initialized already.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Export the firestore instance and Timestamp constructor from the global firebase object.
export const db = firebase.firestore();
export const Timestamp = firebase.firestore.Timestamp;
export const FieldValue = firebase.firestore.FieldValue;
export const auth = firebase.auth();
export const googleProvider = new firebase.auth.GoogleAuthProvider();
export const storage = firebase.storage();
export const functions = firebase.app().functions("asia-northeast1");

// Export the whole firebase object for access to types and FieldValue
export { firebase };
