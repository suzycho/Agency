// Skeptical site editor. Sign in with an approved email, edit the content
// model, save — the API commits content.json to the repo and the site
// redeploys with the new copy.
(function () {
  const $ = (sel) => document.querySelector(sel);

  const loginView = $("#loginView");
  const editorView = $("#editorView");
  const emailForm = $("#emailForm");
  const codeForm = $("#codeForm");
  const loginStatus = $("#loginStatus");
  const saveStatus = $("#saveStatus");

  let content = null;

  // ---------- tiny helpers ----------

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...options,
    });
    let body = {};
    try {
      body = await res.json();
    } catch {}
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  function setStatus(el, message, kind) {
    el.textContent = message || "";
    el.className = `status${kind ? ` ${kind}` : ""}`;
  }

  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
    target[last] = value;
  }

  function field(labelText, kind, value, oninput) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = kind === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (kind === "textarea") input.rows = 3;
    else input.type = "text";
    input.value = value || "";
    input.addEventListener("input", () => oninput(input.value));
    label.appendChild(input);
    return label;
  }

  // ---------- sign-in flow ----------

  emailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#sendCodeBtn");
    btn.disabled = true;
    setStatus(loginStatus, "sending…");
    try {
      const result = await api("../api/request-code", {
        method: "POST",
        body: JSON.stringify({ email: $("#loginEmail").value }),
      });
      emailForm.hidden = true;
      codeForm.hidden = false;
      $("#loginCode").focus();
      setStatus(
        loginStatus,
        result.emailConfigured === false
          ? "Email delivery isn't set up yet — ask the site owner for your code."
          : result.message,
        "ok"
      );
    } catch (err) {
      setStatus(loginStatus, err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  $("#backToEmail").addEventListener("click", () => {
    codeForm.hidden = true;
    emailForm.hidden = false;
    setStatus(loginStatus, "");
  });

  codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus(loginStatus, "checking…");
    try {
      await api("../api/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: $("#loginEmail").value, code: $("#loginCode").value }),
      });
      setStatus(loginStatus, "");
      await openEditor();
    } catch (err) {
      setStatus(loginStatus, err.message, "error");
    }
  });

  $("#signOutBtn").addEventListener("click", async () => {
    try {
      await api("../api/session", { method: "DELETE" });
    } catch {}
    editorView.hidden = true;
    loginView.hidden = false;
    codeForm.hidden = true;
    emailForm.hidden = false;
    setStatus(loginStatus, "signed out.", "ok");
  });

  // ---------- editor ----------

  async function openEditor() {
    try {
      const result = await api("../api/content");
      content = result.content;
    } catch (err) {
      // Fall back to the deployed file so the editor still opens (saving
      // will surface its own error if the server isn't fully configured).
      try {
        content = await (await fetch("../content.json", { cache: "no-store" })).json();
        setStatus(saveStatus, `Loaded from the live site (${err.message})`, "error");
      } catch {
        setStatus(loginStatus, err.message, "error");
        return;
      }
    }
    loginView.hidden = true;
    editorView.hidden = false;
    render();
  }

  function render() {
    // simple dotted-path fields
    document.querySelectorAll("[data-path]").forEach((input) => {
      const path = input.dataset.path;
      input.value = getPath(content, path) || "";
      input.oninput = () => setPath(content, path, input.value);
    });

    renderServices();
    renderCases();
    renderBios();

    const clientsField = $("#clientsField");
    clientsField.value = (content.clients || []).join("\n");
    clientsField.oninput = () => {
      content.clients = clientsField.value.split("\n").map((s) => s.trim()).filter(Boolean);
    };
  }

  function renderServices() {
    const wrap = $("#servicesList");
    wrap.textContent = "";
    (content.services || []).forEach((service, i) => {
      const item = document.createElement("div");
      item.className = "repeat-item";
      item.append(
        removeButton(() => {
          content.services.splice(i, 1);
          renderServices();
        }),
        field("Service name", "input", service.title, (v) => (service.title = v)),
        field("Description", "textarea", service.description, (v) => (service.description = v))
      );
      wrap.appendChild(item);
    });
  }

  function renderCases() {
    const wrap = $("#caseList");
    wrap.textContent = "";
    (content.caseStudies || []).forEach((cs, i) => {
      wrap.appendChild(field(`Project ${i + 1}`, "input", cs.name, (v) => (cs.name = v)));
    });
  }

  function renderBios() {
    const wrap = $("#biosList");
    wrap.textContent = "";
    (content.bios || []).forEach((bio, i) => {
      const item = document.createElement("div");
      item.className = "repeat-item";
      item.append(
        removeButton(() => {
          content.bios.splice(i, 1);
          renderBios();
        }),
        field("Name", "input", bio.name, (v) => (bio.name = v)),
        field("Role", "input", bio.role, (v) => (bio.role = v)),
        field("Bio", "textarea", bio.text, (v) => (bio.text = v))
      );
      wrap.appendChild(item);
    });
  }

  function removeButton(onclick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "remove-btn";
    btn.textContent = "remove";
    btn.addEventListener("click", onclick);
    return btn;
  }

  $("#addServiceBtn").addEventListener("click", () => {
    content.services = content.services || [];
    content.services.push({ title: "", description: "" });
    renderServices();
  });

  $("#addBioBtn").addEventListener("click", () => {
    content.bios = content.bios || [];
    content.bios.push({ name: "", role: "", text: "" });
    renderBios();
  });

  $("#saveBtn").addEventListener("click", async () => {
    const btn = $("#saveBtn");
    btn.disabled = true;
    setStatus(saveStatus, "saving…");
    try {
      const result = await api("../api/content", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setStatus(saveStatus, result.message || "saved.", "ok");
    } catch (err) {
      setStatus(saveStatus, err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- boot: skip sign-in if a session cookie is still valid ----------

  (async function boot() {
    try {
      const session = await api("../api/session");
      if (session.signedIn) {
        await openEditor();
        return;
      }
    } catch {}
    loginView.hidden = false;
  })();
})();
