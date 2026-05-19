const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allChemicals = [];
let currentFilter = 'All';
let uploadedImagesBase64 = []; // เก็บ base64 ชั่วคราวสำหรับการย่อไฟล์และส่งขึ้น DB

document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
});

// ระบบสลับหน้า Nav ด้านซ้าย (SPA View Switcher)
function switchView(viewName) {
    document.querySelectorAll('.app-view').forEach(view => view.classList.add('d-none'));
    document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(`view-${viewName}`).classList.remove('d-none');
    document.getElementById(`menu-${viewName}`).classList.add('active');
    
    // โหลดประวัติรายการธุรกรรมเมื่อกดเข้าหน้า Transaction
    if(viewName === 'trans') fetchTransactions();
    if(viewName === 'dash') renderDashboard();
    
    // ปิด Offcanvas sidebar บน Mobile อัตโนมัติเมื่อเลือกเมนูแล้ว
    const sidebarEl = document.getElementById('sidebarMenu');
    const instance = bootstrap.Offcanvas.getInstance(sidebarEl);
    if(instance) instance.hide();
}

async function fetchData() {
    const { data, error } = await _supabase.from('chemical_stock').select('*').order('chemical_name');
    if (error) return console.error(error);
    allChemicals = data;
    renderTableAndCards();
}

// ระบบกรองสถานที่จัดเก็บ และการ ซ่อน/แสดง คอลัมน์สถานที่เก็บ
function filterByLocation(locKey) {
    currentFilter = locKey;
    
    // เปลี่ยนสถานะปุ่ม Active
    document.querySelectorAll('#locationFilterBar .btn').forEach(btn => {
        btn.classList.remove('btn-primary', 'active');
        btn.classList.add('btn-outline-primary');
    });
    event.target.classList.remove('btn-outline-primary');
    event.target.classList.add('btn-primary', 'active');
    
    renderTableAndCards();
}

function renderTableAndCards() {
    // ทำการกรองข้อมูลตามคีย์สถานที่คำค้นสั้นๆ
    const filtered = currentFilter === 'All' 
        ? allChemicals 
        : allChemicals.filter(item => item.location && item.location.includes(currentFilter));

    const showLocationColumn = (currentFilter === 'All');
    
    // จัดการหัวตารางของฝั่ง Desktop
    document.getElementById('th-location').style.display = showLocationColumn ? '' : 'none';

    // 1. RENDER DESKTOP TABLE
    const tbody = document.getElementById("chemicalTableBody");
    tbody.innerHTML = filtered.map(item => {
        const expStatus = getExpiryStatus(item.exp_date);
        const imgList = item.image_urls ? JSON.parse(item.image_urls) : [];
        const mainImg = imgList.length > 0 ? imgList[0] : 'https://placehold.co/100x100?text=No+Image';

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <img src="${mainImg}" class="rounded me-3 border" style="width: 48px; height: 48px; object-fit: cover;" onclick="previewImageGroup(${item.id})">
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
                    <span class="badge badge-location px-2 py-2">${item.location}</span>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="openTransactionModal(${item.id})"><i class="bi bi-arrow-left-right"></i> รับ/จ่าย</button>
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="editChemical(${item.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteChemical(${item.id})"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');

    // 2. RENDER MOBILE CARDS (ตัดเรื่องเลื่อนขวาออก ออกแบบแนวตั้งกดง่าย)
    const cardBody = document.getElementById("chemicalCardsBody");
    if(filtered.length === 0) {
        cardBody.innerHTML = `<div class="text-center p-4 text-muted small">ไม่พบรายการสารเคมี</div>`;
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
                        <span class="fs-5 fw-bold text-primary">${item.quantity} <span class="fs-6 text-muted fw-normal">${item.unit}</span></span>
                    </div>
                    
                    <div class="row g-2 my-2 bg-light rounded p-2 small">
                        <div class="col-6"><strong>วันผลิต:</strong> ${item.mfg_date || '-'}</div>
                        <div class="col-6"><strong>วันหมดอายุ:</strong> <span class="${expStatus.class}">${item.exp_date || '-'}</span></div>
                        ${showLocationColumn ? `<div class="col-12"><strong>สถานที่เก็บ:</strong> ${item.location}</div>` : ''}
                    </div>

                    ${imgList.length > 0 ? `<div class="d-flex gap-2 mb-3 overflow-x-auto py-1">${imagesHtml}</div>` : ''}

                    <div class="d-grid gap-2 d-flex justify-content-end border-top pt-2">
                        <button class="btn btn-sm btn-primary flex-grow-1" onclick="openTransactionModal(${item.id})"><i class="bi bi-arrow-left-right me-1"></i>รับ/จ่าย</button>
                        <button class="btn btn-sm btn-outline-warning px-3" onclick="editChemical(${item.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger px-3" onclick="deleteChemical(${item.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 3. ระบบบีบอัดภาพ (Image Compression) ปรับลดขนาดและคุณภาพลง เพื่อเซฟพื้นที่และโหลดไวบนมือถือ
function handleImageSelection(e) {
    const files = Array.from(e.target.files).slice(0, 3); // จำกัดให้เลือกไม่เกิน 3 ภาพ
    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // บีบความกว้างให้เหลือสูงสุด 600px พอสำหรับการดูในมือถือสเปกกำลังดี
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
                
                // แปลงไฟล์เป็น Base64 ที่ลดคุณภาพลงเหลือ 65% (ช่วยลดขนาดจาก 4MB เหลือประมาณ 80-120KB เท่านั้น)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);
                uploadedImagesBase64.push(compressedBase64);

                container.innerHTML += `<img src="${compressedBase64}" class="img-preview-card">`;
            };
        };
    });
}

// 4. บันทึกและแก้ไขข้อมูลสารเคมีคลังหลัก
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
    document.getElementById("location").value = item.location;
    
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
        const res = await _supabase.from('chemical_stock').update(payload).eq('id', id);
        error = res.error;
    } else {
        const res = await _supabase.from('chemical_stock').insert([payload]);
        error = res.error;
    }

    if (error) alert("ล้มเหลว: " + error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('chemicalModal')).hide();
        fetchData();
    }
}

// 5. บันทึกและทำรายการธุรกรรม (รับ-จ่าย)
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

    if (newQty < 0) return alert("สต็อกคงเหลือติดลบไม่ได้! ตรวจสอบจำนวนเบิกจ่ายอีกครั้ง");

    // 1. อัปเดตปริมาณในตารางหลัก
    await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', id);
    
    // 2. บันทึกลงตาราง log ประวัติการเบิกจ่าย
    await _supabase.from('chemical_transactions').insert([{
        chemical_id: id, type: type, quantity: qty, remark: remark
    }]);

    bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
    fetchData();
}

async function deleteChemical(id) {
    if(confirm("ยืนยันที่จะลบข้อมูลสารเคมีรายการนี้ออกจากระบบหรือไม่?")) {
        await _supabase.from('chemical_stock').delete().eq('id', id);
        fetchData();
    }
}

// 6. ส่วนงานการดึงหน้าประวัติและแดชบอร์ดมาแสดง
async function fetchTransactions() {
    const { data, error } = await _supabase.from('chemical_transactions').select(`
        id, type, quantity, remark, transaction_date, chemical_stock(chemical_name, unit)
    `).order('transaction_date', { ascending: false });

    if(error) return;
    const tbody = document.getElementById("transactionTableBody");
    tbody.innerHTML = data.map(t => `
        <tr>
            <td class="ps-4">${new Date(t.transaction_date).toLocaleString('th-TH')}</td>
            <td><strong class="text-dark">${t.chemical_stock?.chemical_name || 'รายการถูกลบแล้ว'}</strong></td>
            <td><span class="badge ${t.type === 'IN' ? 'bg-success' : 'bg-danger'}">${t.type === 'IN' ? 'รับเข้า' : 'เบิกจ่าย'}</span></td>
            <td><strong>${t.quantity}</strong> <small class="text-muted">${t.chemical_stock?.unit || ''}</small></td>
            <td class="pe-4 text-muted">${t.remark || '-'}</td>
        </tr>
    `).join('');
}

function renderDashboard() {
    const totalItems = allChemicals.length;
    const alertExpiry = allChemicals.filter(item => {
        if(!item.exp_date) return false;
        const diff = (new Date(item.exp_date) - new Date()) / (1000*60*60*24);
        return diff <= 30;
    }).length;

    document.getElementById("dashboardCounters").innerHTML = `
        <div class="col-6 col-md-4">
            <div class="card border-0 shadow-sm bg-primary text-white p-3">
                <small class="text-white-50">รายการทั้งหมด</small>
                <h2 class="fw-bold mb-0">${totalItems}</h2>
            </div>
        </div>
        <div class="col-6 col-md-4">
            <div class="card border-0 shadow-sm bg-warning text-dark p-3">
                <small class="text-dark-50">หมดอายุ/ใกล้หมดอายุ (30 วัน)</small>
                <h2 class="fw-bold mb-0">${alertExpiry}</h2>
            </div>
        </div>
    `;
}

function getExpiryStatus(date) {
    if (!date) return { class: '' };
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff <= 0) return { class: 'exp-over' };
    if (diff <= 30) return { class: 'exp-near' };
    return { class: '' };
}
