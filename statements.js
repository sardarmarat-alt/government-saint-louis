const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ITEMS_PER_PAGE = 10;
let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  loadPage(currentPage);
});

async function loadPage(page) {
  currentPage = page;
  const loadingText         = document.getElementById('loading');
  const table               = document.getElementById('statements-table');
  const tbody               = document.getElementById('statements-tbody');
  const paginationContainer = document.getElementById('pagination');

  if (loadingText) {
    loadingText.style.display = 'block';
    loadingText.innerText = "Загрузка данных из базы...";
  }

  const from = (page - 1) * ITEMS_PER_PAGE;
  const to   = from + ITEMS_PER_PAGE - 1;

  try {
    const { data: statements, error, count } = await sbClient
      .from('lawyer_statements')
      .select('created_at, char_name, char_age, status, admin_comment, checked_by', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!statements || statements.length === 0) {
      if (loadingText) loadingText.innerText = "На данный момент заявлений нет.";
      if (table) table.style.display = 'none';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    tbody.innerHTML = '';

    statements.forEach(item => {
      const tr = document.createElement('tr');

      const date = new Date(item.created_at);
      const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      let statusClass = 'status-waiting';
      if (item.status === 'Одобрено')  statusClass = 'status-approved';
      if (item.status === 'Отклонено') statusClass = 'status-rejected';

      let responseText = '';
      if (item.checked_by && item.status !== 'На рассмотрении') {
        responseText += `(${item.checked_by}) `;
      }
      if (item.admin_comment) {
        responseText += item.admin_comment;
      } else if (item.status !== 'На рассмотрении') {
        responseText += '—';
      } else {
        responseText = '—';
      }

      tr.innerHTML = `
        <td>${formattedDate}</td>
        <td style="font-weight: bold;">${item.char_name}</td>
        <td>${item.char_age}</td>
        <td><span class="status-badge ${statusClass}">${item.status}</span></td>
        <td style="color: #ccc; font-style: italic;">${responseText}</td>
      `;
      tbody.appendChild(tr);
    });

    if (loadingText) loadingText.style.display = 'none';
    if (table) table.style.display = 'table';

    renderPagination(count);

  } catch (err) {
    console.error('Ошибка при получении данных:', err);
    if (loadingText) {
      loadingText.style.color = '#f44336';
      loadingText.innerText = '❌ Не удалось загрузить список заявлений.';
    }
  }
}

function renderPagination(totalItems) {
  const paginationContainer = document.getElementById('pagination');
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  if (totalPages <= 1) return;

  const btnStyle = (active) => `
    padding: 6px 12px;
    background: ${active ? '#C9A24B' : '#111'};
    color: ${active ? '#000' : '#C9A24B'};
    border: 1px solid #C9A24B;
    border-radius: 4px;
    cursor: pointer;
    font-weight: ${active ? 'bold' : 'normal'};
  `;

  const btnPrev = document.createElement('button');
  btnPrev.innerText = "« Назад";
  btnPrev.style.cssText = btnStyle(false);
  btnPrev.disabled = currentPage === 1;
  if (currentPage === 1) btnPrev.style.opacity = "0.4";
  btnPrev.onclick = () => { if (currentPage > 1) loadPage(currentPage - 1); };
  paginationContainer.appendChild(btnPrev);

  for (let i = 1; i <= totalPages; i++) {
    const btnPage = document.createElement('button');
    btnPage.innerText = i;
    btnPage.style.cssText = btnStyle(i === currentPage);
    btnPage.onclick = () => { loadPage(i); };
    paginationContainer.appendChild(btnPage);
  }

  const btnNext = document.createElement('button');
  btnNext.innerText = "Вперед »";
  btnNext.style.cssText = btnStyle(false);
  btnNext.disabled = currentPage === totalPages;
  if (currentPage === totalPages) btnNext.style.opacity = "0.4";
  btnNext.onclick = () => { if (currentPage < totalPages) loadPage(currentPage + 1); };
  paginationContainer.appendChild(btnNext);
}
