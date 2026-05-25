// ==========================================
// KlangSarn — Dashboard Logic v2.4
// Fiscal Year Savings & Charts
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let globalStockData = [];
let globalTransData = [];
let savingChartInstance = null;
let chemTransChartInstance = null;
let currentPopupType = null;

document.addEventListener("DOMContentLoaded", () => { loadDashboardData(); });

async function loadDashboardData() {
    const now = new Date();
    const el = document.getElementById('dashUpdateTime');
    if (el) el.textContent =
        `อัปเดต: ${now.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;

    const firstDay = new Date();
    firstDay.setDate(1); firstDay.setHours(0, 0, 0, 0);

    // 1. Load cached data from sessionStorage to render instantly
    const cachedStock = sessionStorage.getItem('klangsarn_dash_stock');
    const cachedTrans = sessionStorage.getItem('klangsarn_dash_trans');
    if (cachedStock && cachedTrans) {
        try {
            globalStockData = JSON.parse(cachedStock);
            globalTransData = JSON.parse(cachedTrans);
            renderSummaryCards(globalStockData, globalTransData, firstDay);
            renderLocationChart(globalStockData);
            renderRecentTransactions(globalTransData.slice(0, 10));
            renderAlertTable(globalStockData);
            initSavingDashboard(globalTransData);
            initChemTransDashboard(globalTransData);
        } catch (e) {
            console.warn("Error parsing dashboard cache", e);
        }
    }

    // 2. Fetch fresh data in background from Supabase
    const [stockRes, transRes] = await Promise.all([
        _supabase.from('chemical_stock').select('id, chemical_name, material_number, quantity, unit, exp_date, location, price_per_unit, vendor, min_quantity, max_quantity'),
        _supabase.from('chemical_transactions')
            .select('id, type, quantity, saving, transaction_date, price_per_unit, free_quantity, vendor, chemical_stock(chemical_name, unit)')
            .order('transaction_date', { ascending: false })
    ]);

    if (stockRes.error || transRes.error) {
        if (!cachedStock) {
            showToast("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ", "danger");
        }
        return;
    }

    globalStockData = stockRes.data || [];
    globalTransData = transRes.data || [];

    // 3. Cache new data and render updates
    sessionStorage.setItem('klangsarn_dash_stock', JSON.stringify(globalStockData));
    sessionStorage.setItem('klangsarn_dash_trans', JSON.stringify(globalTransData));

    renderSummaryCards(globalStockData, globalTransData, firstDay);
    renderLocationChart(globalStockData);
    renderRecentTransactions(globalTransData.slice(0, 10));
    renderAlertTable(globalStockData);
    initSavingDashboard(globalTransData);
    initChemTransDashboard(globalTransData);
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

    // Compute Stock Level Alerts (Min/Max)
    const groups = {};
    stockData.forEach(c => {
        const key = `${c.chemical_name}::${c.material_number || ''}`;
        if (!groups[key]) {
            groups[key] = {
                chemical_name: c.chemical_name,
                material_number: c.material_number,
                total_quantity: 0,
                min_quantity: c.min_quantity || 0,
                max_quantity: c.max_quantity || 0
            };
        } else {
            if (c.min_quantity > 0) groups[key].min_quantity = c.min_quantity;
            if (c.max_quantity > 0) groups[key].max_quantity = c.max_quantity;
        }
        groups[key].total_quantity += c.quantity;
    });

    let belowMin = 0;
    let aboveMax = 0;
    Object.values(groups).forEach(g => {
        const minVal = parseFloat(g.min_quantity);
        const maxVal = parseFloat(g.max_quantity);
        if (minVal > 0 && g.total_quantity < minVal) {
            belowMin++;
        } else if (maxVal > 0 && g.total_quantity > maxVal) {
            aboveMax++;
        }
    });

    setEl('dashStockAlerts', belowMin + aboveMax);
    setEl('dashStockAlertSub', `ต่ำกว่า Min: ${belowMin} | เกิน Max: ${aboveMax}`);

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
        const loc = c.location ? c.location.split(' ').slice(0, 2).join(' ') : 'ไม่ระบุ';
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
                        font: { family: "'IBM Plex Sans Thai', sans-serif", size: 12 },
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
        const ds = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

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

    const card = document.getElementById('alertCard');
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

        const nameText = item.chemical_name;
        return `<tr>
          <td style="padding-left:20px;font-weight:600;color:var(--text-head);">${nameText}</td>
          <td><span class="badge badge-gray" style="font-size:11px;">${item.location ? item.location.split(' ').slice(0, 2).join(' ') : '—'}</span></td>
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
                        font: { family: "'IBM Plex Sans Thai', sans-serif", size: 11 },
                        color: '#64748B'
                    }
                },
                y: {
                    grid: {
                        color: '#F1F5F9'
                    },
                    ticks: {
                        font: { family: "'IBM Plex Mono', sans-serif", size: 11 },
                        color: '#64748B',
                        callback: val => val.toLocaleString('th-TH')
                    }
                }
            }
        }
    });
}

// ===== MONTHLY IN/OUT TRANSACTIONS DASHBOARD =====
function initChemTransDashboard(transData) {
    const select = document.getElementById('chemFilterSelect');
    if (!select) return;

    // Get all unique chemical names from transactions
    const chemNamesSet = new Set();
    transData.forEach(t => {
        if (t.chemical_stock?.chemical_name) {
            chemNamesSet.add(t.chemical_stock.chemical_name);
        }
    });

    const sortedChems = Array.from(chemNamesSet).sort((a, b) => a.localeCompare(b, 'th'));

    // Remember current selection
    const currentVal = select.value;

    // Always prepend the "All chemicals" option
    const allOption = `<option value="__all__">— ทั้งหมด (รวมทุกสารเคมี) —</option>`;
    select.innerHTML = allOption + sortedChems.map(name => `<option value="${name}">${name}</option>`).join('');

    // Restore previous selection, or default to "__all__"
    if (currentVal && (currentVal === '__all__' || sortedChems.includes(currentVal))) {
        select.value = currentVal;
    } else {
        select.value = '__all__';
    }

    renderChemTransChart(select.value);
}

function changeChemFilter() {
    const select = document.getElementById('chemFilterSelect');
    if (!select) return;
    renderChemTransChart(select.value);
}

function renderChemTransChart(chemName) {
    const ctx = document.getElementById('chemTransChart')?.getContext('2d');
    if (!ctx) return;

    const isAll = (chemName === '__all__');

    // Generate rolling 12 months (up to the current month)
    const months = [];
    const d = new Date();
    for (let i = 11; i >= 0; i--) {
        const tempDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
        months.push({
            label: tempDate.toLocaleDateString('th-TH', { month: 'short' }),
            month: tempDate.getMonth(),
            year: tempDate.getFullYear()
        });
    }

    const inData = new Array(12).fill(0.0);
    const outData = new Array(12).fill(0.0);

    // Determine unit label
    let unit = '';
    if (isAll) {
        unit = 'รายการ';
    } else {
        const firstMatch = globalTransData.find(t => t.chemical_stock?.chemical_name === chemName);
        unit = firstMatch?.chemical_stock?.unit || '';
    }

    // Sum transactions matching each month slot
    globalTransData.forEach(t => {
        // Filter: if not "all", skip non-matching chemicals
        if (!isAll && (!t.chemical_stock || t.chemical_stock.chemical_name !== chemName)) return;
        // For "all" mode, still require a valid transaction date
        if (!t.transaction_date) return;

        const tDate = new Date(t.transaction_date);
        const tMonth = tDate.getMonth();
        const tYear = tDate.getFullYear();

        for (let i = 0; i < months.length; i++) {
            if (months[i].month === tMonth && months[i].year === tYear) {
                if (t.type === 'IN') {
                    inData[i] += isAll ? 1 : t.quantity;
                } else if (t.type === 'OUT') {
                    outData[i] += isAll ? 1 : t.quantity;
                }
                break;
            }
        }
    });

    // Update subtitle text under the chart card title
    const subtitleEl = document.getElementById('chemTransSubtitle');
    if (subtitleEl) {
        if (isAll) {
            subtitleEl.textContent = 'ภาพรวมทุกสารเคมี — แกน Y แสดงจำนวนรายการ (IN/OUT) ย้อนหลัง 12 เดือน';
        } else {
            subtitleEl.textContent = 'ประวัติสรุปความเคลื่อนไหวรับเข้า (สีเขียว) และเบิกจ่าย (สีแดง) ย้อนหลัง 12 เดือน';
        }
    }

    if (chemTransChartInstance) {
        chemTransChartInstance.destroy();
    }

    const chartLabels = months.map(m => m.label);

    chemTransChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'รับเข้า (IN)',
                    data: inData,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderColor: '#10B981',
                    borderWidth: 1.5,
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.5
                },
                {
                    label: 'เบิกจ่าย (OUT)',
                    data: outData,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderColor: '#EF4444',
                    borderWidth: 1.5,
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { family: "'IBM Plex Sans Thai', sans-serif", size: 12 },
                        color: '#64748B'
                    }
                },
                tooltip: {
                    backgroundColor: '#0A1628',
                    titleColor: '#fff',
                    bodyColor: '#38BDF8',
                    padding: 12,
                    cornerRadius: 10,
                    callbacks: {
                        label: ctx => `  ${ctx.dataset.label}: ${ctx.raw.toLocaleString('th-TH')} ${unit}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'IBM Plex Sans Thai', sans-serif", size: 11 },
                        color: '#64748B'
                    }
                },
                y: {
                    grid: { color: '#F1F5F9' },
                    ticks: {
                        font: { family: "'IBM Plex Mono', sans-serif", size: 11 },
                        color: '#64748B',
                        callback: val => val.toLocaleString('th-TH')
                    }
                }
            }
        }
    });
}

// ===== STATS POPUP DETAILS MODAL =====
function showStatPopup(type) {
    currentPopupType = type;
    document.getElementById("statPopupSearchInput").value = "";

    const overlay = document.getElementById("statPopupModalOverlay");
    if (!overlay) return;

    const titleEl = document.getElementById("statPopupTitle");
    const subtitleEl = document.getElementById("statPopupSubtitle");

    if (type === 'total') {
        titleEl.textContent = "สารเคมีทั้งหมดในคลัง";
        subtitleEl.textContent = "แสดงรายการคงเหลือแบบแยกรายละเอียดตามประเภทและรหัสสารเคมี";
    } else if (type === 'expiry') {
        titleEl.textContent = "สารเคมีใกล้หมดอายุ / หมดอายุ";
        subtitleEl.textContent = "แสดงล็อตสินค้าที่ใกล้จะหมดอายุหรือหมดอายุแล้วภายใน 30 วัน";
    } else if (type === 'received') {
        titleEl.textContent = "รายการรับเข้าในเดือนนี้";
        const now = new Date();
        const monthYearStr = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        subtitleEl.textContent = `รายการรับเข้าคลัง (IN) ประจำเดือน ${monthYearStr}`;
    } else if (type === 'saving') {
        titleEl.textContent = "ประวัติการประหยัดสะสม (Savings)";
        const currentFiscal = getFiscalYear(new Date());
        subtitleEl.textContent = `แสดงประวัติของแถมและยอดประหยัดสะสมในปีงบประมาณ ${currentFiscal} (ต.ค. - ก.ย.)`;
    } else if (type === 'stock_level') {
        titleEl.textContent = "การแจ้งเตือนระดับสต็อก (Min/Max)";
        subtitleEl.textContent = "แสดงรายการสารเคมีทั้งหมดที่อยู่นอกเกณฑ์มาตรฐานความปลอดภัย (ต่ำกว่าเกณฑ์ Min หรือเกินกว่าเกณฑ์ Max)";
    }

    renderStatPopupTable();
    overlay.classList.add("open");
}

function closeStatPopupModal() {
    const overlay = document.getElementById("statPopupModalOverlay");
    if (overlay) overlay.classList.remove("open");
    currentPopupType = null;
}
window.showStatPopup = showStatPopup;
window.closeStatPopupModal = closeStatPopupModal;

function renderStatPopupTable() {
    const q = document.getElementById("statPopupSearchInput").value.toLowerCase().trim();
    const thead = document.getElementById("statPopupTableHeader");
    const tbody = document.getElementById("statPopupTableBody");

    if (!thead || !tbody || !currentPopupType) return;

    let headersHtml = "";
    let bodyHtml = "";

    if (currentPopupType === 'total') {
        headersHtml = `
            <tr>
              <th style="padding-left:20px;">ชื่อสารเคมี</th>
              <th>Material Number</th>
              <th>จำนวนล็อต</th>
              <th>จำนวนคงเหลือทั้งหมด</th>
              <th style="padding-right:20px;">สถานที่จัดเก็บ</th>
            </tr>
        `;

        const groups = {};
        globalStockData.forEach(c => {
            const key = `${c.chemical_name}::${c.material_number || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    chemical_name: c.chemical_name,
                    material_number: c.material_number,
                    unit: c.unit,
                    total_quantity: 0,
                    lot_count: 0,
                    locations: new Set()
                };
            }
            groups[key].total_quantity += c.quantity;
            groups[key].lot_count += 1;
            if (c.location) {
                groups[key].locations.add(c.location.split(' ').slice(0, 2).join(' '));
            }
        });

        const filteredGroups = Object.values(groups).filter(g => {
            return g.chemical_name.toLowerCase().includes(q) ||
                (g.material_number || "").toLowerCase().includes(q) ||
                Array.from(g.locations).join(", ").toLowerCase().includes(q);
        });

        if (filteredGroups.length === 0) {
            bodyHtml = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">ไม่พบข้อมูลสารเคมี</td></tr>`;
        } else {
            bodyHtml = filteredGroups.map(g => {
                const locs = Array.from(g.locations).map(l => `<span class="badge badge-loc" style="margin-right:4px;">${l}</span>`).join('') || '—';
                return `<tr>
                  <td style="padding-left:20px;font-weight:600;color:var(--text-head);">${g.chemical_name}</td>
                  <td class="mono">${g.material_number || '—'}</td>
                  <td class="mono">${g.lot_count} ล็อต</td>
                  <td>
                    <span class="mono" style="font-weight:700;font-size:14.5px;color:var(--text-head);">${g.total_quantity.toLocaleString('th-TH')}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:2px;">${g.unit}</span>
                  </td>
                  <td style="padding-right:20px;">${locs}</td>
                </tr>`;
            }).join('');
        }
    }
    else if (currentPopupType === 'expiry') {
        headersHtml = `
            <tr>
              <th style="padding-left:20px;">สารเคมี</th>
              <th>Material Number</th>
              <th>วันหมดอายุ (EXP)</th>
              <th>วันคงเหลือ</th>
              <th style="padding-right:20px;">สถานที่จัดเก็บ</th>
            </tr>
        `;

        const today = new Date();
        const expiredItems = globalStockData.filter(c => {
            if (!c.exp_date) return false;
            const diff = (new Date(c.exp_date) - today) / 864e5;
            return diff <= 30;
        });

        const filteredItems = expiredItems.filter(c => {
            const nameMatches = c.chemical_name.toLowerCase().includes(q);
            const matMatches = (c.material_number || "").toLowerCase().includes(q);
            const locMatches = (c.location || "").toLowerCase().includes(q);
            return nameMatches || matMatches || locMatches;
        });

        if (filteredItems.length === 0) {
            bodyHtml = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">ไม่พบรายการใกล้/หมดอายุ</td></tr>`;
        } else {
            bodyHtml = filteredItems.map(c => {
                const diff = Math.ceil((new Date(c.exp_date) - today) / 864e5);
                const statusBadge = diff <= 0
                    ? `<span class="badge badge-red" style="font-weight:600;">หมดอายุแล้ว (${Math.abs(diff)} วัน)</span>`
                    : `<span class="badge badge-amber" style="font-weight:600;">เหลือ ${diff} วัน</span>`;

                return `<tr>
                  <td style="padding-left:20px;">
                    <div style="font-weight:600;color:var(--text-head);">${c.chemical_name}</div>
                    <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">คงเหลือ: ${c.quantity} ${c.unit}</div>
                  </td>
                  <td class="mono">${c.material_number || '—'}</td>
                  <td class="mono">${formatDisplayDate(c.exp_date)}</td>
                  <td>${statusBadge}</td>
                  <td style="padding-right:20px;">
                    <span class="badge badge-gray" style="font-size:11.5px;">${c.location ? c.location.split(' ').slice(0, 2).join(' ') : '—'}</span>
                  </td>
                </tr>`;
            }).join('');
        }
    }
    else if (currentPopupType === 'received') {
        headersHtml = `
            <tr>
              <th style="padding-left:20px;">วัน-เวลา</th>
              <th>สารเคมี</th>
              <th>จำนวนที่รับเข้า</th>
              <th>ราคาต่อหน่วย</th>
              <th>ของแถม (แถมฟรี)</th>
              <th style="padding-right:20px;">ผู้จัดจำหน่าย (Vendor)</th>
            </tr>
        `;

        const firstDay = new Date();
        firstDay.setDate(1); firstDay.setHours(0, 0, 0, 0);

        const receivedTrans = globalTransData.filter(t => {
            return t.type === 'IN' && new Date(t.transaction_date) >= firstDay;
        });

        const filteredTrans = receivedTrans.filter(t => {
            const name = t.chemical_stock?.chemical_name || "";
            const vendor = t.vendor || "";
            return name.toLowerCase().includes(q) || vendor.toLowerCase().includes(q);
        });

        if (filteredTrans.length === 0) {
            bodyHtml = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">ไม่พบประวัติรับเข้าของเดือนนี้</td></tr>`;
        } else {
            bodyHtml = filteredTrans.map(t => {
                const date = new Date(t.transaction_date);
                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;

                return `<tr>
                  <td style="padding-left:20px;font-size:12.5px;color:var(--text-muted);">${dateStr}</td>
                  <td>
                    <div style="font-weight:600;color:var(--text-head);">${t.chemical_stock?.chemical_name || 'ลบแล้ว'}</div>
                  </td>
                  <td>
                    <span class="mono" style="font-weight:700;color:var(--success); font-size:14px;">+${t.quantity}</span>
                    <span style="font-size:11.5px;color:var(--text-muted);margin-left:2px;">${t.chemical_stock?.unit || ''}</span>
                  </td>
                  <td class="mono">${t.price_per_unit ? t.price_per_unit.toFixed(2) + ' ฿' : '—'}</td>
                  <td class="mono">${t.free_quantity ? t.free_quantity + ' ' + (t.chemical_stock?.unit || '') : '—'}</td>
                  <td style="padding-right:20px;">${t.vendor || '—'}</td>
                </tr>`;
            }).join('');
        }
    }
    else if (currentPopupType === 'saving') {
        headersHtml = `
            <tr>
              <th style="padding-left:20px;">วัน-เวลา</th>
              <th>สารเคมี</th>
              <th>จำนวนซื้อจริง</th>
              <th>จำนวนแถมฟรี</th>
              <th>ราคาต่อหน่วย</th>
              <th style="padding-right:20px;">ยอดประหยัด (Savings)</th>
            </tr>
        `;

        const currentFiscal = getFiscalYear(new Date());
        const savingTrans = globalTransData.filter(t => {
            return t.saving && t.saving > 0 && getFiscalYear(t.transaction_date) === currentFiscal;
        });

        const filteredTrans = savingTrans.filter(t => {
            const name = t.chemical_stock?.chemical_name || "";
            const vendor = t.vendor || "";
            return name.toLowerCase().includes(q) || vendor.toLowerCase().includes(q);
        });

        if (filteredTrans.length === 0) {
            bodyHtml = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">ไม่พบประวัติยอดประหยัดในปีงบประมาณนี้</td></tr>`;
        } else {
            bodyHtml = filteredTrans.map(t => {
                const date = new Date(t.transaction_date);
                const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} น.`;

                const freeQty = t.free_quantity || 0;
                const paidQty = Math.max(0, t.quantity - freeQty);
                return `<tr>
                  <td style="padding-left:20px;font-size:12.5px;color:var(--text-muted);">${dateStr}</td>
                  <td>
                    <div style="font-weight:600;color:var(--text-head);">${t.chemical_stock?.chemical_name || 'ลบแล้ว'}</div>
                    ${t.vendor ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">ผู้จัดจำหน่าย: ${t.vendor}</div>` : ''}
                  </td>
                  <td class="mono">${paidQty} ${t.chemical_stock?.unit || ''}</td>
                  <td class="mono" style="font-weight:600;color:var(--success);">${freeQty} ${t.chemical_stock?.unit || ''}</td>
                  <td class="mono">${t.price_per_unit ? t.price_per_unit.toFixed(2) + ' ฿' : '—'}</td>
                  <td style="padding-right:20px;font-weight:700;color:var(--success);" class="mono">
                    ${t.saving ? t.saving.toLocaleString('th-TH') + ' ฿' : '—'}
                  </td>
                </tr>`;
            }).join('');
        }
    }
    else if (currentPopupType === 'stock_level') {
        headersHtml = `
            <tr>
              <th style="padding-left:20px;">ชื่อสารเคมี</th>
              <th>Material Number</th>
              <th>จำนวนคงเหลือ</th>
              <th>เกณฑ์ Min / Max</th>
              <th>สถานะแจ้งเตือน</th>
              <th style="padding-right:20px;">สถานที่จัดเก็บ</th>
            </tr>
        `;

        const groups = {};
        globalStockData.forEach(c => {
            const key = `${c.chemical_name}::${c.material_number || ''}`;
            if (!groups[key]) {
                groups[key] = {
                    chemical_name: c.chemical_name,
                    material_number: c.material_number,
                    unit: c.unit,
                    total_quantity: 0,
                    min_quantity: c.min_quantity || 0,
                    max_quantity: c.max_quantity || 0,
                    locations: new Set()
                };
            } else {
                if (c.min_quantity > 0) groups[key].min_quantity = c.min_quantity;
                if (c.max_quantity > 0) groups[key].max_quantity = c.max_quantity;
            }
            groups[key].total_quantity += c.quantity;
            if (c.location) {
                groups[key].locations.add(c.location.split(' ').slice(0, 2).join(' '));
            }
        });

        const alertGroups = Object.values(groups).filter(g => {
            const minVal = parseFloat(g.min_quantity);
            const maxVal = parseFloat(g.max_quantity);
            const isBelowMin = (minVal > 0 && g.total_quantity < minVal);
            const isAboveMax = (maxVal > 0 && g.total_quantity > maxVal);
            return isBelowMin || isAboveMax;
        });

        const filteredGroups = alertGroups.filter(g => {
            const nameMatches = g.chemical_name.toLowerCase().includes(q);
            const matMatches = (g.material_number || "").toLowerCase().includes(q);
            const locMatches = Array.from(g.locations).join(", ").toLowerCase().includes(q);
            return nameMatches || matMatches || locMatches;
        });

        if (filteredGroups.length === 0) {
            bodyHtml = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">ไม่พบรายการสารเคมีที่อยู่นอกเกณฑ์ Min/Max</td></tr>`;
        } else {
            bodyHtml = filteredGroups.map(g => {
                const minVal = parseFloat(g.min_quantity);
                const maxVal = parseFloat(g.max_quantity);

                let badge = "";
                if (minVal > 0 && g.total_quantity < minVal) {
                    badge = `<span class="badge badge-red">⚠️ ต่ำกว่า Min</span>`;
                } else if (maxVal > 0 && g.total_quantity > maxVal) {
                    badge = `<span class="badge badge-amber">⚠️ เกิน Max</span>`;
                }

                const locs = Array.from(g.locations).map(l => `<span class="badge badge-loc" style="margin-right:4px;">${l}</span>`).join('') || '—';

                return `<tr>
                  <td style="padding-left:20px;font-weight:600;color:var(--text-head);">${g.chemical_name}</td>
                  <td class="mono">${g.material_number || '—'}</td>
                  <td>
                    <span class="mono" style="font-weight:700;font-size:14.5px;color:var(--text-head);">${g.total_quantity.toLocaleString('th-TH')}</span>
                    <span style="font-size:12px;color:var(--text-muted);margin-left:2px;">${g.unit}</span>
                  </td>
                  <td class="mono" style="font-size:12.5px;color:var(--text-body);">
                    Min: ${g.min_quantity || '0'} | Max: ${g.max_quantity || '0'}
                  </td>
                  <td>${badge}</td>
                  <td style="padding-right:20px;">${locs}</td>
                </tr>`;
            }).join('');
        }
    }

    thead.innerHTML = headersHtml;
    tbody.innerHTML = bodyHtml;
}

function filterStatPopup() {
    renderStatPopupTable();
}
window.filterStatPopup = filterStatPopup;
