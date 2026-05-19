// ==========================================
// 1. การตั้งค่า Supabase
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. โหลดข้อมูลเมื่อเปิดหน้าแดชบอร์ด
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
});

async function loadDashboardData() {
    // โหลดข้อมูลสต็อกทั้งหมด
    const { data: stockData, error: stockError } = await _supabase.from('chemical_stock').select('*');
    
    // โหลดประวัติธุรกรรมทั้งหมด
    const { data: transData, error: transError } = await _supabase
        .from('chemical_transactions')
        .select(`
            id, type, quantity, transaction_date, 
            chemical_stock(chemical_name, unit)
        `)
        .order('transaction_date', { ascending: false });

    if (stockError || transError) {
        console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", stockError || transError);
        return;
    }

    // กำหนดวันแรกของเดือนปัจจุบัน
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    renderSummaryCards(stockData, transData, firstDayOfMonth);
    renderLocationChart(stockData);
    renderRecentTransactions(transData.slice(0, 10)); // ส่งไปแค่ 10 รายการล่าสุด
}

// ==========================================
// 3. วาดกล่องสรุปตัวเลข
// ==========================================
function renderSummaryCards(stockData, transData, firstDayOfMonth) {
    document.getElementById('dashTotalItems').innerText = stockData.length;

    const today = new Date();
    const alertCount = stockData.filter(item => {
        if (!item.exp_date) return false;
        const diffDays = (new Date(item.exp_date) - today) / (1000 * 60 * 60 * 24);
        return diffDays <= 30; 
    }).length;
    document.getElementById('dashAlertItems').innerText = alertCount;

    let inMonthCount = 0;
    let outMonthCount = 0;

    transData.forEach(t => {
        const tDate = new Date(t.transaction_date);
        if (tDate >= firstDayOfMonth) {
            if (t.type === 'IN') inMonthCount++;
            if (t.type === 'OUT') outMonthCount++;
        }
    });

    document.getElementById('dashInMonth').innerText = inMonthCount;
    document.getElementById('dashOutMonth').innerText = outMonthCount;
}

// ==========================================
// 4. วาดกราฟโดนัท (Chart.js)
// ==========================================
function renderLocationChart(stockData) {
    const locationCounts = {};
    stockData.forEach(item => {
        const loc = item.location || 'ไม่ได้ระบุสถานที่';
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });

    const ctx = document.getElementById('locationChart').getContext('2d');
    
    if (window.myDoughnutChart) {
        window.myDoughnutChart.destroy();
    }

    window.myDoughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(locationCounts),
            datasets: [{
                data: Object.values(locationCounts),
                backgroundColor: [
                    '#0d6efd', '#ffc107', '#dc3545', '#198754', '#6c757d'
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Prompt', sans-serif" },
                        padding: 20
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// ==========================================
// 5. วาดตารางประวัติ 10 รายการล่าสุด
// ==========================================
function renderRecentTransactions(recentTrans) {
    const tbody = document.getElementById('dashRecentTrans');
    
    // ถ้าไม่มีข้อมูล ให้แสดงแถว <tr> เดียวที่บอกว่าไม่มีข้อมูล
    if (recentTrans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted small">ยังไม่มีประวัติการทำรายการในระบบ</td></tr>`;
        return;
    }

    // สร้างตาราง <tr> และ <td> 
    tbody.innerHTML = recentTrans.map(t => {
        const dateObj = new Date(t.transaction_date);
        const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
        
        const typeBadge = t.type === 'IN' 
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i class="bi bi-arrow-down-short"></i> รับเข้า</span>` 
            : `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i class="bi bi-arrow-up-short"></i> เบิกจ่าย</span>`;
            
        const chemName = t.chemical_stock ? t.chemical_stock.chemical_name : '<span class="text-muted fst-italic">รายการถูกลบ</span>';
        const unit = t.chemical_stock ? t.chemical_stock.unit : '';

        // คืนค่าเป็น HTML Tags กลับไปใส่ใน tbody
        return `
            <tr>
                <td class="ps-4 small text-muted">${formattedDate}</td>
                <td class="fw-bold text-dark">${chemName}</td>
                <td>${typeBadge}</td>
                <td class="pe-4"><span class="fw-bold fs-6">${t.quantity}</span> <small class="text-muted fw-normal">${unit}</small></td>
            </tr>
        `;
    }).join('');
}
