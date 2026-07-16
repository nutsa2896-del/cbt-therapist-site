# Booking System Setup Guide

This guide walks you through setting up the Google Calendar + Google Sheets + Email booking system for the therapy website.

## Overview

The system works like this:
1. You mark available times in your **Google Calendar** by creating events titled "Available"
2. The website reads your calendar and shows clients **only the open slots**
3. When someone books, the system:
   - Creates a `[BOOKED]` event on your calendar
   - Logs the client info to a **Google Sheet** (your client database)
   - Sends a **confirmation email** to the client
   - Sends a **notification email** to you

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it something like **"Therapy Bookings"**
3. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SPREADSHEET_ID/edit
   ```
4. Keep this ID - you'll need it in Step 3

> The script will automatically create the "Bookings" sheet with headers on first use.

---

## Step 2: Create the Google Apps Script

1. Go to [Google Apps Script](https://script.google.com)
2. Click **"New Project"**
3. Delete the default code in `Code.gs`
4. Copy the entire contents of `Code.gs` from this project and paste it in
5. Rename the project to something like **"Therapy Booking Backend"**

---

## Step 3: Configure the Script

In the `Code.gs` file, update the `CONFIG` object at the top:

```javascript
var CONFIG = {
  SPREADSHEET_ID: 'paste_your_spreadsheet_id_here',
  CALENDAR_ID: 'primary',                        // or your calendar email
  THERAPIST_NAME: 'Magda',
  THERAPIST_EMAIL: 'your.email@gmail.com',
  BOOKING_SHEET_NAME: 'Bookings',
  DAYS_AHEAD: 30,
  SESSION_DURATION_MINUTES: 50,
  AVAILABILITY_EVENT_TITLE: 'Available',
  TIMEZONE: 'Asia/Tbilisi'
};
```

**What to change:**
- `SPREADSHEET_ID` → The ID from Step 1
- `THERAPIST_EMAIL` → Your email (for booking notifications)
- `CALENDAR_ID` → Leave as `'primary'` if using your main calendar, or use a specific calendar's email address
- `TIMEZONE` → Your timezone (e.g., `'Europe/London'`, `'America/New_York'`)

---

## Step 4: Deploy as Web App

1. In the Apps Script editor, click **Deploy → New deployment**
2. Click the gear icon ⚙️ and select **"Web app"**
3. Set the configuration:
   - **Description:** `Therapy Booking API v1`
   - **Execute as:** `Me` (your account)
   - **Who has access:** `Anyone`
4. Click **Deploy**
5. **Authorize** the script when prompted (it needs access to Calendar, Sheets, and Gmail)
6. Copy the **Web App URL** - it looks like:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

---

## Step 5: Connect the Website

Open `app.js` and replace the placeholder URL on this line:

```javascript
var APPS_SCRIPT_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_URL_HERE';
```

With your actual deployed URL:

```javascript
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx.../exec';
```

---

## Step 6: Mark Your Availability

This is how clients see available times:

1. Open **Google Calendar**
2. Create events with the **exact title** `Available` on the times you want to offer
3. Each event = one bookable 50-minute slot
4. Tips:
   - You can create recurring "Available" events for regular hours
   - Delete or rename an "Available" event to remove that slot
   - The system only shows slots **24+ hours from now** (gives you buffer)
   - Slots appear up to **30 days ahead** (configurable in CONFIG)

### Example: Setting up a typical week

Create recurring weekly events:
- Monday: "Available" at 09:00, 11:00, 14:00, 16:00
- Tuesday: "Available" at 10:00, 13:00, 15:00
- Wednesday: "Available" at 09:00, 11:00
- etc.

To block a specific day (vacation, sick day), just delete that day's "Available" events.

---

## Step 7: Test It

1. Run the `setupSpreadsheet` function in Apps Script editor to initialize headers
2. Run the `testGetSlots` function to verify calendar reading works
3. Open your website's booking page and verify slots load
4. Make a test booking and check:
   - ✓ Calendar event created with `[BOOKED]` prefix
   - ✓ Row added to Google Sheet
   - ✓ Confirmation email sent to the client's email
   - ✓ Notification email sent to your email

---

## How It Works (Technical)

### Availability Detection
- The script searches for calendar events titled exactly `"Available"` in the next 30 days
- It also finds events starting with `"[BOOKED]"` (previously booked sessions)
- If an "Available" slot overlaps with a "[BOOKED]" event, it's removed from the list
- Only future slots (24+ hours from now) are shown

### Double-Booking Prevention
When someone submits a booking, the script:
1. Re-checks the calendar at that exact moment
2. Confirms the "Available" event still exists AND no "[BOOKED]" event overlaps
3. Only then creates the booking

### Data Stored in Google Sheet
| Booking ID | Timestamp | Name | Email | Format | Date | Time | Notes | Status |
|---|---|---|---|---|---|---|---|---|
| MT-A3K7P2 | 2025-01-15 14:30:00 | Jane Doe | jane@email.com | Online | 2025-01-20 | 10:00 | Anxiety patterns | Confirmed |

---

## Updating the Deployment

When you make changes to `Code.gs`:
1. Go to Apps Script editor
2. Click **Deploy → Manage deployments**
3. Click the ✏️ edit icon on your deployment
4. Change **Version** to "New version"
5. Click **Deploy**

> The URL stays the same, no need to update `app.js`.

---

## Troubleshooting

### "Unable to load available times" on the website
- Check that the Apps Script URL in `app.js` is correct
- Verify the deployment is set to "Anyone" access
- Check the Apps Script execution log (View → Executions) for errors

### No slots showing up
- Make sure you have events titled exactly `Available` (case-sensitive) in your calendar
- Events must be at least 24 hours from now
- Events must be within the next 30 days
- Check that `CALENDAR_ID` in CONFIG is correct

### Emails not sending
- Google has daily email limits (~100/day for free accounts)
- Check the Apps Script execution log for errors
- Make sure you authorized Gmail access during deployment

### "This slot was just booked by someone else"
- This means someone else booked the same slot between page load and submission
- The client should select a different time
- This is working as intended (double-booking prevention)

---

## Security Notes

- The script runs under your Google account's permissions
- Client data is stored in your private Google Sheet
- Emails are sent from your Gmail
- The website uses honeypot fields and rate limiting to prevent spam
- Input is sanitized on both frontend and backend
- The CSP header allows connections only to `script.google.com`
