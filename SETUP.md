# Dreamscape: setup in 4 steps

## 1. Make the database (5 minutes, free)
1. Go to https://neon.tech and sign up (GitHub login works).
2. Create a project. Copy the **connection string**. It starts with `postgresql://`.
   (Supabase works too: Project Settings -> Database -> Connection string.)

## 2. Update the server (GitHub repo `dreamscape-server`, then Render)
1. In the repo, delete `database.js` and `database.sqlite` if they are there.
2. Upload everything from the `server` folder (replace `index.js` and `package.json`).
3. In Render -> your service -> **Environment**, add:
   - `DATABASE_URL` = the connection string from step 1
   - `SESSION_SECRET` = any long random text (30+ characters)
   - `FRONTEND_URL` = `https://dreamscape-web-five.vercel.app`
   - `ADMIN_EMAIL` = your own email (the account with this email becomes admin when it signs up)
4. Render redeploys by itself. In **Logs** you should see: `Dreamscape server running on port ...`

## 3. Update the website (GitHub repo `dreamscape-web`, then Vercel)
1. Upload everything from the `website` folder into the repo (replace the files).
2. Do NOT delete your own `auth.js`, `script.js`, `welcome.js` if the repo has them.
   `env-config.js` is no longer used; you can delete it.
3. `vercel.json` is new and important: it sends `/api/...` to your Render server.
4. Vercel redeploys by itself.

## 4. Test
Open https://dreamscape-web-five.vercel.app/signup.html, create an account, log out, log in again.
The first request after a pause can take up to a minute (free Render sleeps); the page says so.
Old accounts from the old SQLite file are not copied; people need to sign up again.
