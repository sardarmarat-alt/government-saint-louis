// Данные твоего проекта Supabase
const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

let sbClient = null;

// Глобальные переменные теперь берут начальные значения из sessionStorage (если они там есть)
let CURRENT_ADMIN_USER = sessionStorage.getItem('admin_user') || '';
let CURRENT_ADMIN_HASH = sessionStorage.getItem('admin_hash') || '';

// Функция безопасной инициализации Supabase при старте страницы
function initSupabase() {
  if (window.supabase) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase успешно инициализирован в админке!");
  } else {
    console.error("Ошибка: Библиотека Supabase не загрузилась. Проверь интернет или ссылку в HTML.");
    alert("Критическая ошибка: не удалось подключить Supabase. Проверь консоль (F12).");
  }
}

// Запускаем инициализацию и проверку существующей сессии при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  initSupabase();
  checkExistingSession(); // Проверяем, залогинен ли уже пользователь
});

// Проверка активной сессии (чтобы не вылетало при обновлении)
function checkExistingSession() {
  if (CURRENT_ADMIN_USER && CURRENT_ADMIN_HASH) {
    console.log(`Найдена активная сессия для ${CURRENT_ADMIN_USER}. Пропускаем авторизацию.`);
    
    // Скрываем окно входа и сразу показываем админку
    if (document.getElementById('loginOverlay')) document.getElementById('loginOverlay').style.display = 'none';
    if (document.getElementById('adminContent')) document.getElementById('adminContent').style.display = 'block';
    
    loadAdminCards();
  }
}

// Функция хеширования на стороне клиента
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

// ---- Login ----
async function handleLogin() {
  if (!sbClient) initSupabase();

  const userInp  = document.getElementById('username').value.trim();
  const passInp  = document.getElementById('password').value; 
  const errorMsg = document.getElementById('errorMsg');
  const loginBtn = document.querySelector('.login-box button');

  if (!userInp || !passInp) {
    alert("Пожалуйста, заполните все поля!");
    return;
  }

  try {
    if (loginBtn) {
      loginBtn.innerText = "Проверка...";
      loginBtn.disabled  = true;
    }

    const passHash = await sha256(passInp);

    const { data: isValid, error: rpcError } = await sbClient.rpc('check_admin_credentials', {
      p_login:         userInp,
      p_password_hash: passHash
    });

    if (rpcError) throw rpcError;

    if (isValid === true) {
      CURRENT_ADMIN_USER = userInp;
      CURRENT_ADMIN_HASH = passHash; 

      document.getElementById('password').value = '';

      // ПРОВЕРКА: Если введённый текст пароля начинается с ACTIVATE_ — это первый вход
      if (passInp.startsWith('ACTIVATE_')) {
        console.log("Обнаружен активационный код. Открываем окно создания постоянного пароля.");
        
        if (document.getElementById('loginOverlay')) document.getElementById('loginOverlay').style.display = 'none';
        if (document.getElementById('changePassOverlay')) {
          document.getElementById('changePassOverlay').style.display = 'flex';
        }
      } else {
        // СОХРАНЯЕМ СЕССИЮ: Если пароль постоянный, запоминаем его до закрытия вкладки
        sessionStorage.setItem('admin_user', CURRENT_ADMIN_USER);
        sessionStorage.setItem('admin_hash', CURRENT_ADMIN_HASH);

        console.log("Вход выполнен по постоянному паролю. Сессия сохранена.");
        if (document.getElementById('loginOverlay')) document.getElementById('loginOverlay').style.display = 'none';
        if (document.getElementById('adminContent')) document.getElementById('adminContent').style.display = 'block';
        if (errorMsg) errorMsg.style.display = 'none';
        loadAdminCards();
      }

    } else {
      alert("Неверный логин или пароль!");
      if (loginBtn) {
        loginBtn.innerText = "Войти в систему";
        loginBtn.disabled  = false;
      }
    }

  } catch (err) {
    console.error('Ошибка авторизации:', err);
    alert('Произошла ошибка при отправке запроса.');
    if (loginBtn) {
      loginBtn.innerText = "Войти в систему";
      loginBtn.disabled  = false;
    }
  }
}

// ---- Смена временного пароля ----
async function handlePasswordChange() {
  if (!sbClient) initSupabase();

  const newPass = document.getElementById('newPassword').value;
  
  if (!newPass || newPass.length < 6) { 
    alert("Пароль должен быть не менее 6 символов!"); 
    return; 
  }
  
  try {
    const newHash = await sha256(newPass);
    
    const { data: success, error: rpcError } = await sbClient.rpc('set_new_password', {
      p_login:             CURRENT_ADMIN_USER,
      p_old_password_hash: CURRENT_ADMIN_HASH,
      p_new_password_hash: newHash
    });

    if (rpcError) throw rpcError;

    if (success) {
      alert("Постоянный пароль успешно установлен!");
      CURRENT_ADMIN_HASH = newHash;
      
      // СОХРАНЯЕМ СЕССИЮ после успешной смены пароля
      sessionStorage.setItem('admin_user', CURRENT_ADMIN_USER);
      sessionStorage.setItem('admin_hash', CURRENT_ADMIN_HASH);

      if (document.getElementById('changePassOverlay')) document.getElementById('changePassOverlay').style.display = 'none';
      if (document.getElementById('adminContent')) document.getElementById('adminContent').style.display = 'block';
      document.getElementById('newPassword').value = '';
      
      loadAdminCards();
    } else {
      alert("Не удалось сменить пароль.");
    }
  } catch (err) {
    console.error('Ошибка при смене пароля:', err);
    alert('Произошла ошибка на сервере базы данных.');
  }
}

// ---- Загрузка карточек админки ----
async function loadAdminCards() {
  if (!sbClient) initSupabase();

  try {
    const { data: statements, error } = await sbClient
      .from('lawyer_statements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const grid = document.getElementById('cards-container');
    if (!grid) return;
    grid.innerHTML = '';

    const loadingText = document.getElementById('admin-loading');
    if (loadingText) loadingText.style.display = 'none';

    if (!statements || statements.length === 0) {
      grid.innerHTML = '<p style="color:#888; text-align:center;">Заявлений пока нет.</p>';
      return;
    }

    statements.forEach(st => {
      const card = document.createElement('div');
      
      let borderClass = 'border-waiting';
      if (st.status === 'Одобрено') borderClass = 'border-approved';
      if (st.status === 'Отклонено') borderClass = 'border-rejected';

      card.className = `statement-card ${borderClass}`;

      card.innerHTML = `
        <div class="card-header">
          <div class="candidate-info">
            <span style="color: #C9A24B; font-weight:bold;">ID: #${st.id}</span>
            <span><strong>Ник:</strong> ${st.char_name}</span>
            <span><strong>Лет в штате:</strong> ${st.char_age}</span>
            <span><strong>VK:</strong> <a href="https://vk.com/${st.vk_link}" target="_blank">${st.vk_link}</a></span>
          </div>
          <span class="status-text" style="color: ${st.status === 'Одобрено' ? '#2ecc71' : st.status === 'Отклонено' ? '#e74c3c' : '#f39c12'}">${st.status}</span>
        </div>
        
        <div class="question-block">
          <div class="question-title">Биография и опыт:</div>
          <div class="answer-text">${st.biography}</div>
        </div>
        <div class="question-block">
          <div class="question-title">Что такое ООП и где регламентируется:</div>
          <div class="answer-text">${st.about_oop}</div>
        </div>
        <div class="question-block">
          <div class="question-title">За нарушение каких статей присваивается ООП:</div>
          <div class="answer-text">${st.what_oop}</div>
        </div>
        <div class="question-block">
          <div class="question-title">Порядок проверки заключенного:</div>
          <div class="answer-text">${st.oop_order}</div>
        </div>

        ${st.admin_comment ? `
          <div style="margin-top: 10px; font-style: italic; color: #aaa; background: #111; padding: 10px; border-radius: 4px;">
            <strong>Комментарий (${st.checked_by || 'Администрация'}):</strong> ${st.admin_comment}
          </div>
        ` : ''}

        ${st.status === 'На рассмотрении' ? `
          <div class="admin-actions">
            <input type="text" class="comment-input" id="comment-${st.id}" placeholder="Оставьте комментарий (необязательно)...">
            <button class="btn-approve" onclick="processStatus(${st.id}, 'Одобрено')">Одобрить</button>
            <button class="btn-reject" onclick="processStatus(${st.id}, 'Отклонено')">Отклонить</button>
          </div>
        ` : ''}
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Ошибка загрузки карточек:', err);
  }
}

// ---- Безопасное обновление статуса через RPC ----
async function processStatus(id, newStatus) {
  if (!sbClient) initSupabase();

  const commentInput = document.getElementById(`comment-${id}`);
  const comment = commentInput ? commentInput.value.trim() : '';

  if (newStatus === 'Отклонено' && comment === '') {
    const confirmReject = confirm("Причина отказа не указана. Всё равно отклонить заявление?");
    if (!confirmReject) return; 
  }

  try {
    const { data: success, error } = await sbClient.rpc('update_statement_status_secure', {
      p_statement_id:   id,
      p_new_status:     newStatus,
      p_comment:        comment,
      p_admin_login:    CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_HASH
    });

    if (error) throw error;

    if (success) {
      loadAdminCards();
    } else {
      alert("Не удалось обновить статус заявления.");
    }
  } catch (err) {
    console.error('Ошибка обновления статуса:', err);
    alert('Не удалось обновить статус. Ошибка доступа.');
  }
}