// ============================================================
// PROSECUTOR'S OFFICE — Government Saint Louis
// ============================================================

const SUPABASE_URL      = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let PROS_USER = sessionStorage.getItem('prosecutor_user') || '';
let PROS_HASH = sessionStorage.getItem('prosecutor_hash') || '';
let PROS_RANK = sessionStorage.getItem('prosecutor_rank') || '';
let PROS_NAME = sessionStorage.getItem('prosecutor_name') || '';

document.addEventListener('DOMContentLoaded', () => {
  const appForm = document.getElementById('prosecutor-application-form');
  if (appForm) appForm.addEventListener('submit', submitApplication);

  const sanctionForm = document.getElementById('prosecutor-sanction-form');
  if (sanctionForm) sanctionForm.addEventListener('submit', submitSanction);

  if (PROS_USER && PROS_HASH) showSanctionBox();
});

async function sha256(message) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getIp() {
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    return (await r.json()).ip;
  } catch (_) {
    return '—';
  }
}

// ============================================================
// TRAINEE APPLICATION
// ============================================================
async function submitApplication(e) {
  e.preventDefault();
  const msg = document.getElementById('application-message');
  const btn = e.target.querySelector('button[type="submit"]');

  const payload = {
    char_name:  document.getElementById('p-char-name').value.trim(),
    char_age:   parseInt(document.getElementById('p-char-age').value),
    vk_link:    document.getElementById('p-vk-tag').value.trim(),
    motivation: document.getElementById('p-motivation').value.trim(),
    experience: document.getElementById('p-experience').value.trim(),
    user_ip:    await getIp()
  };

  btn.disabled = true;
  btn.innerText = 'Отправка...';

  try {
    const { error } = await sbClient.from('prosecutor_applications').insert([payload]);
    if (error) throw error;

    if (msg) {
      msg.style.color = '#2ecc71';
      msg.innerText = 'Заявление успешно отправлено! Следите за статусом на странице «Статусы стажировки».';
    }
    e.target.reset();
  } catch (err) {
    console.error('Ошибка подачи заявления:', err);
    if (msg) {
      msg.style.color = '#e74c3c';
      msg.innerText = 'Не удалось отправить заявление. Попробуйте позже.';
    }
  } finally {
    btn.disabled = false;
    btn.innerText = 'Отправить заявление';
  }
}

// ============================================================
// PROSECUTOR LOGIN
// ============================================================
async function prosecutorLogin() {
  const login    = document.getElementById('pros-login').value.trim();
  const password = document.getElementById('pros-password').value;
  const errorBox = document.getElementById('prosecutor-login-error');

  if (!login || !password) { alert('Заполните логин и пароль!'); return; }

  try {
    const passHash = await sha256(password);
    const { data, error } = await sbClient.rpc('check_prosecutor_credentials', {
      p_login: login, p_password_hash: passHash
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    if (result && result.is_valid) {
      if (password.startsWith('ACTIVATE_')) {
        // Temporary password — force a real password to be set before granting access
        PENDING_PROS_USER = login;
        PENDING_PROS_HASH = passHash;
        document.getElementById('pros-password').value = '';
        if (errorBox) errorBox.style.display = 'none';
        hide('prosecutor-login-box');
        show('prosecutor-change-pass-box');
        return;
      }

      PROS_USER = login;
      PROS_HASH = passHash;
      PROS_RANK = result.rank;
      PROS_NAME = result.full_name || login;

      sessionStorage.setItem('prosecutor_user', PROS_USER);
      sessionStorage.setItem('prosecutor_hash', PROS_HASH);
      sessionStorage.setItem('prosecutor_rank', PROS_RANK);
      sessionStorage.setItem('prosecutor_name', PROS_NAME);

      if (errorBox) errorBox.style.display = 'none';
      document.getElementById('pros-password').value = '';
      showSanctionBox();
    } else {
      if (errorBox) errorBox.style.display = 'block';
    }
  } catch (err) {
    console.error('Ошибка входа прокурора:', err);
    alert('Ошибка запроса к базе данных.');
  }
}

// ============================================================
// FIRST-LOGIN PASSWORD CHANGE
// ============================================================
let PENDING_PROS_USER = '';
let PENDING_PROS_HASH = '';

async function prosecutorSetNewPassword() {
  const newPass = document.getElementById('pros-new-password').value;

  if (!newPass || newPass.length < 6) {
    alert('Пароль должен содержать не менее 6 символов!'); return;
  }
  if (newPass.startsWith('ACTIVATE_')) {
    alert('Постоянный пароль не должен начинаться с «ACTIVATE_»!'); return;
  }

  const newHash = await sha256(newPass);
  if (newHash === PENDING_PROS_HASH) {
    alert('Новый пароль совпадает с временным кодом — выберите другой!'); return;
  }

  try {
    const { data: success, error } = await sbClient.rpc('set_new_prosecutor_password', {
      p_login:             PENDING_PROS_USER,
      p_old_password_hash: PENDING_PROS_HASH,
      p_new_password_hash: newHash
    });
    if (error) throw error;

    if (success) {
      PROS_USER = PENDING_PROS_USER;
      PROS_HASH = newHash;

      // Fetch rank/name now that we're using the permanent password
      const { data: check } = await sbClient.rpc('check_prosecutor_credentials', {
        p_login: PROS_USER, p_password_hash: PROS_HASH
      });
      const result = Array.isArray(check) ? check[0] : check;
      PROS_RANK = result?.rank || '';
      PROS_NAME = result?.full_name || PROS_USER;

      sessionStorage.setItem('prosecutor_user', PROS_USER);
      sessionStorage.setItem('prosecutor_hash', PROS_HASH);
      sessionStorage.setItem('prosecutor_rank', PROS_RANK);
      sessionStorage.setItem('prosecutor_name', PROS_NAME);

      document.getElementById('pros-new-password').value = '';
      alert('Постоянный пароль успешно установлен!');
      hide('prosecutor-change-pass-box');
      showSanctionBox();
    } else {
      alert('Не удалось сменить пароль. Попробуйте снова.');
    }
  } catch (err) {
    console.error('Ошибка смены пароля:', err);
    alert('Ошибка сервера при смене пароля.');
  }
}

function showSanctionBox() {
  hide('prosecutor-login-box');
  show('prosecutor-sanction-box');
  const nameEl = document.getElementById('pros-name-display');
  const rankEl = document.getElementById('pros-rank-display');
  if (nameEl) nameEl.innerText = PROS_NAME;
  if (rankEl) rankEl.innerText = PROS_RANK;
}

function prosecutorLogout() {
  sessionStorage.removeItem('prosecutor_user');
  sessionStorage.removeItem('prosecutor_hash');
  sessionStorage.removeItem('prosecutor_rank');
  sessionStorage.removeItem('prosecutor_name');
  PROS_USER = PROS_HASH = PROS_RANK = PROS_NAME = '';
  hide('prosecutor-sanction-box');
  hide('prosecutor-change-pass-box');
  show('prosecutor-login-box');
}

// ============================================================
// SANCTION SUBMISSION
// ============================================================
async function submitSanction(e) {
  e.preventDefault();
  const msg = document.getElementById('sanction-message');
  const btn = e.target.querySelector('button[type="submit"]');

  if (!PROS_USER || !PROS_HASH) {
    alert('Сессия истекла, войдите заново.');
    prosecutorLogout();
    return;
  }

  const payload = {
    sender_login:      PROS_USER,
    sender_rank:        PROS_RANK,
    target_name:        document.getElementById('s-target-name').value.trim(),
    target_faction:     document.getElementById('s-target-faction').value.trim(),
    violation_details:  document.getElementById('s-violation').value.trim(),
    proposed_sanction:  document.getElementById('s-sanction').value.trim(),
    evidence_link:      document.getElementById('s-evidence').value.trim() || '—'
  };

  btn.disabled = true;
  btn.innerText = 'Отправка...';

  try {
    const { error } = await sbClient.from('prosecutor_sanctions').insert([payload]);
    if (error) throw error;

    if (msg) {
      msg.style.color = '#2ecc71';
      msg.innerText = 'Материал на санкцию отправлен на рассмотрение Главному прокурору.';
    }
    e.target.reset();
  } catch (err) {
    console.error('Ошибка подачи санкции:', err);
    if (msg) {
      msg.style.color = '#e74c3c';
      msg.innerText = 'Не удалось отправить материал. Попробуйте позже.';
    }
  } finally {
    btn.disabled = false;
    btn.innerText = 'Подать материал на санкцию';
  }
}

// ============================================================
// HELPERS
// ============================================================
function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
