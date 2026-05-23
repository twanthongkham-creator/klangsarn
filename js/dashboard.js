// ==========================================
// ChemStock — Dashboard Logic v2.3
// Fiscal Year Savings & Charts
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalTransData = [];
let savingChartInstance = null;

document.addEventListener("DOMContentLoaded", () => { loadDashboardData(); });

async function loadDashboardData() {
    const now = new Date();
    const el = document.getElementById('dashUpdateTime');
    if (el) el.textContent =
        `อัปเดต: ${now.toLocaleDateString('th-TH',{day:'2-digit',month:'long',year:'numeric'})} ${now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น.`;

    const [stockRes, transRes] = await Promise.all([
        _supabase.from('chemical_stock').select('*'),
        _supabase.from('chemical_transactions')
            .select('id, type, quantity, saving, transaction_date, chemical_stock(chemical_name, unit, lot_number)')
            .order('transaction_date', { ascending: false })
    ]);

    if (stockRes.error || transRes.error) {
        showToast("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ", "danger");
        return;
    }

    const stockData = stockRes.data || [];
    globalTransData = transRes.data || [];

    const firstDay = new Date();
    firstDay.setDate(1); firstDay.setHours(0,0,0,0);

    renderSummaryCards(stockData, globalTransData, firstDay);
    renderLocationChart(stockData);
    renderRecentTransactions(globalTransData.slice(0, 10));
    renderAlertTable(stockData);
    initSavingDashboard(globalTransData);
}

// ===== FISCAL YEAR HELPER =====
// Fiscal Year runs from Oct 1 to Sep 30 of the following year
function getFiscalYear(date) {
    const d = new Date(date);
    const month = d.getMonth(); // 0-11 (Oct is 9)
    const year = d.getFullYear();
    return (month >= 9) ? year + 1 : year;
}

// ===== STAT CARDS =====
function renderSummaryCards(stockData, transData, firstDay) {
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    
    // Count unique chemical products (by name and material number)
    const uniqueChemicals = new Set(stockData.map(c => `${c.chemical_name}::${c.material_number || ''}`));
    setEl('dashTotalItems', uniqueChemicals.size);

    const today = new Date();
    const alerts = stockData.filter(c => {
        if (!c.exp_date) return false;
        return (new Date(c.exp_date) - today) / 864e5 <= 30;
    });
    setEl('dashAlertItems', alerts.length);

    let inC = 0;
    transData.forEach(t => {
        if (new Date(t.transaction_date) >= firstDay) {
            if (t.type === 'IN') inC++;
        }
    });
    setEl('dashInMonth', inC);

    // Compute Fiscal Year Savings
    const currentFiscalYear = getFiscalYear(new Date());
    let fiscalSavingSum = 0;
    transData.forEach(t => {
        if (t.saving && getFiscalYear(t.transaction_date) === currentFiscalYear) {
            fiscalSavingSum += t.saving;
        }
    });
    setEl('dashFiscalSaving', fiscalSavingSum.toLocaleString('th-TH') + ' ฿');
    setEl('dashFiscalLabel', `ปีงบประมาณ ${currentFiscalYear} (ต.ค. - ก.ย.)`);
}

// ===== DONUT CHART =====
function renderLocationChart(stockData) {
    const counts = {};
    stockData.forEach(c => {
        const loc = c.location ? c.location.split(' ').slice(0,2).join(' ') : 'ไม่ระบุ';
        counts[loc] = (counts[loc] || 0) + 1;
    });

    const ctx = document.getElementById('locationChart')?.getContext('2d');
    if (!ctx) return;
    if (window._dashChart) window._dashChart.destroy();

    const gradColors = [
        '#2563EB', '#D97706', '#10B981', '#F43F5E', '#7C3AED', '#0891B2'
    ];

    window._dashChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: gradColors,
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 8,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Kanit', sans-serif", size: 12 },
                        padding: 18,
                        color: '#374151',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#0A1628',
                    titleColor: '#fff',
                    bodyColor: '#94A3B8',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => `  ${ctx.label}: ${ctx.raw} รายการ`
                    }
                }
            },
            cutout: '68%'
        }
    });
}

// ===== RECENT TRANSACTIONS TABLE =====
function renderRecentTransactions(data) {
    const tbody = document.getElementById('dashRecentTrans');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(t => {
        const d = new Date(t.transaction_date);
        const ds = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

        const badge = t.type === 'IN'
            ? `<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
            : `<span class="badge badge-red"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;

        const name = t.chemical_stock
            ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>`
            : `<span style="color:var(--text-muted);font-style:italic;">ลบแล้ว</span>`;
        const unit = t.chemical_stock?.unit || '';

        return `<tr>
          <td style="padding-left:20px;font-size:13px;color:var(--text-muted);">${ds}</td>
          <td>${name}</td>
          <td>${badge}</td>
          <td style="padding-right:20px;">
            <span class="mono" style="font-weight:700;font-size:15px;color:var(--text-head);">${t.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${unit}</span>
          </td>
        </tr>`;
    }).join('');
}

// ===== ALERT TABLE =====
function renderAlertTable(stockData) {
    const today = new Date();
    const alerts = stockData
        .filter(c => c.exp_date && (new Date(c.exp_date) - today) / 864e5 <= 30)
        .sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date));

    const card  = document.getElementById('alertCard');
    const tbody = document.getElementById('dashAlertTable');
    if (!card || !tbody) return;
    if (alerts.length === 0) { card.style.display = 'none'; return; }
    card.style.display = '';

    tbody.innerHTML = alerts.map(item => {
        const diff = Math.ceil((new Date(item.exp_date) - today) / 864e5);
        const statusBadge = diff <= 0
            ? `<span class="badge badge-red">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                หมดอายุแล้ว</span>`
            : `<span class="badge badge-amber">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                เหลือ ${diff} วัน</span>`;

        const nameText = item.lot_number ? `${item.chemical_name} (ล็อต ${item.lot_number})` : item.chemical_name;
        return `<tr>
          <td style="padding-left:20px;font-weight:600;color:var(--text-head);">${nameText}</td>
          <td><span class="badge badge-gray" style="font-size:11px;">${item.location ? item.location.split(' ').slice(0,2).join(' ') : '—'}</span></td>
          <td><span class="mono" style="font-size:13px;">${formatDisplayDate(item.exp_date)}</span></td>
          <td style="padding-right:20px;">${statusBadge}</td>
        </tr>`;
    }).join('');
}

// ===== FISCAL YEAR SAVINGS CHART =====
function initSavingDashboard(transData) {
    const select = document.getElementById('savingYearSelect');
    if (!select) return;

    // Get all unique fiscal years represented in transactions containing savings
    const yearsSet = new Set();
    // Always include current fiscal year as fallback
    yearsSet.add(getFiscalYear(new Date()));
    
    transData.forEach(t => {
        if (t.saving > 0) {
            yearsSet.add(getFiscalYear(t.transaction_date));
        }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a); // descending order
    
    const currentVal = select.value;
    select.innerHTML = sortedYears.map(yr => `<option value="${yr}">ปีงบประมาณ ${yr}</option>`).join('');
    
    if (currentVal && sortedYears.includes(parseInt(currentVal))) {
        select.value = currentVal;
    } else {
        select.value = getFiscalYear(new Date());
    }

    renderFiscalSavingChart(parseInt(select.value));
}

function changeFiscalYear() {
    const select = document.getElementById('savingYearSelect');
    if (!select) return;
    renderFiscalSavingChart(parseInt(select.value));
}

function renderFiscalSavingChart(fiscalYear) {
    const ctx = document.getElementById('savingChart')?.getContext('2d');
    if (!ctx) return;

    // Months of Fiscal Year: Oct (index 9) of (fiscalYear-1) to Sep (index 8) of fiscalYear
    const months = [
        { label: 'ต.ค.', month: 9, year: fiscalYear - 1 },
        { label: 'พ.ย.', month: 10, year: fiscalYear - 1 },
        { label: 'ธ.ค.', month: 11, year: fiscalYear - 1 },
        { label: 'ม.ค.', month: 0, year: fiscalYear },
        { label: 'ก.พ.', month: 1, year: fiscalYear },
        { label: 'มี.ค.', month: 2, year: fiscalYear },
        { label: 'เม.ย.', month: 3, year: fiscalYear },
        { label: 'พ.ค.', month: 4, year: fiscalYear },
        { label: 'มิ.ย.', month: 5, year: fiscalYear },
        { label: 'ก.ค.', month: 6, year: fiscalYear },
        { label: 'ส.ค.', month: 7, year: fiscalYear },
        { label: 'ก.ย.', month: 8, year: fiscalYear }
    ];

    // Initialize savings array with 0.0 for each of the 12 fiscal months
    const savingsData = new Array(12).fill(0.0);

    // Sum savings matching each slot
    globalTransData.forEach(t => {
        if (!t.saving || t.saving <= 0) return;
        const tDate = new Date(t.transaction_date);
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();

        for (let i = 0; i < months.length; i++) {
            if (months[i].month === tMonth && months[i].year === tYear) {
                savingsData[i] += t.saving;
                break;
            }
        }
    });

    if (savingChartInstance) {
        savingChartInstance.destroy();
    }

    const chartLabels = months.map(m => m.label);

    savingChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'ยอดประหยัด (บาท)',
                data: savingsData,
                backgroundColor: 'rgba(99, 102, 241, 0.85)',
                borderColor: '#6366F1',
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0A1628',
                    titleColor: '#fff',
                    bodyColor: '#38BDF8',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => `  ประหยัด: ${ctx.raw.toLocaleString('th-TH')} บาท`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { family: "'Kanit', sans-serif", size: 11 },
                        color: '#64748B'
                    }
                },
                y: {
                    grid: {
                        color: '#F1F5F9'
                    },
                    ticks: {
                        font: { family: "'JetBrains Mono', sans-serif", size: 11 },
                        color: '#64748B',
                        callback: val => val.toLocaleString('th-TH')
                    }
                }
            }
        }
    });
}
