# Security Specification for DataTopoGuard

## 1. Data Invariants
- A **Project** must always have a valid `clientId` and `topographerId`.
- A **Document** must be linked to a **Project** that the user has access to.
- A **Message** can only be sent between participants of a project or direct contacts.
- **Admin** role is protected and cannot be self-assigned.
- **Invoices** are locked once status is `PAID`.
- **System Logs** are immutable and append-only.

## 2. The Dirty Dozen (Payloads to Block)
1. **Admin Promotion**: User tries to update their own `role` to `ADMIN`.
2. **Shadow Field Injection**: Adding `isVerified: true` to a user profile update.
3. **Ghost Document**: Creating a document for a project the user doesn't own.
4. **ID Poisoning**: Using a 1MB string as a `projectId` to cause resource exhaustion.
5. **PII Leak**: A user trying to `get` another user's email/phone without being an admin or collaborator.
6. **Time Spoofing**: Sending a `createdAt` timestamp from 2020 to bypass recent activity logic.
7. **Orphaned Message**: A user sending a message to a `receiverId` they have no project with.
8. **Double Dip Review**: Rating the same project twice to inflate metrics.
9. **Status Fast-Tracking**: Client trying to set project status directly to `COMPLETED` without survey work.
10. **Resource Overwrite**: Topographer trying to update `clientId` on an existing project.
11. **Negative Payment**: Trying to create a payment intent for `-100.00`. (Blocked in server).
12. **Blanket Query**: Querying all users without any filters (Force `where` clause).

## 3. Red Team Audit Checklist
- [ ] Identity Spoofing blocked?
- [ ] Orphaned writes blocked?
- [ ] Terminal states locked?
- [ ] PII isolated?
- [ ] Rate limit logging in place?
