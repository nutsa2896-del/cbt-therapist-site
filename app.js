'use strict';

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // FAQ Disclaimer dismiss handler
        var disclaimer = document.getElementById('faqDisclaimer');
        var dismissBtn = document.getElementById('dismissDisclaimer');
        if (disclaimer && dismissBtn) {
            dismissBtn.addEventListener('click', function () {
                disclaimer.classList.add('hidden');
            });
        }

        // ============================================================
        // CONFIGURATION
        // ============================================================
        // IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
        var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjh5fkxQJ52gp-ofxTb6y_KhDo931czgk6QZS-jp-N1WQbktBPVYqrRcT0cQkOEDOv/exec';

        var RATE_LIMIT_COOLDOWN = 30000; // 30 seconds between submissions
        var MAX_SUBMISSIONS_PER_SESSION = 5;

        // State
        var submissionCount = 0;
        var lastSubmissionTime = 0;
        var availableSlots = []; // Cached availability data
        var selectedDate = '';
        var selectedTime = '';

        // DOM elements
        var form = document.getElementById('bookingForm');
        var submitBtn = document.getElementById('submitBtn');
        var submitBtnWrapper = document.getElementById('submitBtnWrapper');
        var notesInput = document.getElementById('notes');
        var dateInput = document.getElementById('date');
        var timeInput = document.getElementById('time');

        // Availability section elements
        var slotsLoading = document.getElementById('slotsLoading');
        var slotsError = document.getElementById('slotsError');
        var slotsEmpty = document.getElementById('slotsEmpty');
        var datePickerContainer = document.getElementById('datePickerContainer');
        var datePicker = document.getElementById('datePicker');
        var timePickerContainer = document.getElementById('timePickerContainer');
        var timePicker = document.getElementById('timePicker');
        var selectedDateLabel = document.getElementById('selectedDateLabel');
        var slotHelper = document.getElementById('slotHelper');
        var retryBtn = document.getElementById('retryLoadSlots');

        // Bail out if form doesn't exist on this page
        if (!form || !submitBtn) return;

        // ============================================================
        // SECURITY HELPERS
        // ============================================================

        function sanitizeInput(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/[<>"'&]/g, function (char) {
                var entities = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;' };
                return entities[char] || char;
            });
        }

        function stripTags(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/<[^>]*>/g, '');
        }

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

        function isBot() {
            var honeypot = document.getElementById('booking-website');
            return honeypot && honeypot.value.length > 0;
        }

        function isRateLimited() {
            var now = Date.now();
            if (submissionCount >= MAX_SUBMISSIONS_PER_SESSION) return true;
            if (now - lastSubmissionTime < RATE_LIMIT_COOLDOWN) return true;
            return false;
        }

        // ============================================================
        // AVAILABILITY LOADING
        // ============================================================

        /**
         * Fetches available slots from the Google Apps Script backend
         */
        function loadAvailableSlots() {
            showLoadingState();

            fetch(APPS_SCRIPT_URL, {
                method: 'GET',
                redirect: 'follow'
            })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(function (data) {
                availableSlots = data.available || [];
                if (availableSlots.length === 0) {
                    showEmptyState();
                } else {
                    renderDatePicker();
                    showDatePicker();
                }
            })
            .catch(function (error) {
                console.error('Failed to load slots:', error);
                showErrorState();
            });
        }

        function showLoadingState() {
            slotsLoading.style.display = 'flex';
            slotsError.style.display = 'none';
            slotsEmpty.style.display = 'none';
            datePickerContainer.style.display = 'none';
            timePickerContainer.style.display = 'none';
        }

        function showErrorState() {
            slotsLoading.style.display = 'none';
            slotsError.style.display = 'block';
            slotsEmpty.style.display = 'none';
            datePickerContainer.style.display = 'none';
            timePickerContainer.style.display = 'none';
        }

        function showEmptyState() {
            slotsLoading.style.display = 'none';
            slotsError.style.display = 'none';
            slotsEmpty.style.display = 'block';
            datePickerContainer.style.display = 'none';
            timePickerContainer.style.display = 'none';
        }

        function showDatePicker() {
            slotsLoading.style.display = 'none';
            slotsError.style.display = 'none';
            slotsEmpty.style.display = 'none';
            datePickerContainer.style.display = 'block';
        }

        // ============================================================
        // DATE PICKER RENDERING
        // ============================================================

        /**
         * Renders available dates as selectable buttons
         */
        function renderDatePicker() {
            datePicker.innerHTML = '';

            for (var i = 0; i < availableSlots.length; i++) {
                var dayData = availableSlots[i];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'date-btn';
                btn.setAttribute('role', 'option');
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('data-date', dayData.date);

                // Parse date for display
                var dateParts = dayData.date.split('-');
                var dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                var dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                var dayNum = dateObj.getDate();
                var monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });

                btn.innerHTML =
                    '<span class="date-btn-day">' + dayName + '</span>' +
                    '<span class="date-btn-num">' + dayNum + '</span>' +
                    '<span class="date-btn-month">' + monthName + '</span>' +
                    '<span class="date-btn-slots">' + dayData.slots.length + ' slot' + (dayData.slots.length > 1 ? 's' : '') + '</span>';

                btn.addEventListener('click', handleDateSelect);
                datePicker.appendChild(btn);
            }
        }

        /**
         * Handles date button click
         */
        function handleDateSelect(e) {
            var btn = e.currentTarget;
            var date = btn.getAttribute('data-date');

            // Update selection state
            var allDateBtns = datePicker.querySelectorAll('.date-btn');
            for (var i = 0; i < allDateBtns.length; i++) {
                allDateBtns[i].classList.remove('selected');
                allDateBtns[i].setAttribute('aria-selected', 'false');
            }
            btn.classList.add('selected');
            btn.setAttribute('aria-selected', 'true');

            selectedDate = date;
            dateInput.value = date;

            // Clear time selection
            selectedTime = '';
            timeInput.value = '';

            // Render time slots for this date
            renderTimePicker(date);
            checkFormValidity(false);
        }

        // ============================================================
        // TIME PICKER RENDERING
        // ============================================================

        /**
         * Renders available time slots for the selected date
         */
        function renderTimePicker(date) {
            timePicker.innerHTML = '';
            timePickerContainer.style.display = 'block';

            // Find slots for this date
            var dayData = null;
            for (var i = 0; i < availableSlots.length; i++) {
                if (availableSlots[i].date === date) {
                    dayData = availableSlots[i];
                    break;
                }
            }

            if (!dayData || dayData.slots.length === 0) {
                timePicker.innerHTML = '<p class="no-times">No times available for this date.</p>';
                return;
            }

            // Update the label
            selectedDateLabel.textContent = dayData.displayDate;

            // Create time buttons
            for (var j = 0; j < dayData.slots.length; j++) {
                var slot = dayData.slots[j];
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'time-btn';
                btn.setAttribute('role', 'option');
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('data-time', slot.time);
                btn.textContent = slot.displayTime;

                btn.addEventListener('click', handleTimeSelect);
                timePicker.appendChild(btn);
            }
        }

        /**
         * Handles time button click
         */
        function handleTimeSelect(e) {
            var btn = e.currentTarget;
            var time = btn.getAttribute('data-time');

            // Update selection state
            var allTimeBtns = timePicker.querySelectorAll('.time-btn');
            for (var i = 0; i < allTimeBtns.length; i++) {
                allTimeBtns[i].classList.remove('selected');
                allTimeBtns[i].setAttribute('aria-selected', 'false');
            }
            btn.classList.add('selected');
            btn.setAttribute('aria-selected', 'true');

            selectedTime = time;
            timeInput.value = time;

            // Update helper text
            if (slotHelper) {
                slotHelper.textContent = '✓ Date and time selected.';
                slotHelper.classList.add('form-field-valid-helper');
                slotHelper.classList.remove('form-field-invalid-helper');
            }

            checkFormValidity(false);
        }

        // ============================================================
        // FORM VALIDATION
        // ============================================================

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
                defaultText: 'We will send your booking confirmation here.',
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
                helper: null, // handled by slotHelper
                defaultText: '',
                validate: function (val) { return val !== ''; },
                getErrorText: function () { return 'Please select a date.'; }
            },
            time: {
                input: document.getElementById('time'),
                helper: null, // handled by slotHelper
                defaultText: '',
                validate: function (val) { return val !== ''; },
                getErrorText: function () { return 'Please select a time slot.'; }
            }
        };

        function checkFormValidity(forceHighlightEmpty) {
            var formIsValid = true;

            // Validate text/select fields
            var visibleFields = ['name', 'email', 'format'];
            for (var i = 0; i < visibleFields.length; i++) {
                var key = visibleFields[i];
                var field = fields[key];
                if (!field.input || !field.helper) continue;

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
                    field.helper.textContent = '✓ Looks great.';
                }
            }

            // Validate date/time selection
            if (!selectedDate || !selectedTime) {
                formIsValid = false;
                if (forceHighlightEmpty && slotHelper) {
                    slotHelper.textContent = !selectedDate ? 'Please select a date.' : 'Please select a time slot.';
                    slotHelper.classList.add('form-field-invalid-helper');
                    slotHelper.classList.remove('form-field-valid-helper');
                }
            }

            // Update submit button state
            if (formIsValid) {
                submitBtn.removeAttribute('disabled');
                submitBtn.classList.remove('form-field-invalid');
                if (submitBtnWrapper) submitBtnWrapper.classList.add('form-field-valid');
            } else {
                submitBtn.setAttribute('disabled', 'true');
                if (submitBtnWrapper) submitBtnWrapper.classList.remove('form-field-valid');
            }
        }

        // Attach validation listeners to visible fields
        var inputFields = ['name', 'email', 'format'];
        for (var i = 0; i < inputFields.length; i++) {
            var input = fields[inputFields[i]].input;
            if (!input) continue;
            input.addEventListener('input', function () { checkFormValidity(false); });
            input.addEventListener('change', function () { checkFormValidity(false); });
        }

        // Wrapper click validation
        if (submitBtnWrapper) {
            submitBtnWrapper.addEventListener('click', function () {
                if (submitBtn.hasAttribute('disabled')) {
                    checkFormValidity(true);
                }
            });
        }

        // ============================================================
        // FORM SUBMISSION
        // ============================================================

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Honeypot check
            if (isBot()) {
                submitBtn.textContent = 'Processing Booking...';
                setTimeout(function () {
                    alert('🎉 Success! Your booking request has been registered. A confirmation email is on its way.');
                    form.reset();
                    submitBtn.textContent = 'Confirm Booking Slot';
                }, 1500);
                return;
            }

            // Rate limiting
            if (isRateLimited()) {
                var remaining = Math.ceil((RATE_LIMIT_COOLDOWN - (Date.now() - lastSubmissionTime)) / 1000);
                if (submissionCount >= MAX_SUBMISSIONS_PER_SESSION) {
                    alert('You have reached the maximum number of submissions for this session. Please try again later.');
                } else {
                    alert('Please wait ' + remaining + ' seconds before submitting again.');
                }
                return;
            }

            // Final validation
            checkFormValidity(true);
            if (submitBtn.hasAttribute('disabled')) return;

            // Collect and sanitize data
            var rawData = {
                name: fields.name.input ? fields.name.input.value : '',
                email: fields.email.input ? fields.email.input.value : '',
                format: fields.format.input ? fields.format.input.value : '',
                date: selectedDate,
                time: selectedTime,
                notes: notesInput ? notesInput.value : ''
            };

            var bookingData = validateAndSanitizeBookingData(rawData);

            // UI feedback
            submitBtn.textContent = 'Processing Booking...';
            submitBtn.setAttribute('disabled', 'true');

            // Track rate limiting
            submissionCount++;
            lastSubmissionTime = Date.now();

            // Submit to Google Apps Script
            fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain'  // Apps Script requires text/plain for CORS
                },
                body: JSON.stringify(bookingData)
            })
            .then(function (response) {
                return response.json();
            })
            .then(function (result) {
                if (result.error) {
                    throw new Error(result.error);
                }
                // Success!
                alert('🎉 Booking Confirmed!\n\n' +
                    'A confirmation email has been sent to ' + bookingData.email + '.\n\n' +
                    'Booking ID: ' + (result.bookingId || 'N/A') + '\n\n' +
                    'Remember: 48-hour cancellation notice is required.');

                // Reset form
                form.reset();
                selectedDate = '';
                selectedTime = '';
                dateInput.value = '';
                timeInput.value = '';

                // Reset field styles
                var fieldKeys = ['name', 'email', 'format'];
                for (var i = 0; i < fieldKeys.length; i++) {
                    var field = fields[fieldKeys[i]];
                    if (!field.input || !field.helper) continue;
                    field.input.classList.remove('form-field-invalid', 'form-field-valid');
                    field.helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
                    field.helper.textContent = field.defaultText;
                }

                // Reset slot helper
                if (slotHelper) {
                    slotHelper.textContent = 'Select a date, then choose a time slot.';
                    slotHelper.classList.remove('form-field-valid-helper', 'form-field-invalid-helper');
                }

                // Reload available slots (the booked one should now be gone)
                loadAvailableSlots();
                checkFormValidity(false);
            })
            .catch(function (error) {
                alert('❌ ' + (error.message || 'An error occurred. Please try again.'));
            })
            .finally(function () {
                submitBtn.textContent = 'Confirm Booking Slot';
            });
        });

        // ============================================================
        // RETRY BUTTON
        // ============================================================
        if (retryBtn) {
            retryBtn.addEventListener('click', function () {
                loadAvailableSlots();
            });
        }

        // ============================================================
        // INITIALIZE
        // ============================================================
        loadAvailableSlots();
    });
})();
