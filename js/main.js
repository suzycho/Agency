// Scroll-driven case studies: each panel stays pinned full-screen while the
// next one slides up from below and covers it entirely (a "cover" transition,
// not a push — the outgoing panel never moves, it's just occluded). Every
// panel reserves an extra 100vh of pin duration beyond its own "hold" so it
// stays static for the full length of the next panel's cover-slide.
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

    // travel = ownHold + the 100vh reserved for the next panel to cover this
    // one. Base the name's timing on ownHold alone so it always fades out
    // well before the cover-slide begins, regardless of the reserve.
    const holdPx = Math.max(travel - vh, 1);
    const scrolled = clamp(-rect.top, 0, travel);
    const holdProgress = clamp(scrolled / holdPx, 0, 1);
    const name = panel.querySelector(".case-name");

    // Name fades in once this panel is fully covering (post cover-slide),
    // holds, then fades out before the next panel starts covering it.
    const nameIn = easeOutCubic(clamp((holdProgress - 0.06) / 0.14, 0, 1));
    const nameOut = 1 - easeInOut(clamp((holdProgress - 0.72) / 0.2, 0, 1));
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
