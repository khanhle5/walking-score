"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Public web configuration from Mindstamps' src/config/firebase.js. These are
// not admin credentials. Firestore security rules enforce the viewer's access.
// Set all four NEXT_PUBLIC_MINDSTAMPS_* values if its deployed project differs.
const overrides = [
  process.env.NEXT_PUBLIC_MINDSTAMPS_API_KEY,
  process.env.NEXT_PUBLIC_MINDSTAMPS_AUTH_DOMAIN,
  process.env.NEXT_PUBLIC_MINDSTAMPS_PROJECT_ID,
  process.env.NEXT_PUBLIC_MINDSTAMPS_APP_ID,
];
// Refuse partial overrides rather than accidentally writing to a mixed project.
export const mindstampsConfigValid = !overrides.some(Boolean) || overrides.every(Boolean);

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_MINDSTAMPS_API_KEY || "AIzaSyD7sSXAd_48n2k0t5213FhRJq08mE0iL-s",
  authDomain: process.env.NEXT_PUBLIC_MINDSTAMPS_AUTH_DOMAIN || "mindstamps.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_MINDSTAMPS_PROJECT_ID || "mindstamps",
  appId: process.env.NEXT_PUBLIC_MINDSTAMPS_APP_ID || "1:916092227786:web:a228777d4564bfc2aee433",
};

const appName = "mindstamps";
const app = getApps().some((item) => item.name === appName)
  ? getApp(appName)
  : initializeApp(firebaseConfig, appName);

export const mindstampsAuth = getAuth(app);
export const mindstampsDb = getFirestore(app);
