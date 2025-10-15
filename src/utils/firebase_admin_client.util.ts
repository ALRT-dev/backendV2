import admin, { type ServiceAccount } from "firebase-admin";
import serviceAccountFile from "../../serviceAccountKey.json" with { type: "json" };

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountFile as ServiceAccount),
  });
}

export const firebaseAdmin = admin;
