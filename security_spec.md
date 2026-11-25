# Firestore Security Specification — TEAM FX

## 1. Data Invariants
1. A `UserProfile` at `/users/{userId}` can only be read, created, updated, or deleted by the verified Firebase user whose `request.auth.uid == userId`.
2. A `SavedMailbox` at `/users/{userId}/mailboxes/{mailboxId}` cannot exist without an existing parent `/users/{userId}` document and must have `ownerUid == request.auth.uid == userId`.
3. `createdAt`, `uid`, `ownerUid`, `mailboxId`, and `address` are immutable once created.
4. No unauthenticated user or non-verified email user may read or write any Firestore document.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unauthenticated read** on `/users/u1` -> `PERMISSION_DENIED`
2. **Unverified email write** (`email_verified: false`) on `/users/u1` -> `PERMISSION_DENIED`
3. **Cross-user profile read** (`auth.uid = u2` reading `/users/u1`) -> `PERMISSION_DENIED`
4. **UID spoofing** on create (`uid: "other_uid"` at `/users/u1`) -> `PERMISSION_DENIED`
5. **Shadow field injection** (`isAdmin: true`) on `/users/u1` -> `PERMISSION_DENIED`
6. **Client timestamp forgery** (`createdAt` != `request.time`) -> `PERMISSION_DENIED`
7. **ID poisoning** (1,500-char or invalid-char `mailboxId`) -> `PERMISSION_DENIED`
8. **Orphaned mailbox creation** (no parent `/users/u1` document) -> `PERMISSION_DENIED`
9. **Immutable address mutation** on `/users/u1/mailboxes/m1` update -> `PERMISSION_DENIED`
10. **Blanket list query** on `/users` collection -> `PERMISSION_DENIED`
11. **Cross-user mailbox list** (`auth.uid = u2` listing `/users/u1/mailboxes`) -> `PERMISSION_DENIED`
12. **Value poisoning** (oversized 500-char `label` on mailbox update) -> `PERMISSION_DENIED`
