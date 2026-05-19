// ==========================================
// 1. การตั้งค่า Supabase
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ตัวแปรส่วนกลาง
let allChemicals = [];
let currentFilter = 'All';
let uploadedImagesBase64 = []; // เก็บไฟล์ภาพที่ถูกย่อขนาดเป็น Base64

// ==========================================
// 2. โหลดข้อมูลเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    
    // ผูก Event ให้กับฟอร์มต่างๆ
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
});

// ฟังก์ชันดึงข้อมูลจากตาราง chemical_stock
async function fetchData() {
    const { data, error } = await _supabase
        .from('chemical_stock')
        .select('*')
        .order('chemical_name');
        
    if (error) {
        console.error("Error fetching data:", error);
        return;
    }
    
    allChemicals = data;
    renderTableAndCards();
}

// ==========================================
// 3. ระบบ Filter และแสดงผลข้อมูล (Render UI)
// ==========================================

// เมื่อกดปุ่ม Filter สถานที่เก็บ
function filterByLocation(locKey, btnElement) {
    currentFilter = locKey;
    
    // รีเซ็ตปุ่มทั้งหมดให้เป็นเส้นขอบ (outline)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('btn-primary', 'active');
        btn.classList.add('btn-outline-primary');
    });
    // เปลี่ยนปุ่มที่กดให้เป็นสีทึบ (active)
    btnElement.classList.remove('btn-outline-primary');
    btnElement.classList.add('btn-primary', 'active');
    
    renderTableAndCards();
}

// ฟังก์ชันหลักในการวาด UI (แยก Desktop และ Mobile)
function renderTableAndCards() {
    // 1. กรองข้อมูลตามที่เลือก
    const filtered = currentFilter === 'All' 
        ? allChemicals 
        : allChemicals.filter(item => item.location && item.location.includes(currentFilter));

    // 2. ถ้าเลือกฟิลเตอร์เฉพาะห้อง จะซ่อนคอลัมน์สถานที่เก็บทิ้งเพื่อประหยัดพื้นที่
    const showLocationColumn = (currentFilter === 'All');
    document.getElementById('th-location').style.display = showLocationColumn ? '' : 'none';

    // ------------------------------------
    // ส่วนที่ 1: วาดตารางสำหรับ Desktop
    // ------------------------------------
    const tbody = document.getElementById("chemicalTableBody");
    tbody.innerHTML = filtered.map(item => {
        const expStatus = getExpiryStatus(item.exp_date);
        const imgList = item.image_urls ? JSON.parse(item.image_urls) : [];
        const mainImg = imgList.length > 0 ? imgList[0] : 'https://placehold.co/100x100?text=No+Image';

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <img src="${mainImg}" class="rounded me-3 border table-img-thumbnail">
                        <div>
                            <div class="fw-bold text-dark">${item.chemical_name}</div>
                            <small class="text-muted">CAS: ${item.cas_number || '-'}</small>
                        </div>
                    </div>
                </td>
                <td><span class="fs-5 fw-bold">${item.quantity}</span> <small class="text-muted">${item.unit}</small></td>
                <td>
                    <div class="small text-muted">M: ${item.mfg_date || '-'}</div>
                    <div class="small ${expStatus.class}">E: ${item.exp_date || '-'}</div>
                </td>
                <td style="display: ${showLocationColumn ? '' : 'none'}">
                    <span class="badge badge-location px-2 py-2">${item.location || '-'}</span>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openTransactionModal(${item.id})"><i class="bi bi-arrow-left-right"></i> รับ/จ่าย</button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="editChemical(${item.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteChemical(${item.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // ------------------------------------
    // ส่วนที่ 2: วาดการ์ดสำหรับ Mobile (ไม่ต้องเลื่อนซ้ายขวา)
    // ------------------------------------
    const cardBody = document.getElementById("chemicalCardsBody");
    if(filtered.length === 0) {
        cardBody.innerHTML = `<div class="text-center p-5 text-muted small bg-white rounded shadow-sm">ไม่พบรายการสารเคมีในหมวดหมู่นี้</div>`;
        return;
    }
    
    cardBody.innerHTML = filtered.map(item => {
        const expStatus = getExpiryStatus(item.exp_date);
        const imgList = item.image_urls ? JSON.parse(item.image_urls) : [];
        const imagesHtml = imgList.map(url => `<img src="${url}" class="rounded border" style="width:60px; height:60px; object-fit:cover;">`).join('');

        return `
            <div class="card border-0 shadow-sm">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h6 class="fw-bold text-dark mb-0">${item.chemical_name}</h6>
                            <small class="text-muted d-block">CAS: ${item.cas_number || '-'}</small>
                        </div>
                        <div class="text-end">
                            <span class="fs-5 fw-bold text-primary">${item.quantity}</span> 
                            <span class="fs-6 text-muted fw-normal">${item.unit}</span>
                        </div>
                    </div>
                    
                    <div class="row g-2 my-2 bg-light rounded p-2 small">
                        <div class="col-6"><strong>วันผลิต:</strong> ${item.mfg_date || '-'}</div>
                        <div class="col-6"><strong>วันหมดอายุ:</strong> <span class="${expStatus.class}">${item.exp_date || '-'}</span></div>
                        ${showLocationColumn ? `<div class="col-12 border-top pt-2 mt-2"><strong>สถานที่เก็บ:</strong> ${item.location || '-'}</div>` : ''}
                    </div>

                    ${imgList.length > 0 ? `<div class="d-flex gap-2 mb-3 overflow-x-auto py-1">${imagesHtml}</div>` : ''}

                    <div class="d-grid gap-2 d-flex justify-content-end border-top pt-2 mt-3">
                        <button class="btn btn-sm btn-primary flex-grow-1" onclick="openTransactionModal(${item.id})"><i class="bi bi-arrow-left-right me-1"></i>รับ/จ่าย</button>
                        <button class="btn btn-sm btn-outline-warning px-3" onclick="editChemical(${item.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger px-3" onclick="deleteChemical(${item.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 4. ระบบจัดการภาพถ่าย (ย่อขนาดอัตโนมัติ)
// ==========================================
function handleImageSelection(e) {
    const files = Array.from(e.target.files).slice(0, 3); // อนุญาตสูงสุดแค่ 3 รูป
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = []; // ล้างภาพเก่าทิ้ง

    files.forEach(file => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // บีบภาพให้กว้างสุด 600px
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // แปลงไฟล์เป็น Base64 ที่ลดคุณภาพลงเหลือ 70% 
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.70);
                uploadedImagesBase64.push(compressedBase64);

                container.innerHTML += `<img src="${compressedBase64}" class="img-preview-card">`;
            };
        };
    });
}

// ==========================================
// 5. จัดการเพิ่ม/แก้ไข ข้อมูลสารเคมี
// ==========================================
function openAddModal() {
    document.getElementById("chemicalId").value = "";
    document.getElementById("chemicalForm").reset();
    document.getElementById("imagePreviewContainer").innerHTML = "";
    uploadedImagesBase64 = [];
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีเข้าสต็อก";
    new bootstrap.Modal(document.getElementById('chemicalModal')).show();
}

function editChemical(id) {
    const item = allChemicals.find(i => i.id == id);
    if(!item) return;

    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("casNumber").value = item.cas_number || "";
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date || "";
    document.getElementById("expDate").value = item.exp_date || "";
    document.getElementById("location").value = item.location || "";
    
    // โหลดรูปภาพเดิมมาแสดง
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = item.image_urls ? JSON.parse(item.image_urls) : [];
    uploadedImagesBase64.forEach(url => {
        container.innerHTML += `<img src="${url}" class="img-preview-card">`;
    });

    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลเคมีภัณฑ์";
    new bootstrap.Modal(document.getElementById('chemicalModal')).show();
}

async function handleChemicalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    
    // ข้อมูลที่จะอัปเดตลงฐานข้อมูล
    const payload = {
        chemical_name: document.getElementById("chemicalName").value,
        cas_number: document.getElementById("casNumber").value,
        quantity: parseFloat(document.getElementById("quantity").value),
        unit: document.getElementById("unit").value,
        mfg_date: document.getElementById("mfgDate").value || null,
        exp_date: document.getElementById("expDate").value || null,
        location: document.getElementById("location").value,
        image_urls: uploadedImagesBase64.length > 0 ? JSON.stringify(uploadedImagesBase64) : null
    };

    let error;
    if (id) {
        // แก้ไข
        const res = await _supabase.from('chemical_stock').update(payload).eq('id', id);
        error = res.error;
    } else {
        // เพิ่มใหม่
        const res = await _supabase.from('chemical_stock').insert([payload]);
        error = res.error;
    }

    if (error) {
        alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
    } else {
        bootstrap.Modal.getInstance(document.getElementById('chemicalModal')).hide();
        fetchData(); // โหลดตารางใหม่
    }
}

async function deleteChemical(id) {
    if(confirm("ยืนยันที่จะลบข้อมูลสารเคมีรายการนี้ออกจากระบบหรือไม่? (ประวัติธุรกรรมจะถูกลบตามไปด้วย)")) {
        await _supabase.from('chemical_stock').delete().eq('id', id);
        fetchData();
    }
}

// ==========================================
// 6. ระบบเบิก-จ่าย (Transactions)
// ==========================================
function openTransactionModal(id) {
    const item = allChemicals.find(i => i.id == id);
    if(!item) return;
    
    document.getElementById("transChemId").value = item.id;
    document.getElementById("transChemName").innerText = item.chemical_name;
    document.getElementById("transUnitLabel").innerText = item.unit;
    document.getElementById("transQty").value = "";
    document.getElementById("transRemark").value = "";
    
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("transChemId").value;
    const type = document.getElementById("transType").value;
    const qty = parseFloat(document.getElementById("transQty").value);
    const remark = document.getElementById("transRemark").value;

    const item = allChemicals.find(i => i.id == id);
    let newQty = (type === 'IN') ? item.quantity + qty : item.quantity - qty;

    // ป้องกันการเบิกของจนยอดติดลบ
    if (newQty < 0) return alert("สต็อกคงเหลือไม่เพียงพอสำหรับการเบิกจ่าย!");

    // 1. อัปเดตปริมาณสินค้าในตาราง chemical_stock
    await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', id);
    
    // 2. บันทึกประวัติลงตาราง chemical_transactions
    await _supabase.from('chemical_transactions').insert([{
        chemical_id: id, 
        type: type, 
        quantity: qty, 
        remark: remark
    }]);

    bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
    fetchData(); // โหลดข้อมูลสต็อกที่หักลบแล้วมาแสดงใหม่
}

// ==========================================
// 7. ฟังก์ชันตัวช่วย (Helper)
// ==========================================
// เช็กวันหมดอายุเพื่อเปลี่ยนสีตัวอักษร
function getExpiryStatus(date) {
    if (!date) return { class: '' };
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff <= 0) return { class: 'exp-over' }; // หมดอายุแล้ว (สีแดง)
    if (diff <= 30) return { class: 'exp-near' }; // ใกล้หมดอายุ 30 วัน (สีส้ม)
    return { class: '' }; // ปกติ
}
