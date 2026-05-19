const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
});

async function loadDashboardData() {
    const now = new Date();
    document.getElementById('dashUpdateTime').textContent =
        `อัปเดตล่าสุด: ${now.toLocaleDateString('th-TH', { day:'2-digit', month:'long', year:'numeric' })} ${now.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.`;

    const { data: stockData, error: stockError } = await _supabase.from('chemical_stock').select('*');
    const { data: transData, error: transError } = await _supabase
        .from('chemical_transactions')
        .select(`id, type, quantity, transaction_date, chemical_stock(chemical_name, unit)`)
        .order('transaction_date', { ascending: false });

    if (stockError || transError) {
        showToast("ไม่สามารถโหลดข้อมูลแดชบอร์ดได้", "danger");
        return;
    }

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    renderSummaryCards(stockData, transData, firstDayOfMonth);
    renderLocationChart(stockData);
    renderRecentTransactions(transData.slice(0, 10));
    renderAlertTable(stockData);
}

function renderSummaryCards(stockData, transData, firstDay) {
    document.getElementById('dashTotalItems').innerText = stockData.length;

    const today = new Date();
    const alertItems = stockData.filter(item => {
        if (!item.exp_date) return false;
        const diff = (new Date(item.exp_date) - today) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    });
    document.getElementById('dashAlertItems').innerText = alertItems.length;

    let inCount = 0, outCount = 0;
    transData.forEach(t => {
        if (new Date(t.transaction_date) >= firstDay) {
            if (t.type === 'IN') inCount++;
            if (t.type === 'OUT') outCount++;
        }
    });
    document.getElementById('dashInMonth').innerText = inCount;
    document.getElementById('dashOutMonth').innerText = outCount;
}

function renderLocationChart(stockData) {
    const counts = {};
    stockData.forEach(item => {
        const loc = item.location || 'ไม่ระบุ';
        counts[loc] = (counts[loc] || 0) + 1;
    });

    const ctx = document.getElementById('locationChart')?.getContext('2d');
    if (!ctx) return;

    if (window.myChart) window.myChart.destroy();

    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#0EA5E9', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'],
                borderWidth: 3,
                borderColor: '#fff',
                hoverOffset: 6
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
                        padding: 16,
                        color: '#475569',
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${ctx.raw} รายการ`
                    }
                }
            },
            cutout: '68%'
        }
    });
}

function renderRecentTransactions(recentTrans) {
    const tbody = document.getElementById('dashRecentTrans');
    if (!tbody) return;

    if (recentTrans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`;
        return;
    }

    tbody.innerHTML = recentTrans.map(t => {
        const d = new Date(t.transaction_date);
        const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        const badge = t.type === 'IN'
            ? `<span class="badge badge-green"><i class="bi bi-arrow-down-short"></i>รับเข้า</span>`
            : `<span class="badge badge-red"><i class="bi bi-arrow-up-short"></i>เบิกจ่าย</span>`;
        const name = t.chemical_stock ? t.chemical_stock.chemical_name : '<em style="color:var(--text-muted)">ลบแล้ว</em>';
        const unit = t.chemical_stock?.unit || '';

        return `<tr>
          <td style="padding-left:20px;font-size:13px;color:var(--text-muted);">${dateStr}</td>
          <td style="font-weight:500;color:var(--text-primary);">${name}</td>
          <td>${badge}</td>
          <td style="padding-right:20px;">
            <span class="mono" style="font-weight:600;">${t.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${unit}</span>
          </td>
        </tr>`;
    }).join('');
}

function renderAlertTable(stockData) {
    const today = new Date();
    const alertItems = stockData.filter(item => {
        if (!item.exp_date) return false;
        const diff = (new Date(item.exp_date) - today) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    }).sort((a, b) => new Date(a.exp_date) - new Date(b.exp_date));

    const card = document.getElementById('alertCard');
    const tbody = document.getElementById('dashAlertTable');
    if (!card || !tbody) return;

    if (alertItems.length === 0) { card.style.display = 'none'; return; }
    card.style.display = '';

    tbody.innerHTML = alertItems.map(item => {
        const diff = Math.ceil((new Date(item.exp_date) - today) / (1000 * 60 * 60 * 24));
        const statusBadge = diff <= 0
            ? `<span class="badge badge-red">⚠️ หมดอายุแล้ว</span>`
            : `<span class="badge badge-yellow">⏳ เหลือ ${diff} วัน</span>`;

        return `<tr>
          <td style="padding-left:20px;font-weight:500;color:var(--text-primary);">${item.chemical_name}</td>
          <td><span class="badge badge-gray" style="font-size:11px;">${item.location || '—'}</span></td>
          <td style="font-family:'JetBrains Mono',monospace;font-size:13px;">${item.exp_date}</td>
          <td style="padding-right:20px;">${statusBadge}</td>
        </tr>`;
    }).join('');
}
