# Fixing Environment Variable Issue on Vercel

## The Problem
Next.js environment variables with `NEXT_PUBLIC_` prefix are embedded at **build time**, not runtime. This means:
- Just clicking "Redeploy" won't work
- You need to trigger a **new build**

## Solution: Trigger a New Build

### Method 1: Push a New Commit (Easiest)

1. Make a small change to any file (or create an empty commit):
   ```bash
   git commit --allow-empty -m "Trigger rebuild for env vars"
   git push
   ```

2. Vercel will automatically detect the push and build with your new environment variables

### Method 2: Use Vercel CLI

1. Install Vercel CLI if you haven't:
   ```bash
   npm i -g vercel
   ```

2. Link your project:
   ```bash
   vercel link
   ```

3. Deploy with the environment variable:
   ```bash
   vercel --prod
   ```

### Method 3: Delete and Redeploy from Vercel Dashboard

1. Go to your Vercel project
2. Go to **Deployments** tab
3. Find your latest deployment
4. Click three dots (...) → **Delete**
5. Go back to your GitHub repo
6. Push any small change to trigger a fresh deployment

## Verify Environment Variable is Set

Before deploying, double-check in Vercel:

1. Go to your project **Settings** → **Environment Variables**
2. Confirm you see:
   - Name: `NEXT_PUBLIC_APPS_SCRIPT_URL`
   - Value: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
   - Environments: **All three checked** (Production, Preview, Development)

3. If it's not there or incorrect:
   - Click **Edit** or **Add New**
   - Make sure the name is **exactly** `NEXT_PUBLIC_APPS_SCRIPT_URL` (case-sensitive)
   - Paste your Google Apps Script URL
   - Check all environment boxes
   - Click **Save**

## Test After Deployment

1. Visit your site
2. Open browser console (F12)
3. You should NOT see the error about NEXT_PUBLIC_APPS_SCRIPT_URL
4. The app should load normally

## Still Having Issues?

### Check the Build Logs

1. Go to your deployment in Vercel
2. Click on the deployment
3. Go to **Build Logs** tab
4. Look for environment variables being loaded
5. You should see something like:
   ```
   Creating an optimized production build...
   Environment variables detected...
   ```

### Verify in the Browser Console

After deployment, open your browser console and type:
```javascript
console.log(process.env.NEXT_PUBLIC_APPS_SCRIPT_URL)
```

This will show `undefined` because the variable is embedded at build time, but your app should still work.

### Common Mistakes

❌ **Wrong**: Using "Redeploy" button (uses cached build)
✅ **Correct**: Push new commit or delete deployment and push

❌ **Wrong**: Variable name is `APPS_SCRIPT_URL` (missing NEXT_PUBLIC_)
✅ **Correct**: Variable name is `NEXT_PUBLIC_APPS_SCRIPT_URL`

❌ **Wrong**: Not checking all environment checkboxes
✅ **Correct**: All three environments checked (Production, Preview, Development)

❌ **Wrong**: URL is incomplete (missing /exec at the end)
✅ **Correct**: Full URL like `https://script.google.com/macros/s/XXXXX/exec`

