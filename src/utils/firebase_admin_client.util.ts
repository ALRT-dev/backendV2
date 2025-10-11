import admin from "firebase-admin";
import serviceAccountFile from "../../serviceAccountKey.json" with { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountFile),
  });
}

export const firebaseAdmin = admin;
