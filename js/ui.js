/* ============================================
   Shared UI Components
   sidebar, bottom nav, toasts
   ============================================ */

// ===== CACHE BUSTER =====
const CACHE_VERSION = 'v3.4';
if (sessionStorage.getItem('klangsarn_cache_version') !== CACHE_VERSION) {
  sessionStorage.clear();
  sessionStorage.setItem('klangsarn_cache_version', CACHE_VERSION);
}

// ===== SIDEBAR TOGGLE (MOBILE) =====
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const openBtn = document.getElementById('sidebarOpenBtn');

  if (!sidebar) return;

  openBtn?.addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay?.classList.add('show');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay?.classList.remove('show');
  });
}

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };
  const colors = { success: '#10B981', danger: '#EF4444', warning: '#F59E0B', info: '#0EA5E9' };

  const toast = document.createElement('div');
  toast.className = `toast t-${type}`;
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info}" style="color:${colors[type]}; font-size:16px;"></i>
    <span style="flex:1; font-family:'IBM Plex Sans Thai',sans-serif;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#94A3B8;font-size:16px;padding:0;">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== ADMIN SESSION CHECK =====
function isAdminLoggedIn() {
  return localStorage.getItem('klangsarn_admin') === 'true';
}

function updateAdminUI() {
  const adminLinks = document.querySelectorAll('[data-admin-only]');
  const adminBadges = document.querySelectorAll('.admin-indicator');

  if (isAdminLoggedIn()) {
    adminLinks.forEach(el => el.style.display = '');
    adminBadges.forEach(el => el.style.display = '');
  } else {
    adminLinks.forEach(el => el.style.display = 'none');
    adminBadges.forEach(el => el.style.display = 'none');
  }
}

// ===== SIDEBAR DESKTOP COLLAPSE =====
// Apply sidebar state as early as possible to prevent layout shifts
if (localStorage.getItem('klangsarn_sidebar_collapsed') === 'true') {
  document.body.classList.add('sidebar-collapsed');
}

function toggleSidebarDesktop() {
  const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('klangsarn_sidebar_collapsed', isCollapsed ? 'true' : 'false');
}

function initSidebarToggle() {
  if (!document.getElementById('desktopSidebarToggle')) {
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'desktopSidebarToggle';
    toggleBtn.className = 'desktop-toggle-btn';
    toggleBtn.title = 'เปิด/ปิด Sidebar';
    toggleBtn.innerHTML = `
      <svg id="toggleBtnIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    `;
    toggleBtn.addEventListener('click', toggleSidebarDesktop);
    document.body.appendChild(toggleBtn);
  }
}

// ===== CONFIRM DIALOG =====
function confirmDialog(message) {
  return new Promise(resolve => {
    // Simple native confirm for now
    resolve(confirm(message));
  });
}

// ===== RESIZABLE COLUMNS (EXCEL STYLE) =====
function makeTablesResizable() {
  const tables = document.querySelectorAll('.data-table');
  tables.forEach(table => {
    const cols = table.querySelectorAll('thead th');
    cols.forEach(col => {
      // Prevent duplicate resizers
      if (col.querySelector('.table-resizer')) return;

      // Create resize handle
      const resizer = document.createElement('div');
      resizer.className = 'table-resizer';
      col.appendChild(resizer);

      let startX, startWidth;

      resizer.addEventListener('mousedown', e => {
        e.preventDefault();
        table.style.tableLayout = 'fixed';
        startX = e.clientX;
        startWidth = col.offsetWidth;
        resizer.classList.add('resizing');

        // Set explicit widths on all sibling headers
        cols.forEach(c => {
          if (!c.style.width) {
            c.style.width = c.offsetWidth + 'px';
          }
        });

        const onMouseMove = ev => {
          const newWidth = startWidth + (ev.clientX - startX);
          col.style.width = Math.max(40, newWidth) + 'px';
        };

        const onMouseUp = () => {
          resizer.classList.remove('resizing');
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  });
}
window.makeTablesResizable = makeTablesResizable;

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  updateAdminUI();
  initSidebarToggle();
  makeTablesResizable();
});

// ===== DATE FORMATTER =====
function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD -> DD/MM/YYYY
}

// ===== CLEAR STORAGE CACHE =====
function clearStorageCache() {
  sessionStorage.removeItem('klangsarn_chemicals');
  sessionStorage.removeItem('klangsarn_transactions');
  sessionStorage.removeItem('klangsarn_dash_stock');
  sessionStorage.removeItem('klangsarn_dash_trans');
  sessionStorage.removeItem('klangsarn_history_transactions');
  sessionStorage.removeItem('klangsarn_admin_chems');
  sessionStorage.removeItem('klangsarn_admin_trans');
}
