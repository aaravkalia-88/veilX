import { createWorkspace } from "../ui/workspace.mjs";
import "./motion.mjs";

const workspace = createWorkspace();
const result = document.getElementById("assistant-result");
const toolLabel = document.getElementById("assistant-tool");
const buttons = [
  document.getElementById("ask-summary"),
  document.getElementById("ask-capabilities"),
];

async function ask(intent) {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  toolLabel.textContent = "MCP / RUNNING";
  result.textContent = "Calling the local tool with aggregate metadata only…";
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, ...workspace.getSummary() }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(
        "The MCP tool is unavailable. Confirm the local server is running on port 8000, then retry.",
      );
    const data = await response.json();
    toolLabel.textContent = `${data.tool} / ${data.transport}`;
    result.textContent = [
      data.result.message,
      ...(data.result.limits || []),
    ].join(" ");
  } catch (error) {
    toolLabel.textContent = "MCP / UNAVAILABLE";
    result.textContent =
      error.name === "TimeoutError"
        ? "Tool request timed out. Local masking still works; retry the summary when the server is available."
        : error.message;
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}
buttons[0].addEventListener("click", () => ask("summary"));
buttons[1].addEventListener("click", () => ask("capabilities"));
