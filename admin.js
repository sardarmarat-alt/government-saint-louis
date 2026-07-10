// ============================================================
// ADMIN PANEL — Government Saint Louis
// ============================================================

const SUPABASE_URL      = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

let sbClient = null;
let CURRENT_ADMIN_USER = sessionStorage.getItem('admin_user') || '';
let CURRENT_ADMIN_HASH = sessionStorage.getItem('admin_hash') || '';
const HEAD_ADMIN = 'Marat_Sardar';

// ============================================================
// INIT
// ============================================================
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

// ============================================================
// SECURITY: escape untrusted data before it goes into innerHTML.
// Every field below comes from a public submission form (lawyer
// applications, SC proposals) that anyone can fill in — without
// this, a malicious applicant could plant a script in char_name,
// biography, details, etc. and have it execute in the admin's
// browser the next time this panel is opened.
// ============================================================
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  checkExistingSession();
});

function checkExistingSession() {
  if (!CURRENT_ADMIN_USER || !CURRENT_ADMIN_HASH) return;
  hide('loginOverlay');
  show('adminContent');
  applyRoleVisibility();
  loadAdminCards();
  if (CURRENT_ADMIN_USER === HEAD_ADMIN) loadLeaderProposals();
}

function applyRoleVisibility() {
  const scSection = document.getElementById('scAdminSection');
  if (scSection && CURRENT_ADMIN_USER !== HEAD_ADMIN) scSection.remove();
}

// ============================================================
// LOGIN
// ============================================================
async function handleLogin() {
  if (!sbClient) initSupabase();

  const userInp  = document.getElementById('username').value.trim();
  const passInp  = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  const loginBtn = document.querySelector('#loginOverlay .login-box button');

  if (!userInp || !passInp) { alert("Заполните все поля!"); return; }

  setBtn(loginBtn, "Проверка...", true);

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
      } else {
        sessionStorage.setItem('admin_user', CURRENT_ADMIN_USER);
        sessionStorage.setItem('admin_hash', CURRENT_ADMIN_HASH);
        hide('loginOverlay');
        show('adminContent');
        if (errorMsg) errorMsg.style.display = 'none';
        applyRoleVisibility();
        loadAdminCards();
        if (CURRENT_ADMIN_USER === HEAD_ADMIN) loadLeaderProposals();
      }
    } else {
      if (errorMsg) errorMsg.style.display = 'block';
      setBtn(loginBtn, "Войти в систему", false);
    }
  } catch (err) {
    console.error('Ошибка авторизации:', err);
    alert('Ошибка запроса к базе данных.');
    setBtn(loginBtn, "Войти в систему", false);
  }
}

// ============================================================
// FIRST-LOGIN PASSWORD CHANGE
// ============================================================
async function handlePasswordChange() {
  if (!sbClient) initSupabase();

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
      applyRoleVisibility();
      loadAdminCards();
      if (CURRENT_ADMIN_USER === HEAD_ADMIN) loadLeaderProposals();
    } else {
      alert("Не удалось сменить пароль. Попробуйте снова.");
    }
  } catch (err) {
    console.error('Ошибка смены пароля:', err);
    alert('Ошибка сервера при смене пароля.');
  }
}

// ============================================================
// LAWYER APPLICATIONS
// ============================================================
let ALL_STATEMENTS      = [];
let STATEMENTS_PAGE     = 1;
const STATEMENTS_PAGE_SIZE = 5;

async function loadAdminCards() {
  if (!sbClient) initSupabase();

  const loadingText = document.getElementById('admin-loading');
  const container   = document.getElementById('cards-container');
  if (container) container.innerHTML = '';

  try {
    const { data: statements, error } = await sbClient
      .from('lawyer_statements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    if (loadingText) loadingText.style.display = 'none';

    ALL_STATEMENTS = statements || [];
    STATEMENTS_PAGE = 1;
    renderStatementsPage();
  } catch (err) {
    console.error('Ошибка загрузки заявлений:', err);
    if (loadingText) { loadingText.style.color = '#e74c3c'; loadingText.innerText = 'Ошибка загрузки данных.'; }
  }
}

// Renders only the current page's slice of ALL_STATEMENTS into #cards-container,
// and draws the page-number controls into #lawyersPagination.
function renderStatementsPage() {
  const container    = document.getElementById('cards-container');
  const paginationEl = document.getElementById('lawyersPagination');
  if (!container) return;
  container.innerHTML = '';

  if (ALL_STATEMENTS.length === 0) {
    container.innerHTML = '<p style="color:#888; text-align:center;">Заявлений пока нет.</p>';
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(ALL_STATEMENTS.length / STATEMENTS_PAGE_SIZE));
  if (STATEMENTS_PAGE > totalPages) STATEMENTS_PAGE = totalPages;

  const start = (STATEMENTS_PAGE - 1) * STATEMENTS_PAGE_SIZE;
  const pageItems = ALL_STATEMENTS.slice(start, start + STATEMENTS_PAGE_SIZE);

  pageItems.forEach(st => container.appendChild(buildStatementCard(st)));

  renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
  const el = document.getElementById('lawyersPagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${STATEMENTS_PAGE === 1 ? 'disabled' : ''} onclick="goToStatementsPage(${STATEMENTS_PAGE - 1})">← Пред.</button>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="page-btn ${p === STATEMENTS_PAGE ? 'active' : ''}" onclick="goToStatementsPage(${p})">${p}</button>`;
  }
  html += `<button class="page-btn" ${STATEMENTS_PAGE === totalPages ? 'disabled' : ''} onclick="goToStatementsPage(${STATEMENTS_PAGE + 1})">След. →</button>`;
  el.innerHTML = html;
}

function goToStatementsPage(p) {
  STATEMENTS_PAGE = p;
  renderStatementsPage();
  document.getElementById('cards-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Builds a single lawyer-application card as a DOM element (extracted so the
// paginator can render just one page's worth without duplicating this logic).
function buildStatementCard(st) {
  const card = document.createElement('div');
  let borderClass = 'border-waiting';
  let statusColor = '#f39c12';
  if (st.status === 'Одобрено')  { borderClass = 'border-approved'; statusColor = '#2ecc71'; }
  if (st.status === 'Отклонено') { borderClass = 'border-rejected'; statusColor = '#e74c3c'; }

  card.className = `statement-card ${borderClass}`;

      const date = new Date(st.created_at).toLocaleDateString('ru-RU') + ' ' +
                   new Date(st.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="card-header">
          <div class="candidate-info">
            <span style="font-size:18px; color:#C9A24B;"><b>${escapeHtml(st.char_name)}</b></span>
            <span>Лет в штате: <b>${escapeHtml(st.char_age)}</b></span>
            <span>VK: <a href="https://vk.com/${escapeHtml(st.vk_link)}" target="_blank" style="color:#5181b8;">${escapeHtml(st.vk_link)}</a></span>
            <br><span style="font-size:11px; color:#666; margin-top:5px; display:block;">IP: <b>${escapeHtml(st.user_ip || '—')}</b></span>
          </div>
          <div style="font-size:13px; color:#888;">Подано: ${date}</div>
        </div>

        <div class="question-block">
          <div class="question-title">Биография и опыт:</div>
          <div class="answer-text">${escapeHtml(st.biography)}</div>
        </div>
        <div class="question-block">
          <div class="question-title">Что такое ООП и где регламентируется:</div>
          <div class="answer-text">${escapeHtml(st.about_oop)}</div>
        </div>
        <div class="question-block">
          <div class="question-title">Статьи, за которые присваивается ООП:</div>
          <div class="answer-text">${escapeHtml(st.what_oop)}</div>
        </div>
        <div class="question-block">
          <div class="question-title">Порядок проверки заключённого:</div>
          <div class="answer-text">${escapeHtml(st.oop_order)}</div>
        </div>

        ${st.admin_comment ? `
          <div style="margin-top:10px; font-style:italic; color:#aaa; background:#111; padding:10px; border-radius:4px;">
            <strong>Комментарий (${escapeHtml(st.checked_by || 'Администрация')}):</strong> ${escapeHtml(st.admin_comment)}
          </div>` : ''}

        <div class="admin-actions" id="actions-${st.id}">
          ${st.status === 'На рассмотрении' ? `
            <input type="text" class="comment-input" id="comment-${st.id}" placeholder="Комментарий к решению (необязательно)...">
            <button class="btn-approve" onclick="confirmApplicationDecision(${st.id}, 'Одобрено', '${escapeAttr(st.char_name)}')">✅ Одобрить</button>
            <button class="btn-reject"  onclick="confirmApplicationDecision(${st.id}, 'Отклонено', '${escapeAttr(st.char_name)}')">❌ Отклонить</button>
          ` : `
            <div style="color:#aaa;">Решение: <span style="color:${statusColor}; font-weight:bold;">${escapeHtml(st.status)}</span></div>
            <div style="margin-left:20px; color:#888;">Ответственный: <b style="color:#fff;">${escapeHtml(st.checked_by || '—')}</b></div>
            <div style="margin-left:20px; color:#888;">Комментарий: <i>${escapeHtml(st.admin_comment || 'отсутствует')}</i></div>
          `}
        </div>

        ${st.status === 'Одобрено' ? renderInterviewBlock(st) : ''}
      `;
  return card;
}

// ============================================================
// CONFIRMATION MODAL — used before any decision that can't be
// undone from the panel itself (approve/reject application,
// interview outcome). Prevents accidental clicks like the one
// that required a manual DB fix.
// ============================================================
let _confirmResolve = null;

function showConfirm(message) {
  return new Promise((resolve) => {
    const msgEl = document.getElementById('confirmMessage');
    if (msgEl) msgEl.innerText = message;
    const overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.style.display = 'flex';
    _confirmResolve = resolve;
  });
}

function confirmYes() {
  hide('confirmOverlay');
  if (_confirmResolve) { _confirmResolve(true); _confirmResolve = null; }
}

function confirmNo() {
  hide('confirmOverlay');
  if (_confirmResolve) { _confirmResolve(false); _confirmResolve = null; }
}

// Safely embeds a value inside onclick="...('VALUE')" — i.e. a single-quoted
// JS string literal that itself sits inside a double-quoted HTML attribute.
// Two passes, in order:
//   1. JS-escape backslashes/single-quotes so the value can't break out of
//      the '...' JS string once the browser HTML-decodes the attribute.
//   2. HTML-escape the result so it can't break out of the ="..." attribute
//      itself (e.g. a stray " in char_name closing the attribute early).
function escapeAttr(str) {
  const jsEscaped = String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return jsEscaped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function confirmApplicationDecision(id, newStatus, candidateName) {
  const verb = newStatus === 'Одобрено' ? 'ОДОБРИТЬ' : 'ОТКЛОНИТЬ';
  const ok = await showConfirm(
    `Вы уверены, что хотите ${verb} анкету кандидата «${candidateName}»?\n\n` +
    `После этого кнопки решения исчезнут — изменить статус через панель будет нельзя, ` +
    `только вручную через базу данных.`
  );
  if (!ok) return;
  processStatus(id, newStatus);
}

async function confirmInterviewDecision(id, newStatus, candidateName) {
  const verb = newStatus === 'Принят' ? 'ПРИНЯТЬ' : 'ОТКАЗАТЬ';
  const ok = await showConfirm(
    `Вы уверены, что хотите ${verb} кандидата «${candidateName}» по итогам собеседования?\n\n` +
    `Это решение будет зафиксировано окончательно — отменить его через панель нельзя, ` +
    `только вручную через базу данных.`
  );
  if (!ok) return;
  processInterviewStatus(id, newStatus);
}

async function processStatus(id, newStatus) {
  const comment = document.getElementById(`comment-${id}`)?.value.trim() || '';
  let adminIp = '—';
  try { const r = await fetch('https://api.ipify.org?format=json'); adminIp = (await r.json()).ip; } catch (_) {}

  try {
    const { error } = await sbClient.rpc('update_statement_status_secure', {
      p_statement_id:   id,
      p_new_status:     newStatus,
      p_comment:        comment,
      p_admin_login:    CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_HASH,
      p_admin_ip:       adminIp
    });
    if (error) throw error;
    loadAdminCards();
  } catch (err) { alert('Ошибка доступа: ' + err.message); }
}

// ============================================================
// СОБЕСЕДОВАНИЕ — статус после одобрения заявления
// ============================================================
// Показывается только для заявлений со статусом "Одобрено".
// Цель: чтобы любой админ, открывший карточку, сразу видел,
// проводилось ли уже собеседование и чем оно закончилось —
// и не звал кандидата на повторное собеседование, если тот
// уже был отклонён.
function renderInterviewBlock(st) {
  if (st.interview_status === 'Принят') {
    return `
      <div class="interview-block" style="margin-top:12px; padding:12px; border-radius:6px; background:rgba(46,204,113,0.12); border:1px solid #2ecc71;">
        <div style="font-weight:bold; color:#2ecc71;">✅ СОБЕСЕДОВАНИЕ ПРОЙДЕНО — КАНДИДАТ ПРИНЯТ</div>
        <div style="margin-top:4px; color:#aaa;">Провёл: <b style="color:#fff;">${escapeHtml(st.interview_by || '—')}</b></div>
        ${st.interview_comment ? `<div style="color:#aaa;">Комментарий: <i>${escapeHtml(st.interview_comment)}</i></div>` : ''}
      </div>
    `;
  }

  if (st.interview_status === 'Отказано') {
    return `
      <div class="interview-block" style="margin-top:12px; padding:12px; border-radius:6px; background:rgba(231,76,60,0.12); border:1px solid #e74c3c;">
        <div style="font-weight:bold; color:#e74c3c;">❌ СОБЕСЕДОВАНИЕ ПРОЙДЕНО — КАНДИДАТУ ОТКАЗАНО</div>
        <div style="margin-top:4px; color:#aaa;">Провёл: <b style="color:#fff;">${escapeHtml(st.interview_by || '—')}</b></div>
        ${st.interview_comment ? `<div style="color:#aaa;">Комментарий: <i>${escapeHtml(st.interview_comment)}</i></div>` : ''}
        <div style="margin-top:6px; color:#e74c3c; font-size:12px;">⚠️ Не приглашайте на повторное собеседование без согласования.</div>
      </div>
    `;
  }

  // Заявление одобрено, но собеседование ещё не проводилось
  return `
    <div class="interview-block" style="margin-top:12px; padding:12px; border-radius:6px; background:rgba(243,156,18,0.10); border:1px solid #f39c12;">
      <div style="font-weight:bold; color:#f39c12;">🕓 СОБЕСЕДОВАНИЕ ЕЩЁ НЕ ПРОВОДИЛОСЬ</div>
      <input type="text" class="comment-input" id="interview-comment-${st.id}" placeholder="Комментарий по итогам собеседования (необязательно)..." style="margin-top:8px;">
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn-approve" onclick="confirmInterviewDecision(${st.id}, 'Принят', '${escapeAttr(st.char_name)}')">✅ Принять</button>
        <button class="btn-reject"  onclick="confirmInterviewDecision(${st.id}, 'Отказано', '${escapeAttr(st.char_name)}')">❌ Отказать</button>
      </div>
    </div>
  `;
}

async function processInterviewStatus(id, newStatus) {
  const comment = document.getElementById(`interview-comment-${id}`)?.value.trim() || '';

  try {
    const { data: success, error } = await sbClient.rpc('update_interview_status_secure', {
      p_statement_id:     id,
      p_interview_status: newStatus,
      p_comment:          comment,
      p_admin_login:      CURRENT_ADMIN_USER,
      p_admin_password:   CURRENT_ADMIN_HASH
    });
    if (error) throw error;
    if (success) loadAdminCards();
  } catch (err) {
    alert('Ошибка доступа: ' + err.message);
  }
}

// ============================================================
// STATE COINS — LEADER PROPOSALS
// ============================================================

let FACTION_NAMES = {};

function factionLabel(id) {
  return id ? (FACTION_NAMES[id] || `Фракция #${id}`) : null;
}

async function loadLeaderProposals() {
  if (!sbClient) initSupabase();

  const tbody = document.getElementById('scProposalsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:15px;">Загрузка...</td></tr>';

  try {
    const { data: factions, error: factionError } = await sbClient.from('factions').select('id, name');
    if (factionError) throw factionError;
    if (factions) factions.forEach(f => { FACTION_NAMES[f.id] = f.name; });

    const { data: proposals, error: propError } = await sbClient
      .from('sc_proposals')
      .select('*')
      .eq('status', 'На рассмотрении')
      .order('created_at', { ascending: true });
    if (propError) throw propError;

    tbody.innerHTML = '';

    if (!proposals || proposals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#64748b; padding:15px;">Новых отчётов от лидеров нет</td></tr>';
      return;
    }

    proposals.forEach(prop => {
      const tr = document.createElement('tr');

      const fromFaction = factionLabel(prop.faction_id) || '—';

      const opponentId = prop.winner_faction_id || prop.target_faction_id || prop.with_faction_id || null;
      let withFaction;
      if (prop.type === 'МФ_Бой' || prop.type === 'МФ_Тренировка') {
        withFaction = opponentId
          ? `<span style="color:#3498db; font-weight:bold;">${factionLabel(opponentId)}</span>`
          : `<span style="color:#e74c3c; font-size:11px;">Не указана</span>`;
      } else {
        withFaction = `<span style="color:#64748b;">—</span>`;
      }

      tr.innerHTML = `
        <td style="padding:12px;"><strong>${escapeHtml(prop.sender_login)}</strong><br><small style="color:#94a3b8;">${escapeHtml(fromFaction)}</small></td>
        <td style="padding:12px;"><span style="background:#222; border:1px solid #333; padding:4px 8px; border-radius:4px; font-size:12px; color:#eab308;">${escapeHtml(prop.type)}</span></td>
        <td style="padding:12px;">${withFaction}</td>
        <td style="padding:12px; max-width:250px; white-space:pre-wrap;">${escapeHtml(prop.details)}</td>
        <td style="padding:12px; color:#2ecc71; font-weight:bold;">${Number(prop.fund).toLocaleString()} SC</td>
        <td style="padding:12px;">
          ${prop.evidence_link && prop.evidence_link !== '—'
            ? `<a href="${escapeHtml(prop.evidence_link)}" target="_blank" style="color:#3498db;">Открыть доказательства 🔗</a>`
            : `<span style="color:#555;">${escapeHtml(prop.evidence_link || 'Нет ссылки')}</span>`}
        </td>
        <td style="padding:12px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="handleSCDecision(${prop.id}, 'Одобрено', '${escapeAttr(prop.type)}', ${prop.faction_id}, ${opponentId || 'null'}, ${prop.fund})"  style="background:#2ecc71; color:#fff; border:none; padding:6px 12px; font-weight:bold; cursor:pointer; border-radius:4px;">Одобрить</button>
            <button onclick="handleSCDecision(${prop.id}, 'Отклонено', '${escapeAttr(prop.type)}', ${prop.faction_id}, ${opponentId || 'null'}, ${prop.fund})" style="background:#e74c3c; color:#fff; border:none; padding:6px 12px; font-weight:bold; cursor:pointer; border-radius:4px;">Отклонить</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Ошибка загрузки заявок SC:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#e74c3c; padding:15px;">Ошибка базы данных: ${err.message}</td></tr>`;
  }
}

// ============================================================
// SC DECISION — handles battle, task, and quiz proposals
// ============================================================
async function handleSCDecision(proposalId, newStatus, proposalType, senderFactionId, opponentFactionId, fund) {
  let winnerName = null;
  let loserName  = null;
  let taskReward = null;

  const comment = prompt(`Комментарий к решению «${newStatus}» (необязательно):`) || "";

  if (newStatus === 'Отклонено') {
    // No balance changes needed — just update the status
    try {
      const { data: success, error } = await sbClient.rpc('update_proposal_status_secure', {
        p_proposal_id:         proposalId,
        p_new_status:          newStatus,
        p_comment:             comment,
        p_admin_login:         CURRENT_ADMIN_USER,
        p_admin_password_hash: CURRENT_ADMIN_HASH,
        p_task_reward:         0,
        p_winner_name:         null,
        p_loser_name:          null
      });
      if (error) throw error;
      if (success) {
        alert(`Заявка отклонена.`);
        loadLeaderProposals();
      }
    } catch (err) {
      console.error("Ошибка отклонения заявки SC:", err);
      alert(`Ошибка: ${err.message}`);
    }
    return;
  }

  // ── APPROVED ──────────────────────────────────────────────

  if (proposalType === 'МФ_Бой' || proposalType === 'МФ_Тренировка') {
    // Build the two faction names so admin can pick the winner from a clear list
    const senderName   = FACTION_NAMES[senderFactionId]   || `Фракция #${senderFactionId}`;
    const opponentName = opponentFactionId ? (FACTION_NAMES[opponentFactionId] || `Фракция #${opponentFactionId}`) : null;

    if (!opponentName) {
      alert("Ошибка: фракция-оппонент не указана в заявке. Отклоните и попросите переподать.");
      return;
    }

    // Show a clear prompt listing both factions
    const choice = prompt(
      `Кто ПОБЕДИЛ в бою?\n\n` +
      `  1 — ${senderName}\n` +
      `  2 — ${opponentName}\n\n` +
      `Введите 1 или 2:`
    );

    if (choice === null) return; // Admin cancelled

    if (choice === '1') {
      winnerName = senderName;
      loserName  = opponentName;
    } else if (choice === '2') {
      winnerName = opponentName;
      loserName  = senderName;
    } else {
      alert("Неверный ввод. Введите 1 или 2.");
      return;
    }

    // fund from the proposal = each side's stake (e.g. 5000)
    // Winner gets +fund, loser gets -fund
    // p_task_reward is not used for battles — pass 0
    taskReward = 0;

  } else if (proposalType === 'Задание') {
    const input = prompt("Укажите размер вознаграждения (SC) за выполненное задание:", String(fund));
    if (input === null) return;
    const parsed = parseInt(input);
    if (isNaN(parsed) || parsed < 0) { alert("Введите корректное число."); return; }
    taskReward = parsed;

  } else {
    // Викторина — use the fund stored in the proposal as-is
    taskReward = 0; // SQL will use proposal.fund for non-battle, non-task types
  }

  console.log("SC Decision →", { proposalId, newStatus, proposalType, winnerName, loserName, taskReward });

  try {
    const { data: success, error } = await sbClient.rpc('update_proposal_status_secure', {
      p_proposal_id:         proposalId,
      p_new_status:          newStatus,
      p_comment:             comment,
      p_admin_login:         CURRENT_ADMIN_USER,
      p_admin_password_hash: CURRENT_ADMIN_HASH,
      p_task_reward:         taskReward,
      p_winner_name:         winnerName,
      p_loser_name:          loserName
    });
    if (error) throw error;

    if (success) {
      if (winnerName) {
        alert(`✅ Бой одобрен!\n\n🏆 Победитель: ${winnerName}  +${fund.toLocaleString()} SC\n💀 Проигравший: ${loserName}  -${fund.toLocaleString()} SC`);
      } else if (proposalType === 'Задание') {
        alert(`✅ Задание одобрено. Организации начислено ${taskReward.toLocaleString()} SC.`);
      } else {
        alert(`✅ Заявка одобрена.`);
      }
      loadLeaderProposals();
    } else {
      alert("Не удалось обновить статус заявки. Проверьте учётные данные.");
    }
  } catch (err) {
    console.error("Ошибка операции SC:", err);
    alert(`Ошибка: ${err.message || "Неизвестная ошибка."}`);
  }
}

// ============================================================
// DAILY QUESTION
// ============================================================
async function publishDailyQuestion() {
  const text   = document.getElementById('newQuestionInput').value.trim();
  const reward = parseInt(document.getElementById('newQuestionReward').value) || 2500;

  if (!text) { alert("Введите текст вопроса!"); return; }

  try {
    const { error } = await sbClient.rpc('create_daily_question_secure', {
      p_question_text:  text,
      p_reward:         reward,
      p_admin_login:    CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_HASH
    });

    if (error) throw error;

    alert("Вопрос дня успешно опубликован!");
    document.getElementById('newQuestionInput').value = '';
  } catch (err) {
    console.error("Ошибка публикации вопроса:", err);
    alert(`Не удалось опубликовать вопрос. Убедитесь, что у вас есть права доступа (Marat_Sardar).`);
  }
}

// ============================================================
// HELPERS
// ============================================================
function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'block'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setBtn(btn, text, disabled) { if (btn) { btn.innerText = text; btn.disabled = disabled; } }