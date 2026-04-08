const logger = require('./logger');

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendOtp(phone, code) {
  try {
    const client = getTwilioClient();
    await client.messages.create({
      body: `Your ISPANI verification code is: ${code}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    logger.info({ phone: phone.slice(-4) }, 'OTP sent');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send OTP');
    throw error;
  }
}

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return `+27${cleaned.slice(1)}`;
  if (cleaned.startsWith('27')) return `+${cleaned}`;
  return `+${cleaned}`;
}

module.exports = { sendOtp, generateOtpCode, normalizePhone };
