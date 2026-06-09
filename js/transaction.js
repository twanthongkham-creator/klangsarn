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
        .select('id, type, quantity, remark, transaction_date, vendor, chemical_stock(chemical_name, unit)')
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
        const vendor = t.vendor || "";
        if (searchVal && !chemName.toLowerCase().includes(searchVal) && !remark.toLowerCase().includes(searchVal) && !vendor.toLowerCase().includes(searchVal)) {
            return false;
        }
        return true;
    });

    renderTransactions(filtered);
}

function renderTransactions(filtered) {
    const tbody = document.getElementById("transactionTableBody");
    const countLabel = document.getElementById("transCountLabel");

    if (countLabel) {
        countLabel.textContent = `บันทึกการรับเข้าและเบิกจ่ายทั้งหมด (${filtered.length} รายการ)`;
    }

    // Render Table
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

                const chemName = t.chemical_stock?.chemical_name
                    ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>`
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
                    <span class="mono ${qtyClass}" style="font-size:14.5px;">${qtyPrefix}${parseFloat(t.quantity).toLocaleString('th-TH')}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${unit}</span>
                  </td>
                  <td>${vendorStr}</td>
                  <td style="padding-right:22px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
                </tr>`;
            }).join('');
        }
    }
}
