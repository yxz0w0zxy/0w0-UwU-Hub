const plugins = [
  {
    id: "nexustoons",
    name: "NexusToons",
    version: "1.0.7",
    site: "https://nexustoons.com/",
    domain: "nexustoons.com",
    icon: "https://nexustoons.com/icon.png",
    repository: "https://github.com/yxz0w0zxy/NexusToons",
    adapter: "AES JSON API",
    description: "Conector de leitura para navegar e baixar obras publicadas na NexusToons.",
    tags: ["Português", "Mangá", "Manhwa", "Manhua"]
  },
  {
    id: "plumacomics",
    name: "Pluma Comics",
    version: "1.0.0",
    site: "https://plumacomics.cloud/",
    domain: "plumacomics.cloud",
    icon: "https://plumacomics.cloud/api/img/branding/icon_1782023547094.png",
    repository: "",
    adapter: "HTML Series",
    description: "Conector de leitura para acessar as obras disponíveis na Pluma Comics.",
    tags: ["Português", "Mangá", "Manhwa", "Manhua"]
  }
];

const labels = ["Todos", ...new Set(plugins.flatMap(plugin => plugin.tags))];
const grid = document.querySelector("#pluginGrid");
const template = document.querySelector("#pluginCardTemplate");
const searchInput = document.querySelector("#searchInput");
const filters = document.querySelector("#filters");
const resultCount = document.querySelector("#resultCount");
const pluginCount = document.querySelector("#pluginCount");
const emptyState = document.querySelector("#emptyState");
let activeFilter = "Todos";

pluginCount.textContent = plugins.length;

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
    const haystack = normalize([plugin.name, plugin.domain, plugin.description, ...plugin.tags].join(" "));
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
    card.querySelector(".description").textContent = plugin.description;
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
    const source = card.querySelector(".source-link");
    source.hidden = !plugin.repository;
    if (plugin.repository) source.href = plugin.repository;
    grid.append(card);
  }

  resultCount.textContent = `${visible.length} ${visible.length === 1 ? "resultado" : "resultados"}`;
  emptyState.hidden = visible.length > 0;
}

searchInput.addEventListener("input", render);
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

render();
