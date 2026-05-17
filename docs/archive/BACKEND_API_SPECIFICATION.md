# DevPilot Backend API Specification

## Overview

This document defines the API contracts required for DevPilot backend integration. The frontend extension makes HTTP requests to these endpoints with JWT authentication.

**Base URL:** `https://devpilot-auth.devpilotorg.workers.dev` (Configurable in `WorkerApiClient`)

**Authentication:** All requests require `Authorization: Bearer <JWT_TOKEN>` header

**Content-Type:** `application/json`

---

## 1. User Sync Endpoint

**Purpose:** Synchronize user progress data (streak, points, achievements, TODOs) from frontend to backend

### Request

```http
POST /api/users/sync
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "email": "user@example.com",
  "data": {
    "currentStreak": 5,
    "longestStreak": 12,
    "totalPoints": 250,
    "achievementsCount": 8,
    "todosCompletedToday": 3,
    "lessonsCompleted": 15,
    "buildSpeedMs": 2341,
    "lastActivityTime": "2024-01-15T10:30:00Z"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response Success (200)

```json
{
  "success": true,
  "message": "User data synced successfully",
  "syncedAt": "2024-01-15T10:30:00Z",
  "data": {
    "currentStreak": 5,
    "longestStreak": 12,
    "totalPoints": 250,
    "achievementsCount": 8
  }
}
```

### Response Error (400)

```json
{
  "success": false,
  "error": "Invalid email format",
  "errorCode": "INVALID_REQUEST"
}
```

### Response Error (401)

```json
{
  "success": false,
  "error": "Unauthorized",
  "errorCode": "AUTH_FAILED"
}
```

### Response Error (500)

```json
{
  "success": false,
  "error": "Database connection failed",
  "errorCode": "SERVER_ERROR"
}
```

### Implementation Requirements

- **Validation:**
  - Email must be valid format
  - JWT token must be valid (extract user ID from token)
  - All data fields must be non-negative integers
  - Timestamp must be ISO 8601 format

- **Business Logic:**
  - Store/update user progress in database
  - Overwrite existing data OR merge intelligently (keep max streak, max points, etc.)
  - Log sync event for audit trail
  - Store sync timestamp for conflict resolution
  - Return status code 200 on success, 400 on validation error, 401 on auth failure, 500 on server error

- **Error Handling:**
  - Gracefully handle malformed JSON (400)
  - Gracefully handle database connection issues (500)
  - Validate JWT before processing (401)
  - Do not expose internal error messages to client

- **Performance:**
  - Should complete within 2 seconds
  - Implement database indexing on email/userId for fast lookups
  - Consider caching for frequently synced users

### Sync Frequency

Frontend syncs automatically:
- Every 5 minutes (periodic)
- When user clicks "Sync Now" button
- After build completion (with build speed)
- When extension activates

---

## 2. Translation Endpoint

**Purpose:** Translate code between programming languages using AI

### Request

```http
POST /api/translate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "code": "def hello(name):\n    print(f'Hello {name}')",
  "sourceLanguage": "python",
  "targetLanguage": "javascript",
  "userId": "user@example.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response Success (200)

```json
{
  "success": true,
  "sourceLanguage": "python",
  "targetLanguage": "javascript",
  "originalCode": "def hello(name):\n    print(f'Hello {name}')",
  "translatedCode": "function hello(name) {\n  console.log(`Hello ${name}`);\n}",
  "confidence": 0.92,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response Error (400)

```json
{
  "success": false,
  "error": "Unsupported language pair: cobalt -> lisp",
  "errorCode": "UNSUPPORTED_PAIR"
}
```

### Response Error (401)

```json
{
  "success": false,
  "error": "Unauthorized",
  "errorCode": "AUTH_FAILED"
}
```

### Response Error (429)

```json
{
  "success": false,
  "error": "Rate limit exceeded - 10 translations per minute",
  "errorCode": "RATE_LIMITED",
  "retryAfter": 30
}
```

### Response Error (500)

```json
{
  "success": false,
  "error": "AI model service unavailable",
  "errorCode": "SERVICE_ERROR"
}
```

### Implementation Requirements

- **Supported Languages:**
  - Python, JavaScript, TypeScript, Java, C++, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, C, Objective-C, Scala, Groovy, Clojure, Elixir, Haskell, Lua

- **Supported Language Pairs:**
  - Any language to any other language (20+ × 20+ combinations)
  - Special handling for TypeScript (treat as JavaScript)

- **AI Translation:**
  - Use LLM (GPT-4, Claude, etc.) to translate code
  - Maintain code semantics as much as possible
  - Provide confidence score (0.0-1.0)
  - Handle edge cases: comments, strings, special characters

- **Fallback (if AI unavailable):**
  - Frontend has offline heuristic translation
  - Backend should attempt AI translation first
  - If backend returns 500 or timeout, frontend uses offline method
  - Log translation requests for analytics

- **Validation:**
  - Code length < 64KB
  - Language names must be recognized
  - JWT token must be valid
  - Timestamp must be recent (within 5 minutes)

- **Rate Limiting:**
  - 10 translations per minute per user
  - Return 429 with `retryAfter` header
  - Consider subscription tier for higher limits

- **Logging:**
  - Log all translation requests for analytics
  - Track source/target language pairs
  - Track confidence scores for quality metrics
  - Track success/failure rates

### Performance Targets

- Should complete within 5 seconds for code < 10KB
- Should complete within 15 seconds for code < 64KB
- Cache common translations for frequent patterns
- Pre-warm language model if using stateful backend

---

## 3. Email Notification Endpoint

**Purpose:** Send email notifications for achievements, streaks, milestones

### Request

```http
POST /api/notifications/send-email
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "🔥 You maintained a 7-day coding streak!",
  "text": "Great job! You've maintained a 7-day coding streak. Keep it up!",
  "html": "<h1>Streak Milestone!</h1><p>Great job! You've maintained a <strong>7-day coding streak</strong>.</p>",
  "type": "streak_milestone",
  "data": {
    "streakDays": 7,
    "userName": "John Doe",
    "userId": "user@example.com",
    "achievementName": "Week Warrior",
    "pointsEarned": 100
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Response Success (200)

```json
{
  "success": true,
  "messageId": "msg_abc123xyz789",
  "sentAt": "2024-01-15T10:30:05Z",
  "notificationType": "streak_milestone"
}
```

### Response Error (400)

```json
{
  "success": false,
  "error": "Invalid email address",
  "errorCode": "INVALID_EMAIL"
}
```

### Response Error (429)

```json
{
  "success": false,
  "error": "Too many emails sent - 5 per day limit",
  "errorCode": "RATE_LIMITED"
}
```

### Response Error (500)

```json
{
  "success": false,
  "error": "Email service failed",
  "errorCode": "SERVICE_ERROR"
}
```

### Implementation Requirements

- **Email Service Integration:**
  - SendGrid, AWS SES, or similar SMTP provider
  - Support for HTML and plain text formats
  - Unsubscribe link required in footer
  - From address: `notifications@devpilot.dev` or similar

- **Notification Types:**
  1. `streak_milestone` - Streak reached (7, 14, 30, 100 days, etc.)
  2. `achievement_unlock` - Achievement earned
  3. `weekly_summary` - Weekly activity summary
  4. `sync_failure` - Sync failed (transient)
  5. `important_update` - New feature announcement
  6. `learning_milestone` - Learning progress milestone

- **Email Templates:**
  - Professional branded template with DevPilot logo
  - Responsive design for mobile
  - Clear call-to-action (go to dashboard)
  - Unsubscribe link in footer
  - Sender name: "DevPilot Team"

- **Validation:**
  - Email format validation
  - Type must be in supported list
  - Subject line required (non-empty)
  - HTML or text required (at least one)
  - JWT token must be valid

- **Rate Limiting:**
  - 5 emails per day per user (to prevent spam)
  - Allow override for important updates
  - Consider email digest for multiple notifications

- **Tracking:**
  - Return unique messageId for tracking
  - Store in database for delivery verification
  - Track bounce/complaint rates
  - Implement unsubscribe list

- **Logging:**
  - Log all email send requests
  - Log delivery status
  - Log bounce/complaint events
  - Track email open rates if possible

### Email Template Requirements

**Subject Examples:**
```
🔥 You maintained a 7-day coding streak!
🏆 New Achievement Unlocked: Code Master
📊 Your Weekly DevPilot Summary
⚠️ Sync Failed - Please Check Connection
🎉 Welcome to DevPilot!
```

**HTML Structure Example:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
    .footer { font-size: 12px; color: #999; text-align: center; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DevPilot</h1>
    </div>
    <div class="content">
      <h2>Streak Milestone!</h2>
      <p>Great job! You've maintained a <strong>7-day coding streak</strong>.</p>
      <a href="https://devpilot.dev/dashboard" class="button">View Dashboard</a>
    </div>
    <div class="footer">
      <p><a href="https://devpilot.dev/unsubscribe?token=xyz">Unsubscribe from emails</a></p>
      <p>&copy; 2024 DevPilot. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

### Performance Targets

- Should complete within 3 seconds
- Email delivery within 1 minute under normal conditions
- Handle burst traffic (up to 1000 emails/minute)

---

## 4. Common Response Fields

All responses should include:

```json
{
  "success": true/false,
  "error": "string (if success=false)",
  "errorCode": "string (if success=false)",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 5. Error Codes Reference

| Code | HTTP Status | Meaning | Retry |
|------|-------------|---------|-------|
| INVALID_REQUEST | 400 | Malformed JSON or validation error | No |
| UNSUPPORTED_PAIR | 400 | Language pair not supported | No |
| INVALID_EMAIL | 400 | Invalid email format | No |
| AUTH_FAILED | 401 | JWT token invalid/expired | No |
| RATE_LIMITED | 429 | Rate limit exceeded | Yes (see retryAfter) |
| SERVICE_ERROR | 500 | Internal server error | Yes (exponential backoff) |
| DATABASE_ERROR | 500 | Database connection failed | Yes |
| TIMEOUT | 504 | Request timeout | Yes |

---

## 6. Authentication

### JWT Token Format

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "sub": "user@example.com",
  "email": "user@example.com",
  "iat": 1705320600,
  "exp": 1705407000,
  "aud": "devpilot"
}

Signature: HMAC-SHA256(header + payload, secret)
```

### JWT Validation

- Verify signature using shared secret
- Check token not expired (`exp` claim)
- Check audience is "devpilot" (`aud` claim)
- Extract user email from `sub` or `email` claim
- Return 401 if any validation fails

### Token Injection

Frontend automatically injects JWT via `WorkerApiClient`:
```typescript
const client = getWorkerApiClient();
const response = await client.post('/api/users/sync', data);
// JWT automatically added to Authorization header
```

---

## 7. Request/Response Headers

### Request Headers (Frontend will send)

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
User-Agent: DevPilot/1.0 VSCode/<version>
X-Request-ID: <uuid> (optional, for tracing)
X-DevPilot-Extension-Version: 0.1.3
```

### Response Headers (Backend should send)

```
Content-Type: application/json
Cache-Control: no-cache, no-store, must-revalidate
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1705320660
X-Request-ID: <echo back for tracing>
```

---

## 8. Data Validation Rules

### Email
- Must match RFC 5322 standard
- Max length: 254 characters
- Required for sync endpoint

### Code (for translation)
- Max length: 65536 characters (64KB)
- All Unicode characters allowed
- No binary data

### Language Names
- Lowercase or camelCase
- Examples: `python`, `javascript`, `csharp`
- TypeScript accepted as JavaScript
- Must be in supported language list

### Timestamps
- ISO 8601 format: `2024-01-15T10:30:00Z`
- Must be within 5 minutes of server time (to prevent replay attacks)
- Use UTC timezone

### Numeric Fields
- All must be non-negative integers
- Max value: 2,147,483,647 (32-bit signed int)
- Examples: streak, points, buildSpeedMs

---

## 9. Testing Endpoints

For development/testing, the frontend includes a mock backend server:

```typescript
import { BackendTestHelper } from '../test/mockBackend';

const helper = new BackendTestHelper();
await helper.setupTest();

// Test user sync
const syncResult = await helper.testUserSync('user@example.com', {
  currentStreak: 5,
  totalPoints: 250
});

// Test translation
const transResult = await helper.testTranslation(
  'print("hello")', 
  'python', 
  'javascript'
);

// Test email
const emailResult = await helper.testEmail(
  'user@example.com',
  'Test Subject',
  'Test message'
);

await helper.teardownTest();
```

---

## 10. Deployment Checklist

Before deploying backend endpoints:

- [ ] Implement all three endpoints (/api/users/sync, /api/translate, /api/notifications/send-email)
- [ ] Add JWT token validation
- [ ] Implement rate limiting
- [ ] Set up error logging
- [ ] Add database schema for user data
- [ ] Configure email service integration
- [ ] Set up monitoring and alerts
- [ ] Test with mock client (using BackendTestHelper)
- [ ] Performance test (load test with 1000+ concurrent requests)
- [ ] Security audit (SQL injection, XSS, CSRF prevention)
- [ ] Documentation of API in production environment
- [ ] Set up CI/CD pipeline for backend updates
- [ ] Create admin dashboard for monitoring/debugging

---

## 11. Example Implementation (Node.js/Express)

```typescript
import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware: Verify JWT
function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Endpoint: User Sync
app.post('/api/users/sync', verifyJWT, async (req, res) => {
  try {
    const { email, data, timestamp } = req.body;
    
    // Validate
    if (!email || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Store in database
    await db.users.update({ email }, { data, syncedAt: new Date() });
    
    res.json({
      success: true,
      message: 'User data synced successfully',
      syncedAt: new Date().toISOString(),
      data
    });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Endpoint: Translate
app.post('/api/translate', verifyJWT, async (req, res) => {
  try {
    const { code, sourceLanguage, targetLanguage } = req.body;
    
    // Call AI service
    const translated = await aiService.translate(code, sourceLanguage, targetLanguage);
    
    res.json({
      success: true,
      sourceLanguage,
      targetLanguage,
      originalCode: code,
      translatedCode: translated,
      confidence: 0.95,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Endpoint: Send Email
app.post('/api/notifications/send-email', verifyJWT, async (req, res) => {
  try {
    const { to, subject, html, type } = req.body;
    
    // Validate email
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    
    // Send via email service
    const messageId = await emailService.send({ to, subject, html });
    
    res.json({
      success: true,
      messageId,
      sentAt: new Date().toISOString(),
      notificationType: type
    });
  } catch (error) {
    res.status(500).json({ error: 'Email send failed' });
  }
});

app.listen(3000);
```

---

## 12. Support & Contact

For questions about API specification:
- Create issue in GitHub: [DevPilot Issues](https://github.com/devpilot/issues)
- Contact: [support@devpilot.dev](mailto:support@devpilot.dev)

---

**Last Updated:** January 15, 2024
**API Version:** 1.0
**Status:** Ready for Implementation
