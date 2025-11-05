# Vercel Deployment Guide

## Prerequisites
- Google Apps Script deployed and published as a web app
- GitHub repository with your code
- Vercel account

## Step 1: Deploy Google Apps Script

1. Open your Google Apps Script project (where your `code.gs` file is)
2. Click **Deploy** > **New deployment**
3. Select type: **Web app**
4. Configure:
   - Description: "VAMAC Visual Production"
   - Execute as: **Me**
   - Who has access: **Anyone** (or **Anyone with Google account** if you want authentication)
5. Click **Deploy**
6. **Copy the Web App URL** - it should look like:
   ```
   https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec
   ```
7. Click **Authorize access** if prompted and grant necessary permissions

## Step 2: Set Up Environment Variable in Vercel

### Option A: Through Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Click on **Settings** tab
3. Click on **Environment Variables** in the left sidebar
4. Add a new environment variable:
   - **Name**: `NEXT_PUBLIC_APPS_SCRIPT_URL`
   - **Value**: Your Google Apps Script URL (from Step 1)
   - **Environment**: Select all (Production, Preview, Development)
5. Click **Save**
6. Go to the **Deployments** tab
7. Find your latest deployment and click the three dots (**...**)
8. Click **Redeploy** to apply the environment variable

### Option B: Through Vercel CLI

```bash
vercel env add NEXT_PUBLIC_APPS_SCRIPT_URL
```
When prompted, paste your Google Apps Script URL.

## Step 3: Verify Deployment

1. After redeployment, visit your Vercel URL
2. Open browser console (F12) and check for errors
3. You should see the app load without "Invalid URL" errors
4. Test basic functionality:
   - View Mode should display
   - Try accessing Admin Mode with code: `423323`
   - Try Stage Mode

## Common Issues

### Issue: "Failed to construct 'URL': Invalid URL"
**Solution**: The environment variable is not set or is empty. Follow Step 2 again.

### Issue: "CORS Error" or "Access Denied"
**Solution**: 
1. Redeploy your Google Apps Script
2. Make sure "Who has access" is set to "Anyone"
3. Make sure you've authorized the script

### Issue: "Script not found" or 404 errors
**Solution**: 
1. Double-check your Google Apps Script URL
2. Make sure it ends with `/exec` not `/dev`
3. Redeploy your script if you made changes

### Issue: Changes not reflected after redeployment
**Solution**:
1. For Google Apps Script changes: Create a **New deployment** (not manage deployments)
2. For Vercel changes: Use "Redeploy" button, not just pushing code

## Testing Locally with Vercel Environment

If you want to test locally with the same setup as Vercel:

1. Make sure your `.env.local` has:
   ```
   NEXT_PUBLIC_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
2. Restart your development server:
   ```bash
   npm run dev
   ```

## Security Note

The `NEXT_PUBLIC_` prefix means this variable is exposed to the client (browser). This is necessary for client-side API calls but means anyone can see your Google Apps Script URL. 

To secure your application:
1. In Google Apps Script, you can add authentication checks
2. Consider adding rate limiting
3. Monitor the Apps Script execution logs for abuse

## Need Help?

- Check Vercel logs: Go to your deployment > **Logs** tab
- Check Google Apps Script logs: In Apps Script editor > **Executions** tab
- Verify environment variables are set: Vercel project > **Settings** > **Environment Variables**

