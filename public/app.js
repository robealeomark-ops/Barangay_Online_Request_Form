const form = document.getElementById("requestForm");
const message = document.getElementById("formMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.className = "message";
  message.textContent = "Submitting your request...";
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Submission failed.");
    message.className = "message success";
    message.textContent = `${result.message} Your reference number is ${result.referenceNumber}. Please save it for your records.`;
    form.reset();
  } catch (error) {
    message.className = "message error";
    message.textContent = error.message;
  }
});
// ===== HELP BUTTON FUNCTIONALITY =====

const helpBtn = document.getElementById("helpBtn");
const helpDialog = document.getElementById("helpDialog");
const closeHelp = document.getElementById("closeHelp");
const gotItBtn = document.getElementById("gotItBtn");

// Open Help Window
helpBtn.addEventListener("click", () => {
    helpDialog.showModal();
});

// Close using X button
closeHelp.addEventListener("click", () => {
    helpDialog.close();
});

// Close using Got It button
gotItBtn.addEventListener("click", () => {
    helpDialog.close();
});