const form = document.getElementById("fixture-form");
let editor = document.getElementById("prompt-textarea");
if (new URLSearchParams(location.search).has("rich")) {
  const rich = document.createElement("div");
  rich.id = editor.id;
  rich.contentEditable = "true";
  rich.setAttribute("role", "textbox");
  rich.setAttribute("aria-label", "Website composer");
  rich.style.minHeight = "130px";
  rich.style.whiteSpace = "pre-wrap";
  editor.replaceWith(rich);
  editor = rich;
}
const guest = new URLSearchParams(location.search).has("guest");
if (guest) {
  editor.id = "mobile-composer-prompt";
  form.querySelector("label").htmlFor = editor.id;
  const send = form.querySelector('[data-testid="send-button"]');
  send.removeAttribute("data-testid");
  send.setAttribute("aria-label", "Send message");
}
const stop = document.querySelector('[data-testid="stop-button"]');
let timer;
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = editor.value ?? editor.innerText;
  if (!value.trim()) return;
  document.getElementById("submitted-text").textContent = value;
  if (editor.tagName === "TEXTAREA") editor.value = "";
  else editor.textContent = "";
  stop.hidden = false;
  const answer = document.createElement("pre");
  answer.className = "text-output";
  if (guest) answer.dataset.messageRole = "assistant";
  else answer.dataset.messageAuthorRole = "assistant";
  document.getElementById("fixture-replies").append(answer);
  const tokens = [
    ...new Set(
      value.match(
        /\[(?:PERSON|ADDRESS|EMAIL|PHONE|ID|DOB|CARD|SECRET|SESSION_TOKEN)_\d+\]/g,
      ) || [],
    ),
  ];
  answer.textContent = `Synthetic response for ${tokens[0] || "your message"}…`;
  timer = setTimeout(() => {
    answer.textContent = `Synthetic reply: ${tokens.join(" · ")}. These placeholders are echoed for local restoration testing.`;
    if (guest) answer.setAttribute("data-message-complete", "");
    stop.hidden = true;
  }, 700);
});
stop.addEventListener("click", () => {
  clearTimeout(timer);
  stop.hidden = true;
});
