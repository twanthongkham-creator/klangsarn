// ==========================================
// KlangSarn — Main Logic v2.1
// Flash animation + Gallery + Stat cards
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allChemicals = [];
let allTransactions = [];
let currentFilter = 'All';
let uploadedImagesBase64 = [];
let pendingDeleteId = null;

// ==========================================
// INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
    
    // Bind Drag & Drop Events to custom Upload Zone
    initDragAndDrop();

    // Promotion fields behavior in main transaction modal
    const promoToggle = document.getElementById("transPromoToggle");
    const freeQtyContainer = document.getElementById("transFreeQtyContainer");
    
    promoToggle?.addEventListener("change", (e) => {
        if (e.target.checked) {
            freeQtyContainer.style.display = "block";
            document.getElementById("transFreeQty").value = "0";
        } else {
            freeQtyContainer.style.display = "none";
            document.getElementById("transFreeQty").value = "0";
        }
        updateTransSummary();
    });

    ["transQty", "transPricePerUnit", "transFreeQty"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", updateTransSummary);
    });

    // New Lot fields behavior in transaction modal
    const transNewLotToggle = document.getElementById("transNewLotToggle");
    const transNewLotContainer = document.getElementById("transNewLotContainer");
    
    transNewLotToggle?.addEventListener("change", (e) => {
        if (e.target.checked) {
            transNewLotContainer.style.display = "block";
            document.getElementById("transLotNumber").required = true;
            document.getElementById("transLocation").required = true;
        } else {
            transNewLotContainer.style.display = "none";
            document.getElementById("transLotNumber").required = false;
            document.getElementById("transLocation").required = false;
        }
    });

    // Auto-calculate EXP date inside transaction modal
    document.getElementById("transMfgDate")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            const parts = val.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setFullYear(d.getFullYear() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            document.getElementById('transExpDate').value = `${y}-${m}-${day}`;
        }
    });

    // Auto-calculate EXP date to MFG date + 1 Year
    document.getElementById("mfgDate")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            const parts = val.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setFullYear(d.getFullYear() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            document.getElementById('expDate').value = `${y}-${m}-${day}`;
        }
    });
});

async function fetchData() {
    // 1. Load cached data from sessionStorage to render instantly
    const cachedStock = sessionStorage.getItem('klangsarn_chemicals');
    const cachedTrans = sessionStorage.getItem('klangsarn_transactions');
    if (cachedStock && cachedTrans) {
        try {
            allChemicals = JSON.parse(cachedStock);
            allTransactions = JSON.parse(cachedTrans);
            updateStatCards();
            renderAll();
        } catch (e) {
            console.warn("Error parsing cache", e);
        }
    }

    // 2. Fetch fresh data in background from Supabase
    const [stockRes, transRes] = await Promise.all([
        _supabase.from('chemical_stock').select('*').order('chemical_name'),
        _supabase.from('chemical_transactions')
            .select('id, type, quantity, transaction_date')
            .order('transaction_date', { ascending: false })
    ]);

    if (stockRes.error) { 
        if (!allChemicals.length) {
            showToast("โหลดข้อมูลไม่สำเร็จ", "danger"); 
        }
        return; 
    }

    allChemicals    = stockRes.data || [];
    allTransactions = transRes.data || [];

    // 3. Cache new data and render updates
    sessionStorage.setItem('klangsarn_chemicals', JSON.stringify(allChemicals));
    sessionStorage.setItem('klangsarn_transactions', JSON.stringify(allTransactions));

    updateStatCards();
    renderAll();
}

// ==========================================
// STAT CARDS (Safe fallback if elements exist)
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

function applyStockFilters() {
    renderAll();
}

function getGroupSlug(name, mat) {
    const raw = `${name}_${mat || ''}`;
    // Support Thai characters in DOM IDs by matching alphanumeric and Thai Unicode block
    return raw.replace(/[^a-zA-Z0-9ก-๙]/g, '_');
}

function renderAll() {
    const searchVal = (document.getElementById("searchStock")?.value || "").toLowerCase().trim();

    const filtered = allChemicals.filter(c => {
        // 1. Location Filter
        if (currentFilter !== 'All' && !(c.location && c.location.includes(currentFilter))) {
            return false;
        }
        // 2. Search Filter
        if (searchVal) {
            const name = (c.chemical_name || "").toLowerCase();
            const mat = (c.material_number || "").toLowerCase();
            const lot = (c.lot_number || "").toLowerCase();
            if (!name.includes(searchVal) && !mat.includes(searchVal) && !lot.includes(searchVal)) {
                return false;
            }
        }
        return true;
    });

    // Grouping stock by chemical name & material number
    const groups = {};
    filtered.forEach(c => {
        const key = getGroupSlug(c.chemical_name, c.material_number);
        if (!groups[key]) {
            groups[key] = {
                key: key,
                chemical_name: c.chemical_name,
                material_number: c.material_number,
                unit: c.unit,
                total_quantity: 0,
                min_quantity: c.min_quantity || 0,
                max_quantity: c.max_quantity || 0,
                locations: new Set(),
                batches: []
            };
        } else {
            if (c.min_quantity > 0) groups[key].min_quantity = c.min_quantity;
            if (c.max_quantity > 0) groups[key].max_quantity = c.max_quantity;
        }
        groups[key].total_quantity += c.quantity;
        if (c.location) {
            groups[key].locations.add(c.location);
        }
        groups[key].batches.push(c);
    });
    
    // Sort groups alphabetically by chemical name
    const groupedList = Object.values(groups).sort((a, b) => a.chemical_name.localeCompare(b.chemical_name));

    const showLoc = (currentFilter === 'All');
    const thLoc = document.getElementById('th-location');
    if (thLoc) thLoc.style.display = showLoc ? '' : 'none';

    renderDesktopTable(groupedList, showLoc);
    renderMobileCards(groupedList, showLoc);
}

// ==========================================
// DESKTOP TABLE
// ==========================================
function renderDesktopTable(groupedList, showLoc) {
    const tbody = document.getElementById("chemicalTableBody");
    if (!tbody) return;

    if (groupedList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
          <div class="empty-state" style="padding: 60px 24px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2"
              stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;">
              <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
              <path d="M7.5 16h9"/>
            </svg>
            <div class="empty-title" style="font-size: 15px; font-weight:600; color:var(--text-body);">ไม่พบรายการสารเคมี</div>
            <div class="empty-desc" style="font-size: 12.5px; color:var(--text-muted); margin-top:4px;">ลองเปลี่ยนตัวกรองหรือคำค้นหา</div>
          </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = groupedList.map(group => {
        // Collect first batch image or fallback
        let mainThumb = `<div style="width:42px;height:42px;border-radius:8px;background:linear-gradient(135deg,#EEF6FF,#E0EEFF);border:1px solid rgba(14,165,233,0.15);display:flex;align-items:center;justify-content:center;cursor:default;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93C5FD" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
            </svg>
          </div>`;
        
        for (const batch of group.batches) {
            const imgs = batch.image_urls ? JSON.parse(batch.image_urls) : [];
            if (imgs.length > 0) {
                mainThumb = `<img src="${imgs[0]}" class="table-thumb" onclick="viewImage('${imgs[0]}'); event.stopPropagation();">`;
                break;
            }
        }

        // Count status across all batches
        let expiredCount = 0;
        let nearCount = 0;
        group.batches.forEach(b => {
            const exp = getExpiryStatus(b.exp_date);
            if (exp.class === 'exp-over') expiredCount++;
            else if (exp.class === 'exp-near') nearCount++;
        });

        let statusText = `<span class="badge badge-green">ปกติ</span>`;
        if (expiredCount > 0) {
            statusText = `<span class="badge badge-red">หมดอายุ (${expiredCount} ล็อต)</span>`;
        } else if (nearCount > 0) {
            statusText = `<span class="badge badge-amber">ใกล้หมดอายุ (${nearCount} ล็อต)</span>`;
        }

        // Min/Max alerts
        const minVal = parseFloat(group.min_quantity);
        const maxVal = parseFloat(group.max_quantity);
        if (minVal > 0 && group.total_quantity < minVal) {
            statusText += ` <span class="badge badge-red" style="margin-top:4px; display:inline-block;">⚠️ ต่ำกว่า Min</span>`;
        } else if (maxVal > 0 && group.total_quantity > maxVal) {
            statusText += ` <span class="badge badge-amber" style="margin-top:4px; display:inline-block;">⚠️ เกิน Max</span>`;
        }

        const locationsArray = Array.from(group.locations);
        const locationsText = locationsArray.length > 0 
            ? locationsArray.map(l => `<span class="badge badge-loc" style="margin-right:4px;">${l.split(' ').slice(0,2).join(' ')}</span>`).join('')
            : '—';

        const subTableRows = group.batches.map(batch => {
            const exp = getExpiryStatus(batch.exp_date);
            const expBadge = exp.label
                ? `<span class="badge ${exp.badgeClass}" style="margin-left:8px; font-size:10.5px; font-weight:600; padding:2px 8px;">${exp.label}</span>`
                : '';

            return `
            <div class="nested-lot-item-row">
              <!-- Lot info -->
              <div class="lot-info" style="width: 160px; font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--text-head);">
                <span style="font-size: 11px; color:var(--text-muted); font-weight:normal; margin-right:4px;">Lot:</span> ${batch.lot_number || '—'}
              </div>
              
              <!-- Dates -->
              <div class="lot-dates" style="width: 250px;">
                <div style="font-size:12px;color:var(--text-muted);">
                  <span style="color:var(--success);font-weight:500;margin-right:4px;">MFG</span> ${formatDisplayDate(batch.mfg_date)}
                </div>
                <div style="font-size:12px; display: flex; align-items: center;" class="${exp.class}">
                  <span style="font-weight:500; margin-right:5px;">EXP</span> ${formatDisplayDate(batch.exp_date)}${expBadge}
                </div>
              </div>
              
              <!-- Qty -->
              <div class="lot-qty" style="width: 140px; font-family:'IBM Plex Mono',monospace; font-weight:700;">
                ${batch.quantity} <span style="font-size:12px;color:var(--text-muted);font-weight:normal;margin-left:2px;">${batch.unit}</span>
              </div>
              
              <!-- Actions -->
              <div class="lot-actions" style="flex: 1; text-align: right;">
                <div class="nested-action-group">
                  <button class="btn-lot-action btn-lot-action-recv" onclick="openTransactionModal(${batch.id}); event.stopPropagation();">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="pointer-events: none;"><path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></svg>
                    รับ/จ่าย
                  </button>
                  <button class="btn-lot-action btn-lot-action-edit" onclick="editChemical(${batch.id}); event.stopPropagation();">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="pointer-events: none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    แก้ไข
                  </button>
                  <button class="btn-lot-action btn-lot-action-delete" onclick="deleteChemical(${batch.id}); event.stopPropagation();">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    ลบ
                  </button>
                </div>
              </div>
            </div>`;
        }).join('');

        return `
        <!-- Master Row -->
        <tr class="master-row" id="master-${group.key}" onclick="toggleLotGroup('${group.key}')">
          <td style="padding-left:22px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div class="chevron-icon" id="chevron-${group.key}" style="color:var(--text-muted);display:flex;align-items:center;justify-content:center;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              ${mainThumb}
              <div>
                <div class="cell-name" style="font-size:14.5px; font-weight:700; color:var(--text-head);">${group.chemical_name}</div>
                <div class="cell-cas" style="font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--text-muted); margin-top:2px;">Material: ${group.material_number || '—'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="cell-qty" style="font-family:'IBM Plex Mono',monospace; font-size:16px; font-weight:700; color:var(--text-head);">${group.total_quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${group.unit}</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;font-weight:normal;">
              Min: ${group.min_quantity || '—'} | Max: ${group.max_quantity || '—'}
            </div>
          </td>
          <td>
            ${statusText}
          </td>
          <td style="display:${showLoc ? '' : 'none'};">
            ${locationsText}
          </td>
          <td style="text-align:right;padding-right:22px;">
            <button class="btn btn-add-lot" onclick="openTransactionModal(${group.batches[0].id}, true); event.stopPropagation();">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              เปิดล็อตใหม่
            </button>
          </td>
        </tr>
        
        <!-- Detail Row (Indented Branching Lots) -->
        <tr class="nested-lot-row" id="detail-${group.key}">
          <td colspan="${showLoc ? 5 : 4}" style="padding:0;">
            <div class="nested-lot-container">
              ${subTableRows}
            </div>
          </td>
        </tr>`;
    }).join('');
}

// ==========================================
// MOBILE CARDS
// ==========================================
function renderMobileCards(groupedList, showLoc) {
    const container = document.getElementById("chemicalCardsBody");
    if (!container) return;

    if (groupedList.length === 0) {
        container.innerHTML = `
          <div style="padding:40px 20px;text-align:center;background:var(--bg-card);border-radius:var(--r-xl);border:1.5px solid var(--border-soft);box-shadow:var(--shadow-xs);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 12px;display:block;">
              <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
            </svg>
            <div style="font-weight:600;color:var(--text-body);">ไม่พบรายการ</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">ลองเปลี่ยนตัวกรองหรือคำค้นหา</div>
          </div>`;
        return;
    }

    container.innerHTML = groupedList.map(group => {
        const groupLocation = Array.from(group.locations)[0] || '';
        const escapedGroupLoc = groupLocation.replace(/'/g, "\\'");
        // Collect first batch image or fallback
        let mainImgHtml = `<div class="chem-card-icon" style="width: 68px; height: 68px; border-radius: var(--r-lg);">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
                <path d="M7.5 16h9"/><circle cx="10.5" cy="15.5" r="0.8" fill="#0EA5E9"/>
              </svg>
            </div>`;
        
        for (const batch of group.batches) {
            const imgs = batch.image_urls ? JSON.parse(batch.image_urls) : [];
            if (imgs.length > 0) {
                mainImgHtml = `<img src="${imgs[0]}" onclick="viewImage('${imgs[0]}'); event.stopPropagation();" style="width: 68px; height: 68px; object-fit: cover; border-radius: var(--r-lg); border: 1px solid var(--border-soft); flex-shrink: 0;">`;
                break;
            }
        }

        // Count status across all batches
        let expiredCount = 0;
        let nearCount = 0;
        group.batches.forEach(b => {
            const exp = getExpiryStatus(b.exp_date);
            if (exp.class === 'exp-over') expiredCount++;
            else if (exp.class === 'exp-near') nearCount++;
        });

        let statusText = `<span class="badge badge-green">ปกติ</span>`;
        let cardClass = '';
        if (expiredCount > 0) {
            statusText = `<span class="badge badge-red">หมดอายุ (${expiredCount} ล็อต)</span>`;
            cardClass = 'status-over';
        } else if (nearCount > 0) {
            statusText = `<span class="badge badge-amber">ใกล้หมดอายุ (${nearCount} ล็อต)</span>`;
            cardClass = 'status-near';
        }

        // Min/Max alerts
        const minVal = parseFloat(group.min_quantity);
        const maxVal = parseFloat(group.max_quantity);
        if (minVal > 0 && group.total_quantity < minVal) {
            statusText += ` <span class="badge badge-red" style="display:inline-block; margin-top:2px;">⚠️ ต่ำกว่า Min</span>`;
        } else if (maxVal > 0 && group.total_quantity > maxVal) {
            statusText += ` <span class="badge badge-amber" style="display:inline-block; margin-top:2px;">⚠️ เกิน Max</span>`;
        }

        const locationsArray = Array.from(group.locations);
        const locBadge = showLoc && locationsArray.length > 0
            ? `<span class="badge badge-loc" style="margin-top:4px;display:inline-flex;">${locationsArray.map(l => l.split(' ').slice(0,2).join(' ')).join(', ')}</span>`
            : '';

        // Nested batches list for mobile drawer
        const nestedBatchesHtml = group.batches.map(batch => {
            const exp = getExpiryStatus(batch.exp_date);
            const expBadgeHtml = exp.label
                ? `<span class="badge ${exp.badgeClass}" style="font-size:10.5px; font-weight:600; padding:2px 8px;">${exp.label}</span>`
                : '';

            const vendorHtml = batch.vendor ? `
                <div style="grid-column: 1/-1; display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-body); margin-top:2px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2.5" style="vertical-align: middle;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  <span>${batch.vendor}</span>
                </div>` : '';

            return `
            <div class="nested-lot-item">
              <div class="nested-lot-item-header">
                <span style="font-family:'IBM Plex Mono',monospace;">Lot: ${batch.lot_number || '—'}</span>
                <span class="mono" style="color:var(--text-head); font-weight:700;">${batch.quantity} ${batch.unit}</span>
              </div>
              <div class="nested-lot-item-details">
                <div>
                  <span style="color:var(--text-muted);">MFG:</span> <span style="color:var(--success);font-weight:600;">${formatDisplayDate(batch.mfg_date)}</span>
                </div>
                <div>
                  <span style="color:var(--text-muted);">EXP:</span> <span class="${exp.class}" style="font-weight:600;">${formatDisplayDate(batch.exp_date)} ${expBadgeHtml}</span>
                </div>
                ${vendorHtml}
              </div>
              
              <div class="nested-lot-item-footer">
                <button class="btn-lot-action btn-lot-action-recv" onclick="openTransactionModal(${batch.id})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="pointer-events: none;"><path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></svg>
                  รับ/จ่าย
                </button>
                <button class="btn-lot-action btn-lot-action-edit" onclick="editChemical(${batch.id})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="pointer-events: none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  แก้ไข
                </button>
                <button class="btn-lot-action btn-lot-action-delete" onclick="deleteChemical(${batch.id})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  ลบ
                </button>
              </div>
            </div>`;
        }).join('');

        return `
        <div class="chem-card ${cardClass}" id="chem-group-${group.key}" style="border-radius: var(--r-xl); border: 1.5px solid var(--border-soft); box-shadow: var(--shadow-sm); overflow: hidden; background: var(--bg-card); transition: transform 0.15s ease; margin-bottom:14px;">
          <div class="chem-card-top" style="padding: 18px 18px 12px; display: flex; gap: 14px; align-items: flex-start;" onclick="toggleLotDrawer('${group.key}')">
            ${mainImgHtml}
            <div class="chem-card-info" style="flex: 1; min-width: 0;">
              <div class="chem-name" style="font-size: 15px; font-weight: 700; color: var(--text-head);">${group.chemical_name}</div>
              <div class="chem-cas" style="font-family:'IBM Plex Mono',monospace; font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">Material: ${group.material_number || '—'}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                Min: ${group.min_quantity || '—'} | Max: ${group.max_quantity || '—'}
              </div>
              ${locBadge}
              <div style="margin-top:5px;">
                ${statusText}
              </div>
            </div>
            <div class="chem-card-qty" style="text-align: right;">
              <div class="qty-val" style="font-family:'IBM Plex Mono',monospace; font-size: 24px; font-weight: 800;">${group.total_quantity}</div>
              <div class="qty-unit" style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${group.unit}</div>
            </div>
          </div>

          <div class="chem-card-foot" style="padding: 10px 18px 14px; background: linear-gradient(180deg, rgba(250,252,255,0.4), #F4F8FF); border-top: 1px solid var(--border-soft); display: flex; gap: 8px;">
            <button class="btn btn-add-lot" style="flex:1;" onclick="openTransactionModal(${group.batches[0].id}, true); event.stopPropagation();">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              เปิดล็อตใหม่
            </button>
            <button class="btn btn-outline btn-sm" style="border-radius:var(--r-md); font-weight:600; display:inline-flex; align-items:center; justify-content:center; gap:5px;" onclick="toggleLotDrawer('${group.key}')">
              <span>แสดงล็อต (${group.batches.length})</span>
              <div class="chevron-icon" id="chevron-mob-${group.key}" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          </div>
          
          <!-- Collapsible mobile drawer -->
          <div class="nested-lot-drawer" id="drawer-${group.key}">
            ${nestedBatchesHtml}
          </div>
        </div>`;
    }).join('');
}

function toggleLotGroup(groupId) {
    const row = document.getElementById(`detail-${groupId}`);
    const chevron = document.getElementById(`chevron-${groupId}`);
    const master = document.getElementById(`master-${groupId}`);
    if (row && chevron) {
        const isOpen = row.classList.toggle('open');
        chevron.classList.toggle('open', isOpen);
        if (master) {
            master.classList.toggle('expanded', isOpen);
        }
    }
}

function toggleLotDrawer(groupId) {
    const drawer = document.getElementById(`drawer-${groupId}`);
    const chevron = document.getElementById(`chevron-mob-${groupId}`);
    const card = document.getElementById(`chem-group-${groupId}`);
    if (drawer && chevron) {
        const isOpen = drawer.classList.toggle('open');
        chevron.classList.toggle('open', isOpen);
        if (card) {
            card.classList.toggle('expanded', isOpen);
        }
    }
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
    return `<div class="img-gallery-wrap" style="margin: 0 18px 12px; border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--border-soft);">
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
// IMAGE DRAG & DROP + INPUT HANDLERS
// ==========================================
function initDragAndDrop() {
    const zone = document.getElementById("imageUploadZone");
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(name => {
        zone.addEventListener(name, e => {
            e.preventDefault();
            zone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
        zone.addEventListener(name, e => {
            e.preventDefault();
            zone.classList.remove('dragover');
        }, false);
    });

    zone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processImageFiles(files);
        }
    }, false);
}

function handleImageSelection(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        processImageFiles(files);
    }
}

function processImageFiles(files) {
    const currentCount = uploadedImagesBase64.length;
    const limit = 3 - currentCount;
    if (limit <= 0) {
        showToast("เลือกภาพได้สูงสุด 3 รูปเท่านั้น", "warning");
        document.getElementById('imageInput').value = '';
        return;
    }

    const filesToProcess = Array.from(files).slice(0, limit);

    let processedCount = 0;
    filesToProcess.forEach(file => {
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
                
                processedCount++;
                if (processedCount === filesToProcess.length) {
                    renderUploadedPreviews();
                }
            };
        };
    });

    // Reset value so selection of same file is allowed next time
    document.getElementById('imageInput').value = '';
}

function renderUploadedPreviews() {
    const container = document.getElementById("imagePreviewContainer");
    if (!container) return;
    container.innerHTML = "";

    uploadedImagesBase64.forEach((b64, index) => {
        container.innerHTML += `
          <div class="img-thumb-wrap" style="margin-right: 8px; margin-bottom: 8px;">
            <img src="${b64}" class="img-thumb" onclick="viewImage('${b64}')" alt="ภาพพรีวิวที่ ${index+1}">
            <div class="img-thumb-remove" onclick="removeUploadedImage(${index}, event)">×</div>
          </div>`;
    });
}

function removeUploadedImage(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    uploadedImagesBase64.splice(index, 1);
    renderUploadedPreviews();
}

// ==========================================
// ADD / EDIT CHEMICAL
// ==========================================
function openAddModal() {
    document.getElementById("chemicalId").value = "";
    document.getElementById("chemicalForm").reset();
    document.getElementById("location").disabled = false;
    uploadedImagesBase64 = [];
    renderUploadedPreviews();
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีเข้าสต็อก";
    document.getElementById('chemModalOverlay').classList.add('open');
}

// openAddLotModal retired. Unified into openTransactionModal with new lot configuration.

function editChemical(id) {
    const item = allChemicals.find(c => c.id == id);
    if (!item) return;
    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("materialNumber").value = item.material_number || "";
    document.getElementById("lotNumber").value = item.lot_number || "";
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date || "";
    document.getElementById("expDate").value = item.exp_date || "";
    if (item.location) {
        if (item.location.includes("ห้อง 1")) {
            document.getElementById("location").value = "ห้อง 1 สารเคมีประเภทออกซิไดซ์ (Oxidizing Agent)";
        } else if (item.location.includes("ห้อง 2")) {
            document.getElementById("location").value = "ห้อง 2 สารเคมีประเภทกรด (Acid)";
        } else if (item.location.includes("ห้อง 3")) {
            document.getElementById("location").value = "ห้อง 3 สารเคมีประเภทด่าง (Alkali)";
        } else {
            document.getElementById("location").value = item.location;
        }
    } else {
        document.getElementById("location").value = "";
    }
    document.getElementById("location").disabled = false;
    document.getElementById("pricePerUnit").value = item.price_per_unit || 0.0;
    document.getElementById("chemicalVendor").value = item.vendor || "";
    document.getElementById("minQuantity").value = item.min_quantity !== undefined && item.min_quantity !== null ? item.min_quantity : "";
    document.getElementById("maxQuantity").value = item.max_quantity !== undefined && item.max_quantity !== null ? item.max_quantity : "";
    
    // Load existing images
    uploadedImagesBase64 = item.image_urls ? JSON.parse(item.image_urls) : [];
    renderUploadedPreviews();
    
    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลเคมีภัณฑ์";
    document.getElementById('chemModalOverlay').classList.add('open');
}

async function handleChemicalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    const payload = {
        chemical_name:   document.getElementById("chemicalName").value,
        material_number: document.getElementById("materialNumber").value,
        lot_number:      document.getElementById("lotNumber").value || null,
        quantity:        parseFloat(document.getElementById("quantity").value),
        unit:            document.getElementById("unit").value,
        mfg_date:        document.getElementById("mfgDate").value || null,
        exp_date:        document.getElementById("expDate").value || null,
        location:        document.getElementById("location").value,
        price_per_unit:  parseFloat(document.getElementById("pricePerUnit").value) || 0.0,
        vendor:          document.getElementById("chemicalVendor").value.trim() || null,
        min_quantity:    parseFloat(document.getElementById("minQuantity").value) || 0.0,
        max_quantity:    parseFloat(document.getElementById("maxQuantity").value) || 0.0,
        image_urls:      uploadedImagesBase64.length > 0 ? JSON.stringify(uploadedImagesBase64) : null
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
        clearStorageCache();
        fetchData();
    }
}

function closeChemModal() {
    const modal = document.getElementById('chemModalOverlay');
    if (modal) modal.classList.remove('open');
}

function closeTransModal() {
    const modal = document.getElementById('transModalOverlay');
    if (modal) modal.classList.remove('open');
}

function closeDeleteModal() {
    const modal = document.getElementById('confirmDeleteModalOverlay');
    if (modal) modal.classList.remove('open');
    pendingDeleteId = null;
}

function deleteChemical(id) {
    console.log("deleteChemical called with id:", id);
    // Use string conversion to ensure safety across number/string representations
    const item = allChemicals.find(c => String(c.id) === String(id));
    
    pendingDeleteId = id;
    const nameEl = document.getElementById("deleteItemName");
    
    if (!item) {
        console.warn("Chemical item not found in local cache for id:", id);
        if (nameEl) nameEl.innerHTML = `คุณต้องการลบสารเคมีรายการนี้ใช่หรือไม่?`;
    } else {
        pendingDeleteId = item.id;
        if (nameEl) nameEl.innerHTML = `คุณต้องการลบสารเคมี <strong>"${item.chemical_name}"</strong> ใช่หรือไม่?`;
    }
    
    const modal = document.getElementById("confirmDeleteModalOverlay");
    if (modal) {
        modal.classList.add("open");
        console.log("confirmDeleteModalOverlay opened successfully");
    } else {
        console.error("confirmDeleteModalOverlay element not found in DOM!");
    }
}

async function executeChemicalDelete() {
    if (!pendingDeleteId) {
        console.error("executeChemicalDelete called without pendingDeleteId");
        return;
    }
    const id = pendingDeleteId;
    closeDeleteModal();
    
    console.log("Executing delete query on Supabase for chemical id:", id);
    const { error } = await _supabase.from('chemical_stock').delete().eq('id', id);
    if (error) {
        console.error("Supabase delete query failed:", error);
        showToast("ลบไม่สำเร็จ: " + error.message, "danger");
    } else {
        console.log("Supabase delete query succeeded");
        showToast("ลบรายการสำเร็จ", "success");
        clearStorageCache();
        fetchData();
    }
}

// ==========================================
// TRANSACTIONS
// ==========================================
function openTransactionModal(id, isNewLot = false) {
    const item = allChemicals.find(c => c.id == id);
    if (!item) return;
    document.getElementById("transChemId").value = item.id;
    document.getElementById("transChemName").textContent = item.chemical_name;
    document.getElementById("transUnitLabel").textContent = item.unit;
    document.getElementById("transQty").value = "";
    document.getElementById("transPricePerUnit").value = item.price_per_unit || 0.0;
    document.getElementById("transFreeQty").value = 0.0;
    document.getElementById("transPromoToggle").checked = false;
    document.getElementById("transFreeQtyContainer").style.display = "none";
    document.getElementById("transSummaryText").style.display = "none";
    document.getElementById("transSummaryText").innerHTML = "";
    document.getElementById("transSubmitBtn").disabled = false;
    document.getElementById("transVendor").value = "";
    document.getElementById("transRemark").value = "";
    document.getElementById("transType").value = "IN";

    // Handle New Lot toggles and inputs
    const newLotToggle = document.getElementById("transNewLotToggle");
    const newLotContainer = document.getElementById("transNewLotContainer");
    if (newLotToggle && newLotContainer) {
        newLotToggle.checked = isNewLot;
        newLotContainer.style.display = isNewLot ? "block" : "none";
        document.getElementById("transLotNumber").required = isNewLot;
        document.getElementById("transLocation").required = isNewLot;
        document.getElementById("transLotNumber").value = "";
        document.getElementById("transLocation").value = item.location || "";
        document.getElementById("transMfgDate").value = "";
        document.getElementById("transExpDate").value = "";
    }

    document.getElementById('transModalOverlay').classList.add('open');
    if (typeof selectTransType === 'function') selectTransType('IN');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id   = document.getElementById("transChemId").value;
    const type = document.getElementById("transType").value;
    const qty  = parseFloat(document.getElementById("transQty").value);
    const remark = document.getElementById("transRemark").value;

    const transPrice = parseFloat(document.getElementById("transPricePerUnit").value) || 0.0;
    const isPromo = document.getElementById("transPromoToggle").checked;
    const transFree  = (type === 'IN' && isPromo) ? (parseFloat(document.getElementById("transFreeQty").value) || 0.0) : 0.0;
    const transSaving = (type === 'IN') ? (transPrice * transFree) : 0.0;
    const transVendor = (type === 'IN') ? document.getElementById("transVendor").value.trim() : null;

    const item = allChemicals.find(c => c.id == id);
    if (!item) { showToast("ไม่พบข้อมูลสารเคมี!", "danger"); return; }

    const isNewLot = (type === 'IN') && document.getElementById("transNewLotToggle").checked;
    
    let targetChemId = id;

    if (isNewLot) {
        // Create new lot row in chemical_stock first
        const lotNum = document.getElementById("transLotNumber").value.trim();
        const lotLoc = document.getElementById("transLocation").value;
        const mfgVal = document.getElementById("transMfgDate").value || null;
        const expVal = document.getElementById("transExpDate").value || null;

        if (!lotNum || !lotLoc) {
            showToast("กรุณากรอกเลขที่ล็อตและสถานที่จัดเก็บสำหรับล็อตใหม่!", "warning");
            return;
        }

        const newLotPayload = {
            chemical_name:   item.chemical_name,
            material_number: item.material_number,
            lot_number:      lotNum,
            quantity:        qty, // initial quantity of new lot
            unit:            item.unit,
            mfg_date:        mfgVal,
            exp_date:        expVal,
            location:        lotLoc,
            price_per_unit:  transPrice,
            vendor:          transVendor,
            min_quantity:    item.min_quantity || 0.0,
            max_quantity:    item.max_quantity || 0.0,
            image_urls:      null
        };

        const { data: insertData, error: insertError } = await _supabase
            .from('chemical_stock')
            .insert([newLotPayload])
            .select('id')
            .single();

        if (insertError) {
            showToast("สร้างล็อตใหม่ไม่สำเร็จ: " + insertError.message, "danger");
            return;
        }

        targetChemId = insertData.id;
    } else {
        // Update existing lot quantity
        const newQty = type === 'IN' ? item.quantity + qty : item.quantity - qty;
        if (newQty < 0) { showToast("สต็อกคงเหลือไม่เพียงพอ!", "danger"); return; }

        const { error: updateError } = await _supabase
            .from('chemical_stock')
            .update({ quantity: newQty })
            .eq('id', id);

        if (updateError) {
            showToast("อัปเดตปริมาณสต็อกไม่สำเร็จ: " + updateError.message, "danger");
            return;
        }
    }

    // Insert transaction
    const { error: transError } = await _supabase.from('chemical_transactions').insert([{ 
        chemical_id: targetChemId, 
        type, 
        quantity: qty, 
        remark,
        price_per_unit: transPrice,
        free_quantity: transFree,
        saving: transSaving,
        vendor: transVendor
    }]);

    if (transError) {
        showToast("บันทึกประวัติการทำรายการไม่สำเร็จ: " + transError.message, "danger");
    } else {
        showToast(
            type === 'IN'
                ? (isNewLot ? `เปิดล็อตใหม่และรับเข้าสำเร็จ` : `รับเข้า ${qty} ${item.unit} สำเร็จ`)
                : `เบิกจ่าย ${qty} ${item.unit} สำเร็จ`,
            type === 'IN' ? 'success' : 'warning'
        );
    }

    document.getElementById('transModalOverlay').classList.remove('open');

    // Flash animation on card/row
    flashCard(id, type);

    showToast(
        type === 'IN'
            ? `รับเข้า ${qty} ${item.unit} สำเร็จ`
            : `เบิกจ่าย ${qty} ${item.unit} สำเร็จ`,
        type === 'IN' ? 'success' : 'warning'
    );

    clearStorageCache();
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
    return { class: '', label: 'ปกติ', cardClass: '', badgeClass: 'badge-green' };
}

function setQuickExp(months) {
    const mfgVal = document.getElementById('mfgDate').value;
    let baseDate;
    if (mfgVal) {
        const parts = mfgVal.split('-');
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        baseDate = new Date();
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    document.getElementById('expDate').value = `${y}-${m}-${day}`;
}
window.setQuickExp = setQuickExp;

function setQuickExpTrans(months) {
    const mfgVal = document.getElementById('transMfgDate').value;
    let baseDate;
    if (mfgVal) {
        const parts = mfgVal.split('-');
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        baseDate = new Date();
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    document.getElementById('transExpDate').value = `${y}-${m}-${day}`;
}

window.deleteChemical = deleteChemical;
window.closeDeleteModal = closeDeleteModal;
window.executeChemicalDelete = executeChemicalDelete;
window.updateTransSummary = updateTransSummary;
window.setQuickExpTrans = setQuickExpTrans;

function updateTransSummary() {
    const isPromo = document.getElementById("transPromoToggle")?.checked;
    const qtyInput = document.getElementById("transQty");
    const priceInput = document.getElementById("transPricePerUnit");
    const freeInput = document.getElementById("transFreeQty");
    const summaryDiv = document.getElementById("transSummaryText");
    const submitBtn = document.getElementById("transSubmitBtn");

    if (!qtyInput || !priceInput || !freeInput || !summaryDiv || !submitBtn) return;

    const totalQty = parseFloat(qtyInput.value) || 0.0;
    const unitPrice = parseFloat(priceInput.value) || 0.0;
    const freeQty = isPromo ? (parseFloat(freeInput.value) || 0.0) : 0.0;

    if (!qtyInput.value) {
        summaryDiv.style.display = "none";
        submitBtn.disabled = false;
        return;
    }

    // Validation
    if (isPromo && freeQty > totalQty) {
        summaryDiv.style.display = "block";
        summaryDiv.style.borderColor = "var(--danger)";
        summaryDiv.style.background = "rgba(239, 68, 68, 0.05)";
        summaryDiv.innerHTML = `<span style="color: var(--danger); font-weight: bold;">⚠️ จำนวนของแถม (${freeQty}) ต้องไม่เกินจำนวนรับเข้าทั้งหมด (${totalQty})</span>`;
        submitBtn.disabled = true;
        return;
    }

    // Calculations
    const paidQty = Math.max(0, totalQty - freeQty);
    const totalPaid = paidQty * unitPrice;
    const totalSaving = freeQty * unitPrice;

    summaryDiv.style.display = "block";
    summaryDiv.style.borderColor = "var(--primary)";
    summaryDiv.style.background = "var(--bg-hover)";
    submitBtn.disabled = false;

    if (isPromo) {
        summaryDiv.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px; color: var(--primary);">สรุปราคารับเข้าแบบโปรโมชัน:</div>
            • ซื้อจริง: <span style="font-weight:600; color:var(--text-head);">${paidQty.toLocaleString('th-TH')}</span> | แถมฟรี: <span style="font-weight:600; color:var(--success);">${freeQty.toLocaleString('th-TH')}</span><br>
            • รวมได้รับเข้าสต็อก: <span style="font-weight:600; color:var(--text-head);">${totalQty.toLocaleString('th-TH')}</span><br>
            • <span style="color: var(--success); font-weight:600;">ยอดประหยัด (Saving): ${totalSaving.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span><br>
            • ยอดจ่ายจริง: <span style="font-weight:600; color:var(--text-head);">${totalPaid.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>
        `;
    } else {
        summaryDiv.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-head);">สรุปราคารับเข้าปกติ:</div>
            • จำนวนซื้อจริง: <span style="font-weight:600; color:var(--text-head);">${totalQty.toLocaleString('th-TH')}</span> (ไม่มีของแถม)<br>
            • ยอดจ่ายรวม: <span style="font-weight:600; color:var(--primary); font-size: 13.5px;">${totalPaid.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})} บาท</span>
        `;
    }
}
window.updateTransSummary = updateTransSummary;
