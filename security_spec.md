# PHOENIX Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Core Data Invariants
1. **Strict Ownership Isolation**: Every `/users/{userId}` document, `/users/{userId}/missions/{missionId}` document, and `/users/{userId}/missions/{missionId}/files/{fileId}` document belongs exclusively to `userId` (`request.auth.uid == userId && request.auth.token.email_verified == true`). Changing a record ID in the URL, query, or payload must never grant access to another user's workspace.
2. **Guest Separation**: Guest sessions are temporary and exist only on the Express backend scoped by HMAC-SHA256 signed guest session identifiers (`HttpOnly` cookie / verified signed token), never inside public or shared Firestore collections.
3. **Zero Privilege Escalation**: User registration documents must enforce `role == 'customer'`. Ordinary users cannot write to `/admins/{adminUid}` or escalate `role` to `'admin'`.
4. **Master Gate Relational Integrity**: A `MissionFile` cannot exist without its parent `MissionRecord`, and a `MissionRecord` cannot exist without its parent `UserAccount` (`exists()` / `existsAfter()`).
5. **Temporal & Immutability Integrity**: `ownerId`, `id`, `missionId`, `goal`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must match `request.time`.
6. **Terminal State Locking**: Once a `MissionRecord` reaches `'completed'` or `'cancelled'`, its `status`, `goal`, `tasks`, and `report` cannot be altered by ordinary users (only `responseFeedback` and `updatedAt` may be updated, or full deletion by the owner).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Yield PERMISSION_DENIED)
1. **Cross-Tenant Read**: Authenticated User B attempts `GET /users/userA/missions/m-1` or `GET /users/userA/missions/m-1/files/f-1`.
2. **Cross-Tenant List Scraping**: Authenticated User B attempts `LIST /users/userA/missions` or `LIST /users` without admin rights.
3. **Identity Spoofing on Create**: User B creates `/users/userB/missions/m-1` with `{ ownerId: "userA", ... }`.
4. **Ghost / Shadow Field Injection**: User A creates `/users/userA` with `{ ..., isAdmin: true, quotaBypass: true }`.
5. **Privilege Escalation**: User A creates or updates `/users/userA` setting `role: "admin"` or writes `/admins/userA`.
6. **Unverified Email Bypass**: User A signs in with `email_verified: false` (even matching admin email) and attempts read/write.
7. **ID Poisoning / Denial-of-Wallet**: User A attempts create at `/users/userA/missions/<1500_char_invalid_id>` or `id: "bad/id$!"`.
8. **Orphaned File Injection**: User A creates `/users/userA/missions/nonexistent_mission/files/f-1` without parent mission existing.
9. **Immutable Field Tampering**: User A updates `/users/userA/missions/m-1` changing `goal` or `ownerId` or `createdAt`.
10. **Client Timestamp Spoofing**: User A creates `/users/userA/missions/m-1` with client-supplied `createdAt: Timestamp(2020-01-01)`.
11. **Terminal State Rewriting**: User A updates a `'completed'` mission trying to rewrite `tasks` or `report` or flip `status` back to `'executing'`.
12. **Type / Size Poisoning**: User A updates `title` with a boolean `true` or `content` > `500000` chars or unbounded `tasks` list (> 20 items).
