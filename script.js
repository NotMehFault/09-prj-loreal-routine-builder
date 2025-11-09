/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  // cache products on first load so we can look them up by id later
  if (window._allProductsCache) return window._allProductsCache;

  const response = await fetch("products.json");
  const data = await response.json();
  window._allProductsCache = data.products;
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some((p) => p.id === product.id);
      return `
    <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        product.id
      }">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <div class="product-actions">
          <button class="reveal-desc" data-id="${product.id}">Details</button>
        </div>
      </div>
      <div class="product-desc" data-id-desc="${product.id}" hidden>${
        product.description
      }</div>
    </div>
  `;
    })
    .join("");

  // attach click handlers to each card so users can select/unselect
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = Number(card.getAttribute("data-id"));
      toggleSelection(id);
    });
  });

  // attach reveal buttons (stopPropagation so clicking details doesn't toggle selection)
  document.querySelectorAll(".reveal-desc").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = Number(btn.getAttribute("data-id"));
      await revealDescription(id);
    });
  });
}

/* Selection state */
const selectedProducts = [];
const STORAGE_KEYS = {
  selected: "loreal_selected_product_ids",
  conversation: "loreal_conversation_messages",
};
const clearSelectionsBtn = document.getElementById("clearSelections");

function saveSelectedToStorage() {
  try {
    const ids = selectedProducts.map((p) => p.id);
    localStorage.setItem(STORAGE_KEYS.selected, JSON.stringify(ids));
  } catch (e) {
    // ignore storage errors
  }
}

function loadSelectedFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.selected);
    if (!raw) return;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return;
    // populate selectedProducts from cache (if available)
    const all = window._allProductsCache || [];
    ids.forEach((id) => {
      const prod = all.find((p) => p.id === id);
      if (prod && !selectedProducts.some((s) => s.id === prod.id))
        selectedProducts.push(prod);
    });
  } catch (e) {
    // ignore
  }
}

function clearAllSelections() {
  selectedProducts.length = 0;
  // remove selected class from any visible grid cards
  document
    .querySelectorAll(".product-card.selected")
    .forEach((el) => el.classList.remove("selected"));
  updateSelectedProductsList();
  saveSelectedToStorage();
}

if (clearSelectionsBtn) {
  clearSelectionsBtn.addEventListener("click", () => {
    clearAllSelections();
  });
}

/* Toggle selection for a product id */
function toggleSelection(productId) {
  const idx = selectedProducts.findIndex((p) => p.id === productId);
  if (idx > -1) {
    // already selected -> remove
    selectedProducts.splice(idx, 1);
  } else {
    // add the product object from cache
    const product = (window._allProductsCache || []).find(
      (p) => p.id === productId
    );
    if (product) selectedProducts.push(product);
  }

  // update UI in both areas
  updateGridSelectionVisual(productId);
  updateSelectedProductsList();
  saveSelectedToStorage();
}

/* Add or remove .selected class on grid item */
function updateGridSelectionVisual(productId) {
  const card = document.querySelector(`.product-card[data-id='${productId}']`);
  if (!card) return;
  const isSelected = selectedProducts.some((p) => p.id === productId);
  if (isSelected) card.classList.add("selected");
  else card.classList.remove("selected");
}

/* Render the selected products list and wire remove buttons */
function updateSelectedProductsList() {
  const container = document.getElementById("selectedProductsList");
  if (!container) return;

  if (selectedProducts.length === 0) {
    container.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    return;
  }

  container.innerHTML = selectedProducts
    .map(
      (p) => `
      <div class="selected-item" data-id="${p.id}">
        <img src="${p.image}" alt="${p.name}">
        <div class="selected-item-info">
          <strong>${p.name}</strong>
          <div class="brand">${p.brand}</div>
        </div>
        <button class="remove-selected" aria-label="Remove ${p.name}">&times;</button>
      </div>
    `
    )
    .join("");

  // wire remove buttons
  container.querySelectorAll(".remove-selected").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // stop the click from bubbling to other handlers
      e.stopPropagation();
      const parent = btn.closest(".selected-item");
      const id = Number(parent.getAttribute("data-id"));
      // remove from selectedProducts and update both UI parts
      const idx = selectedProducts.findIndex((p) => p.id === id);
      if (idx > -1) selectedProducts.splice(idx, 1);
      updateSelectedProductsList();
      saveSelectedToStorage();
      // if item is visible in the grid, remove the selected visual
      const gridCard = document.querySelector(`.product-card[data-id='${id}']`);
      if (gridCard) gridCard.classList.remove("selected");
    });
  });
}

/* Filter and display products when category changes */
// initialize selected-products area
updateSelectedProductsList();

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* -----------------------------
   Chat + API integration
   ----------------------------- */

// Conversation memory for follow-ups
const conversationMessages = [];

function saveConversationToStorage() {
  try {
    localStorage.setItem(
      STORAGE_KEYS.conversation,
      JSON.stringify(conversationMessages)
    );
  } catch (e) {
    // ignore
  }
}

function loadConversationFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.conversation);
    if (!raw) return;
    const msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;
    // reset in-memory and render
    conversationMessages.length = 0;
    msgs.forEach((m) => {
      conversationMessages.push(m);
      renderChatMessage(m.role, m.content);
    });
  } catch (e) {
    // ignore
  }
}

function renderChatMessage(role, text) {
  const el = document.createElement("div");
  el.className = `chat-message ${role}`;
  el.textContent = text;
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendChatMessage(role, text) {
  conversationMessages.push({ role, content: text });
  renderChatMessage(role, text);
  saveConversationToStorage();
}

/* Validate that the user question is related to allowed topics */
function isRelatedQuestion(text) {
  const t = (text || "").toLowerCase();
  const allowed = [
    "routine",
    "skincare",
    "skin",
    "haircare",
    "hair",
    "makeup",
    "fragrance",
    "suncare",
    "spf",
    "cleanser",
    "moisturizer",
    "serum",
    "conditioner",
    "shampoo",
    "mascara",
    "foundation",
    "product",
    "apply",
    "when",
    "how",
    "am",
    "pm",
    "morning",
    "night",
    "usage",
  ];

  if (allowed.some((k) => t.includes(k))) return true;
  // allow referencing selected product names or brands
  const namesAndBrands = selectedProducts.flatMap((p) => [
    p.name.toLowerCase(),
    p.brand.toLowerCase(),
  ]);
  if (namesAndBrands.some((s) => s && t.includes(s))) return true;
  return false;
}

/* Try to fetch an enhanced product description from the worker API. Falls back to local description. */
async function revealDescription(productId) {
  const product = (window._allProductsCache || []).find(
    (p) => p.id === productId
  );
  const descEl = document.querySelector(
    `.product-desc[data-id-desc='${productId}']`
  );
  if (!descEl) return;

  // toggle closed if visible
  if (!descEl.hasAttribute("hidden")) {
    descEl.setAttribute("hidden", "");
    return;
  }

  descEl.removeAttribute("hidden");
  const fallback = product?.description || "No description available.";
  descEl.textContent = "Loading description...";

  try {
    const resp = await fetch(
      "https://loreal-worker.logan-l-hunter.workers.dev/Reveal%20Product%20Description",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: { id: product.id, name: product.name, brand: product.brand },
        }),
      }
    );
    if (!resp.ok) throw new Error("Bad network response");
    const data = await resp.json();
    const revealed =
      data?.description ||
      data?.result ||
      (data?.choices && data.choices[0]?.message?.content) ||
      null;
    descEl.textContent = revealed || fallback;
  } catch (err) {
    descEl.textContent = fallback;
  }
}

/* Send messages array to the worker; expect OpenAI-like response. */
async function sendMessagesToWorker(messages) {
  // show loading indicator in chat
  const loading = document.createElement("div");
  loading.className = "chat-message assistant loading";
  loading.textContent = "Generating response...";
  chatWindow.appendChild(loading);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const resp = await fetch(
      "https://loreal-worker.logan-l-hunter.workers.dev/Reveal%20Product%20Description",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      }
    );
    const data = await resp.json();
    loading.remove();

    const text =
      data?.choices?.[0]?.message?.content ||
      data?.result ||
      data?.reply ||
      data?.text ||
      null;
    if (text) {
      return text;
    }
    return null;
  } catch (err) {
    loading.remove();
    appendChatMessage("assistant", "Sorry — failed to contact the API.");
    return null;
  }
}

/* Handle follow-up chat submissions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  // show user message
  appendChatMessage("user", text);
  input.value = "";

  // validate topic
  if (!isRelatedQuestion(text)) {
    appendChatMessage(
      "assistant",
      "Please ask only about the generated routine or related topics (skincare, haircare, makeup, fragrance, or product usage)."
    );
    return;
  }

  // send conversation + new user message
  const messages = conversationMessages.concat([
    { role: "user", content: text },
  ]);
  const reply = await sendMessagesToWorker(messages);
  if (reply) appendChatMessage("assistant", reply);
});

/* Generate Routine button handler */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    appendChatMessage(
      "assistant",
      "Please select at least one product to generate a routine."
    );
    return;
  }

  // collect selected product data
  const payload = selectedProducts.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  const system = {
    role: "system",
    content:
      "You are a helpful routine builder. Create a concise personalized routine using only the supplied products. Include when/how to use each product (AM/PM/order).",
  };
  const user = {
    role: "user",
    content: `Create a personalized routine using these products: ${JSON.stringify(
      payload
    )}`,
  };

  // add to conversation and request routine
  conversationMessages.push(system);
  conversationMessages.push(user);
  appendChatMessage("assistant", "Generating personalized routine...");

  const routine = await sendMessagesToWorker([system, user]);
  if (routine) appendChatMessage("assistant", routine);
  // save conversation after routine generation
  saveConversationToStorage();
});

/* Initialization: load products, restore saved selections and conversation */
(async function init() {
  await loadProducts();
  // restore saved selections (fills selectedProducts from cache)
  loadSelectedFromStorage();
  updateSelectedProductsList();
  // restore chat history
  loadConversationFromStorage();
})();
