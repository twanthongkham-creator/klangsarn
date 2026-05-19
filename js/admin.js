// ==========================================
// Admin Panel Logic
// ChemStock v2.0
// ==========================================

const SUPABASE_URL = "https://bdjyxkkzbbzlmxszmvhx.supabase.co";
const SUPABASE_KEY = "sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Default admin password key in localStorage
const ADMIN_PWD_KEY = 'chemstock_admin_pwd';
const ADMIN_SESSION_KEY = 'chemstock_admin';
const DEFAULT_PASSWORD = 'chem@admin';

let adminChems = [];
let adminTrans = [];

// ==========================================
// 1. AUTH
// ==========================================
function getAdminPassword() {
    return localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_PASSWORD;
}

function togglePwd() {
    const input = document.getElementById('adminPassword');
    const icon = document.getElementById('eyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
    }
}

function attemptLogin() {
    const pwd = document.getElementById('adminPassword').value;
    const errorEl = document.getElementById('loginError');

    if (pwd === getAdminPassword()) {
        localStorage.setItem(ADMIN_SESSION_KEY, 'true');
        errorEl.style.display = 'none';
        showAdminPanel();
    } else {
        errorEl.style.display = 'block';
        document.getElementById('adminPassword').value = '';
        document.getElementById('adminPassword').focus();
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
}

// ==========================================
// 2. LOAD DATA
// ==========================================
async function loadAdminData() {
    const { data: chems } = await _supabase.from('chemical_stock').select('*').order('chemical_name');
    const { data: trans } = await _supabase
        .from('chemical_transactions')
        .select(`id, type, quantity, remark, transaction_date, chemical_stock(chemical_name, unit)`)
        .order('transaction_date', { ascending: false });

    adminChems = chems || [];
    adminTrans = trans || [];

    updateQuickStats();
    renderAdminChems();
    renderAdminTrans();
}

function updateQuickStats() {
    document.getElementById('adminTotalChems').textContent = adminChems.length;

    const today = new Date();
    const alerts = adminChems.filter(c => {
        if (!c.exp_date) return false;
        const diff = (new Date(c.exp_date) - today) / (1000 * 60 * 60 * 24);
        return diff <= 30;
    });
    document.getElementById('adminAlerts').textContent = alerts.length;
    document.getElementById('adminTotalTrans').textContent = adminTrans.length;

    const firstDay = new Date();
    firstDay.setDate(1); firstDay.setHours(0, 0, 0, 0);
    const monthCount = adminTrans.filter(t => new Date(t.transaction_date) >= firstDay).length;
    document.getElementById('adminThisMonth').textContent = monthCount;
}

// ==========================================
// 3. CHEMICALS TABLE
// ==========================================
function renderAdminChems() {
    const search = (document.getElementById('adminSearch')?.value || '').toLowerCase();
    const filtered = adminChems.filter(c =>
        c.chemical_name.toLowerCase().includes(search) ||
        (c.cas_number || '').toLowerCase().includes(search)
    );

    const tbody = document.getElementById('adminChemsTable');
    if (!tbody) return;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔬</div><div class="empty-title">ไม่พบรายการ</div></div></td></tr>`;
        return;
    }

    const today = new Date();
    tbody.innerHTML = filtered.map(item => {
        const diff = item.exp_date ? (new Date(item.exp_date) - today) / (1000 * 60 * 60 * 24) : Infinity;
        const expBadge = diff <= 0
            ? `<span class="badge badge-red">หมดอายุ</span>`
            : diff <= 30
                ? `<span class="badge badge-yellow">⏳ ${Math.ceil(diff)}วัน</span>`
                : `<span class="badge badge-green">✓ ปกติ</span>`;

        return `<tr>
          <td style="padding-left:20px;">
            <div style="font-weight:600;color:var(--text-primary);">${item.chemical_name}</div>
            <div style="font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">${item.cas_number || '—'}</div>
          </td>
          <td>
            <span class="mono" style="font-weight:600;">${item.quantity}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${item.unit}</span>
          </td>
          <td>
            <div style="font-size:13px;">${item.exp_date || '—'}</div>
            <div style="margin-top:3px;">${expBadge}</div>
          </td>
          <td>
            <span class="badge badge-gray" style="font-size:11px;">${item.location || '—'}</span>
          </td>
          <td style="padding-right:20px;text-align:right;">
            <button class="btn btn-outline btn-sm btn-icon" onclick="openAdminEditModal(${item.id})" title="แก้ไข">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm btn-icon" onclick="adminDeleteChem(${item.id})" title="ลบ" style="margin-left:6px;">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`;
    }).join('');
}

// ==========================================
// 4. CHEMICAL CRUD (Admin Modal via native prompt for simplicity)
// ==========================================
function openAdminAddModal() {
    // Redirect to main page with admin session
    window.location.href = 'index.html';
}

function openAdminEditModal(id) {
    window.location.href = 'index.html';
}

async function adminDeleteChem(id) {
    const item = adminChems.find(c => c.id == id);
    if (!confirm(`ยืนยันลบ "${item?.chemical_name}" ออกจากระบบ?\nประวัติธุรกรรมที่เกี่ยวข้องจะถูกลบด้วย`)) return;

    await _supabase.from('chemical_stock').delete().eq('id', id);
    showToast("ลบสารเคมีสำเร็จ", "success");
    loadAdminData();
}

// ==========================================
// 5. TRANSACTIONS TABLE
// ==========================================
function renderAdminTrans() {
    const tbody = document.getElementById('adminTransTable');
    const countEl = document.getElementById('transCount');
    if (!tbody) return;

    if (countEl) countEl.textContent = `แสดงทั้งหมด ${adminTrans.length} รายการ`;

    if (adminTrans.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`;
        return;
    }

    tbody.innerHTML = adminTrans.map(t => {
        const d = new Date(t.transaction_date);
        const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        const badge = t.type === 'IN'
            ? `<span class="badge badge-green">รับเข้า</span>`
            : `<span class="badge badge-red">เบิกจ่าย</span>`;
        const name = t.chemical_stock?.chemical_name || '<em style="color:var(--text-muted)">ลบแล้ว</em>';

        return `<tr>
          <td style="padding-left:20px;font-size:13px;color:var(--text-muted);">${dateStr}</td>
          <td style="font-weight:500;color:var(--text-primary);">${name}</td>
          <td>${badge}</td>
          <td class="mono" style="font-weight:600;">${t.quantity} <small style="color:var(--text-muted);font-family:'Kanit',sans-serif;font-weight:300;">${t.chemical_stock?.unit || ''}</small></td>
          <td style="padding-right:20px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
        </tr>`;
    }).join('');
}

// ==========================================
// 6. TAB SWITCHING
// ==========================================
function switchTab(tabId, btnEl) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btnEl.classList.add('active');
}

// ==========================================
// 7. EXPORT CSV
// ==========================================
function exportCSV(type) {
    let csv = '';
    let filename = '';

    if (type === 'chemicals') {
        filename = `chemstock_chemicals_${dateStr()}.csv`;
        csv = '\uFEFF'; // BOM for Thai chars
        csv += 'ลำดับ,ชื่อสารเคมี,CAS Number,จำนวน,หน่วย,วันผลิต,วันหมดอายุ,สถานที่\n';
        adminChems.forEach((c, i) => {
            csv += [i+1, q(c.chemical_name), q(c.cas_number), c.quantity, q(c.unit), c.mfg_date||'', c.exp_date||'', q(c.location)].join(',') + '\n';
        });
    } else {
        filename = `chemstock_transactions_${dateStr()}.csv`;
        csv = '\uFEFF';
        csv += 'ลำดับ,วัน-เวลา,สารเคมี,ประเภท,จำนวน,หน่วย,หมายเหตุ\n';
        adminTrans.forEach((t, i) => {
            const d = new Date(t.transaction_date).toLocaleString('th-TH');
            csv += [i+1, q(d), q(t.chemical_stock?.chemical_name||'ลบแล้ว'), t.type, t.quantity, q(t.chemical_stock?.unit||''), q(t.remark||'')].join(',') + '\n';
        });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast(`ส่งออก ${filename} สำเร็จ`, 'success');
}

function q(val) {
    if (!val) return '';
    return '"' + String(val).replace(/"/g, '""') + '"';
}

function dateStr() {
    const d = new Date();
    return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`;
}

// ==========================================
// 8. CLEAR TRANSACTIONS
// ==========================================
async function confirmClearTrans() {
    if (!confirm("⚠️ ยืนยันล้างประวัติการทำรายการทั้งหมด?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้!")) return;
    const confirmAgain = prompt('พิมพ์ "ยืนยัน" เพื่อดำเนินการต่อ:');
    if (confirmAgain !== 'ยืนยัน') {
        showToast("ยกเลิกการดำเนินการ", "info");
        return;
    }
    const { error } = await _supabase.from('chemical_transactions').delete().neq('id', 0);
    if (error) {
        showToast("เกิดข้อผิดพลาด: " + error.message, "danger");
    } else {
        showToast("ล้างประวัติสำเร็จ", "success");
        loadAdminData();
    }
}

// ==========================================
// 9. CHANGE PASSWORD
// ==========================================
function openChangePwd() {
    document.getElementById('oldPwd').value = '';
    document.getElementById('newPwd').value = '';
    document.getElementById('confirmPwd').value = '';
    document.getElementById('pwdError').style.display = 'none';
    document.getElementById('changePwdModal').classList.add('open');
}

function changePassword() {
    const oldPwd = document.getElementById('oldPwd').value;
    const newPwd = document.getElementById('newPwd').value;
    const confirmPwd = document.getElementById('confirmPwd').value;
    const errEl = document.getElementById('pwdError');

    if (oldPwd !== getAdminPassword() || newPwd !== confirmPwd || newPwd.length < 6) {
        errEl.style.display = 'block';
        return;
    }

    localStorage.setItem(ADMIN_PWD_KEY, newPwd);
    document.getElementById('changePwdModal').classList.remove('open');
    showToast("เปลี่ยนรหัสผ่านสำเร็จ", "success");
}

// ==========================================
// 10. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (isAdminLoggedIn()) {
        showAdminPanel();
    } else {
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('adminPanel').style.display = 'none';
    }
});
