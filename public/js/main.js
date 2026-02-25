// ==========================================
// AtherixCloud V2 — Core Client JS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initSidebar();
  initAlerts();
  initAnimations();
});

// ==========================================
// PARTICLES BACKGROUND
// ==========================================
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  const PARTICLE_COUNT = 50;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 152, 255, ${p.opacity})`;
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(56, 152, 255, ${0.06 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ==========================================
// SIDEBAR
// ==========================================
function initSidebar() {
  const hamburger = document.getElementById('hamburgerBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// ==========================================
// ALERTS AUTO-DISMISS
// ==========================================
function initAlerts() {
  document.querySelectorAll('.alert').forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-8px)';
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  });
}

// ==========================================
// ENTRANCE ANIMATIONS
// ==========================================
function initAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.style.opacity = '1';
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.animate-in').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: 'check-circle', error: 'exclamation-circle', info: 'info-circle' };
  toast.innerHTML = `<i class="fas fa-${icons[type] || 'info-circle'}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// VPS ACTIONS (User)
// ==========================================
function vpsAction(id, action) {
  if (action === 'stop' && !confirm('Are you sure you want to stop this VPS?')) return;
  fetch(`/vps/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1500);
    })
    .catch(() => showToast('Network error', 'error'));
}

// ==========================================
// ADMIN ACTIONS
// ==========================================
function toggleUser(id, btn) {
  fetch(`/admin/users/${id}/suspend`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1000);
    })
    .catch(() => showToast('Network error', 'error'));
}

function deleteUser(id) {
  if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
  fetch(`/admin/users/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1000);
    })
    .catch(() => showToast('Network error', 'error'));
}

function adminVPS(id, action) {
  fetch(`/admin/vps/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1500);
    })
    .catch(() => showToast('Network error', 'error'));
}

function deleteVPS(id) {
  if (!confirm('Delete this VPS permanently?')) return;
  fetch(`/admin/vps/${id}`, { method: 'DELETE' })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1000);
    })
    .catch(() => showToast('Network error', 'error'));
}

function changeTicketStatus(id, status) {
  fetch(`/admin/tickets/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
    .then(r => r.json())
    .then(data => {
      showToast(data.message, data.success ? 'success' : 'error');
      if (data.success) setTimeout(() => location.reload(), 1000);
    })
    .catch(() => showToast('Network error', 'error'));
}

// ==========================================
// CREATE VPS FORM
// ==========================================
const createForm = document.getElementById('createVPSForm');
if (createForm) {
  createForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const formData = new FormData(this);
    const body = {};
    formData.forEach((val, key) => body[key] = val);
    // Handle checkboxes
    body.nesting = formData.has('nesting') ? 'on' : '';
    body.kvm = formData.has('kvm') ? 'on' : '';
    body.fuse = formData.has('fuse') ? 'on' : '';
    body.docker = formData.has('docker') ? 'on' : '';

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating...';

    fetch('/admin/vps/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(r => r.json())
      .then(data => {
        showToast(data.message, data.success ? 'success' : 'error');
        if (data.success) {
          document.getElementById('createVPSModal').classList.remove('active');
          setTimeout(() => location.reload(), 2000);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-rocket"></i> Create VPS';
        }
      })
      .catch(() => {
        showToast('Network error', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Create VPS';
      });
  });
}
