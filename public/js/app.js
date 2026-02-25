// Toast notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span>${icons[type] || '•'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 4000);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  c.className = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// VPS Actions
async function vpsAction(vpsId, action, btn) {
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<div class="spinner"></div>';
  btn.disabled = true;

  try {
    const basePath = window.location.pathname.startsWith('/admin') ? '/admin/vps' : '/vps';
    const res = await fetch(`${basePath}/${vpsId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    if (data.success) setTimeout(() => location.reload(), 1500);
  } catch (e) {
    showToast('Action failed. Please try again.', 'error');
  } finally {
    btn.innerHTML = originalContent;
    btn.disabled = false;
  }
}

async function deleteVPS(vpsId) {
  if (!confirm('⚠️ Are you sure you want to permanently delete this VPS? This action cannot be undone!')) return;
  try {
    const res = await fetch(`/admin/vps/${vpsId}`, { method: 'DELETE' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    if (data.success) setTimeout(() => location.reload(), 1500);
  } catch (e) {
    showToast('Delete failed.', 'error');
  }
}

async function toggleUserStatus(userId, btn) {
  try {
    const res = await fetch(`/admin/users/${userId}/suspend`, { method: 'POST' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    if (data.success) {
      if (data.isActive) {
        btn.textContent = 'Suspend';
        btn.className = btn.className.replace('btn-success', 'btn-warning');
      } else {
        btn.textContent = 'Activate';
        btn.className = btn.className.replace('btn-warning', 'btn-success');
      }
    }
  } catch (e) {
    showToast('Failed to update user.', 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm('Delete this user and all their VPS/tickets?')) return;
  try {
    const res = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    if (data.success) setTimeout(() => location.reload(), 1500);
  } catch (e) {
    showToast('Delete failed.', 'error');
  }
}

// Modal management
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

// Sidebar mobile toggle
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

// LXC Create VPS form
async function submitCreateVPS(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<div class="spinner"></div> Creating...';
  btn.disabled = true;

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // Add checkboxes
  ['nesting', 'kvm', 'fuse', 'docker'].forEach(key => {
    data[key] = form.querySelector(`[name="${key}"]`)?.checked ? 'on' : 'off';
  });

  try {
    const res = await fetch('/admin/vps/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    showToast(result.message, result.success ? 'success' : 'error');
    if (result.success) {
      closeModal('createVPSModal');
      setTimeout(() => location.reload(), 2000);
    }
  } catch (err) {
    showToast('Failed to create VPS.', 'error');
  } finally {
    btn.innerHTML = originalContent;
    btn.disabled = false;
  }
}

// Ticket status change
async function updateTicketStatus(ticketId, status) {
  try {
    const res = await fetch(`/admin/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
    if (data.success) setTimeout(() => location.reload(), 1000);
  } catch (e) {
    showToast('Failed to update status.', 'error');
  }
}

// Auto-dismiss flash messages
document.addEventListener('DOMContentLoaded', () => {
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = '0.5s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });

  // Active nav links
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.startsWith(href) && href !== '/') {
      link.classList.add('active');
    }
    if (href === '/dashboard' && currentPath === '/dashboard') {
      link.classList.add('active');
    }
  });

  // Checkbox toggle UI
  document.querySelectorAll('.checkbox-item').forEach(item => {
    const input = item.querySelector('input[type="checkbox"]');
    if (input && input.checked) item.classList.add('checked');
    item.addEventListener('click', () => {
      if (input) {
        input.checked = !input.checked;
        item.classList.toggle('checked', input.checked);
      }
    });
  });
});
