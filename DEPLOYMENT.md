# 🚀 Deploying AI Summarizer Pro to Render

This guide will walk you through deploying both the frontend and backend of the AI Summarizer Pro application to Render.

## Prerequisites

- [Render account](https://render.com) (free tier available)
- GitHub account with your repository
- OpenAI API key

---

## 📦 Part 1: Deploy Backend (Web Service)

### Step 1: Create PostgreSQL Database

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name:** `ai-summarizer-db`
   - **Database:** `summarizer`
   - **User:** `summarizer` (or leave default)
   - **Region:** Choose closest to you
   - **Plan:** Free
4. Click **"Create Database"**
5. **Wait** for database to be created (takes ~1-2 minutes)
6. **Copy** the **Internal Database URL** (you'll need this for the web service)

### Step 2: Create Backend Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your **GitHub repository**
3. Configure the service:

**Basic Settings:**
- **Name:** `ai-summarizer-backend` (or your preferred name)
- **Region:** Same as your database
- **Branch:** `main` (or your branch name)
- **Root Directory:** `backend`
- **Runtime:** `Python 3`

**Build & Deploy:**
- **Build Command:** `./build.sh`
- **Start Command:** `gunicorn config.wsgi:application`

4. Click **"Advanced"** and add Environment Variables:

```
DJANGO_SECRET_KEY=<generate-a-secure-random-key>
DEBUG=False
ALLOWED_HOSTS=<your-service-name>.onrender.com
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

**To generate Django secret key:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

5. **Link Database:**
   - In Environment Variables, click **"Add Environment Variable"**
   - Find the database you created
   - Render will automatically add `DATABASE_URL`

6. Click **"Create Web Service"**

7. **Wait** for deployment (first deploy takes 5-10 minutes)

8. **Copy your backend URL:** `https://ai-summarizer-backend.onrender.com`

### Step 3: Update CORS Settings

After frontend is deployed, you'll need to update `CORS_ALLOWED_ORIGINS`:

1. Go to your backend service
2. Navigate to **Environment** tab
3. Update `CORS_ALLOWED_ORIGINS` to:
   ```
   https://your-frontend-name.onrender.com
   ```
4. Save changes (service will redeploy automatically)

---

## 🎨 Part 2: Deploy Frontend (Static Site)

### Step 1: Create Static Site

1. Click **"New +"** → **"Static Site"**
2. Connect your **GitHub repository**
3. Configure:

**Basic Settings:**
- **Name:** `ai-summarizer-frontend`
- **Region:** Same as backend
- **Branch:** `main`
- **Root Directory:** `frontend` (or leave empty)

**Build Settings:**
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist` (if Root Directory is `frontend`) or `frontend/dist` (if Root Directory is empty)

4. Add Environment Variable:
   - **Key:** `VITE_API_URL`
   - **Value:** `https://ai-summarizer-backend.onrender.com/api`
   (Use your actual backend URL from Part 1)

5. Click **"Create Static Site"**

6. **Wait** for build and deployment (3-5 minutes)

7. **Copy your frontend URL:** `https://ai-summarizer-frontend.onrender.com`

### Step 2: Update Backend CORS

Now go back to your backend service and update the `CORS_ALLOWED_ORIGINS` environment variable with your frontend URL (as mentioned in Part 1, Step 3).

---

## ✅ Part 3: Verify Deployment

### Test Your Application

1. Visit your frontend URL: `https://ai-summarizer-frontend.onrender.com`

2. **Test Document Summarization:**
   - Click on "AI Summarizer" tab
   - Upload a PDF or TXT file
   - Verify you receive a summary

3. **Test Chat with Document:**
   - Click on "Chat with Document" tab
   - Upload a document
   - Ask a question
   - Verify you receive an answer

### Troubleshooting

**Backend Issues:**

- **"Application Failed to Respond"**
  - Check logs: Backend service → Logs tab
  - Verify `DATABASE_URL` is set
  - Verify `OPENAI_API_KEY` is set correctly

- **"Failed to connect to database"**
  - Ensure PostgreSQL database is created and running
  - Check `DATABASE_URL` environment variable

- **Static files not loading:**
  - Check that `./build.sh` ran successfully in logs
  - Verify whitenoise is installed

**Frontend Issues:**

- **"Failed to fetch" or CORS errors**
  - Verify `VITE_API_URL` points to correct backend URL
  - Check backend `CORS_ALLOWED_ORIGINS` includes your frontend URL
  - Rebuild frontend after changing environment variables

- **Blank page:**
  - Check browser console for errors
  - Verify build succeeded in Render logs
  - Check that publish directory is set to `dist`

**OpenAI API Issues:**

- **"AI service not configured"**
  - Verify `OPENAI_API_KEY` is set in backend environment variables
  - Check API key is valid and has credits
  - Verify no extra quotes around the API key

---

## 🔄 Updating Your Deployment

### Auto-Deploy (Recommended)

Render automatically deploys when you push to your connected branch:

```bash
git add .
git commit -m "your changes"
git push origin main
```

Both frontend and backend will redeploy automatically.

### Manual Deploy

1. Go to your service in Render Dashboard
2. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 💰 Free Tier Limits

**Render Free Tier:**
- Backend (Web Service): Free up to 750 hours/month
- Frontend (Static Site): Free with 100GB bandwidth/month
- PostgreSQL: Free with 1GB storage
- **Note:** Free services sleep after 15 minutes of inactivity (first request takes ~30 seconds to wake up)

**Upgrading:**
- Paid plans start at $7/month for web services
- Eliminates sleep time
- More resources and uptime

---

## 🔐 Security Checklist

Before deploying, verify:

- [ ] `.env` files are NOT in Git repository
- [ ] `DEBUG=False` in production
- [ ] Unique `DJANGO_SECRET_KEY` for production
- [ ] OpenAI API key is set as environment variable (not hardcoded)
- [ ] CORS is restricted to your frontend domain only
- [ ] HTTPS is enforced (Render does this automatically)

---

## 📊 Monitoring

**Backend Logs:**
- Go to backend service → **Logs** tab
- View real-time application logs
- Check for errors

**Frontend Logs:**
- Go to static site → **Logs** tab
- View build logs

**Database:**
- Go to database → **Metrics** tab
- Monitor storage, connections

---

## 🆘 Getting Help

**Render Support:**
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

**Application Issues:**
- Check application logs in Render
- Review error messages in browser console
- Verify all environment variables are set

---

## 🎉 Success!

Your AI Summarizer Pro application is now live and accessible at:
- **Frontend:** `https://your-frontend-name.onrender.com`
- **Backend API:** `https://your-backend-name.onrender.com/api`

Share your deployed application with others! 🚀

---

## 🔄 Next Steps

1. **Custom Domain** (Optional):
   - Go to service → Settings → Custom Domain
   - Add your domain and configure DNS

2. **Monitoring:**
   - Set up uptime monitoring (e.g., UptimeRobot)
   - Monitor API usage on OpenAI dashboard

3. **Scaling:**
   - Upgrade to paid plan when needed
   - Add Redis for caching (optional)
   - Implement rate limiting

---

**Note:** First deployment can take 10-15 minutes. Subsequent deployments are faster (2-5 minutes).
