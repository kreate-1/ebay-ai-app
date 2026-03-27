process.on("uncaughtException", (err) => {
  console.error("🔥 UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("🔥 PROMISE ERROR:", err);
});

console.log("🔥 Server starting...");

// ✅ IMPORTS
import fs from "fs";
import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

// ✅ FIX __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ INIT APP
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// ✅ FILE UPLOAD
const upload = multer({ dest: "uploads/" });

// ✅ CATEGORY MAP
const categoryMap = {};

// ✅ LOAD CSV (ROBUST)
const csvPath = path.join(__dirname, "categories.csv");
console.log("📂 CSV Path:", csvPath);

try {
  const data = fs.readFileSync(csvPath, "utf8");

  const lines = data.split("\n");

  lines.forEach((line, index) => {
    if (index === 0) return;
    if (!line.trim()) return;

    const firstComma = line.indexOf(",");

    if (firstComma === -1) return;

    const id = line.slice(0, firstComma).replace(/"/g, "").trim();
    const pathName = line.slice(firstComma + 1).replace(/"/g, "").trim();

    if (id && pathName) {
      categoryMap[id] = pathName;
    }
  });

  console.log("✅ Categories loaded:", Object.keys(categoryMap).length);
} catch (err) {
  console.error("❌ CSV LOAD ERROR:", err.message);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


function buildSmartTitle(data) {
  const s = data.item_specifics || {};
  const desc = (data.description || "").toLowerCase();

  const brand = clean(s.Brand);
  const gender = normalizeGender(s.Gender || s.Department);
  const color = clean(s.Color);
  const type = clean(s.Type || s.Style);
  const size = clean(s.Size);

  // 🔥 Extract smarter features
  let features = [];

  if (s.Style) features.push(s.Style);
  if (s.Material) features.push(s.Material);
  if (s.Pattern) features.push(s.Pattern);

  // 🔥 Extract from description (POWER BOOST)
  if (desc.includes("high rise")) features.push("High Rise");
  if (desc.includes("mid rise")) features.push("Mid Rise");
  if (desc.includes("low rise")) features.push("Low Rise");

  if (desc.includes("stretch")) features.push("Stretch");
  if (desc.includes("elastic")) features.push("Elastic Waist");
  if (desc.includes("button")) features.push("Button");

  if (desc.includes("slim")) features.push("Slim Fit");
  if (desc.includes("regular fit")) features.push("Regular Fit");
  if (desc.includes("relaxed")) features.push("Relaxed Fit");

  // remove junk words
  const removeWords = ["unknown", "casual", "clothing"];

  features = features
    .map(f => String(f).trim())
    .filter(f => f && !removeWords.some(r => f.toLowerCase().includes(r)))
    .slice(0, 3); // max 3 strong keywords

  // 🔥 FINAL STRUCTURE (eBay optimized)
  let parts = [
    brand,
    gender,
    color,
    ...features,
    type,
    size ? "Size " + size : ""
  ];

  let title = parts
    .filter(Boolean)
    .join(" ")
    .replace(/[\/,()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 🔥 REMOVE DUPLICATES (important)
  const words = [];
  title = title
    .split(" ")
    .filter(word => {
      const w = word.toLowerCase();
      if (words.includes(w)) return false;
      words.push(w);
      return true;
    })
    .join(" ");

  return title.substring(0, 80);
}

function clean(val) {
  if (!val) return "";
  val = String(val).trim();
  if (val.toLowerCase() === "unknown") return "";
  return val;
}

function normalizeGender(val) {
  if (!val) return "";

  const v = val.toLowerCase();

  if (v.includes("men")) return "Mens";
  if (v.includes("women")) return "Womens";
  if (v.includes("unisex")) return "Unisex";

  return ""; // ❌ DO NOT GUESS
}

function extractFeatures(features) {
  if (!features) return [];

  let arr = Array.isArray(features)
    ? features
    : features.split(",");

  const removeWords = [
    "shirt", "top", "casual", "clothing", "unknown"
  ];

  return arr
    .map(f => f.toLowerCase().trim())
    .filter(f => f && !removeWords.some(r => f.includes(r)))
    .slice(0, 2)
    .map(f => f.replace(/\b\w/g, c => c.toUpperCase()));
}
// ✅ ROUTES (OUTSIDE MAIN API)



// Category API
app.get("/categories", (req, res) => {
  res.json(categoryMap);
});

// 🔥 MAIN AI ROUTE
app.post("/generate-from-image", upload.array("images", 20), async (req, res) => {
  try {
    console.log("📥 Request received");

    if (!req.files || req.files.length === 0) {
      return res.status(400).send("No images uploaded");
    }

    const imageInputs = req.files.map(file => {
      const base64 = fs.readFileSync(file.path, "base64");

      return {
        type: "input_image",
        image_url: `data:image/jpeg;base64,${base64}`
      };
    });

    const response = await openai.responses.create({
      model: "gpt-5",
      text: { format: { type: "json_object" } },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
Analyze all images. They belong to ONE product.

Return ONLY ONE JSON object.

FORMAT:
{
  "title": "",
  "category_id": "",
  "ebay_category": "",
  "condition": "",
  "condition_description": "",
  "price": "",
  "quantity": 1,
  "item_specifics": {},
  "description": ""
}

TITLE RULES (STRICT & SMART):

- Build a natural, SEO-optimized eBay title
- Use ONLY confirmed attributes from images
- DO NOT guess Gender, Size, or Brand
- If unknown → SKIP it

- Prioritize this order:
  Brand → Gender → Color → Product Type → Key Features → Size 

- Include high-value keywords buyers search for
- Avoid repetition
- Keep under 80 characters

GOOD EXAMPLES:
Nike Air Mens Max 200 Bordeaux Black Mens Athletic Sneakers Size 10 AQ2568-001
Cynthia Rowley Womens White Botanical Leaf Print Linen Cap Sleeve Tee Size Large
Talbots Womens Brown High Rise Comfort Corduroy Straight Leg Pants Size 12P

BAD:
Mens Blue Shirt Large Casual Top

CATEGORY:
- Return BOTH category_id and ebay_category
- ebay_category must NOT be empty

ITEM SPECIFICS:
- 15–20 fields minimum
- Category-specific

IMPORTANT:
- ebay_category must be FULL path EXACTLY like eBay
- Example:
  Clothing, Shoes & Accessories > Men > Shirts
- Do NOT guess category_id

CRITICAL:

- If Gender is not clearly visible → leave it blank
- If Size is not visible → DO NOT include size
- If Brand is not visible → DO NOT guess

STRICT:
- ONE product
- NO array
- VALID JSON only
`
            },
            ...imageInputs
          ]
        }
      ]
    });

    let parsed;

    try {
      parsed = JSON.parse(response.output_text);
    } catch {
      const match = response.output_text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Invalid JSON from AI");
      parsed = JSON.parse(match[0]);
    }

    if (Array.isArray(parsed)) parsed = parsed[0];

    // ✅ FIX TITLE
parsed.title = buildSmartTitle(parsed);

    // ✅ FIX CATEGORY
    const catId = String(parsed.category_id);

    parsed.ebay_category =
      categoryMap[catId] || "Other / Needs Review";

    console.log("Category:", parsed.category_id, parsed.ebay_category);

    // ✅ CLEAN FILES
    req.files.forEach(file => {
      fs.unlink(file.path, () => {});
    });

    res.json(parsed);

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).send(err.message);
  }
});

const frontendPath = path.join(__dirname, "public");

app.use(express.static(frontendPath));

// Express 5 safe fallback
app.use((req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ================= START =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});