
const API_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://ebay-ai-app.onrender.com";

let allCategories = {};

async function loadCategories() {
  const res = await fetch(`${API_URL}/categories`);
  allCategories = await res.json();
}

loadCategories();

// ✅ RENDER UI FIRST
document.querySelector('#app').innerHTML = `
  <div class="container">

    <!-- HEADER -->
    <div class="header">
      <img src="https://www.kreatelist.com/assets/img/newIMG/Kreatelist_logo.png" class="logo"/>
      <h1>Kreatelist AI Listing Platform</h1>
    </div>

    <!-- UPLOAD -->
   <div class="card upload-box">

  <label for="images" class="upload-area">
    <div class="upload-icon">📸</div>
    <p class="upload-text"><strong>Click to upload</strong> or drag images</p>
    <span class="upload-subtext">Max 20 images</span>
  </label>

  <input type="file" id="images" multiple hidden />

  <div id="preview" class="preview"></div>

  <button id="generateBtn">Generate Listing</button>

  <p id="loading" class="hidden"></p>

</div>

    <!-- DETAILS -->
    <div class="card">
      <h2>Listing Details</h2>

      <div class="form-grid">
        <div class="full-width">
          <label>Title</label>
          <input id="title" />
        </div>

        <div>
          <label>Price</label>
          <input id="price" />
        </div>

        <div>
          <label>Condition</label>
          <select id="condition">
            <option>New</option>
            <option>Pre-owned</option>
          </select>
        </div>

        <div class="full-width">
          <label>Category ID</label>
          <input id="category" />
        </div>

        <input id="categorySearch" placeholder="Search category..." />
<div id="categoryResults"></div>

        <div class="full-width">
  <label>eBay Category</label>
  <input id="ebay_category" placeholder="Category name" />
</div>

        <div class="full-width">
          <label>Description</label>
          <textarea id="description"></textarea>
        </div>
      </div>
    </div>

    <!-- SPECIFICS -->
    <div class="card">
      <h2>Item Specifics</h2>
      <div id="specifics" class="form-grid"></div>

      <button id="copyBtn">Copy JSON</button>
    </div>

  </div>
`;

// ✅ ELEMENTS
const fileInput = document.getElementById("images");
const preview = document.getElementById("preview");
const loading = document.getElementById("loading");
const generateBtn = document.getElementById("generateBtn");

// ✅ IMAGE PREVIEW
fileInput.addEventListener("change", () => {
  preview.innerHTML = "";

  Array.from(fileInput.files).forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "preview-img";
    preview.appendChild(img);
  });
});

// ✅ MAIN BUTTON CLICK
generateBtn.addEventListener("click", async () => {
  const files = fileInput.files;

  if (!files.length) {
    alert("Upload images first");
    return;
  }

  const formData = new FormData();
  for (let f of files) formData.append("images", f);

  try {
    // 🔄 STEP 1
    loading.classList.remove("hidden");
    loading.innerText = "🔍 Analyzing uploaded images...";

    await delay(800);

    // 🔄 STEP 2
    loading.innerText = "✍️ Generating title & description...";

    await delay(800);

    // 🔄 STEP 3
    loading.innerText = "📦 Fetching item specifics...";

    const res = await fetch(`${API_URL}/generate-from-image`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    // 🔄 STEP 4
    loading.innerText = "✅ Your listing is ready!";

    setTimeout(() => loading.classList.add("hidden"), 1000);

    // ✅ FILL DATA
    document.getElementById("title").value = data.title || "";
    document.getElementById("price").value = data.price || "";
    document.getElementById("condition").value = data.condition || "Pre-owned";
    document.getElementById("category").value = data.category_id || "";
    document.getElementById("ebay_category").value = data.ebay_category || "";
    document.getElementById("description").value = data.description || "";

    // ✅ ITEM SPECIFICS
    const specificsDiv = document.getElementById("specifics");
    specificsDiv.innerHTML = "";

    Object.entries(data.item_specifics || {}).forEach(([key, value]) => {
      const div = document.createElement("div");

      div.innerHTML = `
        <label>${key}</label>
        <input value="${value || ""}" />
      `;

      specificsDiv.appendChild(div);
    });

    // ✅ COPY JSON
    document.getElementById("copyBtn").onclick = () => {
      const updated = {
        title: document.getElementById("title").value,
        price: document.getElementById("price").value,
        condition: document.getElementById("condition").value,
        category_id: document.getElementById("category").value,
        description: document.getElementById("description").value,
        item_specifics: {}
      };

      document.querySelectorAll("#specifics div").forEach(div => {
        const key = div.querySelector("label").innerText;
        const val = div.querySelector("input").value;
        updated.item_specifics[key] = val;
      });

      navigator.clipboard.writeText(JSON.stringify(updated, null, 2));
      alert("Copied!");
    };

  } catch (err) {
    loading.classList.add("hidden");
    alert("Error generating listing");
  }
});

// ⏱ helper delay
function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

const uploadArea = document.querySelector(".upload-area");

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "#5a67ff";
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.style.borderColor = "#cbd5e0";
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();

  const files = e.dataTransfer.files;
  document.getElementById("images").files = files;

  fileInput.dispatchEvent(new Event("change"));
});

document.getElementById("categorySearch").addEventListener("input", function () {
  const query = this.value.toLowerCase();

  const resultsDiv = document.getElementById("categoryResults");
  resultsDiv.innerHTML = "";

  if (!query) return;

  const matches = Object.entries(allCategories)
    .filter(([id, path]) => path.toLowerCase().includes(query))
    .slice(0, 10);

  matches.forEach(([id, path]) => {
    const div = document.createElement("div");
    div.className = "category-item";
    div.innerText = path;

    div.onclick = () => {
      document.getElementById("category").value = id;
      document.getElementById("ebay_category").value = path;
      resultsDiv.innerHTML = "";
    };

    resultsDiv.appendChild(div);
  });
});