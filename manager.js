import { db } from './lib/db.js';
import { extractBasicTags } from './extractors/basic.js';
import { extractLLMTags } from './extractors/llm.js';

let allProps = [];
let dirHandle = null;

async function init() {
    try {
        dirHandle = await db.get('directoryHandle');
        if (!dirHandle) {
            alert("No folder linked. Please run setup.");
            return;
        }

        const perm = await dirHandle.queryPermission({ mode: 'readwrite' });

        if (perm === 'granted') {
            await syncAndLoad();
            render();
            // Auto-Analyze on load to ensure fresh data
            runAnalysis(false);
        } else {
            const btnAuth = document.getElementById('btnAuth');
            btnAuth.style.display = 'block';
            btnAuth.addEventListener('click', async () => {
                const newPerm = await dirHandle.requestPermission({ mode: 'readwrite' });
                if (newPerm === 'granted') {
                    btnAuth.style.display = 'none';
                    await syncAndLoad();
                    render();
                    runAnalysis(false);
                } else {
                    alert("Permission denied.");
                }
            });
        }

        // document.getElementById('btnSettings').addEventListener('click', () => { chrome.tabs.create({ url: 'settings.html' }); });
        document.getElementById('btnAnalyzeAll').addEventListener('click', () => runAnalysis(true));
        document.getElementById('btnExport').addEventListener('click', exportCSV);
        // document.getElementById('btnRefresh').addEventListener('click', async () => { await syncAndLoad(); render(); });
        document.getElementById('chkShowDeleted').addEventListener('change', render);
        document.getElementById('chkOnlyPriority').addEventListener('change', render);

        // Lightbox Listeners
        document.getElementById('lbClose').addEventListener('click', () => document.getElementById('lightbox').style.display = 'none');
        document.getElementById('lbPrev').addEventListener('click', () => changeLightboxImage(-1));
        document.getElementById('lbNext').addEventListener('click', () => changeLightboxImage(1));
        document.getElementById('lightbox').addEventListener('click', (e) => {
            if (e.target.id === 'lightbox') document.getElementById('lightbox').style.display = 'none';
        });

    } catch (e) {
        console.error(e);
        alert("Error loading manager: " + e.message);
    }
}

// Lightbox State
let currentLbImages = [];
let currentLbIndex = 0;

function openLightbox(images, index) {
    if (!images || images.length === 0) return;
    currentLbImages = images;
    currentLbIndex = index;
    updateLightbox();
    document.getElementById('lightbox').style.display = 'flex';
}

function updateLightbox() {
    const img = document.getElementById('lbImg');
    const counter = document.getElementById('lbCounter');
    img.src = currentLbImages[currentLbIndex];
    counter.innerText = `${currentLbIndex + 1} / ${currentLbImages.length}`;
}

function changeLightboxImage(dir) {
    let newIndex = currentLbIndex + dir;
    if (newIndex < 0) newIndex = currentLbImages.length - 1;
    if (newIndex >= currentLbImages.length) newIndex = 0;
    currentLbIndex = newIndex;
    updateLightbox();
}

// ... existing exportCSV ...

// ... existing syncAndLoad ...

// ... existing runAnalysis ...

// ... existing loadData / saveData ...

// Tag Visibility State
let hiddenTags = new Set();

function render() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = "";

    // Dynamic Header Rendering
    const thead = document.querySelector('thead tr');
    if (thead) {
        thead.innerHTML = "";

        // Define Columns Config
        const cols = [
            { id: 'Actions', label: 'Actions', always: true, cls: 'col-actions' },
            { id: 'Images', label: 'Images', tag: 'Images', cls: 'col-images' }, // Changed: made togglable
            { id: 'Title', label: 'Title', tag: 'Title', cls: 'col-title' },
            { id: 'Type', label: 'Type', tag: 'Type', cls: '' },
            { id: 'Price', label: 'Price', tag: 'Price', cls: 'col-price' },
            { id: 'Size', label: 'Size', tag: 'Size', cls: 'col-size' },
            { id: 'BedBath', label: 'Bed/Bath', tag: 'Bedrooms', cls: '' },
            { id: 'Address', label: 'Address', tag: 'Address', cls: '' },
            { id: 'Commute', label: 'CommuteTime (to Capital Tower)', tag: 'Commute Time', cls: '' }, // Consolidated tag
            { id: 'Comments', label: 'Comments', always: true, cls: '' }
        ];

        // Filter Columns based on Hidden Tags
        const visibleCols = cols.filter(c => {
            if (c.always) return true;

            // Special handling for composite columns
            if (c.id === 'BedBath') return !(hiddenTags.has('Bedrooms') && hiddenTags.has('Bathrooms')); // Only hide if BOTH hidden
            if (c.id === 'Size') return !hiddenTags.has('Size'); // Simplified to just Size
            if (c.id === 'Images') return !hiddenTags.has('Images'); // Handle legacy tag

            return !hiddenTags.has(c.tag);
        });

        // Render Header
        visibleCols.forEach(c => {
            const th = document.createElement('th');
            if (c.id === 'Commute') {
                // Add Info Icon
                const span = document.createElement('span');
                span.innerText = c.label;
                const info = document.createElement('span');
                info.innerText = " ⓘ";
                info.style.cursor = "pointer";
                info.style.color = "#1976D2";
                info.title = "Click for info";
                info.onclick = () => alert("因为google map api限制，无法自动返回通勤时间，附上Map链接，支持手动输入时间");
                th.appendChild(span);
                th.appendChild(info);
            } else {
                th.innerText = c.label;
            }
            if (c.cls) th.className = c.cls;
            thead.appendChild(th);
        });

        // Filters logic
        const showDeleted = document.getElementById('chkShowDeleted').checked;
        const onlyPriority = document.getElementById('chkOnlyPriority').checked;

        // Collect detected tags
        const allTags = new Set();
        allProps.forEach(p => { if (p.tags) Object.keys(p.tags).forEach(k => allTags.add(k)); });

        // Virtual Tag Adjustments
        // Remove raw Commute tags from UI list and add 'Commute Time'
        ['Commute Walk', 'Commute Transit', 'Commute Link', 'Commute Estimate'].forEach(t => allTags.delete(t));
        allTags.add('Commute Time');

        // Normalize Images tag
        if (allTags.has('Image')) allTags.add('Images'); // Ensure Images is standard
        allTags.delete('Image'); // We'll rely on 'Images' for key


        const tagDiv = document.getElementById('tagFilters');
        if (tagDiv) {
            const sortedTags = Array.from(allTags).sort();
            tagDiv.innerHTML = `<span style="font-weight:bold; color:#555; margin-right:10px;">Detected Fields:</span>`;

            sortedTags.forEach(t => {
                const s = document.createElement('span');
                s.className = 'chip';
                s.innerText = t;
                s.style.cursor = 'pointer';

                if (hiddenTags.has(t)) {
                    s.style.backgroundColor = '#e0e0e0';
                    s.style.color = '#999';
                    s.style.textDecoration = 'line-through';
                } else {
                    s.style.backgroundColor = '#e3f2fd'; // Blue-ish for active
                    s.style.color = '#0d47a1';
                    s.style.fontWeight = '500';
                }

                s.addEventListener('click', () => {
                    if (hiddenTags.has(t)) hiddenTags.delete(t);
                    else hiddenTags.add(t);
                    render();
                });
                tagDiv.appendChild(s);
            });
        }

        const filtered = allProps.filter(p => {
            if (!showDeleted && p.status === 'deleted') return false;
            if (onlyPriority && !p.priority) return false;
            return true;
        });

        filtered.forEach(p => {
            const tr = document.createElement('tr');
            if (p.status === 'deleted') tr.style.opacity = "0.5";
            if (p.priority) tr.style.backgroundColor = "#fff0f0";

            const tags = p.tags || {};
            // Prepare Data Cells

            // 1. Actions
            const actionsCell = `<td>
                <div style="display:flex; gap:5px;">
                    <button class="btn-priority" title="Toggle Priority">${p.priority ? '★' : '☆'}</button>
                    <button class="btn-delete" title="Delete">${p.status === 'deleted' ? '♻️' : '🗑️'}</button>
                </div>
            </td>`;

            // 2. Image
            let images = tags.Images || (tags.Images ? [tags.Images] : []) || p.images || [];
            if (typeof images === 'string') images = [images];
            if (images.length > 0 && typeof images[0] !== 'string') images = images.map(i => i.src || i);
            const mainImg = images[0] || "";
            const imageCell = `<td>
                ${mainImg ? `<div class="img-wrapper" style="cursor:pointer; position:relative;">
                    <img src="${mainImg}" style="width:70px; height:50px; object-fit:cover; border-radius:4px;">
                    <span style="position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.6); color:white; font-size:9px; padding:1px 3px;">${images.length}</span>
                </div>` : '<div style="width:70px; height:50px; background:#eee;"></div>'}
            </td>`;

            // 3. Title
            const url = p.url || tags.Link || "#";
            const title = tags.Title || p.title || "No Title";
            const titleCell = `<td><a href="${url}" target="_blank" style="text-decoration:none; color:#1a73e8; font-weight:600;">${title}</a></td>`;

            // 4. Type
            const typeCell = `<td>${tags.Type || "-"}</td>`;

            // 5. Price
            const priceCell = `<td style="color:#d93025; font-weight:700;">${tags.Price || p.price || ""}</td>`;

            // 6. Size
            const sizeCell = `<td>${tags.Size || tags.Area || ""}</td>`;

            // 7. Bed/Bath
            const bed = tags.Bedrooms || "?";
            const bath = tags.Bathrooms || "?";
            let bbText = `${bed} Bed / ${bath} Bath`;
            if (hiddenTags.has('Bedrooms') && !hiddenTags.has('Bathrooms')) bbText = `${bath} Bath`;
            if (!hiddenTags.has('Bedrooms') && hiddenTags.has('Bathrooms')) bbText = `${bed} Bed`;
            if (hiddenTags.has('Bedrooms') && hiddenTags.has('Bathrooms')) bbText = "-"; // Should be hidden by column filter, but fallback
            const bedBathCell = `<td>${bbText}</td>`;

            // 8. Address
            const addressCell = `<td style="font-size:0.9em; color:#555;">${tags.Address || p.address || ""}</td>`;

            // 9. Commute
            const cWalk = tags["Commute Walk"] ? Number(tags["Commute Walk"]) : null;
            const cTransit = tags["Commute Transit"] ? Number(tags["Commute Transit"]) : null;

            let minCommute = null;
            if (cWalk !== null && cTransit !== null) minCommute = Math.min(cWalk, cTransit);
            else if (cWalk !== null) minCommute = cWalk;
            else if (cTransit !== null) minCommute = cTransit;

            let cDisplay = "";
            if (minCommute !== null) {
                // Show info: walk vs bus icons based on what was shorter or available? 
                // Requests logic "Commute Time应该是步行时间和公共交通时间取min"
                // Let's just show the number + 'mins'. 
                // Maybe add icon? If walk is shortest, show walk icon?
                const icon = (cWalk !== null && cWalk === minCommute) ? "🚶" : "🚌";
                cDisplay = `${icon} ${minCommute} m`;
            }

            // Fallback to Manual
            if (!cDisplay) {
                cDisplay = `<input type="text" class="manual-commute" value="${p.manualCommute || ''}" style="width:80px; border:1px solid #ddd; padding:2px;">`;
            }

            const commuteLink = tags["Commute Link"] || p.mapLink || "#";
            const commuteCell = `<td>
                <div style="font-weight:500;">${cDisplay}</div>
                <a href="${commuteLink}" target="_blank" style="font-size:0.8em; color:#1976D2; text-decoration:none;">View Map</a>
            </td>`;

            // 10. Comments
            const commentsCell = `<td>
                <textarea style="width:100%; height:50px; resize:vertical; border:1px solid #ddd; border-radius:4px; font-family:inherit; font-size:0.9em; padding:4px;">${p.comment || ''}</textarea>
            </td>`;

            // Build Row HTML
            let rowHtml = "";
            visibleCols.forEach(c => {
                if (c.id === 'Actions') rowHtml += actionsCell;
                if (c.id === 'Images') rowHtml += imageCell;
                if (c.id === 'Title') rowHtml += titleCell;
                if (c.id === 'Type') rowHtml += typeCell;
                if (c.id === 'Price') rowHtml += priceCell;
                if (c.id === 'Size') rowHtml += sizeCell;
                if (c.id === 'BedBath') rowHtml += bedBathCell;
                if (c.id === 'Address') rowHtml += addressCell;
                if (c.id === 'Commute') rowHtml += commuteCell;
                if (c.id === 'Comments') rowHtml += commentsCell;
            });

            tr.innerHTML = rowHtml;

            // Bind Listeners
            const ta = tr.querySelector('textarea');
            if (ta) ta.addEventListener('change', () => { p.comment = ta.value; saveData(); });

            const manualCommuteInput = tr.querySelector('.manual-commute');
            if (manualCommuteInput) {
                manualCommuteInput.addEventListener('change', () => {
                    p.manualCommute = manualCommuteInput.value;
                    saveData();
                });
            }

            const btnPri = tr.querySelector('.btn-priority');
            if (btnPri) btnPri.addEventListener('click', () => { p.priority = !p.priority; saveData(); render(); });

            const btnDel = tr.querySelector('.btn-delete');
            if (btnDel) btnDel.addEventListener('click', () => { p.status = p.status === 'deleted' ? 'active' : 'deleted'; saveData(); render(); });

            const imgWrap = tr.querySelector('.img-wrapper');
            if (imgWrap) imgWrap.addEventListener('click', () => openLightbox(images, 0));

            tbody.appendChild(tr);
        });
    }
}

function exportCSV() {
    if (!allProps || allProps.length === 0) {
        alert("No properties to export.");
        return;
    }

    const headers = ["ID", "Title", "Type", "Price", "Size", "Bed", "Bath", "Address", "Commute (Capital Tower)", "Commute Link", "Link", "Comments"];
    const csvRows = [headers.join(",")];

    allProps.forEach(p => {
        if (p.status === 'deleted') return; // Skip deleted

        const tags = p.tags || {};
        const safe = (text) => `"${(text || "").toString().replace(/"/g, '""')}"`;

        const cWalk = tags["Commute Walk"] ? `🚶 ${tags["Commute Walk"]}m` : "";
        const cTransit = tags["Commute Transit"] ? `🚌 ${tags["Commute Transit"]}m` : "";
        let commuteVal = [cWalk, cTransit].filter(Boolean).join(" | ");
        if (!commuteVal) commuteVal = p.manualCommute || "N/A";

        const row = [
            safe(p.id),
            safe(tags.Title || p.title),
            safe(tags.Type || ""),
            safe(tags.Price || p.price),
            safe(tags.Size || tags.Area),
            safe(tags.Bedrooms),
            safe(tags.Bathrooms),
            safe(tags.Address || p.address),
            safe(commuteVal),
            safe(tags["Commute Link"] || p.mapLink),
            safe(p.url || tags.Link),
            safe(p.comment)
        ];
        csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    // Create temp link to download
    const a = document.createElement('a');
    a.href = url;
    a.download = `properties_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Sync files from directory and update DB
async function syncAndLoad() {
    try {
        await loadData(); // Load existing DB

        // Scan directory
        const assetsDir = await dirHandle.getDirectoryHandle('assets');
        const foundIds = new Set();

        for await (const [name, handle] of assetsDir.entries()) {
            if (name.startsWith('property_') && name.endsWith('.html')) {
                const id = name.replace('property_', '').replace('.html', '');
                foundIds.add(id);

                // Add if new
                if (!allProps.find(p => p.id === id)) {
                    allProps.push({
                        id: id,
                        timestamp: Date.now(),
                        tags: {},
                        priority: false,
                        status: 'active'
                    });
                }
            }
        }

        // Optional: Mark missing as deleted? 
        // User implied "check how many files... update info", implies exact sync.
        // Let's mark missing as 'deleted' logically if not found? 
        // Or just trust the directory State. Ideally if file is gone, it's gone.
        // But user might want to keep history. Let's just Add New for now. 
        // Sync Logic: If file exists, ensure it's in DB.

        await saveData();
    } catch (e) {
        console.error("Sync Error", e);
    }
}

async function runAnalysis(showConfirm = true) {
    if (showConfirm && !confirm("This will scan all local HTML files and update tags. Continue?")) return;

    // Get API Key (Disabled)
    // const res = await chrome.storage.local.get(['gemini_api_key']);
    // const apiKey = res.gemini_api_key;
    const apiKey = null;

    document.getElementById('btnAnalyzeAll').innerText = "Analyzing...";
    document.getElementById('btnAnalyzeAll').disabled = true;

    try {
        const assetsDir = await dirHandle.getDirectoryHandle('assets');
        let changed = false;

        // Parallel batching could be faster, but sequential is safer for now
        for (let i = 0; i < allProps.length; i++) {
            const p = allProps[i];
            if (p.status === 'deleted') continue;

            const filename = `property_${p.id}.html`;
            try {
                const fileHandle = await assetsDir.getFileHandle(filename);
                const file = await fileHandle.getFile();
                const htmlText = await file.text();

                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');

                const basicTags = await extractBasicTags(doc);
                let llmTags = {};
                // if (apiKey) llmTags = await extractLLMTags(htmlText, apiKey);

                p.tags = { ...basicTags, ...llmTags };
                changed = true;

                document.getElementById('btnAnalyzeAll').innerText = `Analyzing ${i + 1}/${allProps.length}...`;

            } catch (err) {
                console.error(`Failed to analyze property ${p.id}`, err);
                // console.error(err.stack); // Print stack trace for debugging
            }
        }

        if (changed) {
            await saveData();
            render();
            if (showConfirm) alert("Analysis Complete!");
        }

    } catch (e) {
        alert("Error during analysis: " + e.message);
    } finally {
        document.getElementById('btnAnalyzeAll').innerText = "🤖 Analyze All";
        document.getElementById('btnAnalyzeAll').disabled = false;
    }
}

async function loadData() {
    try {
        const fileHandle = await dirHandle.getFileHandle('db.json');
        const file = await fileHandle.getFile();
        const text = await file.text();
        allProps = JSON.parse(text);
    } catch (e) { allProps = []; }
}

async function saveData() {
    try {
        const fileHandle = await dirHandle.getFileHandle('db.json', { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(allProps, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Save error", e);
    }
}



init();
