export const PropertySchema = {
    "Title": {
        "type": "string",
        "description": "The main title of the property listing.",
        "prompt": "Extract the full title of the listing.",
        "selector": "h1.h2, .listing-title, .header-container"
    },
    "Address": {
        "type": "string",
        "description": "Full address of the property.",
        "prompt": "Find the specific address or street name mentioned.",
        "selector": ".listing-address, span[itemprop='streetAddress'], .header-sub-info"
    },
    "Price": {
        "type": "integer",
        "description": "Monthly rent or sale price in SGD.",
        "prompt": "Extract the numeric price value (e.g. 2985). Ignore currency symbols.",
        "selector": ".element-label.price, .price, .amount"
    },
    "Size": {
        "type": "integer",
        "description": "Floor area in square feet.",
        "prompt": "Extract the floor area in sqft as a number.",
        "selector": "li.fontsize-size, .listing-details-items, .property-info-element"
    },
    "Bedrooms": {
        "type": "integer",
        "options": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "description": "Number of bedrooms.",
        "prompt": "Count the number of bedrooms. Return 0 for Studio.",
        "selector": "li.fontsize-bed, .listing-details-items, .property-info-element"
    },
    "Bathrooms": {
        "type": "integer",
        "options": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "description": "Number of bathrooms.",
        "prompt": "Count the number of bathrooms.",
        "selector": "li.fontsize-bath, .listing-details-items, .property-info-element"
    },
    "Renovation Condition": {
        "type": "string",
        "options": ["Bare", "Partially Furnished", "Fully Furnished", "Brand New", "Original Condition", "Unknown"],
        "description": "Furnishing or renovation status.",
        "prompt": "Determine the furnishing status (Bare, Partially, or Fully Furnished) or condition.",
        "selector": ".listing-description, #listing-description, .listing-details-text"
    },
    "Commute Estimate": {
        "type": "integer",
        "description": "Estimated travel time to Capital Tower in minutes.",
        "prompt": "Estimate travel time to 'Capital Tower, Singapore' via public transport based on location clues (e.g. 'near Tg Pagar MRT'). If unknown, say 'N/A'.",
        "selector": ".listing-description, #listing-description, .listing-details-text"
    },
    "Pros": {
        "type": "array",
        "description": "List of key selling points.",
        "prompt": "List up to 3 key selling points.",
        "selector": ".listing-description, #listing-description, .listing-details-text"
    },
    "Cons": {
        "type": "array",
        "description": "List of potential downsides.",
        "prompt": "List any potential downsides mentioned or implied (e.g. 'Walk up', 'No AC').",
        "selector": ".listing-description, #listing-description, .listing-details-text"
    }
};
