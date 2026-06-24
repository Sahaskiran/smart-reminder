# Smart Reminder 🚀

A smart daily coding goal tracker with automated email reminders and a multi-user dashboard, integrated with Firebase and LeetCode.

[![Deploy to Render](https://render.com/images/deploy-to-render.button.svg)](https://render.com/deploy?repo=https://github.com/Sahaskiran/smart-reminder)

## Features
- **Multi-User Support**: Firebase Auth registration & login.
- **LeetCode Integration**: Automatically checks daily accepted submissions and syncs historical progress.
- **Dynamic Streak Tracker**: Tracks current & longest streaks since user registration (resets to 0 if a day is missed).
- **Email Reminders**: Sends SMTP reminders and congrats emails directly to each user.
- **Aesthetics**: Glassmorphic dark-mode dashboard with interactive contribution heatmap.

## Quick Cloud Deployment (via GitHub)
1. Click the **Deploy to Render** button above.
2. Render will automatically read the configuration and prompt you for the following environment variables:
   - `EMAIL_FROM`: The Gmail address used to send emails.
   - `EMAIL_APP_PASSWORD`: The 16-character Google App Password for the sender email.
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Copy and paste the entire content of your local `firebase-service-account.json` file.
3. Click **Apply** to deploy!
