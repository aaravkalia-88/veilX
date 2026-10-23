import { animate } from "motion/mini";
import { inView } from "motion";

const preference = matchMedia("(prefers-reduced-motion: reduce)");
let stopReveals;
let userPaused = false;
const toggle = document.getElementById("toggle-motion");
const animations = new Set();

function configure() {
  stopReveals?.();
  animations.forEach((animation) => animation.stop());
  animations.clear();
  document
    .querySelectorAll(
      ".hero-copy, .hero-visual, .workspace-heading, .below-workspace > section, .privacy-footer",
    )
    .forEach((element) => {
      element.style.opacity = "1";
      element.style.translate = "none";
    });
  const paused = preference.matches || userPaused;
  toggle.disabled = preference.matches;
  toggle.textContent = preference.matches
    ? "Reduced motion enabled"
    : userPaused
      ? "Resume motion"
      : "Pause motion";
  toggle.setAttribute("aria-pressed", String(paused));
  if (paused) return;
  // Content starts visible; an unavailable animation never hides a control or editor.
  stopReveals = inView(
    ".hero-copy, .hero-visual, .workspace-heading, .below-workspace > section, .privacy-footer",
    (element) => {
      const animation = animate(
        element,
        { opacity: [0.65, 1], translate: ["0 18px", "0 0"] },
        { duration: 0.55, ease: "easeOut" },
      );
      animations.add(animation);
      animation.then(() => animations.delete(animation));
    },
    { amount: 0.15 },
  );
}
configure();
toggle.addEventListener("click", () => {
  userPaused = !userPaused;
  configure();
});
preference.addEventListener("change", configure);
addEventListener("pagehide", () => {
  stopReveals?.();
  animations.forEach((animation) => animation.stop());
});
