# 🚀 Deployment Guide for Render

This guide will help you deploy your CoolieAssistant app to Render (100% free tier).

## 📋 Prerequisites

1. **GitHub Repository**: Push your code to GitHub
2. **Firebase Project**: Set up Firebase Authentication
3. **Supabase Project**: Set up Supabase database
4. **Render Account**: Sign up at [render.com](https://render.com)

## 🔧 Environment Variables Setup

### Backend Environment Variables (Web Service)

Add these in Render Dashboard → Your Service → Environment:

```bash
# Required
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Optional (for Gmail integration)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_OAUTH_REDIRECT_URI=https://your-backend.onrender.com/api/oauth/google/callback

# Optional (for n8n webhooks)
N8N_WEBHOOK_URL=http://localhost:5678/webhook-test
N8N_WHATSAPP_WEBHOOK=http://localhost:5678/webhook-test/whatsapp-mcp
N8N_GMAIL_WEBHOOK=http://localhost:5678/webhook-test/gmail-action
```

### Frontend Environment Variables (Static Site)

Add these in Render Dashboard → Your Service → Environment:

```bash
# Required
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# This will be auto-set by Render
VITE_API_URL=https://your-backend.onrender.com
```

## 🚀 Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Push your code** to GitHub with the `render.yaml` file
2. **Go to Render Dashboard** → New → Blueprint
3. **Connect your GitHub repo**
4. **Render will automatically detect** the `render.yaml` and create both services
5. **Add environment variables** in each service's Environment tab
6. **Deploy!**

### Option 2: Manual Deployment

#### Deploy Backend (Web Service)

1. **Go to Render Dashboard** → New → Web Service
2. **Connect GitHub** and select your repository
3. **Configure**:
   - **Name**: `coolie-assistant-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. **Add environment variables** (see above)
5. **Create Web Service**

#### Deploy Frontend (Static Site)

1. **Go to Render Dashboard** → New → Static Site
2. **Connect GitHub** and select your repository
3. **Configure**:
   - **Name**: `coolie-assistant-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist/public`
4. **Add environment variables** (see above)
5. **Create Static Site**

## 🔗 Service URLs

After deployment, you'll get:

- **Backend**: `https://coolie-assistant-backend.onrender.com`
- **Frontend**: `https://coolie-assistant-frontend.onrender.com`

## 🧪 Testing Your Deployment

1. **Visit your frontend URL**
2. **Try logging in** with Firebase Auth
3. **Create a test reminder**
4. **Check if tasks load** properly
5. **Test notifications** (if browser allows)

## 🐛 Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure `FRONTEND_URL` is set in backend environment
2. **Firebase Errors**: Verify all Firebase environment variables are correct
3. **Database Errors**: Check Supabase URL and service role key
4. **Build Failures**: Check Node.js version compatibility

### Debug Steps:

1. **Check Render logs** in the service dashboard
2. **Verify environment variables** are set correctly
3. **Test API endpoints** directly using the backend URL
4. **Check browser console** for frontend errors

## 📝 Notes

- **Free tier limitations**: Services sleep after 15 minutes of inactivity
- **Cold starts**: First request after sleep may take 30+ seconds
- **Environment variables**: Keep sensitive data secure, never commit to git
- **Custom domains**: Available on paid plans

## 🔄 Updates

To update your deployment:

1. **Push changes** to your GitHub repository
2. **Render will automatically redeploy** (if auto-deploy is enabled)
3. **Or manually trigger** deployment from Render dashboard

## 🆘 Support

If you encounter issues:

1. **Check Render documentation**: [render.com/docs](https://render.com/docs)
2. **Review logs** in Render dashboard
3. **Test locally** with production environment variables
4. **Check GitHub issues** for similar problems
