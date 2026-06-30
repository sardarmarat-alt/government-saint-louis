// ============================================================
// EVENTS PAGE — State Coins Competition
// Government Saint Louis
// ============================================================

const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

let sbClient = null;

function initSupabase() {
  if (typeof supabase === 'undefined') { console.error("Supabase SDK не загружен!"); return; }
  if (!sbClient) sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

let CURRENT_LEADER_USER       = sessionStorage.getItem('leader_user')       || null;
let CURRENT_LEADER_HASH       = sessionStorage.getItem('leader_hash')       || null;
let CURRENT_LEADER_FACTION_ID = sessionStorage.getItem('leader_faction_id') || null;

// ============================================================
// PAGE INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  await loadFactionsRating();
  await loadDailyQuestion();
  checkLeaderSession();
});

// ============================================================
// 1. FACTION RATING
// ============================================================
async function loadFactionsRating() {
  try {
    const { data: factions, error } = await sbClient
      .from('factions')
      .select('*')
      .order('sc_balance', { ascending: false });
    if (error) throw error;

    const grid         = document.getElementById('factionsGrid');
    const selectWinner = document.getElementById('fightWinner');

    grid.innerHTML = '';
    if (selectWinner) selectWinner.innerHTML = '<option value="">-- Выберите организацию --</option>';

    factions.forEach((faction, index) => {
      const isTop = index === 0;
      const card  = document.createElement('div');
      card.className = `faction-card ${isTop ? 'top-1' : ''}`;
      card.innerHTML = `
        <div class="faction-name">${isTop ? '👑 ' : ''}${faction.name}</div>
        <div class="sc-amount">${Number(faction.sc_balance).toLocaleString()} SC</div>
      `;
      grid.appendChild(card);

      if (selectWinner) {
        const opt = document.createElement('option');
        opt.value       = faction.id;
        opt.textContent = faction.name;
        selectWinner.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('Ошибка загрузки рейтинга:', err);
  }
}

// ============================================================
// 2. DAILY QUESTION
// ============================================================
async function loadDailyQuestion() {
  try {
    const { data: questions, error } = await sbClient
      .from('daily_questions')
      .select('*')
      .eq('is_active', true)
      .limit(1);
    if (error) throw error;

    const qText = document.getElementById('questionText');
    if (questions && questions.length > 0) {
      const q = questions[0];
      qText.innerHTML = `<strong>Вопрос:</strong> ${q.question_text}<br>
        <small style="color:#00ffcc;">Награда: ${q.reward} SC</small>`;
      qText.dataset.qId    = q.id;
      qText.dataset.reward = q.reward;
    } else {
      qText.textContent = "В данный момент нет активных вопросов. Ожидайте обновления от администрации.";
    }
  } catch (err) {
    console.error('Ошибка загрузки вопроса дня:', err);
  }
}

// ============================================================
// 3. BALANCE HISTORY WITH PAGINATION
// ============================================================
let isHistoryLoaded  = false;
let allHistory       = [];   // full dataset stored in memory
const ROWS_PER_PAGE  = 15;   // rows visible per page
let currentPage      = 1;

async function toggleHistoryZone() {
  const section = document.getElementById('historySection');
  const btn     = document.getElementById('toggleHistoryBtn');
  if (!section || !btn) return;

  const isVisible = section.style.display === 'block';
  section.style.display = isVisible ? 'none' : 'block';
  btn.innerText = isVisible ? 'Подробная информация про баланс' : 'Скрыть подробную информацию';

  if (!isVisible && !isHistoryLoaded) await loadBalanceHistory();
}

async function loadBalanceHistory() {
  try {
    const { data: history, error } = await sbClient
      .from('balance_history')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    allHistory      = history || [];
    isHistoryLoaded = true;
    currentPage     = 1;

    renderHistoryPage();
    renderPagination();
  } catch (err) {
    console.error('Ошибка загрузки истории:', err);
  }
}

function renderHistoryPage() {
  const tbody = document.getElementById('historyTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (allHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">История транзакций пуста.</td></tr>';
    return;
  }

  const start = (currentPage - 1) * ROWS_PER_PAGE;
  const end   = start + ROWS_PER_PAGE;
  const slice = allHistory.slice(start, end);

  slice.forEach(row => {
    const tr          = document.createElement('tr');
    const date        = new Date(row.created_at).toLocaleString('ru-RU');
    const isPos       = row.amount_change > 0;
    const amountColor = isPos ? '#10b981' : (row.amount_change < 0 ? '#ef4444' : '#94a3b8');
    const amountText  = isPos
      ? `+${Number(row.amount_change).toLocaleString()}`
      : Number(row.amount_change).toLocaleString();

    tr.innerHTML = `
      <td>${date}</td>
      <td><b>${row.fraction_name}</b></td>
      <td><span style="color:#38bdf8;">${row.action_type}</span></td>
      <td style="color:${amountColor}; font-weight:bold;">${amountText} SC</td>
      <td style="color:#94a3b8;">${row.description || ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPagination() {
  // Create or find the pagination container 
  let pag = document.getElementById('historyPagination');
  if (!pag) {
    pag = document.createElement('div');
    pag.id = 'historyPagination';
    pag.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      padding: 16px 0 8px;
      flex-wrap: wrap;
    `;
    
    const tbody = document.getElementById('historyTbody');
    if (tbody) {
      const table = tbody.closest('table');
      if (table && table.parentNode) {
        table.parentNode.insertBefore(pag, table.nextSibling);
      }
    }
  }

  const totalPages = Math.ceil(allHistory.length / ROWS_PER_PAGE);
  pag.innerHTML = '';

  if (totalPages <= 1) return; 

  const btnStyle = (active) => `
    background: ${active ? '#C9A24B' : '#1e293b'};
    color: ${active ? '#0f1117' : '#94a3b8'};
    border: 1px solid ${active ? '#C9A24B' : '#334155'};
    padding: 6px 12px;
    border-radius: 4px;
    cursor: ${active ? 'default' : 'pointer'};
    font-weight: ${active ? 'bold' : 'normal'};
    font-size: 13px;
    min-width: 36px;
    transition: background 0.15s;
  `;

  // ← Prev button
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '←';
  prevBtn.style.cssText = btnStyle(false);
  prevBtn.disabled = currentPage === 1;
  if (currentPage === 1) prevBtn.style.opacity = '0.4';
  prevBtn.onclick = () => { currentPage--; renderHistoryPage(); renderPagination(); scrollToHistory(); };
  pag.appendChild(prevBtn);

  // Page number buttons — show a sliding window of up to 5 pages
  const windowSize = 5;
  let startPage = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let endPage   = Math.min(totalPages, startPage + windowSize - 1);
  if (endPage - startPage < windowSize - 1) startPage = Math.max(1, endPage - windowSize + 1);

  if (startPage > 1) {
    pag.appendChild(makePageBtn(1, btnStyle));
    if (startPage > 2) pag.appendChild(makeEllipsis());
  }

  for (let p = startPage; p <= endPage; p++) {
    pag.appendChild(makePageBtn(p, btnStyle));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pag.appendChild(makeEllipsis());
    pag.appendChild(makePageBtn(totalPages, btnStyle));
  }

  // → Next button
  const nextBtn = document.createElement('button');
  nextBtn.textContent = '→';
  nextBtn.style.cssText = btnStyle(false);
  nextBtn.disabled = currentPage === totalPages;
  if (currentPage === totalPages) nextBtn.style.opacity = '0.4';
  nextBtn.onclick = () => { currentPage++; renderHistoryPage(); renderPagination(); scrollToHistory(); };
  pag.appendChild(nextBtn);

  // Page counter label
  const label = document.createElement('span');
  label.style.cssText = 'color:#64748b; font-size:12px; margin-left:8px;';
  label.textContent = `Страница ${currentPage} из ${totalPages} (${allHistory.length} записей)`;
  pag.appendChild(label);
}

function makePageBtn(p, btnStyle) {
  const btn = document.createElement('button');
  btn.textContent = p;
  btn.style.cssText = btnStyle(p === currentPage);
  btn.disabled = p === currentPage;
  btn.onclick = () => { currentPage = p; renderHistoryPage(); renderPagination(); scrollToHistory(); };
  return btn;
}

function makeEllipsis() {
  const span = document.createElement('span');
  span.textContent = '…';
  span.style.cssText = 'color:#475569; padding: 0 4px; font-size:14px;';
  return span;
}

function scrollToHistory() {
  const section = document.getElementById('historySection');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================================
// 4. LEADER AUTH
// ============================================================
function checkLeaderSession() {
  if (!CURRENT_LEADER_USER || !CURRENT_LEADER_HASH) return;

  document.getElementById('leaderAuthBtn').style.display    = 'none';
  document.getElementById('leaderLogoutBtn').style.display  = 'block';
  document.getElementById('leaderPanel').style.display      = 'block';
  document.getElementById('leaderAnswerZone').style.display = 'flex';

  if (sessionStorage.getItem('leader_is_temp') === 'true') {
    document.getElementById('changePassModal').style.display = 'flex';
  }
}

async function handleLeaderLogin() {
  const login = document.getElementById('leaderLogin').value.trim();
  const pass  = document.getElementById('leaderPass').value;

  if (!login || !pass) { alert("Заполните все поля!"); return; }

  try {
    const inputHash = await sha256(pass);

    const { data: isValid, error } = await sbClient.rpc('check_leader_credentials', {
      p_login: login, p_password_hash: inputHash
    });
    if (error) { alert("Ошибка базы данных при проверке учётных данных."); return; }
    if (!isValid) { alert("Неверный логин или пароль."); return; }

    const { data: userData, error: uErr } = await sbClient
      .from('leader_users')
      .select('faction_id')
      .eq('username', login)
      .single();
    if (uErr) { alert("Ошибка получения данных фракции."); return; }

    CURRENT_LEADER_USER       = login;
    CURRENT_LEADER_HASH       = inputHash;
    CURRENT_LEADER_FACTION_ID = userData.faction_id;

    sessionStorage.setItem('leader_user',       CURRENT_LEADER_USER);
    sessionStorage.setItem('leader_hash',       CURRENT_LEADER_HASH);
    sessionStorage.setItem('leader_faction_id', CURRENT_LEADER_FACTION_ID);

    if (pass.startsWith('ACTIVATE_')) sessionStorage.setItem('leader_is_temp', 'true');

    toggleAuthModal(false);
    checkLeaderSession();
  } catch (err) {
    alert("Сбой авторизации. Попробуйте ещё раз.");
  }
}

async function saveNewLeaderPassword() {
  const newPass = document.getElementById('newLeaderPassword').value;
  if (!newPass || newPass.length < 6) { alert("Пароль должен содержать не менее 6 символов!"); return; }
  if (newPass.startsWith('ACTIVATE_')) { alert("Постоянный пароль не должен начинаться с «ACTIVATE_»!"); return; }

  try {
    const newHash = await sha256(newPass);
    if (newHash === CURRENT_LEADER_HASH) { alert("Новый пароль совпадает с временным кодом — выберите другой!"); return; }

    const { data: success, error } = await sbClient.rpc('set_new_leader_password', {
      p_login:             CURRENT_LEADER_USER,
      p_old_password_hash: CURRENT_LEADER_HASH,
      p_new_password_hash: newHash
    });
    if (error) throw error;

    if (success) {
      CURRENT_LEADER_HASH = newHash;
      sessionStorage.setItem('leader_hash', CURRENT_LEADER_HASH);
      sessionStorage.removeItem('leader_is_temp');
      document.getElementById('changePassModal').style.display = 'none';
      alert("Пароль успешно обновлён!");
    } else {
      alert("Не удалось сменить пароль.");
    }
  } catch (err) {
    alert("Ошибка сохранения пароля.");
  }
}

function handleLeaderLogout() {
  sessionStorage.removeItem('leader_user');
  sessionStorage.removeItem('leader_hash');
  sessionStorage.removeItem('leader_faction_id');
  sessionStorage.removeItem('leader_is_temp');
  location.reload();
}

// ============================================================
// 5. SUBMIT REPORTS
// ============================================================

// A. Межфракционный бой
async function submitFightReport() {
  if (!CURRENT_LEADER_USER) { alert("Необходима авторизация."); return; }

  const details  = document.getElementById('fightDetails').value.trim();
  const fund     = parseInt(document.getElementById('fightFund').value);
  const winnerId = parseInt(document.getElementById('fightWinner').value);
  const evidence = document.getElementById('fightEvidence').value.trim();

  if (!details || !evidence || !winnerId) { alert("Заполните все обязательные поля."); return; }

  try {
    const { error } = await sbClient.from('sc_proposals').insert({
      sender_login:      CURRENT_LEADER_USER,
      faction_id:        parseInt(CURRENT_LEADER_FACTION_ID),
      type:              'МФ_Бой',
      details:           details,
      fund:              fund,
      winner_faction_id: winnerId,
      evidence_link:     evidence,
      status:            'На рассмотрении'
    });
    if (error) throw error;
    alert("Отчёт о бое успешно направлен на рассмотрение администрации.");
    document.getElementById('fightForm').reset();
  } catch (err) {
    alert("Ошибка отправки отчёта: " + err.message);
  }
}

// B. Государственное задание
async function submitTaskReport() {
  if (!CURRENT_LEADER_USER) { alert("Необходима авторизация."); return; }

  const details  = document.getElementById('taskDetails').value.trim();
  const evidence = document.getElementById('taskEvidence').value.trim();

  if (!details || !evidence) { alert("Заполните все поля."); return; }

  try {
    const { error } = await sbClient.from('sc_proposals').insert({
      sender_login:  CURRENT_LEADER_USER,
      faction_id:    parseInt(CURRENT_LEADER_FACTION_ID),
      type:          'Задание',
      details:       details,
      fund:          0,
      evidence_link: evidence,
      status:        'На рассмотрении'
    });
    if (error) throw error;
    alert("Отчёт о выполненном задании успешно направлен на рассмотрение администрации.");
    document.getElementById('taskForm').reset();
  } catch (err) {
    alert("Ошибка отправки: " + err.message);
  }
}

// C. Ответ на вопрос дня
async function submitDailyAnswer() {
  if (!CURRENT_LEADER_USER) { alert("Необходима авторизация."); return; }

  const answer  = document.getElementById('leaderAnswerInput').value.trim();
  const qElem   = document.getElementById('questionText');
  const qId     = qElem.dataset.qId;
  const qReward = parseInt(qElem.dataset.reward) || 2500;

  if (!answer) { alert("Введите ответ!"); return; }
  if (!qId)    { alert("Активный вопрос не найден."); return; }

  try {
    const { error } = await sbClient.from('sc_proposals').insert({
      sender_login:  CURRENT_LEADER_USER,
      faction_id:    parseInt(CURRENT_LEADER_FACTION_ID),
      type:          'Викторина',
      details:       `Ответ на вопрос #${qId}: "${answer}"`,
      fund:          qReward,
      evidence_link: '—',
      status:        'На рассмотрении'
    });
    if (error) throw error;
    alert("Ваш ответ принят и направлен на проверку администрации.");
    document.getElementById('leaderAnswerInput').value = '';
  } catch (err) {
    alert("Ошибка отправки ответа: " + err.message);
  }
}