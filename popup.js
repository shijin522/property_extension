import { db } from './lib/db.js';

document.getElementById('btnDash').addEventListener('click', () => {
    chrome.tabs.create({ url: 'manager.html' });
});

document.getElementById('btnSave').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if we have handle
    const dirHandle = await db.get('directoryHandle');
    if (!dirHandle) {
        chrome.tabs.create({ url: 'welcome.html' });
        return;
    }

    // Verify permission (often needs user gesture if session expired)
    // In popup context, we are in a user gesture moment.
    try {
        if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
            if ((await dirHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
                alert("Permission denied. Cannot save.");
                return;
            }
        }
    } catch (e) {
        // Sometimes queryPermission throws if handle is invalid
        chrome.tabs.create({ url: 'welcome.html' });
        return;
    }

    // Execute script
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    }, () => {
        chrome.tabs.sendMessage(tab.id, { action: "scrape" }, async (data) => {
            if (!data) {
                alert("Extraction failed.");
                return;
            }

            try {
                // 2. Read Index to find existing
                let props = [];
                try {
                    const dbHandle = await dirHandle.getFileHandle('db.json');
                    const dbFile = await dbHandle.getFile();
                    props = JSON.parse(await dbFile.text());
                } catch (e) { } // New DB

                // Check for duplicate by TITLE (User Request)
                const existIdx = props.findIndex(p => p.title === data.title);

                let id;
                if (existIdx >= 0) {
                    // Update existing
                    id = props[existIdx].id;
                    console.log("Updating existing property by title:", data.title);
                } else {
                    // Create new
                    id = Date.now().toString();
                }

                data.id = id;
                data.status = (existIdx >= 0) ? props[existIdx].status : 'active';
                data.comment = (existIdx >= 0) ? props[existIdx].comment || '' : '';
                data.priority = (existIdx >= 0) ? props[existIdx].priority || false : false;
                data.timestamp = new Date().toISOString();

                // 1. Save HTML to assets/ (Overwrite if exists)
                const assetsDir = await dirHandle.getDirectoryHandle('assets', { create: true });
                const fileHandle = await assetsDir.getFileHandle(`property_${id}.html`, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data.html);
                await writable.close();

                // 3. Update Index
                // Remove html content from JSON to keep it light
                const { html, ...meta } = data;

                if (existIdx >= 0) {
                    props[existIdx] = meta;
                } else {
                    props.push(meta);
                }

                const dbHandle = await dirHandle.getFileHandle('db.json', { create: true });
                const w = await dbHandle.createWritable();
                await w.write(JSON.stringify(props, null, 2));
                await w.close();

                // Show Count
                const count = props.length;
                const btn = document.getElementById('btnSave');
                btn.innerText = `${count} Properties Saved!`;
                alert(`${count} Saved!`);
                setTimeout(() => btn.innerText = "Save Property", 2000);

                // 3. Update Static Dashboard
                // For valid module import reused logic, strictly we should refactor, but for now we skip 
                // re-generating index.html on every save from popup to save time/complexity. 
                // The Manager page will do it.

            } catch (saveErr) {
                console.error(saveErr);
                alert("Error saving: " + saveErr.message);
            }
        });
    });
});
