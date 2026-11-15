# Security Specification — THE ANIME WORLD

## 1. Data Invariants
1. **Default Deny**: All unmatched paths in Firestore default to `allow read, write: if false;`.
2. **PII Isolation**: User email addresses and full names reside exclusively in `/privateUsers/{uid}` and are readable/writable only by the owning UID or a verified admin.
3. **Zero Self-Privilege Escalation**: Users cannot create `/publicProfiles/{uid}` with `role != 'user'` or `isSuspended == true`, cannot modify `role` or `isSuspended`, and cannot write to `/admins/{uid}` unless already an admin.
4. **Verified Auth & Email Spoof Prevention**: All standard writes require `request.auth != null && request.auth.token.email_verified == true`. Bootstrapped admin email checks explicitly verify `request.auth.token.email_verified == true`.
5. **Strict Schema & Size Enforcement**: Every create and update invokes a standalone `isValid[Entity]()` helper enforcing `keys().hasAll(...)`, `keys().hasOnly(...)`, type checks, string `.size()` limits, bounded arrays, and regex `isValidId()` on document IDs.
6. **Temporal Integrity**: `createdAt == request.time` on creation; `updatedAt == request.time` on updates; `createdAt` and owner/author UIDs are immutable.
7. **Terminal State Locking**: Feedback resolved (`status == 'resolved'`) and reports no longer `pending` cannot be modified by regular users.
8. **Query Enforcement without O(n) Lookups**: Every `allow list` rule evaluates `resource.data` directly without `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Signup**: Creating `/publicProfiles/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection**: Creating `/favorites/{id}` with extra field `isAdminOverride: true` -> `PERMISSION_DENIED`.
3. **Unverified Email Admin Spoof**: Token with `email: "mohdwaleed868@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
4. **PII Scraping**: Authenticated non-owner reading `/privateUsers/{otherUid}` -> `PERMISSION_DENIED`.
5. **Identity Spoofing on Artwork**: User A creating `/communityArtworks/{id}` with `authorId: "userB"` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Creating document with 500-char ID or invalid characters `../admin` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Creating `/collections/{id}` with backdated client `createdAt` instead of `serverTimestamp()` -> `PERMISSION_DENIED`.
8. **Value Poisoning on Whitelisted Key**: Updating `/publicProfiles/{uid}` `bio` with a 5,000-char string -> `PERMISSION_DENIED`.
9. **Terminal State Bypass**: Regular user updating `/feedback/{id}` `status` to `"resolved"` -> `PERMISSION_DENIED`.
10. **Orphaned Comment Write**: Creating a comment under a non-existent `/communityArtworks/missing/comments/{id}` -> `PERMISSION_DENIED`.
11. **Self-Follow Loop**: Creating `/follows/{id}` where `followerId == followingId` -> `PERMISSION_DENIED`.
12. **Blanket List Scraping**: Listing `/privateUsers` or `/feedback` as a non-admin without owner filter -> `PERMISSION_DENIED`.
