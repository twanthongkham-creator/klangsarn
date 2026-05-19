// ==========================================
// 1. Supabase Config
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allChemicals = [];
let currentFilter = 'All';
let uploadedImagesBase64 = [];

// ==========================================
// 2. Init
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    fetchData();
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("transactionForm").addEventListener("submit", handleTransactionSubmit);
});

async function fetchData() {
    const { data, error } = await _supabase
        .from('chemical_stock')
        .select('*')
        .order('chemical_name');

    if (error) {
        console.error("Error:", error);
        showToast("ไม่สามารถโหลดข้อมูลได้", "danger");
        return;
    }

    allChemicals = data;
    renderAll();
}

// ==========================================
// 3. Filter & Render
// ==========================================
function filterByLocation(locKey, btnEl) {
    currentFilter = locKey;
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderAll();
}

function renderAll() {
    const filtered = currentFilter === 'All'
        ? allChemicals
        : allChemicals.filter(item => item.location && item.location.includes(currentFilter));

    const showLocation = (currentFilter === 'All');
    const thLoc = document.getElementById('th-location');
    if (thLoc) thLoc.style.display = showLocation ? '' : 'none';

    renderDesktopTable(filtered, showLocation);
    renderMobileCards(filtered, showLocation);
}

function renderDesktopTable(filtered, showLocation) {
    const tbody = document.getElementById("chemicalTableBody");
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr><td colspan="5">
            <div class="empty-state">
              <div class="empty-icon">🔬</div>
              <div class="empty-title">ไม่พบรายการสารเคมี</div>
              <div class="empty-desc">ลองเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่</div>
            </div>
          </td></tr>`;
        return;
    }

    const adminLoggedIn = typeof isAdminLoggedIn === 'function' && isAdminLoggedIn();

    tbody.innerHTML = filtered.map(item => {
        const expStatus = getExpiryStatus(item.exp_date);
        const imgList = item.image_urls ? JSON.parse(item.image_urls) : [];
        const mainImg = imgList.length > 0 ? imgList[0] : null;

        return `
        <tr>
          <td style="padding-left:20px;">
            <div style="display:flex;align-items:center;gap:12px;">
              ${mainImg
                ? `<img src="${mainImg}" class="table-img">`
                : `<div style="width:44px;height:44px;border-radius:6px;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🧪</div>`
              }
              <div>
                <div class="cell-name">${item.chemical_name}</div>
                <div style="font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
                  ${item.cas_number ? 'CAS: ' + item.cas_number : '—'}
                </div>
              </div>
            </div>
          </td>
          <td>
            <span class="cell-num">${item.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${item.unit}</span>
          </td>
          <td>
            <div style="font-size:12px;color:var(--text-muted);">
              <span style="color:var(--success);">MFG</span> ${item.mfg_date || '-'}
            </div>
            <div style="font-size:12px;" class="${expStatus.class}">
              <span>EXP</span> ${item.exp_date || '-'}
              ${expStatus.label ? `<span class="badge ${expStatus.badgeClass}" style="margin-left:4px;font-size:10px;">${expStatus.label}</span>` : ''}
            </div>
          </td>
          <td style="display:${showLocation ? '' : 'none'}">
            <span class="badge badge-location">${item.location || '—'}</span>
          </td>
          <td style="text-align:right;padding-right:20px;">
            <button class="btn btn-outline-primary btn-sm" onclick="openTransactionModal(${item.id})">
              <i class="bi bi-arrow-left-right"></i> รับ/จ่าย
            </button>
            ${adminLoggedIn ? `
            <button class="btn btn-outline btn-sm btn-icon" onclick="editChemical(${item.id})" title="แก้ไข" style="margin-left:4px;">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteChemical(${item.id})" title="ลบ" style="margin-left:4px;">
              <i class="bi bi-trash"></i>
            </button>` : ''}
          </td>
        </tr>`;
    }).join('');
}

function renderMobileCards(filtered, showLocation) {
    const container = document.getElementById("chemicalCardsBody");
    if (!container) return;

    const adminLoggedIn = typeof isAdminLoggedIn === 'function' && isAdminLoggedIn();

    if (filtered.length === 0) {
        container.innerHTML = `
          <div style="padding:40px 20px;text-align:center;background:var(--bg-card);border-radius:var(--r-lg);border:1px solid var(--border);">
            <div style="font-size:40px;margin-bottom:8px;">🔬</div>
            <div style="font-weight:600;color:var(--text-secondary);">ไม่พบรายการในหมวดนี้</div>
          </div>`;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const expStatus = getExpiryStatus(item.exp_date);
        const imgList = item.image_urls ? JSON.parse(item.image_urls) : [];
        const mainImg = imgList.length > 0 ? imgList[0] : null;
        const imgHtml = imgList.slice(0, 3).map(url => `<img src="${url}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--border);">`).join('');

        return `
        <div class="chem-card">
          <div class="chem-card-header">
            ${mainImg
              ? `<img src="${mainImg}" class="chem-card-img">`
              : `<div class="chem-card-img" style="background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:22px;">🧪</div>`
            }
            <div class="chem-card-meta">
              <div class="chem-card-name">${item.chemical_name}</div>
              <div class="chem-card-cas">${item.cas_number ? 'CAS: ' + item.cas_number : ''}</div>
              ${showLocation ? `<span class="badge badge-location" style="margin-top:4px;">${item.location || '—'}</span>` : ''}
            </div>
            <div class="chem-card-qty">
              <div class="chem-card-num">${item.quantity}</div>
              <div class="chem-card-unit">${item.unit}</div>
            </div>
          </div>

          <div style="padding:0 16px 12px;display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">
            <div style="font-size:12px;">
              <span style="color:var(--text-muted);">MFG: </span>
              <span style="color:var(--success);font-weight:500;">${item.mfg_date || '—'}</span>
            </div>
            <div style="font-size:12px;">
              <span style="color:var(--text-muted);">EXP: </span>
              <span class="${expStatus.class}" style="font-weight:500;">${item.exp_date || '—'}</span>
            </div>
          </div>

          ${imgList.length > 1 ? `<div style="padding:0 16px 12px;display:flex;gap:8px;overflow-x:auto;">${imgHtml}</div>` : ''}

          <div class="chem-card-footer">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openTransactionModal(${item.id})">
              <i class="bi bi-arrow-left-right"></i> รับ/จ่าย
            </button>
            ${adminLoggedIn ? `
            <button class="btn btn-outline btn-sm btn-icon" onclick="editChemical(${item.id})">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-icon" onclick="deleteChemical(${item.id})">
              <i class="bi bi-trash"></i>
            </button>` : ''}
          </div>
        </div>`;
    }).join('');
}

// ==========================================
// 4. Image Handling
// ==========================================
function handleImageSelection(e) {
    const files = Array.from(e.target.files).slice(0, 3);
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
                const MAX_WIDTH = 600;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL('image/jpeg', 0.70);
                uploadedImagesBase64.push(base64);
                container.innerHTML += `<img src="${base64}" class="img-thumb">`;
            };
        };
    });
}

// ==========================================
// 5. Add / Edit Chemical
// ==========================================
function openAddModal() {
    document.getElementById("chemicalId").value = "";
    document.getElementById("chemicalForm").reset();
    document.getElementById("imagePreviewContainer").innerHTML = "";
    uploadedImagesBase64 = [];
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีเข้าสต็อก";
    document.getElementById('chemModalOverlay').classList.add('open');
}

function editChemical(id) {
    const item = allChemicals.find(i => i.id == id);
    if (!item) return;

    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("casNumber").value = item.cas_number || "";
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date || "";
    document.getElementById("expDate").value = item.exp_date || "";
    document.getElementById("location").value = item.location || "";

    const container = document.getElementById("imagePreviewContainer");
    container.innerHTML = "";
    uploadedImagesBase64 = item.image_urls ? JSON.parse(item.image_urls) : [];
    uploadedImagesBase64.forEach(url => {
        container.innerHTML += `<img src="${url}" class="img-thumb">`;
    });

    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลเคมีภัณฑ์";
    document.getElementById('chemModalOverlay').classList.add('open');
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

    if (error) {
        showToast("เกิดข้อผิดพลาด: " + error.message, "danger");
    } else {
        document.getElementById('chemModalOverlay').classList.remove('open');
        showToast(id ? "อัปเดตข้อมูลสำเร็จ ✓" : "เพิ่มสารเคมีสำเร็จ ✓", "success");
        fetchData();
    }
}

async function deleteChemical(id) {
    if (!confirm("ยืนยันลบรายการนี้? ประวัติธุรกรรมจะถูกลบตามด้วย")) return;
    await _supabase.from('chemical_stock').delete().eq('id', id);
    showToast("ลบรายการสำเร็จ", "success");
    fetchData();
}

// ==========================================
// 6. Transactions
// ==========================================
function openTransactionModal(id) {
    const item = allChemicals.find(i => i.id == id);
    if (!item) return;

    document.getElementById("transChemId").value = item.id;
    document.getElementById("transChemName").innerText = `📦 ${item.chemical_name}`;
    document.getElementById("transUnitLabel").innerText = item.unit;
    document.getElementById("transQty").value = "";
    document.getElementById("transRemark").value = "";
    document.getElementById("transType").value = "IN";
    if (typeof selectTransType === 'function') selectTransType('IN');

    document.getElementById('transModalOverlay').classList.add('open');
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("transChemId").value;
    const type = document.getElementById("transType").value;
    const qty = parseFloat(document.getElementById("transQty").value);
    const remark = document.getElementById("transRemark").value;

    const item = allChemicals.find(i => i.id == id);
    const newQty = (type === 'IN') ? item.quantity + qty : item.quantity - qty;

    if (newQty < 0) {
        showToast("สต็อกคงเหลือไม่เพียงพอ!", "danger");
        return;
    }

    await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', id);
    await _supabase.from('chemical_transactions').insert([{
        chemical_id: id, type, quantity: qty, remark
    }]);

    document.getElementById('transModalOverlay').classList.remove('open');
    showToast(type === 'IN' ? `รับเข้า ${qty} ${item.unit} สำเร็จ` : `เบิกจ่าย ${qty} ${item.unit} สำเร็จ`, "success");
    fetchData();
}

// ==========================================
// 7. Helper
// ==========================================
function getExpiryStatus(date) {
    if (!date) return { class: '', label: '', badgeClass: '' };
    const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff <= 0) return { class: 'exp-over', label: 'หมดอายุ', badgeClass: 'badge-red' };
    if (diff <= 30) return { class: 'exp-near', label: `${Math.ceil(diff)}วัน`, badgeClass: 'badge-yellow' };
    return { class: '', label: '', badgeClass: '' };
}
