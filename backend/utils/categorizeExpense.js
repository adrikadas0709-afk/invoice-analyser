const categorizeExpense = (invoiceText) => {
  if (!invoiceText) return "Other";
  
  const text = invoiceText.toLowerCase();

  const generalRules = [
    {
      category: "Food & Beverage",
      keywords: ["coffee", "tea", "cafe", "dine", "restaurant", "food", "burger", "pizza", "meal", "kitchen", "bakery", "sweet", "bar", "pub"]
    },
    {
      category: "Travel",
      keywords: ["cab", "ride", "taxi", "transit", "airline", "flight", "airways", "railway", "train", "metro", "fuel", "petrol", "diesel", "toll"]
    },
    {
      category: "Shopping",
      keywords: ["apparel", "clothing", "shoes", "mall", "mart", "store", "supermarket", "grocery", "boutique", "retail", "fashion"]
    },
    {
      category: "Bills",
      keywords: ["utility", "electric", "power", "water", "sewer", "gas", "telecom", "mobile", "broadband", "wi-fi", "premium", "insurance", "rent"]
    },
    {
      category: "Entertainment",
      keywords: ["stream", "subscription", "music", "video", "cinema", "theatre", "show", "ticket", "game", "arcade", "stadium"]
    },
    {
      category: "Office Supplies",
      keywords: ["paper", "stationery", "print", "ink", "toner", "courier", "shipping", "software", "cloud", "saas", "desk", "shipping"]
    }
  ];

  // Scan the text for general industry-wide keywords
  for (const rule of generalRules) {
    const matchFound = rule.keywords.some(keyword => text.includes(keyword));
    if (matchFound) {
      return rule.category;
    }
  }

  return "Other";
};

module.exports = categorizeExpense;