const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const admin = require("firebase-admin");

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceAccountKey.json"); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

app.post("/razorpay-webhook", async (req, res) => {
  const secret = "your_webhook_secret";

  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest("hex");

  const signature = req.headers["x-razorpay-signature"];

  if (digest !== signature) {
    console.log("❌ Signature mismatch");
    return res.status(400).send("Invalid signature");
  }

  const payload = req.body;
  const email = payload?.payload?.payment?.entity?.email;

  if (payload.event === "payment.captured" && email) {
    const userRef = db.collection("users");
    const snapshot = await userRef.where("email", "==", email).get();

    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        doc.ref.set({ isPremium: true }, { merge: true });
        console.log(`✅ Upgraded user ${email}`);
      });
    } else {
      console.log(`⚠️ User not found: ${email}`);
    }
  }

  res.status(200).send("Webhook received");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
