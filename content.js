function scrape() {
    // Basic Metadata Extraction
    const getText = (sel) => document.querySelector(sel)?.innerText?.trim() || "";

    const title = getText('h1.h2') || getText('.listing-title') || document.title;
    const price = getText('.element-label.price') || getText('.price') || "N/A";
    const address = getText('.listing-address') || getText('span[itemprop="streetAddress"]') || "";

    // Commute Link
    let mapLink = "";
    if (address) {
        mapLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(address)}&destination=Capital+Tower,+Singapore&travelmode=transit`;
    }

    // Images
    const images = Array.from(document.querySelectorAll('img'))
        .map(img => img.src)
        .filter(src => src && src.includes('pgimgs.com') && !src.includes('user-photo'))
        .slice(0, 5); // Top 5

    // Prepare HTML with absolute links
    const docClone = document.documentElement.cloneNode(true);

    // 1. Base Tag (Safety)
    const base = document.createElement('base');
    base.href = window.location.origin;
    const head = docClone.querySelector('head');
    if (head) head.prepend(base);

    // 2. Hard convert links to absolute to ensure they work offline
    const stickAbsolute = (el, attr) => {
        if (el.hasAttribute(attr)) {
            // Using the property (el.href) returns the resolved absolute URL
            // We set the attribute to this resolved value
            const abs = el[attr];
            el.setAttribute(attr, abs);
        }
    };

    docClone.querySelectorAll('a').forEach(a => stickAbsolute(a, 'href'));
    docClone.querySelectorAll('img').forEach(img => stickAbsolute(img, 'src'));
    docClone.querySelectorAll('link').forEach(l => stickAbsolute(l, 'href'));
    docClone.querySelectorAll('script').forEach(s => stickAbsolute(s, 'src'));

    // Explicitly fix Title Link if we can find it, to point to current page if it's relative
    // (Usually the title in the page is just text, but if there are breadcrumbs/links, they are fixed above)

    return {
        url: window.location.href,
        title,
        price,
        address,
        images,
        mapLink,
        html: docClone.outerHTML
    };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'scrape') {
        sendResponse(scrape());
    }
});
