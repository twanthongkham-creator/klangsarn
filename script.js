// Supabase Configuration
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2"; 
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allChemicals = [];
let currentFilter = 'All';
let selectedFiles = []; // เก็บไฟล์ภาพที่จะอัปโหลด

document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    
    // Bind forms
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
});

async function fetchData() {
    const { data, error } = await _supabase.from('chemical_stock').select('*').order('chemical_name');
    if (error) return console.error(error);
    
    allChemicals = data;
    renderLocationFilters();
    renderTable();
}

// 1. ระบบ Filter สถานที่
function renderLocationFilters() {
    const locations = ['All', ...new Set(allChemicals.map(item => item.location).filter(Boolean))];
    const container = document.getElementById("locationFilterBar");
    container.innerHTML = locations.map(loc => `
        <button class="btn btn-sm px-3 ${currentFilter === loc ? 'btn-primary active' : 'btn-outline-primary'}" 
                onclick="filterByLocation('${loc}')">${loc === 'All' ? 'ทั้งหมด' : loc}</button>
    `).join('');
}

function filterByLocation(loc) {
    currentFilter = loc;
    renderLocationFilters();
    renderTable();
}

// 2. ระบบ Render Table พร้อมรูปภาพ
function renderTable() {
    const tbody = document.getElementById("chemicalTableBody");
    const filtered = currentFilter === 'All' ? allChemicals : allChemicals.filter(i => i.location === currentFilter);
    
    tbody.innerHTML = filtered.map(item => {
        // เช็ควันหมดอายุ
        const expStatus = getExpiryStatus(item.exp_date);
        const images = item.image_urls ? JSON.parse(item.image_urls) : [];
        const mainImg = images.length > 0 ? images[0] : 'https://placehold.co/100x100?text=No+Img';

        return `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center">
                        <img src="${mainImg}" class="rounded me-3 shadow-sm" style="width: 50px; height: 50px; object-fit: cover;">
                        <div>
                            <div class="fw-bold text-dark">${item.chemical_name}</div>
                            <small class="text-muted">CAS: ${item.cas_number || '-'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="fs-5 fw-bold">${item.quantity}</span> <small class="text-muted">${item.unit}</small>
                </td>
                <td>
                    <div class="small">M: ${item.mfg_date || '-'}</div>
                    <div class="small ${expStatus.class}">E: ${item.exp_date || '-'}</div>
                </td>
                <td><span class="badge badge-location px-2 py-2">${item.location}</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-light btn-sm border me-1" onclick="openTransactionModal('${item.id}')" title="รับ-จ่าย">
                        <i class="bi bi-arrow-left-right text-primary"></i>
                    </button>
                    <button class="btn btn-light btn-sm border me-1" onclick="editChemical('${item.id}')" title="แก้ไข">
                        <i class="bi bi-pencil-square text-warning"></i>
                    </button>
                    <button class="btn btn-light btn-sm border" onclick="deleteChemical('${item.id}')" title="ลบ">
                        <i class="bi bi-trash text-danger"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// 3. ระบบ Image Compression (ย่อขนาดภาพ)
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // ปรับขนาดความกว้างสูงสุด
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
                
                // ส่งค่าออกเป็น Blob ความละเอียด 0.7
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
        };
    });
}

// 4. ระบบจัดการข้อมูล (Add/Edit)
async function handleChemicalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    
    // อัปโหลดรูปภาพก่อน (ถ้ามีเลือกใหม่)
    let imageUrls = [];
    if (selectedFiles.length > 0) {
        for (let file of selectedFiles) {
            const compressed = await compressImage(file);
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const { data, error } = await _supabase.storage.from('chemical-images').upload(fileName, compressed);
            if (data) {
                const { data: publicUrl } = _supabase.storage.from('chemical-images').getPublicUrl(fileName);
                imageUrls.push(publicUrl.publicUrl);
            }
        }
    }

    const payload = {
        chemical_name: document.getElementById("chemicalName").value,
        cas_number: document.getElementById("casNumber").value,
        quantity: parseFloat(document.getElementById("quantity").value),
        unit: document.getElementById("unit").value,
        mfg_date: document.getElementById("mfgDate").value || null,
        exp_date: document.getElementById("expDate").value || null,
        location: document.getElementById("location").value,
        image_urls: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
    };

    if (id) {
        await _supabase.from('chemical_stock').update(payload).eq('id', id);
    } else {
        await _supabase.from('chemical_stock').insert([payload]);
    }

    bootstrap.Modal.getInstance(document.getElementById('chemicalModal')).hide();
    fetchData();
}

// 5. ระบบ รับ-จ่าย (Transactions)
function openTransactionModal(id) {
    const item = allChemicals.find(i => i.id == id);
    document.getElementById("transChemId").value = item.id;
    document.getElementById("transChemName").innerText = item.chemical_name;
    document.getElementById("transUnitLabel").innerText = item.unit;
    document.getElementById("transQty").value = "";
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("transChemId").value;
    const type = document.getElementById("transType").value;
    const qty = parseFloat(document.getElementById("transQty").value);
    const remark = document.getElementById("transRemark").value;

    const item = allChemicals.find(i => i.id == id);
    let newQty = type === 'IN' ? item.quantity + qty : item.quantity - qty;

    if (newQty < 0) return alert("ยอดคงเหลือไม่เพียงพอสำหรับการเบิกจ่าย!");

    // 1. Update Stock
    await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', id);
    // 2. Insert Transaction
    await _supabase.from('chemical_transactions').insert([{
        chemical_id: id, type, quantity: qty, remark: remark
    }]);

    bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
    fetchData();
}

// Helper: Edit Button
function editChemical(id) {
    const item = allChemicals.find(i => i.id == id);
    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("casNumber").value = item.cas_number;
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date;
    document.getElementById("expDate").value = item.exp_date;
    document.getElementById("location").value = item.location;
    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลสารเคมี";
    new bootstrap.Modal(document.getElementById('chemicalModal')).show();
}

function getExpiryStatus(date) {
    if (!date) return { class: '' };
    const exp = new Date(date);
    const today = new Date();
    const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { class: 'exp-over' };
    if (diffDays <= 30) return { class: 'exp-near' };
    return { class: '' };
}
