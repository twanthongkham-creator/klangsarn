// ==========================================
// ChemStock — Admin Panel Logic v2.1
// ==========================================
const SUPABASE_URL = “https://bdjyxkkzbbzlmxszmvhx.supabase.co”;
const SUPABASE_KEY = “sb_publishable_inYG_le-QyiIvjkaUHXyfQ_Nvm4FpR2”;
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PWD_KEY     = ‘chemstock_admin_pwd’;
const ADMIN_SESSION_KEY = ‘chemstock_admin’;
const DEFAULT_PASSWORD  = ‘chem@admin’;

let adminChems = [];
let adminTrans = [];

function getAdminPassword() { return localStorage.getItem(ADMIN_PWD_KEY) || DEFAULT_PASSWORD; }

// ===== EYE TOGGLE =====
function togglePwd() {
const input = document.getElementById(‘adminPassword’);
const show  = document.getElementById(‘eyeIconShow’);
const hide  = document.getElementById(‘eyeIconHide’);
const isHidden = input.type === ‘password’;
input.type = isHidden ? ‘text’ : ‘password’;
show.style.display = isHidden ? ‘none’ : ‘’;
hide.style.display = isHidden ? ‘’ : ‘none’;
}

// ===== LOGIN =====
function attemptLogin() {
const pwd = document.getElementById(‘adminPassword’).value;
const err = document.getElementById(‘loginError’);
if (pwd === getAdminPassword()) {
localStorage.setItem(ADMIN_SESSION_KEY, ‘true’);
err.classList.remove(‘show’);
showAdminPanel();
} else {
err.classList.add(‘show’);
document.getElementById(‘adminPassword’).value = ‘’;
document.getElementById(‘adminPassword’).focus();
// Shake animation on the input
const box = document.querySelector(’.login-box’);
box.style.animation = ‘none’;
box.offsetWidth; // reflow
box.style.animation = ‘shake 0.4s ease’;
}
}

function adminLogout() {
localStorage.removeItem(ADMIN_SESSION_KEY);
window.location.reload();
}

function showAdminPanel() {
document.getElementById(‘loginScreen’).style.display = ‘none’;
document.getElementById(‘adminPanel’).style.display  = ‘’;
initSidebar();
loadAdminData();
}

// Add shake keyframe dynamically
const shakeStyle = document.createElement(‘style’);
shakeStyle.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }`;
document.head.appendChild(shakeStyle);

// ===== LOAD DATA =====
async function loadAdminData() {
const [c, t] = await Promise.all([
_supabase.from(‘chemical_stock’).select(’*’).order(‘chemical_name’),
_supabase.from(‘chemical_transactions’)
.select(‘id, type, quantity, remark, transaction_date, chemical_stock(chemical_name, unit)’)
.order(‘transaction_date’, { ascending: false })
]);
adminChems = c.data || [];
adminTrans = t.data || [];
updateQuickStats();
renderAdminChems();
renderAdminTrans();
}

function updateQuickStats() {
const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
s(‘adminTotalChems’, adminChems.length);

```
const today = new Date();
const alerts = adminChems.filter(c => c.exp_date && (new Date(c.exp_date) - today) / 864e5 <= 30);
s('adminAlerts', alerts.length);
s('adminTotalTrans', adminTrans.length);

const firstDay = new Date(); firstDay.setDate(1); firstDay.setHours(0,0,0,0);
s('adminThisMonth', adminTrans.filter(t => new Date(t.transaction_date) >= firstDay).length);
```

}

// ===== CHEMICALS TABLE =====
function renderAdminChems() {
const q = (document.getElementById(‘adminSearch’)?.value || ‘’).toLowerCase();
const filtered = adminChems.filter(c =>
c.chemical_name.toLowerCase().includes(q) ||
(c.cas_number || ‘’).toLowerCase().includes(q)
);

```
const tbody = document.getElementById('adminChemsTable');
if (!tbody) return;

if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state" style="padding:40px 20px;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.2" stroke-linecap="round" style="margin:0 auto 10px;display:block;">
          <path d="M9 3h6M10 3v6.6L6.1 17.2A2 2 0 0 0 8 20h8a2 2 0 0 0 1.9-2.8L14 9.6V3"/>
        </svg>
        <div class="empty-title">ไม่พบรายการ</div>
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

    return `<tr>
      <td style="padding-left:22px;">
        <div class="cell-name">${item.chemical_name}</div>
        <div class="cell-cas">CAS: ${item.cas_number || '—'}</div>
      </td>
      <td>
        <span class="mono" style="font-size:15px;font-weight:700;color:var(--text-head);">${item.quantity}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:4px;">${item.unit}</span>
      </td>
      <td>
        <div style="font-size:13px;color:var(--text-body);">${item.exp_date || '—'}</div>
        ${expBadge}
      </td>
      <td>
        <span class="badge badge-loc" style="font-size:11px;">${item.location ? item.location.split(' ').slice(0,2).join(' ') : '—'}</span>
      </td>
      <td style="padding-right:22px;text-align:right;">
        <div style="display:inline-flex;gap:6px;">
          <button class="btn btn-outline btn-sm btn-icon" onclick="window.location.href='index.html'" title="แก้ไข (ไปหน้าหลัก)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-outline-danger btn-sm btn-icon" onclick="adminDeleteChem(${item.id})" title="ลบ">
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
```

}

async function adminDeleteChem(id) {
const item = adminChems.find(c => c.id == id);
if (!confirm(`ยืนยันลบ "${item?.chemical_name}"?\nประวัติธุรกรรมที่เกี่ยวข้องจะถูกลบด้วย`)) return;
const { error } = await _supabase.from(‘chemical_stock’).delete().eq(‘id’, id);
if (error) { showToast(“ลบไม่สำเร็จ: “ + error.message, “danger”); return; }
showToast(“ลบรายการสำเร็จ”, “success”);
loadAdminData();
}

// ===== TRANSACTIONS TABLE =====
function renderAdminTrans() {
const tbody  = document.getElementById(‘adminTransTable’);
const countEl = document.getElementById(‘transCount’);
if (!tbody) return;

```
if (countEl) countEl.textContent = `รายการทั้งหมด ${adminTrans.length} รายการ`;

if (adminTrans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted);">ยังไม่มีประวัติ</td></tr>`;
    return;
}

tbody.innerHTML = adminTrans.map(t => {
    const d = new Date(t.transaction_date);
    const ds = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;

    const badge = t.type === 'IN'
        ? `<span class="badge badge-green"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> รับเข้า</span>`
        : `<span class="badge badge-red"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> เบิกจ่าย</span>`;

    const name = t.chemical_stock?.chemical_name
        ? `<span style="font-weight:600;color:var(--text-head);">${t.chemical_stock.chemical_name}</span>`
        : `<span style="color:var(--text-muted);font-style:italic;">ลบแล้ว</span>`;

    return `<tr>
      <td style="padding-left:22px;font-size:13px;color:var(--text-muted);">${ds}</td>
      <td>${name}</td>
      <td>${badge}</td>
      <td>
        <span class="mono" style="font-size:15px;font-weight:700;color:var(--text-head);">${t.quantity}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:3px;">${t.chemical_stock?.unit || ''}</span>
      </td>
      <td style="padding-right:22px;font-size:13px;color:var(--text-muted);">${t.remark || '—'}</td>
    </tr>`;
}).join('');
```

}

// ===== TABS =====
function switchTab(tabId, btnEl) {
document.querySelectorAll(’.tab-pane’).forEach(p => p.classList.remove(‘active’));
document.querySelectorAll(’.admin-tab’).forEach(b => b.classList.remove(‘active’));
document.getElementById(‘tab-’ + tabId).classList.add(‘active’);
btnEl.classList.add(‘active’);
}

// ===== EXPORT CSV =====
function exportCSV(type) {
let csv = ‘\uFEFF’, filename = ‘’;
const q = v => v ? `"${String(v).replace(/"/g,'""')}"` : ‘’;
const ds = () => { const d=new Date(); return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}`; };

```
if (type === 'chemicals') {
    filename = `chemstock_chemicals_${ds()}.csv`;
    csv += 'ลำดับ,ชื่อสารเคมี,CAS Number,จำนวน,หน่วย,วันผลิต,วันหมดอายุ,สถานที่\n';
    adminChems.forEach((c, i) => {
        csv += [i+1, q(c.chemical_name), q(c.cas_number), c.quantity, q(c.unit), c.mfg_date||'', c.exp_date||'', q(c.location)].join(',') + '\n';
    });
} else {
    filename = `chemstock_transactions_${ds()}.csv`;
    csv += 'ลำดับ,วัน-เวลา,สารเคมี,ประเภท,จำนวน,หน่วย,หมายเหตุ\n';
    adminTrans.forEach((t, i) => {
        const d = new Date(t.transaction_date).toLocaleString('th-TH');
        csv += [i+1, q(d), q(t.chemical_stock?.chemical_name||'ลบแล้ว'), t.type, t.quantity, q(t.chemical_stock?.unit||''), q(t.remark||'')].join(',') + '\n';
    });
}

const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
a.click(); URL.revokeObjectURL(a.href);
showToast(`ส่งออก ${type === 'chemicals' ? 'สารเคมี' : 'ประวัติรายการ'} สำเร็จ`, 'success');
```

}

// ===== CLEAR TRANSACTIONS =====
async function confirmClearTrans() {
if (!confirm(“⚠️ ยืนยันล้างประวัติการทำรายการทั้งหมด?\nการดำเนินการนี้ไม่สามารถยกเลิกได้”)) return;
const confirm2 = prompt(‘พิมพ์ “ยืนยัน” เพื่อดำเนินการต่อ:’);
if (confirm2 !== ‘ยืนยัน’) { showToast(“ยกเลิกการดำเนินการ”, “warning”); return; }
const { error } = await _supabase.from(‘chemical_transactions’).delete().neq(‘id’, 0);
if (error) { showToast(“เกิดข้อผิดพลาด: “ + error.message, “danger”); return; }
showToast(“ล้างประวัติสำเร็จ”, “success”);
loadAdminData();
}

// ===== CHANGE PASSWORD =====
function openChangePwd() {
[‘oldPwd’,‘newPwd’,‘confirmPwd’].forEach(id => { const e=document.getElementById(id); if(e) e.value=’’; });
document.getElementById(‘pwdError’).style.display = ‘none’;
document.getElementById(‘changePwdModal’).classList.add(‘open’);
}

function changePassword() {
const old  = document.getElementById(‘oldPwd’).value;
const nw   = document.getElementById(‘newPwd’).value;
const conf = document.getElementById(‘confirmPwd’).value;
const err  = document.getElementById(‘pwdError’);

```
if (old !== getAdminPassword() || nw !== conf || nw.length < 6) {
    err.style.display = 'block'; return;
}
localStorage.setItem(ADMIN_PWD_KEY, nw);
document.getElementById('changePwdModal').classList.remove('open');
showToast("เปลี่ยนรหัสผ่านสำเร็จ", "success");
```

}

// ===== INIT =====
document.addEventListener(‘DOMContentLoaded’, () => {
if (isAdminLoggedIn()) {
showAdminPanel();
}
// loginScreen always visible initially via HTML display logic
});
