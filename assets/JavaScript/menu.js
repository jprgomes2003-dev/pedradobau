function toggleMenu() {
  const menu = document.querySelector("nav.mobile");
  const overlay = document.getElementById("mobile-overlay");

  menu.classList.toggle("open");
  document.body.classList.toggle("menu-open");
}


  document.addEventListener("DOMContentLoaded", () => {
  const btnFechar = document.querySelector(".fechar-menu");
  const menu = document.querySelector("nav.mobile");

  btnFechar.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  });

  // Também pode fechar clicando no overlay:
  const overlay = document.getElementById("mobile-overlay");
  overlay.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  });
});

(function(){

  /* ================== CONFIG: HORÁRIOS POR ATIVIDADE ================== */
  const SCHEDULES = {
    'Pedra do Bauzinho': {
      type: 'info',
      label: "Pedra do Bauzinho",
      desc: "Não é necessário agendamento. Funcionamento: 09:00 - 18:00"
    },
    'Pedra da Ana Chata': {
      type: 'book',
      label: "Pedra da Ana Chata",
      desc: "Obrigatório agendamento prévio.",
      times: ['09:00']
    },
    'Via Ferrata - Autônomos': {
      type: 'book',
      label: "Pedra do Baú 'Via Ferrata - Autônomos'",
      desc: "Obrigatório agendamento e uso de equipamentos.",
      times: ['09:00']
    }
  };

  /* ================== ELEMENTOS DO CALENDÁRIO ================== */
  const calendar = document.getElementById('calendar');
  const monthLabel = document.getElementById('monthLabel');
  const prevBtn = document.getElementById('prevMonthBtn');
  const nextBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('todayBtn');

  let current = new Date();        // hoje
  let year = current.getFullYear();
  let month = current.getMonth();

  const weekdays = ['Dom.','Seg.','Ter.','Qua.','Qui.','Sex.','Sáb.'];

  function renderCalendar() {
    calendar.innerHTML = '';

    // Cabeçalho dos dias da semana
    weekdays.forEach(d => {
      const el = document.createElement('div');
      el.className = 'weekday';
      el.textContent = d;
      calendar.appendChild(el);
    });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const emptyDays = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Espaços vazios antes do primeiro dia
    for (let i = 0; i < emptyDays; i++) {
      const empty = document.createElement('div');
      empty.className = 'day disabled';
      calendar.appendChild(empty);
    }

    // Dias do mês
    const today = new Date();
    const todayClean = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(year, month, d);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'day';
      btn.textContent = d;

      // Desabilita dias passados
      if (date < todayClean) {
        btn.disabled = true;
        btn.classList.add('disabled');
      } else {
        btn.addEventListener('click', () => {
          highlightSelected(btn);
          openDayPanel(date);
        });
      }

      // Destacar hoje
      if (date.toDateString() === today.toDateString()) {
        btn.classList.add('today');
      }

      calendar.appendChild(btn);
    }

    // Atualiza label do mês
    const monthName = firstDay.toLocaleString('pt-BR', { month: 'long' });
    monthLabel.textContent = `${monthName} de ${year}`;
  }

  /* ===== NOVA FUNÇÃO: DESTACAR DIA CLICADO ===== */
  function highlightSelected(button) {
  const allDays = calendar.querySelectorAll('.day');
  allDays.forEach(day => {
    if (!day.classList.contains('today')) {
      day.classList.remove('selected');
    }
  });

  if (!button.classList.contains('today')) {
    button.classList.add('selected');
  }
}


  

  /* Navegação do calendário */
  prevBtn.addEventListener('click', () => {
    month--;
    if (month < 0) { month = 11; year--; }
    renderCalendar();
  });

  nextBtn.addEventListener('click', () => {
    month++;
    if (month > 11) { month = 0; year++; }
    renderCalendar();
  });

  todayBtn.addEventListener('click', () => {
    const td = new Date();
    year = td.getFullYear();
    month = td.getMonth();
    renderCalendar();
  });

  renderCalendar();


  /* ================== PAINEL DE SELEÇÃO DO DIA ================== */
  const dayPanel = document.getElementById('dayPanel');
  const panelDate = document.getElementById('panelDate');
  const panelList = document.getElementById('panelList');
  const closePanel = document.getElementById('closePanel');

  function formatFull(date, time) {
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    const dateStr = date.toLocaleDateString('pt-BR', options);
    return time ? `${dateStr}, ${time}` : dateStr;
  }

  function openDayPanel(date) {
    panelList.innerHTML = '';

    const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    panelDate.textContent = formatted;

    Object.keys(SCHEDULES).forEach(key => {
      const obj = SCHEDULES[key];
      const entry = document.createElement('div');
      entry.className = obj.type === 'info' ? 'entry no-sched' : 'entry';

      if (obj.type === 'info') {
        const line = document.createElement('div');
        line.className = 'line1';
        line.textContent = formatFull(date);
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.innerHTML = `<strong>${obj.label}</strong> — ${obj.desc}`;
        entry.appendChild(line);
        entry.appendChild(desc);
      } else {
        obj.times.forEach(time => {
          const block = document.createElement('div');
          block.className = 'time-block';

          const line = document.createElement('div');
          line.className = 'line1';
          line.textContent = formatFull(date, time);

          const desc = document.createElement('div');
          desc.className = 'desc';
          desc.textContent = `${obj.label} — ${obj.desc}`;

          const btn = document.createElement('button');
          btn.className = 'btn-agenda';
          btn.textContent = 'Agendar';
          btn.addEventListener('click', () => openForm(date, time, obj.label));

          block.appendChild(line);
          block.appendChild(desc);
          block.appendChild(btn);
          entry.appendChild(block);
        });
      }

      panelList.appendChild(entry);
    });

    dayPanel.setAttribute('aria-hidden', 'false');
    dayPanel.scrollTop = 0;
  }

  closePanel.addEventListener('click', () => {
    dayPanel.setAttribute('aria-hidden', 'true');
  });


  /* ================== FORMULÁRIO ================== */
  const modal = document.getElementById('modalForm');
  const closeModal = document.getElementById('closeModal');
  const f_date_time = document.getElementById('f_date_time');
  const f_activity = document.getElementById('f_activity');

  function openForm(date, time, activity) {
    const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    f_date_time.value = `${dateStr}, ${time}`;
    f_activity.value = activity;
    modal.setAttribute('aria-hidden','false');
  }

  closeModal.addEventListener('click', () => modal.setAttribute('aria-hidden','true'));

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.setAttribute('aria-hidden','true');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal.getAttribute('aria-hidden') === 'false') modal.setAttribute('aria-hidden','true');
      if (dayPanel.getAttribute('aria-hidden') === 'false') dayPanel.setAttribute('aria-hidden','true');
    }
  });

})();
