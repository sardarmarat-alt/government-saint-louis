const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CURRENT_ADMIN_USER = "";
let CURRENT_ADMIN_PASS = ""; // Временно храним пароль для подписи RPC-запросов обновления

// Функция безопасной авторизации через RPC базу данных
async function handleLogin() {
  console.log("Функция handleLogin вызвана!"); // Это покажет в консоли, что кнопка ожила
  
  const userInp = document.getElementById('username').value.trim();
  const passInp = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  const loginButton = document.querySelector('.login-box button');

  if (!userInp || !passInp) {
    alert("Пожалуйста, заполните все поля!");
    return;
  }

  try {
    loginButton.innerText = "Проверка...";
    loginButton.disabled = true;

    // Вызываем защищенную RPC-функцию проверки пароля
    const { data: isValid, error: rpcError } = await sbClient.rpc('check_admin_credentials', {
      p_login: userInp,
      p_password_hash: passInp
    });

    if (rpcError) throw rpcError;

    if (isValid === true) {
      CURRENT_ADMIN_USER = userInp;
      CURRENT_ADMIN_PASS = passInp; // Запоминаем для сессии

      console.log(`Успешный вход: ${CURRENT_ADMIN_USER}`);

      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminContent').style.display = 'block';
      
      errorMsg.style.display = 'none';
      loadAdminCards();
    } else {
      errorMsg.style.display = 'block';
      loginButton.innerText = "Войти в систему";
      loginButton.disabled = false;
    }

  } catch (err) {
    console.error('Ошибка авторизации:', err);
    alert('Ошибка при проверке данных. Возможно, RPC функция check_admin_credentials не существует в базе.');
    loginButton.innerText = "Войти в систему";
    loginButton.disabled = false;
  }
}

// Загрузка карточек заявлений в админ-панель
async function loadAdminCards() {
  const loadingText = document.getElementById('admin-loading');
  const container = document.getElementById('cards-container');
  
  try {
    const { data: statements, error } = await sbClient
      .from('lawyer_statements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!statements || statements.length === 0) {
      loadingText.innerText = "Новых заявлений пока нет.";
      return;
    }

    loadingText.style.display = 'none';
    container.innerHTML = '';

    statements.forEach(item => {
      const card = document.createElement('div');
      let statusStyle = 'border-waiting';
      let statusColor = '#f39c12';
      if (item.status === 'Одобрено') { statusStyle = 'border-approved'; statusColor = '#2ecc71'; }
      if (item.status === 'Отклонено') { statusStyle = 'border-rejected'; statusColor = '#e74c3c'; }

      card.className = `statement-card ${statusStyle}`;
      const date = new Date(item.created_at).toLocaleDateString('ru-RU') + ' ' + new Date(item.created_at).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});

      card.innerHTML = `
        <div class="card-header">
          <div class="candidate-info">
            <span style="font-size: 18px; color: #C9A24B;"><b>${item.char_name}</b></span>
            <span>Проживает в штате: <b>${item.char_age} лет</b></span>
            <span>Связь: <a href="${item.vk_link}" target="_blank" style="color: #5181b8; text-decoration: none;"><b>ВКонтакте</b></a></span>
            <br>
            <span style="font-size: 11px; color: #666; display: block; margin-top: 5px;">IP отправителя: <b>${item.user_ip || 'не записан'}</b></span>
          </div>
          <div style="font-size: 13px; color: #888;">Подано: ${date}</div>
        </div>

        <div class="question-block">
          <div class="question-title">Краткая биография / Опыт работы:</div>
          <div class="answer-text">${item.biography}</div>
        </div>

        <div class="question-block">
          <div class="question-title">What is OOP:</div>
          <div class="answer-text">${item.about_oop}</div>
        </div>

        <div class="question-block">
          <div class="question-title">OOP articles:</div>
          <div class="answer-text">${item.what_oop}</div>
        </div>

        <div class="question-block">
          <div class="question-title">OOP order check:</div>
          <div class="answer-text">${item.oop_order}</div>
        </div>

        <div class="admin-actions" id="actions-${item.id}">
          ${item.status === 'На рассмотрении' ? `
            <input type="text" id="comment-${item.id}" class="comment-input" placeholder="Введите причину отказа (необязательно)">
            <button class="btn-approve" onclick="updateStatus(${item.id}, 'Одобрено')">Одобрить</button>
            <button class="btn-reject" onclick="updateStatus(${item.id}, 'Отклонено')">Отклонить</button>
          ` : `
            <div style="color: #aaa;">Статус решения: <span class="status-text" style="color: ${statusColor}">${item.status}</span></div>
            <div style="margin-left: 20px; color: #888;">Проверил: <b style="color: #fff;">${item.checked_by || 'Неизвестно'}</b></div>
            <div style="margin-left: 20px; color: #888;">Комментарий: <i>${item.admin_comment || 'отсутствует'}</i></div>
          `}
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error('Ошибка админки:', err);
    loadingText.style.color = '#e74c3c';
    loadingText.innerText = 'Ошибка при загрузке панели управления.';
  }
}

// Обновление статуса заявления через защищенный RPC-запрос
async function updateStatus(id, newStatus) {
  const commentInput = document.getElementById(`comment-${id}`);
  const commentText = commentInput ? commentInput.value.trim() : '';

  if (newStatus === 'Отклонено' && commentText === '') {
    if (!confirm('Вы не указали причину отказа. Всё равно отклонить?')) return;
  }

  try {
    const { data: success, error } = await sbClient.rpc('update_statement_status_secure', {
      p_statement_id: id,
      p_new_status: newStatus,
      p_comment: commentText,
      p_admin_login: CURRENT_ADMIN_USER,
      p_admin_password: CURRENT_ADMIN_PASS
    });

    if (error) throw error;
    loadAdminCards();
  } catch (err) {
    console.error('Не удалось обновить статус:', err);
    alert('Произошла ошибка при сохранении решения. Доступ запрещен.');
  }
}