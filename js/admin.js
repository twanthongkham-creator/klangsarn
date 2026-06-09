// ==========================================
// KlangSarn — Admin Panel Logic v2.3
// Direct CRUD on Supabase Tables with Pricing
// ==========================================
const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PWD_KEY = 'klangsarn_admin_pwd';
const ADMIN_SESSION_KEY = 'klangsarn_admin';
const DEFAULT_PASSWORD = 'chem@admin';

let adminChems = [];
let adminTrans = [];
let uploadedImagesBase64 = [];

function getAdminPassword() { return localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_PASSWORD; }

// ===== EYE TOGGLE =====
function togglePwd() {
    const input = document.getElementById('adminPassword');
    const show = document.getElementById('eyeIconShow');
    const hide = document.getElementById('eyeIconHide');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    show.style.display = isHidden ? 'none' : '';
    hide.style.display = isHidden ? '' : 'none';
}

// ===== LOGIN =====
function attemptLogin() {
    const pwd = document.getElementById('adminPassword').value;
    const err = document.getElementById('loginError');
    if (pwd === getAdminPassword()) {
        localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        err.classList.remove('show');
        showAdminPanel();
    } else {
        err.classList.add('show');
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
        // Shake animation on the input
        const box = document.querySelector('.login-box');
        box.style.animation = 'none';
        box.offsetWidth; // reflow
        box.style.animation = 'shake 0.4s ease';
    }
}

function adminLogout() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.reload();
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = '';
    initSidebar();
    loadAdminData();
    initDragAndDrop();
}

// Add shake keyframe dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }`;
document.head.appendChild(shakeStyle);

// ===== LOAD DATA =====
async function loadAdminData() {
    // 1. Load cached data from sessionStorage to render instantly
    const cachedStock = sessionStorage.getItem('klangsarn_admin_chems');
    const cachedTrans = sessionStorage.getItem('klangsarn_admin_trans');
    if (cachedStock && cachedTrans) {
        try {
            adminChems = JSON.parse(cachedStock);
            adminTrans = JSON.parse(cachedTrans);
            renderAdminChems();
            renderAdminTrans();
            populateChemicalSelect();
        } catch (e) {
            console.warn("Error parsing admin cache", e);
        }
    }

    // 2. Fetch fresh data in background from Supabase
    const [c, t] = await Promise.all([
        _supabase.from('chemical_stock').select('*').order('chemical_name'),
        _supabase.from('chemical_transactions')
            .select('id, chemical_id, type, quantity, remark, price_per_unit, free_quantity, saving, transaction_date, vendor, chemical_stock(chemical_name, unit)')
            .order('transaction_date', { ascending: false })
    ]);

    if (c.error || t.error) {
        if (!adminChems.length) {
            showToast("โหลดข้อมูลแผงควบคุมไม่สำเร็จ", "danger");
        }
        return;
    }

    adminChems = c.data || [];
    adminTrans = t.data || [];

    // 3. Cache new data and render updates
    sessionStorage.setItem('klangsarn_admin_chems', JSON.stringify(adminChems));
    sessionStorage.setItem('klangsarn_admin_trans', JSON.stringify(adminTrans));

    renderAdminChems();
    renderAdminTrans();
    populateChemicalSelect();
}

// ===== CHEMICALS TABLE =====
function renderAdminChems() {
    const q = (document.getElementById('adminSearch')?.value || '').toLowerCase();
    const filtered = adminChems.filter(c =>
        c.chemical_name.toLowerCase().includes(q) ||
        (c.material_number || '').toLowerCase().includes(q) ||
        (c.vendor || '').toLowerCase().includes(q)
    );

    const tbody = document.getElementById('adminChemsTable');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">
        <div class="empty-state" style="padding:40px 20px;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" style="margin:0 auto 10px;display:block;">
            <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
          </svg>
          <div class="empty-title">ไม่พบรายการสารเคมี</div>
        </div>
      </td></tr>`;
        return;
    }

    const today = new Date();
    tbody.innerHTML = filtered.map(item => {
        const diff = item.exp_date ? (new Date(item.exp_date) - today) / 864e5 : Infinity;
        const expBadge = diff <= 0
            ? `<span class="badge badge-red" style="margin-top:3px;">หมดอายุ</span>`
            : diff <= 30
                ? `<span class="badge badge-amber" style="margin-top:3px;">เหลือ ${Math.ceil(diff)} วัน</span>`
                : `<span class="badge badge-green" style="margin-top:3px;">ปกติ</span>`;

        let lotThumb = `<div style="width:36px;height:36px;border-radius:6px;background:var(--bg-hover);border:1px solid var(--border-soft);display:flex;align-items:center;justify-content:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>`;
        const imgs = item.image_urls ? JSON.parse(item.image_urls) : [];
        if (imgs.length > 0) {
            lotThumb = `<img src="${imgs[0]}" class="table-thumb" onclick="viewImage('${imgs[0]}'); event.stopPropagation();">`;
        }

        const vendorInfo = item.vendor ? `<div style="font-size:11px;color:var(--text-muted);font-weight:normal;margin-top:2px;">Vendor: ${item.vendor}</div>` : '';

        let minWarning = '';
        if (item.min_quantity > 0 && item.quantity < item.min_quantity) {
            minWarning = ` <span class="badge badge-red" style="font-size:10px;padding:1px 4px;margin-top:2px;display:inline-block;">⚠️ ต่ำกว่า Min</span>`;
        } else if (item.max_quantity > 0 && item.quantity > item.max_quantity) {
            minWarning = ` <span class="badge badge-amber" style="font-size:10px;padding:1px 4px;margin-top:2px;display:inline-block;">⚠️ เกิน Max</span>`;
        }

        return `<tr>
        <td style="padding-left:22px;" class="mono">${item.id}</td>
        <td>
          <div style="font-weight:600;color:var(--text-head);">${item.chemical_name}</div>
          ${vendorInfo}
        </td>
        <td class="mono">${item.material_number || '—'}</td>
        <td>
          <span class="mono" style="font-size:15px;font-weight:700;color:var(--text-head);">${parseFloat(item.quantity).toLocaleString('th-TH')}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${item.unit}</span>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
            Min: ${item.min_quantity ? parseFloat(item.min_quantity).toLocaleString('th-TH') : '—'} | Max: ${item.max_quantity ? parseFloat(item.max_quantity).toLocaleString('th-TH') : '—'}
          </div>
          ${minWarning}
        </td>
        <td>
          <div style="font-size:12px;color:var(--text-muted);"><span style="color:var(--success);font-weight:500;">MFG</span> ${formatDisplayDate(item.mfg_date)}</div>
          <div style="font-size:12px;color:var(--text-muted);"><span style="color:var(--danger);font-weight:500;">EXP</span> ${formatDisplayDate(item.exp_date)} ${expBadge}</div>
        </td>
        <td>
          <span class="badge badge-loc" style="font-size:11px;">${item.location ? item.location.split(' ').slice(0, 2).join(' ') : '—'}</span>
        </td>
        <td class="mono">${item.price_per_unit ? item.price_per_unit.toFixed(2) : '0.00'}</td>
        <td>
          ${lotThumb}
        </td>
        <td style="padding-right:22px;text-align:right;">
          <div style="display:inline-flex;gap:6px;align-items:center;">
            <button class="btn btn-add-lot btn-xs" onclick="openAddTransModal(${item.id}, true)" title="เปิดล็อตใหม่" style="font-size:11px; height:28px; padding:0 8px; border-radius:var(--r-sm);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              เปิดล็อตใหม่
            </button>
            <button class="btn btn-outline btn-sm btn-icon" onclick="openEditChemModal(${item.id})" title="แก้ไข">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-icon" onclick="adminDeleteChem(${item.id})" title="ลบ">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
}

// ===== TRANSACTIONS TABLE =====
function renderAdminTrans() {
    const tbody = document.getElementById('adminTransTable');
    const countEl = document.getElementById('transCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `รายการทั้งหมด ${adminTrans.length} รายการ`;

    if (adminTrans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`;
        return;
    }

    tbody.innerHTML = adminTrans.map(t => {
        const d = new Date(t.transaction_date);
        const ds = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        const badge = t.type === 'IN'
            ? `<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
            : `<span class="badge badge-red"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;

        const name = t.chemical_stock?.chemical_name
            ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>`
            : `<span style="color:var(--text-muted);font-style:italic;">ลบแล้ว</span>`;

        return `<tr>
        <td style="padding-left:22px;" class="mono">${t.id}</td>
        <td>
          ${name}
          <div class="cell-cas">Chemical ID: ${t.chemical_id}${t.vendor ? ` | Vendor: ${t.vendor}` : ''}</div>
        </td>
        <td>${badge}</td>
        <td>
          <span class="mono" style="font-size:15px;font-weight:700;color:var(--text-head);">${parseFloat(t.quantity).toLocaleString('th-TH')}</span>
          <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${t.chemical_stock?.unit || ''}</span>
        </td>
        <td class="mono">${t.price_per_unit ? t.price_per_unit.toFixed(2) : '—'}</td>
        <td class="mono" style="${t.saving > 0 ? 'color:var(--success);font-weight:600;' : ''}">
          ${t.saving ? t.saving.toLocaleString('th-TH') : '—'}
        </td>
        <td style="font-size:13px;color:var(--text-muted);">${ds}</td>
        <td style="font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
        <td style="padding-right:22px;text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button class="btn btn-outline btn-sm btn-icon" onclick="openEditTransModal(${t.id})" title="แก้ไข">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-icon" onclick="adminDeleteTrans(${t.id})" title="ลบ">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');
}

// ===== POPULATE CHEMICAL DROP-DOWN =====
function populateChemicalSelect() {
    const select = document.getElementById('adminTransChemId');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="" disabled selected>— เลือกสารเคมี —</option>` +
        adminChems.map(c => `<option value="${c.id}">${c.chemical_name} (ID: ${c.id})</option>`).join('');
    if (currentVal) select.value = currentVal;
}

// ===== CHEMICAL MODAL CRUD =====
function openAddChemModal() {
    document.getElementById("chemicalId").value = "";
    document.getElementById("chemicalForm").reset();
    document.getElementById("location").disabled = false;
    uploadedImagesBase64 = [];
    renderUploadedPreviews();
    document.getElementById("modalTitle").innerText = "เพิ่มสารเคมีเข้าสต็อก";
    document.getElementById('chemModalOverlay').classList.add('open');
}

function openEditChemModal(id) {
    const item = adminChems.find(c => c.id == id);
    if (!item) return;
    document.getElementById("chemicalId").value = item.id;
    document.getElementById("chemicalName").value = item.chemical_name;
    document.getElementById("materialNumber").value = item.material_number || "";
    document.getElementById("quantity").value = item.quantity;
    document.getElementById("unit").value = item.unit;
    document.getElementById("mfgDate").value = item.mfg_date || "";
    document.getElementById("expDate").value = item.exp_date || "";
    if (item.location) {
        if (item.location.includes("ห้อง 1")) {
            document.getElementById("location").value = "ห้อง 1 สารเคมีประเภทออกซิไดซ์ (Oxidizing Agent)";
        } else if (item.location.includes("ห้อง 2")) {
            document.getElementById("location").value = "ห้อง 2 สารเคมีประเภทกรด (Acid)";
        } else if (item.location.includes("ห้อง 3")) {
            document.getElementById("location").value = "ห้อง 3 สารเคมีประเภทด่าง (Alkali)";
        } else {
            document.getElementById("location").value = item.location;
        }
    } else {
        document.getElementById("location").value = "";
    }
    document.getElementById("location").disabled = false;
    document.getElementById("pricePerUnit").value = item.price_per_unit || 0.0;
    document.getElementById("chemicalVendor").value = item.vendor || "";
    document.getElementById("minQuantity").value = item.min_quantity !== undefined && item.min_quantity !== null ? item.min_quantity : "";
    document.getElementById("maxQuantity").value = item.max_quantity !== undefined && item.max_quantity !== null ? item.max_quantity : "";
    document.getElementById("packingSize").value = item.packing_size !== undefined && item.packing_size !== null ? item.packing_size : "";

    // Load existing images
    uploadedImagesBase64 = item.image_urls ? JSON.parse(item.image_urls) : [];
    renderUploadedPreviews();

    document.getElementById("modalTitle").innerText = "แก้ไขข้อมูลเคมีภัณฑ์";
    document.getElementById('chemModalOverlay').classList.add('open');
}

function closeChemModal() {
    document.getElementById('chemModalOverlay').classList.remove('open');
}

async function handleChemicalSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("chemicalId").value;
    const payload = {
        chemical_name: document.getElementById("chemicalName").value,
        material_number: document.getElementById("materialNumber").value,
        quantity: parseFloat(document.getElementById("quantity").value),
        unit: document.getElementById("unit").value,
        mfg_date: document.getElementById("mfgDate").value || null,
        exp_date: document.getElementById("expDate").value || null,
        location: document.getElementById("location").value,
        price_per_unit: parseFloat(document.getElementById("pricePerUnit").value) || 0.0,
        vendor: document.getElementById("chemicalVendor").value.trim() || null,
        min_quantity: parseFloat(document.getElementById("minQuantity").value) || 0.0,
        max_quantity: parseFloat(document.getElementById("maxQuantity").value) || 0.0,
        packing_size: parseFloat(document.getElementById("packingSize").value) || null,
        image_urls: uploadedImagesBase64.length > 0 ? JSON.stringify(uploadedImagesBase64) : null
    };

    let error;
    if (id) {
        const r = await _supabase.from('chemical_stock').update(payload).eq('id', id);
        error = r.error;
    } else {
        const r = await _supabase.from('chemical_stock').insert([payload]);
        error = r.error;
    }

    if (error) {
        showToast("บันทึกไม่สำเร็จ: " + error.message, "danger");
    } else {
        closeChemModal();
        showToast(id ? "อัปเดตข้อมูลสำเร็จ" : "เพิ่มสารเคมีสำเร็จ", "success");
        clearStorageCache();
        loadAdminData();
    }
}
function adminDeleteChem(id) {
    const item = adminChems.find(c => c.id == id);
    if (!item) return;
    pendingDeleteId = id;
    pendingDeleteType = 'chemical';
    document.getElementById('deleteItemName').textContent = `คุณกำลังจะลบสารเคมี "${item.chemical_name}"`;
    document.getElementById('deleteItemDesc').textContent = 'การลบจะทำให้ข้อมูลสารเคมีคงค้างและประวัติธุรกรรมที่เกี่ยวข้องทั้งหมดถูกลบออกจากฐานข้อมูลอย่างถาวรและไม่สามารถกู้คืนได้';
    document.getElementById('confirmDeleteModalOverlay').classList.add('open');
}

// ===== IMAGE UPLOAD & COMPRESSION =====
function initDragAndDrop() {
    const zone = document.getElementById("imageUploadZone");
    if (!zone) return;

    ['dragenter', 'dragover'].forEach(name => {
        zone.addEventListener(name, e => {
            e.preventDefault();
            zone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
        zone.addEventListener(name, e => {
            e.preventDefault();
            zone.classList.remove('dragover');
        }, false);
    });

    zone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processImageFiles(files);
        }
    }, false);
}

function handleImageSelection(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        processImageFiles(files);
    }
}

function processImageFiles(files) {
    const currentCount = uploadedImagesBase64.length;
    const limit = 3 - currentCount;
    if (limit <= 0) {
        showToast("เลือกภาพได้สูงสุด 3 รูปเท่านั้น", "warning");
        document.getElementById('imageInput').value = '';
        return;
    }

    const filesToProcess = Array.from(files).slice(0, limit);

    let processedCount = 0;
    filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = ev => {
            const img = new Image();
            img.src = ev.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 600;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                const b64 = canvas.toDataURL('image/jpeg', 0.72);
                uploadedImagesBase64.push(b64);

                processedCount++;
                if (processedCount === filesToProcess.length) {
                    renderUploadedPreviews();
                }
            };
        };
    });

    document.getElementById('imageInput').value = '';
}

function renderUploadedPreviews() {
    const container = document.getElementById("imagePreviewContainer");
    if (!container) return;
    container.innerHTML = "";

    uploadedImagesBase64.forEach((b64, index) => {
        container.innerHTML += `
          <div class="img-thumb-wrap" style="margin-right: 8px; margin-bottom: 8px;">
            <img src="${b64}" class="img-thumb" onclick="viewImage('${b64}')" alt="ภาพพรีวิวที่ ${index + 1}">
            <div class="img-thumb-remove" onclick="removeUploadedImage(${index}, event)">×</div>
          </div>`;
    });
}

function removeUploadedImage(index, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    uploadedImagesBase64.splice(index, 1);
    renderUploadedPreviews();
}

function viewImage(src) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;`;
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:88vh;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.5);">`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
}

// ===== TRANSACTION MODAL CRUD =====
function openAddTransModal(chemId = null, isNewLot = false) {
    document.getElementById("adminTransId").value = "";
    document.getElementById("adminTransForm").reset();
    document.getElementById("adminTransDate").value = getLocalISOString(new Date());
    document.getElementById("transModalTitle").innerText = "เพิ่มประวัติธุรกรรม";
    document.getElementById("adminTransPricePerUnit").value = 0.0;
    document.getElementById("adminTransFreeQty").value = 0.0;
    document.getElementById("adminTransPromoToggle").checked = false;
    document.getElementById("adminTransFreeQtyContainer").style.display = "none";
    document.getElementById("adminTransSummaryText").style.display = "none";
    document.getElementById("adminTransSummaryText").innerHTML = "";
    const submitBtn = document.querySelector("#adminTransModalOverlay .btn-primary");
    if (submitBtn) submitBtn.disabled = false;
    document.getElementById("adminTransVendor").value = "";

    // Set chemical selection if passed
    if (chemId) {
        document.getElementById("adminTransChemId").value = chemId;
        const chem = adminChems.find(c => c.id == chemId);
        if (chem) {
            document.getElementById("adminTransPricePerUnit").value = chem.price_per_unit || 0.0;
            document.getElementById("adminTransVendor").value = chem.vendor || "";
        }
    }

    // Handle New Lot toggles and inputs
    const newLotToggle = document.getElementById("adminTransNewLotToggle");
    const newLotContainer = document.getElementById("adminTransNewLotContainer");
    if (newLotToggle && newLotContainer) {
        newLotToggle.checked = isNewLot;
        newLotContainer.style.display = isNewLot ? "block" : "none";
        document.getElementById("adminTransLocation").required = isNewLot;
        document.getElementById("adminTransLocation").value = chemId ? (adminChems.find(c => c.id == chemId)?.location || "") : "";
        document.getElementById("adminTransMfgDate").value = "";
        document.getElementById("adminTransExpDate").value = "";
    }

    selectTransType('IN');
    document.getElementById('adminTransModalOverlay').classList.add('open');
}

async function openEditTransModal(id) {
    const t = adminTrans.find(item => item.id == id);
    if (!t) return;
    document.getElementById("adminTransId").value = t.id;
    document.getElementById("adminTransChemId").value = t.chemical_id;
    document.getElementById("adminTransQty").value = t.quantity;
    document.getElementById("adminTransRemark").value = t.remark || "";
    document.getElementById("adminTransPricePerUnit").value = t.price_per_unit || 0.0;
    document.getElementById("adminTransFreeQty").value = t.free_quantity || 0.0;

    const isPromo = t.free_quantity > 0;
    document.getElementById("adminTransPromoToggle").checked = isPromo;
    document.getElementById("adminTransFreeQtyContainer").style.display = isPromo ? "block" : "none";

    document.getElementById("adminTransVendor").value = t.vendor || "";

    // Handle New Lot toggles and inputs (Hide and disable during edits)
    const newLotToggleGroup = document.getElementById("adminTransNewLotToggleGroup");
    const newLotContainer = document.getElementById("adminTransNewLotContainer");
    const newLotToggle = document.getElementById("adminTransNewLotToggle");
    if (newLotToggleGroup && newLotContainer && newLotToggle) {
        newLotToggle.checked = false;
        newLotToggleGroup.style.display = "none";
        newLotContainer.style.display = "none";
        document.getElementById("adminTransLocation").required = false;
    }

    // Set type
    selectTransType(t.type);

    // Set date
    if (t.transaction_date) {
        const d = new Date(t.transaction_date);
        document.getElementById("adminTransDate").value = getLocalISOString(d);
    } else {
        document.getElementById("adminTransDate").value = "";
    }

    document.getElementById("transModalTitle").innerText = "แก้ไขข้อมูลธุรกรรม";
    document.getElementById('adminTransModalOverlay').classList.add('open');
    updateAdminTransSummary();
}

function closeTransModal() {
    document.getElementById('adminTransModalOverlay').classList.remove('open');
}

function getLocalISOString(date) {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzoffset)).toISOString().slice(0, -1);
    return localISOTime.substring(0, 16);
}

function selectTransType(type) {
    document.getElementById('adminTransType').value = type;
    const btnIN = document.getElementById('transBtnIN');
    const btnOUT = document.getElementById('transBtnOUT');
    const lblIN = btnIN.querySelector('.trans-btn-label');
    const lblOUT = btnOUT.querySelector('.trans-btn-label');
    const promoFields = document.getElementById('adminTransPromoFields');

    const newLotToggleGroup = document.getElementById("adminTransNewLotToggleGroup");
    const newLotContainer = document.getElementById("adminTransNewLotContainer");
    const newLotToggle = document.getElementById("adminTransNewLotToggle");

    // Only show new lot toggle if we are adding a new transaction (transId is empty)
    const isEdit = document.getElementById("adminTransId").value !== "";

    if (type === 'IN') {
        btnIN.className = 'trans-btn sel-in';
        btnOUT.className = 'trans-btn';
        lblIN.style.color = 'var(--success)';
        lblOUT.style.color = 'var(--text-muted)';
        if (promoFields) promoFields.style.display = 'block';
        if (newLotToggleGroup && !isEdit) newLotToggleGroup.style.display = 'block';
        if (newLotToggle && newLotToggle.checked && newLotContainer && !isEdit) newLotContainer.style.display = 'block';
        updateAdminTransSummary();
    } else {
        btnOUT.className = 'trans-btn sel-out';
        btnIN.className = 'trans-btn';
        lblOUT.style.color = 'var(--danger)';
        lblIN.style.color = 'var(--text-muted)';
        if (promoFields) promoFields.style.display = 'none';
        if (newLotToggleGroup) newLotToggleGroup.style.display = 'none';
        if (newLotContainer) newLotContainer.style.display = 'none';
        if (newLotToggle) {
            newLotToggle.checked = false;
            document.getElementById("adminTransLocation").required = false;
        }
        const summaryDiv = document.getElementById("adminTransSummaryText");
        if (summaryDiv) summaryDiv.style.display = "none";
    }
}

async function handleTransSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("adminTransId").value;
    const chemId = document.getElementById("adminTransChemId").value;
    const type = document.getElementById("adminTransType").value;
    const qty = parseFloat(document.getElementById("adminTransQty").value);
    const remark = document.getElementById("adminTransRemark").value;
    const dateInput = document.getElementById("adminTransDate").value;
    const dateVal = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

    const transPrice = parseFloat(document.getElementById("adminTransPricePerUnit").value) || 0.0;
    const isPromo = document.getElementById("adminTransPromoToggle").checked;
    const transFree = (type === 'IN' && isPromo) ? (parseFloat(document.getElementById("adminTransFreeQty").value) || 0.0) : 0.0;
    const transSaving = (type === 'IN') ? (transPrice * transFree) : 0.0;
    const transVendor = (type === 'IN') ? document.getElementById("adminTransVendor").value.trim() : null;

    if (!chemId) { showToast("กรุณาเลือกสารเคมี", "warning"); return; }
    if (isNaN(qty) || qty <= 0) { showToast("กรุณากรอกจำนวนที่ถูกต้อง", "warning"); return; }

    // Fetch corresponding chemical to verify and calculate stock adjustment
    const { data: chem, error: fetchError } = await _supabase
        .from('chemical_stock')
        .select('*')
        .eq('id', chemId)
        .single();

    if (fetchError || !chem) {
        showToast("ไม่พบสารเคมีที่เกี่ยวข้องในคลัง", "danger");
        return;
    }

    const isNewLot = (type === 'IN') && document.getElementById("adminTransNewLotToggle").checked;

    let targetChemId = chemId;

    if (isNewLot) {
        // Create new lot row in chemical_stock first
        const lotLoc = document.getElementById("adminTransLocation").value;
        const mfgVal = document.getElementById("adminTransMfgDate").value || null;
        const expVal = document.getElementById("adminTransExpDate").value || null;

        if (!lotLoc) {
            showToast("กรุณากรอกสถานที่จัดเก็บสำหรับล็อตใหม่!", "warning");
            return;
        }

        const newLotPayload = {
            chemical_name: chem.chemical_name,
            material_number: chem.material_number,
            quantity: qty, // initial quantity of new lot
            unit: chem.unit,
            mfg_date: mfgVal,
            exp_date: expVal,
            location: lotLoc,
            price_per_unit: transPrice,
            vendor: transVendor,
            packing_size: chem.packing_size || null,
            image_urls: null
        };

        const { data: insertData, error: insertError } = await _supabase
            .from('chemical_stock')
            .insert([newLotPayload])
            .select('id')
            .single();

        if (insertError) {
            showToast("สร้างล็อตใหม่ไม่สำเร็จ: " + insertError.message, "danger");
            return;
        }

        targetChemId = insertData.id;
    } else {
        // Normal transaction (revert old transaction and apply new, or add new)
        let originalQty = chem.quantity;
        let newQty = originalQty;

        if (id) {
            // Edit transaction
            const oldTrans = adminTrans.find(item => item.id == id);
            if (!oldTrans) { showToast("ไม่พบรายการธุรกรรมเดิม", "danger"); return; }

            // Revert old transaction effect
            let tempQty = (oldTrans.type === 'IN') ? originalQty - oldTrans.quantity : originalQty + oldTrans.quantity;
            // Apply new transaction effect
            newQty = (type === 'IN') ? tempQty + qty : tempQty - qty;
        } else {
            // Add transaction
            newQty = (type === 'IN') ? originalQty + qty : originalQty - qty;
        }

        if (newQty < 0) {
            showToast("ไม่สามารถทำรายการได้เนื่องจากจะทำให้ยอดคงเหลือติดลบ!", "danger");
            return;
        }

        // Update stock
        const { error: stockError } = await _supabase
            .from('chemical_stock')
            .update({ quantity: newQty })
            .eq('id', chemId);

        if (stockError) {
            showToast("อัปเดตสต็อกสารเคมีไม่สำเร็จ: " + stockError.message, "danger");
            return;
        }
    }

    // 2. Insert or update transaction row
    const payload = {
        chemical_id: targetChemId,
        type: type,
        quantity: qty,
        remark: remark,
        price_per_unit: transPrice,
        free_quantity: transFree,
        saving: transSaving,
        transaction_date: dateVal,
        vendor: transVendor
    };

    let transError;
    if (id) {
        const r = await _supabase.from('chemical_transactions').update(payload).eq('id', id);
        transError = r.error;
    } else {
        const r = await _supabase.from('chemical_transactions').insert([payload]);
        transError = r.error;
    }

    if (transError) {
        showToast("บันทึกธุรกรรมไม่สำเร็จ: " + transError.message, "danger");
    } else {
        closeTransModal();
        showToast(id ? "อัปเดตธุรกรรมสำเร็จ" : "เพิ่มธุรกรรมสำเร็จ", "success");
        clearStorageCache();
        loadAdminData();
    }
}

function adminDeleteTrans(id) {
    const t = adminTrans.find(item => item.id == id);
    if (!t) return;
    pendingDeleteId = id;
    pendingDeleteType = 'transaction';
    const chemName = t.chemical_stock?.chemical_name || `Chemical ID ${t.chemical_id}`;
    document.getElementById('deleteItemName').textContent = `คุณกำลังจะลบประวัติธุรกรรม ID #${t.id} (${chemName})`;
    document.getElementById('deleteItemDesc').textContent = 'การลบจะทำให้ข้อมูลนี้ถูกลบอย่างถาวร และปริมาณสารเคมีในคลังจะได้รับการคำนวณปรับตามธุรกรรมที่ลบ';
    document.getElementById('confirmDeleteModalOverlay').classList.add('open');
}

// ===== TABS =====
function switchTab(tabId, btnEl) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btnEl.classList.add('active');
}

// ===== EXPORT CSV =====
function exportCSV(type) {
    let csv = '\uFEFF', filename = '';
    const q = v => v ? `"${String(v).replace(/"/g, '""')}"` : '';
    const ds = () => { const d = new Date(); return `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`; };

    if (type === 'chemicals') {
        filename = `klangsarn_chemicals_${ds()}.csv`;
        csv += 'ลำดับ,ชื่อสารเคมี,Material Number,จำนวน,หน่วย,ราคาต่อหน่วย,วันผลิต,วันหมดอายุ,สถานที่\n';
        adminChems.forEach((c, i) => {
            csv += [i + 1, q(c.chemical_name), q(c.material_number), c.quantity, q(c.unit), c.price_per_unit || 0.0, c.mfg_date || '', c.exp_date || '', q(c.location)].join(',') + '\n';
        });
    } else {
        filename = `klangsarn_transactions_${ds()}.csv`;
        csv += 'ลำดับ,วัน-เวลา,สารเคมี,ประเภท,จำนวน,หน่วย,ราคาซื้อต่อหน่วย,จำนวนของแถม,ยอดประหยัด,หมายเหตุ\n';
        adminTrans.forEach((t, i) => {
            const d = new Date(t.transaction_date).toLocaleString('th-TH');
            csv += [i + 1, q(d), q(t.chemical_stock?.chemical_name || 'ลบแล้ว'), t.type, t.quantity, q(t.chemical_stock?.unit || ''), t.price_per_unit || 0.0, t.free_quantity || 0.0, t.saving || 0.0, q(t.remark || '')].join(',') + '\n';
        });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    a.click(); URL.revokeObjectURL(a.href);
    showToast(`ส่งออก ${type === 'chemicals' ? 'สารเคมี' : 'ประวัติรายการ'} สำเร็จ`, 'success');
}

// ===== CLEAR TRANSACTIONS =====
async function confirmClearTrans() {
    if (!confirm("⚠️ ยืนยันล้างประวัติการทำรายการทั้งหมด?\nการดำเนินการนี้ไม่สามารถยกเลิกได้")) return;
    const confirm2 = prompt('พิมพ์ "ยืนยัน" เพื่อดำเนินการต่อ:');
    if (confirm2 !== 'ยืนยัน') { showToast("ยกเลิกการดำเนินการ", "warning"); return; }
    const { error } = await _supabase.from('chemical_transactions').delete().neq('id', 0);
    if (error) { showToast("เกิดข้อผิดพลาด: " + error.message, "danger"); return; }
    showToast("ล้างประวัติสำเร็จ", "success");
    clearStorageCache();
    loadAdminData();
}

// ===== CHANGE PASSWORD =====
function openChangePwd() {
    ['oldPwd', 'newPwd', 'confirmPwd'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    document.getElementById('pwdError').style.display = 'none';
    document.getElementById('changePwdModal').classList.add('open');
}

function changePassword() {
    const old = document.getElementById('oldPwd').value;
    const nw = document.getElementById('newPwd').value;
    const conf = document.getElementById('confirmPwd').value;
    const err = document.getElementById('pwdError');

    if (old !== getAdminPassword() || nw !== conf || nw.length < 6) {
        err.style.display = 'block'; return;
    }
    localStorage.setItem(ADMIN_PWD_KEY, nw);
    document.getElementById('changePwdModal').classList.remove('open');
    showToast("เปลี่ยนรหัสผ่านสำเร็จ", "success");
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    if (isAdminLoggedIn()) {
        showAdminPanel();
    }
    // Forms submit binding
    document.getElementById("chemicalForm").addEventListener("submit", handleChemicalSubmit);
    document.getElementById("adminTransForm").addEventListener("submit", handleTransSubmit);

    // Auto-fill price per unit on chemical dropdown select
    document.getElementById('adminTransChemId')?.addEventListener('change', (e) => {
        const id = e.target.value;
        const chem = adminChems.find(c => c.id == id);
        if (chem) {
            document.getElementById('adminTransPricePerUnit').value = chem.price_per_unit || 0.0;
            updateAdminTransSummary();
        }
    });

    // Promotion fields behavior in admin transaction modal
    const adminPromoToggle = document.getElementById("adminTransPromoToggle");
    const adminFreeQtyContainer = document.getElementById("adminTransFreeQtyContainer");

    adminPromoToggle?.addEventListener("change", (e) => {
        if (e.target.checked) {
            adminFreeQtyContainer.style.display = "block";
            document.getElementById("adminTransFreeQty").value = "0";
        } else {
            adminFreeQtyContainer.style.display = "none";
            document.getElementById("adminTransFreeQty").value = "0";
        }
        updateAdminTransSummary();
    });

    ["adminTransQty", "adminTransPricePerUnit", "adminTransFreeQty"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", updateAdminTransSummary);
    });

    // New Lot fields behavior in admin transaction modal
    const adminNewLotToggle = document.getElementById("adminTransNewLotToggle");
    const adminNewLotContainer = document.getElementById("adminTransNewLotContainer");

    adminNewLotToggle?.addEventListener("change", (e) => {
        if (e.target.checked) {
            adminNewLotContainer.style.display = "block";
            document.getElementById("adminTransLocation").required = true;
        } else {
            adminNewLotContainer.style.display = "none";
            document.getElementById("adminTransLocation").required = false;
        }
    });

    // Auto-calculate EXP date inside admin transaction modal
    document.getElementById("adminTransMfgDate")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            const parts = val.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setFullYear(d.getFullYear() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            document.getElementById('adminTransExpDate').value = `${y}-${m}-${day}`;
        }
    });

    // Auto-calculate EXP date to MFG date + 1 Year
    document.getElementById("mfgDate")?.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val) {
            const parts = val.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            d.setFullYear(d.getFullYear() + 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            document.getElementById('expDate').value = `${y}-${m}-${day}`;
        }
    });
});

function setQuickExp(months) {
    const mfgVal = document.getElementById('mfgDate').value;
    let baseDate;
    if (mfgVal) {
        const parts = mfgVal.split('-');
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        baseDate = new Date();
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    document.getElementById('expDate').value = `${y}-${m}-${day}`;
}
window.setQuickExp = setQuickExp;

let pendingDeleteId = null;
let pendingDeleteType = null; // 'chemical' or 'transaction'

function closeDeleteModal() {
    const modal = document.getElementById('confirmDeleteModalOverlay');
    if (modal) modal.classList.remove('open');
    pendingDeleteId = null;
    pendingDeleteType = null;
}
window.closeDeleteModal = closeDeleteModal;

async function executeAdminDelete() {
    if (!pendingDeleteId || !pendingDeleteType) return;
    const id = pendingDeleteId;
    const type = pendingDeleteType;
    closeDeleteModal();

    if (type === 'chemical') {
        const { error } = await _supabase.from('chemical_stock').delete().eq('id', id);
        if (error) { showToast("ลบไม่สำเร็จ: " + error.message, "danger"); return; }
        showToast("ลบรายการสำเร็จ", "success");
        clearStorageCache();
        loadAdminData();
    } else if (type === 'transaction') {
        const t = adminTrans.find(item => item.id == id);
        if (!t) return;

        // Fetch corresponding chemical to adjust stock
        const { data: chem, error: fetchError } = await _supabase
            .from('chemical_stock')
            .select('quantity')
            .eq('id', t.chemical_id)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            showToast("ลบไม่สำเร็จ: ไม่พบข้อมูลสารเคมีที่เกี่ยวข้อง", "danger");
            return;
        }

        if (chem) {
            let newQty = (t.type === 'IN') ? chem.quantity - t.quantity : chem.quantity + t.quantity;
            if (newQty < 0) {
                showToast("ไม่สามารถลบธุรกรรมนี้ได้เนื่องจากยอดคงเหลือในสต็อกของสารเคมีนี้จะติดลบ!", "danger");
                return;
            }
            await _supabase.from('chemical_stock').update({ quantity: newQty }).eq('id', t.chemical_id);
        }

        const { error: deleteError } = await _supabase.from('chemical_transactions').delete().eq('id', id);
        if (deleteError) {
            showToast("ลบธุรกรรมไม่สำเร็จ: " + deleteError.message, "danger");
        } else {
            showToast("ลบธุรกรรมสำเร็จ", "success");
            clearStorageCache();
            loadAdminData();
        }
    }
}
function setQuickExpTransAdmin(months) {
    const mfgVal = document.getElementById('adminTransMfgDate').value;
    let baseDate;
    if (mfgVal) {
        const parts = mfgVal.split('-');
        baseDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
        baseDate = new Date();
    }
    baseDate.setMonth(baseDate.getMonth() + months);
    const y = baseDate.getFullYear();
    const m = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    document.getElementById('adminTransExpDate').value = `${y}-${m}-${day}`;
}

window.executeAdminDelete = executeAdminDelete;
window.adminDeleteChem = adminDeleteChem;
window.adminDeleteTrans = adminDeleteTrans;
window.updateAdminTransSummary = updateAdminTransSummary;
window.setQuickExpTransAdmin = setQuickExpTransAdmin;

function updateAdminTransSummary() {
    const isPromo = document.getElementById("adminTransPromoToggle")?.checked;
    const qtyInput = document.getElementById("adminTransQty");
    const priceInput = document.getElementById("adminTransPricePerUnit");
    const freeInput = document.getElementById("adminTransFreeQty");
    const summaryDiv = document.getElementById("adminTransSummaryText");
    const submitBtn = document.querySelector("#adminTransModalOverlay .btn-primary");

    if (!qtyInput || !priceInput || !freeInput || !summaryDiv || !submitBtn) return;

    const totalQty = parseFloat(qtyInput.value) || 0.0;
    const unitPrice = parseFloat(priceInput.value) || 0.0;
    const freeQty = isPromo ? (parseFloat(freeInput.value) || 0.0) : 0.0;

    if (!qtyInput.value) {
        summaryDiv.style.display = "none";
        submitBtn.disabled = false;
        return;
    }

    // Validation
    if (isPromo && freeQty > totalQty) {
        summaryDiv.style.display = "block";
        summaryDiv.style.borderColor = "var(--danger)";
        summaryDiv.style.background = "rgba(239, 68, 68, 0.05)";
        summaryDiv.innerHTML = `<span style="color: var(--danger); font-weight: bold;">⚠️ จำนวนของแถม (${freeQty}) ต้องไม่เกินจำนวนรับเข้าทั้งหมด (${totalQty})</span>`;
        submitBtn.disabled = true;
        return;
    }

    // Calculations
    const paidQty = Math.max(0, totalQty - freeQty);
    const totalPaid = paidQty * unitPrice;
    const totalSaving = freeQty * unitPrice;

    summaryDiv.style.display = "block";
    summaryDiv.style.borderColor = "var(--primary)";
    summaryDiv.style.background = "var(--bg-hover)";
    submitBtn.disabled = false;

    if (isPromo) {
        summaryDiv.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px; color: var(--primary);">สรุปราคารับเข้าแบบโปรโมชัน:</div>
            • ซื้อจริง: <span style="font-weight:600; color:var(--text-head);">${paidQty.toLocaleString('th-TH')}</span> | แถมฟรี: <span style="font-weight:600; color:var(--success);">${freeQty.toLocaleString('th-TH')}</span><br>
            • รวมได้รับเข้าสต็อก: <span style="font-weight:600; color:var(--text-head);">${totalQty.toLocaleString('th-TH')}</span><br>
            • <span style="color: var(--success); font-weight:600;">ยอดประหยัด (Saving): ${totalSaving.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</span><br>
            • ยอดจ่ายจริง: <span style="font-weight:600; color:var(--text-head);">${totalPaid.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</span>
        `;
    } else {
        summaryDiv.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px; color: var(--text-head);">สรุปราคารับเข้าปกติ:</div>
            • จำนวนซื้อจริง: <span style="font-weight:600; color:var(--text-head);">${totalQty.toLocaleString('th-TH')}</span> (ไม่มีของแถม)<br>
            • ยอดจ่ายรวม: <span style="font-weight:600; color:var(--primary); font-size: 13.5px;">${totalPaid.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</span>
        `;
    }
}
window.updateAdminTransSummary = updateAdminTransSummary;
