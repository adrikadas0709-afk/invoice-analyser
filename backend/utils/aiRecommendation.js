const aiRecommendation = (category, amount) => {
  // 1. Fallback for safe processing
  if (!category || !amount || isNaN(amount)) {
    return "Keep tracking your expenses to build a detailed financial profile.";
  }

  // 2. Define general industry baseline thresholds (e.g., in ₹ or local currency)
  const budgetThresholds = {
    "Food & Beverage": 1000,
    "Travel": 2500,
    "Shopping": 5000,
    "Bills": 8000,
    "Entertainment": 1500,
    "Office Supplies": 4000
  };

  // 3. Get the specific cap limit, or default to a baseline of 3000 for unknown categories
  const limit = budgetThresholds[category] || 3000;

  // 4. Evaluate the spending context dynamically
  if (amount > limit) {
    const overagePercentage = Math.round(((amount - limit) / limit) * 100);
    
    return `Your spending in ${category} is relatively high (₹${amount.toLocaleString()}). You are ${overagePercentage}% over your baseline target. Consider looking for areas to optimize this month.`;
  }

  // 5. Success/Balanced fallback string
  return `Your spending in ${category} stands at ₹${amount.toLocaleString()}, which is well within your balanced target range. Keep it up!`;
};

module.exports = aiRecommendation;