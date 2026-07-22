# Store Submission Preparation Guide

This guide maps out the required metadata, safety disclosures, and reviewer notes needed to submit NoteBox to the Apple App Store and Google Play Store, ensuring 100% compliance with current platform guidelines.

---

## 1. Apple Privacy Nutrition Label Mapping

Since NoteBox utilizes a secure private backend and processes local notes/receipts, the following declarations must be made in App Store Connect under **App Privacy**:

### Data Collection Declarations

| Data Type | Category | Linked to User? | Used for Tracking? | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Contact Info** | Email Address | Yes | No | **App Functionality:** Required for account creation, Apple Sign-In authentication, and critical security/billing notices. |
| **Purchases** | Purchase History | Yes | No | **App Functionality:** Needed to verify subscription state, restore purchases, and unlock entitlement levels. |
| **User Content** | Text Messages / Notes | Yes | No | **App Functionality:** Core feature (writing/saving notes). *All note content is stored in the user's private database segment and is never sold, shared, or used for model training.* |
| **User Content** | Photos or Videos | Yes | No | **App Functionality:** Core feature (attaching receipt screenshots and documents to notes). |
| **Identifiers** | User ID | Yes | No | **App Functionality:** Internal database UUID and Apple Sign-In identifier (`apple_id`) used to map notes and boxes to the correct user account. |

### Data Tracking & Third-Party Sharing
*   **Tracking:** NoteBox **does not** track users across third-party apps or websites.
*   **Third-Party AI Opt-In:** If the user opts into AI Perspectives, note text is transmitted to the configured AI API (e.g., OpenAI). This is strictly for real-time inference. No PII is sent (it is redacted locally/server-side first), and the data is contractually excluded from training.

---

## 2. Google Play Data Safety Mapping

For the Google Play Console, use the following declarations:

### Data Collection & Sharing
*   **Data Sharing:** NoteBox **does not share** any user data with third parties.
*   **Data Collection:**
    *   **Personal Info:** Email address and User IDs are collected (linked, required, not shared).
    *   **Financial Info:** Purchase history is collected (linked, required, not shared).
    *   **Files and Docs:** User-generated notes and attached media are collected (linked, required, not shared).

### Security Practices
*   **Encryption in Transit:** Yes, all data is transferred over a secure connection (HTTPS).
*   **Account Deletion:** Yes, users can request that their data be deleted. NoteBox provides an in-app "Delete Account" button and a web-based deletion request page.

---

## 3. App Review Notes & Demo Account Details

When submitting the app for review, provide the following instructions in the **App Review Information** section:

### Reviewer Instructions
> **App Description & Context:**
> NoteBox is a private local-first record and pattern clarity app designed for adults (17+). It provides a secure space for users to record personal notes, organize receipts, and optionally receive AI-generated perspectives on their records.
>
> **Access Requirements:**
> NoteBox uses Sign in with Apple. We have pre-configured a credentials bypass for review purposes. Please use the credentials below to log into the test environment.
>
> **Demo Credentials:**
> *   **Method:** Tap "Sign in with Apple" -> Select "Use Demo Credentials" (bypasses native Apple Sign-In sheet in the Sandbox/Review build).
> *   **Username/Email:** `reviewer@notebox.app`
> *   **Password / Verification Pin:** `000000` (Self-declared age: 25)
>
> **StoreKit / Subscription Testing:**
> NoteBox includes a premium subscription tier ("NoteBox Pro"). You can test the subscription flow using the StoreKit sandbox environment by tapping on the Settings -> Upgrade to Pro card. No real money will be charged.

---

## 4. Screenshot Paywall & Disclosure Guide

To satisfy App Store Review Guidelines (specifically 3.1.2 on Subscriptions), the premium paywall screenshots must clearly show:

1.  **Product Disclosures:**
    *   **Plan Name:** NoteBox Pro
    *   **Price:** $4.99 / month (or local equivalent)
    *   **Trial Period:** 14-day free trial, followed by the standard monthly charge.
    *   **First Billing Date:** Visually show the exact date when the trial ends and the first charge occurs.
2.  **Auto-Renewal Verbatim Copy:**
    *   *"Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period."*
3.  **Cancellation Instructions:**
    *   *"Manage or cancel your subscription at any time in your device's App Store Account Settings. How to Cancel."*
4.  **Terms & Privacy Links:**
    *   Include legible, clickable links to the **Terms of Service** and **Privacy Policy** at the bottom of the paywall screen.

---

## 5. In-App Account Deletion Flow (Apple Guideline 5.1.1(v))

Apple requires apps that support account creation to also support account deletion from within the app.

### Deletion Verification Walkthrough
1.  **Navigation:** User taps **Settings** -> **Account Settings** -> **Delete Account** (accessible in exactly 2 taps from the dashboard).
2.  **Disclosure Modal:** User is presented with a clear warning explaining the deletion process:
    *   All boxes, notes, receipts, perspectives, and tags will be soft-deleted immediately.
    *   Data is permanently purged after a 30-day grace period.
    *   *Note: Active App Store subscriptions must be canceled manually via Apple ID Settings.*
3.  **Confirmation Action:** User must check a confirmation box and tap a red button labeled **"Permanently Delete My Account"**.
4.  **Backend Action:** The app issues a `POST /v1/account/delete` request, changing the user's status to `deletion_pending` and logging a hash-chained entry in `privacy_audit_logs`.
