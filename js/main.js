// Scroll-driven case studies: full-bleed pinned images that slide full-screen
// to full-screen, each name revealing while its image is held. The last panel
// stays pinned while the following sections scroll up over it (handled in CSS).
const casePanels = Array.from(document.querySelectorAll("[data-case-panel]"));
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function updateCasePanels() {
  const vh = window.innerHeight;

  casePanels.forEach((panel) => {
    const rect = panel.getBoundingClientRect();
    const travel = panel.offsetHeight - vh;
    if (travel <= 0) return;

    const progress = clamp(-rect.top / travel, 0, 1);
    const name = panel.querySelector(".case-name");

    // Name fades in while the image is held, then out before it slides away.
    const nameIn = easeOutCubic(clamp((progress - 0.08) / 0.16, 0, 1));
    const nameOut = 1 - easeInOut(clamp((progress - 0.72) / 0.18, 0, 1));
    name.style.opacity = nameIn * nameOut;
    name.style.transform = `translateY(${lerp(26, 0, nameIn)}px)`;
  });
}

// Reveal the top nav once the hero (landing) has scrolled out of view.
const siteNav = document.getElementById("siteNav");
const landing = document.querySelector(".landing");

if (siteNav && landing) {
  const navObserver = new IntersectionObserver(
    ([entry]) => siteNav.classList.toggle("visible", !entry.isIntersecting),
    { threshold: 0 }
  );
  navObserver.observe(landing);
}

// Play each case-study video only while it's on screen (autoplay policies pause
// offscreen videos, and this keeps just the visible one running).
const caseVideos = document.querySelectorAll(".case-video");

if (caseVideos.length) {
  const videoObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.play().catch(() => {});
        } else {
          entry.target.pause();
        }
      });
    },
    { threshold: 0.15 }
  );

  caseVideos.forEach((video) => videoObserver.observe(video));
}

if (casePanels.length && !prefersReducedMotion) {
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateCasePanels();
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  updateCasePanels();
}
