const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const body = document.getElementById("requestsBody");
const dialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const dashboardMessage = document.getElementById("dashboardMessage");
let requests = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

async function checkSession() {
  try {
    const data = await api("/api/admin/session");
    if (data.authenticated) showDashboard();
  } catch (_) {}
}

function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
  loadRequests();
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginMessage.textContent = "Signing in...";
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) });
    loginForm.reset();
    showDashboard();
  } catch (error) { loginMessage.className = "message error"; loginMessage.textContent = error.message; }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try { await api("/api/admin/logout", { method: "POST" }); }
  finally { dashboard.hidden = true; loginPanel.hidden = false; }
});

async function loadRequests() {
  body.innerHTML = '<tr><td colspan="6">Loading...</td></tr>';
  const params = new URLSearchParams();
  if (document.getElementById("searchInput").value.trim()) params.set("search", document.getElementById("searchInput").value.trim());
  if (document.getElementById("statusFilter").value) params.set("status", document.getElementById("statusFilter").value);
  try {
    requests = await api("/api/requests?" + params.toString());
    renderRequests();
    updateStats();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderRequests() {
  if (!requests.length) {
    body.innerHTML = '<tr><td colspan="6">No requests found.</td></tr>';
    return;
  }
  body.innerHTML = requests.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.referenceNumber)}</strong></td>
      <td>${escapeHtml(r.fullName)}<small>${escapeHtml(r.email)}</small></td>
      <td>${escapeHtml(r.documentType)}</td>
      <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      <td><span class="status status-${r.status.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(r.status)}</span></td>
      <td class="actions"><button class="text-btn" data-edit="${r._id}">Edit</button><button class="text-btn danger-text" data-delete="${r._id}">Delete</button></td>
    </tr>`).join("");
}

function updateStats() {
  document.getElementById("totalCount").textContent = requests.length;
  document.getElementById("pendingCount").textContent = requests.filter(r => r.status === "Pending").length;
  document.getElementById("processingCount").textContent = requests.filter(r => r.status === "Processing").length;
  document.getElementById("completedCount").textContent = requests.filter(r => r.status === "Completed").length;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]);
}

body.addEventListener("click", async event => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) openEdit(editId);
  if (deleteId) {
    const record = requests.find(r => r._id === deleteId);
    if (!confirm(`Delete request ${record?.referenceNumber || ""}? This cannot be undone.`)) return;
    try {
      await api("/api/requests/" + deleteId, { method: "DELETE" });
      dashboardMessage.className = "message success";
      dashboardMessage.textContent = "Request deleted.";
      loadRequests();
    } catch (error) { dashboardMessage.className = "message error"; dashboardMessage.textContent = error.message; }
  }
});

function openEdit(id) {
  const r = requests.find(item => item._id === id);
  if (!r) return;
  for (const [key, value] of Object.entries(r)) {
    const field = editForm.elements.namedItem(key);
    if (field) field.value = value ?? "";
  }
  editForm.elements.id.value = r._id;
  document.getElementById("editMessage").textContent = "";
  dialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(editForm).entries());
  const id = data.id;
  delete data.id;
  delete data.referenceNumber;
  try {
    await api("/api/requests/" + id, { method: "PUT", body: JSON.stringify(data) });
    dialog.close();
    dashboardMessage.className = "message success";
    dashboardMessage.textContent = "Request updated successfully.";
    loadRequests();
  } catch (error) {
    const msg = document.getElementById("editMessage");
    msg.className = "message error";
    msg.textContent = error.message;
  }
}
editForm.addEventListener("submit", saveEdit);
document.getElementById("closeDialog").addEventListener("click", () => dialog.close());
document.getElementById("cancelEdit").addEventListener("click", () => dialog.close());
document.getElementById("searchInput").addEventListener("input", debounce(loadRequests, 350));
document.getElementById("statusFilter").addEventListener("change", loadRequests);

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
checkSession();
