// กำหนดค่า Supabase Credentials
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// โหลดข้อมูลเมื่อเปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
    fetchChemicals();
    
    // ผูก Event ให้ Form
    document.getElementById("chemicalForm").addEventListener("submit", handleFormSubmit);
});

// ฟังก์ชันดึงข้อมูลสารเคมีทั้งหมด
async function fetchChemicals() {
    const { data, error } = await _supabase
        .from('chemical_stock')
        .select('*')
        .order('chemical_name', { ascending: true });

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    const tbody = document.getElementById("chemicalTableBody");
    tbody.innerHTML = "";

    data.forEach(item => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${item.chemical_name}</strong></td>
                <td>${item.cas_number || '-'}</td>
                <td>${item.quantity} ${item.unit}</td>
                <td>${item.mfg_date || '-'}</td>
                <td>${item.exp_date || '-'}</td>
                <td><span class="badge bg-secondary">${item.location || '-'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-warning" onclick="editChemical('${item.id}')">แก้ไข</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteChemical('${item.id}')">ลบ</button>
                    <button class="btn btn-sm btn-info text-white" onclick="openTransactionModal('${item.id}')">รับ/จ่าย</button>
                </td>
            </tr>
        `;
    });
}

// ฟังก์ชันเปิด Modal สำหรับเพิ่มใหม่
function openAddModal() {
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีใหม่";
    document.getElementById("chemicalForm").reset();
    document.getElementById("chemicalId").value = "";
}

// ฟังก์ชัน บันทึก/แก้ไขข้อมูล (CRUD - Create/Update)
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    const payload = {
        chemical_name: document.getElementById("chemicalName").value,
        cas_number: document.getElementById("casNumber").value,
        quantity: parseFloat(document.getElementById("quantity").value),
        unit: document.getElementById("unit").value,
        mfg_date: document.getElementById("mfgDate").value || null,
        exp_date: document.getElementById("expDate").value || null,
        location: document.getElementById("location").value
    };

    let result;
    if (id) {
        // ทำการ Update
        result = await _supabase.from('chemical_stock').update(payload).eq('id', id);
    } else {
        // ทำการ Insert
        result = await _supabase.from('chemical_stock').insert([payload]);
    }

    if (result.error) {
        alert("เกิดข้อผิดพลาด: " + result.error.message);
    } else {
        // ปิด Modal และรีโหลดตาราง
        const modal = bootstrap.Modal.getInstance(document.getElementById('chemicalModal'));
        modal.hide();
        fetchChemicals();
    }
}

// ลบข้อมูล (Delete)
async function deleteChemical(id) {
    if(confirm("คุณแน่ใจหรือไม่ที่จะลบรายการนี้?")) {
        const { error } = await _supabase.from('chemical_stock').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchChemicals();
    }
}

// หมายเหตุ: โค้ดสำหรับการดึงข้อมูลเดี่ยวมาแก้ (Edit) และการทำ Transaction รับ/จ่าย 
// สามารถเขียนฟังก์ชันเพิ่มโดยใช้แนวทางเดียวกับด้านบน เช่น _supabase.from('chemical_transactions').insert()