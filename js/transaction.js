const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allTransactions = [];
let currentTypeFilter = 'ALL';

document.addEventListener("DOMContentLoaded", () => {
    fetchTransactions();
});

async function fetchTransactions() {
    const { data, error } = await _supabase
        .from('chemical_transactions')
        .select(`id, type, quantity, remark, transaction_date, chemical_stock(chemical_name, unit)`)
        .order('transaction_date', { ascending: false });

    if (error) {
        console.error("Error:", error);
        showToast("โหลดข้อมูลไม่สำเร็จ", "danger");
        return;
    }

    allTransactions = data;
    applyFilters();
}

function filterTrans(type, btnEl) {
    currentTypeFilter = type;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    applyFilters();
}

function applyFilters() {
    const searchVal = (document.getElementById('searchTrans')?.value || '').toLowerCase();

    let filtered = allTransactions;

    if (currentTypeFilter !== 'ALL') {
        filtered = filtered.filter(t => t.type === currentTypeFilter);
    }

    if (searchVal) {
        filtered = filtered.filter(t =>
            t.chemical_stock?.chemical_name?.toLowerCase().includes(searchVal) ||
            (t.remark || '').toLowerCase().includes(searchVal)
        );
    }

    renderDesktopTable(filtered);
    renderMobileCards(filtered);
}

function formatDate(t) {
    const d = new Date(t);
    const date = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
    const time = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    return { date, time };
}

function renderDesktopTable(data) {
    const tbody = document.getElementById("transactionTableBody");
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">ไม่พบรายการ</div>
            <div class="empty-desc">ลองเปลี่ยนตัวกรองหรือคำค้นหา</div>
          </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(t => {
        const { date, time } = formatDate(t.transaction_date);
        const badge = t.type === 'IN'
            ? `<span class="badge badge-green"><i class="bi bi-arrow-down-short"></i>รับเข้า</span>`
            : `<span class="badge badge-red"><i class="bi bi-arrow-up-short"></i>เบิกจ่าย</span>`;
        const name = t.chemical_stock ? t.chemical_stock.chemical_name : '<em style="color:var(--text-muted)">ลบแล้ว</em>';
        const unit = t.chemical_stock?.unit || '';

        return `<tr>
          <td style="padding-left:20px;">
            <div style="font-weight:500;font-size:14px;color:var(--text-primary);">${date}</div>
            <div style="font-size:12px;color:var(--text-muted);">${time} น.</div>
          </td>
          <td style="font-weight:500;color:var(--text-primary);">${name}</td>
          <td>${badge}</td>
          <td>
            <span class="mono" style="font-size:15px;font-weight:600;color:var(--text-primary);">${t.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${unit}</span>
          </td>
          <td style="padding-right:20px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
        </tr>`;
    }).join('');
}

function renderMobileCards(data) {
    const container = document.getElementById("transCardsBody");
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;background:var(--bg-card);border-radius:var(--r-lg);border:1px solid var(--border);">
          <div style="font-size:36px;margin-bottom:8px;">📋</div>
          <div style="font-weight:600;color:var(--text-secondary);">ไม่พบรายการ</div>
        </div>`;
        return;
    }

    container.innerHTML = data.map(t => {
        const { date, time } = formatDate(t.transaction_date);
        const isIn = t.type === 'IN';
        const name = t.chemical_stock ? t.chemical_stock.chemical_name : 'ลบแล้ว';
        const unit = t.chemical_stock?.unit || '';
        const color = isIn ? 'var(--success)' : 'var(--danger)';
        const icon = isIn ? 'bi-arrow-down-circle-fill' : 'bi-arrow-up-circle-fill';
        const label = isIn ? 'รับเข้า' : 'เบิกจ่าย';

        return `<div style="
          background:var(--bg-card);border-radius:var(--r-lg);
          border:1px solid var(--border);padding:16px;
          display:flex;gap:12px;align-items:flex-start;
          box-shadow:var(--shadow-xs);
        ">
          <div style="width:40px;height:40px;border-radius:var(--r-full);background:${isIn ? 'var(--success-bg)' : 'var(--danger-bg)'};
            display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="bi ${icon}" style="color:${color};font-size:18px;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${date} ${time} น.</div>
            ${t.remark ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;"><i class="bi bi-chat-left-text" style="margin-right:3px;"></i>${t.remark}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:18px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace;">${isIn ? '+' : '-'}${t.quantity}</div>
            <div style="font-size:11px;color:var(--text-muted);">${unit}</div>
            <div style="margin-top:4px;"><span class="badge" style="background:${isIn ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${color};font-size:10px;">${label}</span></div>
          </div>
        </div>`;
    }).join('');
}
