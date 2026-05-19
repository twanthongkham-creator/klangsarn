/* ============================================
   Shared UI Components
   sidebar, bottom nav, toasts
   ============================================ */

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
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info}" style="color:${colors[type]}; font-size:16px;"></i>
    <span style="flex:1; font-family:'Kanit',sans-serif;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#94A3B8;font-size:16px;padding:0;">×</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== ADMIN SESSION CHECK =====
function isAdminLoggedIn() {
  return localStorage.getItem('chemstock_admin') === 'true';
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

// ===== CONFIRM DIALOG =====
function confirmDialog(message) {
  return new Promise(resolve => {
    // Simple native confirm for now
    resolve(confirm(message));
  });
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  updateAdminUI();
});
