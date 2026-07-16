/**
 * Google Apps Script Backend for Magda Therapy Booking System
 * 
 * This script serves as the API backend for the booking website.
 * It integrates with Google Calendar, Google Sheets, and Gmail.
 * 
 * HOW AVAILABILITY WORKS:
 * - The therapist creates events titled "Available" in their Google Calendar
 * - Each "Available" event represents a bookable 50-minute slot
 * - The system reads these events and removes any that are already booked
 * - Clients see only truly available slots on the website
 * 
 * DEPLOYMENT: Deploy as Web App (Execute as: Me, Access: Anyone)
 */

// ============================================================
// CONFIGURATION - Update these values after setup
// ============================================================
var CONFIG = {
  SPREADSHEET_ID: '1YCQe3ozhe1IZ983-cd-QcV0uQyUI2ZXWv9qd7jc43lg',
  CALENDAR_ID: 'primary',
  THERAPIST_NAME: 'Magda',
  THERAPIST_EMAIL: 'info.talktomagda@gmail.com',
  BOOKING_SHEET_NAME: 'Bookings',
  DAYS_AHEAD: 30,                               // How far ahead to show availability
  SESSION_DURATION_MINUTES: 50,
  AVAILABILITY_EVENT_TITLE: 'Available',        // Title of availability events in Calendar
  TIMEZONE: 'Asia/Tbilisi'                      // Adjust to your timezone
};

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================

/**
 * Handles GET requests - returns available time slots
 */
function doGet(e) {
  try {
    var output = getAvailableSlots();
    return buildResponse(200, output);
  } catch (error) {
    Logger.log('doGet error: ' + error.message);
    return buildResponse(500, { error: 'Failed to fetch available slots.' });
  }
}

/**
 * Handles POST requests - processes booking submissions
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result = processBooking(data);
    return buildResponse(result.status, result.body);
  } catch (error) {
    Logger.log('doPost error: ' + error.message);
    return buildResponse(500, { error: 'Failed to process booking.' });
  }
}

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Fetches available slots from Google Calendar
 * Looks for events titled "Available" that don't conflict with existing bookings
 */
function getAvailableSlots() {
  var now = new Date();
  var endDate = new Date();
  endDate.setDate(endDate.getDate() + CONFIG.DAYS_AHEAD);

  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  if (!calendar) {
    throw new Error('Calendar not found. Check CALENDAR_ID in CONFIG.');
  }

  // Get all events in the date range
  var allEvents = calendar.getEvents(now, endDate);

  // Separate availability markers from actual bookings
  var availableSlots = [];
  var bookedSlots = [];

  for (var i = 0; i < allEvents.length; i++) {
    var event = allEvents[i];
    var title = event.getTitle().trim();

    if (title === CONFIG.AVAILABILITY_EVENT_TITLE) {
      availableSlots.push({
        start: event.getStartTime(),
        end: event.getEndTime(),
        id: event.getId()
      });
    } else if (title.indexOf('[BOOKED]') === 0) {
      bookedSlots.push({
        start: event.getStartTime(),
        end: event.getEndTime()
      });
    }
  }

  // Filter out slots that overlap with bookings
  var openSlots = [];
  for (var j = 0; j < availableSlots.length; j++) {
    var slot = availableSlots[j];
    var isBooked = false;

    for (var k = 0; k < bookedSlots.length; k++) {
      if (timesOverlap(slot.start, slot.end, bookedSlots[k].start, bookedSlots[k].end)) {
        isBooked = true;
        break;
      }
    }

    if (!isBooked) {
      // Only include future slots (at least 24 hours from now)
      var minBookingTime = new Date();
      minBookingTime.setHours(minBookingTime.getHours() + 24);

      if (slot.start > minBookingTime) {
        openSlots.push({
          date: Utilities.formatDate(slot.start, CONFIG.TIMEZONE, 'yyyy-MM-dd'),
          time: Utilities.formatDate(slot.start, CONFIG.TIMEZONE, 'HH:mm'),
          displayDate: Utilities.formatDate(slot.start, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy'),
          displayTime: Utilities.formatDate(slot.start, CONFIG.TIMEZONE, 'hh:mm a')
        });
      }
    }
  }

  // Sort by date and time
  openSlots.sort(function (a, b) {
    if (a.date === b.date) return a.time.localeCompare(b.time);
    return a.date.localeCompare(b.date);
  });

  // Group by date for easier frontend rendering
  var grouped = {};
  for (var m = 0; m < openSlots.length; m++) {
    var s = openSlots[m];
    if (!grouped[s.date]) {
      grouped[s.date] = {
        date: s.date,
        displayDate: s.displayDate,
        slots: []
      };
    }
    grouped[s.date].slots.push({
      time: s.time,
      displayTime: s.displayTime
    });
  }

  // Convert to array
  var result = [];
  var dates = Object.keys(grouped).sort();
  for (var n = 0; n < dates.length; n++) {
    result.push(grouped[dates[n]]);
  }

  return { available: result };
}

/**
 * Processes a booking request
 */
function processBooking(data) {
  // Validate required fields
  var validation = validateBookingData(data);
  if (!validation.valid) {
    return { status: 400, body: { error: validation.message } };
  }

  // Double-check that the slot is still available (prevent race conditions)
  var slotAvailable = checkSlotStillAvailable(data.date, data.time);
  if (!slotAvailable) {
    return {
      status: 409,
      body: { error: 'Sorry, this slot was just booked by someone else. Please choose another time.' }
    };
  }

  // All good - process the booking
  var bookingId = generateBookingId();

  // 1. Create calendar event
  createCalendarEvent(data, bookingId);

  // 2. Log to Google Sheet
  logToSheet(data, bookingId);

  // 3. Send confirmation email to client
  sendConfirmationEmail(data, bookingId);

  // 4. Send notification to therapist
  sendTherapistNotification(data, bookingId);

  return {
    status: 200,
    body: {
      success: true,
      message: 'Booking confirmed! A confirmation email has been sent to ' + data.email,
      bookingId: bookingId
    }
  };
}

// ============================================================
// CALENDAR FUNCTIONS
// ============================================================

/**
 * Checks if a specific slot is still available (prevents double-booking)
 */
function checkSlotStillAvailable(date, time) {
  var slotStart = parseDateTime(date, time);
  var slotEnd = new Date(slotStart.getTime() + CONFIG.SESSION_DURATION_MINUTES * 60 * 1000);

  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var events = calendar.getEvents(slotStart, slotEnd);

  var hasAvailability = false;
  var hasBooking = false;

  for (var i = 0; i < events.length; i++) {
    var title = events[i].getTitle().trim();
    if (title === CONFIG.AVAILABILITY_EVENT_TITLE) {
      hasAvailability = true;
    }
    if (title.indexOf('[BOOKED]') === 0) {
      hasBooking = true;
    }
  }

  return hasAvailability && !hasBooking;
}

/**
 * Creates a booked event in Google Calendar
 */
function createCalendarEvent(data, bookingId) {
  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var startTime = parseDateTime(data.date, data.time);
  var endTime = new Date(startTime.getTime() + CONFIG.SESSION_DURATION_MINUTES * 60 * 1000);

  var title = '[BOOKED] ' + data.name + ' - ' + data.format;
  var description = 'Booking ID: ' + bookingId + '\n' +
    'Client: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Format: ' + data.format + '\n' +
    'Notes: ' + (data.notes || 'None');

  calendar.createEvent(title, startTime, endTime, {
    description: description
  });
}

// ============================================================
// GOOGLE SHEETS FUNCTIONS
// ============================================================

/**
 * Logs the booking data to the Google Sheet
 */
function logToSheet(data, bookingId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.BOOKING_SHEET_NAME);

  // Create sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.BOOKING_SHEET_NAME);
    sheet.appendRow([
      'Booking ID', 'Timestamp', 'Name', 'Email',
      'Format', 'Date', 'Time', 'Notes', 'Status'
    ]);
    // Format header row
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  var timestamp = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    bookingId,
    timestamp,
    data.name,
    data.email,
    data.format,
    data.date,
    data.time,
    data.notes || '',
    'Confirmed'
  ]);
}

// ============================================================
// EMAIL FUNCTIONS
// ============================================================

/**
 * Sends a confirmation email to the client
 */
function sendConfirmationEmail(data, bookingId) {
  var startTime = parseDateTime(data.date, data.time);
  var displayDate = Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy');
  var displayTime = Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'hh:mm a');

  var subject = 'Booking Confirmed - ' + CONFIG.THERAPIST_NAME + ' Therapy | ' + displayDate;

  var htmlBody = '<!DOCTYPE html>' +
    '<html><head><meta charset="utf-8"></head><body style="font-family: \'DM Sans\', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">' +
    '<div style="background: linear-gradient(135deg, #2d5a3f 0%, #3d7a55 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">' +
    '<h1 style="margin: 0; font-size: 24px;">Booking Confirmed ✓</h1>' +
    '<p style="margin: 10px 0 0; opacity: 0.9;">' + CONFIG.THERAPIST_NAME + ' Therapy</p>' +
    '</div>' +
    '<div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">' +
    '<p>Dear ' + data.name + ',</p>' +
    '<p>Your therapy session has been successfully booked. Here are the details:</p>' +
    '<div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #2d5a3f; margin: 20px 0;">' +
    '<table style="width: 100%; border-collapse: collapse;">' +
    '<tr><td style="padding: 8px 0; font-weight: bold; width: 120px;">Date:</td><td style="padding: 8px 0;">' + displayDate + '</td></tr>' +
    '<tr><td style="padding: 8px 0; font-weight: bold;">Time:</td><td style="padding: 8px 0;">' + displayTime + '</td></tr>' +
    '<tr><td style="padding: 8px 0; font-weight: bold;">Duration:</td><td style="padding: 8px 0;">' + CONFIG.SESSION_DURATION_MINUTES + ' minutes</td></tr>' +
    '<tr><td style="padding: 8px 0; font-weight: bold;">Format:</td><td style="padding: 8px 0;">' + data.format + '</td></tr>' +
    '<tr><td style="padding: 8px 0; font-weight: bold;">Booking ID:</td><td style="padding: 8px 0; font-family: monospace;">' + bookingId + '</td></tr>' +
    '</table>' +
    '</div>' +
    '<div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">' +
    '<p style="margin: 0; font-size: 14px;"><strong>⚠️ Reminder:</strong> A 48-hour cancellation notice is required. Payment is settled on the day of your session via bank transfer or in person.</p>' +
    '</div>' +
    (data.format === 'Online' ?
      '<p style="font-size: 14px; color: #666;">A secure encrypted meeting link will be sent to you 24 hours before your session.</p>' :
      '<p style="font-size: 14px; color: #666;">Please arrive 5 minutes before your scheduled time at the consultation office.</p>') +
    '<p>If you need to reschedule or cancel, please reply to this email at least 48 hours in advance.</p>' +
    '<p style="margin-top: 30px;">Looking forward to our session,<br><strong>' + CONFIG.THERAPIST_NAME + '</strong></p>' +
    '</div>' +
    '</body></html>';

  var textBody = 'Booking Confirmed - ' + CONFIG.THERAPIST_NAME + ' Therapy\n\n' +
    'Dear ' + data.name + ',\n\n' +
    'Your session is booked:\n' +
    'Date: ' + displayDate + '\n' +
    'Time: ' + displayTime + '\n' +
    'Duration: ' + CONFIG.SESSION_DURATION_MINUTES + ' minutes\n' +
    'Format: ' + data.format + '\n' +
    'Booking ID: ' + bookingId + '\n\n' +
    'Reminder: 48-hour cancellation notice required.\n\n' +
    'Best regards,\n' + CONFIG.THERAPIST_NAME;

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    body: textBody,
    htmlBody: htmlBody,
    name: CONFIG.THERAPIST_NAME + ' Therapy'
  });
}

/**
 * Sends a notification email to the therapist about a new booking
 */
function sendTherapistNotification(data, bookingId) {
  var startTime = parseDateTime(data.date, data.time);
  var displayDate = Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'EEEE, MMMM d, yyyy');
  var displayTime = Utilities.formatDate(startTime, CONFIG.TIMEZONE, 'hh:mm a');

  var subject = '📅 New Booking: ' + data.name + ' | ' + displayDate + ' at ' + displayTime;

  var body = 'New booking received!\n\n' +
    'Client: ' + data.name + '\n' +
    'Email: ' + data.email + '\n' +
    'Date: ' + displayDate + '\n' +
    'Time: ' + displayTime + '\n' +
    'Format: ' + data.format + '\n' +
    'Notes: ' + (data.notes || 'None') + '\n' +
    'Booking ID: ' + bookingId + '\n\n' +
    'This session has been added to your calendar.';

  MailApp.sendEmail({
    to: CONFIG.THERAPIST_EMAIL,
    subject: subject,
    body: body,
    name: 'Booking System'
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Validates booking data
 */
function validateBookingData(data) {
  if (!data.name || data.name.trim().length < 2) {
    return { valid: false, message: 'Valid name is required.' };
  }
  if (!data.email || !isValidEmail(data.email)) {
    return { valid: false, message: 'Valid email is required.' };
  }
  if (!data.format || (data.format !== 'Online' && data.format !== 'In-Person')) {
    return { valid: false, message: 'Valid session format is required.' };
  }
  if (!data.date || !isValidDate(data.date)) {
    return { valid: false, message: 'Valid date is required.' };
  }
  if (!data.time || !isValidTime(data.time)) {
    return { valid: false, message: 'Valid time is required.' };
  }
  return { valid: true };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDate(dateStr) {
  var regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  var date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidTime(timeStr) {
  return /^\d{2}:\d{2}$/.test(timeStr);
}

/**
 * Checks if two time ranges overlap
 */
function timesOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}

/**
 * Parses date string (YYYY-MM-DD) and time string (HH:MM) into a Date object
 */
function parseDateTime(dateStr, timeStr) {
  var parts = dateStr.split('-');
  var timeParts = timeStr.split(':');
  return new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1])
  );
}

/**
 * Generates a unique booking ID
 */
function generateBookingId() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = 'MT-';
  for (var i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Builds a JSON response with CORS headers
 */
function buildResponse(status, data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ============================================================
// SETUP & TESTING HELPERS (run manually from Apps Script editor)
// ============================================================

/**
 * Run this once to initialize the spreadsheet with proper headers
 */
function setupSpreadsheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.BOOKING_SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.BOOKING_SHEET_NAME);
  }

  // Clear and set headers
  sheet.clear();
  sheet.appendRow([
    'Booking ID', 'Timestamp', 'Name', 'Email',
    'Format', 'Date', 'Time', 'Notes', 'Status'
  ]);
  sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Auto-resize columns
  for (var i = 1; i <= 9; i++) {
    sheet.autoResizeColumn(i);
  }

  Logger.log('Spreadsheet setup complete!');
}

/**
 * Test function - simulates fetching available slots
 */
function testGetSlots() {
  var result = getAvailableSlots();
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Test function - simulates a booking (does NOT send email)
 */
function testBookingValidation() {
  var testData = {
    name: 'Test Client',
    email: 'test@example.com',
    format: 'Online',
    date: '2025-01-20',
    time: '10:00',
    notes: 'Test booking'
  };
  var validation = validateBookingData(testData);
  Logger.log('Validation result: ' + JSON.stringify(validation));
}
