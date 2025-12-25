# Quick Deployment Guide

## 🚀 Deploy to Netlify in 5 Minutes

### Step 1: Prepare MongoDB Atlas

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create a free account and cluster
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database password
6. Add `/wms_roi` before the `?` in the URL

Example: `mongodb+srv://username:password@cluster.mongodb.net/wms_roi?retryWrites=true&w=majority`

### Step 2: Deploy to Netlify

#### Method 1: Drag & Drop (Easiest)

1. Run locally first to test:
```bash
npm install
```

2. Create `.env` file with your MongoDB URI:
```
MONGODB_URI=your-connection-string-here
JWT_SECRET=any-random-secret-key-here
```

3. Go to https://app.netlify.com/drop
4. Drag the entire `roi-warehouse-assessment` folder
5. After deployment, go to Site Settings → Environment Variables
6. Add your environment variables:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NODE_ENV` = `production`
7. Trigger a redeploy

#### Method 2: GitHub Integration (Recommended)

1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-github-repo-url
git push -u origin main
```

2. Go to https://app.netlify.com
3. Click "New site from Git"
4. Choose GitHub and select your repository
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
6. Click "Show advanced" → "New variable"
7. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Any random secret (e.g., `wms-roi-secret-2024`)
   - `NODE_ENV`: `production`
8. Click "Deploy site"

### Step 3: Test Your Deployment

1. Wait for deployment to complete (usually 1-2 minutes)
2. Click on the provided URL (e.g., `https://your-site-name.netlify.app`)
3. Fill out the questionnaire form
4. Submit and verify ROI calculations appear

### Step 4: Custom Domain (Optional)

1. In Netlify dashboard, go to Domain Settings
2. Click "Add custom domain"
3. Follow instructions to configure DNS

## 🔧 Environment Variables Explained

### MONGODB_URI
Your MongoDB Atlas connection string. Format:
```
mongodb+srv://username:password@cluster.mongodb.net/wms_roi?retryWrites=true&w=majority
```

### JWT_SECRET
Any random string for securing tokens. Generate one:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### NODE_ENV
Set to `production` for deployed sites, `development` for local testing.

## 📊 Monitoring

### View Function Logs
1. Go to Netlify dashboard
2. Click on your site
3. Go to "Functions" tab
4. Click on any function to see logs

### Check Database
1. Go to MongoDB Atlas dashboard
2. Click "Browse Collections"
3. View stored assessments in `wms_roi` database

## 🐛 Common Issues

### "Cannot connect to database"
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for testing)
- Verify connection string is correct
- Ensure database user has read/write permissions

### "Function timeout"
- MongoDB Atlas free tier may be slow on first request
- Subsequent requests will be faster due to connection caching

### "CORS errors"
- Already configured in `netlify.toml`
- If issues persist, check browser console for specific error

## 🎯 Next Steps

1. **Customize Branding**: Edit `public/index.html` to add your logo and colors
2. **Add Analytics**: Integrate Google Analytics or similar
3. **Email Notifications**: Add email service to send results to users
4. **PDF Export**: Add PDF generation for ROI reports
5. **Admin Dashboard**: Create admin interface to view all assessments

## 📞 Need Help?

- Check Netlify function logs for backend errors
- Check browser console for frontend errors
- Verify all environment variables are set correctly
- Test MongoDB connection string locally first
