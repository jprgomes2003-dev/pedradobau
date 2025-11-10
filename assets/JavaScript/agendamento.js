// ===== 1. Preenche os campos com os dados da URL =====
const params = new URLSearchParams(window.location.search);
const atividade = params.get("atividade") || "";
const data = params.get("data") || "";
const hora = params.get("hora") || "";

document.getElementById("f_date_time").value = data && hora ? `${data}, ${hora}` : "";
document.getElementById("f_activity").value = atividade;


// ===== 2. Criação dos campos extras de visitantes =====
const visitorSelect = document.getElementById("visitorCount");
const extraContainer = document.getElementById("extraVisitors");

visitorSelect.addEventListener("change", () => {
  const count = parseInt(visitorSelect.value);
  extraContainer.innerHTML = "";

  for (let i = 1; i <= count; i++) {
    const group = document.createElement("div");
    group.className = "extra-group";

    group.innerHTML = `
      <label>Visitante ${i} - Nome</label>
      <input type="text" name="Visitante${i}_Nome" required>

      <label>Documento (RG ou CPF / Passaporte)</label>
      <input type="text" name="Visitante${i}_Documento" required>
    `;

    extraContainer.appendChild(group);
  }
});


// ===== 3. Validação + Envio para o backend =====
const bookingForm = document.getElementById("bookingForm");
const errorBox = document.getElementById("errorBox");

bookingForm.addEventListener("submit", async function (e) {
  e.preventDefault(); // impede o envio até validar

  // --- Validação ---
  const requiredFields = bookingForm.querySelectorAll("input[required], select[required]");
  let invalidFields = [];

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      invalidFields.push(field);
      field.style.border = "2px solid #b80000";
    } else {
      field.style.border = "2px solid var(--border)";
    }
  });

  if (invalidFields.length > 0) {
    errorBox.innerHTML = `⚠️ Por favor, preencha todos os campos obrigatórios antes de enviar.`;
    errorBox.style.display = "flex";
    bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
    invalidFields[0].focus();
    return;
  }

  errorBox.style.display = "none";

  // --- Monta o JSON para enviar ao backend ---
  const formData = new FormData(bookingForm);

  const dataToSend = {
    dataHorario: formData.get("DataHorario"),
    atividade: formData.get("Atividade"),
    nome: formData.get("Nome"),
    email: formData.get("Email"),
    celular: formData.get("Celular"),
    qtdVisitantes: parseInt(formData.get("QtdVisitantes")),
    valor: 5, // sempre R$ 5
    visitantes: []
  };

  for (let i = 1; i <= dataToSend.qtdVisitantes; i++) {
    dataToSend.visitantes.push({
      nome: formData.get(`Visitante${i}_Nome`),
      documento: formData.get(`Visitante${i}_Documento`)
    });
  }

  try {
    const res = await fetch("http://localhost:3000/api/agendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dataToSend)
    });

    const result = await res.json();

    if (!res.ok) {
      errorBox.innerHTML = `⚠️ Erro: ${result.message || "Erro ao enviar"}`;
      errorBox.style.display = "flex";
      return;
    }

    // Salva ID do agendamento para tela de pagamento
    localStorage.setItem("agendamentoId", result.id);

    window.location.href = "/pagamento.html";

  } catch (error) {
    errorBox.innerHTML = `❌ Erro de conexão com o servidor.`;
    errorBox.style.display = "flex";
  }
});


