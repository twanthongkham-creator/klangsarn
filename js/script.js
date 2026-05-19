// ==========================================
// ChemStock — Main Logic v2.1
// Flash animation + Gallery + Stat cards
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allChemicals = [];
let allTransactions = [];
let currentFilter = 'All';
let uploadedImagesBase64 = [];

// ==========================================
// INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
});

async function fetchData() {
    const [stockRes, transRes] = await Promise.all([
        _supabase.from('chemical_stock').select('*').order('chemical_name'),
        _supabase.from('chemical_transactions')
            .select('id, type, quantity, transaction_date')
            .order('transaction_date', { ascending: false })
    ]);

    if (stockRes.error) { showToast("โหลดข้อมูลไม่สำเร็จ", "danger"); return; }

    allChemicals    = stockRes.data || [];
    allTransactions = transRes.data || [];

    updateStatCards();
    renderAll();
}

// ==========================================
// STAT CARDS (Dashboard summary on main page)
// ==========================================
function updateStatCards() {
    // Total
    const totalEl = document.getElementById('dashTotalItems');
    if (totalEl) totalEl.textContent = allChemicals.length;

    // Alert (near/over expiry)
    const today = new Date();
    const alertCount = allChemicals.filter(c => {
        if (!c.exp_date) return false;
        return (new Date(c.exp_date) - today) / 864e5 <= 30;
    }).length;
    const alertEl = document.getElementById('dashAlertItems');
    if (alertEl) alertEl.textContent = alertCount;

    // IN/OUT this month
    const firstDay = new Date(); firstDay.setDate(1); firstDay.setHours(0,0,0,0);
    let inCount = 0, outCount = 0;
    allTransactions.forEach(t => {
        if (new Date(t.transaction_date) >= firstDay) {
            if (t.type === 'IN') inCount++;
            else outCount++;
        }
    });
    const inEl  = document.getElementById('dashInMonth');
    const outEl = document.getElementById('dashOutMonth');
    if (inEl)  inEl.textContent  = inCount;
    if (outEl) outEl.textContent = outCount;
}

// ==========================================
// FILTER + RENDER
// ==========================================
function filterByLocation(locKey, btnEl) {
    currentFilter = locKey;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderAll();
}

function renderAll() {
    const filtered = currentFilter === 'All'
        ? allChemicals
        : allChemicals.filter(c => c.location && c.location.includes(currentFilter));

    const showLoc = (currentFilter === 'All');
    const thLoc = document.getElementById('th-location');
    if (thLoc) thLoc.style.display = showLoc ? '' : 'none';

    renderDesktopTable(filtered, showLoc);
    renderMobileCards(filtered, showLoc);
}

// ==========================================
// DESKTOP TABLE
// ==========================================
function renderDesktopTable(filtered, showLoc) {
    const tbody = document.getElementById("chemicalTableBody");
    if (!tbody) return;
    const isAdmin = typeof isAdminLoggedIn === 'function' && isAdminLoggedIn();

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2"
              stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto;display:block;">
              <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
              <path d="M7.5 16h9"/>
            </svg>
            <div class="empty-title">ไม่พบรายการสารเคมี</div>
            <div class="empty-desc">ลองเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่</div>
          </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const exp = getExpiryStatus(item.exp_date);
        const imgs = item.image_urls ? JSON.parse(item.image_urls) : [];
        const thumb = imgs.length > 0
            ? `<img src="${imgs[0]}" class="table-thumb" onclick="viewImage('${imgs[0]}')">`
            : `<div style="width:42px;height:42px;border-radius:6px;background:linear-gradient(135deg,#EEF6FF,#E0EEFF);border:1px solid rgba(14,165,233,0.15);display:flex;align-items:center;justify-content:center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
                </svg>
              </div>`;

        const expBadge = exp.label
            ? `<span class="badge badge-${exp.label === 'หมดอายุ' ? 'red' : 'amber'}" style="margin-left:5px;font-size:10px;">${exp.label}</span>`
            : '';

        return `<tr id="row-${item.id}">
          <td style="padding-left:22px;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${thumb}
              <div>
                <div class="cell-name">${item.chemical_name}</div>
                <div class="cell-cas">CAS: ${item.cas_number || '—'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="cell-qty">${item.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:5px;">${item.unit}</span>
          </td>
          <td>
            <div style="font-size:12px;color:var(--text-muted);">
              <span style="color:var(--success);font-weight:500;">MFG</span> ${item.mfg_date || '—'}
            </div>
            <div style="font-size:12px;" class="${exp.class}">
              <span style="font-weight:500;">EXP</span> ${item.exp_date || '—'}${expBadge}
            </div>
          </td>
          <td style="display:${showLoc ? '' : 'none'};">
            <span class="badge badge-loc">${item.location ? item.location.split(' ').slice(0,2).join(' ') : '—'}</span>
          </td>
          <td style="text-align:right;padding-right:22px;">
            <div style="display:inline-flex;align-items:center;gap:6px;">
              <button class="btn btn-outline-primary btn-sm" onclick="openTransactionModal(${item.id})">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></svg>
                รับ/จ่าย
              </button>
              ${isAdmin ? `
              <button class="btn btn-outline btn-sm btn-icon" onclick="editChemical(${item.id})" title="แก้ไข">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteChemical(${item.id})" title="ลบ">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
}

// ==========================================
// MOBILE CARDS
// ==========================================
function renderMobileCards(filtered, showLoc) {
    const container = document.getElementById("chemicalCardsBody");
    if (!container) return;
    const isAdmin = typeof isAdminLoggedIn === 'function' && isAdminLoggedIn();

    if (filtered.length === 0) {
        container.innerHTML = `
          <div style="padding:40px 20px;text-align:center;background:var(--bg-card);border-radius:var(--r-xl);border:1.5px solid var(--border-soft);box-shadow:var(--shadow-xs);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;">
              <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
            </svg>
            <div style="font-weight:600;color:var(--text-body);">ไม่พบรายการ</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">ลองเปลี่ยนตัวกรอง</div>
          </div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const exp = getExpiryStatus(item.exp_date);
        const imgs = item.image_urls ? JSON.parse(item.image_urls) : [];

        // Location badge
        const locBadge = showLoc && item.location
            ? `<span class="badge badge-loc" style="margin-top:4px;display:inline-flex;">${item.location.split(' ').slice(0,2).join(' ')}</span>`
            : '';

        // Image gallery based on count
        const galleryHtml = buildImageGallery(imgs);

        // Expiry badge inline
        const expBadgeHtml = exp.label
            ? `<span class="badge badge-${exp.label === 'หมดอายุ' ? 'red' : 'amber'}" style="font-size:10.5px;">${exp.label}</span>`
            : '';

        // Admin controls
        const adminBtns = isAdmin ? `
          <button class="btn btn-outline btn-sm btn-icon" onclick="editChemical(${item.id})" title="แก้ไข">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteChemical(${item.id})" title="ลบ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>` : '';

        return `
        <div class="chem-card ${exp.cardClass}" id="chem-card-${item.id}">
          <div class="chem-card-top">
            <div class="chem-card-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
                <path d="M7.5 16h9"/><circle cx="10.5" cy="15.5" r="0.8" fill="#0EA5E9"/>
              </svg>
            </div>
            <div class="chem-card-info">
              <div class="chem-name">${item.chemical_name}</div>
              <div class="chem-cas">${item.cas_number ? 'CAS: ' + item.cas_number : ''}</div>
              ${locBadge}
            </div>
            <div class="chem-card-qty">
              <div class="qty-val">${item.quantity}</div>
              <div class="qty-unit">${item.unit}</div>
            </div>
          </div>

          <div class="chem-card-meta">
            <div>
              <div class="meta-key">วันผลิต</div>
              <div class="meta-val" style="color:var(--success);">${item.mfg_date || '—'}</div>
            </div>
            <div>
              <div class="meta-key">วันหมดอายุ</div>
              <div class="meta-val ${exp.class}">${item.exp_date || '—'} ${expBadgeHtml}</div>
            </div>
          </div>

          ${galleryHtml}

          <div class="chem-card-foot">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openTransactionModal(${item.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></svg>
              รับ/จ่าย
            </button>
            ${adminBtns}
          </div>
        </div>`;
    }).join('');
}

// ==========================================
// IMAGE GALLERY BUILDER
// ==========================================
function buildImageGallery(urls) {
    if (!urls || urls.length === 0) return '';
    const count = Math.min(urls.length, 3);
    const imgs = urls.slice(0, count).map((url, i) =>
        `<img src="${url}" class="gal-img${i === 0 ? ' gallery-main' : ''}" onclick="viewImage('${url}')" alt="ภาพที่ ${i+1}">`
    ).join('');
    return `<div class="img-gallery-wrap">
      <div class="img-gallery count-${count}">${imgs}</div>
    </div>`;
}

// Simple image lightbox
function viewImage(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;`;
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:88vh;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.5);">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

// ==========================================
// CARD / ROW FLASH ANIMATION
// ==========================================
function flashCard(chemId, type) {
    // Mobile card
    const card = document.getElementById(`chem-card-${chemId}`);
    if (card) {
        card.classList.remove('flash-in', 'flash-out');
        void card.offsetWidth; // reflow
        card.classList.add(type === 'IN' ? 'flash-in' : 'flash-out');
        setTimeout(() => card.classList.remove('flash-in','flash-out'), 1300);
    }
    // Desktop row
    const row = document.getElementById(`row-${chemId}`);
    if (row) {
        row.classList.remove('row-flash-in','row-flash-out');
        void row.offsetWidth;
        row.classList.add(type === 'IN' ? 'row-flash-in' : 'row-flash-out');
        setTimeout(() => row.classList.remove('row-flash-in','row-flash-out'), 1300);
    }
}

// ==========================================
// IMAGE HANDLING
// ==========================================
function handleImageSelection(e) {
    const files = Array.from(e.target.files).slice(0, 3);
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = ev => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 600;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const b64 = canvas.toDataURL('image/jpeg', 0.72);
                uploadedImagesBase64.push(b64);
                container.innerHTML += `<img src="${b64}" class="img-thumb" onclick="viewImage('${b64}')">`;
            };
        };
    });
}

// ==========================================
// ADD / EDIT CHEMICAL
// ==========================================
function openAddModal() {
    document.getElementById("chemicalId").value = "";
    document.getElementById("chemicalForm").reset();
    document.getElementById("imagePreviewContainer").innerHTML = "";
    uploadedImagesBase64 = [];
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีเข้าสต็อก";
    document.getElementById('chemModalOverlay').classList.add('open');
}

function editChemical(id) {
    const item = allChemicals.find(c => c.id == id);
    if (!item) return;
    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("casNumber").value = item.cas_number || "";
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date || "";
    document.getElementById("expDate").value = item.exp_date || "";
    document.getElementById("location").value = item.location || "";
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = item.image_urls ? JSON.parse(item.image_urls) : [];
    uploadedImagesBase64.forEach(url => { container.innerHTML += `<img src="${url}" class="img-thumb" onclick="viewImage('${url}')">`; });
    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลเคมีภัณฑ์";
    document.getElementById('chemModalOverlay').classList.add('open');
}

async function handleChemicalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    const payload = {
        chemical_name: document.getElementById("chemicalName").value,
        cas_number:    document.getElementById("casNumber").value,
        quantity:      parseFloat(document.getElementById("quantity").value),
        unit:          document.getElementById("unit").value,
        mfg_date:      document.getElementById("mfgDate").value || null,
        exp_date:      document.getElementById("expDate").value || null,
        location:      document.getElementById("location").value,
        image_urls:    uploadedImagesBase64.length > 0 ? JSON.stringify(uploadedImagesBase64) : null
    };

    let error;
    if (id) {
        const r = await _supabase.from('chemical_stock').update(payload).eq('id', id);
        error = r.error;
    } else {
        const r = await _supabase.from('chemical_stock').insert([payload]);
        error = r.error;
    }

    if (error) {
        showToast("บันทึกไม่สำเร็จ: " + error.message, "danger");
    } else {
        document.getElementById('chemModalOverlay').classList.remove('open');
        showToast(id ? "อัปเดตข้อมูลสำเร็จ" : "เพิ่มสารเคมีสำเร็จ", "success");
        fetchData();
    }
}

async function deleteChemical(id) {
    const item = allChemicals.find(c => c.id == id);
    if (!confirm(`ยืนยันลบ "${item?.chemical_name}"?\nประวัติธุรกรรมจะถูกลบตามด้วย`)) return;
    await _supabase.from('chemical_stock').delete().eq('id', id);
    showToast("ลบรายการสำเร็จ", "success");
    fetchData();
}

// ==========================================
// TRANSACTIONS
// ==========================================
function openTransactionModal(id) {
    const item = allChemicals.find(c => c.id == id);
    if (!item) return;
    document.getElementById("transChemId").value = item.id;
    document.getElementById("transChemName").textContent = item.chemical_name;
    document.getElementById("transUnitLabel").textContent = item.unit;
    document.getElementById("transQty").value = "";
    document.getElementById("transRemark").value = "";
    document.getElementById("transType").value = "IN";
    document.getElementById('transModalOverlay').classList.add('open');
    if (typeof selectTransType === 'function') selectTransType('IN');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id   = document.getElementById("transChemId").value;
    const type = document.getElementById("transType").value;
    const qty  = parseFloat(document.getElementById("transQty").value);
    const remark = document.getElementById("transRemark").value;

    const item = allChemicals.find(c => c.id == id);
    const newQty = type === 'IN' ? item.quantity + qty : item.quantity - qty;

    if (newQty < 0) { showToast("สต็อกคงเหลือไม่เพียงพอ!", "danger"); return; }

    await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', id);
    await _supabase.from('chemical_transactions').insert([{ chemical_id: id, type, quantity: qty, remark }]);

    document.getElementById('transModalOverlay').classList.remove('open');

    // Flash animation on card/row
    flashCard(id, type);

    showToast(
        type === 'IN'
            ? `รับเข้า ${qty} ${item.unit} สำเร็จ`
            : `เบิกจ่าย ${qty} ${item.unit} สำเร็จ`,
        type === 'IN' ? 'success' : 'warning'
    );

    fetchData();
}

// ==========================================
// HELPERS
// ==========================================
function getExpiryStatus(date) {
    if (!date) return { class: '', label: '', cardClass: '', badgeClass: '' };
    const diff = (new Date(date) - new Date()) / 864e5;
    if (diff <= 0)  return { class: 'exp-over', label: 'หมดอายุ', cardClass: 'status-over', badgeClass: 'badge-red' };
    if (diff <= 30) return { class: 'exp-near', label: `${Math.ceil(diff)}วัน`, cardClass: 'status-near', badgeClass: 'badge-amber' };
    return { class: '', label: '', cardClass: '', badgeClass: '' };
}
