# AtherixCloud VPS Manager

A powerful, dark-blue themed VPS management panel built with Node.js, using LXC containers.

## 🚀 Quick Start

### Prerequisites
- Ubuntu VPS with LXC installed
- MongoDB 
- Node.js v18+

### Install LXC on Ubuntu
```bash
apt-get update && apt-get install -y lxc lxc-templates lxc-dev libvirt0
```

### Setup
```bash
# 1. Install dependencies
npm install

# 2. Edit .env (MongoDB URI, etc.)
nano .env

# 3. Start the server
npm start
# Or for development:
npm run dev
```

### Default Credentials
- **Admin Email:** ameriyadarsh@gmail.com
- **Admin Password:** darshv12

## 📋 Features

### User Features
- Create account & login
- View assigned VPS instances
- Start/Stop/Restart VPS
- Open & reply to support tickets

### Admin Features
- Dashboard with real-time statistics
- Create LXC containers for users (with nesting, KVM, FUSE, Docker support)
- Manage all users (suspend/activate/delete)
- Manage all VPS containers
- Handle all support tickets with replies

## 🐧 LXC Container Support
Created containers support:
- **Nesting** — LXC-in-LXC
- **KVM** — Hardware virtualization
- **FUSE** — Filesystem in userspace
- **Docker** — Full Docker support (via AppArmor unconfined + nesting)

## ⚙️ LXC Configuration
The panel auto-generates LXC config with proper cgroup2 settings for CPU, memory limits, and enables the requested features.

## 📁 Project Structure
```
atherixcloud/
├── server.js           # Main entry point
├── .env                # Environment variables
├── config/
│   ├── passport.js     # Auth config
│   └── lxc.js          # LXC manager
├── middleware/
│   └── auth.js         # Auth middleware
├── models/
│   ├── User.js
│   ├── VPS.js
│   └── Ticket.js
├── routes/
│   ├── auth.js
│   ├── dashboard.js
│   ├── vps.js
│   ├── tickets.js
│   └── admin.js
├── views/
│   ├── auth/
│   ├── user/
│   ├── admin/
│   └── partials/
└── public/
    ├── css/style.css
    └── js/app.js
```

## 🔒 Security Notes
- Passwords are hashed with bcryptjs (12 rounds)
- Session-based auth with passport.js
- Admin routes are protected with role middleware
- LXC operations run on the host system (run with appropriate privileges)

## 📝 Environment Variables
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/atherixcloud
SESSION_SECRET=your_secret_here
ADMIN_EMAIL=ameriyadarsh@gmail.com
ADMIN_PASSWORD=darshv12
```
