chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'welcome.html' });
    }
});

// Proxy handler for CORS requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PROXY_FETCH') {
        fetch(request.url, request.options)
            .then(response => response.json())
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the messaging channel open for async response
    }
});
