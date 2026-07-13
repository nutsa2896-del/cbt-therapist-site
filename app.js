'use strict';

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // Configuration
        var BOOKING_ENDPOINT = '/api/booking';
        var RATE_LIMIT_COOLDOWN = 30000; // 30 seconds between submissions
        var MAX_SUBMISSIONS_PER_SESSION = 5;

        // Rate limiting state
        var submissionCount = 0;
        var lastSubmissionTime = 0;

        // DOM elements
        var form = document.getElementById('bookingForm');
        var submitBtn = document.getElementById('submitBtn');
        var submitBtnWrapper = document.getElementById('submitBtnWrapper');
        var dateInput = document.getElementById('date');
        var notesInput = document.getElementById('notes');

        // Bail out if form doesn't exist on this page
        if (!form || !submitBtn) return;

        // Block past dates in the calendar picker
        if (dateInput) {
            var today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', today);
        }

        // Add max length constraint to notes field
        if (notesInput) {
            notesInput.setAttribute('maxlength', '1000');
        }

        // Security: HTML sanitization to prevent XSS
        function sanitizeInput(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/[<>"'&]/g, function (char) {
                var entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
                return entities[char] || char;
            });
        }

        // Security: Strip all HTML tags completely
        function stripTags(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/<[^>]*>/g, '');
        }

        // Security: Validate and sanitize data before submission
        function validateAndSanitizeBookingData(data) {
            return {
                name: stripTags(data.name.trim()),
                email: stripTags(data.email.trim().toLowerCase()),
                format: stripTags(data.format),
                date: stripTags(data.date),
                time: stripTags(data.time),
                notes: stripTags(data.notes.trim())
            };
        }

        // Security: Check honeypot field
        function isBot() {
            var honeypot = document.getElementById('booking-website');
            return honeypot && honeypot.value.length > 0;
        }

        // Security: Rate limiting check
        function isRateLimited() {
            var now = Date.now();
            if (submissionCount >= MAX_SUBMISSIONS_PER_SESSION) {
                return true;
            }
            if (now - lastSubmissionTime < RATE_LIMIT_COOLDOWN) {
                return true;
            }
            return false;
        }

        // API helper with proper error handling
        function submitBooking(bookingData) {
            return fetch(BOOKING_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(bookingData)
            }).then(function (response) {
                if (!response.ok) {
                    return response.json().catch(function () { return {}; }).then(function (errorData) {
                        throw new Error(errorData.message || 'Server error: ' + response.status);
                    });
                }
                return response.json();
            });
        }

        // Field definitions
        var fields = {
            name: {
                input: document.getElementById('name'),
                helper: document.getElementById('nameHelper'),
                defaultText: 'Please enter your full name.',
                validate: function (val) {
                    var trimmed = val.trim();
                    var safeNamePattern = /^[a-zA-ZÀ-ž\s\-'.]+$/;
                    return trimmed.length >= 2 && trimmed.length <= 100 && safeNamePattern.test(trimmed);
                },
                getErrorText: function (val) {
                    var trimmed = val.trim();
                    if (trimmed.length === 0) return 'Please enter your full name.';
                    if (trimmed.length < 2) return 'Name must be at least 2 characters long.';
                    if (trimmed.length > 100) return 'Name cannot exceed 100 characters.';
                    return 'Name can only contain letters, spaces, hyphens, and apostrophes.';
                }
            },
            email: {
                input: document.getElementById('email'),
                helper: document.getElementById('emailHelper'),
                defaultText: 'We will send your secure session link here.',
                validate: function (val) {
                    var trimmed = val.trim().toLowerCase();
                    var emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                    return trimmed.length >= 5 && trimmed.length <= 254 && !trimmed.includes(' ') && emailRegex.test(trimmed);
                },
                getErrorText: function (val) {
                    var trimmed = val.trim();
                    if (trimmed.length === 0) return 'Please enter your email address.';
                    if (trimmed.includes(' ')) return 'Please enter a valid email address.';
                    if (trimmed.length < 5) return 'Email must be at least 5 characters long.';
                    if (trimmed.length > 254) return 'Email cannot exceed 254 characters.';
                    return 'Please enter a valid email address.';
                }
            },
            format: {
                input: document.getElementById('format'),
                helper: document.getElementById('formatHelper'),
                defaultText: 'Choose how you would prefer to meet.',
                validate: function (val) { return val !== ''; },
                getErrorText: function () { return 'Please select a session format.'; }
            },
            date: {
                input: document.getElementById('date'),
                helper: document.getElementById('dateHelper'),
                defaultText: 'Select your target date.',
                validate: function (val) { return val !== ''; },
                getErrorText: function () { return 'Please select a date.'; }
            },
            time: {
                input: document.getElementById('time'),
                helper: document.getElementById('timeHelper'),
                defaultText: 'Select a 50-minute time block.',
                validate: function (val) { return val !== ''; },
                getErrorText: function () { return 'Please select a time slot.'; }
            }
        };

        // Main validation engine
        function checkFormValidity(forceHighlightEmpty) {
            var formIsValid = true;

            Object.keys(fields).forEach(function (key) {
                var field = fields[key];
                if (!field.input || !field.helper) return;

                var value = field.input.value;
                var hasInputValue = value.length > 0;
                var passesValidation = field.validate(value);

                if ((hasInputValue && !passesValidation) || (forceHighlightEmpty && !passesValidation)) {
                    field.input.classList.add('form-field-invalid');
                    field.input.classList.remove('form-field-valid');
                    field.helper.classList.add('form-field-invalid-helper');
                    field.helper.classList.remove('form-field-valid-helper');
                    field.helper.textContent = field.getErrorText(value);
                    formIsValid = false;
                } else if (!passesValidation) {
                    field.input.classList.remove('form-field-invalid', 'form-field-valid');
                    field.helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
                    field.helper.textContent = field.defaultText;
                    formIsValid = false;
                } else {
                    field.input.classList.add('form-field-valid');
                    field.input.classList.remove('form-field-invalid');
                    field.helper.classList.add('form-field-valid-helper');
                    field.helper.classList.remove('form-field-invalid-helper');
                    field.helper.textContent = '\u2713 Looks great.';
                }
            });

            if (formIsValid) {
                submitBtn.removeAttribute('disabled');
                submitBtn.classList.remove('form-field-invalid');
                if (submitBtnWrapper) submitBtnWrapper.classList.add('form-field-valid');
            } else {
                submitBtn.setAttribute('disabled', 'true');
                if (submitBtnWrapper) submitBtnWrapper.classList.remove('form-field-valid');
            }
        }

        // Attach validation listeners
        Object.keys(fields).forEach(function (key) {
            var input = fields[key].input;
            if (!input) return;
            input.addEventListener('input', function () { checkFormValidity(false); });
            input.addEventListener('change', function () { checkFormValidity(false); });
        });

        // Capture clicks on the wrapper when button is locked
        if (submitBtnWrapper) {
            submitBtnWrapper.addEventListener('click', function () {
                if (submitBtn.hasAttribute('disabled')) {
                    checkFormValidity(true);
                }
            });
        }

        // Form submission handler
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Security: Honeypot check - silently "succeed" for bots
            if (isBot()) {
                submitBtn.textContent = 'Processing Booking...';
                setTimeout(function () {
                    alert('\ud83c\udf89 Success! Your booking request has been registered. A confirmation email is on its way.');
                    form.reset();
                    submitBtn.textContent = 'Confirm Booking Slot';
                }, 1500);
                return;
            }

            // Security: Rate limiting
            if (isRateLimited()) {
                var remaining = Math.ceil((RATE_LIMIT_COOLDOWN - (Date.now() - lastSubmissionTime)) / 1000);
                if (submissionCount >= MAX_SUBMISSIONS_PER_SESSION) {
                    alert('You have reached the maximum number of submissions for this session. Please try again later.');
                } else {
                    alert('Please wait ' + remaining + ' seconds before submitting again.');
                }
                return;
            }

            // Collect and sanitize booking data
            var rawData = {
                name: fields.name.input ? fields.name.input.value : '',
                email: fields.email.input ? fields.email.input.value : '',
                format: fields.format.input ? fields.format.input.value : '',
                date: fields.date.input ? fields.date.input.value : '',
                time: fields.time.input ? fields.time.input.value : '',
                notes: notesInput ? notesInput.value : ''
            };

            var bookingData = validateAndSanitizeBookingData(rawData);

            submitBtn.textContent = 'Processing Booking...';
            submitBtn.setAttribute('disabled', 'true');

            // Track rate limiting
            submissionCount++;
            lastSubmissionTime = Date.now();

            submitBooking(bookingData).then(function () {
                alert('\ud83c\udf89 Success! Your booking request has been registered. A confirmation email is on its way.');
                form.reset();
                Object.keys(fields).forEach(function (key) {
                    if (!fields[key].input || !fields[key].helper) return;
                    fields[key].input.classList.remove('form-field-invalid', 'form-field-valid');
                    fields[key].helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
                    fields[key].helper.textContent = fields[key].defaultText;
                });
                checkFormValidity(false);
            }).catch(function (error) {
                alert('\u274c An error occurred: ' + (error.message || 'Please try again.'));
            }).finally(function () {
                submitBtn.textContent = 'Confirm Booking Slot';
            });
        });
    });
})();
