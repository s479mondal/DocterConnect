# MediConnect – Doctor Patient Management System (2026)
## Complete Project Explanation & Technical Interview Mastery Guide

---

## 1. Project Overview & System Architecture

### What is MediConnect?
**MediConnect** is an enterprise-grade, microservice-based **Healthcare Management & Appointment Booking Platform** built using the **MERN Stack** (MongoDB, Express.js, React, Node.js). 

It allows **Patients** to search for doctors, book time slots, make online payments, and view medical records; **Doctors** to manage availability, accept/reject appointments, and view patient histories; and **Admins** to verify doctor credentials and oversee global platform activity.

### Architectural Breakdown

```
                             ┌───────────────────────┐
                             │   React Frontend      │
                             │ (Vite / Single Page) │
                             └───────────┬───────────┘
                                         │ HTTP / REST
                                         ▼
                             ┌───────────────────────┐
                             │      API Gateway      │ (Port 3000)
                             │ - Rate Limiting       │
                             │ - JWT Verification    │
                             │ - Request Proxying    │
                             └───────────┬───────────┘
                                         │ Forward Header (X-User-Id, X-User-Role)
        ┌───────────────────┬────────────┼───────────────────┐
        ▼                   ▼            ▼                   ▼
┌──────────────┐    ┌──────────────┐  ┌──────────────┐    ┌────────────────────┐
│ User Service │    │Doctor Service│  │ Appointment  │    │Notification Service│
│ (Port 3001)  │    │ (Port 3002)  │  │   Service    │    │    (Port 3004)     │
│              │    │              │  │ (Port 3003)  │    │                    │
│ - Auth/JWT   │    │ - Profiles   │  │ - Booking    │    │ - Email / SMS      │
│ - RBAC Roles │    │ - Schedules  │  │ - Slot Lock  │    │ - Event Consumers  │
│ - Users DB   │    │ - Doctors DB │  │ - Razorpay   │    │                    │
└───────┬──────┘    └───────┬──────┘  └──────┬───────┘    └─────────▲──────────┘
        │                   │                │                      │
        ▼                   ▼                ▼                      │ RabbitMQ
  ┌───────────┐       ┌───────────┐    ┌───────────┐                │ Event Bus
  │ MongoDB   │       │ MongoDB   │    │  MongoDB  │                │
  │ User DB   │       │ Doctor DB │    │ Appt DB   │                │
  └───────────┘       └───────────┘    └─────┬─────┘                │
                                             │                      │
                                       ┌─────┴──────┐               │
                                       │ Redis Cache├───────────────┘
                                       └────────────┘
```

---

## 2. Deep Dive: Key Technical Components

### A. API Gateway & Request Flow
- **Central Entry Point:** All incoming requests from the frontend pass through an **API Gateway** (`http-proxy-middleware`).
- **Security Middleware:** Uses `helmet` for HTTP security headers, `cors` for cross-origin request policies, and `express-rate-limit` to prevent DDoS/brute-force attacks (1000 requests per 15-minute window).
- **Header Injection:** When the API Gateway verifies a JWT, it extracts the decoded payload (`userId`, `role`, `email`) and attaches them to custom headers (`X-User-Id`, `X-User-Role`, `X-User-Email`) before proxying downstream to microservices.

### B. Authentication & Role-Based Access Control (RBAC)
- **Authentication:** Password hashing using `bcryptjs` (salt rounds = 10) and stateless authentication using JSON Web Tokens (`jsonwebtoken`).
- **JWT Payload Structure:**
  ```json
  {
    "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
    "email": "doctor.john@example.com",
    "role": "doctor",
    "iat": 1690000000,
    "exp": 1690086400
  }
  ```
- **RBAC Enforcement:**
  - **Patient:** Can search doctors, reserve slot, initiate Razorpay payment, view personal medical record history.
  - **Doctor:** Can manage slot availability schedule, accept/complete appointments, update patient medical notes.
  - **Admin:** Access unverified doctor listings, execute `PATCH /api/doctors/admin/:id/verify`, manage users.

### C. Concurrency Control & Double Booking Prevention (Pessimistic Slot Locking)
- **Problem:** Two patients click "Book Now" for Doctor Smith at 10:00 AM at the exact same millisecond.
- **Solution in Codebase:**
  1. **Deterministic Slot ID:** Created using MD5 hashing of `${doctorId}_${date}_${startTime}`.
  2. **SlotLock Collection:** MongoDB collection with a `TTL index` (`expiresAt`, 60-second expiration) and a `unique index` on `slotId`.
  3. **Pessimistic Locking:** When Patient A selects a slot, a `SlotLock` record is written. If Patient B attempts at the same time, MongoDB throws Duplicate Key Error (`code 11000`), returning `409 Conflict: Slot is currently being held by another user`.
  4. **State Machine:** Appointment statuses follow `pending` → `confirmed` → `in-progress` → `completed` (or `cancelled`).

### D. Asynchronous Events & Caching
- **Redis Caching:** Caches doctor search results and slot availability (`availability:summary:${doctorId}`). Invalidated automatically upon slot lock or appointment updates.
- **RabbitMQ Pub/Sub:** Asynchronous message queue for notifications. When an appointment is booked or cancelled, the `appointment-service` publishes a message to RabbitMQ, which `notification-service` consumes to send emails without delaying HTTP responses.

---

## 3. Top Interview Questions & Detailed Answers

### 🌐 Group 1: Project Overview & Architecture Questions

#### Q1. "Can you walk me through your MediConnect project?"
> **Answer:** "MediConnect is a healthcare management platform built on a microservices architecture using the MERN stack. It separates concerns across an API Gateway and four microservices: User Service, Doctor Service, Appointment Service, and Notification Service. 
> 
> The core problem it solves is double-booking prevention, role-based workflow for Patients, Doctors, and Admins, and seamless payment-to-booking flows. I implemented JWT-based stateless authentication, role-based access control, pessimistic slot locking with MongoDB TTL indexes to handle concurrent bookings, Redis caching for fast doctor searches, and RabbitMQ for asynchronous notification dispatch."

#### Q2. "Why did you choose a Microservice architecture instead of a Monolith?"
> **Answer:** "In a healthcare app, different services have vastly different traffic patterns and reliability requirements:
> - **Scalability:** `appointment-service` experiences high traffic bursts during morning slot openings, while `user-service` has low traffic. We can scale appointment instances independently.
> - **Fault Isolation:** If `notification-service` goes down, patients can still view, lock, and book appointments without failing the entire request.
> - **Domain Isolation:** Keeping medical records, identity management, and scheduling in decoupled modules with independent database schemas prevents schema coupling."

#### Q3. "How do microservices communicate in your architecture?"
> **Answer:** "We use two patterns:
> 1. **Synchronous HTTP/REST:** Used for client-initiated requests via the API Gateway using `http-proxy-middleware` and `axios` for inter-service communication (e.g. appointment service checking doctor metadata).
> 2. **Asynchronous Event-Driven (Pub/Sub):** Used for decoupled operations via RabbitMQ message broker. For instance, when an appointment status changes, the appointment service publishes a message (`APPOINTMENT_BOOKED`), which the notification service consumes asynchronously to send email alerts."

---

### 🔒 Group 2: Authentication & Security (JWT & RBAC)

#### Q4. "How does JWT authentication work in your application?"
> **Answer:** 
> 1. The user sends credentials (`email`, `password`) to `POST /api/auth/login`.
> 2. The User Service validates the user, verifies the password hash using `bcryptjs.compare()`, and signs a JWT containing `{ userId, role, email }` using a secret key and an expiration time (e.g., 24 hours).
> 3. The client receives the JWT and stores it (e.g., in HTTP-only cookies or localStorage) and sends it in the `Authorization: Bearer <token>` header for subsequent requests.
> 4. The API Gateway extracts and verifies the token using `jwt.verify()`. If valid, it attaches decoded user details to headers (`X-User-Id`, `X-User-Role`) and forwards the request downstream.

#### Q5. "What are the security risks of JWTs and how did you mitigate them?"
> **Answer:**
> - **Token Theft (XSS / CSRF):** Store JWT in `HttpOnly, Secure, SameSite=Strict` cookies to prevent JavaScript access (protects against XSS) and CSRF attacks.
> - **Replay Attacks & Expiration:** Keep access tokens short-lived (e.g., 15 mins to 1 hour) and use Refresh Tokens stored securely in the database to issue new tokens.
> - **Signature Verification:** Always verify signatures on the Gateway / server side with strong algorithms (HS256 or RS256).

#### Q6. "How did you implement Role-Based Access Control (RBAC)?"
> **Answer:** "RBAC is enforced both at the Gateway middleware layer and inside service controllers. 
> At the gateway or service level, custom middleware checks `req.headers['x-user-role']`:
> ```javascript
> const authorize = (...allowedRoles) => {
>   return (req, res, next) => {
>     const role = req.headers['x-user-role'];
>     if (!allowedRoles.includes(role)) {
>       return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
>     }
>     next();
>   };
> };
> ```
> For instance, only `admin` can hit `PATCH /api/doctors/admin/:id/verify`, and only `doctor` can update medical notes."

---

### 🍃 Group 3: Database & Concurrency (MongoDB & Mongoose)

#### Q7. "How did you handle race conditions / double bookings when two patients try to book the same slot?"
> **Answer:** "We implemented a **Pessimistic Slot Locking Mechanism** utilizing MongoDB's unique index and TTL (Time-To-Live) index:
> 1. We generate a deterministic `slotId` = `MD5(doctorId_date_startTime)`.
> 2. When a user clicks to book, we insert a document into a `SlotLock` collection with `{ slotId, patientId, doctorId, expiresAt: Date.now() + 60000 }`.
> 3. The `SlotLock` collection has a compound/unique index on `slotId`.
> 4. If two users try simultaneously, MongoDB guarantees atomicity. The second write fails with a Duplicate Key Error (`code 11000`), allowing us to return a clean `409 Conflict: Slot is held by another user` response.
> 5. If the user does not complete payment within 60 seconds, MongoDB auto-deletes the lock via TTL."

#### Q8. "Why MongoDB over a SQL database like PostgreSQL for this project?"
> **Answer:** "MongoDB was selected for:
> - **Schema Flexibility:** Doctor profiles vary widely (specializations, qualifications, hospital affiliations, dynamic slot structures), making document models natural.
> - **High Read Performance:** Nested JSON document storage allows fetching a doctor's complete schedule and profile in a single query without complex SQL `JOIN` overhead.
> - **Native TTL Indexes:** Simplifies lock management with automatic background document expiration for temporary slot reservations."

#### Q9. "What is indexing in MongoDB and which indexes did you create in MediConnect?"
> **Answer:** "Indexes create B-tree structures on specified fields to avoid full collection scans (`COLLSCAN`):
> 1. **Unique Index on `SlotLock.slotId`:** Enforces concurrency control.
> 2. **TTL Index on `SlotLock.expiresAt`:** Automatically removes expired slot locks after 60 seconds.
> 3. **Compound Index on `Appointment(doctorId, status, date)`:** Speeds up fetching doctor schedules for specific days.
> 4. **Text / Search Index on `Doctor(specialization, city, name)`:** Powers fast doctor search and filtering."

---

### ⚡ Group 4: RESTful APIs, Node.js & Express

#### Q10. "What makes an API RESTful?"
> **Answer:**
> - **Statelessness:** Each request contains all information needed to process it (JWT in header); no session state stored on server.
> - **Resource-based URLs:** Uses nouns instead of verbs (`/api/appointments` instead of `/api/getAppointments`).
> - **Standard HTTP Verbs:** `GET` (read), `POST` (create), `PUT/PATCH` (update), `DELETE` (remove).
> - **Standard HTTP Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `500 Internal Error`.

#### Q11. "How do you handle central error handling in Express?"
> **Answer:** "We use Express error-handling middleware with four parameters `(err, req, res, next)`. Any error passed via `next(err)` or caught in async controllers (via `asyncHandler` wrapper or `try/catch`) lands in `errorHandler`:
> ```javascript
> const errorHandler = (err, req, res, next) => {
>   logger.error(err.stack);
>   const statusCode = err.statusCode || 500;
>   res.status(statusCode).json({
>     success: false,
>     error: err.message || 'Internal Server Error',
>     timestamp: new Date().toISOString()
>   });
> };
> ```"

---

### ⚛️ Group 5: Frontend (React & State Management)

#### Q12. "How did you structure state and protect routes in React?"
> **Answer:**
> - **Auth Context / State:** Global state (Context API or Redux Toolkit) holds current user profile and JWT token.
> - **Protected Routes:** Component wrappers like `<ProtectedRoute allowedRoles={['patient']}>` check authentication status and user roles. If unauthenticated, it redirects to `/login`. If unauthorized role, redirects to `/unauthorized`.
> - **Axios Interceptors:** Automatically attaches `Authorization: Bearer <token>` to outbound requests and handles `401 Token Expired` globally by clearing state and redirecting to login.

---

### 🚀 Group 6: Advanced Topics (RabbitMQ, Redis, Payment & Deployment)

#### Q13. "How did you integrate Razorpay payments?"
> **Answer:**
> 1. Client locks slot → requests order creation.
> 2. Backend calls Razorpay API to generate `order_id` and returns it to React.
> 3. React opens Razorpay Checkout modal.
> 4. Upon completion, Razorpay returns `payment_id`, `order_id`, and `signature`.
> 5. Backend verifies signature using `crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')`.
> 6. On signature match, appointment status transitions to `confirmed` and `SlotLock` is converted into a permanent appointment."

#### Q14. "How is the application containerized and deployed?"
> **Answer:** "We use **Docker** and **Docker Compose**:
> - Each microservice (`user-service`, `doctor-service`, `appointment-service`, `notification-service`, `api-gateway`, `frontend`) has a multi-stage `Dockerfile`.
> - `docker-compose.yml` orchestrates services, environment variables, dependencies (`depends_on`), network bridges, and persistent volumes for MongoDB/Redis/RabbitMQ."

---

## 4. Summary Checklist for Interview Prep

| Topic Area | Key Concept to Remember |
| :--- | :--- |
| **Architecture** | API Gateway pattern, HTTP Proxying, Rate limiting, CORS, decoupled services |
| **Authentication** | Stateless JWT (Header `Bearer <token>`), bcrypt password hashing |
| **Authorization** | RBAC (`patient`, `doctor`, `admin`) via `X-User-Role` headers |
| **Concurrency** | Deterministic Slot ID + MongoDB Unique Index + TTL Index (`409 Conflict`) |
| **Async Tasks** | RabbitMQ Pub/Sub for background notification dispatching |
| **Performance** | Redis caching for availability summaries & doctor searches |
| **Payment** | Razorpay Order Creation + Webhook HMAC SHA-256 signature verification |

---
*Created for MediConnect Project Review & Master Interview Preparation.*
