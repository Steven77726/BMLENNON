setAppHeight();
window.addEventListener("resize", setAppHeight);
window.visualViewport?.addEventListener("resize", setAppHeight);

const EVENT = {
  title: "Bar Mitsvah de Lennon Lillo",
  start: "20260615T083000",
  end: "20260615T113000",
  location: "Association Israélite Culturelle de Pantin, 8 Rue Gambetta, 93500 Pantin",
  description: "Invitation à la Bar Mitsvah de Lennon Lillo."
};

function setAppHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

const modal = document.querySelector("#confirmModal");
const openConfirm = document.querySelector("#openConfirm");
const closeModal = document.querySelector("#closeModal");
const form = document.querySelector("#confirmForm");
const formMessage = document.querySelector("#formMessage");
const submitButton = form.querySelector(".submit-btn");

openConfirm.addEventListener("click", () => {
  form.reset();
  setMessage("");
  modal.showModal();
  form.elements.prenom.focus();
});

closeModal.addEventListener("click", () => modal.close());

modal.addEventListener("click", (event) => {
  const dialogBox = modal.querySelector(".modal-card").getBoundingClientRect();
  const clickedOutside =
    event.clientX < dialogBox.left ||
    event.clientX > dialogBox.right ||
    event.clientY < dialogBox.top ||
    event.clientY > dialogBox.bottom;

  if (clickedOutside && !submitButton.disabled) {
    modal.close();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    nom: data.nom?.trim(),
    prenom: data.prenom?.trim(),
    personnes: data.personnes?.trim(),
    telephone: data.telephone?.trim()
  };

  if (!payload.nom || !payload.prenom || !payload.personnes || !payload.telephone) {
    setMessage("Merci de remplir tous les champs.", true);
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    const response = await fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Email delivery failed");
    }

    setMessage("Merci, votre présence est confirmée ❤️");
    form.reset();
  } catch (error) {
    setMessage("Erreur lors de l’envoi, merci de réessayer.", true);
  } finally {
    setLoading(false);
  }
});

document.querySelector("#addAgenda").addEventListener("click", () => {
  downloadIcs();
  window.open(getGoogleCalendarUrl(), "_blank", "noopener");
});

function setLoading(isLoading) {
  [...form.elements].forEach((field) => {
    field.disabled = isLoading;
  });
  submitButton.disabled = isLoading;
  submitButton.classList.toggle("is-loading", isLoading);
  submitButton.querySelector(".submit-label").textContent = isLoading ? "Envoi en cours..." : "OK, je confirme";
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("is-error", isError);
}

function downloadIcs() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lennon Lillo//Bar Mitsvah Invitation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@lennon-lillo-bar-mitsvah`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART;TZID=Europe/Paris:${EVENT.start}`,
    `DTEND;TZID=Europe/Paris:${EVENT.end}`,
    `SUMMARY:${escapeIcs(EVENT.title)}`,
    `DESCRIPTION:${escapeIcs(EVENT.description)}`,
    `LOCATION:${escapeIcs(EVENT.location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "bar-mitsvah-lennon-lillo.ics";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function getGoogleCalendarUrl() {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: EVENT.title,
    dates: "20260615T063000Z/20260615T093000Z",
    location: EVENT.location,
    details: EVENT.description
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function toUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
