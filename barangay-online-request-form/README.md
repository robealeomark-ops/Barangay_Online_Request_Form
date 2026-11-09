# Barangay Online Request Form

A starter full-stack CRUD web application for the project proposal **"Design and Development of Barangay Online Request Form."**

## Features

- Public online form for barangay document requests
- MongoDB Atlas storage through Mongoose
- Admin login using environment variables and server-side sessions
- Admin dashboard with request search and status filter
- CRUD: create, read, update, and delete requests
- Request status tracking: Pending, Processing, Ready for Pickup, Completed, Rejected
- Responsive layout for desktop and mobile
- Basic security headers, session cookies, input validation, and submission rate limiting

## Requirements

- Node.js 20 or newer
- VS Code
- MongoDB Atlas account
- Git and GitHub account
- Render account

## 1. Open the project in VS Code

Extract the ZIP file. In VS Code, select **File > Open Folder** and choose `barangay-online-request-form`.

Open Terminal > New Terminal.

## 2. Install packages

```bash
npm install
```

## 3. Create a MongoDB Atlas database

1. Sign in at https://www.mongodb.com/atlas.
2. Create a free cluster.
3. Create a database user and password.
4. In Network Access, allow access from Render. For a student project, `0.0.0.0/0` is the common Render setup; use a strong database password and least-privilege database user.
5. Select Connect > Drivers > Node.js and copy the connection string.
6. Replace the username, password, and database name in the connection string.

Example format:

```text
mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/barangay_requests?retryWrites=true&w=majority
```

If your password contains special characters, URL-encode them.

## 4. Configure environment variables

Copy `.env.example` and rename the copy to `.env`.

Add your actual values:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_connection_string
SESSION_SECRET=use-a-long-random-secret-value
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-unique-password
```

Do not upload `.env` to GitHub. It is excluded by `.gitignore`.

## 5. Run locally

```bash
npm run dev
```

Open:

- Resident form: http://localhost:3000
- Admin dashboard: http://localhost:3000/admin

Log in using the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values in your `.env` file.

## 6. Connect to GitHub

Create a new empty repository on GitHub. In the VS Code terminal, run:

```bash
git init
git add .
git commit -m "Initial Barangay Online Request Form"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the GitHub URL with your own repository URL. Check that `.env` is not included in the files being pushed.

## 7. Deploy using Render

1. Sign in at https://render.com.
2. Choose **New + > Web Service**.
3. Connect your GitHub account and select this repository.
4. Configure:
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Under Environment, add:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = your Atlas connection string
   - `SESSION_SECRET` = a long random secret
   - `ADMIN_USERNAME` = your chosen admin username
   - `ADMIN_PASSWORD` = your strong admin password
6. Click **Create Web Service** and wait for deployment.
7. Open the Render URL. Test the resident form and `/admin`.

Render supplies the port through `process.env.PORT`; the app is configured to use it.

## API routes

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/requests` | Public | Create request |
| GET | `/api/requests` | Admin | Read/filter all requests |
| GET | `/api/requests/:id` | Admin | Read one request |
| PUT | `/api/requests/:id` | Admin | Update request |
| DELETE | `/api/requests/:id` | Admin | Delete request |
| POST | `/api/admin/login` | Public | Admin login |
| POST | `/api/admin/logout` | Admin | Admin logout |
| GET | `/api/admin/session` | Public | Check login session |
| GET | `/api/health` | Public | Basic health/database status |

## Database collection

Mongoose creates a `requests` collection. Each record stores:

- referenceNumber
- fullName
- email
- contactNumber
- address
- documentType
- purpose
- notes
- status
- createdAt and updatedAt

## Important notes before real barangay use

This is a functional academic starter, not a fully audited government production system. Before handling real residents' personal information, add a privacy notice and retention policy, CSRF protection, stronger administrator account management, audit logs, backups, and HTTPS-only production settings. Restrict database network access where practical. Never commit credentials or real resident data to GitHub.

The admin credentials in this starter are configured through Render environment variables. For a multi-admin production system, use hashed passwords and a proper user-management flow.
