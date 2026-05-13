const API_BASE = "https://api.tibiadata.com/v4";
const HIGHSCORE_PAGE_COUNT = 12;
const LEVEL_RANK_PAGE_COUNT = 20;
const SKILL_HIGHSCORE_PAGE_COUNT = 20;
const TIBIA_READER_BASE = "https://r.jina.ai/http://r.jina.ai/http://";
const TIBIA_HIGHSCORE_CATEGORIES = {
  axe: 2,
  club: 4,
  distance: 5,
  experience: 6,
  fist: 8,
  magic: 11,
  shielding: 12,
  sword: 13,
};
const TIBIA_HIGHSCORE_PROFESSIONS = {
  none: 1,
  knight: 2,
  paladin: 3,
  sorcerer: 4,
  druid: 5,
  monk: 6,
};
const TIBIA_VOCATIONS = [
  "Exalted Monk",
  "Master Sorcerer",
  "Elder Druid",
  "Royal Paladin",
  "Elite Knight",
  "Sorcerer",
  "Paladin",
  "Knight",
  "Druid",
  "Monk",
  "None",
];
const BODY_VOCATION_CLASSES = [
  "vocation-paladin",
  "vocation-sorcerer",
  "vocation-druid",
  "vocation-knight",
  "vocation-monk",
];
const state = {
  tab: "character",
  maxLevel: 2600,
  worlds: [],
  currentCharacter: null,
  currentGuild: null,
};

const windows = [
  ["Diaria", 1],
  ["Semanal", 7],
  ["Mensal", 30],
  ["Semestral", 180],
  ["Anual", 365],
];

const el = {
  levelFilter: document.querySelector("#levelFilter"),
  levelField: document.querySelector("#levelField"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  searchLabel: document.querySelector("#searchLabel"),
  queryField: document.querySelector("#queryField"),
  vocationFilter: document.querySelector("#vocationFilter"),
  vocationField: document.querySelector("#vocationField"),
  worldInput: document.querySelector("#worldInput"),
  worldField: document.querySelector("#worldField"),
  results: document.querySelector("#results"),
  notice: document.querySelector("#notice"),
  segments: document.querySelectorAll(".segment"),
};

function boot() {
  hydrateLevelFilter();
  bindEvents();
  switchTab(state.tab);
  refreshMaxLevel();
  loadWorlds().then(hydrateFromUrl);
}

function bindEvents() {
  el.searchForm.addEventListener("submit", handleSearch);
  el.segments.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
}

function hydrateLevelFilter() {
  const max = Math.ceil(state.maxLevel / 100) * 100;
  const options = ['<option value="all">Todos</option>'];
  for (let start = 0; start <= max; start += 100) {
    const end = start + 99;
    options.push(`<option value="${start}-${end}">${start} a ${end}</option>`);
  }
  el.levelFilter.innerHTML = options.join("");
}

async function refreshMaxLevel() {
  try {
    const data = await fetchJson(`${API_BASE}/highscores/all/experience/all/1`);
    const entries = data?.highscores?.highscore_list || data?.highscores?.entries || [];
    const highest = entries
      .map((entry) => Number(entry.level))
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    if (highest && highest > state.maxLevel) {
      state.maxLevel = highest;
      hydrateLevelFilter();
    }
  } catch {
    state.maxLevel = 2600;
  }
}

function switchTab(tab) {
  state.tab = tab;
  el.segments.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  if (tab === "character") {
    setSearchVisibility({ query: true, world: false, vocation: false, level: false });
    el.searchLabel.textContent = "Nome do personagem";
    el.searchInput.placeholder = "Ex: Hilay";
    el.searchInput.disabled = false;
    el.worldInput.disabled = true;
    el.notice.textContent = "A pagina do personagem tem abas de ficha, experiencia, mortes e skills.";
  }
  if (tab === "guild") {
    setBodyVocation("");
    setSearchVisibility({ query: true, world: false, vocation: false, level: false });
    el.searchLabel.textContent = "Nome da guild";
    el.searchInput.placeholder = "Ex: Bald Dwarfs";
    el.searchInput.disabled = false;
    el.worldInput.disabled = true;
    el.notice.textContent = "A pagina da guild lista membros e prepara abas para experiencia e mortes agregadas por membros.";
  }
  if (tab === "world") {
    setBodyVocation("");
    setSearchVisibility({ query: false, world: true, vocation: true, level: true });
    el.searchInput.disabled = true;
    el.worldInput.disabled = false;
    el.notice.textContent = "Selecione um mundo e, se quiser, uma vocacao. O ranking abre a ficha completa ao clicar no personagem.";
  }
}

function setSearchVisibility({ query, world, vocation, level }) {
  el.queryField.classList.toggle("hidden", !query);
  el.worldField.classList.toggle("hidden", !world);
  el.vocationField.classList.toggle("hidden", !vocation);
  el.levelField.classList.toggle("hidden", !level);
}

async function handleSearch(event) {
  event.preventDefault();

  const query = el.searchInput.value.trim();
  if (state.tab !== "world" && !query) return;

  renderLoading();
  try {
    if (state.tab === "character") {
      const data = await fetchJson(`${API_BASE}/character/${encodeURIComponent(query)}`);
      renderCharacter(data);
      syncUrl({ mode: "character", query });
    } else if (state.tab === "guild") {
      const data = await fetchJson(`${API_BASE}/guild/${encodeURIComponent(query)}`);
      renderGuild(data);
      syncUrl({ mode: "guild", query });
    } else {
      const world = el.worldInput.value.trim();
      if (!world) throw new Error("Selecione um mundo para montar o ranking.");
      const entries = await fetchHighscoreEntries(world, "experience", HIGHSCORE_PAGE_COUNT);
      renderWorldRanking(entries);
      syncUrl({ mode: "world", world, vocation: el.vocationFilter.value });
    }
  } catch (error) {
    renderError(error);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`A API respondeu ${response.status}.`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`A fonte respondeu ${response.status}.`);
  }
  return response.text();
}

async function fetchHighscoreEntries(world, category, pages = 1) {
  const safeWorld = encodeURIComponent(world || "all");
  const requests = Array.from({ length: pages }, (_, index) =>
    fetchJson(`${API_BASE}/highscores/${safeWorld}/${category}/all/${index + 1}`).catch(() => null)
  );
  const responses = await Promise.all(requests);
  return responses.flatMap((data) => data?.highscores?.highscore_list || data?.highscores?.entries || []);
}

async function loadWorlds() {
  try {
    const data = await fetchJson(`${API_BASE}/worlds`);
    const worlds = data?.worlds?.regular_worlds || data?.worlds?.allworlds || data?.worlds?.world_list || [];
    state.worlds = worlds.map((world) => world.name || world).filter(Boolean).sort();
    el.worldInput.innerHTML = ['<option value="">Selecione um mundo</option>']
      .concat(state.worlds.map((world) => `<option value="${escapeHtml(world)}">${escapeHtml(world)}</option>`))
      .join("");
  } catch {
    state.worlds = [];
    el.worldInput.innerHTML = '<option value="">Mundos indisponiveis</option>';
  }
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const query = params.get("query");
  const world = params.get("world");
  const vocation = params.get("vocation");
  if (mode && ["character", "guild", "world"].includes(mode)) switchTab(mode);
  if (query) el.searchInput.value = query;
  if (world) el.worldInput.value = world;
  if (vocation) el.vocationFilter.value = vocation;
}

function getCharacterPayload(data) {
  return data?.character?.character || data?.character || data?.characters?.character || {};
}

function normalizeCharacter(data) {
  const character = getCharacterPayload(data);
  const level = Number(character.level || 0);
  const exactExperience = Number(character.experience || 0);
  const stats = calculateCharacterStats(level, character.vocation || "");
  return {
    name: character.name || "Personagem",
    level,
    vocation: character.vocation || "Desconhecida",
    world: character.world || "-",
    guild: getGuildName(character.guild),
    residence: character.residence || "-",
    sex: character.sex || "-",
    title: character.title || "-",
    achievementPoints: character.achievement_points || character.achievementpoints || "-",
    accountStatus: character.account_status || character.accountstatus || "-",
    hitpoints: Number(character.hitpoints || character.health || 0) || stats.hitpoints,
    mana: Number(character.mana || 0) || stats.mana,
    capacity: Number(character.capacity || 0) || stats.capacity,
    raw: character,
    experience: exactExperience || minimumExperienceForLevel(level),
    lastLogin: character.last_login || character.lastlogin || "-",
  };
}

function renderCharacter(data) {
  const character = normalizeCharacter(data);
  state.currentCharacter = character;
  setBodyVocation(character.vocation);
  saveSnapshot(character);

  el.results.innerHTML = `
    <div class="result-head">
      <div>
        <span class="eyebrow">personagem</span>
        <h2>${escapeHtml(character.name)}</h2>
      </div>
      <button class="ghost-button" type="button" id="snapshotButton">Salvar snapshot</button>
    </div>
    ${renderEntityTabs("character", "overview")}
    <div id="detailPane">${renderCharacterOverview(character)}</div>
  `;

  bindDetailTabs("character");
  hydrateCharacterRanks(character);
  document.querySelector("#snapshotButton").addEventListener("click", () => {
    saveSnapshot(character);
    el.notice.textContent = `Snapshot de ${character.name} salvo no navegador.`;
  });
}

function renderCharacterOverview(character) {
  const monthlyExperience = calculateDelta(character.name, 30);
  const ranks = character.levelRanks || {};
  return `
    <dl class="detail-list">
      ${renderDetail("Nickname", character.name)}
      ${renderDetail("Guild", character.guild)}
      ${renderDetail("Nivel", character.level || "-")}
      ${renderDetail("Vocacao", character.vocation)}
      ${renderDetail("Rank global geral", renderRankText(ranks.globalOverall), "rankGlobalOverall")}
      ${renderDetail("Rank do mundo", renderRankText(ranks.world), "rankWorld")}
      ${renderDetail("Rank da vocacao", renderRankText(ranks.vocation), "rankVocation")}
      ${renderDetail("Cidade", character.residence)}
      ${renderDetail("Experiencia mensal feita", monthlyExperience === null ? "sem historico" : formatNumber(monthlyExperience))}
      ${renderDetail("Experiencia total", formatNumber(character.experience))}
      ${renderDetail("Quantidade de vida", formatNumber(character.hitpoints))}
      ${renderDetail("Quantidade de mana", formatNumber(character.mana))}
      ${renderDetail("Quantidade de capacidade", formatNumber(character.capacity))}
      ${renderDetail("Ultimo login", character.lastLogin)}
    </dl>
  `;
}

function renderCharacterExperience(character) {
  const rows = getExperienceRows(character.name);
  return `
    <div class="inline-note">
      O historico abaixo mostra uma linha por dia salvo. Para preencher semana, mes, semestre e ano completos, o proximo passo e gravar snapshots diarios em banco online.
    </div>
    <table class="member-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Experiencia obtida</th>
          <th>Experiencia atual</th>
          <th>Nivel atual</th>
        </tr>
      </thead>
      <tbody>${rows.map(renderExperienceRow).join("") || renderEmptyRow(4)}</tbody>
    </table>
  `;
}

function renderCharacterDeaths(character) {
  const deaths = getDeathRows(character.raw);
  return `
    <table class="member-table">
      <thead><tr><th>Morreu para</th><th>Nivel</th><th>Data</th></tr></thead>
      <tbody>${deaths.map(renderDeathRow).join("") || renderEmptyRow(3)}</tbody>
    </table>
  `;
}

function renderCharacterSkills(character) {
  const columns = getRelevantSkillColumns(character.vocation);
  return `
    <table class="member-table">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr>${columns.map(() => "<td>Consultando ranking...</td>").join("")}</tr>
      </tbody>
    </table>
  `;
}

async function hydrateCharacterSkills(character) {
  const pane = document.querySelector("#detailPane");
  const columns = getRelevantSkillColumns(character.vocation);
  const results = await Promise.all(columns.map((column) => findSkillRank(character, column)));
  pane.innerHTML = `
    <table class="member-table">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody>
        <tr>${results.map(renderSkillCell).join("")}</tr>
      </tbody>
    </table>
  `;
}

function renderCharacterSkillsUnavailable(character) {
  const columns = getRelevantSkillColumns(character.vocation);
  return `
    <table class="member-table">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
      <tbody><tr>${columns.map(() => "<td>-</td>").join("")}</tr></tbody>
    </table>
  `;
}

function renderGuild(data) {
  const guild = data?.guild || {};
  const members = guild.members || guild.memberlist || [];
  const filtered = members
    .map(normalizeMember)
    .sort((a, b) => b.level - a.level);
  state.currentGuild = { name: guild.name || el.searchInput.value.trim(), members: filtered, raw: guild };

  el.results.innerHTML = `
    <div class="table-toolbar">
      <div>
        <span class="eyebrow">guild</span>
        <h2>${escapeHtml(guild.name || el.searchInput.value.trim())}</h2>
      </div>
      <strong>${filtered.length} membros</strong>
    </div>
    ${renderEntityTabs("guild", "overview")}
    <div id="detailPane">
      ${renderGuildOverview(state.currentGuild)}
    </div>
  `;
  bindDetailTabs("guild");
}

function renderGuildOverview(guild) {
  return `
    <table class="member-table">
      <thead>
        <tr>
          <th>Nickname</th>
          <th>Vocacao</th>
          <th>Nivel</th>
          <th>Experiencia total</th>
          <th>Experiencia mensal</th>
        </tr>
      </thead>
      <tbody>
        ${guild.members.map(renderGuildMemberRow).join("") || renderEmptyRow()}
      </tbody>
    </table>
  `;
}

function renderGuildExperience(guild) {
  const rows = guild.members.map((member) => ({
    name: member.name,
    vocation: member.vocation,
    level: member.level,
    dailyExperience: calculateDelta(member.name, 1),
    weeklyExperience: calculateDelta(member.name, 7),
    monthlyExperience: getMonthlyExperience(member.name),
    semesterExperience: calculateDelta(member.name, 180),
    yearlyExperience: calculateDelta(member.name, 365),
  }));
  return `
    <table class="member-table">
      <thead>
        <tr>
          <th>Nickname</th>
          <th>Vocacao</th>
          <th>Nivel</th>
          <th>Diaria</th>
          <th>Semanal</th>
          <th>Mensal</th>
          <th>Semestral</th>
          <th>Anual</th>
        </tr>
      </thead>
      <tbody>${rows.map(renderGuildExperienceRow).join("") || renderEmptyRow(8)}</tbody>
    </table>
  `;
}

function renderGuildDeaths(guild) {
  return `
    <table class="member-table">
      <thead><tr><th>Nickname</th><th>Morreu para</th><th>Nivel</th><th>Data</th></tr></thead>
      <tbody>${renderEmptyRow(4)}</tbody>
    </table>
  `;
}

function renderWorldRanking(entries) {
  const filtered = entries
    .map(normalizeRankingEntry)
    .filter(applyRankingFilters)
    .sort((a, b) => b.level - a.level || b.experience - a.experience)
    .map((entry, index) => ({ ...entry, displayRank: index + 1 }));

  el.results.innerHTML = `
    <div class="table-toolbar">
      <div>
        <span class="eyebrow">ranking por mundo</span>
        <h2>${escapeHtml(el.worldInput.value.trim())}</h2>
      </div>
      <strong>${filtered.length} personagens</strong>
    </div>
    <table class="member-table">
      <thead><tr><th>#</th><th>Personagem</th><th>Level</th><th>Vocacao</th><th>Experiencia</th><th>Mundo</th></tr></thead>
      <tbody>${filtered.map(renderRankingRow).join("") || renderEmptyRow(6)}</tbody>
    </table>
  `;
  bindCharacterButtons();
}

function normalizeMember(member) {
  const level = Number(member.level || 0);
  return {
    name: member.name || "-",
    rank: member.rank || member.title || "-",
    vocation: member.vocation || "-",
    level,
    experience: Number(member.experience || member.value || 0) || minimumExperienceForLevel(level),
    status: member.status || "-",
  };
}

function normalizeRankingEntry(entry) {
  return {
    rank: entry.rank || entry.position || "-",
    name: entry.name || "-",
    level: Number(entry.level || 0),
    vocation: entry.vocation || "-",
    world: entry.world || el.worldInput.value.trim(),
    experience: Number(entry.value || entry.experience || 0),
  };
}

function applyFilters(member) {
  const vocation = el.vocationFilter.value;
  const level = el.levelFilter.value;
  const vocationOk = vocation === "all" || member.vocation.toLowerCase().includes(vocation);
  if (level === "all") return vocationOk;
  const [min, max] = level.split("-").map(Number);
  return vocationOk && member.level >= min && member.level <= max;
}

function applyRankingFilters(entry) {
  const vocation = el.vocationFilter.value;
  const level = el.levelFilter.value;
  const vocationOk = vocation === "all" || entry.vocation.toLowerCase().includes(vocation);
  if (level === "all") return vocationOk;
  const [min, max] = level.split("-").map(Number);
  return vocationOk && entry.level >= min && entry.level <= max;
}

function renderMemberRow(member) {
  return `
    <tr>
      <td><button class="text-button" data-character="${escapeHtml(member.name)}" type="button">${escapeHtml(member.name)}</button></td>
      <td>${escapeHtml(member.rank)}</td>
      <td>${escapeHtml(member.vocation)}</td>
      <td>${member.level || "-"}</td>
      <td>${escapeHtml(member.status)}</td>
    </tr>
  `;
}

function renderGuildMemberRow(member) {
  return `
    <tr>
      <td><button class="text-button" data-character="${escapeHtml(member.name)}" type="button">${escapeHtml(member.name)}</button></td>
      <td>${escapeHtml(member.vocation)}</td>
      <td>${member.level || "-"}</td>
      <td>${formatNumber(member.experience)}</td>
      <td>${formatOptionalNumber(getMonthlyExperience(member.name))}</td>
    </tr>
  `;
}

function renderGuildExperienceRow(member) {
  return `
    <tr>
      <td><button class="text-button" data-character="${escapeHtml(member.name)}" type="button">${escapeHtml(member.name)}</button></td>
      <td>${escapeHtml(member.vocation)}</td>
      <td>${member.level || "-"}</td>
      <td>${formatOptionalNumber(member.dailyExperience)}</td>
      <td>${formatOptionalNumber(member.weeklyExperience)}</td>
      <td>${formatOptionalNumber(member.monthlyExperience)}</td>
      <td>${formatOptionalNumber(member.semesterExperience)}</td>
      <td>${formatOptionalNumber(member.yearlyExperience)}</td>
    </tr>
  `;
}

function renderRankingRow(entry, index) {
  return `
    <tr>
      <td>${entry.displayRank || index + 1}</td>
      <td><button class="text-button" data-character="${escapeHtml(entry.name)}" type="button">${escapeHtml(entry.name)}</button></td>
      <td>${entry.level || "-"}</td>
      <td>${escapeHtml(entry.vocation)}</td>
      <td>${formatNumber(entry.experience)}</td>
      <td>${escapeHtml(entry.world)}</td>
    </tr>
  `;
}

function renderEmptyRow(colspan = 5) {
  return `<tr><td colspan="${colspan}">Nenhum registro bateu com os filtros atuais.</td></tr>`;
}

function saveSnapshot(character) {
  if (!character.experience) return;
  const key = `tibiascope:snapshots:${character.name.toLowerCase()}`;
  const snapshots = readStorage(key, []);
  const date = new Date();
  const dateKey = toDateKey(date);
  const nextSnapshot = {
    date: new Date().toISOString(),
    dateKey,
    level: character.level,
    experience: character.experience,
    vocation: character.vocation,
    world: character.world,
  };
  const withoutToday = snapshots.filter((snapshot) => (snapshot.dateKey || toDateKey(snapshot.date)) !== dateKey);
  writeStorage(key, [nextSnapshot, ...withoutToday].slice(0, 500));
}

function calculateDelta(name, days) {
  const snapshots = getSnapshots(name);
  if (snapshots.length < 2) return null;
  const now = snapshots[0];
  const targetTime = Date.now() - days * 24 * 60 * 60 * 1000;
  const older = snapshots
    .filter((snapshot) => new Date(snapshot.date).getTime() <= targetTime)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (!older) return null;
  return Number(now.experience) - Number(older.experience);
}

function getMonthlyExperience(name) {
  return calculateDelta(name, 30);
}

function getSnapshots(name) {
  const key = `tibiascope:snapshots:${name.toLowerCase()}`;
  const byDate = new Map();
  readStorage(key, [])
    .filter((snapshot) => snapshot.date && snapshot.experience)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((snapshot) => {
      const dateKey = snapshot.dateKey || toDateKey(snapshot.date);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { ...snapshot, dateKey });
      }
    });
  return Array.from(byDate.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function renderDelta(label, value) {
  return `
    <div class="delta">
      <small>${label}</small>
      <strong>${value === null ? "sem historico" : formatNumber(value)}</strong>
    </div>
  `;
}

function renderDetail(label, value, id = "") {
  const idAttribute = id ? ` id="${id}"` : "";
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd${idAttribute}>${escapeHtml(String(value || "-"))}</dd>
    </div>
  `;
}

function getExperienceRows(name) {
  const snapshots = getSnapshots(name);
  return snapshots.map((snapshot, index) => {
    const previous = snapshots[index + 1];
    return {
      date: formatDate(snapshot.date),
      gained: previous ? Number(snapshot.experience) - Number(previous.experience) : null,
      experience: Number(snapshot.experience),
      level: snapshot.level,
    };
  });
}

function renderExperienceRow(row) {
  return `
    <tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${formatOptionalNumber(row.gained)}</td>
      <td>${formatNumber(row.experience)}</td>
      <td>${row.level || "-"}</td>
    </tr>
  `;
}

function getDeathRows(raw) {
  const deaths = raw.deaths || raw.character_deaths || [];
  if (!Array.isArray(deaths)) return [];
  return deaths.map((death) => ({
    reason: death.reason || getKillersText(death.killers) || death.by || "Morte registrada",
    level: death.level || raw.level || "-",
    date: death.time || death.date || "-",
  }));
}

function getKillersText(killers) {
  if (!Array.isArray(killers)) return "";
  return killers.map((killer) => killer.name || killer).filter(Boolean).join(", ");
}

function renderDeathRow(row) {
  return `
    <tr>
      <td>${escapeHtml(row.reason)}</td>
      <td>${escapeHtml(String(row.level || "-"))}</td>
      <td>${escapeHtml(row.date || "-")}</td>
    </tr>
  `;
}

function getRelevantSkillColumns(vocation = "") {
  const lower = vocation.toLowerCase();
  if (lower.includes("paladin")) {
    return [
      { key: "distance", label: "Distance skill", category: "distance" },
      { key: "magicLevel", label: "Magic level skill", category: "magic" },
    ];
  }
  if (lower.includes("monk")) {
    return [
      { key: "melee", label: "Melee skill", category: "fist" },
      { key: "magicLevel", label: "Magic level skill", category: "magic" },
    ];
  }
  if (lower.includes("druid") || lower.includes("sorcerer")) {
    return [{ key: "magicLevel", label: "Magic level skill", category: "magic" }];
  }
  if (lower.includes("knight")) {
    return [
      { key: "sword", label: "Sword", category: "sword" },
      { key: "axe", label: "Axe", category: "axe" },
      { key: "club", label: "Club", category: "club" },
      { key: "shielding", label: "Shield", category: "shielding" },
    ];
  }
  return [
    { key: "magicLevel", label: "Magic level skill", category: "magic" },
    { key: "shielding", label: "Shield", category: "shielding" },
  ];
}

async function findSkillRank(character, column) {
  if (!character.world || character.world === "-") return null;
  const vocation = getHighscoreVocation(character.vocation);
  const vocationRank = await findTibiaComHighscoreRank(character, column.category, vocation, SKILL_HIGHSCORE_PAGE_COUNT);
  if (vocationRank) return vocationRank;

  const entries = await fetchHighscoreEntries(character.world, column.category, HIGHSCORE_PAGE_COUNT);
  const sameVocationEntries = entries
    .map(normalizeRankingEntry)
    .filter((entry) => isSameVocationFamily(entry.vocation, vocation));
  const matchIndex = sameVocationEntries.findIndex((entry) => normalizeName(entry.name) === normalizeName(character.name));
  if (matchIndex < 0) return null;
  const match = sameVocationEntries[matchIndex];
  return {
    rank: matchIndex + 1,
    value: match.experience,
  };
}

async function findTibiaComHighscoreRank(character, categoryKey, vocation, pages = SKILL_HIGHSCORE_PAGE_COUNT) {
  const category = TIBIA_HIGHSCORE_CATEGORIES[categoryKey];
  const profession = TIBIA_HIGHSCORE_PROFESSIONS[vocation];
  if (!category || !profession) return null;

  for (let page = 1; page <= pages; page += 1) {
    const target = `https://www.tibia.com/community/?subtopic=highscores&world=${encodeURIComponent(character.world)}&category=${category}&profession=${profession}&currentpage=${page}`;
    const text = await fetchText(`${TIBIA_READER_BASE}${target}`).catch(() => "");
    const entries = parseTibiaComHighscores(text, character.world);
    const match = entries.find((entry) => normalizeName(entry.name) === normalizeName(character.name));
    if (match) {
      return {
        rank: match.rank,
        value: match.value,
      };
    }
    if (!entries.length) return null;
  }
  return null;
}

function parseTibiaComHighscores(text, world) {
  const safeWorld = escapeRegExp(world);
  const vocationPattern = TIBIA_VOCATIONS.map(escapeRegExp).join("|");
  const rowPattern = new RegExp(`(\\d+)\\[([^\\]]+)\\]\\([^)]*\\)(${vocationPattern})\\s+${safeWorld}\\s+(\\d+)\\s+([\\d,]+)`, "g");
  const entries = [];
  let match = rowPattern.exec(text);
  while (match) {
    entries.push({
      rank: Number(match[1]),
      name: decodeText(match[2]),
      vocation: match[3],
      world,
      level: Number(match[4]),
      value: Number(match[5].replace(/,/g, "")),
    });
    match = rowPattern.exec(text);
  }
  return entries;
}

function renderSkillCell(result) {
  if (!result) return "<td>Fora do ranking consultado</td>";
  return `
    <td>
      <strong>${formatNumber(result.value)}</strong>
      <small>Rank da vocacao #${escapeHtml(String(result.rank))}</small>
    </td>
  `;
}

async function hydrateCharacterRanks(character) {
  const ranks = await findLevelRanks(character).catch(() => ({
    globalOverall: null,
    world: null,
    vocation: null,
  }));
  if (state.currentCharacter?.name !== character.name) return;
  character.levelRanks = ranks;
  updateRankDetail("rankGlobalOverall", ranks.globalOverall);
  updateRankDetail("rankWorld", ranks.world);
  updateRankDetail("rankVocation", ranks.vocation);
}

async function findLevelRanks(character) {
  const vocation = getHighscoreVocation(character.vocation);
  const [globalEntries, worldEntries, vocationRank] = await Promise.all([
    fetchHighscoreEntries("all", "experience", LEVEL_RANK_PAGE_COUNT),
    fetchHighscoreEntries(character.world, "experience", LEVEL_RANK_PAGE_COUNT),
    findTibiaComHighscoreRank(character, "experience", vocation, LEVEL_RANK_PAGE_COUNT),
  ]);

  const globalMatch = globalEntries
    .map(normalizeRankingEntry)
    .find((entry) => normalizeName(entry.name) === normalizeName(character.name) && entry.world === character.world);
  const worldMatch = worldEntries
    .map(normalizeRankingEntry)
    .find((entry) => normalizeName(entry.name) === normalizeName(character.name));

  const fallbackVocationRank = (() => {
    if (vocationRank) return vocationRank.rank;
    const sameVocation = worldEntries
      .map(normalizeRankingEntry)
      .filter((entry) => isSameVocationFamily(entry.vocation, vocation))
      .sort((a, b) => b.level - a.level || b.experience - a.experience);
    const index = sameVocation.findIndex((entry) => normalizeName(entry.name) === normalizeName(character.name));
    return index >= 0 ? index + 1 : null;
  })();

  return {
    globalOverall: globalMatch?.rank || null,
    world: worldMatch?.rank || null,
    vocation: fallbackVocationRank,
  };
}

function renderEntityTabs(type, active) {
  const tabs =
    type === "character"
      ? [["overview", "Ficha"], ["experience", "Experiencia"], ["deaths", "Mortes"], ["skills", "Skills"]]
      : [["overview", "Membros"], ["experience", "Experiencia"], ["deaths", "Mortes"]];
  return `
    <div class="detail-tabs" role="tablist">
      ${tabs.map(([id, label]) => `<button class="detail-tab ${id === active ? "active" : ""}" data-detail="${id}" type="button">${label}</button>`).join("")}
    </div>
  `;
}

function bindDetailTabs(type) {
  document.querySelectorAll(".detail-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".detail-tab").forEach((item) => item.classList.toggle("active", item === button));
      const pane = document.querySelector("#detailPane");
      const detail = button.dataset.detail;
      if (type === "character") {
        const character = state.currentCharacter;
        if (detail === "overview") pane.innerHTML = renderCharacterOverview(character);
        if (detail === "experience") pane.innerHTML = renderCharacterExperience(character);
        if (detail === "deaths") pane.innerHTML = renderCharacterDeaths(character);
        if (detail === "skills") {
          pane.innerHTML = renderCharacterSkills(character);
          hydrateCharacterSkills(character).catch(() => {
            pane.innerHTML = renderCharacterSkillsUnavailable(character);
          });
        }
      } else {
        const guild = state.currentGuild;
        if (detail === "overview") pane.innerHTML = renderGuildOverview(guild);
        if (detail === "experience") pane.innerHTML = renderGuildExperience(guild);
        if (detail === "deaths") pane.innerHTML = renderGuildDeaths(guild);
        bindCharacterButtons();
      }
    });
  });
  bindCharacterButtons();
}

function bindCharacterButtons() {
  document.querySelectorAll("[data-character]").forEach((button) => {
    button.addEventListener("click", async () => {
      switchTab("character");
      el.searchInput.value = button.dataset.character;
      renderLoading();
      try {
        const data = await fetchJson(`${API_BASE}/character/${encodeURIComponent(button.dataset.character)}`);
        renderCharacter(data);
        syncUrl({ mode: "character", query: button.dataset.character });
      } catch (error) {
        renderError(error);
      }
    });
  });
}

function syncUrl(params) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) next.set(key, value);
  });
  window.history.replaceState({}, "", `${window.location.pathname}?${next.toString()}`);
}

function readStorage(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // O site continua funcionando mesmo se o navegador bloquear armazenamento local.
  }
}

function renderStat(label, value) {
  return `
    <div class="stat">
      <span>${label}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderLoading() {
  el.results.innerHTML = `
    <div class="empty-state">
      <h2>Consultando dados...</h2>
      <p>A busca pode levar alguns segundos dependendo do cache da API.</p>
    </div>
  `;
}

function renderError(error) {
  el.results.innerHTML = `
    <div class="empty-state">
      <h2>Nao foi possivel buscar agora</h2>
      <p>${escapeHtml(error.message)} Confira o nome pesquisado ou tente novamente.</p>
    </div>
  `;
}

function formatNumber(value) {
  if (!Number(value)) return "-";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatOptionalNumber(value) {
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function renderRankText(value) {
  if (value === undefined) return "consultando...";
  if (value === null) return "fora do top consultado";
  return `#${formatNumber(value)}`;
}

function updateRankDetail(id, value) {
  const target = document.querySelector(`#${id}`);
  if (target) {
    target.textContent = renderRankText(value);
  }
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function setBodyVocation(vocation = "") {
  document.body.classList.remove(...BODY_VOCATION_CLASSES);
  const family = getHighscoreVocation(vocation);
  if (["paladin", "sorcerer", "druid", "knight", "monk"].includes(family)) {
    document.body.classList.add(`vocation-${family}`);
  }
}

function getHighscoreVocation(vocation = "") {
  const lower = vocation.toLowerCase();
  if (lower.includes("knight")) return "knight";
  if (lower.includes("paladin")) return "paladin";
  if (lower.includes("sorcerer")) return "sorcerer";
  if (lower.includes("druid")) return "druid";
  if (lower.includes("monk")) return "monk";
  if (lower === "none") return "none";
  return "all";
}

function getGuildName(guild) {
  if (!guild) return "-";
  if (typeof guild === "string") return guild;
  return guild.name || guild.guild_name || guild.guild || "-";
}

function isSameVocationFamily(vocation = "", family = "all") {
  if (family === "all") return true;
  return vocation.toLowerCase().includes(family);
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function decodeText(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function minimumExperienceForLevel(level) {
  if (!level || level < 2) return 0;
  return Math.floor((50 * level ** 3 - 300 * level ** 2 + 850 * level - 600) / 3);
}

function calculateCharacterStats(level, vocation) {
  const lower = vocation.toLowerCase();
  if (lower.includes("knight")) {
    return {
      hitpoints: 5 * (3 * level + 13),
      mana: 5 * (level + 10),
      capacity: 5 * (5 * level + 54),
    };
  }
  if (lower.includes("paladin")) {
    return {
      hitpoints: 5 * (2 * level + 21),
      mana: 5 * (3 * level - 6),
      capacity: 10 * (2 * level + 31),
    };
  }
  if (lower.includes("monk")) {
    return {
      hitpoints: 5 * (2 * level + 21),
      mana: 5 * (2 * level - 9),
      capacity: 5 * (5 * level + 54),
    };
  }
  if (lower.includes("druid") || lower.includes("sorcerer")) {
    return {
      hitpoints: 5 * (level + 29),
      mana: 5 * (6 * level - 30),
      capacity: 10 * (level + 39),
    };
  }
  return {
    hitpoints: 5 * (level + 29),
    mana: 5 * (level + 10),
    capacity: 10 * (level + 39),
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

boot();
