# Concurrent Ticket Booking System (Node.js + Redis)

A production-style ticket booking backend that prevents double-booking under high concurrency using Redis atomic operations and seat locks.

## Stack
- Node.js 18+
- Express.js
- Redis
- Artillery (load testing)

## Features
- Atomic seat lock (`/api/lock`) with lock TTL
- Confirm booking (`/api/confirm`) only if lock owner matches
- Cancel lock (`/api/cancel`)
- High-concurrency one-step booking endpoint (`/api/book`)
- Event initialization and status endpoints
- Docker + Docker Compose support
- Render deployment blueprint (`render.yaml`)

## Project Structure

```txt
.
├── src
│   ├── redis.js
│   ├── seatService.js
│   └── server.js
├── scripts
│   ├── seed-event.js
│   └── load-test.yml
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── .env.example
└── README.md
```

## Local Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start Redis (choose one):
```bash
docker run --name booking-redis -p 6379:6379 -d redis:7-alpine
```
or
```bash
docker compose up redis -d
```

4. Start API:
```bash
npm run dev
```

API runs at `http://localhost:3000`.

## Full Docker Run
```bash
docker compose up --build
```

## API Endpoints

### 1) Initialize Event
```http
POST /api/events/:eventId/init
Content-Type: application/json

{ "totalSeats": 100 }
```

### 2) Event Status
```http
GET /api/events/:eventId/status
```

### 3) Lock a Seat
```http
POST /api/lock
Content-Type: application/json

{
  "eventId": "concert-2026",
  "seatId": "S1",
  "userId": "user-a"
}
```

### 4) Confirm Locked Seat
```http
POST /api/confirm
Content-Type: application/json

{
  "eventId": "concert-2026",
  "seatId": "S1",
  "userId": "user-a"
}
```

### 5) Cancel Seat Lock
```http
POST /api/cancel
Content-Type: application/json

{
  "eventId": "concert-2026",
  "seatId": "S1",
  "userId": "user-a"
}
```

### 6) One-Step Atomic Booking (High Concurrency)
```http
POST /api/book
Content-Type: application/json

{ "eventId": "concert-2026" }
```

Response example:
```json
{
  "success": true,
  "bookingId": "BK-1718369248709-3nf0m3m8y7zw",
  "seatId": "S42",
  "remaining": 99
}
```

## Load Testing (Artillery)

1. Ensure API + Redis are running.
2. Run:
```bash
TARGET_URL=http://localhost:3000 npm run test:load
```

This uses `scripts/load-test.yml` to fire concurrent booking requests and validate that seats never overbook.

## Push to GitHub

Run these commands in this folder:

```bash
git init
git add .
git commit -m "Initial commit: concurrent ticket booking with Redis locking"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy and Get Demo Link (Render)

### Option A: Blueprint deploy (recommended)
1. Push code to GitHub.
2. Open [Render](https://render.com/) and click **New +** -> **Blueprint**.
3. Select your repository.
4. Render will read `render.yaml` and create:
   - Web Service (Node API)
   - Redis instance
5. Deploy.
6. Your demo link will look like:
   - `https://concurrent-ticket-booking-api.onrender.com`

### Option B: Manual deploy
1. Create Redis service in Render.
2. Create Web Service for this repo.
3. Set env var `REDIS_URL` from Redis connection string.
4. Set start command: `npm start`.

## Quick Demo Checklist
- `GET /` returns service metadata and event counts.
- Repeated `/api/book` eventually returns `No seats left` when all seats are booked.
- Lock flow:
  - `/api/lock` by user A succeeds
  - `/api/confirm` by user B fails (not lock owner)
  - `/api/confirm` by user A succeeds

## Notes on Concurrency Safety
- Lua scripts execute atomically in Redis, preventing race conditions across concurrent requests.
- Lock keys include TTL to avoid deadlocks from abandoned sessions.
- One-step booking uses atomic pop from available seats set to avoid duplicate allocation.
