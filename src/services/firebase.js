const logger = require('./logger');

let firebaseAdmin = null;

function getFirebaseAdmin() {
  if (!firebaseAdmin) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    firebaseAdmin = admin;
  }
  return firebaseAdmin;
}

async function sendJobAlert(fcmToken, job) {
  try {
    const admin = getFirebaseAdmin();
    return admin.messaging().send({
      token: fcmToken,
      notification: {
        title: `New Job: ${job.title}`,
        body: `R${job.budget} - ${job.location}`,
      },
      data: { jobId: job.id, type: 'NEW_JOB' },
    });
  } catch (error) {
    logger.warn({ error: error.message, token: fcmToken.slice(-8) }, 'FCM send failed');
    return null;
  }
}

async function broadcastToUsers(users, job) {
  const messages = users
    .filter((u) => u.fcmToken)
    .map((u) => sendJobAlert(u.fcmToken, job));
  const results = await Promise.allSettled(messages);
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  logger.info({ jobId: job.id, sent, total: users.length }, 'Job broadcast notifications sent');
  return { sent, total: users.length };
}

module.exports = { sendJobAlert, broadcastToUsers };
