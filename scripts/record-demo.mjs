import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const rehearse = process.argv.includes("--rehearse");
const discover = process.argv.includes("--discover");
const directory = "dist/evidence";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  ...(rehearse || discover
    ? {}
    : { recordVideo: { dir: directory, size: { width: 1280, height: 720 } } }),
});
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(rehearse || discover ? 0 : ms);
async function click(selector) {
  const element = page.locator(selector);
  await expect(element).toBeVisible();
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 12,
  });
  await pause(350);
  await element.click();
  await pause(900);
}
async function subtitle(text) {
  await page.evaluate((value) => {
    document.getElementById("demo-subtitle").textContent = value;
  }, text);
  await pause(900);
}
async function type(selector, text) {
  await click(selector);
  if (rehearse) await page.locator(selector).fill(text);
  else await page.locator(selector).pressSequentially(text, { delay: 30 });
  await pause(800);
}
try {
  await page.goto("http://127.0.0.1:8000/");
  if (discover) {
    console.log(
      await page
        .locator("input,select,textarea,button,a")
        .evaluateAll((elements) =>
          elements
            .filter((el) => el.getBoundingClientRect().width)
            .map((el) => ({
              tag: el.tagName,
              id: el.id,
              type: el.type || "",
              text: el.textContent.trim().slice(0, 45),
              label: el.getAttribute("aria-label"),
            })),
        ),
    );
  } else {
    await page.evaluate(() => {
      const caption = document.createElement("div");
      caption.id = "demo-subtitle";
      Object.assign(caption.style, {
        position: "fixed",
        bottom: "0",
        left: "0",
        right: "0",
        zIndex: "999998",
        padding: "12px 24px",
        background: "#164e3f",
        color: "#fff",
        font: "500 15px system-ui",
        textAlign: "center",
        pointerEvents: "none",
      });
      const cursor = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      cursor.setAttribute("width", "25");
      cursor.setAttribute("height", "25");
      const arrow = document.createElementNS(cursor.namespaceURI, "path");
      arrow.setAttribute("d", "M4 2 20 12 12 14 9 22Z");
      arrow.setAttribute("fill", "#fff");
      arrow.setAttribute("stroke", "#164e3f");
      arrow.setAttribute("stroke-width", "1.5");
      cursor.append(arrow);
      Object.assign(cursor.style, {
        position: "fixed",
        top: "0",
        left: "0",
        zIndex: "999999",
        pointerEvents: "none",
      });
      document.addEventListener("mousemove", (event) => {
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      });
      document.body.append(caption, cursor);
    });
    await subtitle(
      "Step 1 — Your data stays yours. A local privacy round trip.",
    );
    await pause(2400);
    await page.evaluate(() =>
      document
        .getElementById("workspace")
        .scrollIntoView({ behavior: "smooth" }),
    );
    await pause(1500);
    await subtitle(
      "Step 2 — Type fictional details. The preview veils them automatically.",
    );
    await type(
      "#private-draft",
      "Hi, I'm Maya Sharma. Email maya@example.com. Authorization: Bearer synthetic_private_credential_0123456789",
    );
    await expect(page.locator("#protected-text")).toContainText("[PERSON_1]");
    await expect(page.locator("#protected-text")).toContainText("[EMAIL_1]");
    await expect(page.locator("#protected-text")).not.toContainText(
      "maya@example.com",
    );
    await click("#review-findings");
    await subtitle("Step 3 — Review suggestions locally before you share.");
    await pause(2000);
    await page.keyboard.press("Escape");
    await subtitle("Step 4 — Manual fallback: paste a sample masked AI reply.");
    await type(
      "#masked-reply",
      "Hi [PERSON_1]. Contact: [EMAIL_1]. Secret: [SECRET_1].",
    );
    await click("#restore-locally");
    await expect(page.locator("#restored-text")).toContainText(
      "maya@example.com",
    );
    await expect(page.locator("#restored-text")).toContainText("[SECRET_1]");
    await subtitle("Your details return only here. Credentials remain masked.");
    await pause(2200);
    await page.evaluate(() =>
      document.getElementById("alexa").scrollIntoView({ behavior: "smooth" }),
    );
    await pause(1500);
    await subtitle(
      "Step 5 — The Alexa+ simulator calls the real local MCP endpoint.",
    );
    await click("#ask-summary");
    await expect(page.locator("#assistant-result")).toContainText(
      "VeilX masked",
    );
    await pause(2200);
    await subtitle(
      "Download ZIP → Extract → Chrome Developer Mode → Load unpacked",
    );
    await pause(3000);
    console.log(
      rehearse
        ? "REHEARSAL PASSED: all selectors, restoration, and actual MCP result verified."
        : "DEMO RECORDED: manual reply is labeled synthetic; MCP result is real.",
    );
  }
} finally {
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${directory}/veilx-demo.webm`);
  await browser.close();
}
