const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
    fetchTransactions();
});

async function fetchTransactions() {
    // ดึงข้อมูลประวัติทั้งหมด เรียงจากใหม่ไปเก่า
    const { data, error } = await _supabase
        .from('chemical_transactions')
        .select(`
            id, type, quantity, remark, transaction_date, 
            chemical_stock(chemical_name, unit)
        `)
        .order('transaction_date', { ascending: false });

    if(error) {
        console.error("Error fetching transactions:", error);
        return;
    }

    const tbody = document.getElementById("transactionTableBody");
    
    if(data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">ยังไม่มีประวัติการทำรายการ</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(t => {
        // จัดรูปแบบวันเวลา
        const dateObj = new Date(t.transaction_date);
        const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
        const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} น.`;
        
        // รูปแบบป้ายสถานะ
        const typeBadge = t.type === 'IN' 
            ? `<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1"><i class="bi bi-arrow-down-short"></i> รับเข้า</span>` 
            : `<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1"><i class="bi bi-arrow-up-short"></i> เบิกจ่าย</span>`;

        // จัดการกรณีรายการสารเคมีถูกลบ
        const chemName = t.chemical_stock ? t.chemical_stock.chemical_name : '<span class="text-muted fst-italic">ลบออกจากคลังแล้ว</span>';
        const unit = t.chemical_stock ? t.chemical_stock.unit : '';

        return `
            <tr>
                <td class="ps-4">
                    <span class="d-block fw-medium text-dark">${dateStr}</span>
                    <small class="text-muted">${timeStr}</small>
                </td>
                <td class="fw-bold text-dark">${chemName}</td>
                <td>${typeBadge}</td>
                <td><span class="fs-6 fw-bold text-primary">${t.quantity}</span> <small class="text-muted">${unit}</small></td>
                <td class="text-muted small">${t.remark || '-'}</td>
            </tr>
        `;
    }).join('');
}
