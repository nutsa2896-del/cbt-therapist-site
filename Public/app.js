// Paste your live deployed Google Apps Script Web App URL (/exec) between these quotes!
const GOOGLE_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyYJCtm2B1lzwrrrzJyRPKWhe_5Y4rIWNYeb1cphdUZqxfLYBPiDMPyNHOz7Q73R87dQg/exec";

document.getElementById('bookingForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bookingData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        format: document.getElementById('format').value,
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        notes: document.getElementById('notes').value
    };

    try {
        await fetch(GOOGLE_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        alert('🎉 Success! Your booking request has been registered. A confirmation email is on its way.');
        document.getElementById('bookingForm').reset();

    } catch (error) {
        console.error('Error submitting form execution:', error);
        alert('❌ An error occurred connecting to the scheduling system.');
    }
});