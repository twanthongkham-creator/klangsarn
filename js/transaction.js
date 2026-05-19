const SUPABASE_URL = “https://bdjyxkkzbbzlmxszmvhx.supabase.co”;
const SUPABASE_KEY = “sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2”;
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allTransactions = [];
let currentTypeFilter = ‘ALL’;

document.addEventListener(“DOMContentLoaded”, () => { fetchTransactions(); });

async function fetchTransactions() {
const { data, error } = await _supabase
.from(‘chemical_transactions’)
.select(`id, type, quantity, remark, transaction_date, chemical_stock(chemical_name, unit)`)
.order(‘transaction_date’, { ascending: false });

```
if (error) { showToast("โหลดข้อมูลไม่สำเร็จ", "danger"); return; }
allTransactions = data || [];
applyFilters();
```

}

function filterTrans(type, btnEl) {
currentTypeFilter = type;
document.querySelectorAll(’#typeFilterBar .filter-chip’).forEach(b => b.classList.remove(‘active’));
btnEl.classList.add(‘active’);
applyFilters();
}

function applyFilters() {
const q = (document.getElementById(‘searchTrans’)?.value || ‘’).toLowerCase().trim();
let filtered = allTransactions;
if (currentTypeFilter !== ‘ALL’) filtered = filtered.filter(t => t.type === currentTypeFilter);
if (q) filtered = filtered.filter(t =>
(t.chemical_stock?.chemical_name || ‘’).toLowerCase().includes(q) ||
(t.remark || ‘’).toLowerCase().includes(q)
);

```
const label = document.getElementById('transCountLabel');
if (label) label.textContent = `แสดง ${filtered.length} จาก ${allTransactions.length} รายการ`;

renderDesktopTable(filtered);
renderMobileCards(filtered);
```

}

function fmtDate(ts) {
const d = new Date(ts);
return {
date: `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`,
time: `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} น.`
};
}

function typeBadge(type) {
return type === ‘IN’
? `<span class="badge badge-green"> <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
: `<span class="badge badge-red"> <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;
}

// ===== DESKTOP TABLE =====
function renderDesktopTable(data) {
const tbody = document.getElementById(“transactionTableBody”);
if (!tbody) return;

```
if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" style="margin:0 auto 12px;display:block;">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="11" y2="17"/>
        </svg>
        <div class="empty-title">ไม่พบรายการที่ตรงกัน</div>
        <div class="empty-desc">ลองเปลี่ยนตัวกรองหรือคำค้นหา</div>
      </div>
    </td></tr>`;
    return;
}

tbody.innerHTML = data.map(t => {
    const { date, time } = fmtDate(t.transaction_date);
    const name = t.chemical_stock
        ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>`
        : `<span style="color:var(--text-muted);font-style:italic;">ลบออกจากระบบแล้ว</span>`;
    const unit = t.chemical_stock?.unit || '';

    return `<tr>
      <td style="padding-left:22px;">
        <div style="font-weight:600;font-size:13.5px;color:var(--text-head);">${date}</div>
        <div style="font-size:12px;color:var(--text-muted);">${time}</div>
      </td>
      <td>${name}</td>
      <td>${typeBadge(t.type)}</td>
      <td>
        <span class="mono" style="font-size:15px;font-weight:700;color:var(--text-head);">${t.quantity}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${unit}</span>
      </td>
      <td style="padding-right:22px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
    </tr>`;
}).join('');
```

}

// ===== MOBILE CARDS =====
function renderMobileCards(data) {
const container = document.getElementById(“transCardsBody”);
if (!container) return;

```
if (data.length === 0) {
    container.innerHTML = `
      <div style="padding:40px 20px;text-align:center;background:var(--bg-card);border-radius:var(--r-xl);border:1.5px solid var(--border-soft);box-shadow:var(--shadow-xs);">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" style="margin:0 auto 12px;display:block;">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/>
        </svg>
        <div style="font-weight:600;color:var(--text-body);">ไม่พบรายการ</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">ลองเปลี่ยนตัวกรอง</div>
      </div>`;
    return;
}

container.innerHTML = data.map(t => {
    const { date, time } = fmtDate(t.transaction_date);
    const isIN = t.type === 'IN';
    const name = t.chemical_stock?.chemical_name || 'ลบออกจากระบบแล้ว';
    const unit = t.chemical_stock?.unit || '';

    /* colour tokens */
    const col  = isIN ? 'var(--success)'  : 'var(--danger)';
    const bgC  = isIN ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.09)';
    const sign = isIN ? '+' : '−';

    const arrowSvg = isIN
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

    return `
    <div style="background:var(--bg-card);border-radius:var(--r-xl);border:1.5px solid var(--border-soft);
      padding:14px 16px;display:flex;gap:12px;align-items:center;box-shadow:var(--shadow-xs);">

      <!-- Icon -->
      <div style="width:44px;height:44px;border-radius:var(--r-md);background:${bgC};
        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        ${arrowSvg}
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:14px;color:var(--text-head);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">${date} · ${time}</div>
        ${t.remark ? `<div style="font-size:12px;color:var(--text-body);margin-top:4px;display:flex;gap:4px;align-items:center;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          ${t.remark}
        </div>` : ''}
      </div>

      <!-- Qty + Badge -->
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:20px;font-weight:700;color:${col};font-family:'JetBrains Mono',monospace;line-height:1;">
          ${sign}${t.quantity}
        </div>
        <div style="font-size:11px;color:var(--text-muted);">${unit}</div>
        <div style="margin-top:5px;">${typeBadge(t.type)}</div>
      </div>
    </div>`;
}).join('');
```

}
