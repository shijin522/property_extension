import { PropertySchema } from './schema.js';

export async function extractLLMTags(htmlContent, apiKey) {
    if (!apiKey) return { "Error": "No API Key" };

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Step 1: Extract Raw Text for each field based on selectors
        const extractionMap = {};
        let extractionContext = "Here is the raw text extracted from the webpage for each field:\n\n";

        for (const [key, def] of Object.entries(PropertySchema)) {
            let contextText = "Not Found";

            if (def.selector) {
                // Try to find element(s) matching the selector
                const elements = doc.querySelectorAll(def.selector);
                if (elements.length > 0) {
                    // specific logic: if multiple elements, join them (e.g. for lists)
                    // limit length to avoid huge context
                    contextText = Array.from(elements)
                        .map(el => el.innerText.trim())
                        .join(' | ')
                        .replace(/\s+/g, ' ')
                        .substring(0, 2000);
                }
            } else {
                // Fallback to body text if no selector (though we added selectors for all)
                contextText = doc.body.innerText.substring(0, 1000);
            }

            extractionMap[key] = contextText;
            extractionContext += `FIELD: "${key}"\nRAW CONTENT: "${contextText}"\n\n`;
        }

        // Step 2: Send to LLM for Refinement
        const prompt = `
        You are a real estate data assistant. 
        Your task is to refine the raw extracted text into structured data based on the Schema.

        For each FIELD below, read the RAW CONTENT and extract/format the value according to the Instruction.
        
        Schema Definitions:
        ${JSON.stringify(PropertySchema, (k, v) => (k === 'selector' ? undefined : v), 2)}

        ${extractionContext}

        IMPORTANT:
        - Return ONLY a valid JSON object with detailed keys.
        - If the RAW CONTENT defines the value clearly, extract it.
        - If the RAW CONTENT is "Not Found" or irrelevant, try to infer loosely or return null.
        - For integers (Price, Size), return numbers.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        if (data.error) throw new Error("Gemini API Error: " + data.error.message);
        if (!data.candidates?.[0]?.content) throw new Error("Invalid API Response");

        const textResponse = data.candidates[0].content.parts[0].text;
        const jsonStr = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        return JSON.parse(jsonStr);

    } catch (e) {
        console.error("LLM Extraction Error", e);
        return { "Analysis Error": e.message };
    }
}
