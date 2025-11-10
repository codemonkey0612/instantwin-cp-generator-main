# LINE Login Setup Guide

## Overview
This application uses LINE Login for user authentication. To enable LINE Login, you need to configure it in the LINE Developers console.

## Prerequisites
1. A LINE Developers account
2. A LINE Login channel created in the LINE Developers console

## Configuration Steps

### 1. LINE Developers Console Setup

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your provider (or create one if you don't have one)
3. Create a new channel or select an existing LINE Login channel
4. Note down your **Channel ID** and **Channel Secret**

### 2. Configure Redirect URI

1. In your LINE Login channel settings, go to the "LINE Login" tab
2. Under "Callback URL", add the following URL:
   ```
   https://yourdomain.com/auth/line/callback
   ```
   Replace `yourdomain.com` with your actual domain.

   **Important**: 
   - The callback URL must match exactly (including protocol: `https://`)
   - For local development, you may need to add: `http://localhost:5173/auth/line/callback` (or your local port)
   - You can add multiple callback URLs for different environments

### 3. Configure Firebase Functions

1. Set the following environment variables in Firebase Functions:
   ```bash
   firebase functions:config:set line.channel_id="YOUR_CHANNEL_ID"
   firebase functions:config:set line.channel_secret="YOUR_CHANNEL_SECRET"
   ```

   Or if using Firebase Functions v2 with secrets:
   ```bash
   firebase functions:secrets:set LINE_CHANNEL_ID
   firebase functions:secrets:set LINE_CHANNEL_SECRET
   ```

2. The function `createFirebaseAuthCustomToken` uses these secrets to:
   - Exchange the authorization code for an access token
   - Get user profile information from LINE
   - Create a Firebase Auth custom token

### 4. Update Frontend Configuration

1. Open `web/src/components/campaign/AuthFlow.tsx`
2. Update the `clientId` variable (line 136) with your LINE Channel ID:
   ```typescript
   const clientId = "YOUR_CHANNEL_ID";
   ```

   **Note**: For production, consider moving this to an environment variable.

### 5. Testing

1. Start your development server
2. Navigate to a campaign page
3. Click on "LINEで認証" (Authenticate with LINE)
4. You should be redirected to LINE's authorization page
5. After authorizing, you should be redirected back to your application

## Troubleshooting

### Error: "Invalid redirect_uri value"
- **Cause**: The redirect URI in your code doesn't match what's registered in LINE Developers console
- **Solution**: 
  1. Check that the callback URL in LINE Developers console matches: `https://yourdomain.com/auth/line/callback`
  2. Verify that the protocol (http/https) matches
  3. Ensure there are no trailing slashes or extra characters
  4. Check that the domain matches exactly (including www if applicable)

### Error: "LINE_CHANNEL_ID or LINE_CHANNEL_SECRET not set"
- **Cause**: Firebase Functions secrets are not configured
- **Solution**: Set the secrets as described in step 3 above

### Error: "Invalid state parameter"
- **Cause**: CSRF protection detected a mismatch in the state parameter
- **Solution**: This is a security feature. Clear your browser's localStorage and try again

## Security Notes

1. **Never commit** your Channel Secret to version control
2. Use environment variables or Firebase Secrets for sensitive configuration
3. The state parameter is used for CSRF protection - it's automatically generated and verified
4. Always use HTTPS in production

## Additional Resources

- [LINE Login Documentation](https://developers.line.biz/en/docs/line-login/)
- [LINE Login API Reference](https://developers.line.biz/ja/reference/line-login/)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env)

