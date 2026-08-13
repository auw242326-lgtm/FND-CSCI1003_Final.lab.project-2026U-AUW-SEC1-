/**
 * Smart Food Expiry Tracker
 * script.js — Pure Vanilla JavaScript
 *
 * Features:
 *  1. Dashboard stats (total, fresh, expiring, expired, saved)
 *  2. Add / Edit a Delete food items
 *  3. Image upload (stored as base64 in localStorage)
 *  4. Expiry detection (fresh / expiring soon / expired)
 *  5. Search by name (live filter)
 *  6. Sort by name, expiry date, status
 *  7. LocalStorage persistence
 *  8. Recipe suggestions
 *  9. Food Waste Tracker (eco-friendly counter)
 * 10. Expiry reminder popup
 * 11. Statistics (progress bars with percentages)
 * 12. Dark mode toggle (persisted)
 * 13. Export CSV
 * 14. Print-friendly view
 * 15. Confirmation dialog before delete
 * 16. Duplicate validation & input validation
 * 17. Empty state
 */

'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const STORAGE_KEY      = 'foodItems';
const SAVED_COUNT_KEY  = 'foodSavedCount';
const DARK_MODE_KEY    = 'darkMode';

const RECIPE_MAP = [
  { keywords: ['bread'],              suggestion: '💡 Make Toast' },
  { keywords: ['egg'],                suggestion: '💡 Make Omelette' },
  { keywords: ['potato'],             suggestion: '💡 Make French Fries' },
  { keywords: ['rice'],               suggestion: '💡 Make Fried Rice' },
  { keywords: ['milk'],               suggestion: '💡 Make Milkshake' },
  { keywords: ['banana'],             suggestion: '💡 Make Banana Shake' },
];

const STATUS_LABELS = {
  fresh:    'Fresh',
  expiring: 'Expiring Soon',
  expired:  'Expired',
};

const STATUS_BADGE_CLASS = {
  fresh:    'badge-fresh',
  expiring: 'badge-expiring',
  expired:  'badge-expired',
};

/* ============================================================
   STATE
   ============================================================ */
let items       = [];   // FoodItem[]
let savedCount  = 0;    // number
let editingId   = null; // string | null (id of item being edited)
let deleteTarget = null; // FoodItem | null
let imageBase64  = null; // string | null (current form image)
let currentSearch = '';
let currentSort   = 'expiry-soonest';

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * Calculate whole days until (or since) expiry.
 * Negative = already expired.
 * @param {string} expiryDateStr  "YYYY-MM-DD"
 * @returns {number}
 */
function daysUntilExpiry(expiryDateStr) {
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr + 'T00:00:00');
  const diffMs = expiry.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get the status of a food item based on its expiry date.
 * @param {string} expiryDateStr
 * @returns {'fresh'|'expiring'|'expired'}
 */
function getFoodStatus(expiryDateStr) {
  const days = daysUntilExpiry(expiryDateStr);
  if (days < 0)   return 'expired';
  if (days <= 3)  return 'expiring';
  return 'fresh';
}

/**
 * Build a human-readable day-until-expiry label.
 * @param {string} expiryDateStr
 * @returns {string}
 */
function getDayLabel(expiryDateStr) {
  const status = getFoodStatus(expiryDateStr);
  const days   = daysUntilExpiry(expiryDateStr);
  if (status === 'expired') {
    const abs = Math.abs(days);
    return abs === 1 ? 'Expired 1 day ago' : `Expired ${abs} days ago`;
  }
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `In ${days} days`;
}

/**
 * Get recipe suggestion for a food item.
 * @param {string} name
 * @returns {string}
 */
function getRecipeSuggestion(name) {
  const lower = name.toLowerCase();
  for (const entry of RECIPE_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.suggestion;
    }
  }
  return '💡 Use in a simple meal';
}

/**
 * Get eco-friendly message based on saved count.
 * @param {number} count
 * @returns {string}
 */
function getEcoMessage(count) {
  if (count <= 0)  return 'Start saving food to see your impact! 🌱';
  if (count <= 5)  return "Great start! You've saved some food from waste! ♻️";
  if (count <= 15) return "Amazing! You're a food waste fighter! 🌍";
  return "Incredible! You're a true eco-champion! 🏆";
}

/**
 * Format a YYYY-MM-DD date string into a readable date.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Escape a CSV cell value.
 * @param {string} cell
 * @returns {string}
 */
function escapeCsvCell(cell) {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */

/** Load all food items from localStorage. */
function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save all food items to localStorage. */
function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn('Could not save items to localStorage:', e);
  }
}

/** Load saved count from localStorage. */
function loadSavedCount() {
  try {
    const raw = localStorage.getItem(SAVED_COUNT_KEY);
    return raw ? (parseInt(raw, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

/** Save saved count to localStorage. */
function persistSavedCount() {
  try {
    localStorage.setItem(SAVED_COUNT_KEY, String(savedCount));
  } catch (e) {
    console.warn('Could not save count:', e);
  }
}

/* ============================================================
   DARK MODE
   ============================================================ */

/** Apply dark mode from stored preference. */
function applyDarkMode(isDark) {
  document.body.classList.toggle('dark', isDark);
  document.getElementById('dark-icon').textContent = isDark ? '☀️' : '🌙';
  try {
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  } catch {}
}

/** Load dark mode preference. */
function loadDarkMode() {
  try {
    return localStorage.getItem(DARK_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

/* ============================================================
   FORM LOGIC
   ============================================================ */

/** Open or close the add/edit form panel. */
function setFormOpen(open) {
  const section  = document.getElementById('form-section');
  const iconEl   = document.getElementById('form-toggle-icon');
  const labelEl  = document.getElementById('form-toggle-label');

  if (open) {
    section.classList.remove('collapsed');
    iconEl.innerHTML  = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>';
    labelEl.textContent = 'Close';
  } else {
    section.classList.add('collapsed');
    iconEl.innerHTML  = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
    labelEl.textContent = 'Add Food';
  }
}

/** Populate the form for editing an existing item. */
function populateFormForEdit(item) {
  document.getElementById('input-name').value   = item.name;
  document.getElementById('input-expiry').value = item.expiryDate;
  imageBase64 = item.imageBase64 || null;

  if (imageBase64) {
    document.getElementById('image-preview').src       = imageBase64;
    document.getElementById('image-preview-wrap').style.display = 'inline-block';
  } else {
    document.getElementById('image-preview-wrap').style.display = 'none';
  }

  document.getElementById('form-heading').textContent   = 'Edit Food Item';
  document.getElementById('btn-submit-food').textContent = 'Update Food';
  document.getElementById('btn-cancel-edit').style.display = 'inline-flex';
  hideFormError();
}

/** Reset the form to its "add new" state. */
function resetForm() {
  document.getElementById('food-form').reset();
  imageBase64 = null;
  editingId   = null;
  document.getElementById('image-preview-wrap').style.display = 'none';
  document.getElementById('image-preview').src = '';
  document.getElementById('form-heading').textContent    = 'Add New Food Item';
  document.getElementById('btn-submit-food').textContent = 'Add Food';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  hideFormError();
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideFormError() {
  const el = document.getElementById('form-error');
  el.style.display = 'none';
}

/* ============================================================
   CRUD OPERATIONS
   ============================================================ */

/**
 * Check if a duplicate item exists (same name + same expiry date).
 * @param {string} name
 * @param {string} expiryDate
 * @param {string|null} [ignoreId]
 * @returns {boolean}
 */
function isDuplicate(name, expiryDate, ignoreId) {
  const normalised = name.trim().toLowerCase();
  return items.some(item =>
    item.id !== ignoreId &&
    item.name.trim().toLowerCase() === normalised &&
    item.expiryDate === expiryDate
  );
}

/**
 * Add a new food item.
 * @param {string} name
 * @param {string} expiryDate
 * @param {string|null} img
 * @returns {{ok: boolean, error?: string}}
 */
function addItem(name, expiryDate, img) {
  if (!name.trim())  return { ok: false, error: 'Food name is required.' };
  if (!expiryDate)   return { ok: false, error: 'Expiry date is required.' };
  if (isDuplicate(name, expiryDate)) {
    return { ok: false, error: 'An item with this name and expiry date already exists.' };
  }

  const item = {
    id:          generateId(),
    name:        name.trim(),
    expiryDate,
    imageBase64: img || undefined,
    addedAt:     new Date().toISOString(),
  };

  items.unshift(item); // newest first
  saveItems();
  return { ok: true };
}

/**
 * Update an existing food item.
 * @param {string} id
 * @param {string} name
 * @param {string} expiryDate
 * @param {string|null} img
 * @returns {{ok: boolean, error?: string}}
 */
function updateItem(id, name, expiryDate, img) {
  if (!name.trim())  return { ok: false, error: 'Food name is required.' };
  if (!expiryDate)   return { ok: false, error: 'Expiry date is required.' };
  if (isDuplicate(name, expiryDate, id)) {
    return { ok: false, error: 'An item with this name and expiry date already exists.' };
  }

  items = items.map(item => {
    if (item.id !== id) return item;
    return {
      ...item,
      name:        name.trim(),
      expiryDate,
      imageBase64: img !== null ? (img || undefined) : item.imageBase64,
    };
  });
  saveItems();
  return { ok: true };
}

/**
 * Delete a food item by id.
 * Increments savedCount if item was not expired when deleted.
 * @param {string} id
 */
function deleteItem(id) {
  const target = items.find(i => i.id === id);
  if (target && getFoodStatus(target.expiryDate) !== 'expired') {
    savedCount++;
    persistSavedCount();
  }
  items = items.filter(i => i.id !== id);
  saveItems();
}

/* ============================================================
   RENDER: DASHBOARD
   ============================================================ */
function renderDashboard() {
  let fresh = 0, expiring = 0, expired = 0;
  for (const item of items) {
    const s = getFoodStatus(item.expiryDate);
    if (s === 'fresh')    fresh++;
    else if (s === 'expiring') expiring++;
    else                  expired++;
  }
  const total = items.length;

  document.getElementById('val-total').textContent    = total;
  document.getElementById('val-fresh').textContent    = fresh;
  document.getElementById('val-expiring').textContent = expiring;
  document.getElementById('val-expired').textContent  = expired;
  document.getElementById('val-saved').textContent    = savedCount;
  document.getElementById('eco-message').textContent  = getEcoMessage(savedCount);

  // Progress bars
  const freshPct    = total > 0 ? (fresh    / total) * 100 : 0;
  const expiringPct = total > 0 ? (expiring / total) * 100 : 0;
  const expiredPct  = total > 0 ? (expired  / total) * 100 : 0;

  document.getElementById('bar-fresh').style.width    = freshPct    + '%';
  document.getElementById('bar-expiring').style.width = expiringPct + '%';
  document.getElementById('bar-expired').style.width  = expiredPct  + '%';

  document.getElementById('pct-fresh').textContent    = freshPct.toFixed(1)    + '%';
  document.getElementById('pct-expiring').textContent = expiringPct.toFixed(1) + '%';
  document.getElementById('pct-expired').textContent  = expiredPct.toFixed(1)  + '%';
}

/* ============================================================
   RENDER: FOOD CARDS
   ============================================================ */

/**
 * Build and return a food card DOM element.
 * @param {object} item
 * @param {number} index  (for staggered animation delay)
 * @returns {HTMLElement}
 */
function buildFoodCard(item, index) {
  const status    = getFoodStatus(item.expiryDate);
  const dayLabel  = getDayLabel(item.expiryDate);
  const recipe    = getRecipeSuggestion(item.name);

  const dayLabelClass = {
    fresh:    'card-day-fresh',
    expiring: 'card-day-expiring',
    expired:  'card-day-expired',
  }[status];

  const card = document.createElement('div');
  card.className   = 'food-card';
  card.dataset.id  = item.id;
  card.style.animationDelay = `${Math.min(index, 12) * 55}ms`;

  // Image area
  const imgArea = document.createElement('div');
  imgArea.className = 'card-image';

  if (item.imageBase64) {
    const img = document.createElement('img');
    img.src = item.imageBase64;
    img.alt = item.name;
    imgArea.appendChild(img);
  } else {
    const emoji = document.createElement('span');
    emoji.className    = 'card-image-emoji';
    emoji.textContent  = '🍲';
    emoji.setAttribute('aria-hidden', 'true');
    imgArea.appendChild(emoji);
  }

  // Status badge
  const badge = document.createElement('span');
  badge.className  = `status-badge ${STATUS_BADGE_CLASS[status]}`;
  badge.textContent = STATUS_LABELS[status];
  imgArea.appendChild(badge);

  card.appendChild(imgArea);

  // Card body
  const body = document.createElement('div');
  body.className = 'card-body';

  const name = document.createElement('h4');
  name.className   = 'card-name';
  name.textContent = item.name;
  body.appendChild(name);

  const metaDate = document.createElement('p');
  metaDate.className   = 'card-meta';
  metaDate.textContent = formatDate(item.expiryDate);
  body.appendChild(metaDate);

  const metaDay = document.createElement('p');
  metaDay.className   = `card-day-label ${dayLabelClass}`;
  metaDay.textContent = dayLabel;
  body.appendChild(metaDay);

  const recipeEl = document.createElement('p');
  recipeEl.className   = 'card-recipe';
  recipeEl.textContent = recipe;
  body.appendChild(recipeEl);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const editBtn = document.createElement('button');
  editBtn.className  = 'btn btn-outline btn-sm';
  editBtn.innerHTML  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit`;
  editBtn.addEventListener('click', () => handleEditClick(item.id));

  const delBtn = document.createElement('button');
  delBtn.className  = 'btn btn-outline btn-sm btn-delete-card';
  delBtn.innerHTML  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete`;
  delBtn.addEventListener('click', () => handleDeleteClick(item.id));

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  body.appendChild(actions);
  card.appendChild(body);

  return card;
}

/** Get filtered and sorted list of items. */
function getFilteredSorted() {
  const query = currentSearch.trim().toLowerCase();
  let list = items.filter(item => item.name.toLowerCase().includes(query));

  const STATUS_ORDER = { expired: 0, expiring: 1, fresh: 2 };

  list = [...list].sort((a, b) => {
    if (currentSort === 'name-asc') {
      return a.name.localeCompare(b.name);
    }
    if (currentSort === 'expiry-soonest') {
      return a.expiryDate.localeCompare(b.expiryDate);
    }
    // status
    const sa = STATUS_ORDER[getFoodStatus(a.expiryDate)];
    const sb = STATUS_ORDER[getFoodStatus(b.expiryDate)];
    if (sa !== sb) return sa - sb;
    return a.expiryDate.localeCompare(b.expiryDate);
  });

  return list;
}

/** Render the food grid (cards or empty state). */
function renderFoodGrid() {
  const grid       = document.getElementById('food-grid');
  const emptyState = document.getElementById('empty-state');
  const emptyBtn   = document.getElementById('btn-empty-add');
  const emptyEmoji = document.getElementById('empty-emoji');
  const emptyTitle = document.getElementById('empty-title');
  const emptyDesc  = document.getElementById('empty-desc');

  const filtered = getFilteredSorted();
  const isFiltered = items.length > 0 && filtered.length === 0;

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.style.display   = 'none';
    emptyState.style.display = 'flex';
    emptyEmoji.textContent = isFiltered ? '🔍' : '🥕';
    emptyTitle.textContent = isFiltered ? 'No matching items' : 'No food items yet';
    emptyDesc.textContent  = isFiltered
      ? 'Try a different search term or clear your filters.'
      : 'Your fridge is looking empty. Add your first item to start tracking freshness.';
    emptyBtn.style.display = isFiltered ? 'none' : 'inline-flex';
  } else {
    grid.style.display   = 'grid';
    emptyState.style.display = 'none';
    filtered.forEach((item, idx) => {
      grid.appendChild(buildFoodCard(item, idx));
    });
  }
}

/* ============================================================
   RENDER: PRINT TABLE
   ============================================================ */
function renderPrintTable() {
  const tbody = document.getElementById('print-tbody');
  tbody.innerHTML = '';
  for (const item of items) {
    const tr = document.createElement('tr');
    const status = getFoodStatus(item.expiryDate);
    const recipe = getRecipeSuggestion(item.name).replace('💡 ', '');
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${formatDate(item.expiryDate)}</td>
      <td>${STATUS_LABELS[status]}</td>
      <td>${escapeHtml(recipe)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   RENDER: EXPIRY POPUP
   ============================================================ */
function renderExpiryPopup() {
  const expiringSoon = items.filter(i => getFoodStatus(i.expiryDate) === 'expiring');
  const popup = document.getElementById('expiry-popup');

  if (expiringSoon.length === 0) {
    popup.style.display = 'none';
    return;
  }

  const desc = document.getElementById('popup-desc');
  const list = document.getElementById('popup-list');

  desc.textContent = expiringSoon.length === 1
    ? 'This item is expiring within 3 days:'
    : 'These items are expiring within 3 days:';

  list.innerHTML = '';
  expiringSoon.slice(0, 5).forEach(item => {
    const li = document.createElement('li');
    li.textContent = `• ${item.name}`;
    list.appendChild(li);
  });

  if (expiringSoon.length > 5) {
    const extra = document.createElement('li');
    extra.style.fontSize  = '0.75rem';
    extra.style.color     = 'var(--muted-fg)';
    extra.textContent     = `+ ${expiringSoon.length - 5} more`;
    list.appendChild(extra);
  }

  popup.style.display = 'block';
}

/* ============================================================
   FULL RENDER CYCLE
   ============================================================ */
function renderAll() {
  renderDashboard();
  renderFoodGrid();
  renderPrintTable();
}

/* ============================================================
   EVENT HANDLERS
   ============================================================ */

/** Handle Edit button click on a card. */
function handleEditClick(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  populateFormForEdit(item);
  setFormOpen(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Handle Delete button click on a card — show confirmation dialog. */
function handleDeleteClick(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  deleteTarget = item;
  document.getElementById('dialog-desc').textContent =
    `"${item.name}" will be permanently removed from your tracker. This can't be undone.`;
  document.getElementById('delete-overlay').style.display = 'flex';
}

/* ============================================================
   CSV EXPORT
   ============================================================ */
function exportCSV() {
  if (items.length === 0) {
    alert('Add some food items first before exporting.');
    return;
  }

  const header = ['Name', 'Expiry Date', 'Status', 'Recipe Suggestion'];
  const rows = items.map(item => {
    const status = STATUS_LABELS[getFoodStatus(item.expiryDate)];
    const recipe = getRecipeSuggestion(item.name).replace('💡 ', '');
    return [item.name, item.expiryDate, status, recipe];
  });

  const csv = [header, ...rows]
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `food-items-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ============================================================
   INIT — Wire up all event listeners
   ============================================================ */
function init() {
  // Load persisted state
  items      = loadItems();
  savedCount = loadSavedCount();

  // Apply dark mode
  applyDarkMode(loadDarkMode());

  // Initial render
  renderAll();
  renderExpiryPopup();

  /* ---------- DARK MODE TOGGLE ---------- */
  document.getElementById('btn-dark-mode').addEventListener('click', () => {
    const nowDark = document.body.classList.toggle('dark');
    applyDarkMode(nowDark);
  });

  /* ---------- TOGGLE FORM ---------- */
  document.getElementById('btn-toggle-form').addEventListener('click', () => {
    const section = document.getElementById('form-section');
    const isOpen  = !section.classList.contains('collapsed');

    if (isOpen) {
      // Closing
      resetForm();
      editingId = null;
      setFormOpen(false);
    } else {
      setFormOpen(true);
    }
  });

  /* ---------- CANCEL EDIT ---------- */
  document.getElementById('btn-cancel-edit').addEventListener('click', () => {
    resetForm();
    editingId = null;
    setFormOpen(false);
  });

  /* ---------- FORM SUBMIT ---------- */
  document.getElementById('food-form').addEventListener('submit', e => {
    e.preventDefault();
    const name       = document.getElementById('input-name').value;
    const expiryDate = document.getElementById('input-expiry').value;

    let result;
    if (editingId) {
      result = updateItem(editingId, name, expiryDate, imageBase64);
    } else {
      result = addItem(name, expiryDate, imageBase64);
    }

    if (!result.ok) {
      showFormError(result.error);
      return;
    }

    hideFormError();

    if (editingId) {
      // Stay open if editing; just reset
      editingId = null;
      resetForm();
      setFormOpen(false);
    } else {
      resetForm();
      // Keep form open so user can add another
    }

    renderAll();
  });

  /* ---------- IMAGE UPLOAD ---------- */
  document.getElementById('input-image').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      imageBase64 = ev.target.result;
      document.getElementById('image-preview').src              = imageBase64;
      document.getElementById('image-preview-wrap').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });

  /* ---------- REMOVE IMAGE ---------- */
  document.getElementById('btn-remove-image').addEventListener('click', () => {
    imageBase64 = null;
    document.getElementById('input-image').value          = '';
    document.getElementById('image-preview-wrap').style.display = 'none';
    document.getElementById('image-preview').src          = '';
  });

  /* ---------- SEARCH ---------- */
  document.getElementById('input-search').addEventListener('input', e => {
    currentSearch = e.target.value;
    renderFoodGrid();
  });

  /* ---------- SORT ---------- */
  document.getElementById('select-sort').addEventListener('change', e => {
    currentSort = e.target.value;
    renderFoodGrid();
  });

  /* ---------- EMPTY STATE ADD BUTTON ---------- */
  document.getElementById('btn-empty-add').addEventListener('click', () => {
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---------- EXPORT CSV ---------- */
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);

  /* ---------- PRINT ---------- */
  document.getElementById('btn-print').addEventListener('click', () => window.print());

  /* ---------- EXPIRY POPUP DISMISS ---------- */
  document.getElementById('btn-dismiss-popup').addEventListener('click', () => {
    document.getElementById('expiry-popup').style.display = 'none';
  });

  document.getElementById('btn-acknowledge-popup').addEventListener('click', () => {
    document.getElementById('expiry-popup').style.display = 'none';
  });

  /* ---------- DELETE CONFIRMATION ---------- */
  document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    deleteTarget = null;
    document.getElementById('delete-overlay').style.display = 'none';
  });

  document.getElementById('btn-confirm-delete').addEventListener('click', () => {
    if (deleteTarget) {
      deleteItem(deleteTarget.id);
      deleteTarget = null;
      document.getElementById('delete-overlay').style.display = 'none';
      renderAll();
    }
  });

  // Close dialog on overlay click
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) {
      deleteTarget = null;
      document.getElementById('delete-overlay').style.display = 'none';
    }
  });

  // Close dialog on Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('delete-overlay');
      if (overlay.style.display !== 'none') {
        deleteTarget = null;
        overlay.style.display = 'none';
      }
    }
  });
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);
