// settings.js

document.addEventListener('DOMContentLoaded', () => {
    // Load existing key
    chrome.storage.local.get(['gemini_api_key'], (res) => {
        if (res.gemini_api_key) {
            document.getElementById('apiKey').value = res.gemini_api_key;
        }
    });

    // Save key
    document.getElementById('btnSave').addEventListener('click', () => {
        const key = document.getElementById('apiKey').value.trim();
        if (!key) {
            alert("Please enter a key.");
            return;
        }

        chrome.storage.local.set({ 'gemini_api_key': key }, () => {
            const msg = document.getElementById('msg');
            msg.style.display = 'inline';
            setTimeout(() => msg.style.display = 'none', 1500);

            // Optional: Close tab after short delay or let user close
        });
    });
});
