# Environment Variables

This project requires the following environment variable to be set:

## Required Variables

### `NEXT_PUBLIC_APPS_SCRIPT_URL`

**Description**: The URL of your deployed Google Apps Script web app.

**Format**: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`

**Where to set it**:

1. **Local Development**: Create a `.env.local` file in the root directory:
   ```
   NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```

2. **Vercel Production**: 
   - Go to your project in Vercel Dashboard
   - Settings → Environment Variables
   - Add variable name: `NEXT_PUBLIC_APPS_SCRIPT_URL`
   - Add your Google Apps Script URL as the value
   - Select all environments (Production, Preview, Development)
   - Redeploy your application

**How to get your Google Apps Script URL**:
1. Open your Google Apps Script project
2. Click **Deploy** → **New deployment**
3. Choose **Web app**
4. Set "Execute as" to **Me**
5. Set "Who has access" to **Anyone**
6. Click **Deploy**
7. Copy the Web App URL

## Troubleshooting

If you see errors like:
- `Failed to construct 'URL': Invalid URL`
- `NEXT_PUBLIC_APPS_SCRIPT_URL is not set`

This means the environment variable is not configured properly. Follow the steps above to set it correctly.

**Note**: After setting environment variables in Vercel, you must redeploy your application for the changes to take effect.

