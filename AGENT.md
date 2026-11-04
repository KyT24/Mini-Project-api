# AGENT.md - AI Agent Operational Playbook

> **Target Audience:** AI Coding Assistants (Antigravity, Claude, Cursor, Windsurf, Copilot) working on this codebase.  
> **Repository:** `arhe-api` (Clinic Appointment Backend)  
> **Framework:** Node.js 18+ • Express 5 • TypeScript • Prisma ORM 7 (PostgreSQL) • Supabase Storage

---

## 1. System Overview & Core Mission

This repository is the backend REST API for a medical and aesthetic clinic appointment platform. It manages:
- Multi-role access control (`PATIENT`, `ADMIN`, `STAFF`, `DOCTOR`).
- Medical specialists, doctor master profiles, and photo uploads.
- Weekly recurring doctor practice schedules (`doctor_schedules`).
- Dynamic session provisioning (`practice_sessions`) based on weekly schedule templates.
- Appointment reservations with strict 30-minute quota locks.
- Payment proof uploads to Supabase Storage and admin verification workflows.
- Queue numbering and secure QR token issuance.
- Patient review and doctor rating aggregations.

When contributing code, you must maintain **data integrity**, **strict concurrency safety (preventing quota overbooking)**, **consistent error response formats**, and **proper WIB (UTC+07:00) timezone alignment**.

---

## 2. Tech Stack & Dependencies

| Tool / Library | Version / Detail | Agent Usage Rule |
|---|---|---|
| **Node.js** | `>=18.x` | Use standard ES modules/commonjs supported syntax. |
| **Express** | `^5.3.0` | Native async error forwarding (unhandled promise rejections are automatically passed to error middleware). |
| **TypeScript** | `^5.9.3` | Strict mode enabled (`strict: true`). Avoid using `any`; define explicit types or use Prisma generated types. |
| **Prisma ORM** | `^7.10.x` | Configured with `@prisma/adapter-pg` and custom output directory `src/generated/prisma`. **Never edit generated files directly.** |
| **Zod** | `^4.6.x` | All incoming HTTP payloads (`body`, `query`, `params`) must be validated with Zod schemas. |
| **Supabase** | `^2.118.x` | Server-side only via Service Role Key for public bucket operations. |
| **Multer** | `^2.5.0` | In-memory uploads (`multer.memoryStorage()`) with 2 MB file limit. |

---

## 3. Directory Structure & File Placement Rules

Follow the established feature-driven structure:

```text
src/
├── application/           # Express app instantiation for serverless / entrypoint
├── configs/               # Global configs (Prisma client, CORS, etc.)
├── errors/                # Central AppError definition
├── features/              # Feature modules:
│   ├── appointment/       # Appointment booking, availability, queue, admin verification
│   ├── auths/             # Authentication, admin registration, session /me
│   ├── doctor/            # Doctor profiles, avatars, ratings integration
│   ├── patient/           # Patient profiles
│   ├── schedule/          # Doctor recurring schedule slots & overlap checks
│   └── specialist/        # Medical specialties
├── lib/                   # Reusable shared helpers (bcrypt, jwt, supabase, time)
├── middlewares/           # Global & route middlewares (auth, upload, error)
├── scripts/               # Seed scripts (seed-admin.ts, seed-treatments.ts)
├── validators/            # Zod validation schemas
└── server.ts              # Express initialization & local HTTP listener
```

### Architectural Layering Guidelines:
1. **Controllers (`*.controller.ts`)**:
   - Parse and validate input via `validate(schema, { body, query, params })`.
   - Extract authentication context from `res.locals.auth` (`TAuthPayload`).
   - Delegate all database/business logic to the corresponding Service.
   - Return standard response: `{ success: true, message: "...", data: result, meta?: ... }`.
2. **Services (`*.service.ts`)**:
   - Contain pure business logic and Prisma database queries.
   - Throw operational errors using `throw new AppError(statusCode, message)`.
   - Wrap state modifications and quota adjustments inside `prisma.$transaction(...)`.
3. **Routes (`*.route.ts`)**:
   - Bind HTTP verbs and paths to controller actions.
   - Apply security guards: `verifyToken`, `verifyRole(...)`, `uploadSingleImage(...)`.
4. **Validators (`src/validators/*.validator.ts`)**:
   - Zod schemas for input validation.

---

## 4. Critical Business Rules & Invariants

### 🕒 Timezone Discipline (WIB / UTC+07:00)
- The clinic operates on **WIB (UTC+07:00)** (`CLINIC_UTC_OFFSET = '+07:00'`).
- Production servers (e.g., Vercel) execute in **UTC**.
- **Rule:** Never use standard `new Date().toISOString().slice(0, 10)` directly for clinic calendar dates. Always use:
  - `clinicNow()` from `appointment.helpers.ts` to get current clinic date/time.
  - `toDbDate()` / `toDbTime()` / `fromDbTime()` from `src/lib/time.lib.ts`.

### 📅 Appointment Lifecycle & Quota Locking
- **Booking Window:** Maximum 14 days in advance (`BOOKING_WINDOW_DAYS = 14`).
- **Payment Hold Time:** Exactly 30 minutes (`PAYMENT_HOLD_MINUTES = 30`).
- **Quota Calculation (`holdsQuota`):**
  - Appointments holding quota: `waiting_payment` (if within 30 min deadline), `waiting_confirmation`, and `done`.
  - Appointments NOT holding quota: `expired`, `rejected`, `canceled`, or `waiting_payment` past the deadline.
- **Lazy Expiration (`syncStatuses()`):**
  - Always call `await syncStatuses();` before inspecting availability or fetching appointment lists to auto-expire stale holds.
- **Concurrency & Row Locking:**
  - When reserving an appointment or approving/rejecting payments, use `prisma.$transaction` and call `await lockSession(tx, session_id);` (which executes `SELECT id FROM practice_sessions WHERE id = $1 FOR UPDATE`) to eliminate race conditions.

### 👮 Role-Based Access Control (RBAC)
- Roles: `'PATIENT' | 'ADMIN' | 'STAFF' | 'DOCTOR'`.
- Passwords must be hashed using `Bcrypt.hashPassword(password)`.
- Authentication reads JWT tokens from `req.cookies.token`.
- Routes modifying system config (Doctors, Specialists, Schedules, Appointment Approval/Rejection) **MUST** be protected with `verifyToken` and `verifyRole('ADMIN')`.
- Patient routes (`POST /appointments`, `PATCH /appointments/:id/cancel`, `POST /appointments/:id/payment-proof`, `GET /patients/me`) **MUST** verify role `'PATIENT'`.

---

## 5. Development & Operational Commands

```bash
# Install dependencies
npm install

# Run development server with live reload
npm run dev

# Compile TypeScript to dist/
npm run build

# Start production server
npm start

# Seed initial admin user (from .env)
npm run seed:admin

# Seed standard treatments catalog
npm run seed:treatments

# Prisma schema migration (local dev)
npx prisma migrate dev

# Prisma schema migration (production / CI)
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate
```

---

## 6. Error Handling & Response Standards

### Custom Errors
Always throw `AppError` for handled business and validation failures:
```typescript
import { AppError } from '../../errors/app.error';

// Examples
throw new AppError(404, 'doctor not found');
throw new AppError(409, 'schedule overlaps with existing slot');
throw new AppError(422, 'Schedule date must be within the next 14 days');
```

### Response Formats
- **Success (Single item):**
  ```json
  {
    "success": true,
    "message": "appointment created successfully",
    "data": { ... }
  }
  ```
- **Success (Paginated list):**
  ```json
  {
    "success": true,
    "message": "appointments retrieved successfully",
    "data": [ ... ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "total_pages": 5
    }
  }
  ```
- **Failure:**
  ```json
  {
    "success": false,
    "message": "Error description",
    "data": {}
  }
  ```

---

## 7. Agent Checklist for Modifying or Adding Endpoints

When implementing a new feature or endpoint, follow this strict checklist:

1. [ ] **Prisma Schema:** If schema is touched in `prisma/schema.prisma`, run `npx prisma migrate dev --name <migration_name>` and regenerate client.
2. [ ] **Validation:** Define a Zod schema in `src/validators/<entity>.validator.ts` matching input requirements.
3. [ ] **Service Implementation:** Add method in `src/features/<entity>/<entity>.service.ts`.
   - Wrap quota-altering logic in `prisma.$transaction`.
   - Lock rows with `FOR UPDATE` if concurrent bookings are possible.
   - Throw `AppError` on invalid state.
4. [ ] **Controller Implementation:** Add handler in `src/features/<entity>/<entity>.controller.ts`. Validate payload and return consistent JSON.
5. [ ] **Route Registration:** Register route in `src/features/<entity>/<entity>.route.ts` with appropriate middlewares (`verifyToken`, `verifyRole`).
6. [ ] **Doc Update:** Update `README.md` if endpoint contracts change.
7. [ ] **Clean Code & Comments:** Preserve existing comments and docstrings. Do not leave temporary debugging code.

