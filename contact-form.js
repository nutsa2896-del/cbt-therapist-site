'use strict';

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // Configuration
        var CONTACT_ENDPOINT = '/api/contact';
        var RATE_LIMIT_COOLDOWN = 30000; // 30 seconds between submissions
        var MAX_SUBMISSIONS_PER_SESSION = 5;

        // Rate limiting state
        var submissionCount = 0;
        var lastSubmissionTime = 0;

        // DOM elements
        var form = document.getElementById('contactForm');
        var submitBtn = document.getElementById('c-submitBtn');

        // Bail out if form doesn't exist on this page
        if (!form || !submitBtn) return;

        // Security: Strip all HTML tags
        function stripTags(input) {
            if (typeof input !== 'string') return '';
            return input.replace(/<[^>]*>/g, '');
        }

        // Security: Validate and sanitize data before submission
        function validateAndSanitizeData(data) {
            return {
                name: stripTags(data.name.trim()),
                email: stripTags(data.email.trim().toLowerCase()),
                message: stripTags(data.message.trim())
            };
        }

        // Security: Check honeypot field
        function isBot() {
            var honeypot = document.getElementById('contact-website');
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

        // API helper
        function submitContact(contactData) {
            return fetch(CONTACT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(contactData)
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
        var cFields = {
            name: {
                input: document.getElementById('c-name'),
                helper: document.getElementById('c-nameHelper'),
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
                input: document.getElementById('c-email'),
                helper: document.getElementById('c-emailHelper'),
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
            msg: {
                input: document.getElementById('c-msg'),
                helper: document.getElementById('c-msgHelper'),
                validate: function (val) {
                    var trimmed = val.trim();
                    var suspiciousPatterns = /<script|javascript:|on\w+\s*=|<iframe|eval\(|document\.cookie/i;
                    return trimmed.length >= 10 && trimmed.length <= 5000 && !suspiciousPatterns.test(trimmed);
                },
                getErrorText: function (val) {
                    var trimmed = val.trim();
                    if (trimmed.length === 0) return 'Please enter your message.';
                    if (trimmed.length < 10) return 'Message must be at least 10 characters long.';
                    if (trimmed.length > 5000) return 'Message cannot exceed 5000 characters.';
                    var suspiciousPatterns = /<script|javascript:|on\w+\s*=|<iframe|eval\(|document\.cookie/i;
                    if (suspiciousPatterns.test(trimmed)) return 'Message contains invalid content.';
                    return 'Please enter a valid message.';
                }
            }
        };

        // Validation UI updater
        function checkContactValidity() {
            Object.keys(cFields).forEach(function (key) {
                var field = cFields[key];
                if (!field.input || !field.helper) return;

                var value = field.input.value;

                if (value.length > 0 && !field.validate(value)) {
                    field.input.classList.add('form-field-invalid');
                    field.input.classList.remove('form-field-valid');
                    field.helper.classList.add('form-field-invalid-helper');
                    field.helper.classList.remove('form-field-valid-helper');
                    field.helper.textContent = field.getErrorText(value);
                } else if (value.length > 0) {
                    field.input.classList.add('form-field-valid');
                    field.input.classList.remove('form-field-invalid');
                    field.helper.classList.add('form-field-valid-helper');
                    field.helper.classList.remove('form-field-invalid-helper');
                    field.helper.textContent = '\u2713 Looks great.';
                } else {
                    field.input.classList.remove('form-field-invalid', 'form-field-valid');
                    field.helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
                    field.helper.textContent = '';
                }
            });
        }

        // Attach validation listeners
        Object.keys(cFields).forEach(function (key) {
            var input = cFields[key].input;
            if (!input) return;
            input.addEventListener('input', checkContactValidity);
        });

        // Form submission handler
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Security: Honeypot check - fake success for bots
            if (isBot()) {
                submitBtn.textContent = 'Sending...';
                setTimeout(function () {
                    alert('\u2713 Message sent. Logistical messages are addressed within 24 business hours.');
                    form.reset();
                    submitBtn.textContent = 'Send Message';
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

            // Validate all fields
            var isValid = true;
            Object.keys(cFields).forEach(function (key) {
                var field = cFields[key];
                if (!field.input || !field.helper) return;

                if (!field.validate(field.input.value)) {
                    field.input.classList.add('form-field-invalid');
                    field.input.classList.remove('form-field-valid');
                    field.helper.classList.add('form-field-invalid-helper');
                    field.helper.classList.remove('form-field-valid-helper');
                    field.helper.textContent = field.getErrorText(field.input.value);
                    isValid = false;
                } else {
                    field.input.classList.add('form-field-valid');
                    field.input.classList.remove('form-field-invalid');
                    field.helper.classList.add('form-field-valid-helper');
                    field.helper.classList.remove('form-field-invalid-helper');
                    field.helper.textContent = '\u2713 Looks great.';
                }
            });

            if (!isValid) return;

            // Sanitize all input data
            var rawData = {
                name: cFields.name.input ? cFields.name.input.value : '',
                email: cFields.email.input ? cFields.email.input.value : '',
                message: cFields.msg.input ? cFields.msg.input.value : ''
            };

            var contactData = validateAndSanitizeData(rawData);

            submitBtn.textContent = 'Sending...';
            submitBtn.setAttribute('disabled', 'true');

            // Track rate limiting
            submissionCount++;
            lastSubmissionTime = Date.now();

            submitContact(contactData).then(function () {
                alert('\u2713 Message sent. Logistical messages are addressed within 24 business hours.');
                form.reset();
                Object.keys(cFields).forEach(function (key) {
                    if (!cFields[key].input || !cFields[key].helper) return;
                    cFields[key].input.classList.remove('form-field-invalid', 'form-field-valid');
                    cFields[key].helper.textContent = '';
                });
                submitBtn.textContent = 'Send Message';
                submitBtn.removeAttribute('disabled');
            }).catch(function (error) {
                alert('\u274c An error occurred: ' + (error.message || 'Please try again.'));
                submitBtn.textContent = 'Send Message';
                submitBtn.removeAttribute('disabled');
            });
        });
    });
})();
