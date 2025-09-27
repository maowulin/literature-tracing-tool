const text = "深度学习";
const normalized = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
console.log("Normalized:", normalized);
console.log("Length:", normalized.length);

const matches = normalized.match(/[^。.!?！？]+[。.!?！？]?/g);
console.log("Matches:", matches);

if (matches) {
  const step1 = matches.map(s => s.trim());
  console.log("Step 1 (trimmed):", step1);
  
  const step2 = step1.filter(s => s.length > 0);
  console.log("Step 2 (filtered empty):", step2);
  
  const step3 = step2.map(s => s.replace(/[;；\n]+$/, "").trim() || s);
  console.log("Step 3 (cleaned):", step3);
  
  const step4 = step3.filter(s => s.length >= 5);
  console.log("Step 4 (length >= 5):", step4);
  console.log("Final result length:", step4.length);
}

// Test with a longer sentence
const text2 = "深度学习在医学图像分析中的应用。";
console.log("\n--- Testing with longer sentence ---");
console.log("Text:", text2);
const normalized2 = text2.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
const matches2 = normalized2.match(/[^。.!?！？]+[。.!?！？]?/g);
console.log("Matches:", matches2);
if (matches2) {
  const result2 = matches2
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.replace(/[;；\n]+$/, "").trim() || s)
    .filter(s => s.length >= 5);
  console.log("Final result:", result2);
}