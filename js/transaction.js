// ==========================================
// KlangSarn — Transaction History Logic v2.1
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allTransactions = [];
let typeFilter = 'ALL';

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    fetchTransactions();
});

async function fetchTransactions() {
    const tbody = document.getElementById("transactionTableBody");
    
    // 1. Load cached data from sessionStorage to render instantly
    const cachedHistory = sessionStorage.getItem('klangsarn_history_transactions');
    if (cachedHistory) {
        try {
            allTransactions = JSON.parse(cachedHistory);
            applyFilters();
        } catch (e) {
            console.warn("Error parsing history cache", e);
        }
    }

    // 2. Fetch fresh data in background from Supabase
    const { data, error } = await _supabase
        .from('chemical_transactions')
        .select('id, type, quantity, remark, transaction_date, vendor, chemical_stock(chemical_name, unit, lot_number)')
        .order('transaction_date', { ascending: false });

    if (error) {
        if (!allTransactions.length) {
            showToast("โหลดข้อมูลประวัติไม่สำเร็จ", "danger");
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--danger);">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
        }
        return;
    }

    allTransactions = data || [];

    // 3. Cache new data and render updates
    sessionStorage.setItem('klangsarn_history_transactions', JSON.stringify(allTransactions));
    applyFilters();
}

function filterTrans(type, btnEl) {
    typeFilter = type;
    document.querySelectorAll('#typeFilterBar .filter-chip').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const searchVal = (document.getElementById("searchTrans")?.value || "").toLowerCase().trim();
    
    const filtered = allTransactions.filter(t => {
        // 1. Type Filter
        if (typeFilter !== 'ALL' && t.type !== typeFilter) {
            return false;
        }
        // 2. Search Filter (matches chemical name, remark, vendor, or lot number)
        const chemName = t.chemical_stock?.chemical_name || "";
        const remark = t.remark || "";
        const lot = t.chemical_stock?.lot_number || "";
        const vendor = t.vendor || "";
        if (searchVal && !chemName.toLowerCase().includes(searchVal) && !remark.toLowerCase().includes(searchVal) && !lot.toLowerCase().includes(searchVal) && !vendor.toLowerCase().includes(searchVal)) {
            return false;
        }
        return true;
    });

    renderTransactions(filtered);
}

function renderTransactions(filtered) {
    const tbody = document.getElementById("transactionTableBody");
    const mbody = document.getElementById("transCardsBody");
    const countLabel = document.getElementById("transCountLabel");

    if (countLabel) {
        countLabel.textContent = `บันทึกการรับเข้าและเบิกจ่ายทั้งหมด (${filtered.length} รายการ)`;
    }

    // Render Desktop Table
    if (tbody) {
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6">
              <div class="empty-state" style="padding:40px;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.3" stroke-linecap="round" style="margin:0 auto 10px;display:block;">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/>
                  <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/>
                </svg>
                <div class="empty-title">ไม่พบรายการประวัติ</div>
              </div>
            </td></tr>`;
        } else {
            tbody.innerHTML = filtered.map(t => {
                const date = new Date(t.transaction_date);
                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;

                const typeBadge = t.type === 'IN'
                    ? `<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
                    : `<span class="badge badge-red"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;

                const lotStr = t.chemical_stock?.lot_number 
                    ? `<span class="mono" style="font-size:11px;color:var(--text-muted);background:var(--bg-hover);border:1px solid var(--border-soft);padding:1px 5px;border-radius:4px;margin-left:6px;font-weight:normal;">Lot: ${t.chemical_stock.lot_number}</span>`
                    : '';
                const chemName = t.chemical_stock?.chemical_name
                    ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>${lotStr}`
                    : `<span style="color:var(--text-muted);font-style:italic;">สารเคมีถูกลบแล้ว</span>`;

                const unit = t.chemical_stock?.unit || "";

                const trClass = t.type === 'IN' ? 'tr-in' : 'tr-out';
                const qtyPrefix = t.type === 'IN' ? '+' : '-';
                const qtyClass = t.type === 'IN' ? 'text-in' : 'text-out';
                const vendorStr = t.vendor ? `<span style="font-weight:500;color:var(--text-body);">${t.vendor}</span>` : '—';

                return `<tr class="${trClass}">
                  <td style="padding-left:22px;font-size:13px;color:var(--text-muted);">${dateStr}</td>
                  <td>${chemName}</td>
                  <td>${typeBadge}</td>
                  <td>
                    <span class="mono ${qtyClass}" style="font-size:14.5px;">${qtyPrefix}${t.quantity}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${unit}</span>
                  </td>
                  <td>${vendorStr}</td>
                  <td style="padding-right:22px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
                </tr>`;
            }).join('');
        }
    }

    // Render Mobile Cards List
    if (mbody) {
        if (filtered.length === 0) {
            mbody.innerHTML = `
              <div style="padding:40px 20px;text-align:center;background:var(--bg-card);border-radius:var(--r-xl);border:1.5px solid var(--border-soft);box-shadow:var(--shadow-xs);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.3" stroke-linecap="round" style="margin:0 auto 10px;display:block;">
                  <rect x="5" y="2" width="14" height="20" rx="2"/>
                </svg>
                <div style="font-weight:600;color:var(--text-body);">ไม่พบประวัติรายการ</div>
              </div>`;
        } else {
            mbody.innerHTML = filtered.map(t => {
                const date = new Date(t.transaction_date);
                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;

                const typeBadge = t.type === 'IN'
                    ? `<span class="badge badge-green" style="padding: 2px 6px; font-size: 10px;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
                    : `<span class="badge badge-red" style="padding: 2px 6px; font-size: 10px;"><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;

                const lotStrMob = t.chemical_stock?.lot_number 
                    ? `<span class="mono" style="font-size:10px;color:var(--text-muted);background:var(--bg-hover);border:1px solid var(--border-soft);padding:1px 4px;border-radius:3px;font-weight:normal;margin-left:6px;">Lot: ${t.chemical_stock.lot_number}</span>`
                    : '';
                const chemNameHtml = t.chemical_stock?.chemical_name
                    ? `<span class="trans-mob-name">${t.chemical_stock.chemical_name}${lotStrMob}</span>`
                    : '<span class="trans-mob-name" style="color:var(--text-muted);font-style:italic;">สารเคมีถูกลบแล้ว</span>';

                const unit = t.chemical_stock?.unit || "";

                const cardClass = t.type === 'IN' ? 'card-in' : 'card-out';
                const qtyPrefix = t.type === 'IN' ? '+' : '-';
                const qtyClass = t.type === 'IN' ? 'text-in' : 'text-out';

                const vendorMob = t.vendor ? `<div style="font-size: 11.5px; color: var(--text-body); margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2.5" style="vertical-align: middle;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  <span>${t.vendor}</span>
                </div>` : '';

                return `
                <div class="trans-mobile-card ${cardClass}">
                  <div class="trans-mob-row1">
                    ${chemNameHtml}
                    <div class="trans-mob-qty">
                      <span class="${qtyClass}">${qtyPrefix}${t.quantity}</span>
                      <span style="font-size:11px;color:var(--text-muted);margin-left:2px;font-weight:normal;">${unit}</span>
                    </div>
                  </div>
                  ${vendorMob}
                  <div class="trans-mob-row2">
                    <div class="trans-mob-meta-left">
                      <span>${dateStr}</span>
                      ${typeBadge}
                    </div>
                    <div class="trans-mob-remark" title="${t.remark || ''}">
                      ${t.remark || '—'}
                    </div>
                  </div>
                </div>`;
            }).join('');
        }
    }
}
