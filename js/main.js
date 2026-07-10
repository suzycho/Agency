// Reveal each section's ambient glow as it scrolls into view.
const glowSections = document.querySelectorAll("[data-glow]");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("in-view", entry.isIntersecting);
    });
  },
  { threshold: 0.25 }
);

glowSections.forEach((section) => observer.observe(section));

// Reveal the hero glow immediately on load.
if (glowSections[0]) glowSections[0].classList.add("in-view");

// Soft spotlight that follows the pointer, only on fine-pointer devices.
const cursorGlow = document.getElementById("cursorGlow");

if (window.matchMedia("(pointer: fine)").matches && cursorGlow) {
  let raf = null;

  window.addEventListener("mousemove", (event) => {
    cursorGlow.classList.add("active");
    if (raf) return;
    raf = requestAnimationFrame(() => {
      cursorGlow.style.transform = `translate(${event.clientX - 240}px, ${event.clientY - 240}px)`;
      raf = null;
    });
  });

  window.addEventListener("mouseleave", () => cursorGlow.classList.remove("active"));
}
