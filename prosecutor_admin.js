// ============================================================
// PROSECUTOR ADMIN PANEL — Government Saint Louis
// ============================================================

const SUPABASE_URL      = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

let sbClient = null;
let CURRENT_ADMIN_USER = sessionStorage.getItem('admin_user') || '';
let CURRENT_ADMIN_HASH = sessionStorage.getItem('admin_hash') || '';

// Только эти логины могут ПРИНИМАТЬ решения (одобрять/отклонять).
// !!! Замените 'HeadProsecutor_login' на реальный логин, когда заведёте его в admin_users.
// Это соответствует проверке внутри RPC-функций в базе данных —
// значения здесь и там должны совпадать.
const ALLOWED_DECISION_MAKERS = ['Marat_Sardar', 'HeadProsecutor_login'];

function initSupabase() {
  if (window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    alert("Критическая ошибка: библиотека Supabase не загрузилась.");
  }
}

async function sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  if (CURRENT_ADMIN_USER && CURRENT_ADMIN_HASH) {
    hide('loginOverlay');
    show('adminContent');
    afterLogin();
  }
});

// ============================================================
// LOGIN
// ============================================================
async function handleLogin() {
  if (!sbClient) initSupabase();

  const userInp  = document.getElementById('username').value.trim();
  const passInp  = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');

  if (!userInp || !passInp) { alert("Заполните все поля!"); return; }

  try {
    const passHash = await sha256(passInp);
    const { data: isValid, error } = await sbClient.rpc('check_admin_credentials', {
      p_login: userInp, p_password_hash: passHash
    });
    if (error) throw error;

    if (isValid === true) {
      CURRENT_ADMIN_USER = userInp;
      CURRENT_ADMIN_HASH = passHash;
      document.getElementById('password').value = '';

      if (passInp.startsWith('ACTIVATE_')) {
        hide('loginOverlay');
        show('changePassOverlay');
        return;
      }

      sessionStorage.setItem('admin_user', CURRENT_ADMIN_USER);
      sessionStorage.setItem('admin_hash', CURRENT_ADMIN_HASH);
      hide('loginOverlay');
      show('adminContent');
      if (errorMsg) errorMsg.style.display = 'none';
      afterLogin();
    } else {
      if (errorMsg) errorMsg.style.display = 'block';
    }
  } catch (err) {
    console.error('Ошибка авторизации:', err);
    alert('Ошибка запроса к базе данных.');
  }
}

// ============================================================
// FIRST-LOGIN PASSWORD CHANGE
// ============================================================
async function handlePasswordChange() {
  const newPass = document.getElementById('newPassword').value;

  if (!newPass || newPass.length < 6) {
    alert("Пароль должен содержать не менее 6 символов!"); return;
  }
  if (newPass.startsWith('ACTIVATE_')) {
    alert("Постоянный пароль не должен начинаться с «ACTIVATE_»!"); return;
  }

  const newHash = await sha256(newPass);
  if (newHash === CURRENT_ADMIN_HASH) {
    alert("Новый пароль совпадает с временным кодом — выберите другой!"); return;
  }

  try {
    const { data: success, error } = await sbClient.rpc('set_new_password', {
      p_login:             CURRENT_ADMIN_USER,
      p_old_password_hash: CURRENT_ADMIN_HASH,
      p_new_password_hash: newHash
    });
    if (error) throw error;

    if (success) {
      CURRENT_ADMIN_HASH = newHash;
      sessionStorage.setItem('admin_user', CURRENT_ADMIN_USER);
      sessionStorage.setItem('admin_hash', CURRENT_ADMIN_HASH);
      document.getElementById('newPassword').value = '';
      alert("Постоянный пароль успешно установлен!");
      hide('changePassOverlay');
      show('adminContent');
      afterLogin();
    } else {
      alert("Не удалось сменить пароль. Попробуйте снова.");
    }
  } catch (err) {
    console.error('Ошибка смены пароля:', err);
    alert('Ошибка сервера при смене пароля.');
  }
}

function afterLogin() {
  const notice = document.getElementById('accessNotice');
  const canDecide = ALLOWED_DECISION_MAKERS.includes(CURRENT_ADMIN_USER);
  if (notice) {
    notice.innerHTML = canDecide ? '' : `
      <div class="no-access">
        Вы вошли как <b>${CURRENT_ADMIN_USER}</b>. Вы можете просматривать заявления и материалы,
        но принимать решения (одобрять/отклонять) может только Главный прокурор или суперадминистратор.
      </div>`;
  }
  loadApplications();
  loadSanctions();
}

// ============================================================
// TABS
// ============================================================
function switchTab(tab) {
  document.getElementById('tab-applications').classList.toggle('active', tab === 'applications');
  document.getElementById('tab-sanctions').classList.toggle('active', tab === 'sanctions');
  document.getElementById('applications-panel').style.display = tab === 'applications' ? 'block' : 'none';
  document.getElementById('sanctions-panel').style.display     = tab === 'sanctions'    ? 'block' : 'none';
}

// ============================================================
// APPLICATIONS (TRAINEE)
// ============================================================
async function loadApplications() {
  const panel = document.getElementById('applications-panel');
  panel.innerHTML = '<p style="color:#888;">Загрузка...</p>';

  try {
    const { data, error } = await sbClient
      .from('prosecutor_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      panel.innerHTML = '<p style="color:#888;">Заявлений пока нет.</p>';
      return;
    }

    panel.innerHTML = '';
    data.forEach(app => panel.appendChild(renderApplicationCard(app)));
  } catch (err) {
    console.error('Ошибка загрузки заявлений:', err);
    panel.innerHTML = `<p style="color:#e74c3c;">Ошибка загрузки: ${err.message}</p>`;
  }
}

function renderApplicationCard(app) {
  const card = document.createElement('div');
  card.className = 'card';

  const badgeClass = app.status === 'Одобрено' ? 'badge-approved'
                    : app.status === 'Отклонено' ? 'badge-rejected' : 'badge-waiting';

  const date = new Date(app.created_at).toLocaleDateString('ru-RU') + ' ' +
               new Date(app.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const canDecide = ALLOWED_DECISION_MAKERS.includes(CURRENT_ADMIN_USER);

  card.innerHTML = `
    <div class="card-header">
      <div>
        <span style="font-size:17px; color:#C9A24B;"><b>${app.char_name}</b></span>
        <span style="color:#888; margin-left:10px;">Лет в штате: ${app.char_age}</span>
        <span style="color:#888; margin-left:10px;">VK: <a href="https://vk.com/${app.vk_link}" target="_blank" style="color:#5181b8;">${app.vk_link}</a></span>
      </div>
      <span class="badge ${badgeClass}">${app.status}</span>
    </div>
    <div class="field"><div class="field-label">Мотивация</div><div class="field-value">${app.motivation}</div></div>
    <div class="field"><div class="field-label">Опыт</div><div class="field-value">${app.experience}</div></div>
    <div class="field"><div class="field-label">Подано</div><div class="field-value">${date}</div></div>

    ${app.status !== 'На рассмотрении' ? `
      <div class="field" style="margin-top:10px;">
        <div class="field-label">Решение принял</div>
        <div class="field-value">${app.checked_by || '—'}</div>
      </div>
      ${app.admin_comment ? `<div class="field"><div class="field-label">Комментарий</div><div class="field-value">${app.admin_comment}</div></div>` : ''}
    ` : (canDecide ? `
      <input type="text" class="comment-input" id="app-comment-${app.id}" placeholder="Комментарий (необязательно)...">
      <div class="actions">
        <button class="btn-approve" onclick="decideApplication(${app.id}, 'Одобрено')">✅ Одобрить</button>
        <button class="btn-reject"  onclick="decideApplication(${app.id}, 'Отклонено')">❌ Отклонить</button>
      </div>
    ` : '')}
  `;
  return card;
}

async function decideApplication(id, newStatus) {
  const comment = document.getElementById(`app-comment-${id}`)?.value.trim() || '';
  try {
    const { data: success, error } = await sbClient.rpc('update_prosecutor_application_secure', {
      p_application_id: id,
      p_new_status:     newStatus,
      p_comment:        comment,
      p_admin_login:    CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_HASH
    });
    if (error) throw error;
    if (success) loadApplications();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

// ============================================================
// SANCTIONS
// ============================================================
async function loadSanctions() {
  const panel = document.getElementById('sanctions-panel');
  panel.innerHTML = '<p style="color:#888;">Загрузка...</p>';

  try {
    const { data, error } = await sbClient
      .from('prosecutor_sanctions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      panel.innerHTML = '<p style="color:#888;">Материалов пока нет.</p>';
      return;
    }

    panel.innerHTML = '';
    data.forEach(s => panel.appendChild(renderSanctionCard(s)));
  } catch (err) {
    console.error('Ошибка загрузки материалов:', err);
    panel.innerHTML = `<p style="color:#e74c3c;">Ошибка загрузки: ${err.message}</p>`;
  }
}

function renderSanctionCard(s) {
  const card = document.createElement('div');
  card.className = 'card';

  const badgeClass = s.status === 'Одобрено' ? 'badge-approved'
                    : s.status === 'Отклонено' ? 'badge-rejected' : 'badge-waiting';

  const date = new Date(s.created_at).toLocaleDateString('ru-RU') + ' ' +
               new Date(s.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  const canDecide = ALLOWED_DECISION_MAKERS.includes(CURRENT_ADMIN_USER);

  card.innerHTML = `
    <div class="card-header">
      <div>
        <span style="font-size:17px; color:#C9A24B;"><b>${s.target_name}</b></span>
        <span style="color:#888; margin-left:10px;">Структура: ${s.target_faction}</span>
      </div>
      <span class="badge ${badgeClass}">${s.status}</span>
    </div>
    <div class="field"><div class="field-label">Подал</div><div class="field-value">${s.sender_login} (${s.sender_rank})</div></div>
    <div class="field"><div class="field-label">Нарушение</div><div class="field-value">${s.violation_details}</div></div>
    <div class="field"><div class="field-label">Предлагаемая санкция</div><div class="field-value">${s.proposed_sanction}</div></div>
    <div class="field"><div class="field-label">Доказательства</div><div class="field-value">${
      s.evidence_link && s.evidence_link !== '—'
        ? `<a href="${s.evidence_link}" target="_blank" style="color:#3498db;">Открыть 🔗</a>`
        : '—'
    }</div></div>
    <div class="field"><div class="field-label">Подано</div><div class="field-value">${date}</div></div>

    ${s.status !== 'На рассмотрении' ? `
      <div class="field" style="margin-top:10px;">
        <div class="field-label">Решение принял</div>
        <div class="field-value">${s.checked_by || '—'}</div>
      </div>
      ${s.admin_comment ? `<div class="field"><div class="field-label">Комментарий</div><div class="field-value">${s.admin_comment}</div></div>` : ''}
    ` : (canDecide ? `
      <input type="text" class="comment-input" id="sanction-comment-${s.id}" placeholder="Комментарий (необязательно)...">
      <div class="actions">
        <button class="btn-approve" onclick="decideSanction(${s.id}, 'Одобрено')">✅ Одобрить</button>
        <button class="btn-reject"  onclick="decideSanction(${s.id}, 'Отклонено')">❌ Отклонить</button>
      </div>
    ` : '')}
  `;
  return card;
}

async function decideSanction(id, newStatus) {
  const comment = document.getElementById(`sanction-comment-${id}`)?.value.trim() || '';
  try {
    const { data: success, error } = await sbClient.rpc('update_prosecutor_sanction_secure', {
      p_sanction_id:    id,
      p_new_status:     newStatus,
      p_comment:        comment,
      p_admin_login:    CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_HASH
    });
    if (error) throw error;
    if (success) loadSanctions();
  } catch (err) {
    alert('Ошибка: ' + err.message);
  }
}

// ============================================================
// HELPERS
// ============================================================
function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
