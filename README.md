# Taskboard

A full-stack task tracker. Users register, sign in, and manage their own tasks.

**Stack:** React 18 (Vite, React Router) · Node + Express · MongoDB (Mongoose) · JWT auth

## Features
- Register / sign in with hashed passwords (bcrypt) and 7-day JWT sessions
- Create, complete, categorize, search, sort, reorder, and delete tasks
- Set priorities, notes, due dates, and daily or weekly recurrence
- See overdue reminders, weekly progress, completed-task streaks, and dashboard stats
- Opt in to browser notifications at 9 AM the day before and on the due date (while Taskboard is open)
- Each user sees only their own tasks
- Vite dev proxy, so the client calls `/api/*` with no CORS setup in development

## Project structure
```
taskboard/
├── client/   React app (Vite)
└── server/   Express API + Mongoose models
```

## Run locally
Requires Node 20+ and a MongoDB instance (local or Atlas).

```bash
npm run install:all
cp server/.env.example server/.env   # then edit MONGO_URI and JWT_SECRET
npm run dev
```
- Web: http://localhost:5173
- API: http://localhost:5000

## API
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | no | Create account |
| POST | /api/auth/login | no | Sign in |
| GET | /api/auth/me | yes | Current user |
| GET | /api/tasks | yes | List tasks |
| POST | /api/tasks | yes | Create task |
| PATCH | /api/tasks/:id | yes | Update task |
| DELETE | /api/tasks/:id | yes | Delete task |

## Check the API with Postman
1. Start the app with `npm run dev`.
2. In Postman, choose **Import** and select `postman/Taskboard API.postman_collection.json`.
3. If the API uses a different host or port, edit the collection variable `baseUrl` (default: `http://localhost:5000/api`).
4. Open the collection and click **Run**. Run the requests in their listed order so the collection can save tokens and task IDs between requests.

The run creates two uniquely named test accounts and removes the test tasks at the end. The accounts remain in MongoDB; delete the `postman-...@example.test` accounts manually if desired.

## Deploy
- **Frontend:** Vercel/Netlify. Root `client`, build `npm run build`, output `dist`. Point `/api` to your backend (rewrite rule) or change the fetch base URL in `client/src/api.js`.
- **Backend:** Render/Railway. Root `server`, start `npm start`. Set `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`.
