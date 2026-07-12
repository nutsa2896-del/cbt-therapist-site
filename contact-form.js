// Contact form handler with backend integration and enhanced security
const CONTACT_ENDPOINT = "/api/contact"; // Replace with your backend URL

// Security: HTML sanitization function to prevent XSS
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Security: Validate and sanitize data before submission
function validateAndSanitizeData(data) {
    return {
        name: sanitizeInput(data.name.trim()),
        email: sanitizeInput(data.email.trim().toLowerCase()),
        message: sanitizeInput(data.message.trim())
    };
}

async function submitContact(contactData) {
    try {
        const response = await fetch(CONTACT_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'  // Security: CSRF protection hint
            },
            body: JSON.stringify(contactData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Contact submission failed:', error);
        throw error;
    }
}

const cForm = document.getElementById('contactForm');

const cFields = {
    name: {
        input: document.getElementById('c-name'),
        helper: document.getElementById('c-nameHelper'),
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
        input: document.getElementById('c-email'),
        helper: document.getElementById('c-emailHelper'),
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
    msg: {
        input: document.getElementById('c-msg'),
        helper: document.getElementById('c-msgHelper'),
        minLength: 10,
        maxLength: 5000,
        validate: (val) => {
            const trimmed = val.trim();
            const isValidLength = trimmed.length >= 10 && trimmed.length <= 5000;
            // Security: Check for suspicious patterns (SQL injection attempts, script tags, etc.)
            const suspiciousPatterns = /<script|javascript:|on\w+\s*=|<iframe|eval\(|document\.cookie/i;
            const hasSuspiciousContent = suspiciousPatterns.test(trimmed);
            return trimmed.length > 0 && isValidLength && !hasSuspiciousContent;
        },
        getErrorText: (val) => {
            const trimmed = val.trim();
            if (trimmed.length === 0) return "Please enter your message.";
            if (trimmed.length < 10) return "Message must be at least 10 characters long.";
            if (trimmed.length > 5000) return "Message cannot exceed 5000 characters.";
            const suspiciousPatterns = /<script|javascript:|on\w+\s*=|<iframe|eval\(|document\.cookie/i;
            if (suspiciousPatterns.test(trimmed)) return "Message contains invalid content.";
            return "Please enter a valid message.";
        }
    }
};

function checkContactValidity() {
    Object.keys(cFields).forEach(key => {
        const field = cFields[key];
        const value = field.input.value;

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
            field.helper.textContent = "✓ Looks great.";
        } else {
            field.input.classList.remove('form-field-invalid', 'form-field-valid');
            field.helper.classList.remove('form-field-invalid-helper', 'form-field-valid-helper');
            field.helper.textContent = "";
        }
    });
}

Object.keys(cFields).forEach(key => {
    cFields[key].input.addEventListener('input', checkContactValidity);
});

cForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    let isValid = true;

    Object.keys(cFields).forEach(key => {
        const field = cFields[key];
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
            field.helper.textContent = "✓ Looks great.";
        }
    });

    if (!isValid) {
        return;
    }

    // Security: Sanitize all input data before submission
    const rawData = {
        name: cFields.name.input.value,
        email: cFields.email.input.value,
        message: cFields.msg.input.value
    };

    const contactData = validateAndSanitizeData(rawData);

    try {
        const submitBtn = document.getElementById('c-submitBtn');
        submitBtn.textContent = "Sending...";
        submitBtn.setAttribute('disabled', 'true');

        await submitContact(contactData);

        alert('✓ Message sent. Logistical messages are addressed within 24 business hours.');
        this.reset();
        Object.keys(cFields).forEach(key => {
            cFields[key].input.classList.remove('form-field-invalid', 'form-field-valid');
            cFields[key].helper.textContent = "";
        });

        submitBtn.textContent = "Send Message";
        submitBtn.removeAttribute('disabled');
    } catch (error) {
        console.error('Error sending contact form:', error);
        alert(`❌ An error occurred: ${error.message || 'Please try again.'}`);
        const submitBtn = document.getElementById('c-submitBtn');
        submitBtn.textContent = "Send Message";
        submitBtn.removeAttribute('disabled');
    }
});
