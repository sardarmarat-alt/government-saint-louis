
const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4"; 

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', async () => {
  const loadingText = document.getElementById('loading');
  const table = document.getElementById('statements-table');
  const tbody = document.getElementById('statements-tbody');

  try {
    const { data: statements, error } = await sbClient
      .from('lawyer_statements')
      .select('created_at, char_name, char_age, status, admin_comment, checked_by')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!statements || statements.length === 0) {
      loadingText.innerText = "На данный момент заявлений нет.";
      return;
    }

    tbody.innerHTML = '';

    statements.forEach(item => {
      const tr = document.createElement('tr');
      
      const date = new Date(item.created_at);
      const formattedDate = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});

      let statusClass = 'status-waiting';
      if (item.status === 'Одобрено') statusClass = 'status-approved';
      if (item.status === 'Отклонено') statusClass = 'status-rejected';

      
      let responseText = '';
      
      if (item.checked_by && item.status !== 'На рассмотрении') {
        responseText += `(${item.checked_by}) `;
      }
      
      if (item.admin_comment) {
        responseText += item.admin_comment;
      } else if (item.status !== 'На рассмотрении' && !item.admin_comment) {
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

  } catch (err) {
    console.error('Ошибка при получении данных:', err);
    if (loadingText) {
      loadingText.style.color = '#f44336';
      loadingText.innerText = '❌ Не удалось загрузить список заявлений.';
    }
  }
});