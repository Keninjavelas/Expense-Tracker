let chart = null;

document.getElementById('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    amount: form.amount.value,
    category: form.category.value,
    date: form.date.value,
    note: form.note.value
  };
  if (form.dataset.editingId) {
    await fetch(`/expenses/${form.dataset.editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    delete form.dataset.editingId;
  } else {
    await fetch('/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
  form.reset();
  loadExpenses();
});

async function loadExpenses() {
  const res = await fetch('/expenses');
  const expenses = await res.json();

  const filter = document.getElementById('categoryFilter').value.toLowerCase();
  const filtered = expenses.filter(e => e.category.toLowerCase().includes(filter));

  const list = document.getElementById('expenseList');
  list.innerHTML = '';
  filtered.forEach(exp => {
    const item = document.createElement('li');
    item.innerHTML = `
      ${exp.date}: ${exp.category} - ₹${exp.amount} (${exp.note})
      <button onclick="editExpense(${exp.id})">Edit</button>
      <button onclick="deleteExpense(${exp.id})">Delete</button>
    `;
    list.appendChild(item);
  });

  drawChart(filtered);
}

async function deleteExpense(id) {
  await fetch(`/expenses/${id}`, { method: 'DELETE' });
  loadExpenses();
}

async function editExpense(id) {
  const res = await fetch('/expenses');
  const expenses = await res.json();
  const exp = expenses.find(e => e.id === id);
  const form = document.getElementById('expenseForm');
  form.amount.value = exp.amount;
  form.category.value = exp.category;
  form.date.value = exp.date;
  form.note.value = exp.note;
  form.dataset.editingId = exp.id;
}

async function logout() {
  await fetch('/logout');
  window.location.href = '/index.html';
}

function drawChart(data) {
  const totals = {};
  data.forEach(e => {
    if (!totals[e.category]) totals[e.category] = 0;
    totals[e.category] += e.amount;
  });

  const ctx = document.getElementById('expenseChart').getContext('2d');
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(totals),
      datasets: [{
        label: 'Total ₹ per Category',
        data: Object.values(totals),
        backgroundColor: 'rgba(0, 123, 255, 0.5)'
      }]
    }
  });
}

loadExpenses();
