// Hydrate the homepage from content.json — the file the CMS at /admin edits.
// The HTML keeps a full baked-in copy of the content, so if this fetch fails
// (offline, file:// preview, missing file) the site renders unchanged.
(async function () {
  let content;
  try {
    const res = await fetch("content.json", { cache: "no-store" });
    if (!res.ok) return;
    content = await res.json();
  } catch {
    return;
  }

  const setText = (selector, value) => {
    if (typeof value !== "string") return;
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  if (content.hero) {
    setText(".landing-title", content.hero.title);
    setText(".landing-sub", content.hero.subtitle);
  }

  if (Array.isArray(content.services)) {
    const list = document.querySelector(".service-list");
    if (list) {
      list.textContent = "";
      content.services.forEach((service) => {
        const card = document.createElement("article");
        card.className = "service-card";
        const h3 = document.createElement("h3");
        h3.textContent = service.title || "";
        const p = document.createElement("p");
        p.textContent = service.description || "";
        card.append(h3, p);
        list.appendChild(card);
      });
    }
  }

  if (Array.isArray(content.caseStudies)) {
    document.querySelectorAll(".case-name").forEach((el, i) => {
      const cs = content.caseStudies[i];
      if (cs && typeof cs.name === "string") el.textContent = cs.name;
    });
  }

  if (content.about) {
    setText(".about-intro .section-title", content.about.title);
    setText(".about-lead", content.about.lead);
  }

  if (Array.isArray(content.bios)) {
    const wrap = document.querySelector(".about-bios");
    if (wrap) {
      wrap.textContent = "";
      content.bios.forEach((bio, i) => {
        const article = document.createElement("article");
        article.className = "bio";
        const photo = document.createElement("div");
        photo.className = `bio-photo bio-photo-${i + 1}`;
        photo.setAttribute("aria-hidden", "true");
        const name = document.createElement("h3");
        name.className = "bio-name";
        name.textContent = bio.name || "";
        const role = document.createElement("p");
        role.className = "bio-role";
        role.textContent = bio.role || "";
        const text = document.createElement("p");
        text.className = "bio-text";
        text.textContent = bio.text || "";
        article.append(photo, name, role, text);
        wrap.appendChild(article);
      });
    }
  }

  if (Array.isArray(content.clients)) {
    const wall = document.querySelector(".client-wall");
    if (wall) {
      wall.textContent = "";
      content.clients.forEach((client) => {
        const li = document.createElement("li");
        li.textContent = client;
        wall.appendChild(li);
      });
    }
  }

  if (content.contact && typeof content.contact.email === "string" && content.contact.email) {
    const mailto = `mailto:${content.contact.email}`;
    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => (a.href = mailto));
    setText(".footer-email", content.contact.email);
  }

  if (content.footer) {
    setText(".footer-copy", content.footer.copyright);
    setText(".footer-location", content.footer.location);
  }
})();
