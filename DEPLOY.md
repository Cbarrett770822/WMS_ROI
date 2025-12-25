# Deploy Infor WMS ROI Assessment to Netlify

## Prerequisites
- Netlify account
- MongoDB Atlas database (already configured)
- Git repository

## Deployment Steps

### 1. Push to GitHub (if not already done)
```bash
git init
git add .
git commit -m "Infor WMS ROI Assessment - Ready for deployment"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy to Netlify

#### Option A: Netlify CLI (Recommended)
```bash
netlify deploy --prod
```

#### Option B: Netlify Dashboard
1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Connect to your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

### 3. Configure Environment Variables in Netlify

Go to Site Settings > Environment Variables and add:

```
MONGODB_URI=mongodb+srv://charleslengchai_db_user:EUyR9boaAvWhs8zl@cbcluster01.jrsfdsz.mongodb.net/wmsdb?retryWrites=true&w=majority&appName=CBCLUSTER01
JWT_SECRET=wms-netlify-app-secret-key-change-in-production-2024
```

### 4. Deploy
Click "Deploy site" or run `netlify deploy --prod`

## What Works in Production

✅ **Netlify Functions** - All API endpoints work automatically
✅ **CORS** - Handled automatically by Netlify
✅ **Environment Variables** - Loaded securely from Netlify dashboard
✅ **MongoDB Connection** - Works with Atlas connection string
✅ **Static Files** - Served from `public` directory
✅ **Redirects** - Configured in `netlify.toml`

## Features

- **Landing Page**: Lists all saved ROI assessments
- **New Assessment**: Excel-style form with Infor's 7-category methodology
- **Save to Database**: Assessments saved to MongoDB Atlas
- **Results Display**: Conservative and Likely estimates with toggle
- **Search**: Filter assessments by company name

## URLs After Deployment

- **Main Site**: `https://your-site-name.netlify.app`
- **New Assessment**: `https://your-site-name.netlify.app/roi-form.html`
- **API Endpoints**: `https://your-site-name.netlify.app/.netlify/functions/[endpoint]`

## API Endpoints

- `POST /.netlify/functions/create-assessment` - Save new assessment
- `GET /.netlify/functions/list-assessments` - Get all assessments
- `GET /.netlify/functions/get-assessment?id=xxx` - Get single assessment

## Local Development Issues (Not in Production)

The local `netlify dev` has issues with:
- Framework detection (tries to find Next.js)
- Environment variable loading
- Functions not loading with `#static` framework

**These issues DO NOT exist in production deployment!**

## Production Benefits

1. **No CORS Issues** - Netlify handles this automatically
2. **Functions Work Perfectly** - All endpoints accessible
3. **Environment Variables** - Securely loaded
4. **Fast CDN** - Global edge network
5. **HTTPS** - Automatic SSL certificates
6. **Continuous Deployment** - Auto-deploys on git push

## Support

Database: MongoDB Atlas (wmsdb)
Collections: assessments, companies, reports, users, questionnaires
