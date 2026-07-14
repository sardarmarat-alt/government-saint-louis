const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// SECURITY: escape untrusted data before it goes into innerHTML.
// This is a PUBLIC page — full_name/vk_link trace back to public
// application form submissions.
// ============================================================
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

const RANK_ORDER = [
  'Главный прокурор',
  'Заместитель главного прокурора',
  'Старший прокурор',
  'Прокурор',
  'Стажёр'
];
const RANK_CLASS = {
  'Главный прокурор':                'rank-head',
  'Заместитель главного прокурора':  'rank-vice',
  'Старший прокурор':                'rank-senior',
  'Прокурор':                        'rank-prosecutor',
  'Стажёр':                          'rank-trainee'
};

document.addEventListener('DOMContentLoaded', async () => {
  loadStaff();
});

async function loadStaff() {
  const loadingText = document.getElementById('loading');
  const table        = document.getElementById('staff-table');
  const tbody         = document.getElementById('staff-tbody');

  try {
    const { data: staff, error } = await sbClient
      .from('prosecutor_staff')
      .select('full_name, vk_link, rank, added_at');

    if (error) throw error;

    if (!staff || staff.length === 0) {
      if (loadingText) loadingText.innerText = "На данный момент состав пуст.";
      if (table) table.style.display = 'none';
      return;
    }

    staff.sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

    tbody.innerHTML = '';

    staff.forEach(item => {
      const tr = document.createElement('tr');
      const rankClass = RANK_CLASS[item.rank] || 'rank-trainee';
      const formattedDate = new Date(item.added_at).toLocaleDateString('ru-RU');

      tr.innerHTML = `
        <td style="font-weight: bold;">${escapeHtml(item.full_name)}</td>
        <td>${item.vk_link ? `<a href="https://vk.com/${escapeHtml(item.vk_link)}" target="_blank" class="vk-link-btn">VK</a>` : '—'}</td>
        <td><span class="rank-badge ${rankClass}">${escapeHtml(item.rank)}</span></td>
        <td>${formattedDate}</td>
      `;
      tbody.appendChild(tr);
    });

    if (loadingText) loadingText.style.display = 'none';
    if (table) table.style.display = 'table';

  } catch (err) {
    console.error('Ошибка при получении данных:', err);
    if (loadingText) {
      loadingText.style.color = '#f44336';
      loadingText.innerText = '❌ Не удалось загрузить состав прокуратуры.';
    }
  }
}