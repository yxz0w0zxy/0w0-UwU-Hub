const plugins = [
  {
    id: "nexustoons",
    name: "NexusToons",
    version: "1.0.7",
    site: "https://nexustoons.com/",
    domain: "nexustoons.com",
    icon: "https://nexustoons.com/icon.png",
    adapter: "AES JSON API",
    tags: ["Manhwa", "Manhua"]
  },
  {
    id: "plumacomics",
    name: "Pluma Comics",
    version: "1.0.0",
    site: "https://plumacomics.cloud/",
    domain: "plumacomics.cloud",
    icon: "https://plumacomics.cloud/api/img/branding/icon_1782023547094.png",
    adapter: "HTML Series",
    tags: ["Manhwa", "Manhua"]
  }
];

const labels = ["Todos", ...new Set(plugins.flatMap(plugin => plugin.tags))];
const grid = document.querySelector("#pluginGrid");
const template = document.querySelector("#pluginCardTemplate");
const searchInput = document.querySelector("#searchInput");
const filters = document.querySelector("#filters");
const emptyState = document.querySelector("#emptyState");
const toast = document.querySelector("#toast");
const catalogUrl = new URL("catalog.json", window.location.href).href;
let activeFilter = "Todos";
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function installPlugin(plugin) {
  const bridge = globalThis.NyxoviraAndroidBridge || globalThis.ArchiveInkAndroidBridge;
  if (!bridge || typeof bridge.installCommunityPlugin !== "function") {
    showToast("Abra este site pelo Nyxovira em Sites → Sites externos para instalar.");
    return;
  }

  try {
    const result = JSON.parse(bridge.installCommunityPlugin(catalogUrl, JSON.stringify({ id: plugin.id })) || "{}");
    showToast(result.message || (result.success ? "Plugin instalado." : "Não foi possível instalar."));
  } catch {
    showToast("Não foi possível concluir a instalação direta.");
  }
}

for (const label of labels) {
  const button = document.createElement("button");
  button.className = `filter${label === activeFilter ? " is-active" : ""}`;
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(label === activeFilter));
  button.addEventListener("click", () => {
    activeFilter = label;
    document.querySelectorAll(".filter").forEach(item => {
      const selected = item.textContent === label;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    render();
  });
  filters.append(button);
}

function normalize(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function render() {
  const query = normalize(searchInput.value.trim());
  const visible = plugins.filter(plugin => {
    const filterMatch = activeFilter === "Todos" || plugin.tags.includes(activeFilter);
    const haystack = normalize([plugin.name, plugin.domain, ...plugin.tags].join(" "));
    return filterMatch && haystack.includes(query);
  });

  grid.replaceChildren();
  for (const plugin of visible) {
    const card = template.content.firstElementChild.cloneNode(true);
    const icon = card.querySelector(".plugin-icon");
    icon.src = plugin.icon;
    icon.alt = `Ícone do ${plugin.name}`;
    icon.addEventListener("error", () => { icon.src = "assets/logo.svg"; }, { once: true });
    card.querySelector("h3").textContent = plugin.name;
    card.querySelector(".domain").textContent = plugin.domain;
    card.querySelector(".version").textContent = `Versão ${plugin.version}`;
    card.querySelector(".adapter").textContent = plugin.adapter;
    for (const tag of plugin.tags) {
      const element = document.createElement("span");
      element.className = "tag";
      element.textContent = tag;
      card.querySelector(".tags").append(element);
    }
    const site = card.querySelector(".open-site");
    site.href = plugin.site;
    site.setAttribute("aria-label", `Abrir o site ${plugin.name}`);
    card.querySelector(".install-plugin").addEventListener("click", () => installPlugin(plugin));
    grid.append(card);
  }

  emptyState.hidden = visible.length > 0;
}

searchInput.addEventListener("input", render);
render();
