import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDp9E7C7tuUIvykWDKaLhEsaO1G44wbtxY",
  authDomain: "blood-donation-14331.firebaseapp.com",
  projectId: "blood-donation-14331",
  storageBucket: "blood-donation-14331.firebasestorage.app",
  messagingSenderId: "766449140684",
  appId: "1:766449140684:web:33ceb837ddcb55d1411369"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
