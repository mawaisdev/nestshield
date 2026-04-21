# NestShield
A production-ready multi-tenant SaaS backend starter.

Stack: NestJS · PostgreSQL · Redis · BullMQ · WebSockets · AWS · OpenAI

Status: In progress — building in public.

## Modules
- [ ] M1 — Auth (refresh token rotation, 2FA, RBAC, device sessions)
- [ ] M2 — Multi-tenancy (schema isolation, tenant middleware)
- [ ] M3 — Job Queues (BullMQ, retries, dead letter queues)
- [ ] M4 — Real-time (WebSocket gateway, Redis pub/sub)
- [ ] M5 — Performance (caching strategy, rate limiting)
- [ ] M6 — AI Integration (OpenAI streaming, per-tenant token tracking)



## Packages
- Database
  -
  - @nestjs/typeorm
    -
    - NestJs Official integration for Typeorm. Let's you define database tables as Typescript classes and query them with type safety. Without this you would write raw sql queries everywhere.
    - Here used for connecting NestJS to supabase PostgreSQL, defining User and Session Entities

  - typeorm
    - 
    - The actual orm that @nestjs/typeorm wraps around. You need both - one is the engine ane is the NestJS adapter
    - Used for @Entity, @Column, @Repository decorators. migrations

  - pg
    -
    - The PostgreSQL driver for NodeJs. Typeorm Needs this under the hood to actually talk to the PostgreSQL (Supabase) database. You never call it directly but it must be installed

- Authentication
  -
  - @nestjs/jwt
    -
    - NestJS official JWT integration. Handles signing and verifying access tokens and refresh tokens. You configure it once with your secrets and it handles the crypto for you.
    - Used for: issuing access tokens (15min expiry) and refresh tokens (7 day expiry)

  - @nestjs/passport
    - 
    - NestJS adapter for Passport.js. Passport is the industry standard auth middleware for Node.js. This package makes Passport work as NestJS Guards and Strategies.
    - Used for: wiring auth strategies into NestJS route guards

  - passport
    -
    - The core Passport.js library. Required by @nestjs/passport — same pattern as typeorm and @nestjs/typeorm, one is the engine, one is the adapter.
    - Used for: strategy pattern — each auth method (local, JWT) is a strategy

  - passport-jwt
    -
    - Passport strategy for JWT. Extracts the Bearer token from request headers and validates it. Every protected route uses this to verify the user is authenticated.
    - Used for: protecting routes — if no valid JWT, request is rejected before hitting your controller

  - passport-local
    -
    - Passport strategy for username/password login. Handles the initial login step — validates email and password before issuing tokens.
    - Used for: the /auth/login endpoint — validates credentials before issuing JWT pair
  
  - bcrypt
    -
    - Password hashing library. You never store plain text passwords — bcrypt hashes them with a salt so even if your DB is compromised, passwords can't be reversed. Industry standard.
    - Used for: hashing passwords on register, comparing hash on login

- 2FA
  -
  - otplib
    -
    - TOTP (Time-based One-Time Password) library. This is what powers Google Authenticator-style 2FA. Generates a secret per user and validates the 6-digit code they enter.
    - Used for: generating 2FA secrets, validating TOTP codes, QR code data generation

  - qrcode
    -
    - Generates QR code images from a URL. When a user enables 2FA, you show them a QR code they scan with Google Authenticator. This package converts the TOTP URL into that QR code.
    - Used for: /auth/2fa/generate endpoint — returns QR code image for the user to scan


- Dev only (types)
  -
  - @types/passport-jwt, @types/passport-local, @types/bcrypt, @types/qrcode
    -
    - TypeScript type definitions for the above libraries. These packages were written in plain JavaScript so TypeScript doesn't know their shapes without these. Only needed during development — not in production.
    - Used for: TypeScript autocomplete, type checking, no runtime impact
