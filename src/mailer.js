const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize the email transporter
 */
function initTransporter() {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey && sendgridKey !== 'your-sendgrid-api-key') {
    console.log('[Mailer] ✅ SendGrid API configured for outgoing mail (SMTP disabled)');
    return null;
  }

  const user = process.env.EMAIL_FROM;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass || user === 'your-email@gmail.com') {
    console.warn('[Mailer] ⚠️  Email not configured. Set EMAIL_FROM and EMAIL_APP_PASSWORD (or SENDGRID_API_KEY) in .env');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000,   // 5 seconds
    socketTimeout: 10000     // 10 seconds
  });

  console.log(`[Mailer] ✅ SMTP transporter initialized (${user})`);
  return transporter;
}

/**
 * Unified helper to send email via SendGrid HTTP API or SMTP fallback
 */
async function sendEmail({ to, subject, html }) {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const toEmail = to || process.env.EMAIL_TO;

  if (sendgridKey && sendgridKey !== 'your-sendgrid-api-key') {
    console.log('[Mailer] Attempting email send via SendGrid HTTP API...');
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: toEmail }]
          }],
          from: {
            email: fromEmail,
            name: 'Smart Reminder'
          },
          reply_to: {
            email: fromEmail,
            name: 'Smart Reminder'
          },
          subject: subject,
          content: [
            {
              type: 'text/plain',
              value: html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
            },
            {
              type: 'text/html',
              value: html
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SendGrid API error (${response.status}): ${errText}`);
      }

      console.log('[Mailer] ✅ Email sent successfully via SendGrid API');
      return true;
    } catch (err) {
      console.error('[Mailer] ❌ SendGrid API failed:', err.message);
      return false;
    }
  }

  // Fallback to SMTP
  if (!transporter) {
    initTransporter();
  }
  if (!transporter) {
    console.warn('[Mailer] ❌ Skipping email — no SMTP configuration found');
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Smart Reminder" <${fromEmail}>`,
      replyTo: fromEmail,
      to: toEmail,
      subject,
      text: html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
      html,
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Smart Reminder App'
      }
    });
    console.log(`[Mailer] ✅ Email sent successfully via SMTP: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('[Mailer] ❌ SMTP sending failed:', err.message);
    return false;
  }
}

/**
 * Get a motivational quote for the reminder email
 */
function getMotivationalQuote() {
  const quotes = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Every expert was once a beginner.", author: "Helen Hayes" },
    { text: "Consistency is the key to mastery.", author: "Unknown" },
    { text: "A little progress each day adds up to big results.", author: "Satya Nani" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" }
  ];
  return quotes[Math.floor(Math.random() * quotes.length)];
}

/**
 * Send a reminder email when no activity is detected
 * @param {Object} data - { streak, reminderCount, time }
 */
async function sendReminder(toEmail, data) {
  const quote = getMotivationalQuote();
  const streakEmoji = data.streak > 0 ? '🔥' : '❄️';
  const urgency = data.reminderCount >= 3 ? '🚨 FINAL' : data.reminderCount >= 2 ? '⚠️' : '💡';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f23; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ff6b35 0%, #f72585 50%, #7209b7 100%); padding: 30px 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                    ${urgency} Coding Reminder
                  </h1>
                  <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">
                    ${data.time} — Reminder #${data.reminderCount} of 4
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 40px;">
                  <p style="color: #e0e0e0; font-size: 18px; margin: 0 0 20px; line-height: 1.6;">
                    Hey! You haven't solved any coding problem today yet. 
                    Your ${data.streak > 0 ? `<strong style="color: #ff6b35;">${data.streak}-day streak</strong> ${streakEmoji}` : 'streak'} 
                    is ${data.streak > 0 ? 'on the line!' : 'waiting to begin!'}
                  </p>

                  <!-- Streak Card -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(255,107,53,0.1); border-radius: 12px; border: 1px solid rgba(255,107,53,0.3); margin: 20px 0;">
                    <tr>
                      <td style="padding: 20px; text-align: center;">
                        <p style="color: #ff6b35; font-size: 48px; margin: 0; font-weight: 800;">
                          ${data.streak} ${streakEmoji}
                        </p>
                        <p style="color: #aaa; font-size: 14px; margin: 5px 0 0; text-transform: uppercase; letter-spacing: 2px;">
                          Current Streak
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Action Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center" style="padding: 5px;">
                        <a href="https://leetcode.com/problemset/" style="display: inline-block; background: linear-gradient(135deg, #ffa116 0%, #ff6b35 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          🧩 Open LeetCode
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Quote -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                    <tr>
                      <td style="border-left: 3px solid #7209b7; padding: 15px 20px; background: rgba(114,9,183,0.1); border-radius: 0 8px 8px 0;">
                        <p style="color: #d0d0d0; font-style: italic; margin: 0; font-size: 15px; line-height: 1.5;">
                          "${quote.text}"
                        </p>
                        <p style="color: #888; margin: 8px 0 0; font-size: 13px;">
                          — ${quote.author}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px; background: rgba(0,0,0,0.3); text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
                  <p style="color: #666; font-size: 12px; margin: 0;">
                    Smart Reminder • Solve just one problem to stop reminders
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const cleanUrgency = data.reminderCount >= 3 ? 'FINAL' : data.reminderCount >= 2 ? 'Important' : 'Reminder';
  const subject = `[${cleanUrgency}] You haven't coded today - Streak: ${data.streak} days (Reminder ${data.reminderCount} of 4)`;
  return await sendEmail({ to: toEmail, subject, html });
}

/**
 * Send a congratulatory email when activity is detected after reminders
 * @param {Object} data - { streak, platform, problemTitle }
 */
async function sendStreakUpdate(toEmail, data) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f0f23; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #00b894 0%, #00cec9 50%, #0984e3 100%); padding: 30px 40px; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎉 Task Completed!</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 14px;">Keep going & stay consistent!</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px; text-align: center;">
                  <p style="color: #e0e0e0; font-size: 20px; margin: 0 0 10px; font-weight: 600;">
                    Your daily coding task has been completed!
                  </p>
                  <p style="color: #ccc; font-size: 15px; margin: 0 0 25px; line-height: 1.6;">
                    Great job! You solved a problem on <strong style="color: #00cec9; text-transform: capitalize;">${data.platform}</strong> today.
                    ${data.problemTitle ? `<br>Problem: <strong style="color: #fff;">${data.problemTitle}</strong>` : ''}
                  </p>
                  
                  <!-- Streak Visual -->
                  <table align="center" cellpadding="0" cellspacing="0" style="background: rgba(255,107,53,0.1); border-radius: 12px; border: 1px solid rgba(255,107,53,0.3); margin: 20px auto; width: 80%;">
                    <tr>
                      <td style="padding: 20px; text-align: center;">
                        <p style="color: #ff6b35; font-size: 48px; margin: 0; font-weight: 800;">
                          ${data.streak} 🔥
                        </p>
                        <p style="color: #aaa; font-size: 13px; margin: 5px 0 0; text-transform: uppercase; letter-spacing: 2px;">
                          Current Day Streak
                        </p>
                      </td>
                    </tr>
                  </table>

                  <!-- Motivational section -->
                  <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 30px; padding-top: 25px; text-align: left;">
                    <p style="color: #ff9f43; font-weight: bold; font-size: 15px; margin: 0 0 8px;">💡 Keep Going!</p>
                    <p style="color: #b3b3b3; line-height: 1.6; margin: 0 0 12px; font-size: 14px;">
                      "Every coding problem you solve is another brick in the foundation of your skills. The secret of getting ahead is getting started, and the secret of staying ahead is staying consistent."
                    </p>
                    <p style="color: #b3b3b3; line-height: 1.6; margin: 0; font-size: 14px;">
                      Keep feeding the flame and building your streak. Tomorrow is another opportunity to learn and excel!
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 40px; background: rgba(0,0,0,0.3); text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
                  <p style="color: #666; font-size: 12px; margin: 0;">No more reminders for today ✨</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const subject = `Streak updated! ${data.streak} days and counting - Keep going!`;
  return await sendEmail({ to: toEmail, subject, html });
}

module.exports = {
  initTransporter,
  sendReminder,
  sendStreakUpdate
};
