import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC42izEanGrKtBRembZazAZWkKkLUxACZY",
  authDomain: "gymiq-saas.firebaseapp.com",
  projectId: "gymiq-saas",
  storageBucket: "gymiq-saas.firebasestorage.app",
  messagingSenderId: "350019249810",
  appId: "1:350019249810:web:b4d181e297b4842be3e84b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };