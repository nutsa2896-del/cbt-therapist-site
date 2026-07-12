// Configuration: Booking endpoint (should point to your backend)
const BOOKING_ENDPOINT = "/api/booking"; // Replace with your backend URL

// Security: HTML sanitization function to prevent XSS
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Security: Validate and sanitize data before submission
function validateAndSanitizeBookingData(data) {
    return {
        name: sanitizeInput(data.name.trim()),
        email: sanitizeInput(data.email.trim().toLowerCase()),
        format: sanitizeInput(data.format),
        date: sanitizeInput(data.date),
        time: sanitizeInput(data.time),
        notes: sanitizeInput(data.notes.trim())
    };
}

// API helper with proper error handling and security
async function submitBooking(bookingData) {
    try {
        const response = await fetch(BOOKING_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'  // Security: CSRF protection hint
            },
            body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Booking submission failed:', error);
        throw error;
    }
}

// Block past dates in the calendar picker instantly
const dateInput = document.getElementById('date');
if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
}

// Add max length constraint to notes field
const notesInput = document.getElementById('notes');
if (notesInput) {
    notesInput.setAttribute('maxlength', '1000');
}

const form = document.getElementById('bookingForm');
const submitBtn = document.getElementById('submitBtn');
const submitBtnWrapper = document.getElementById('submitBtnWrapper');

const fields = {
    name: {
        input: document.getElementById('name'),
        helper: document.getElementById('nameHelper'),
        defaultText: "Please enter your full name.",
        minLength: 2,
        maxLength: 100,
        validate: (val) => {
            const trimmed = val.trim();
            // Security: Stricter validation - alphanumeric, spaces, and common punctuation only
            const safeNamePattern = /^[a-zA-ZÀ-ž\s\-'.]+$/;
            const isValidLength = trimmed.length >= 2 && trimmed.length <= 100;
            return trimmed.length > 0 && safeNamePattern.test(trimmed) && isValidLength;
        },
        getErrorText: (val) => {
            const trimmed = val.trim();
            if (trimmed.length === 0) return "Please enter your full name.";
            if (trimmed.length < 2) return "Name must be at least 2 characters long.";
            if (trimmed.length > 100) return "Name cannot exceed 100 characters.";
            return "Name can only contain letters, spaces, hyphens, and apostrophes.";
        }
    },
    email: {
        input: document.getElementById('email'),
        helper: document.getElementById('emailHelper'),
        defaultText: "We will send your secure session link here.",
        minLength: 5,
        maxLength: 254,
        validate: (val) => {
            const trimmed = val.trim().toLowerCase();
            // Security: RFC 5322 compliant email regex
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            const hasNoSpaces = !trimmed.includes(' ');
            const isValidLength = trimmed.length >= 5 && trimmed.length <= 254;
            return trimmed.length > 0 && emailRegex.test(trimmed) && hasNoSpaces && isValidLength;
        },
        getErrorText: (val) => {
            const trimmed = val.trim();
            if (trimmed.length === 0) return "Please enter your email address.";
            if (trimmed.includes(' ')) return "Please enter a valid email address.";
            if (trimmed.length < 5) return "Email must be at least 5 characters long.";
            if (trimmed.length > 254) return "Email cannot exceed 254 characters.";
            return "Please enter a valid email address.";
        }
    },
    format: {
        input: document.getElementById('format'),
        helper: document.getElementById('formatHelper'),
        defaultText: "Choose how you would prefer to meet.",
        validate: (val) => val !== "",
        getErrorText: () => "Please select a session format."
    },
    date: {
        input: document.getElementById('date'),
        helper: document.getElementById('dateHelper'),
        defaultText: "Select your target date.",
        validate: (val) => val !== "",
        getErrorText: () => "Please select a date."
    },
    time: {
        input: document.getElementById('time'),
        helper: document.getElementById('timeHelper'),
        defaultText: "Select a 50-minute time block.",
        validate: (val) => val !== "",
        getErrorText: () => "Please select a time slot."
    }
};

// Main validation engine
function checkFormValidity(forceHighlightEmpty = false) {
    let formIsValid = true;

    Object.keys(fields).forEach(key => {
        const field = fields[key];
        const value = field.input.value;
        
        const hasInputValue = value.length > 0;
        const passesValidation = field.validate(value);

        // Highlight if explicitly invalid OR if user tries to click the disabled CTA
        if ((hasInputValue && !passesValidation) || (forceHighlightEmpty && !passesValidation)) {
            field.input.classList.add('form-field-invalid');
            field.input.classList.remove('form-field-valid');
            field.helper.classList.add('form-field-invalid-helper');
            field.helper.classList.remove('form-field-valid-helper');
            field.helper.textContent = field.getErrorText(value);
            formIsValid = false;
        } else if (!passesValidation) {
            // Empty and unclicked state
            field.input.classList.remove('form-field-invalid', 'form-field-valid');
            field.helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
            field.helper.textContent = field.defaultText;
            formIsValid = false;
        } else {
            // Valid state
            field.input.classList.add('form-field-valid');
            field.input.classList.remove('form-field-invalid');
            field.helper.classList.add('form-field-valid-helper');
            field.helper.classList.remove('form-field-invalid-helper');
            field.helper.textContent = "✓ Looks great.";
        }
    });

    if (formIsValid) {
        submitBtn.removeAttribute('disabled');
        submitBtn.classList.remove('form-field-invalid');
        submitBtnWrapper.classList.add('form-field-valid');
    } else {
        submitBtn.setAttribute('disabled', 'true');
        submitBtnWrapper.classList.remove('form-field-valid');
    }
}

// Check validation on user typing
Object.keys(fields).forEach(key => {
    fields[key].input.addEventListener('input', () => checkFormValidity(false));
    fields[key].input.addEventListener('change', () => checkFormValidity(false));
});

// Capture clicks on the wrapper when button is locked
submitBtnWrapper?.addEventListener('click', () => {
    if (submitBtn.hasAttribute('disabled')) {
        checkFormValidity(true);
    }
});

form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Security: Collect and sanitize booking data
    const rawData = {
        name: fields.name.input.value,
        email: fields.email.input.value,
        format: fields.format.input.value,
        date: fields.date.input.value,
        time: fields.time.input.value,
        notes: document.getElementById('notes').value
    };

    const bookingData = validateAndSanitizeBookingData(rawData);

    try {
        submitBtn.textContent = "Processing Booking...";
        submitBtn.setAttribute('disabled', 'true');

        const response = await submitBooking(bookingData);

        alert('🎉 Success! Your booking request has been registered. A confirmation email is on its way.');
        form.reset();
        Object.keys(fields).forEach(key => {
            fields[key].input.classList.remove('form-field-invalid', 'form-field-valid');
            fields[key].helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
            fields[key].helper.textContent = fields[key].defaultText;
        });
        checkFormValidity(false);
    } catch (error) {
        console.error('Error submitting form:', error);
        alert(`❌ An error occurred: ${error.message || 'Please try again.'}`);
    } finally {
        submitBtn.textContent = "Confirm Booking Slot";
    }
});
