
const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co"; //[cite: 5]
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4"; //[cite: 5]

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); //[cite: 5]

const ITEMS_PER_PAGE = 10; // Сколько заявлений показывать на одной странице
let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  // Загружаем первую страницу при старте
  loadPage(currentPage);
});

async function loadPage(page) {
  currentPage = page;
  const loadingText = document.getElementById('loading'); //[cite: 5]
  const table = document.getElementById('statements-table'); //[cite: 5]
  const tbody = document.getElementById('statements-tbody'); //[cite: 5]
  const paginationContainer = document.getElementById('pagination');

  if (loadingText) {
    loadingText.style.display = 'block';
    loadingText.innerText = "Загрузка данных из базы...";
  }

  // Вычисляем границы для SQL-запроса (индексация начинается с 0)
  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  try {
    // count: 'exact' позволяет узнать общее число строк в базе для расчета страниц
    const { data: statements, error, count } = await sbClient
      .from('lawyer_statements')
      .select('created_at, char_name, char_age, status, admin_comment, checked_by', { count: 'exact' }) //[cite: 5]
      .order('created_at', { ascending: false }) //[cite: 5]
      .range(from, to); // Запрашиваем только нужный диапазон строк!

    if (error) throw error; //[cite: 5]

    if (!statements || statements.length === 0) {
      if (loadingText) loadingText.innerText = "На данный момент заявлений нет."; //[cite: 5]
      if (table) table.style.display = 'none';
      if (paginationContainer) paginationContainer.innerHTML = '';
      return;
    }

    tbody.innerHTML = ''; //[cite: 5]

    // Отрисовка строк таблицы
    statements.forEach(item => { //[cite: 5]
      const tr = document.createElement('tr'); //[cite: 5]
      
      const date = new Date(item.created_at); //[cite: 5]
      const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}); //[cite: 5]

      let statusClass = 'status-waiting'; //[cite: 5]
      if (item.status === 'Одобрено') statusClass = 'status-approved'; //[cite: 5]
      if (item.status === 'Отклонено') statusClass = 'status-rejected'; //[cite: 5]

      let responseText = ''; //[cite: 5]
      if (item.checked_by && item.status !== 'На рассмотрении') { //[cite: 5]
        responseText += `(${item.checked_by}) `; //[cite: 5]
      }
      if (item.admin_comment) { //[cite: 5]
        responseText += item.admin_comment; //[cite: 5]
      } else if (item.status !== 'На рассмотрении' && !item.admin_comment) { //[cite: 5]
        responseText += '—'; //[cite: 5]
      } else {
        responseText = '—'; //[cite: 5]
      }

      tr.innerHTML = `
        <td>${formattedDate}</td>
        <td style="font-weight: bold;">${item.char_name}</td>
        <td>${item.char_age}</td>
        <td><span class="status-badge ${statusClass}">${item.status}</span></td>
        <td style="color: #ccc; font-style: italic;">${responseText}</td>
      `; //[cite: 5]
      tbody.appendChild(tr); //[cite: 5]
    });

    if (loadingText) loadingText.style.display = 'none'; //[cite: 5]
    if (table) table.style.display = 'table'; //[cite: 5]

    // РЕНДЕР КНОПОК ПАГИНАЦИИ
    renderPagination(count);

  } catch (err) {
    console.error('Ошибка при получении данных:', err); //[cite: 5]
    if (loadingText) {
      loadingText.style.color = '#f44336'; //[cite: 5]
      loadingText.innerText = '❌ Не удалось загрузить список заявлений.'; //[cite: 5]
    }
  }
}

// Функция генерации кнопок переключения страниц
function renderPagination(totalItems) {
  const paginationContainer = document.getElementById('pagination');
  paginationContainer.innerHTML = '';

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  // Если все заявления умещаются на 1 страницу, кнопки не показываем
  if (totalPages <= 1) return;

  // Кнопка «Назад»
  const btnPrev = document.createElement('button');
  btnPrev.innerText = "« Назад";
  btnPrev.style.padding = "6px 12px";
  btnPrev.style.background = "#111";
  btnPrev.style.border = "1px solid #C9A24B";
  btnPrev.style.color = "#C9A24B";
  btnPrev.style.cursor = "pointer";
  btnPrev.style.borderRadius = "4px";
  btnPrev.disabled = currentPage === 1;
  if (currentPage === 1) btnPrev.style.opacity = "0.4";
  btnPrev.onclick = () => { if (currentPage > 1) loadPage(currentPage - 1); };
  paginationContainer.appendChild(btnPrev);

  // Цифровые кнопки страниц
  for (let i = 1; i <= totalPages; i++) {
    const btnPage = document.createElement('button');
    btnPage.innerText = i;
    btnPage.style.padding = "6px 12px";
    btnPage.style.border = "1px solid #C9A24B";
    btnPage.style.borderRadius = "4px";
    btnPage.style.cursor = "pointer";

    if (i === currentPage) {
      // Стили для активной страницы
      btnPage.style.background = "#C9A24B";
      btnPage.style.color = "#000";
      btnPage.style.fontWeight = "bold";
    } else {
      // Стили для обычных страниц
      btnPage.style.background = "#111";
      btnPage.style.color = "#C9A24B";
    }

    btnPage.onclick = () => { loadPage(i); };
    paginationContainer.appendChild(btnPage);
  }

  // Кнопка «Вперед»
  const btnNext = document.createElement('button');
  btnNext.innerText = "Вперед »";
  btnNext.style.padding = "6px 12px";
  btnNext.style.background = "#111";
  btnNext.style.border = "1px solid #C9A24B";
  btnNext.style.color = "#C9A24B";
  btnNext.style.cursor = "pointer";
  btnNext.style.borderRadius = "4px";
  btnNext.disabled = currentPage === totalPages;
  if (currentPage === totalPages) btnNext.style.opacity = "0.4";
  btnNext.onclick = () => { if (currentPage < totalPages) loadPage(currentPage + 1); };
  paginationContainer.appendChild(btnNext);
}