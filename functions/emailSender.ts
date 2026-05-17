/**
 * Email Sender Cloud Function (Firebase)
 * 
 * This is a Firebase Cloud Function that handles sending emails
 * Deploy with: firebase deploy --only functions
 * 
 * Triggered by:
 * - HTTP endpoint: /send-email
 * - Pub/Sub: devpilot-email-queue
 * 
 * Requirements:
 * - Firebase Admin SDK
 * - Nodemailer or SendGrid
 * - Environment variables configured
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

/**
 * Email configuration
 */
interface EmailRequest {
  to: string;
  subject: string;
  text: string;
  html: string;
  type: string; // streak_milestone, achievement_unlock, weekly_summary, etc.
  data?: Record<string, any>;
  userId?: string;
}

/**
 * Configure Nodemailer transport
 * Options:
 * 1. Gmail via OAuth
 * 2. SendGrid
 * 3. Custom SMTP
 */
const createMailTransport = () => {
  // Option 1: Gmail (requires app-specific password)
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  // Option 2: SendGrid
  /*
  return nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    auth: {
      user: "apikey",
      pass: process.env.SENDGRID_API_KEY,
    },
  });
  */
};

/**
 * HTTP endpoint to send email
 */
export const sendEmail = functions.https.onRequest(
  async (request, response) => {
    // Verify authentication
    const token = request.headers.authorization?.split("Bearer ")?.[1];
    if (!token) {
      response.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;

      const emailRequest: EmailRequest = request.body;

      // Validate request
      if (!emailRequest.to || !emailRequest.subject) {
        response.status(400).json({ error: "Missing required fields" });
        return;
      }

      // Check user preferences
      const userPrefs = await db
        .collection("users")
        .doc(uid)
        .collection("preferences")
        .doc("email")
        .get();

      if (!userPrefs.exists) {
        // Create default preferences
        await db.collection("users").doc(uid).collection("preferences").doc("email").set({
          enabled: true,
          frequency: "daily",
          lastEmailAt: 0,
        });
      } else {
        const prefs = userPrefs.data();
        if (!prefs?.enabled) {
          response.status(200).json({
            message: "User has disabled email notifications",
          });
          return;
        }

        // Check frequency limit
        const lastEmailAt = prefs.lastEmailAt || 0;
        const now = Date.now();
        const hoursSinceLastEmail = (now - lastEmailAt) / (1000 * 60 * 60);

        if (prefs.frequency === "daily" && hoursSinceLastEmail < 24) {
          response.status(200).json({ message: "Rate limited: daily limit reached" });
          return;
        }
      }

      // Send email
      const transporter = createMailTransport();
      const info = await transporter.sendMail({
        from: process.env.GMAIL_USER || "devpilot@example.com",
        to: emailRequest.to,
        subject: emailRequest.subject,
        text: emailRequest.text,
        html: emailRequest.html,
      });

      // Log the email
      await db.collection("users").doc(uid).collection("emailLogs").add({
        type: emailRequest.type,
        recipient: emailRequest.to,
        messageId: info.messageId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "sent",
      });

      // Update last email timestamp
      await db
        .collection("users")
        .doc(uid)
        .collection("preferences")
        .doc("email")
        .update({
          lastEmailAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      response.status(200).json({
        message: "Email sent successfully",
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Email send error:", error);
      response.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

/**
 * Pub/Sub triggered function for batch email processing
 */
export const processBatchEmails = functions.pubsub
  .schedule("0 18 * * *") // 6 PM daily
  .timeZone("America/New_York")
  .onRun(async (context) => {
    console.log("Processing batch emails at", new Date().toISOString());

    const users = await db.collection("users").listDocuments();

    for (const userDoc of users) {
      const userData = await userDoc.get();
      if (!userData.exists) continue;

      const user = userData.data();
      const uid = userDoc.id;

      // Get user preferences
      const prefsDoc = await userDoc.collection("preferences").doc("email").get();
      const prefs = prefsDoc.data();

      if (!prefs?.enabled || prefs?.frequency !== "weekly") {
        continue;
      }

      // Build weekly summary email
      const progress = await userDoc.collection("progress").doc("current").get();
      const progressData = progress.data();

      if (!progressData) continue;

      const emailContent = {
        subject: `Your Weekly Learning Summary - DevPilot`,
        text: buildWeeklyEmailText(user, progressData),
        html: buildWeeklyEmailHtml(user, progressData),
      };

      // Queue for sending
      await userDoc.collection("emailQueue").add({
        ...emailContent,
        type: "weekly_summary",
        to: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
    }

    console.log("Batch email processing complete");
  });

/**
 * Build weekly summary email text
 */
function buildWeeklyEmailText(
  user: any,
  progress: any
): string {
  return `
Hi ${user.displayName},

Here's your weekly learning summary:

📊 Progress
- Current Streak: ${progress.currentStreak} days
- Total Learning Time: ${progress.totalMinutesLearned} minutes
- Topics Completed: ${progress.totalLessonsCompleted}
- TODOs Completed: ${progress.totalTodosCompleted}

🏆 Achievements
- Total Achievements: ${progress.totalAchievements}

Keep up the great work! You're making excellent progress.

Best regards,
The DevPilot Team
  `;
}

/**
 * Build weekly summary email HTML
 */
function buildWeeklyEmailHtml(
  user: any,
  progress: any
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px 20px; }
    .stat-row { display: flex; justify-content: space-between; margin: 15px 0; padding: 15px; background: #f9f9f9; border-radius: 4px; }
    .stat-label { font-weight: 500; color: #666; }
    .stat-value { font-size: 24px; font-weight: bold; color: #667eea; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 Your Weekly Learning Summary</h1>
      <p>Keep going, ${user.displayName}!</p>
    </div>
    <div class="content">
      <p>Hi ${user.displayName},</p>
      <p>Here's how you did this week:</p>

      <div class="stat-row">
        <span class="stat-label">🔥 Current Streak</span>
        <span class="stat-value">${progress.currentStreak} days</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">⏱️ Learning Time</span>
        <span class="stat-value">${Math.round(progress.totalMinutesLearned / 60)} hours</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">📚 Topics Completed</span>
        <span class="stat-value">${progress.totalLessonsCompleted}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">✅ TODOs Done</span>
        <span class="stat-value">${progress.totalTodosCompleted}</span>
      </div>

      <div class="stat-row">
        <span class="stat-label">🏆 Achievements</span>
        <span class="stat-value">${progress.totalAchievements}</span>
      </div>

      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        Keep up the amazing work! Your consistency is paying off. 🚀
      </p>
    </div>
    <div class="footer">
      <p>© 2025 DevPilot. You can manage your email preferences in the extension settings.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Triggered when achievement is unlocked
 */
export const onAchievementUnlocked = functions.firestore
  .document("users/{userId}/achievements/{achievementId}")
  .onCreate(async (snap, context) => {
    const { userId, achievementId } = context.params;
    const achievement = snap.data();

    // Get user profile
    const userDoc = await db.collection("users").doc(userId).get();
    const user = userDoc.data();

    if (!user) return;

    // Get user preferences
    const prefsDoc = await db
      .collection("users")
      .doc(userId)
      .collection("preferences")
      .doc("email")
      .get();
    const prefs = prefsDoc.data();

    if (!prefs?.enabled || !prefs?.achievements) {
      return;
    }

    // Send congratulation email
    const subject = `🎉 Achievement Unlocked: ${achievement.name}`;
    const html = `
<html>
  <body style="font-family: sans-serif;">
    <h1>🎉 Achievement Unlocked!</h1>
    <p>Hi ${user.displayName},</p>
    <p>Congratulations! You've unlocked the <strong>${achievement.name}</strong> achievement!</p>
    <p>${achievement.description}</p>
    <p>Keep learning and unlocking more achievements!</p>
  </body>
</html>
    `;

    await db.collection("users").doc(userId).collection("emailQueue").add({
      to: user.email,
      subject,
      html,
      type: "achievement_unlock",
      data: { achievementId },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
    });
  });

/**
 * Triggered when streak milestone is reached
 */
export const onStreakMilestone = functions.firestore
  .document("users/{userId}/progress/current")
  .onUpdate(async (change, context) => {
    const { userId } = context.params;
    const oldProgress = change.before.data();
    const newProgress = change.after.data();

    // Check if streak increased past milestone
    const milestones = [3, 7, 14, 30, 60, 100];
    const currentStreak = newProgress.currentStreak || 0;
    const previousStreak = oldProgress?.currentStreak || 0;

    if (currentStreak > previousStreak) {
      const achieved = milestones.filter(
        (m) => m <= currentStreak && m > previousStreak
      );

      if (achieved.length === 0) return;

      const milestone = achieved[achieved.length - 1];

      // Get user
      const userDoc = await db.collection("users").doc(userId).get();
      const user = userDoc.data();

      if (!user) return;

      // Get preferences
      const prefsDoc = await db
        .collection("users")
        .doc(userId)
        .collection("preferences")
        .doc("email")
        .get();
      const prefs = prefsDoc.data();

      if (!prefs?.enabled || !prefs?.streakMilestones) {
        return;
      }

      // Send milestone email
      const subject = `🔥 ${milestone}-Day Streak! You're on Fire!`;
      const html = `
<html>
  <body style="font-family: sans-serif;">
    <h1>🔥 ${milestone}-Day Streak!</h1>
    <p>Hi ${user.displayName},</p>
    <p>Amazing! You've reached a <strong>${milestone}-day learning streak</strong>!</p>
    <p>Your consistency is incredible. Keep it up!</p>
  </body>
</html>
      `;

      await db.collection("users").doc(userId).collection("emailQueue").add({
        to: user.email,
        subject,
        html,
        type: "streak_milestone",
        data: { milestone },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
    }
  });
