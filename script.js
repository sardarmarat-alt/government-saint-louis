// Мобильное меню
//document.addEventListener('DOMContentLoaded', () => {
//  const form = document.getElementById('lawyer-form');
//  const formMessage = document.getElementById('form-message');

//  // if (form) {
//  //  form.addEventListener('submit', function(e) {
//  //    e.preventDefault(); 
  //    e.stopPropagation();
  //    
  //    if (formMessage) {
  //      formMessage.style.color = "#C9A24B";
  //      formMessage.innerText = "Отправка заявления, пожалуйста, подождите...";
  //    }
  //    
//
  //    const payload = {
  //      charName: document.getElementById('char-name').value,
  //      charAge: document.getElementById('char-age').value,
  //      vk: document.getElementById('vk-tag').value,
  //      biography: document.getElementById('bio').value,
  //      aboutoop: document.getElementById('about-oop').value,
  //      whatoop: document.getElementById('what-oop').value,
  //      oopOrder: document.getElementById('oop-order').value
  //    };

  //    const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbysEHVtJJ5J8h7J2l7v2wgpETN8XwnmhJexYFKArocJbEnxfLXySXDIpD18EsbLp3Fb/exec";

  //    fetch(GOOGLE_APP_URL, {
  //      method: 'POST',
  //      mode: 'no-cors',
  //      cache: 'no-cache',
  //      redirect: 'follow',
  //      headers: {
  //        'Content-Type': 'text/plain'
  //      },
  //      body: JSON.stringify(payload)
  //    })
  //    .then(() => {
  //      if (formMessage) {
  //        formMessage.style.color = "#4caf50";
  //        formMessage.innerText = "✅ Заявление успешно отправлено в базу данных!";
  //      }
  //      form.reset(); 
  //    })
  //    .catch(error => {
  //      console.error('Error:', error);
  //      if (formMessage) {
  //        formMessage.style.color = "#f44336";
  //        formMessage.innerText = "❌ Не удалось связаться с сервером. Попробуйте еще раз.";
  //      }
  //    });
  //  });
  //}
//});


const SUPABASE_URL = "https://lwdumseishjeopiefcth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3ZHVtc2Vpc2hqZW9waWVmY3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODE3MTUsImV4cCI6MjA5ODA1NzcxNX0.ot9YuYuJBtATyJxFSF8_jfZ-O3epgomBH6SJlVzWil4";

if (typeof window.supabase === 'undefined') {
  console.error("Библиотека Supabase не загрузилась!");
}

const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let USER_IP = "";

// Функция жесткой блокировки страницы
function handleBan() {
  document.body.innerHTML = `
    <div style="text-align:center; margin-top:100px; font-family:sans-serif; color:#f44336;">
      <h1>Доступ ограничен</h1>
      <p>Ваш IP-адрес заблокирован администрацией за нарушение правил.</p>
    </div>
  `;
}

// Получаем IP и сразу проверяем на бан при загрузке страницы
fetch('https://api.ipify.org?format=json')
  .then(res => res.json())
  .then(async (data) => { 
    USER_IP = data.ip; 
    
    // Проверяем черный список в базе
    const { data: banData, error } = await sbClient
      .from('banned_ips')
      .select('ip')
      .eq('ip', USER_IP);

    if (error) {
      console.error("Ошибка проверки черного списка:", error);
      return;
    }

    if (banData && banData.length > 0) {
      handleBan();
    }
  })
  .catch(err => console.error("Не удалось получить IP:", err));

// Обработчик отправки формы
document.addEventListener('submit', async (e) => {
  if (e.target && e.target.id === 'statement-form') {
    // ЖЕСТКО БЛОКИРУЕМ ПЕРЕЗАГРУЗКУ СРАЗУ, ЧТОБЫ ИСКЛЮЧИТЬ ПРЫЖКИ
    e.preventDefault(); 
    e.stopPropagation();

    const form = e.target;
    const formMessage = document.getElementById('form-message');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Проверка бана на фронтенде перед отправкой
    if (USER_IP) {
      const { data: banCheck } = await sbClient.from('banned_ips').select('ip').eq('ip', USER_IP);
      if (banCheck && banCheck.length > 0) {
        handleBan();
        return;
      }
    }

    if (submitBtn) {
      submitBtn.innerText = "Отправка заявления...";
      submitBtn.disabled = true;
    }

    if (formMessage) {
      formMessage.style.color = "#C9A24B";
      formMessage.innerText = "Отправка заявления, пожалуйста, подождите...";
    }

    try {
      const char_name = document.getElementById('char-name').value.trim();
      const char_age = parseInt(document.getElementById('char-age').value.trim());
      const vk_link = document.getElementById('vk-tag').value.trim();
      const biography = document.getElementById('bio').value.trim();
      const about_oop = document.getElementById('about-oop').value.trim();
      const what_oop = document.getElementById('what-oop').value.trim();
      const oop_order = document.getElementById('oop-order').value.trim();

      const { error } = await sbClient
        .from('lawyer_statements')
        .insert([
          {
            char_name,
            char_age,
            vk_link,
            biography,
            about_oop,
            what_oop,
            oop_order,
            status: "На рассмотрении",
            user_ip: USER_IP 
          }
        ]);

      if (error) throw error;

      if (formMessage) {
        formMessage.style.color = "#4caf50";
        formMessage.innerText = "✅ Заявление успешно отправлено в базу данных!";
      }
      
      form.reset();

      setTimeout(() => {
        window.location.href = "statements.html";
      }, 2000);

    } catch (err) {
      console.error("Ошибка при отправке:", err);
      
      if (formMessage) {
        formMessage.style.color = "#f44336";
        // Проверяем сообщения об ошибках от наших SQL-триггеров (бан или спам)
        if (err.message && (err.message.includes("Слишком много запросов") || err.message.includes("Доступ ограничен"))) {
          formMessage.innerText = `❌ ${err.message}`;
        } else {
          formMessage.innerText = "❌ Произошла ошибка при отправке в базу данных. Попробуйте позже.";
        }
      }
    } finally {
      if (submitBtn) {
        submitBtn.innerText = "Отправить заявление";
        submitBtn.disabled = false;
      }
    }
  }
});