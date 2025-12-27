export async function extractBasicTags(doc) {
    const getText = (sel) => {
        const el = doc.querySelector(sel);
        return el ? el.innerText.trim() : "";
    };

    const getMeta = (name) => {
        const el = doc.querySelector(`meta[name="${name}"]`) || doc.querySelector(`meta[property="${name}"]`);
        return el ? el.getAttribute('content') : "";
    };

    // 1. Meta Extraction (High Priority)
    const metaTitle = getMeta('og:title') || getMeta('twitter:title') || getText('title');
    const metaImage = getMeta('og:image') || getMeta('twitter:image');
    const metaUrl = getMeta('og:url') || doc.baseURI;

    // 2. DOM Extraction (Specific)
    const domPrice = getText('.element-label.price') || getText('.price') || getText('[itemprop="price"]');


    /** ---------- address ---------- */
    let address = null;
    const ldJsons = [...doc.querySelectorAll('script[type="application/ld+json"]')];
    for (const s of ldJsons) {
        try {
            const j = JSON.parse(s.textContent);
            if (j?.spatialCoverage?.address?.streetAddress) {
                address = j.spatialCoverage.address.streetAddress;
                break;
            }
        } catch { }
    }

    /** ---------- amenities（判断 room + bed/bath/size） ---------- */
    const amenitiesContainer = doc.querySelector("div.amenities.less-items");
    const amenities = amenitiesContainer
        ? [...amenitiesContainer.querySelectorAll("*")]
            .map(el => el.innerText.trim().toLowerCase())
            .filter(Boolean)
        : [];

    /** ---------- description（判断 master room） ---------- */
    const descContainer = doc.querySelector("div.description-block-root");
    const descriptionText = descContainer
        ? descContainer.innerText.toLowerCase()
        : "";

    /** ---------- size ---------- */
    let size = null;
    for (const a of amenities) {
        const m = a.match(/([\d,]+)\s*sqft/);
        if (m) {
            size = Number(m[1].replace(/,/g, ""));
            break;
        }
    }

    /** ---------- type ---------- */
    let type = "studio/apartment";

    const hasRoomAmenity = amenities.some(a => /\broom\b/.test(a));
    const hasMasterRoomDesc = hasRoomAmenity && descriptionText.includes("master room");

    if (hasMasterRoomDesc) {
        type = "master room";
    } else if (hasRoomAmenity) {
        type = "room";
    }

    /** ---------- bed / bath ---------- */
    let bed = null;
    let bath = null;

    if (type === "studio/apartment") {
        for (const a of amenities) {
            let m;
            if ((m = a.match(/(\d+)\s*bed/))) bed = Number(m[1]);
            if ((m = a.match(/(\d+)\s*bath/))) bath = Number(m[1]);
        }
    }

    // 4. Clean up
    const title = metaTitle || getText('h1');
    const price = domPrice.replace(/[^0-9]/g, '') || "0";

    // Images
    const galleryImages = [...doc.querySelectorAll('.media-gallery-image-grid img')]
        .map(img => img.src)
        .filter(src => src);

    // Fallback to meta image if gallery empty
    if (galleryImages.length === 0 && metaImage) galleryImages.push(metaImage);


    // 5. Commute
    let commuteWalk = "";
    let commuteTransit = "";
    let commuteLink = "#";
    if (address && address.length > 5) {
        commuteLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(address)}&destination=Capital+Tower,+Singapore&travelmode=transit`;
        // 先注释
        // try {
        //     const times = await getCommuteTime(address);
        //     if (times.walk) commuteWalk = Math.round(times.walk / 60); // seconds to minutes
        //     if (times.transit) commuteTransit = Math.round(times.transit / 60);
        // } catch (e) {
        //     console.warn("Commute API error", e);
        // }
    }

    return {
        "Title": title || "",
        "Price": price || "0",
        "Address": address || "",
        "Size": size || "0",
        "Type": type || "",
        "Bedrooms": bed !== null ? bed : "", // 0 is valid for Studio
        "Bathrooms": bath !== null ? bath : "",
        "Images": galleryImages, // Return array of strings
        "Link": metaUrl,
        "Commute Walk": commuteWalk,
        "Commute Transit": commuteTransit,
        "Commute Link": commuteLink
    };
}

async function getCommuteTime(origin) {
    const API_KEY = "AIzaSyBlCo7kpcBszvIZoH709avg1rmUjjiop0k";
    const destination = "Capital Tower, Singapore";
    const results = { walk: null, transit: null };

    try {
        const modes = ['transit', 'walking'];

        for (const mode of modes) {
            // Priority: Try Local Python Proxy (Avoids Referer/CORS issues)
            let data;
            try {
                // Ensure mode is passed to proxy
                const proxyUrl = `http://localhost:5001/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}`;
                const res = await fetch(proxyUrl);
                data = await res.json();
            } catch (localErr) {
                // Fallback: Extension Background Proxy
                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=${mode}&key=${API_KEY}`;
                try {
                    data = await new Promise((resolve, reject) => {
                        chrome.runtime.sendMessage({
                            action: 'PROXY_FETCH',
                            url: url
                        }, response => {
                            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
                            if (response && response.success) resolve(response.data);
                            else reject(response ? response.error : 'Unknown Error');
                        });
                    });
                } catch (extErr) {
                    data = { status: 'PROXY_FAILED' };
                }
            }

            if (data.rows?.[0]?.elements?.[0]?.status === 'OK') {
                const durationValue = data.rows[0].elements[0].duration.value; // seconds
                results[mode === 'walking' ? 'walk' : 'transit'] = durationValue;
            } else {
                console.warn(`Maps API Error (${mode}):`, data);
            }
        }
        return results;
    } catch (e) {
        console.warn("Commute Proxy Error:", e);
        return results;
    }
}
