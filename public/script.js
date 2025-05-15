// script.js
console.log('script.js loaded');

let expenses = [];
let barChart, pieChart;

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      alert('Logout clicked'); // Debug alert to confirm listener is triggered
      try {
        const res = await fetch('/logout', { credentials: 'include' });
        if (res.ok) {
          window.location.href = '/index.html';
        } else {
          alert('Logout failed');
        }
      } catch (error) {
        alert('Network error on logout');
        console.error(error);
      }
    });
  }
});


async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const data = {
    amount: parseFloat(form.amount.value),
    category: form.category.value,
    date: form.date.value,
    note: form.note.value
  };

  const isEdit = form.dataset.editingId;
  const url = isEdit ? `/expenses/${isEdit}` : '/expenses';
  const method = isEdit ? 'PUT' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include'
  });

  if (res.ok) {
    form.reset();
    delete form.dataset.editingId;
    form.querySelector('button[type="submit"]').textContent = 'Add Expense';
    await loadData();
  } else {
    alert('Failed to save expense');
  }
}

async function loadData() {
  try {
    const [expensesRes, pieRes, barRes] = await Promise.all([
      fetch('/expenses', { credentials: 'include' }),
      fetch('/analytics/pie', { credentials: 'include' }),
      fetch('/analytics/total', { credentials: 'include' })
    ]);

    if (!expensesRes.ok || !pieRes.ok || !barRes.ok) throw new Error('Fetch failed');

    expenses = await expensesRes.json();
    const pieData = await pieRes.json();
    const totalData = await barRes.json();

    renderTable(expenses);
    renderPieChart(pieData);
    renderBarChart(totalData.total);
  } catch (err) {
    alert('Failed to load data.');
  }
}

function renderTable(data) {
  const tbody = document.getElementById('expenseTable');
  tbody.innerHTML = '';
  data.forEach(exp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="p-2">₹${exp.amount.toFixed(2)}</td>
      <td class="p-2">${exp.category}</td>
      <td class="p-2">${new Date(exp.date).toLocaleDateString()}</td>
      <td class="p-2">${exp.note || '-'}</td>
      <td class="p-2">
        <button onclick="editExpense(${exp.id})" class="text-blue-400">Edit</button>
        <button onclick="deleteExpense(${exp.id})" class="text-red-400 ml-2">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editExpense(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;
  const form = document.getElementById('expenseForm');
  form.amount.value = exp.amount;
  form.category.value = exp.category;
  form.date.value = exp.date;
  form.note.value = exp.note || '';
  form.dataset.editingId = id;
  form.querySelector('button[type=\"submit\"]').textContent = 'Update Expense';
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;
  const res = await fetch(`/expenses/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) loadData();
  else alert('Failed to delete expense');
}

function clearFilters() {
  document.getElementById('filterCategory').value = '';
  document.getElementById('filterDate').value = '';
  renderTable(expenses);
}

function applyFilters() {
  const cat = document.getElementById('filterCategory').value.toLowerCase();
  const date = document.getElementById('filterDate').value;
  const filtered = expenses.filter(e => {
    return (!cat || e.category.toLowerCase().includes(cat)) &&
           (!date || e.date === date);
  });
  renderTable(filtered);
}

function renderPieChart(data) {
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        data: data.map(d => d.total),
        backgroundColor: ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa']
      }]
    },
    options: { responsive: true }
  });
}

function renderBarChart(total) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['This Month'],
      datasets: [{
        label: 'Total Spending',
        data: [total],
        backgroundColor: '#3b82f6'
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}
ddocument.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    const res = await fetch('/logout', { credentials: 'include' });
    if (res.ok) {
      window.location.href = '/index.html';
    } else {
      alert('Logout failed');
    }
  } catch (error) {
    alert('Network error on logout');
    console.error(error);
  }
});

