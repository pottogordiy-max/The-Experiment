globalThis.__EXPERIMENT_ASSETS__ = {"/index.html":"<!doctype html>\n<html lang=\"ru\">\n<head>\n  <meta charset=\"utf-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\" />\n  <meta name=\"theme-color\" content=\"#0a0c0b\" />\n  <title>THE EXPERIMENT</title>\n  <link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230a0c0b'/%3E%3Ccircle cx='8' cy='8' r='3' fill='%235fbf8a'/%3E%3C/svg%3E\" />\n  <link rel=\"stylesheet\" href=\"/style.css\" />\n</head>\n<body>\n  <div id=\"app\"></div>\n  <div class=\"toasts\" id=\"toasts\" aria-live=\"polite\"></div>\n  <script type=\"module\" src=\"/app.js\"></script>\n</body>\n</html>\n","/app.js":"// THE EXPERIMENT — клиент. Без сборки и зависимостей.\n// Клиент ничего не решает: все балансы, права и исходы приходят с сервера.\n\nconst $app = document.getElementById('app');\nconst $toasts = document.getElementById('toasts');\n\n// ---------------- Утилиты ----------------\nfunction h(tag, props, ...kids) {\n  const el = document.createElement(tag);\n  for (const [k, v] of Object.entries(props || {})) {\n    if (v == null || v === false) continue;\n    if (k === 'class') el.className = v;\n    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);\n    else if (k === 'style') el.style.cssText = v;\n    else el.setAttribute(k, v === true ? '' : v);\n  }\n  for (const kid of kids.flat(Infinity)) {\n    if (kid == null || kid === false) continue;\n    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));\n  }\n  return el;\n}\nconst SVGNS = 'http://www.w3.org/2000/svg';\nfunction s(tag, attrs, ...kids) {\n  const el = document.createElementNS(SVGNS, tag);\n  for (const [k, v] of Object.entries(attrs || {})) {\n    if (v == null) continue;\n    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);\n    else el.setAttribute(k, v);\n  }\n  for (const kid of kids.flat(Infinity)) {\n    if (kid == null || kid === false) continue;\n    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));\n  }\n  return el;\n}\n\nasync function api(method, path, body) {\n  const res = await fetch(path, {\n    method,\n    headers: body !== undefined ? { 'Content-Type': 'application/json', 'X-Experiment': '1' } : {},\n    body: body !== undefined ? JSON.stringify(body) : undefined,\n    credentials: 'same-origin',\n  });\n  const data = await res.json().catch(() => ({}));\n  if (!res.ok) {\n    const err = new Error(data.message || 'Ошибка системы');\n    err.code = data.error;\n    err.status = res.status;\n    throw err;\n  }\n  return data;\n}\nconst post = (p, b = {}) => api('POST', p, b);\nconst get = (p) => api('GET', p);\n\nconst fmtTime = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });\nconst fmtClock = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });\nconst fmtCR = (n) => `${Number(n).toLocaleString('ru-RU')} CR`;\nfunction fmtLeft(ms) {\n  if (ms <= 0) return 'завершается…';\n  const hh = Math.floor(ms / 3600000), mm = Math.floor((ms % 3600000) / 60000), ss = Math.floor((ms % 60000) / 1000);\n  return hh > 0 ? `${hh} ч ${String(mm).padStart(2, '0')} мин` : `${mm}:${String(ss).padStart(2, '0')}`;\n}\n\nfunction toast(title, body, kind = 'ok') {\n  const el = h('div', { class: `toast ${kind === 'err' ? 'err' : ''}` }, h('div', { class: 'tt' }, title), body ? h('div', {}, body) : null);\n  $toasts.append(el);\n  const max = innerWidth < 760 ? 2 : 3;\n  while ($toasts.children.length > max) $toasts.firstChild.remove();\n  setTimeout(() => el.remove(), 4000);\n}\nconst showError = (e) => toast('ОТКАЗ СИСТЕМЫ', e.message, 'err');\n\nconst store = {\n  get(k) { try { return localStorage.getItem(k); } catch { return null; } },\n  set(k, v) { try { localStorage.setItem(k, v); } catch {} },\n};\n\n// ---------------- Состояние ----------------\nconst state = {\n  me: null,\n  view: 'main',\n  trials: [],\n  notes: [],\n  selection: null,\n  mapLevel: 'plot',\n  es: null,\n  chatAppend: null,\n};\n\nconst LEXICON = {\n  START_GRANT: 'Стартовое обеспечение', SYSTEM_WAGE: 'Системная зарплата', HOME_UPGRADE: 'Улучшение жилья',\n  FUND_DONATION: 'Взнос в фонд', TRIAL_CONTRIBUTION: 'Взнос в испытании', TRIAL_PENALTY: 'Штраф испытания',\n};\n\nconst SECTIONS = [\n  { key: 'main', title: 'Главная', ico: '◉' },\n  { key: 'map', title: 'Карта', ico: '▦' },\n  { key: 'house', title: 'Дом', ico: '⌂' },\n  { key: 'neighbors', title: 'Соседи', ico: '⁘' },\n  { key: 'comms', title: 'Связь', ico: '✉' },\n  { key: 'work', title: 'Работа', ico: '⚒' },\n  { key: 'economy', title: 'Экономика', ico: '¤' },\n  { key: 'enterprises', title: 'Предприятия', locked: 'Регистрация предприятий, производственные циклы и доли' },\n  { key: 'orgs', title: 'Организации', locked: 'Партии, корпорации, профсоюзы и движения' },\n  { key: 'politics', title: 'Политика', locked: 'Представитель участка, районный совет, законы и референдумы' },\n  { key: 'trials', title: 'Испытания', ico: '△' },\n  { key: 'investigations', title: 'Расследования', locked: 'Игровые улики и расследования' },\n  { key: 'court', title: 'Суд', locked: 'Иски, присяжные и приговоры' },\n  { key: 'profile', title: 'Профиль', ico: '◎' },\n  { key: 'notifications', title: 'Уведомления', ico: '!' },\n];\nconst MOBILE_NAV = ['main', 'map', 'comms', 'work'];\n\n// ---------------- Загрузка ----------------\nasync function boot() {\n  try {\n    state.me = await get('/api/me');\n    startShell();\n  } catch {\n    renderAuth();\n  }\n}\n\n// ---------------- Вход ----------------\nfunction renderAuth(mode = 'register') {\n  const err = h('div', { class: 'err' });\n  const user = h('input', { class: 'input', name: 'username', autocomplete: 'username', placeholder: 'имя (латиница, 3–20)', required: true, maxlength: 20 });\n  const pass = h('input', { class: 'input', name: 'password', type: 'password', autocomplete: mode === 'register' ? 'new-password' : 'current-password', placeholder: 'пароль (от 8 символов)', required: true });\n  const btn = h('button', { class: 'btn primary', type: 'submit' }, mode === 'register' ? 'Стать испытуемым' : 'Войти в систему');\n  const form = h('form', {\n    onsubmit: async (e) => {\n      e.preventDefault();\n      err.textContent = '';\n      btn.disabled = true;\n      try {\n        state.me = await post(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { username: user.value.trim(), password: pass.value });\n        if (mode === 'register') renderWelcome();\n        else startShell();\n      } catch (ex) {\n        err.textContent = ex.message;\n        btn.disabled = false;\n      }\n    },\n  }, user, pass, err, btn);\n\n  $app.replaceChildren(h('div', { class: 'screen-center' }, h('div', { class: 'auth' },\n    h('div', { class: 'brand' }, 'HUMANITY PROTOCOL'),\n    h('h1', {}, 'THE EXPERIMENT'),\n    h('div', { class: 'sub' }, 'Участие добровольное. Выход из эксперимента не предусмотрен.'),\n    h('div', { class: 'tabs' },\n      h('button', { class: `tab ${mode === 'register' ? 'active' : ''}`, onclick: () => renderAuth('register') }, 'Регистрация'),\n      h('button', { class: `tab ${mode === 'login' ? 'active' : ''}`, onclick: () => renderAuth('login') }, 'Вход'),\n    ),\n    form,\n  )));\n  user.focus();\n}\n\n// ---------------- Приветственный терминал ----------------\nfunction renderWelcome() {\n  const m = state.me;\n  const lines = [\n    ['', `ДОБРО ПОЖАЛОВАТЬ, ИСПЫТУЕМЫЙ №${m.subjectNo}.`],\n    ['', ''],\n    ['', 'ВАШЕ МЕСТО ЖИТЕЛЬСТВА НАЗНАЧЕНО.'],\n    ['', ''],\n    ['ok', `РАЙОН: ${m.districtId}.`],\n    ['ok', `УЧАСТОК: ${m.plotLabel}.`],\n    ['', ''],\n    ['', 'ВЫ НЕ МОЖЕТЕ ИЗМЕНИТЬ ПЕРВОНАЧАЛЬНОЕ РАСПРЕДЕЛЕНИЕ.'],\n    ['', ''],\n    ['warn', 'СИСТЕМА НАБЛЮДАЕТ.'],\n  ];\n  const term = h('div', { class: 'terminal', role: 'status' });\n  const cont = h('button', { class: 'btn primary', style: 'margin-top:28px;visibility:hidden', onclick: () => { store.set(`welcomed:${m.id}`, '1'); startShell(); } }, 'Открыть терминал');\n  $app.replaceChildren(h('div', { class: 'screen-center' }, h('div', {}, term, cont)));\n  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;\n  let i = 0;\n  const cursor = h('span', { class: 'cursor' });\n  const next = () => {\n    if (i >= lines.length) { term.append(cursor); cont.style.visibility = 'visible'; cont.focus(); return; }\n    const [cls, text] = lines[i++];\n    const el = h('div', { class: `line ${cls}` });\n    term.append(el);\n    if (reduce || !text) { el.textContent = text || ' '; setTimeout(next, reduce ? 0 : 120); return; }\n    let j = 0;\n    const type = () => { el.textContent = text.slice(0, ++j); if (j < text.length) setTimeout(type, 18); else setTimeout(next, 220); };\n    type();\n  };\n  next();\n}\n\n// ---------------- Оболочка ----------------\nfunction startShell() {\n  if (!store.get(`welcomed:${state.me.id}`)) return renderWelcome();\n  connectStream();\n  refreshTrials();\n  refreshNotes();\n  window.addEventListener('hashchange', route);\n  route();\n}\n\nfunction route() {\n  const key = location.hash.replace('#/', '') || 'main';\n  state.view = SECTIONS.some((x) => x.key === key) ? key : 'main';\n  renderShell();\n}\nconst go = (key) => { location.hash = `#/${key}`; };\n\nfunction renderShell() {\n  const m = state.me;\n  const navList = h('ul', {}, SECTIONS.map((sec, i) => h('li', {}, h('a', {\n    href: `#/${sec.key}`,\n    class: [state.view === sec.key ? 'active' : '', sec.locked ? 'locked' : ''].join(' '),\n  }, h('span', {}, h('span', { class: 'num' }, String(i + 1).padStart(2, '0')), ' ', sec.title),\n    sec.key === 'notifications' && m.unread ? h('span', { class: 'badge' }, m.unread) : null,\n    sec.locked ? h('span', { class: 'faint' }, '⊘') : null,\n  ))));\n\n  const nav = h('nav', { class: 'nav', 'aria-label': 'Разделы' },\n    h('div', { class: 'head' }, h('div', { class: 't' }, 'THE EXPERIMENT'), h('div', { class: 's' }, `№${m.subjectNo} · ${m.plotId}`)),\n    navList,\n    h('div', { class: 'foot' }, h('button', { class: 'btn small', onclick: logout }, 'Выйти')),\n  );\n\n  const main = h('main', { class: 'main' }, h('div', { class: 'main-inner', id: 'view' }, h('div', { class: 'dim mono' }, 'ЗАГРУЗКА…')));\n  const side = h('aside', { class: 'side', id: 'side' });\n\n  const sheet = h('div', { class: 'sheet', id: 'sheet', onclick: (e) => { if (e.target === sheet) sheet.classList.remove('open'); } },\n    h('div', { class: 'inner' }, SECTIONS.filter((x) => !MOBILE_NAV.includes(x.key)).map((sec) => h('a', {\n      href: `#/${sec.key}`, class: sec.locked ? 'locked' : '', onclick: () => sheet.classList.remove('open'),\n    }, sec.title, sec.key === 'notifications' && m.unread ? h('span', { class: 'badge' }, m.unread) : sec.locked ? '⊘' : '›'))),\n  );\n  const bottom = h('nav', { class: 'bottom-nav', 'aria-label': 'Основные разделы' },\n    MOBILE_NAV.map((k) => {\n      const sec = SECTIONS.find((x) => x.key === k);\n      return h('a', { href: `#/${k}`, class: state.view === k ? 'active' : '' }, h('span', { class: 'ico' }, sec.ico), sec.title);\n    }),\n    h('button', { class: MOBILE_NAV.includes(state.view) ? '' : 'active', onclick: () => sheet.classList.toggle('open') },\n      h('span', { class: 'ico' }, '≡'), 'Меню', m.unread ? h('span', { class: 'badge' }, m.unread) : null),\n  );\n\n  $app.replaceChildren(h('div', { class: 'shell' }, nav, main, side), bottom, sheet);\n  renderSide();\n  renderView();\n}\n\nasync function renderView() {\n  const $view = document.getElementById('view');\n  if (!$view) return;\n  state.chatAppend = null;\n  const sec = SECTIONS.find((x) => x.key === state.view);\n  try {\n    const node = sec.locked ? lockedView(sec) : await VIEWS[sec.key]();\n    if (state.view === sec.key) $view.replaceChildren(node);\n  } catch (e) {\n    $view.replaceChildren(pageHead('ОШИБКА', sec.title), h('div', { class: 'locked-view' }, h('div', { class: 'big' }, e.code === 'ACCESS_LEVEL' ? 'ДОСТУП ЗАКРЫТ' : 'ОТКАЗ СИСТЕМЫ'), h('div', { class: 'dim' }, e.message)));\n  }\n}\n\nfunction pageHead(code, title, right) {\n  return h('div', { class: 'page-head' }, h('div', {}, h('div', { class: 'code' }, code), h('h1', {}, title)), right || null);\n}\nfunction panel(title, body, right) {\n  return h('section', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, title), right || null), h('div', { class: 'pb' }, body));\n}\nfunction lockedView(sec) {\n  return h('div', {}, pageHead('МОДУЛЬ НЕ АКТИВИРОВАН', sec.title),\n    h('div', { class: 'locked-view' },\n      h('div', { class: 'big' }, 'СИСТЕМА НЕ ДОПУСКАЕТ ВАС К ЭТОЙ ФУНКЦИИ'),\n      h('div', { class: 'dim' }, sec.locked),\n      h('div', { class: 'faint', style: 'margin-top:10px' }, 'Модуль появится на следующих этапах эксперимента.')));\n}\n\nasync function refreshMe() {\n  state.me = await get('/api/me');\n  renderSide();\n  document.querySelectorAll('.badge').forEach((b) => { b.textContent = state.me.unread; b.style.display = state.me.unread ? '' : 'none'; });\n}\nasync function refreshTrials() { try { state.trials = await get('/api/trials'); renderSide(); } catch {} }\nasync function refreshNotes() { try { state.notes = await get('/api/notifications'); renderSide(); } catch {} }\n\n// ---------------- Правая панель ----------------\nlet sideTimer = null;\nfunction renderSide() {\n  const $side = document.getElementById('side');\n  if (!$side || !state.me) return;\n  const m = state.me;\n  const active = state.trials.find((t) => t.status === 'active');\n  const timer = h('span', { class: 'mono amber' });\n  clearInterval(sideTimer);\n  if (active) {\n    const tick = () => (timer.textContent = fmtLeft(active.endsAt - Date.now()));\n    tick();\n    sideTimer = setInterval(tick, 1000);\n  }\n  $side.replaceChildren(\n    h('section', {}, h('div', { class: 'label' }, 'Испытуемый'), h('div', { class: 'mono', style: 'font-size:20px;margin:2px 0 4px' }, `№${m.subjectNo}`),\n      h('div', { class: 'dim mono', style: 'font-size:12px' }, `${m.username} · ${m.districtId} · ${m.plotLabel}`)),\n    h('section', {}, h('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr;gap:10px' },\n      h('div', {}, h('div', { class: 'label' }, 'Баланс'), h('div', { class: 'mono green', style: 'font-size:18px' }, fmtCR(m.cr))),\n      h('div', {}, h('div', { class: 'label' }, 'Очки действий'), h('div', { class: 'mono', style: 'font-size:18px' }, `${m.ap} / ${m.dailyAP} AP`)))),\n    active ? h('section', {}, h('div', { class: 'label red' }, 'Активное испытание'), h('div', { class: 'mono', style: 'margin:4px 0' }, active.title),\n      h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (100 * active.total) / active.target)}%` })),\n      h('div', { class: 'dim mono', style: 'font-size:12px;margin-top:6px;display:flex;justify-content:space-between' }, h('span', {}, `${active.total} / ${active.target} CR`), timer),\n      h('button', { class: 'btn small', style: 'margin-top:10px;width:100%', onclick: () => go('trials') }, 'Открыть')) : null,\n    state.selection ? h('section', { class: 'card-sel' }, selectionCard(state.selection)) : null,\n    h('section', {}, h('div', { class: 'label', style: 'margin-bottom:6px' }, 'События'),\n      state.notes.length ? h('ul', { class: 'list' }, state.notes.slice(0, 6).map((n) => h('li', { style: 'display:block;padding:8px 0' },\n        h('div', { class: `mono ${n.kind === 'trial' ? 'amber' : n.kind === 'system' ? 'green' : ''}`, style: 'font-size:12px' }, n.title),\n        h('div', { style: 'font-size:13px' }, n.body), h('div', { class: 'faint mono', style: 'font-size:11px' }, fmtTime(n.at))))) : h('div', { class: 'faint' }, 'Нет событий')),\n  );\n}\n\n// ---------------- SSE ----------------\nfunction connectStream() {\n  if (state.es) state.es.close();\n  const es = new EventSource('/api/stream');\n  state.es = es;\n  es.addEventListener('notification', (e) => {\n    const n = JSON.parse(e.data);\n    toast(n.title, n.body);\n    state.notes.unshift(n);\n    refreshMe();\n    if (state.view === 'notifications') renderView();\n  });\n  es.addEventListener('state', () => refreshMe());\n  es.addEventListener('chat', (e) => {\n    const msg = JSON.parse(e.data);\n    if (state.chatAppend && msg.userId !== state.me.id) state.chatAppend({ ...msg, isYou: false });\n  });\n  es.addEventListener('trial', () => { refreshTrials(); if (['trials', 'main'].includes(state.view)) renderView(); });\n  es.addEventListener('fund', () => { if (state.view === 'neighbors') renderView(); });\n}\n\nasync function logout() {\n  await post('/api/auth/logout').catch(() => {});\n  if (state.es) state.es.close();\n  location.hash = '';\n  state.me = null;\n  renderAuth('login');\n}\n\n// ---------------- Разделы ----------------\nconst VIEWS = {\n  async main() {\n    const m = state.me;\n    const done = m.quests.filter((q) => q.completedAt).length;\n    const active = state.trials.find((t) => t.status === 'active');\n    return h('div', {},\n      pageHead(`ИСПЫТУЕМЫЙ №${m.subjectNo}`, 'Главный терминал'),\n      h('div', { class: 'grid four', style: 'margin-bottom:16px' },\n        stat('Баланс', fmtCR(m.cr)), stat('AP', `${m.ap}`, `/ ${m.dailyAP}`), stat('Район', m.districtId), stat('Участок', m.plotLabel)),\n      h('div', { class: 'grid two' },\n        panel('Первые задания', h('div', {},\n          h('div', { class: 'bar', style: 'margin-bottom:10px' }, h('i', { style: `width:${(100 * done) / m.quests.length}%` })),\n          m.quests.map((q) => h('div', { class: `quest ${q.completedAt ? 'done' : ''}` },\n            h('span', { class: 'box' }, q.completedAt ? '[x]' : '[ ]'),\n            h('div', {}, h('div', {}, q.title), q.completedAt ? null : h('div', { class: 'hint' }, q.hint))))),\n          h('span', { class: 'mono dim' }, `${done}/${m.quests.length}`)),\n        h('div', {},\n          panel('Сводка системы', h('dl', { class: 'kv' },\n            h('dt', {}, 'Уровень доступа'), h('dd', { class: 'mono' }, ['', 'Участок', 'Район', 'Мир'][m.accessLevel]),\n            h('dt', {}, 'Смены сегодня'), h('dd', { class: 'mono' }, `${m.basicShifts} / 4`),\n            h('dt', {}, 'Проживает с'), h('dd', { class: 'mono' }, fmtTime(m.residentSince)))),\n          active ? panel('Испытание', h('div', {},\n            h('div', { class: 'mono', style: 'margin-bottom:6px' }, active.title),\n            h('div', { class: 'dim', style: 'font-size:14px;margin-bottom:10px' }, active.description),\n            h('button', { class: 'btn primary', onclick: () => go('trials') }, 'Перейти к испытанию')), h('span', { class: 'pill red' }, 'Активно')) : null,\n          panel('Протокол', h('div', { class: 'dim', style: 'font-size:14px' },\n            'Сначала вам доступен только ваш участок. Чем больше вы взаимодействуете с соседями и системой, тем больше вы узнаёте о масштабах эксперимента.')),\n        ),\n      ),\n    );\n  },\n\n  async map() {\n    const levels = [['plot', 'Участок', 1], ['district', 'Район', 2], ['world', 'Мир', 3]];\n    const tabs = h('div', { class: 'tabs' }, levels.map(([k, label, lvl]) => h('button', {\n      class: `tab ${state.mapLevel === k ? 'active' : ''}`,\n      onclick: () => { state.mapLevel = k; state.selection = null; renderView(); renderSide(); },\n    }, label, state.me.accessLevel < lvl ? ' ⊘' : '')));\n    const data = await get(`/api/map/${state.mapLevel}`).catch((e) => ({ __err: e }));\n    if (state.mapLevel === 'plot' && !data.__err) refreshMe();\n    let body;\n    if (data.__err) body = h('div', { class: 'locked-view' }, h('div', { class: 'big' }, 'ДОСТУП ЗАКРЫТ'), h('div', { class: 'dim' }, data.__err.message));\n    else if (state.mapLevel === 'plot') body = plotMap(data);\n    else if (state.mapLevel === 'district') body = districtMap(data);\n    else body = worldMap(data);\n    return h('div', {}, pageHead(state.mapLevel === 'plot' ? data.plotId || '' : state.mapLevel === 'district' ? (data.district?.id || '') : 'GLOBAL', 'Карта'), tabs, body,\n      h('div', { class: 'side-inline', id: 'sel-inline', style: 'margin-top:16px' }, state.selection ? panel('Выбранный объект', selectionCard(state.selection)) : null));\n  },\n\n  async house() {\n    const d = await get('/api/home');\n    refreshMe();\n    return h('div', {},\n      pageHead(d.address, `Ваш дом ${d.code}`),\n      h('div', { class: 'grid four', style: 'margin-bottom:16px' },\n        stat('Тип', d.typeName), stat('Состояние', `${d.condition}%`), stat('Склад', d.storage, 'ед.'), stat('Содержание', d.upkeepWeekly, 'CR/нед')),\n      h('div', { class: 'grid two' },\n        h('div', {},\n          panel('Обзор', h('dl', { class: 'kv' },\n            h('dt', {}, 'Адрес'), h('dd', { class: 'mono' }, d.address),\n            h('dt', {}, 'Владелец'), h('dd', {}, d.owner ? `№${d.owner.subjectNo} · ${d.owner.username}` : '—'),\n            h('dt', {}, 'Жильцы'), h('dd', {}, `${d.residents.length} / ${d.capacity}`),\n            h('dt', {}, 'Защищено'), h('dd', { class: 'mono' }, d.protectedCR ? `${d.protectedCR} CR (сейф)` : 'нет'))),\n          panel('Жильцы', h('ul', { class: 'list' }, d.residents.map((r) => h('li', {}, h('span', { class: 'mono' }, `№${r.subjectNo}`), h('span', { class: 'dim' }, r.username)))),\n            h('span', { class: 'faint mono', style: 'font-size:11px' }, 'приглашения — в жилом блоке')),\n          panel('Домашняя почта', d.mail.length ? h('ul', { class: 'list' }, d.mail.map((x) => h('li', { style: 'display:block' },\n            h('div', { class: 'mono', style: 'font-size:12px' }, x.title), h('div', { style: 'font-size:14px' }, x.body), h('div', { class: 'faint mono', style: 'font-size:11px' }, fmtTime(x.at))))) : h('div', { class: 'faint' }, 'Пусто')),\n        ),\n        h('div', {},\n          panel('Улучшения', h('ul', { class: 'list' }, d.upgrades.map((u) => h('li', {},\n            h('div', {}, h('div', {}, u.name), h('div', { class: 'dim', style: 'font-size:13px' }, u.desc)),\n            u.owned ? h('span', { class: 'pill green' }, 'Установлено')\n              : h('button', {\n                class: 'btn small', disabled: state.me.cr < u.price,\n                onclick: async (e) => {\n                  e.target.disabled = true;\n                  try { await post('/api/home/upgrade', { key: u.key }); toast('УЛУЧШЕНИЕ УСТАНОВЛЕНО', `${u.name}: −${u.price} CR`); await refreshMe(); renderView(); }\n                  catch (ex) { showError(ex); e.target.disabled = false; }\n                },\n              }, fmtCR(u.price)))))),\n          panel('История', h('ul', { class: 'list' }, d.log.map((l) => h('li', { style: 'display:block' }, h('div', { style: 'font-size:14px' }, l.detail), h('div', { class: 'faint mono', style: 'font-size:11px' }, fmtTime(l.at)))))),\n        ),\n      ),\n    );\n  },\n\n  async neighbors() {\n    const [n, f] = await Promise.all([get('/api/neighbors'), get('/api/plot/fund')]);\n    refreshMe();\n    const amount = h('input', { class: 'input', type: 'number', min: 1, step: 1, placeholder: 'Сумма CR', style: 'max-width:160px' });\n    return h('div', {},\n      pageHead(n.plotId, 'Соседи и участок'),\n      h('div', { class: 'grid two' },\n        panel(`Жители (${n.residents.length}/${n.capacity})`, h('ul', { class: 'list' }, n.residents.map((r) => h('li', {},\n          h('div', {}, h('span', { class: `dot ${r.online ? 'on' : ''}` }), h('span', { class: 'mono' }, `№${r.subjectNo}`), ' ', h('span', { class: r.isYou ? 'green' : '' }, r.username, r.isYou ? ' (вы)' : '')),\n          h('span', { class: 'dim mono', style: 'font-size:12px' }, `${r.home} · ${r.housing}`))))),\n        h('div', {},\n          panel('Общественный фонд', h('div', {},\n            h('div', { class: 'mono green', style: 'font-size:26px;margin-bottom:6px' }, fmtCR(f.balance)),\n            h('div', { class: 'dim', style: 'font-size:13px;margin-bottom:12px' }, f.rules),\n            h('form', {\n              style: 'display:flex;gap:8px;margin-bottom:14px',\n              onsubmit: async (e) => {\n                e.preventDefault();\n                try { await post('/api/plot/fund/donate', { amount: Number(amount.value) }); toast('ВЗНОС ЗАПИСАН', `${amount.value} CR → фонд ${n.plotId}`); await refreshMe(); renderView(); }\n                catch (ex) { showError(ex); }\n              },\n            }, amount, h('button', { class: 'btn primary', type: 'submit' }, 'Внести')),\n            h('div', { class: 'label', style: 'margin-bottom:4px' }, 'Журнал фонда'),\n            f.ops.length ? h('ul', { class: 'list' }, f.ops.map((o) => h('li', {},\n              h('div', {}, h('div', { style: 'font-size:14px' }, LEXICON[o.kind] || o.kind), h('div', { class: 'faint mono', style: 'font-size:11px' }, `${o.subjectNo ? '№' + o.subjectNo + ' · ' : ''}${fmtTime(o.at)}`)),\n              h('span', { class: `mono ${o.direction === 'in' ? 'green' : 'red'}` }, `${o.direction === 'in' ? '+' : '−'}${o.amount}`)))) : h('div', { class: 'faint' }, 'Операций пока нет'))),\n          panel('Показатели участка', metricsBlock(await get('/api/plot/metrics'))),\n        ),\n      ),\n    );\n  },\n\n  async comms() {\n    const history = await get('/api/chat/plot');\n    refreshMe();\n    const msgs = h('div', { class: 'msgs', role: 'log' });\n    const add = (m) => {\n      const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60;\n      msgs.append(h('div', { class: `msg ${m.isYou ? 'me' : ''}` },\n        h('div', { class: 'who' }, h('b', {}, `№${m.subjectNo}`), ` ${m.username} · ${fmtClock(m.at)}`),\n        h('div', { class: 'body' }, m.body)));\n      if (atBottom) msgs.scrollTop = msgs.scrollHeight;\n    };\n    history.forEach(add);\n    if (!history.length) msgs.append(h('div', { class: 'faint mono', style: 'font-size:13px' }, 'Канал пуст. Система ожидает первого сообщения.'));\n    state.chatAppend = add;\n    const input = h('input', { class: 'input', placeholder: 'Сообщение участку…', maxlength: 500, autocomplete: 'off' });\n    const form = h('form', {\n      onsubmit: async (e) => {\n        e.preventDefault();\n        const text = input.value.trim();\n        if (!text) return;\n        input.value = '';\n        try { add(await post('/api/chat/plot', { body: text })); }\n        catch (ex) { showError(ex); input.value = text; }\n      },\n    }, input, h('button', { class: 'btn primary', type: 'submit' }, 'Отпр.'));\n    setTimeout(() => (msgs.scrollTop = msgs.scrollHeight));\n    return h('div', {},\n      pageHead(`КАНАЛ plot:${state.me.plotId}`, 'Связь'),\n      h('div', { class: 'tabs' },\n        h('button', { class: 'tab active' }, 'Участок'),\n        h('button', { class: 'tab', disabled: true, title: 'Следующий этап' }, 'Личные ⊘'),\n        h('button', { class: 'tab', disabled: true, title: 'Следующий этап' }, 'Объявления ⊘')),\n      h('section', { class: 'panel chat' }, msgs, form),\n      h('div', { class: 'faint mono', style: 'font-size:12px' }, 'Локальный чат бесплатный. Сообщения видят все жители участка. Система сохраняет журнал.'),\n    );\n  },\n\n  async work() {\n    const w = await get('/api/work');\n    return h('div', {},\n      pageHead('БИРЖА ТРУДА · СИСТЕМНАЯ РАБОТА', 'Работа'),\n      h('div', { class: 'grid four', style: 'margin-bottom:16px' }, stat('AP', w.ap, `/ ${state.me.dailyAP}`), stat('Баланс', fmtCR(state.me.cr)), stat('Смены', `${state.me.basicShifts}`, '/ 4'), stat('Сброс', '00:00', 'UTC')),\n      h('div', { class: 'grid two' }, w.jobs.map((j) => panel(j.name, h('div', {},\n        h('dl', { class: 'kv', style: 'margin-bottom:14px' },\n          h('dt', {}, 'Затраты'), h('dd', { class: 'mono' }, `${j.ap} AP`),\n          h('dt', {}, 'Оплата'), h('dd', { class: 'mono green' }, fmtCR(j.cr)),\n          h('dt', {}, 'Лимит'), h('dd', { class: 'mono' }, j.limit ? `${j.used} / ${j.limit} в сутки` : 'ограничено AP')),\n        h('button', {\n          class: 'btn primary', style: 'width:100%',\n          disabled: w.ap < j.ap || (j.limit && j.used >= j.limit),\n          onclick: async (e) => {\n            e.target.disabled = true;\n            try { const r = await post('/api/work', { kind: j.key }); state.me = r.me; toast('СМЕНА ЗАВЕРШЕНА', `+${r.earned} CR · −${r.spentAP} AP`); renderSide(); renderView(); }\n            catch (ex) { showError(ex); e.target.disabled = false; }\n          },\n        }, 'Выполнить')),\n      ))),\n      h('div', { class: 'faint', style: 'font-size:13px' }, 'Системная работа гарантирована и оплачивается из системной эмиссии. Частные работодатели появятся вместе с предприятиями.'),\n    );\n  },\n\n  async economy() {\n    const e = await get('/api/economy');\n    return h('div', {},\n      pageHead('ЖУРНАЛ ОПЕРАЦИЙ', 'Экономика'),\n      h('div', { class: 'grid four', style: 'margin-bottom:16px' }, stat('CR', e.cr.toLocaleString('ru-RU')), stat('AP', e.ap), stat('Защищено', e.protectedCR, 'CR'), stat('Ресурсы', 'EN FD MT DT', '')),\n      panel('Последние операции', h('div', { style: 'overflow-x:auto' }, h('table', { class: 'ledger' },\n        h('thead', {}, h('tr', {}, h('th', {}, 'Время'), h('th', {}, 'Операция'), h('th', {}, 'Комментарий'), h('th', { class: 'amt' }, 'Сумма'))),\n        h('tbody', {}, e.ledger.map((l) => h('tr', {},\n          h('td', { class: 'mono dim' }, fmtTime(l.at)), h('td', {}, LEXICON[l.kind] || l.kind), h('td', { class: 'dim' }, l.memo),\n          h('td', { class: `amt ${l.direction === 'in' ? 'green' : 'red'}` }, `${l.direction === 'in' ? '+' : '−'}${l.amount}`))))))),\n      h('div', { class: 'faint', style: 'font-size:13px' }, 'Журнал неизменяем: сервер запрещает редактирование и удаление записей. Рынок и ресурсы — следующий этап.'),\n    );\n  },\n\n  async trials() {\n    await refreshTrials();\n    refreshMe();\n    if (!state.trials.length) return h('div', {}, pageHead('ПРОТОКОЛ ИСПЫТАНИЙ', 'Испытания'),\n      h('div', { class: 'locked-view' }, h('div', { class: 'big', style: 'color:var(--amber)' }, 'ОЖИДАНИЕ'), h('div', { class: 'dim' }, 'Система готовит испытание для вашего участка.')));\n    return h('div', {}, pageHead('ПРОТОКОЛ ИСПЫТАНИЙ', 'Испытания'), state.trials.map(trialCard));\n  },\n\n  async profile() {\n    const m = state.me;\n    return h('div', {}, pageHead(`№${m.subjectNo}`, 'Профиль'),\n      panel('Личное дело', h('dl', { class: 'kv' },\n        h('dt', {}, 'Номер'), h('dd', { class: 'mono' }, m.subjectNo),\n        h('dt', {}, 'Имя'), h('dd', {}, m.username),\n        h('dt', {}, 'Район'), h('dd', { class: 'mono' }, m.districtId),\n        h('dt', {}, 'Участок'), h('dd', { class: 'mono' }, m.plotId),\n        h('dt', {}, 'В системе с'), h('dd', { class: 'mono' }, fmtTime(m.createdAt)),\n        h('dt', {}, 'Доступ'), h('dd', { class: 'mono' }, `Уровень ${m.accessLevel}`))),\n      h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },\n        h('button', { class: 'btn', onclick: renderWelcome }, 'Повторить приветствие'),\n        h('button', { class: 'btn danger', onclick: logout }, 'Выйти')),\n    );\n  },\n\n  async notifications() {\n    state.notes = await get('/api/notifications');\n    await post('/api/notifications/read');\n    await refreshMe();\n    return h('div', {}, pageHead('ВХОДЯЩИЕ', 'Уведомления'),\n      panel('Все уведомления', state.notes.length ? h('ul', { class: 'list' }, state.notes.map((n) => h('li', { style: 'display:block' },\n        h('div', { class: `mono ${n.kind === 'trial' ? 'amber' : n.kind === 'system' ? 'green' : ''}`, style: 'font-size:12px' }, n.title, n.read ? '' : ' •'),\n        h('div', {}, n.body), h('div', { class: 'faint mono', style: 'font-size:11px' }, fmtTime(n.at))))) : h('div', { class: 'faint' }, 'Пусто')));\n  },\n};\n\nfunction stat(label, value, small) {\n  return h('div', { class: 'stat' }, h('div', { class: 'label' }, label), h('div', { class: 'v' }, value, small ? h('small', {}, ' ', small) : null));\n}\n\nfunction metricsBlock(m) {\n  const row = (label, v) => h('div', { style: 'margin-bottom:10px' },\n    h('div', { style: 'display:flex;justify-content:space-between;font-size:13px' }, h('span', { class: 'dim' }, label), h('span', { class: 'mono' }, v)),\n    h('div', { class: `bar ${v < 30 ? 'red' : ''}` }, h('i', { style: `width:${v}%` })));\n  return h('div', {}, row('Доверие', m.trust), row('Инфраструктура', m.infrastructure), row('Безопасность', m.security), row('Сплочённость', m.cohesion),\n    h('div', { class: 'faint', style: 'font-size:12px' }, 'Показатели вычисляются из событий: испытаний, общения, взносов, построек.'));\n}\n\nfunction trialCard(t) {\n  const amount = h('input', { class: 'input', type: 'number', min: 1, step: 1, placeholder: 'CR', style: 'max-width:140px' });\n  const pct = Math.min(100, (100 * t.total) / t.target);\n  const isActive = t.status === 'active';\n  const act = async (action) => {\n    try {\n      await post(`/api/trials/${t.id}/act`, action === 'contribute' ? { action, amount: Number(amount.value) } : { action });\n      toast('РЕШЕНИЕ ЗАФИКСИРОВАНО', action === 'contribute' ? `Взнос ${amount.value} CR` : 'Отказ записан. Соседи это увидят.');\n      await refreshMe();\n      renderView();\n    } catch (ex) { showError(ex); }\n  };\n  return panel(t.title, h('div', {},\n    h('p', { style: 'margin:0 0 12px' }, t.description),\n    h('div', { class: 'bar', style: 'margin-bottom:6px' }, h('i', { style: `width:${pct}%` })),\n    h('div', { class: 'mono dim', style: 'font-size:13px;display:flex;justify-content:space-between;margin-bottom:12px' },\n      h('span', {}, `${t.total} / ${t.target} CR`), h('span', {}, isActive ? `осталось ${fmtLeft(t.endsAt - Date.now())}` : `завершено ${fmtTime(t.endsAt)}`)),\n    h('dl', { class: 'kv', style: 'margin-bottom:12px' },\n      h('dt', {}, 'Участники'), h('dd', { class: 'mono' }, t.participantCount),\n      h('dt', {}, 'Подсчёт'), h('dd', {}, t.rules.scoring),\n      h('dt', {}, 'Последствия'), h('dd', {}, t.rules.penalty),\n      h('dt', {}, 'Ваш вклад'), h('dd', { class: 'mono' }, `${t.myContribution} CR${t.myRefused ? ' · отказ зафиксирован' : ''}`)),\n    isActive && t.isParticipant ? h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px' },\n      amount, h('button', { class: 'btn primary', onclick: () => act('contribute') }, 'Внести'),\n      t.myRefused ? null : h('button', { class: 'btn danger', onclick: () => act('refuse') }, 'Открыто отказаться')) : null,\n    t.result ? h('div', { class: `panel`, style: `padding:12px;border-color:${t.result.outcome === 'passed' ? 'var(--green-dim)' : '#5b2a27'}` },\n      h('div', { class: `mono ${t.result.outcome === 'passed' ? 'green' : 'red'}` }, t.result.outcome === 'passed' ? 'ИСПЫТАНИЕ ПРОЙДЕНО' : 'ИСПЫТАНИЕ ПРОВАЛЕНО'),\n      t.result.penalties?.length ? h('div', { class: 'dim', style: 'font-size:13px;margin-top:4px' }, 'Штрафы: ', t.result.penalties.map((p) => `№${p.subjectNo} −${p.amount}`).join(', ')) : null) : null,\n    h('div', { class: 'label', style: 'margin:8px 0 4px' }, 'Журнал решений'),\n    t.log.length ? h('ul', { class: 'list' }, t.log.slice().reverse().map((a) => h('li', {},\n      h('span', { class: 'mono' }, `№${a.subjectNo}`),\n      h('span', { class: a.action === 'refuse' ? 'red mono' : 'green mono' }, a.action === 'refuse' ? 'ОТКАЗ' : `+${a.amount} CR`)))) : h('div', { class: 'faint' }, 'Никто ещё не принял решения.'),\n  ), h('span', { class: `pill ${isActive ? 'red' : ''}` }, isActive ? 'Активно' : 'Завершено'));\n}\n\n// ---------------- Карты (SVG, данные из БД) ----------------\nfunction select(sel) {\n  state.selection = sel;\n  renderSide();\n  const inline = document.getElementById('sel-inline');\n  if (inline) inline.replaceChildren(panel('Выбранный объект', selectionCard(sel)));\n  document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('sel', t.dataset.key === sel.key));\n}\n\nfunction selectionCard(sel) {\n  return h('div', {}, h('div', { class: 'label' }, sel.kind), h('h3', { style: 'margin:4px 0 8px' }, sel.title),\n    sel.lines.map(([k, v]) => h('div', { style: 'display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0' }, h('span', { class: 'dim' }, k), h('span', { class: 'mono', style: 'text-align:right' }, v))),\n    sel.desc ? h('div', { class: 'dim', style: 'font-size:13px;margin-top:8px' }, sel.desc) : null,\n    sel.action ? h('button', { class: 'btn small', style: 'margin-top:10px', onclick: sel.action[1] }, sel.action[0]) : null);\n}\n\nfunction plotMap(d) {\n  // Узкий экран: жилая зона сверху, общественная снизу — крупнее и удобнее для пальца\n  const narrow = innerWidth < 600;\n  const W = narrow ? 360 : 680;\n  const cols = 5, tw = narrow ? 64 : 66, th = narrow ? 52 : 58, gap = narrow ? 5 : 8, ox = narrow ? 8 : 20, oy = 40;\n  const fx = narrow ? 8 : 410, fy = narrow ? oy + 5 * (th + gap) + 30 : 40;\n  const fw = narrow ? 344 : 250, half = (fw - 10) / 2;\n  const Hh = narrow ? fy + 330 : 430;\n  const tiles = d.slots.map((sl, i) => {\n    const x = ox + (i % cols) * (tw + gap), y = oy + Math.floor(i / cols) * (th + gap);\n    const occ = sl.status === 'occupied';\n    const fill = sl.mine ? '#1a3326' : occ ? '#161c1a' : '#0c0f0e';\n    const stroke = sl.mine ? '#5fbf8a' : occ ? '#2f3835' : '#1d2422';\n    const key = `slot-${sl.slot}`;\n    return s('g', {\n      class: 'tile', 'data-key': key, tabindex: 0, role: 'button', 'aria-label': `${sl.code} ${occ ? 'занят' : 'свободен'}`,\n      onclick: () => select({\n        key, kind: occ ? 'Жилой объект' : 'Свободное место', title: sl.code + (sl.mine ? ' — ваш дом' : ''),\n        lines: occ ? [['Тип', sl.type], ['Жильцы', sl.residents.map((r) => `№${r.subjectNo} ${r.username}`).join(', ')], ['Статус', sl.online ? 'в сети' : 'не в сети']] : [['Статус', 'Не занято']],\n        desc: occ ? null : 'Место будет выделено следующему испытуемому.',\n        action: sl.mine ? ['Открыть дом', () => go('house')] : null,\n      }),\n    },\n    s('rect', { x, y, width: tw, height: th, fill, stroke, 'stroke-width': sl.mine ? 1.5 : 1, rx: 1 }),\n    s('text', { x: x + 6, y: y + 14, fill: occ ? '#d5dbd8' : '#3a4441', 'font-size': 10 }, sl.code),\n    occ ? s('text', { x: x + 6, y: y + th - 8, fill: '#7f8b87', 'font-size': 9 }, `№${sl.residents[0]?.subjectNo ?? ''}`) : null,\n    occ ? s('circle', { cx: x + tw - 9, cy: y + 10, r: 3, fill: sl.online ? '#5fbf8a' : '#3a4441' }) : null);\n  });\n\n  const fac = [\n    { ...d.facilities[0], x: fx, y: fy, w: fw, h: narrow ? 80 : 110 },\n    { ...d.facilities[1], x: fx, y: fy + (narrow ? 90 : 125), w: half, h: 72 },\n    { ...d.facilities[2], x: fx + half + 10, y: fy + (narrow ? 90 : 125), w: half, h: 72 },\n    { ...d.facilities[3], x: fx, y: fy + (narrow ? 172 : 220), w: half, h: 72 },\n    { ...d.facilities[4], x: fx + half + 10, y: fy + (narrow ? 172 : 220), w: half, h: 72 },\n  ].map((f) => {\n    const active = f.status === 'active';\n    const key = `fac-${f.key}`;\n    return s('g', {\n      class: 'tile', 'data-key': key, tabindex: 0, role: 'button', 'aria-label': f.name,\n      onclick: () => select({\n        key, kind: active ? 'Общественный объект' : 'Строительная площадка', title: f.name,\n        lines: active ? [['Жители', `${d.metrics.residents} / 25`], ['Фонд', 'см. «Соседи»']] : [['Статус', 'Не построено']],\n        desc: f.desc, action: active ? ['Открыть чат участка', () => go('comms')] : null,\n      }),\n    },\n    s('rect', { x: f.x, y: f.y, width: f.w, height: f.h, fill: active ? '#12201a' : '#0c0f0e', stroke: active ? '#2f6b4c' : '#232a28', 'stroke-dasharray': active ? null : '4 4', rx: 1 }),\n    s('text', { x: f.x + 8, y: f.y + 18, fill: active ? '#5fbf8a' : '#4d5754', 'font-size': 11 }, (f.short || f.name).toUpperCase()),\n    active ? s('text', { x: f.x + 8, y: f.y + 36, fill: '#7f8b87', 'font-size': 10 }, `жителей ${d.metrics.residents}/25`) : null);\n  });\n\n  const svg = s('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': `Карта участка ${d.plotId}` },\n    s('text', { x: 20, y: 24, fill: '#4d5754', 'font-size': 11 }, `УЧАСТОК ${d.plotId} · ЖИЛАЯ ЗОНА`),\n    s('text', { x: fx, y: fy - 16, fill: '#4d5754', 'font-size': 11 }, 'ОБЩЕСТВЕННАЯ ЗОНА'),\n    narrow ? s('line', { x1: 8, y1: fy - 30, x2: 352, y2: fy - 30, stroke: '#1d2422', 'stroke-width': 6 })\n      : s('line', { x1: 390, y1: 30, x2: 390, y2: 400, stroke: '#1d2422', 'stroke-width': 6 }),\n    tiles, fac,\n    d.events.length ? s('text', { x: fx, y: fy + (narrow ? 272 : 340), fill: '#e0564f', 'font-size': 11 }, `⚠ АКТИВНО: ${d.events[0].title}`) : null);\n\n  return h('div', {}, h('div', { class: 'map-wrap' }, svg),\n    h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#1a3326;border-color:#5fbf8a' }), 'ваш дом'), h('span', {}, h('i', { style: 'background:#161c1a' }), 'занято'),\n      h('span', {}, h('i', { style: 'background:#0c0f0e' }), 'свободно'), h('span', {}, h('i', { style: 'border-style:dashed' }), 'площадка')),\n    h('div', { style: 'margin-top:16px' }, panel('Показатели участка', metricsBlock(d.metrics))));\n}\n\nfunction districtMap(d) {\n  const n = Math.max(d.plots.length, 1);\n  const cols = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(n))));\n  const tw = 90, th = 70, gap = 12, ox = 20, oy = 40;\n  const rows = Math.ceil(d.plots.length / cols);\n  const W = 680, Hh = Math.max(300, oy + rows * (th + gap) + 120);\n  const tiles = d.plots.map((p, i) => {\n    const x = ox + (i % cols) * (tw + gap), y = oy + Math.floor(i / cols) * (th + gap);\n    const key = `plot-${p.id}`;\n    const fillPct = p.residents / p.capacity;\n    return s('g', {\n      class: 'tile', 'data-key': key, tabindex: 0, role: 'button', 'aria-label': p.id,\n      onclick: () => select({ key, kind: 'Участок', title: p.id + (p.mine ? ' — ваш' : ''), lines: [['Жители', `${p.residents}/${p.capacity}`], ['Активны (7д)', p.active], ['Фонд', fmtCR(p.fund_balance)], ['Доверие', p.metrics.trust], ['Сплочённость', p.metrics.cohesion]] }),\n    },\n    s('rect', { x, y, width: tw, height: th, fill: p.mine ? '#1a3326' : '#131816', stroke: p.mine ? '#5fbf8a' : '#2f3835' }),\n    s('rect', { x: x + 6, y: y + th - 12, width: (tw - 12) * fillPct, height: 4, fill: '#5fbf8a' }),\n    s('rect', { x: x + 6 + (tw - 12) * fillPct, y: y + th - 12, width: (tw - 12) * (1 - fillPct), height: 4, fill: '#232a28' }),\n    s('text', { x: x + 8, y: y + 18, fill: '#d5dbd8', 'font-size': 11 }, 'P-' + String(p.number).padStart(3, '0')),\n    s('text', { x: x + 8, y: y + 36, fill: '#7f8b87', 'font-size': 10 }, `${p.residents}/${p.capacity} жит.`));\n  });\n  const fy = Hh - 70;\n  const fac = d.facilities.map((f, i) => {\n    const x = 20 + i * 108, key = `dfac-${f.key}`;\n    const active = f.status === 'active';\n    return s('g', { class: 'tile', 'data-key': key, tabindex: 0, role: 'button', 'aria-label': f.name, onclick: () => select({ key, kind: 'Районный объект', title: f.name, lines: [['Статус', active ? 'работает' : 'закрыто']], desc: f.desc, action: f.key === 'labor' ? ['Перейти к работе', () => go('work')] : null }) },\n      s('rect', { x, y: fy, width: 100, height: 46, fill: active ? '#12201a' : '#0c0f0e', stroke: active ? '#2f6b4c' : '#232a28', 'stroke-dasharray': active ? null : '4 4' }),\n      s('text', { x: x + 6, y: fy + 18, fill: active ? '#5fbf8a' : '#4d5754', 'font-size': 9 }, f.name.toUpperCase()));\n  });\n  return h('div', {}, h('div', { class: 'map-wrap' }, s('svg', { viewBox: `0 0 ${W} ${Hh}`, role: 'img', 'aria-label': `Карта района ${d.district.id}` },\n    s('text', { x: 20, y: 24, fill: '#4d5754', 'font-size': 11 }, `РАЙОН ${d.district.id} · ${d.district.name.toUpperCase()} · УЧАСТКОВ: ${d.plots.length}`),\n    tiles, s('text', { x: 20, y: fy - 10, fill: '#4d5754', 'font-size': 11 }, 'РАЙОННЫЕ УЧРЕЖДЕНИЯ'), fac)),\n    h('div', { class: 'faint', style: 'font-size:13px;margin-top:10px' }, 'Новые участки создаются системой по мере заселения.'));\n}\n\nfunction worldMap(d) {\n  const pos = { 'D-01': [240, 30], 'D-02': [460, 160], 'D-03': [20, 160], 'D-04': [240, 290] };\n  const tiles = d.districts.map((ds) => {\n    const [x, y] = pos[ds.id];\n    const key = `dist-${ds.id}`;\n    return s('g', {\n      class: 'tile', 'data-key': key, tabindex: 0, role: 'button', 'aria-label': ds.id,\n      onclick: () => select({ key, kind: 'Район', title: `${ds.id} · ${ds.name}${ds.mine ? ' — ваш' : ''}`, lines: [['Население', ds.residents], ['Активные (7д)', ds.active], ['Участков', ds.plots], ['Денежная масса', fmtCR(ds.moneySupply)], ['Руководство', ds.leadership], ['Стабильность', ds.stability ?? '—'], ['Инфраструктура', ds.infrastructure ?? '—'], ['Катастрофы', ds.catastrophes.length ? ds.catastrophes.join(', ') : 'нет']] }),\n    },\n    s('rect', { x, y, width: 200, height: 110, fill: ds.mine ? '#1a3326' : '#131816', stroke: ds.mine ? '#5fbf8a' : '#2f3835' }),\n    s('text', { x: x + 10, y: y + 22, fill: '#d5dbd8', 'font-size': 13 }, `${ds.id} ${ds.name.toUpperCase()}`),\n    s('text', { x: x + 10, y: y + 46, fill: '#7f8b87', 'font-size': 11 }, `население: ${ds.residents}`),\n    s('text', { x: x + 10, y: y + 64, fill: '#7f8b87', 'font-size': 11 }, `активные: ${ds.active}`),\n    s('text', { x: x + 10, y: y + 82, fill: '#7f8b87', 'font-size': 11 }, `участков: ${ds.plots}`),\n    s('text', { x: x + 10, y: y + 100, fill: '#4d5754', 'font-size': 10 }, ds.leadership));\n  });\n  return h('div', {}, h('div', { class: 'map-wrap' }, s('svg', { viewBox: '0 0 680 420', role: 'img', 'aria-label': 'Карта мира' },\n    s('circle', { cx: 340, cy: 215, r: 46, fill: 'none', stroke: '#e0564f', 'stroke-dasharray': '3 5' }),\n    s('text', { x: 340, y: 212, fill: '#e0564f', 'font-size': 10, 'text-anchor': 'middle' }, 'ЦЕНТР'),\n    s('text', { x: 340, y: 226, fill: '#e0564f', 'font-size': 10, 'text-anchor': 'middle' }, 'НАБЛЮДЕНИЯ'),\n    tiles)));\n}\n\nboot();\n","/style.css":":root {\n  --bg: #0a0c0b;\n  --panel: #101312;\n  --panel-2: #151918;\n  --line: #232a28;\n  --line-2: #2f3835;\n  --text: #d5dbd8;\n  --dim: #7f8b87;\n  --faint: #4d5754;\n  --green: #5fbf8a;\n  --green-dim: #2f6b4c;\n  --green-bg: #12201a;\n  --amber: #d6a849;\n  --red: #e0564f;\n  --red-bg: #2a1312;\n  --mono: ui-monospace, 'JetBrains Mono', 'IBM Plex Mono', 'Cascadia Mono', Consolas, monospace;\n  --sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n  --nav-h: 60px;\n}\n* { box-sizing: border-box; }\nhtml, body { margin: 0; height: 100%; background: var(--bg); color: var(--text); font: 15px/1.5 var(--sans); }\nbody { -webkit-tap-highlight-color: transparent; }\nbutton, input { font: inherit; color: inherit; }\na { color: var(--green); }\n.mono { font-family: var(--mono); }\n.dim { color: var(--dim); }\n.faint { color: var(--faint); }\n.green { color: var(--green); }\n.red { color: var(--red); }\n.amber { color: var(--amber); }\n.label { font: 600 11px/1.2 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--dim); }\nh1, h2, h3 { margin: 0; font-family: var(--mono); font-weight: 600; letter-spacing: .04em; }\nh1 { font-size: 20px; text-transform: uppercase; }\nh2 { font-size: 15px; text-transform: uppercase; color: var(--dim); }\nh3 { font-size: 14px; }\n\n/* ---------- Кнопки и поля ---------- */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 8px;\n  min-height: 40px; padding: 0 16px; border: 1px solid var(--line-2); background: var(--panel-2);\n  font: 600 13px var(--mono); letter-spacing: .06em; text-transform: uppercase; cursor: pointer; border-radius: 2px; white-space: nowrap;\n}\n.btn:hover { border-color: var(--green-dim); }\n.btn:disabled { opacity: .4; cursor: not-allowed; }\n.btn.primary { background: var(--green-bg); border-color: var(--green-dim); color: var(--green); }\n.btn.danger { background: var(--red-bg); border-color: #5b2a27; color: var(--red); }\n.btn.small { min-height: 32px; padding: 0 10px; font-size: 12px; }\n.input {\n  width: 100%; min-height: 42px; padding: 0 12px; background: var(--bg); border: 1px solid var(--line-2);\n  border-radius: 2px; outline: none; font-family: var(--mono);\n}\n.input:focus { border-color: var(--green-dim); }\n\n/* ---------- Авторизация / приветствие ---------- */\n.screen-center { min-height: 100%; display: grid; place-items: center; padding: 24px; }\n.auth { width: 100%; max-width: 400px; }\n.auth .brand { font: 600 13px var(--mono); letter-spacing: .3em; color: var(--dim); margin-bottom: 6px; }\n.auth h1 { font-size: 26px; letter-spacing: .1em; margin-bottom: 4px; }\n.auth .sub { color: var(--faint); font: 12px var(--mono); margin-bottom: 28px; }\n.auth form { display: grid; gap: 12px; }\n.tabs { display: flex; gap: 0; border-bottom: 1px solid var(--line); margin-bottom: 16px; }\n.tab {\n  background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 14px; cursor: pointer;\n  font: 600 12px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--dim);\n}\n.tab.active { color: var(--green); border-bottom-color: var(--green); }\n.err { color: var(--red); font: 13px var(--mono); min-height: 18px; }\n\n.terminal { width: 100%; max-width: 640px; font: 15px/1.9 var(--mono); }\n.terminal .line { white-space: pre-wrap; }\n.terminal .line.warn { color: var(--red); }\n.terminal .line.ok { color: var(--green); }\n.cursor { display: inline-block; width: 9px; height: 1.1em; background: var(--green); vertical-align: -3px; animation: blink 1s steps(1) infinite; }\n@keyframes blink { 50% { opacity: 0; } }\n@media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }\n\n/* ---------- Оболочка ---------- */\n.shell { display: grid; grid-template-columns: 220px minmax(0, 1fr) 300px; height: 100%; }\n.nav { border-right: 1px solid var(--line); background: var(--panel); display: flex; flex-direction: column; overflow-y: auto; }\n.nav .head { padding: 16px; border-bottom: 1px solid var(--line); }\n.nav .head .t { font: 600 13px var(--mono); letter-spacing: .2em; }\n.nav .head .s { font: 11px var(--mono); color: var(--faint); margin-top: 2px; }\n.nav ul { list-style: none; margin: 0; padding: 8px 0; }\n.nav a {\n  display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 16px;\n  color: var(--dim); text-decoration: none; font: 13px var(--mono); border-left: 2px solid transparent;\n}\n.nav a:hover { color: var(--text); background: var(--panel-2); }\n.nav a.active { color: var(--green); border-left-color: var(--green); background: var(--green-bg); }\n.nav a.locked { color: var(--faint); }\n.nav .num { color: var(--faint); font-size: 11px; width: 18px; }\n.badge { min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--red); color: #fff; font: 600 11px/18px var(--mono); text-align: center; }\n.nav .foot { margin-top: auto; padding: 12px 16px; border-top: 1px solid var(--line); }\n\n.main { overflow-y: auto; min-width: 0; }\n.main-inner { padding: 20px 24px 40px; max-width: 980px; }\n.side { border-left: 1px solid var(--line); background: var(--panel); overflow-y: auto; }\n.side section { padding: 14px 16px; border-bottom: 1px solid var(--line); }\n\n.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }\n.page-head .code { font: 12px var(--mono); color: var(--faint); margin-bottom: 4px; }\n\n/* ---------- Панели ---------- */\n.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 2px; margin-bottom: 16px; }\n.panel > .ph { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); }\n.panel > .pb { padding: 14px; }\n.grid { display: grid; gap: 16px; }\n.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n.grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); }\n.stat { background: var(--panel); padding: 12px 14px; }\n.stat .v { font: 600 22px var(--mono); margin-top: 4px; }\n.stat .v small { font-size: 12px; color: var(--dim); font-weight: 400; }\n.kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 14px; }\n.kv dt { color: var(--dim); font: 12px/1.8 var(--mono); text-transform: uppercase; letter-spacing: .06em; }\n.kv dd { margin: 0; }\n.list { list-style: none; margin: 0; padding: 0; }\n.list li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }\n.list li:last-child { border-bottom: 0; }\n.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--faint); margin-right: 8px; vertical-align: 1px; }\n.dot.on { background: var(--green); box-shadow: 0 0 6px var(--green); }\n.pill { font: 600 11px var(--mono); letter-spacing: .06em; padding: 2px 8px; border: 1px solid var(--line-2); border-radius: 2px; color: var(--dim); text-transform: uppercase; white-space: nowrap; }\n.pill.green { color: var(--green); border-color: var(--green-dim); }\n.pill.red { color: var(--red); border-color: #5b2a27; }\n.bar { height: 6px; background: var(--line); border-radius: 1px; overflow: hidden; }\n.bar > i { display: block; height: 100%; background: var(--green); }\n.bar.red > i { background: var(--red); }\n\n.quest { display: flex; gap: 10px; padding: 7px 0; font-size: 14px; }\n.quest .box { font: 13px var(--mono); color: var(--faint); }\n.quest.done { color: var(--dim); }\n.quest.done .box { color: var(--green); }\n.quest .hint { font: 11px var(--mono); color: var(--faint); }\n\n.ledger td, .ledger th { padding: 8px 6px; border-bottom: 1px solid var(--line); text-align: left; font-size: 13px; }\n.ledger th { font: 600 11px var(--mono); color: var(--dim); text-transform: uppercase; letter-spacing: .08em; }\n.ledger { width: 100%; border-collapse: collapse; }\n.ledger .amt { font-family: var(--mono); text-align: right; white-space: nowrap; }\n\n.locked-view { border: 1px dashed var(--line-2); padding: 40px 24px; text-align: center; font-family: var(--mono); }\n.locked-view .big { font-size: 15px; color: var(--red); letter-spacing: .12em; margin-bottom: 12px; }\n\n/* ---------- Чат ---------- */\n.chat { display: flex; flex-direction: column; height: min(62vh, 560px); }\n.chat .msgs { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }\n.msg .who { font: 12px var(--mono); color: var(--dim); }\n.msg .who b { color: var(--text); font-weight: 600; }\n.msg.me .who b { color: var(--green); }\n.msg .body { white-space: pre-wrap; word-break: break-word; }\n.chat form { display: flex; gap: 8px; padding: 10px; border-top: 1px solid var(--line); }\n\n/* ---------- Карта ---------- */\n.map-wrap { background: #080a09; border: 1px solid var(--line); border-radius: 2px; overflow: hidden; touch-action: manipulation; }\n.map-wrap svg { display: block; width: 100%; height: auto; }\n.map-wrap text { font-family: var(--mono); pointer-events: none; }\n.tile { cursor: pointer; }\n.tile rect, .tile polygon { transition: stroke .1s; }\n.tile:hover rect, .tile:hover polygon, .tile.sel rect, .tile.sel polygon { stroke: var(--green); }\n.legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; font: 12px var(--mono); color: var(--dim); }\n.legend i { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; border: 1px solid var(--line-2); }\n\n.card-sel h3 { margin-bottom: 8px; }\n\n/* ---------- Тосты ---------- */\n.toasts { position: fixed; right: 16px; top: 16px; z-index: 50; display: grid; gap: 8px; width: min(360px, calc(100vw - 32px)); }\n.toast { background: var(--panel-2); border: 1px solid var(--line-2); border-left: 3px solid var(--green); padding: 10px 12px; font-size: 14px; box-shadow: 0 8px 24px #0008; }\n.toast.err { border-left-color: var(--red); color: var(--text); }\n.toast .tt { font: 600 12px var(--mono); letter-spacing: .08em; margin-bottom: 2px; }\n\n/* ---------- Мобильная версия ---------- */\n.bottom-nav, .sheet { display: none; }\n@media (max-width: 1180px) {\n  .shell { grid-template-columns: 200px minmax(0, 1fr); }\n  .side { display: none; }\n  .side-inline { display: block !important; }\n}\n@media (max-width: 760px) {\n  .shell { grid-template-columns: 1fr; height: auto; min-height: 100%; }\n  .nav { display: none; }\n  .main { overflow: visible; padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom)); }\n  .main-inner { padding: 14px 14px 24px; }\n  .grid.two { grid-template-columns: 1fr; }\n  .grid.four { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n  h1 { font-size: 17px; }\n  .bottom-nav {\n    display: grid; grid-template-columns: repeat(5, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;\n    height: calc(var(--nav-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);\n    background: var(--panel); border-top: 1px solid var(--line);\n  }\n  .bottom-nav a, .bottom-nav button {\n    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: none; border: 0;\n    color: var(--dim); text-decoration: none; font: 600 10px var(--mono); letter-spacing: .06em; text-transform: uppercase; position: relative;\n  }\n  .bottom-nav .ico { font-size: 17px; line-height: 1; }\n  .bottom-nav .active { color: var(--green); }\n  .bottom-nav .badge { position: absolute; top: 6px; left: 55%; }\n  .sheet.open { display: block; position: fixed; inset: 0; z-index: 45; background: #000a; }\n  .sheet .inner { position: absolute; left: 0; right: 0; bottom: 0; max-height: 80vh; overflow-y: auto; background: var(--panel); border-top: 1px solid var(--line-2); padding: 8px 0 calc(var(--nav-h) + 8px); }\n  .sheet a { display: flex; justify-content: space-between; padding: 13px 20px; color: var(--text); text-decoration: none; font: 14px var(--mono); border-bottom: 1px solid var(--line); }\n  .sheet a.locked { color: var(--faint); }\n  .toasts { top: auto; bottom: calc(var(--nav-h) + 12px); right: 12px; }\n  .chat { height: calc(100vh - 230px); }\n}\n.side-inline { display: none; }\n"};

// server/main.ts
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname as dirname2, join as join2 } from "node:path";

// server/config.ts
var env = (key, fallback) => {
  const v = process.env[key];
  const n = v === void 0 ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
};
var SERVER = {
  port: env("PORT", 3e3),
  dbPath: process.env.DB_PATH ?? "./data/experiment.db",
  sessionDays: 30,
  schedulerIntervalMs: env("SCHEDULER_INTERVAL_MS", 15e3),
  secureCookies: process.env.NODE_ENV === "production",
  registerPerMinute: env("REGISTER_PER_MINUTE", 10),
  anonPerMinute: env("ANON_PER_MINUTE", 120),
  // За прокси хостинга (Render и т.п.) реальный IP игрока в X-Forwarded-For
  trustProxy: process.env.TRUST_PROXY === "1" || !!process.env.RENDER
};
var GAME = {
  startCR: 500,
  dailyAP: 10,
  plotCapacity: 25,
  districts: [
    { id: "D-01", code: "D01", name: "\u0421\u0435\u0432\u0435\u0440\u043D\u044B\u0439" },
    { id: "D-02", code: "D02", name: "\u0412\u043E\u0441\u0442\u043E\u0447\u043D\u044B\u0439" },
    { id: "D-03", code: "D03", name: "\u0417\u0430\u043F\u0430\u0434\u043D\u044B\u0439" },
    { id: "D-04", code: "D04", name: "\u042E\u0436\u043D\u044B\u0439" }
  ],
  allocation: {
    activeWindowDays: 7,
    // нагрузка района = постоянные жители + activeWeight * активные за 7 дней
    activeWeight: 0.5
  },
  housing: {
    capsule: { name: "\u041A\u0430\u043F\u0441\u0443\u043B\u0430", price: 0, upkeepWeekly: 0, residents: 1, storage: 20 },
    block: { name: "\u0416\u0438\u043B\u043E\u0439 \u0431\u043B\u043E\u043A", price: 600, upkeepWeekly: 30, residents: 2, storage: 60 },
    dorm: { name: "\u041E\u0431\u0449\u0435\u0436\u0438\u0442\u0438\u0435", price: 2e3, upkeepWeekly: 90, residents: 5, storage: 150 },
    complex: { name: "\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u044B\u0439 \u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0441", price: 8e3, upkeepWeekly: 250, residents: 5, storage: 400 }
  },
  upgrades: {
    storage_ext: { name: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u043A\u043B\u0430\u0434", price: 200, storageBonus: 50, desc: "+50 \u043A \u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u0438 \u0441\u043A\u043B\u0430\u0434\u0430" },
    safe: { name: "\u0417\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u0439 \u0441\u0435\u0439\u0444", price: 350, protectsCR: 300, desc: "\u0417\u0430\u0449\u0438\u0449\u0430\u0435\u0442 \u0434\u043E 300 CR \u043E\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u043D\u044B\u0445 \u0448\u0442\u0440\u0430\u0444\u043E\u0432 \u0438 \u0443\u0449\u0435\u0440\u0431\u0430" },
    trade_terminal: { name: "\u0422\u043E\u0440\u0433\u043E\u0432\u044B\u0439 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B", price: 500, desc: "\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u0440\u044B\u043D\u043A\u0443 \u0438\u0437 \u0434\u043E\u043C\u0430 (\u043C\u043E\u0434\u0443\u043B\u044C \u0440\u044B\u043D\u043A\u0430 \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F)" },
    guest_module: { name: "\u0413\u043E\u0441\u0442\u0435\u0432\u043E\u0439 \u043C\u043E\u0434\u0443\u043B\u044C", price: 400, desc: "\u041F\u043E\u0437\u0432\u043E\u043B\u044F\u0435\u0442 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u044C \u0433\u043E\u0441\u0442\u0435\u0439 (\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F)" }
  },
  work: {
    basic: { name: "\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u0441\u043C\u0435\u043D\u0430", ap: 2, cr: 60, dailyLimit: 4 },
    complex: { name: "\u0421\u043B\u043E\u0436\u043D\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430", ap: 3, cr: 100, dailyLimit: 0 }
    // 0 = ограничено только AP
  },
  // Задел для производства: рецепты задаются данными
  recipes: {
    power_plant: { input: { MT: 3 }, output: { EN: 20 }, cycleHours: 4 },
    farm: { input: { EN: 4 }, output: { FD: 12 }, cycleHours: 4 },
    factory: { input: { EN: 6 }, output: { MT: 8 }, cycleHours: 4 },
    data_center: { input: { EN: 8 }, output: { DT: 10 }, cycleHours: 4 }
  },
  enterpriseRegistration: { trading: 300, farm: 700, factory: 1200, power_plant: 1800, data_center: 2e3 },
  comms: { districtPost: 100, interDistrictPost: 300, globalPost: 1e3 },
  chat: { maxLength: 500, minIntervalMs: 1500, perMinute: 20 },
  fund: { maxDonation: 1e5 },
  trials: {
    durationSec: env("TRIAL_DURATION_SEC", 24 * 3600),
    cooldownSec: env("TRIAL_COOLDOWN_SEC", 12 * 3600),
    collectiveSacrifice: {
      perResidentTarget: 40,
      // цель фонда = 40 CR × число жителей
      penaltyPct: 5,
      // при провале: 5% незащищённых CR
      penaltyCap: 25
      // но не больше 25 CR с человека
    }
  },
  // Постепенное открытие мира
  access: {
    district: ["view_map", "meet_neighbors", "first_message"],
    world: ["first_trial"]
  }
};
var QUESTS = [
  { key: "open_home", title: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0432\u043E\u0439 \u0434\u043E\u043C", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0414\u043E\u043C\xBB" },
  { key: "view_map", title: "\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043A\u0430\u0440\u0442\u0443 \u0443\u0447\u0430\u0441\u0442\u043A\u0430", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u041A\u0430\u0440\u0442\u0430\xBB" },
  { key: "meet_neighbors", title: "\u041F\u043E\u0437\u043D\u0430\u043A\u043E\u043C\u0438\u0442\u044C\u0441\u044F \u0441 \u0441\u043E\u0441\u0435\u0434\u044F\u043C\u0438", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0421\u043E\u0441\u0435\u0434\u0438\xBB" },
  { key: "first_message", title: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0421\u0432\u044F\u0437\u044C\xBB \u2192 \u0447\u0430\u0442 \u0443\u0447\u0430\u0441\u0442\u043A\u0430" },
  { key: "basic_work", title: "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u0431\u0430\u0437\u043E\u0432\u0443\u044E \u0440\u0430\u0431\u043E\u0442\u0443", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0420\u0430\u0431\u043E\u0442\u0430\xBB" },
  { key: "first_salary", title: "\u041F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E \u0437\u0430\u0440\u043F\u043B\u0430\u0442\u0443", hint: "\u041D\u0430\u0447\u0438\u0441\u043B\u044F\u0435\u0442\u0441\u044F \u0437\u0430 \u0441\u043C\u0435\u043D\u0443" },
  { key: "view_fund", title: "\u041E\u0437\u043D\u0430\u043A\u043E\u043C\u0438\u0442\u044C\u0441\u044F \u0441 \u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C \u0444\u043E\u043D\u0434\u043E\u043C", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0421\u043E\u0441\u0435\u0434\u0438\xBB \u2192 \u0444\u043E\u043D\u0434" },
  { key: "first_trial", title: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u0438\u0435 \u0432 \u043F\u0435\u0440\u0432\u043E\u043C \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0438", hint: "\u0420\u0430\u0437\u0434\u0435\u043B \xAB\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F\xBB" }
];

// server/db.ts
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
var MIGRATIONS = [
  // v1 — базовая схема
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE districts (
    id TEXT PRIMARY KEY,              -- 'D-03'
    code TEXT NOT NULL UNIQUE,        -- 'D03'
    name TEXT NOT NULL,
    plot_seq INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE plots (
    id TEXT PRIMARY KEY,              -- 'D03-P012'
    district_id TEXT NOT NULL REFERENCES districts(id),
    number INTEGER NOT NULL,
    capacity INTEGER NOT NULL,
    fund_balance INTEGER NOT NULL DEFAULT 0 CHECK (fund_balance >= 0),
    created_at INTEGER NOT NULL,
    UNIQUE (district_id, number)
  );

  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    subject_no INTEGER NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    cr INTEGER NOT NULL DEFAULT 0 CHECK (cr >= 0),
    ap INTEGER NOT NULL DEFAULT 0 CHECK (ap >= 0),
    ap_day TEXT NOT NULL DEFAULT '',
    basic_shifts INTEGER NOT NULL DEFAULT 0,
    access_level INTEGER NOT NULL DEFAULT 1,
    plot_id TEXT REFERENCES plots(id),
    home_id INTEGER,
    resident_since INTEGER NOT NULL
  );
  CREATE INDEX users_plot ON users(plot_id);
  CREATE INDEX users_active ON users(last_active_at);

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE homes (
    id INTEGER PRIMARY KEY,
    plot_id TEXT NOT NULL REFERENCES plots(id),
    slot INTEGER NOT NULL,            -- 1..capacity, \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0432\u043C\u0435\u0441\u0442\u0438\u043C\u043E\u0441\u0442\u044C
    type TEXT NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    condition INTEGER NOT NULL DEFAULT 100,
    created_at INTEGER NOT NULL,
    UNIQUE (plot_id, slot)
  );

  CREATE TABLE home_upgrades (
    home_id INTEGER NOT NULL REFERENCES homes(id),
    upgrade TEXT NOT NULL,
    purchased_by INTEGER NOT NULL,
    purchased_at INTEGER NOT NULL,
    PRIMARY KEY (home_id, upgrade)
  );

  CREATE TABLE home_log (
    id INTEGER PRIMARY KEY,
    home_id INTEGER NOT NULL,
    user_id INTEGER,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL,
    at INTEGER NOT NULL
  );

  -- \u041D\u0435\u0438\u0437\u043C\u0435\u043D\u044F\u0435\u043C\u044B\u0439 \u0436\u0443\u0440\u043D\u0430\u043B \u0432\u0441\u0435\u0445 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0439 CR
  CREATE TABLE ledger (
    id INTEGER PRIMARY KEY,
    at INTEGER NOT NULL,
    kind TEXT NOT NULL,
    from_account TEXT NOT NULL,
    to_account TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    memo TEXT NOT NULL DEFAULT '',
    ref TEXT
  );
  CREATE INDEX ledger_from ON ledger(from_account, id);
  CREATE INDEX ledger_to ON ledger(to_account, id);
  CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger
    BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
  CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger
    BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    channel TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE INDEX messages_channel ON messages(channel, id);

  CREATE TABLE user_quests (
    user_id INTEGER NOT NULL,
    quest TEXT NOT NULL,
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, quest)
  );

  CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX notifications_user ON notifications(user_id, id);

  CREATE TABLE trials (
    id INTEGER PRIMARY KEY,
    scope TEXT NOT NULL,              -- personal | home | plot | district | global
    scope_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    params TEXT NOT NULL,             -- JSON: \u0443\u0441\u043B\u043E\u0432\u0438\u044F, \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438, \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u043E\u0434\u0441\u0447\u0451\u0442\u0430
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL,
    status TEXT NOT NULL,             -- active | resolved
    result TEXT                       -- JSON: \u0436\u0443\u0440\u043D\u0430\u043B \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430
  );
  CREATE INDEX trials_scope ON trials(scope, scope_id, status);

  CREATE TABLE trial_actions (
    id INTEGER PRIMARY KEY,
    trial_id INTEGER NOT NULL REFERENCES trials(id),
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL
  );
  CREATE INDEX trial_actions_trial ON trial_actions(trial_id);
  `
];
function openDb(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db2 = new DatabaseSync(path);
  db2.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db2);
  seed(db2);
  return db2;
}
function migrate(db2) {
  const row = db2.prepare("PRAGMA user_version").get();
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db2.exec("BEGIN");
    try {
      db2.exec(MIGRATIONS[v]);
      db2.exec(`PRAGMA user_version = ${v + 1}`);
      db2.exec("COMMIT");
    } catch (e) {
      db2.exec("ROLLBACK");
      throw e;
    }
  }
}
function seed(db2) {
  const ins = db2.prepare("INSERT OR IGNORE INTO districts (id, code, name) VALUES (?, ?, ?)");
  for (const d of GAME.districts) ins.run(d.id, d.code, d.name);
}
var txDepth = 0;
var pending = [];
function afterCommit(fn) {
  if (txDepth === 0) fn();
  else pending.push(fn);
}
function tx(db2, fn) {
  if (txDepth > 0) {
    const sp = `sp${txDepth}`;
    const mark = pending.length;
    db2.exec(`SAVEPOINT ${sp}`);
    txDepth++;
    try {
      const r2 = fn();
      db2.exec(`RELEASE ${sp}`);
      return r2;
    } catch (e) {
      db2.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
      pending.length = mark;
      throw e;
    } finally {
      txDepth--;
    }
  }
  db2.exec("BEGIN IMMEDIATE");
  txDepth++;
  let ok = false;
  try {
    const r2 = fn();
    db2.exec("COMMIT");
    ok = true;
    return r2;
  } catch (e) {
    db2.exec("ROLLBACK");
    throw e;
  } finally {
    txDepth--;
    const queue = pending;
    pending = [];
    if (ok) for (const f of queue) {
      try {
        f();
      } catch (err) {
        console.error("afterCommit failed", err);
      }
    }
  }
}
var now = () => Date.now();
var gameDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// server/http.ts
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
var HttpError = class extends Error {
  status;
  code;
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var fail = (status, code, message) => {
  throw new HttpError(status, code, message);
};
var Router = class {
  routes = [];
  add(method, path, handler, auth = true) {
    const keys = [];
    const pattern = new RegExp(
      "^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$"
    );
    this.routes.push({ method, pattern, keys, handler, auth });
  }
  get(p, h, auth = true) {
    this.add("GET", p, h, auth);
  }
  post(p, h, auth = true) {
    this.add("POST", p, h, auth);
  }
  match(method, pathname) {
    for (const r2 of this.routes) {
      if (r2.method !== method) continue;
      const m = r2.pattern.exec(pathname);
      if (!m) continue;
      const params = {};
      r2.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      return { route: r2, params };
    }
    return null;
  }
};
function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}
async function readBody(req, limit = 16384) {
  if (req.method === "GET" || req.method === "HEAD") return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) fail(413, "PAYLOAD_TOO_LARGE", "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441");
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return fail(400, "BAD_JSON", "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 JSON");
  }
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
var buckets = /* @__PURE__ */ new Map();
function rateLimit(key, max, windowMs) {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= t) {
    buckets.set(key, { count: 1, reset: t + windowMs });
    return;
  }
  if (++b.count > max) fail(429, "RATE_LIMITED", "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432. \u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C.");
}
setInterval(() => {
  const t = Date.now();
  for (const [k, b] of buckets) if (b.reset <= t) buckets.delete(k);
}, 6e4).unref();
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json"
};
var EMBEDDED = globalThis.__EXPERIMENT_ASSETS__;
async function serveStatic(root2, pathname, res) {
  if (EMBEDDED) {
    const key = pathname === "/" ? "/index.html" : pathname;
    const data = EMBEDDED[key];
    if (data === void 0) return false;
    res.writeHead(200, { "Content-Type": MIME[extname(key)] ?? "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff" });
    res.end(data);
    return true;
  }
  const rel = normalize(pathname === "/" ? "/index.html" : pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(root2, rel);
  if (!file.startsWith(root2)) return false;
  try {
    const s = await stat(file);
    if (!s.isFile()) return false;
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

// server/services/auth.ts
import { randomBytes, scryptSync, timingSafeEqual, createHash, randomInt } from "node:crypto";

// server/services/allocation.ts
function districtLoads(db2) {
  const since = now() - GAME.allocation.activeWindowDays * 864e5;
  const rows = db2.prepare(
    `SELECT d.id, d.code,
         (SELECT COUNT(*) FROM users u JOIN plots p ON p.id = u.plot_id WHERE p.district_id = d.id) AS residents,
         (SELECT COUNT(*) FROM users u JOIN plots p ON p.id = u.plot_id WHERE p.district_id = d.id AND u.last_active_at >= ?) AS active,
         (SELECT COALESCE(SUM(capacity), 0) FROM plots p WHERE p.district_id = d.id) AS capacity
       FROM districts d ORDER BY d.id`
  ).all(since);
  return rows.map((r2) => ({
    id: r2.id,
    code: r2.code,
    residents: r2.residents,
    active: r2.active,
    free: r2.capacity - r2.residents,
    load: r2.residents + GAME.allocation.activeWeight * r2.active
  }));
}
function chooseDistrict(db2) {
  const loads = districtLoads(db2);
  const shuffled = loads.map((l) => ({ l, r: Math.random() })).sort((a, b) => a.r - b.r).map((x) => x.l);
  shuffled.sort((a, b) => a.load - b.load || b.free - a.free);
  return shuffled[0];
}
function choosePlot(db2, districtId) {
  const since = now() - GAME.allocation.activeWindowDays * 864e5;
  const candidates = db2.prepare(
    `SELECT p.id, p.capacity,
         (SELECT COUNT(*) FROM users u WHERE u.plot_id = p.id) AS residents,
         (SELECT COUNT(*) FROM users u WHERE u.plot_id = p.id AND u.last_active_at >= ?) AS active
       FROM plots p WHERE p.district_id = ?
       ORDER BY active DESC, residents DESC, p.number ASC`
  ).all(since, districtId);
  let plot = candidates.find((c) => c.residents < c.capacity);
  if (!plot) plot = { id: createPlot(db2, districtId), capacity: GAME.plotCapacity };
  const used = new Set(db2.prepare("SELECT slot FROM homes WHERE plot_id = ?").all(plot.id).map((r2) => r2.slot));
  for (let s = 1; s <= plot.capacity; s++) if (!used.has(s)) return { plotId: plot.id, slot: s };
  throw new Error("\u041D\u0435\u0442 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043B\u043E\u0442\u0430 \u0432 \u0443\u0447\u0430\u0441\u0442\u043A\u0435 \u0441 \u043C\u0435\u0441\u0442\u0430\u043C\u0438 \u2014 \u043D\u0430\u0440\u0443\u0448\u0435\u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0441\u0442\u044C");
}
function createPlot(db2, districtId) {
  const d = db2.prepare("UPDATE districts SET plot_seq = plot_seq + 1 WHERE id = ? RETURNING code, plot_seq").get(districtId);
  const id = `${d.code}-P${String(d.plot_seq).padStart(3, "0")}`;
  db2.prepare("INSERT INTO plots (id, district_id, number, capacity, created_at) VALUES (?, ?, ?, ?, ?)").run(
    id,
    districtId,
    d.plot_seq,
    GAME.plotCapacity,
    now()
  );
  return id;
}

// server/services/economy.ts
var userAcc = (id) => `user:${id}`;
var plotAcc = (id) => `plot:${id}`;
var EMISSION = "system:emission";
var SINK = "system:sink";
function adjust(db2, account, delta) {
  const [type, id] = account.split(":");
  if (type === "system") return;
  let changes = 0;
  if (type === "user") {
    changes = Number(db2.prepare("UPDATE users SET cr = cr + ? WHERE id = ? AND cr + ? >= 0").run(delta, Number(id), delta).changes);
  } else if (type === "plot") {
    changes = Number(db2.prepare("UPDATE plots SET fund_balance = fund_balance + ? WHERE id = ? AND fund_balance + ? >= 0").run(delta, id, delta).changes);
  } else {
    fail(500, "BAD_ACCOUNT", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0441\u0447\u0451\u0442");
  }
  if (changes !== 1) fail(409, "INSUFFICIENT_FUNDS", "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E CR");
}
function transfer(db2, t) {
  if (!Number.isInteger(t.amount) || t.amount <= 0) fail(400, "BAD_AMOUNT", "\u0421\u0443\u043C\u043C\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0446\u0435\u043B\u044B\u043C \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u043C");
  if (t.from === t.to) fail(400, "SAME_ACCOUNT", "\u041D\u0435\u043B\u044C\u0437\u044F \u043F\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u043D\u0430 \u0442\u043E\u0442 \u0436\u0435 \u0441\u0447\u0451\u0442");
  return tx(db2, () => {
    adjust(db2, t.from, -t.amount);
    adjust(db2, t.to, t.amount);
    const r2 = db2.prepare("INSERT INTO ledger (at, kind, from_account, to_account, amount, memo, ref) VALUES (?, ?, ?, ?, ?, ?, ?)").run(now(), t.kind, t.from, t.to, t.amount, t.memo ?? "", t.ref ?? null);
    return Number(r2.lastInsertRowid);
  });
}
function refreshDaily(db2, userId) {
  const day = gameDay();
  db2.prepare("UPDATE users SET ap = ?, ap_day = ?, basic_shifts = 0 WHERE id = ? AND ap_day <> ?").run(GAME.dailyAP, day, userId, day);
}
function spendAP(db2, userId, amount) {
  refreshDaily(db2, userId);
  const r2 = db2.prepare("UPDATE users SET ap = ap - ? WHERE id = ? AND ap >= ?").run(amount, userId, amount);
  if (Number(r2.changes) !== 1) fail(409, "NOT_ENOUGH_AP", "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043E\u0447\u043A\u043E\u0432 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 (AP)");
}
function ledgerFor(db2, account, limit = 50) {
  return db2.prepare(
    `SELECT id, at, kind, from_account, to_account, amount, memo FROM ledger
       WHERE from_account = ? OR to_account = ? ORDER BY id DESC LIMIT ?`
  ).all(account, account, limit).map((r2) => ({ ...r2, direction: r2.to_account === account ? "in" : "out" }));
}

// server/services/bus.ts
var conns = /* @__PURE__ */ new Set();
function subscribe(res, userId, plotId) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.write(": connected\n\n");
  const conn = { res, userId, plotId };
  conns.add(conn);
  res.on("close", () => conns.delete(conn));
}
function write(c, event, data) {
  c.res.write(`event: ${event}
data: ${JSON.stringify(data)}

`);
}
function toUser(userId, event, data) {
  for (const c of conns) if (c.userId === userId) write(c, event, data);
}
function toPlot(plotId, event, data) {
  for (const c of conns) if (c.plotId === plotId) write(c, event, data);
}
function onlineUserIds() {
  return new Set([...conns].map((c) => c.userId));
}
setInterval(() => {
  for (const c of conns) c.res.write(": ping\n\n");
}, 25e3).unref();

// server/services/progress.ts
function notify(db2, userId, kind, title, body) {
  const at = now();
  const r2 = db2.prepare("INSERT INTO notifications (user_id, kind, title, body, at) VALUES (?, ?, ?, ?, ?)").run(userId, kind, title, body, at);
  const id = Number(r2.lastInsertRowid);
  afterCommit(() => toUser(userId, "notification", { id, kind, title, body, at }));
}
function questStatus(db2, userId) {
  const done = new Map(
    db2.prepare("SELECT quest, completed_at FROM user_quests WHERE user_id = ?").all(userId).map((r2) => [r2.quest, r2.completed_at])
  );
  return QUESTS.map((q) => ({ ...q, completedAt: done.get(q.key) ?? null }));
}
function completeQuest(db2, userId, key) {
  const r2 = db2.prepare("INSERT OR IGNORE INTO user_quests (user_id, quest, completed_at) VALUES (?, ?, ?)").run(userId, key, now());
  if (Number(r2.changes) === 0) return;
  const q = QUESTS.find((x) => x.key === key);
  notify(db2, userId, "quest", "\u0417\u0410\u0414\u0410\u041D\u0418\u0415 \u0412\u042B\u041F\u041E\u041B\u041D\u0415\u041D\u041E", q ? q.title : key);
  afterCommit(() => toUser(userId, "state", { reason: "quest" }));
  updateAccess(db2, userId);
}
function updateAccess(db2, userId) {
  const done = new Set(db2.prepare("SELECT quest FROM user_quests WHERE user_id = ?").all(userId).map((r2) => r2.quest));
  let level = 1;
  if (GAME.access.district.every((k) => done.has(k))) level = 2;
  if (level === 2 && GAME.access.world.every((k) => done.has(k))) level = 3;
  const cur = db2.prepare("SELECT access_level FROM users WHERE id = ?").get(userId).access_level;
  if (level > cur) {
    db2.prepare("UPDATE users SET access_level = ? WHERE id = ?").run(level, userId);
    notify(
      db2,
      userId,
      "system",
      "\u0423\u0420\u041E\u0412\u0415\u041D\u042C \u0414\u041E\u0421\u0422\u0423\u041F\u0410 \u041F\u041E\u0412\u042B\u0428\u0415\u041D",
      level === 2 ? "\u0412\u0430\u043C \u043E\u0442\u043A\u0440\u044B\u0442\u0430 \u043A\u0430\u0440\u0442\u0430 \u0440\u0430\u0439\u043E\u043D\u0430. \u0412\u0430\u0448 \u0443\u0447\u0430\u0441\u0442\u043E\u043A \u2014 \u043D\u0435 \u0435\u0434\u0438\u043D\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439." : "\u0412\u0430\u043C \u043E\u0442\u043A\u0440\u044B\u0442\u0430 \u043A\u0430\u0440\u0442\u0430 \u043C\u0438\u0440\u0430. \u0420\u0430\u0439\u043E\u043D\u043E\u0432 \u0447\u0435\u0442\u044B\u0440\u0435. \u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u0442 \u0437\u0430 \u0432\u0441\u0435\u043C\u0438."
    );
  }
}

// server/services/world.ts
var pad6 = (n) => String(n).padStart(6, "0");
var homeCode = (slot) => `H-${String(slot).padStart(2, "0")}`;
var DAY = 864e5;
function getUser(db2, userId) {
  refreshDaily(db2, userId);
  const u = db2.prepare(
    `SELECT u.id, u.username, u.subject_no, u.cr, u.ap, u.basic_shifts, u.access_level, u.plot_id, u.home_id,
              u.created_at, u.resident_since, p.district_id
       FROM users u LEFT JOIN plots p ON p.id = u.plot_id WHERE u.id = ?`
  ).get(userId);
  if (!u) fail(401, "NO_USER", "\u0418\u0441\u043F\u044B\u0442\u0443\u0435\u043C\u044B\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D");
  return u;
}
function touch(db2, userId) {
  db2.prepare("UPDATE users SET last_active_at = ? WHERE id = ? AND last_active_at < ?").run(now(), userId, now() - 6e4);
}
function me(db2, userId) {
  const u = getUser(db2, userId);
  const unread = db2.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0").get(userId).n;
  return {
    id: u.id,
    username: u.username,
    subjectNo: pad6(u.subject_no),
    districtId: u.district_id,
    plotId: u.plot_id,
    plotLabel: u.plot_id ? "P-" + u.plot_id.split("-P")[1] : null,
    cr: u.cr,
    ap: u.ap,
    dailyAP: GAME.dailyAP,
    basicShifts: u.basic_shifts,
    accessLevel: u.access_level,
    createdAt: u.created_at,
    residentSince: u.resident_since,
    unread,
    quests: questStatus(db2, userId)
  };
}
function homeProtection(db2, homeId) {
  if (!homeId) return 0;
  const has = db2.prepare("SELECT 1 FROM home_upgrades WHERE home_id = ? AND upgrade = 'safe'").get(homeId);
  return has ? GAME.upgrades.safe.protectsCR ?? 0 : 0;
}
var protectedCR = (db2, userId) => homeProtection(db2, db2.prepare("SELECT home_id FROM users WHERE id = ?").get(userId)?.home_id ?? null);
function home(db2, userId) {
  const u = getUser(db2, userId);
  const h = db2.prepare("SELECT * FROM homes WHERE id = ?").get(u.home_id);
  if (!h) fail(404, "NO_HOME", "\u0416\u0438\u043B\u044C\u0451 \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E");
  const def = GAME.housing[h.type];
  const upgrades = db2.prepare("SELECT upgrade, purchased_at FROM home_upgrades WHERE home_id = ?").all(h.id);
  const owned = new Set(upgrades.map((x) => x.upgrade));
  const storage = def.storage + upgrades.reduce((s, x) => s + (GAME.upgrades[x.upgrade]?.storageBonus ?? 0), 0);
  const residents = db2.prepare("SELECT subject_no, username FROM users WHERE home_id = ?").all(h.id);
  const owner = db2.prepare("SELECT subject_no, username FROM users WHERE id = ?").get(h.owner_id);
  const log = db2.prepare("SELECT kind, detail, at FROM home_log WHERE home_id = ? ORDER BY id DESC LIMIT 30").all(h.id);
  const mail = db2.prepare("SELECT title, body, at FROM notifications WHERE user_id = ? AND kind = 'mail' ORDER BY id DESC LIMIT 10").all(userId);
  completeQuest(db2, userId, "open_home");
  return {
    id: h.id,
    code: homeCode(h.slot),
    address: `${h.plot_id} / ${homeCode(h.slot)}`,
    type: h.type,
    typeName: def.name,
    owner: owner ? { subjectNo: pad6(owner.subject_no), username: owner.username } : null,
    residents: residents.map((r2) => ({ subjectNo: pad6(r2.subject_no), username: r2.username })),
    capacity: def.residents,
    condition: h.condition,
    upkeepWeekly: def.upkeepWeekly,
    storage,
    protectedCR: homeProtection(db2, h.id),
    upgrades: Object.entries(GAME.upgrades).map(([key, g]) => ({
      key,
      name: g.name,
      price: g.price,
      desc: g.desc,
      owned: owned.has(key)
    })),
    log,
    mail
  };
}
function buyUpgrade(db2, userId, key) {
  if (typeof key !== "string" || !GAME.upgrades[key]) fail(400, "BAD_UPGRADE", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E\u0435 \u0443\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435");
  const k = key;
  const g = GAME.upgrades[k];
  tx(db2, () => {
    const u = getUser(db2, userId);
    const h = db2.prepare("SELECT id, owner_id FROM homes WHERE id = ?").get(u.home_id);
    if (!h || h.owner_id !== userId) fail(403, "NOT_OWNER", "\u0423\u043B\u0443\u0447\u0448\u0430\u0442\u044C \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043B\u0430\u0434\u0435\u043B\u0435\u0446 \u0436\u0438\u043B\u044C\u044F");
    if (db2.prepare("SELECT 1 FROM home_upgrades WHERE home_id = ? AND upgrade = ?").get(h.id, k)) fail(409, "ALREADY_OWNED", "\u0423\u043B\u0443\u0447\u0448\u0435\u043D\u0438\u0435 \u0443\u0436\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E");
    transfer(db2, { from: userAcc(userId), to: SINK, amount: g.price, kind: "HOME_UPGRADE", memo: g.name, ref: `home:${h.id}` });
    db2.prepare("INSERT INTO home_upgrades (home_id, upgrade, purchased_by, purchased_at) VALUES (?, ?, ?, ?)").run(h.id, k, userId, now());
    db2.prepare("INSERT INTO home_log (home_id, user_id, kind, detail, at) VALUES (?, ?, ?, ?, ?)").run(
      h.id,
      userId,
      "upgrade",
      `\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E: ${g.name} (\u2212${g.price} CR)`,
      now()
    );
  });
  return home(db2, userId);
}
function doWork(db2, userId, kind) {
  if (typeof kind !== "string" || !GAME.work[kind]) fail(400, "BAD_WORK", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u0440\u0430\u0431\u043E\u0442\u044B");
  const w = GAME.work[kind];
  const result = tx(db2, () => {
    const u = getUser(db2, userId);
    if (w.dailyLimit && kind === "basic" && u.basic_shifts >= w.dailyLimit)
      fail(409, "SHIFT_LIMIT", `\u041B\u0438\u043C\u0438\u0442 \u0431\u0430\u0437\u043E\u0432\u044B\u0445 \u0441\u043C\u0435\u043D \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F: ${w.dailyLimit}`);
    spendAP(db2, userId, w.ap);
    if (kind === "basic") db2.prepare("UPDATE users SET basic_shifts = basic_shifts + 1 WHERE id = ?").run(userId);
    transfer(db2, { from: EMISSION, to: userAcc(userId), amount: w.cr, kind: "SYSTEM_WAGE", memo: w.name });
    return { earned: w.cr, spentAP: w.ap };
  });
  completeQuest(db2, userId, "basic_work");
  completeQuest(db2, userId, "first_salary");
  return { ...result, me: me(db2, userId) };
}
function workInfo(db2, userId) {
  const u = getUser(db2, userId);
  return {
    ap: u.ap,
    jobs: Object.entries(GAME.work).map(([key, w]) => ({
      key,
      name: w.name,
      ap: w.ap,
      cr: w.cr,
      limit: w.dailyLimit || null,
      used: key === "basic" ? u.basic_shifts : null
    }))
  };
}
function economy(db2, userId) {
  const u = getUser(db2, userId);
  return { cr: u.cr, ap: u.ap, protectedCR: protectedCR(db2, userId), ledger: ledgerFor(db2, userAcc(userId), 50) };
}
function neighbors(db2, userId) {
  const u = getUser(db2, userId);
  const online = onlineUserIds();
  const rows = db2.prepare(
    `SELECT u.id, u.subject_no, u.username, u.last_active_at, u.resident_since, h.slot, h.type
       FROM users u LEFT JOIN homes h ON h.id = u.home_id WHERE u.plot_id = ? ORDER BY h.slot`
  ).all(u.plot_id);
  completeQuest(db2, userId, "meet_neighbors");
  return {
    plotId: u.plot_id,
    capacity: GAME.plotCapacity,
    residents: rows.map((r2) => ({
      subjectNo: pad6(r2.subject_no),
      username: r2.username,
      home: homeCode(r2.slot),
      housing: GAME.housing[r2.type]?.name,
      isYou: r2.id === userId,
      online: online.has(r2.id),
      active7d: r2.last_active_at >= now() - 7 * DAY,
      residentSince: r2.resident_since
    }))
  };
}
function fund(db2, userId) {
  const u = getUser(db2, userId);
  const p = db2.prepare("SELECT fund_balance FROM plots WHERE id = ?").get(u.plot_id);
  const ops = ledgerFor(db2, plotAcc(u.plot_id), 30).map((op) => {
    const other = op.direction === "in" ? op.from_account : op.to_account;
    const m = /^user:(\d+)$/.exec(other);
    const who = m ? db2.prepare("SELECT subject_no FROM users WHERE id = ?").get(Number(m[1])) : null;
    return { at: op.at, kind: op.kind, amount: op.amount, direction: op.direction, memo: op.memo, subjectNo: who ? pad6(who.subject_no) : null };
  });
  completeQuest(db2, userId, "view_fund");
  return {
    plotId: u.plot_id,
    balance: p.fund_balance,
    ops,
    rules: "\u0412\u0437\u043D\u043E\u0441\u044B \u0434\u043E\u0431\u0440\u043E\u0432\u043E\u043B\u044C\u043D\u044B\u0435. \u0420\u0430\u0441\u0445\u043E\u0434 \u0444\u043E\u043D\u0434\u0430 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u043F\u0440\u043E\u0435\u043A\u0442\u044B, \u043E\u0434\u043E\u0431\u0440\u0435\u043D\u043D\u044B\u0435 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0436\u0438\u0442\u0435\u043B\u0435\u0439 (\u043C\u043E\u0434\u0443\u043B\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F). \u041F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043B\u044C \u0443\u0447\u0430\u0441\u0442\u043A\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u0432\u0435\u0441\u0442\u0438 \u0444\u043E\u043D\u0434 \u0435\u0434\u0438\u043D\u043E\u043B\u0438\u0447\u043D\u043E."
  };
}
function donate(db2, userId, amount) {
  const a = Number(amount);
  if (!Number.isInteger(a) || a < 1 || a > GAME.fund.maxDonation) fail(400, "BAD_AMOUNT", "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0446\u0435\u043B\u0443\u044E \u0441\u0443\u043C\u043C\u0443 \u043E\u0442 1 CR");
  const u = getUser(db2, userId);
  transfer(db2, { from: userAcc(userId), to: plotAcc(u.plot_id), amount: a, kind: "FUND_DONATION", memo: "\u0414\u043E\u0431\u0440\u043E\u0432\u043E\u043B\u044C\u043D\u044B\u0439 \u0432\u0437\u043D\u043E\u0441" });
  afterCommit(() => toPlot(u.plot_id, "fund", { plotId: u.plot_id }));
  return fund(db2, userId);
}
var lastMsg = /* @__PURE__ */ new Map();
function chatHistory(db2, userId, before) {
  const u = getUser(db2, userId);
  const rows = db2.prepare(
    `SELECT m.id, m.body, m.at, u.subject_no, u.username, m.user_id FROM messages m JOIN users u ON u.id = m.user_id
       WHERE m.channel = ? AND m.id < ? ORDER BY m.id DESC LIMIT 50`
  ).all(`plot:${u.plot_id}`, before ?? Number.MAX_SAFE_INTEGER);
  return rows.reverse().map((r2) => ({ id: r2.id, body: r2.body, at: r2.at, subjectNo: pad6(r2.subject_no), username: r2.username, isYou: r2.user_id === userId }));
}
function postChat(db2, userId, body) {
  if (typeof body !== "string") fail(400, "BAD_MESSAGE", "\u041F\u0443\u0441\u0442\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435");
  const text = body.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();
  if (!text) fail(400, "BAD_MESSAGE", "\u041F\u0443\u0441\u0442\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435");
  if (text.length > GAME.chat.maxLength) fail(400, "TOO_LONG", `\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${GAME.chat.maxLength} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432`);
  const t = now();
  if ((lastMsg.get(userId) ?? 0) > t - GAME.chat.minIntervalMs) fail(429, "TOO_FAST", "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0447\u0430\u0441\u0442\u043E");
  lastMsg.set(userId, t);
  const u = getUser(db2, userId);
  const r2 = db2.prepare("INSERT INTO messages (channel, user_id, body, at) VALUES (?, ?, ?, ?)").run(`plot:${u.plot_id}`, userId, text, t);
  const msg = { id: Number(r2.lastInsertRowid), body: text, at: t, subjectNo: pad6(u.subject_no), username: u.username, userId };
  toPlot(u.plot_id, "chat", msg);
  completeQuest(db2, userId, "first_message");
  return { ...msg, isYou: true };
}
function plotMetrics(db2, plotId) {
  const residents = db2.prepare("SELECT COUNT(*) AS n FROM users WHERE plot_id = ?").get(plotId).n;
  const since = now() - 7 * DAY;
  const chatters = db2.prepare(
    `SELECT COUNT(DISTINCT m.user_id) AS n FROM messages m JOIN users u ON u.id = m.user_id
     WHERE m.channel = ? AND m.at >= ? AND u.plot_id = ?`
  ).get(`plot:${plotId}`, since, plotId).n;
  const donors = db2.prepare(
    `SELECT COUNT(DISTINCT from_account) AS n FROM ledger WHERE to_account = ? AND at >= ? AND from_account LIKE 'user:%'`
  ).get(plotAcc(plotId), since).n;
  const trials = db2.prepare(
    `SELECT json_extract(result, '$.outcome') AS outcome FROM trials WHERE scope = 'plot' AND scope_id = ? AND status = 'resolved'`
  ).all(plotId);
  const passed = trials.filter((t) => t.outcome === "passed").length;
  const failed = trials.length - passed;
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
  return {
    residents,
    // Доверие: исходы коллективных испытаний
    trust: clamp(50 + 10 * passed - 10 * failed),
    // Сплочённость: доля жителей, общавшихся и вносивших в фонд за 7 дней
    cohesion: residents ? clamp(100 * (0.6 * chatters / residents + 0.4 * Math.min(1, donors / residents))) : 0,
    // Инфраструктура: базовый общественный центр (20) + построенные объекты (модуль строительства — далее)
    infrastructure: 20,
    // Безопасность: база 50, пока нет преступлений и центра безопасности
    security: 50
  };
}
var PLOT_FACILITIES = [
  { key: "community_center", name: "\u041E\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0446\u0435\u043D\u0442\u0440", status: "active", desc: "\u0427\u0430\u0442 \u0443\u0447\u0430\u0441\u0442\u043A\u0430, \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F, \u0444\u043E\u043D\u0434." },
  { key: "market", name: "\u041C\u0435\u0441\u0442\u043D\u044B\u0439 \u0440\u044B\u043D\u043E\u043A", status: "site", desc: "\u0421\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430. \u0421\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0436\u0438\u0442\u0435\u043B\u0435\u0439 (\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F)." },
  { key: "workshop", name: "\u041C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0430\u044F", status: "site", desc: "\u0421\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 \u043F\u043E\u0434 \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0443\u044E." },
  { key: "site_a", name: "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 A", short: "\u041F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 A", status: "site", desc: "\u041C\u043E\u0436\u043D\u043E \u043F\u043E\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0440\u0435\u0442\u0440\u0430\u043D\u0441\u043B\u044F\u0442\u043E\u0440, \u0441\u043A\u043B\u0430\u0434, \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u043F\u0443\u043D\u043A\u0442 \u0438 \u0434\u0440." },
  { key: "site_b", name: "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u0430\u044F \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 B", short: "\u041F\u043B\u043E\u0449\u0430\u0434\u043A\u0430 B", status: "site", desc: "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u043E\u0435 \u043C\u0435\u0441\u0442\u043E \u0434\u043B\u044F \u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430." }
];
function mapPlot(db2, userId) {
  const u = getUser(db2, userId);
  const online = onlineUserIds();
  const homes = db2.prepare(
    `SELECT h.id, h.slot, h.type, GROUP_CONCAT(u.subject_no) AS subjects, GROUP_CONCAT(u.username) AS names,
              MAX(CASE WHEN u.id = ? THEN 1 ELSE 0 END) AS mine, GROUP_CONCAT(u.id) AS ids
       FROM homes h LEFT JOIN users u ON u.home_id = h.id WHERE h.plot_id = ? GROUP BY h.id`
  ).all(userId, u.plot_id);
  const bySlot = new Map(homes.map((h) => [h.slot, h]));
  const slots = [];
  for (let s = 1; s <= GAME.plotCapacity; s++) {
    const h = bySlot.get(s);
    if (!h) {
      slots.push({ slot: s, code: homeCode(s), status: "free" });
      continue;
    }
    const ids = String(h.ids ?? "").split(",").filter(Boolean).map(Number);
    slots.push({
      slot: s,
      code: homeCode(s),
      status: "occupied",
      type: GAME.housing[h.type]?.name,
      mine: !!h.mine,
      online: ids.some((id) => online.has(id)),
      residents: String(h.subjects ?? "").split(",").filter(Boolean).map((n, i) => ({ subjectNo: pad6(Number(n)), username: String(h.names).split(",")[i] }))
    });
  }
  const activeTrial = db2.prepare("SELECT id, title, ends_at FROM trials WHERE scope = 'plot' AND scope_id = ? AND status = 'active'").get(u.plot_id);
  completeQuest(db2, userId, "view_map");
  return { plotId: u.plot_id, districtId: u.district_id, slots, facilities: PLOT_FACILITIES, metrics: plotMetrics(db2, u.plot_id), events: activeTrial ? [activeTrial] : [] };
}
function mapDistrict(db2, userId) {
  const u = getUser(db2, userId);
  if (u.access_level < 2) fail(403, "ACCESS_LEVEL", "\u0423\u0420\u041E\u0412\u0415\u041D\u042C \u0414\u041E\u0421\u0422\u0423\u041F\u0410 \u041D\u0415\u0414\u041E\u0421\u0422\u0410\u0422\u041E\u0427\u0415\u041D. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0437\u0430\u0434\u0430\u043D\u0438\u044F: \u043A\u0430\u0440\u0442\u0430, \u0441\u043E\u0441\u0435\u0434\u0438, \u043F\u0435\u0440\u0432\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435.");
  const d = db2.prepare("SELECT id, code, name FROM districts WHERE id = ?").get(u.district_id);
  const plots = db2.prepare(
    `SELECT p.id, p.number, p.capacity, p.fund_balance,
       (SELECT COUNT(*) FROM users x WHERE x.plot_id = p.id) AS residents,
       (SELECT COUNT(*) FROM users x WHERE x.plot_id = p.id AND x.last_active_at >= ?) AS active
     FROM plots p WHERE p.district_id = ? ORDER BY p.number`
  ).all(now() - 7 * DAY, u.district_id).map((p) => ({ ...p, mine: p.id === u.plot_id, metrics: plotMetrics(db2, p.id) }));
  const facilities = [
    { key: "administration", name: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F", status: "locked", desc: "\u0420\u0430\u0439\u043E\u043D\u043D\u044B\u0439 \u0441\u043E\u0432\u0435\u0442 \u0435\u0449\u0451 \u043D\u0435 \u0438\u0437\u0431\u0440\u0430\u043D." },
    { key: "court", name: "\u0421\u0443\u0434", status: "locked", desc: "\u0421\u0443\u0434\u0435\u0431\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0435 \u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u0430." },
    { key: "bank", name: "\u0411\u0430\u043D\u043A", status: "locked", desc: "\u0411\u0430\u043D\u043A\u043E\u0432\u0441\u043A\u0438\u0439 \u043C\u043E\u0434\u0443\u043B\u044C \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F." },
    { key: "labor", name: "\u0411\u0438\u0440\u0436\u0430 \u0442\u0440\u0443\u0434\u0430", status: "active", desc: "\u0421\u0438\u0441\u0442\u0435\u043C\u043D\u0430\u044F \u0431\u0430\u0437\u043E\u0432\u0430\u044F \u0440\u0430\u0431\u043E\u0442\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u0432\u0441\u0435\u043C." },
    { key: "market", name: "\u0420\u0430\u0439\u043E\u043D\u043D\u044B\u0439 \u0440\u044B\u043D\u043E\u043A", status: "locked", desc: "\u0415\u0434\u0438\u043D\u044B\u0439 \u0440\u044B\u043D\u043E\u043A \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F." },
    { key: "comms", name: "\u0426\u0435\u043D\u0442\u0440 \u0441\u0432\u044F\u0437\u0438", status: "locked", desc: "\u0420\u0430\u0439\u043E\u043D\u043D\u044B\u0435 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F." }
  ];
  return { district: d, plots, facilities };
}
function mapWorld(db2, userId) {
  const u = getUser(db2, userId);
  if (u.access_level < 3) fail(403, "ACCESS_LEVEL", "\u0423\u0420\u041E\u0412\u0415\u041D\u042C \u0414\u041E\u0421\u0422\u0423\u041F\u0410 \u041D\u0415\u0414\u041E\u0421\u0422\u0410\u0422\u041E\u0427\u0415\u041D. \u041F\u0440\u0438\u043C\u0438\u0442\u0435 \u0443\u0447\u0430\u0441\u0442\u0438\u0435 \u0432 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0438.");
  const loads = districtLoads(db2);
  return {
    districts: loads.map((l) => {
      const d = db2.prepare("SELECT name FROM districts WHERE id = ?").get(l.id);
      const money = db2.prepare(
        `SELECT COALESCE(SUM(u.cr), 0) AS cr FROM users u JOIN plots p ON p.id = u.plot_id WHERE p.district_id = ?`
      ).get(l.id);
      const plotIds = db2.prepare("SELECT id FROM plots WHERE district_id = ?").all(l.id).map((p) => p.id);
      const ms = plotIds.map((id) => plotMetrics(db2, id));
      const avg = (k) => ms.length ? Math.round(ms.reduce((s, m) => s + m[k], 0) / ms.length) : null;
      return {
        id: l.id,
        name: d.name,
        mine: l.id === u.district_id,
        residents: l.residents,
        active: l.active,
        plots: plotIds.length,
        moneySupply: money.cr,
        leadership: "\u0421\u043E\u0432\u0435\u0442 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D",
        stability: avg("trust"),
        infrastructure: avg("infrastructure"),
        catastrophes: []
      };
    })
  };
}
function notifications(db2, userId) {
  return db2.prepare("SELECT id, kind, title, body, at, read FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100").all(userId);
}
function markRead(db2, userId) {
  db2.prepare("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0").run(userId);
  return { ok: true };
}

// server/services/trials.ts
var pad62 = (n) => String(n).padStart(6, "0");
function startCollectiveSacrifice(db2, plotId) {
  const cfg = GAME.trials.collectiveSacrifice;
  const residents = db2.prepare("SELECT id FROM users WHERE plot_id = ?").all(plotId).map((r3) => r3.id);
  if (residents.length === 0) return;
  const target = Math.max(cfg.perResidentTarget, cfg.perResidentTarget * residents.length);
  const t = now();
  const params = {
    participants: residents,
    target,
    rules: {
      decisions: ["contribute", "refuse"],
      scoring: "\u0421\u0443\u043C\u043C\u0430 \u0432\u0437\u043D\u043E\u0441\u043E\u0432 \u0432 \u0444\u043E\u043D\u0434 \u0443\u0447\u0430\u0441\u0442\u043A\u0430 \u0437\u0430 \u0432\u0440\u0435\u043C\u044F \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F \u2265 \u0446\u0435\u043B\u0438 \u2192 \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0439\u0434\u0435\u043D\u043E.",
      penalty: `\u041F\u0440\u0438 \u043F\u0440\u043E\u0432\u0430\u043B\u0435 \u043A\u0430\u0436\u0434\u044B\u0439 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0442\u0435\u0440\u044F\u0435\u0442 ${cfg.penaltyPct}% \u043D\u0435\u0437\u0430\u0449\u0438\u0449\u0451\u043D\u043D\u044B\u0445 CR, \u043D\u043E \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 ${cfg.penaltyCap} CR.`
    }
  };
  const r2 = db2.prepare(
    `INSERT INTO trials (scope, scope_id, kind, title, description, params, starts_at, ends_at, status)
     VALUES ('plot', ?, 'collective_sacrifice', ?, ?, ?, ?, ?, 'active')`
  ).run(
    plotId,
    "\u041A\u041E\u041B\u041B\u0415\u041A\u0422\u0418\u0412\u041D\u0410\u042F \u0416\u0415\u0420\u0422\u0412\u0410",
    `\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043E\u0442 \u0443\u0447\u0430\u0441\u0442\u043A\u0430 ${plotId} \u0432\u043D\u0435\u0441\u0442\u0438 \u0432 \u043E\u0431\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0444\u043E\u043D\u0434 ${target} CR. \u0412\u0437\u043D\u043E\u0441\u044B \u0434\u043E\u0431\u0440\u043E\u0432\u043E\u043B\u044C\u043D\u044B\u0435 \u0438 \u0432\u0438\u0434\u043D\u044B \u0432\u0441\u0435\u043C \u0436\u0438\u0442\u0435\u043B\u044F\u043C. \u0415\u0441\u043B\u0438 \u0446\u0435\u043B\u044C \u043D\u0435 \u0431\u0443\u0434\u0435\u0442 \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430, \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0430\u043A\u0430\u0436\u0435\u0442 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430. \u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u043D\u0435\u0441\u0442\u0438 CR \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u043E \u043E\u0442\u043A\u0430\u0437\u0430\u0442\u044C\u0441\u044F.`,
    JSON.stringify(params),
    t,
    t + GAME.trials.durationSec * 1e3
  );
  const id = Number(r2.lastInsertRowid);
  for (const uid2 of residents) notify(db2, uid2, "trial", "\u041D\u041E\u0412\u041E\u0415 \u0418\u0421\u041F\u042B\u0422\u0410\u041D\u0418\u0415", `\xAB\u041A\u041E\u041B\u041B\u0415\u041A\u0422\u0418\u0412\u041D\u0410\u042F \u0416\u0415\u0420\u0422\u0412\u0410\xBB. \u0426\u0435\u043B\u044C: ${target} CR \u0432 \u0444\u043E\u043D\u0434 \u0443\u0447\u0430\u0441\u0442\u043A\u0430.`);
  afterCommit(() => toPlot(plotId, "trial", { id }));
}
function resolveCollectiveSacrifice(db2, trial) {
  const cfg = GAME.trials.collectiveSacrifice;
  const params = JSON.parse(trial.params);
  const total = db2.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM trial_actions WHERE trial_id = ? AND action = 'contribute'").get(trial.id).s;
  const passed = total >= params.target;
  const penalties = [];
  if (!passed) {
    for (const uid2 of params.participants) {
      const u = db2.prepare("SELECT id, cr, subject_no, plot_id FROM users WHERE id = ?").get(uid2);
      if (!u || u.plot_id !== trial.scope_id) continue;
      if ((params.exempt ?? []).includes(uid2)) continue;
      const unprotected = Math.max(0, u.cr - protectedCR(db2, uid2));
      const amount = Math.min(cfg.penaltyCap, Math.floor(unprotected * cfg.penaltyPct / 100));
      if (amount > 0) {
        transfer(db2, { from: userAcc(uid2), to: SINK, amount, kind: "TRIAL_PENALTY", memo: trial.title, ref: `trial:${trial.id}` });
      }
      penalties.push({ subjectNo: pad62(u.subject_no), amount });
    }
  }
  const result = { outcome: passed ? "passed" : "failed", total, target: params.target, penalties, resolvedAt: now() };
  db2.prepare("UPDATE trials SET status = 'resolved', result = ? WHERE id = ?").run(JSON.stringify(result), trial.id);
  for (const uid2 of params.participants) {
    notify(
      db2,
      uid2,
      "trial",
      passed ? "\u0418\u0421\u041F\u042B\u0422\u0410\u041D\u0418\u0415 \u041F\u0420\u041E\u0419\u0414\u0415\u041D\u041E" : "\u0418\u0421\u041F\u042B\u0422\u0410\u041D\u0418\u0415 \u041F\u0420\u041E\u0412\u0410\u041B\u0415\u041D\u041E",
      passed ? `\u0423\u0447\u0430\u0441\u0442\u043E\u043A \u0441\u043E\u0431\u0440\u0430\u043B ${total} \u0438\u0437 ${params.target} CR. \u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u0447\u0435\u0441\u0442\u0432\u043E.` : `\u0423\u0447\u0430\u0441\u0442\u043E\u043A \u0441\u043E\u0431\u0440\u0430\u043B ${total} \u0438\u0437 ${params.target} CR. \u041D\u0430\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u043F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u043E. \u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043B\u0430 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442.`
    );
  }
  afterCommit(() => toPlot(trial.scope_id, "trial", { id: trial.id }));
}
function joinActiveTrials(db2, plotId, userId) {
  const active = db2.prepare("SELECT id, params FROM trials WHERE scope = 'plot' AND scope_id = ? AND status = 'active'").all(plotId);
  for (const t of active) {
    const params = JSON.parse(t.params);
    if (params.participants.includes(userId)) continue;
    params.participants.push(userId);
    params.exempt = [...params.exempt ?? [], userId];
    db2.prepare("UPDATE trials SET params = ? WHERE id = ?").run(JSON.stringify(params), t.id);
  }
}
function schedulerTick(db2) {
  const t = now();
  const due = db2.prepare("SELECT * FROM trials WHERE status = 'active' AND ends_at <= ?").all(t);
  for (const trial of due) {
    try {
      tx(db2, () => {
        const fresh = db2.prepare("SELECT status FROM trials WHERE id = ?").get(trial.id);
        if (fresh.status !== "active") return;
        if (trial.kind === "collective_sacrifice") resolveCollectiveSacrifice(db2, trial);
      });
    } catch (e) {
      console.error("trial resolve failed", trial.id, e);
    }
  }
  const plots = db2.prepare(
    `SELECT p.id FROM plots p
     WHERE EXISTS (SELECT 1 FROM users u WHERE u.plot_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM trials t WHERE t.scope = 'plot' AND t.scope_id = p.id AND t.status = 'active')
       AND NOT EXISTS (SELECT 1 FROM trials t WHERE t.scope = 'plot' AND t.scope_id = p.id AND t.ends_at > ?)`
  ).all(t - GAME.trials.cooldownSec * 1e3);
  for (const p of plots) {
    try {
      tx(db2, () => startCollectiveSacrifice(db2, p.id));
    } catch (e) {
      console.error("trial start failed", p.id, e);
    }
  }
}
function present(db2, trial, userId) {
  const params = JSON.parse(trial.params);
  const actions = db2.prepare(
    `SELECT a.action, a.amount, a.at, a.user_id, u.subject_no FROM trial_actions a JOIN users u ON u.id = a.user_id
     WHERE a.trial_id = ? ORDER BY a.id`
  ).all(trial.id);
  const total = actions.filter((a) => a.action === "contribute").reduce((s, a) => s + a.amount, 0);
  return {
    id: trial.id,
    scope: trial.scope,
    scopeId: trial.scope_id,
    kind: trial.kind,
    title: trial.title,
    description: trial.description,
    startsAt: trial.starts_at,
    endsAt: trial.ends_at,
    status: trial.status,
    target: params.target,
    rules: params.rules,
    participantCount: params.participants.length,
    isParticipant: params.participants.includes(userId),
    total,
    myContribution: actions.filter((a) => a.user_id === userId && a.action === "contribute").reduce((s, a) => s + a.amount, 0),
    myRefused: actions.some((a) => a.user_id === userId && a.action === "refuse"),
    log: actions.map((a) => ({ subjectNo: pad62(a.subject_no), action: a.action, amount: a.amount, at: a.at })),
    result: trial.result ? JSON.parse(trial.result) : null
  };
}
function listTrials(db2, userId) {
  const u = getUser(db2, userId);
  const rows = db2.prepare(
    "SELECT * FROM trials WHERE scope = 'plot' AND scope_id = ? ORDER BY id DESC LIMIT 10"
  ).all(u.plot_id);
  return rows.map((r2) => present(db2, r2, userId));
}
function act(db2, userId, trialId, action, amount) {
  if (action !== "contribute" && action !== "refuse") fail(400, "BAD_ACTION", "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435");
  const out = tx(db2, () => {
    const trial = db2.prepare("SELECT * FROM trials WHERE id = ?").get(trialId);
    if (!trial) fail(404, "NO_TRIAL", "\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E");
    const tr = trial;
    if (tr.status !== "active" || tr.ends_at <= now()) fail(409, "TRIAL_CLOSED", "\u0418\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E");
    const params = JSON.parse(tr.params);
    if (!params.participants.includes(userId)) fail(403, "NOT_PARTICIPANT", "\u0412\u044B \u043D\u0435 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u044D\u0442\u043E\u0433\u043E \u0438\u0441\u043F\u044B\u0442\u0430\u043D\u0438\u044F");
    const u = getUser(db2, userId);
    if (u.plot_id !== tr.scope_id) fail(403, "NOT_PARTICIPANT", "\u0412\u044B \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u0436\u0438\u0432\u0451\u0442\u0435 \u043D\u0430 \u044D\u0442\u043E\u043C \u0443\u0447\u0430\u0441\u0442\u043A\u0435");
    if (action === "contribute") {
      const a = Number(amount);
      if (!Number.isInteger(a) || a < 1 || a > GAME.fund.maxDonation) fail(400, "BAD_AMOUNT", "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0446\u0435\u043B\u0443\u044E \u0441\u0443\u043C\u043C\u0443 \u043E\u0442 1 CR");
      transfer(db2, { from: userAcc(userId), to: plotAcc(tr.scope_id), amount: a, kind: "TRIAL_CONTRIBUTION", memo: tr.title, ref: `trial:${tr.id}` });
      db2.prepare("INSERT INTO trial_actions (trial_id, user_id, action, amount, at) VALUES (?, ?, ?, ?, ?)").run(tr.id, userId, "contribute", a, now());
    } else {
      if (db2.prepare("SELECT 1 FROM trial_actions WHERE trial_id = ? AND user_id = ? AND action = 'refuse'").get(tr.id, userId))
        fail(409, "ALREADY_REFUSED", "\u041E\u0442\u043A\u0430\u0437 \u0443\u0436\u0435 \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D");
      db2.prepare("INSERT INTO trial_actions (trial_id, user_id, action, amount, at) VALUES (?, ?, ?, 0, ?)").run(tr.id, userId, "refuse", now());
    }
    afterCommit(() => toPlot(tr.scope_id, "trial", { id: tr.id }));
    return tr;
  });
  completeQuest(db2, userId, "first_trial");
  return present(db2, db2.prepare("SELECT * FROM trials WHERE id = ?").get(out.id), userId);
}

// server/services/auth.ts
var USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(pw, stored) {
  const [, saltHex, hashHex] = stored.split("$");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}
var tokenHash = (t) => createHash("sha256").update(t).digest("hex");
function createSession(db2, userId) {
  const token = randomBytes(32).toString("base64url");
  db2.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash(token),
    userId,
    now() + SERVER.sessionDays * 864e5
  );
  return token;
}
function userFromToken(db2, token) {
  if (!token) return null;
  const row = db2.prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?").get(tokenHash(token));
  if (!row || row.expires_at < now()) return null;
  return row.user_id;
}
function destroySession(db2, token) {
  if (token) db2.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}
function validateCredentials(username, password) {
  if (typeof username !== "string" || !USERNAME_RE.test(username))
    fail(400, "BAD_USERNAME", "\u0418\u043C\u044F: 3\u201320 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432, \u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 _");
  if (typeof password !== "string" || password.length < 8 || password.length > 128)
    fail(400, "BAD_PASSWORD", "\u041F\u0430\u0440\u043E\u043B\u044C: \u043E\u0442 8 \u0434\u043E 128 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432");
  return { username, password };
}
function register(db2, rawUsername, rawPassword) {
  const { username, password } = validateCredentials(rawUsername, rawPassword);
  const passHash = hashPassword(password);
  return tx(db2, () => {
    if (db2.prepare("SELECT 1 FROM users WHERE username = ?").get(username)) fail(409, "USERNAME_TAKEN", "\u042D\u0442\u043E \u0438\u043C\u044F \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442\u043E");
    let subjectNo = 0;
    for (let i = 0; i < 50 && !subjectNo; i++) {
      const n = randomInt(1, 1e6);
      if (!db2.prepare("SELECT 1 FROM users WHERE subject_no = ?").get(n)) subjectNo = n;
    }
    if (!subjectNo) fail(503, "NO_SUBJECT_NO", "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u0434\u0430\u0442\u044C \u043D\u043E\u043C\u0435\u0440 \u0438\u0441\u043F\u044B\u0442\u0443\u0435\u043C\u043E\u0433\u043E");
    const district = chooseDistrict(db2);
    const { plotId, slot } = choosePlot(db2, district.id);
    const t = now();
    const u = db2.prepare(
      `INSERT INTO users (username, pass_hash, subject_no, created_at, last_active_at, cr, ap, ap_day, plot_id, resident_since)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
    ).run(username, passHash, subjectNo, t, t, GAME.dailyAP, gameDay(t), plotId, t);
    const userId = Number(u.lastInsertRowid);
    const h = db2.prepare("INSERT INTO homes (plot_id, slot, type, owner_id, created_at) VALUES (?, ?, ?, ?, ?)").run(plotId, slot, "capsule", userId, t);
    const homeId = Number(h.lastInsertRowid);
    db2.prepare("UPDATE users SET home_id = ? WHERE id = ?").run(homeId, userId);
    db2.prepare("INSERT INTO home_log (home_id, user_id, kind, detail, at) VALUES (?, ?, ?, ?, ?)").run(
      homeId,
      userId,
      "assigned",
      "\u0421\u0438\u0441\u0442\u0435\u043C\u043E\u0439 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0430 \u0436\u0438\u043B\u0430\u044F \u043A\u0430\u043F\u0441\u0443\u043B\u0430",
      t
    );
    joinActiveTrials(db2, plotId, userId);
    transfer(db2, { from: EMISSION, to: userAcc(userId), amount: GAME.startCR, kind: "START_GRANT", memo: "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u043E\u0435 \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u044B\u0442\u0443\u0435\u043C\u043E\u0433\u043E" });
    notify(db2, userId, "mail", "\u0414\u041E\u0411\u0420\u041E \u041F\u041E\u0416\u0410\u041B\u041E\u0412\u0410\u0422\u042C", `\u0418\u0441\u043F\u044B\u0442\u0443\u0435\u043C\u044B\u0439 \u2116${String(subjectNo).padStart(6, "0")}. \u0412\u0430\u0448\u0435 \u043C\u0435\u0441\u0442\u043E \u0436\u0438\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E: ${plotId}. \u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0435\u0440\u0432\u043E\u043D\u0430\u0447\u0430\u043B\u044C\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435\u043B\u044C\u0437\u044F.`);
    return { userId, token: createSession(db2, userId) };
  });
}
function login(db2, rawUsername, rawPassword) {
  const { username, password } = validateCredentials(rawUsername, rawPassword);
  const row = db2.prepare("SELECT id, pass_hash FROM users WHERE username = ?").get(username);
  if (!row || !verifyPassword(password, row.pass_hash)) fail(401, "BAD_CREDENTIALS", "\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0438\u043C\u044F \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C");
  return { userId: row.id, token: createSession(db2, row.id) };
}

// server/main.ts
var root = dirname2(dirname2(fileURLToPath(import.meta.url)));
var publicDir = join2(root, "public");
var db = openDb(SERVER.dbPath);
var COOKIE = "exp_session";
var sessionCookie = (token, maxAgeSec) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${SERVER.secureCookies ? "; Secure" : ""}`;
var r = new Router();
r.post("/api/auth/register", (c) => {
  rateLimit(`reg:${c.ip}`, SERVER.registerPerMinute, 6e4);
  const { userId, token } = register(db, c.body.username, c.body.password);
  c.res.setHeader("Set-Cookie", sessionCookie(token, SERVER.sessionDays * 86400));
  return me(db, userId);
}, false);
r.post("/api/auth/login", (c) => {
  rateLimit(`login:${c.ip}`, 20, 6e4);
  const { userId, token } = login(db, c.body.username, c.body.password);
  c.res.setHeader("Set-Cookie", sessionCookie(token, SERVER.sessionDays * 86400));
  return me(db, userId);
}, false);
r.post("/api/auth/logout", (c) => {
  destroySession(db, parseCookies(c.req.headers.cookie)[COOKIE]);
  c.res.setHeader("Set-Cookie", sessionCookie("", 0));
  return { ok: true };
}, false);
r.get("/api/health", () => ({ ok: true, time: Date.now() }), false);
var uid = (c) => c.userId;
r.get("/api/me", (c) => me(db, uid(c)));
r.get("/api/home", (c) => home(db, uid(c)));
r.post("/api/home/upgrade", (c) => buyUpgrade(db, uid(c), c.body.key));
r.get("/api/work", (c) => workInfo(db, uid(c)));
r.post("/api/work", (c) => doWork(db, uid(c), c.body.kind));
r.get("/api/economy", (c) => economy(db, uid(c)));
r.get("/api/neighbors", (c) => neighbors(db, uid(c)));
r.get("/api/plot/metrics", (c) => plotMetrics(db, getUser(db, uid(c)).plot_id));
r.get("/api/plot/fund", (c) => fund(db, uid(c)));
r.post("/api/plot/fund/donate", (c) => donate(db, uid(c), c.body.amount));
r.get("/api/chat/plot", (c) => chatHistory(db, uid(c), Number(c.url.searchParams.get("before")) || void 0));
r.post("/api/chat/plot", (c) => {
  rateLimit(`chat:${uid(c)}`, 20, 6e4);
  return postChat(db, uid(c), c.body.body);
});
r.get("/api/map/plot", (c) => mapPlot(db, uid(c)));
r.get("/api/map/district", (c) => mapDistrict(db, uid(c)));
r.get("/api/map/world", (c) => mapWorld(db, uid(c)));
r.get("/api/trials", (c) => listTrials(db, uid(c)));
r.post("/api/trials/:id/act", (c) => act(db, uid(c), Number(c.params.id), c.body.action, c.body.amount));
r.get("/api/notifications", (c) => notifications(db, uid(c)));
r.post("/api/notifications/read", (c) => markRead(db, uid(c)));
var server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const fwd = SERVER.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim() : "";
  const ip = (fwd || req.socket.remoteAddress || "unknown").replace("::ffff:", "");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    if (!url.pathname.startsWith("/api/")) {
      if (req.method === "GET" && await serveStatic(publicDir, url.pathname, res)) return;
      if (req.method === "GET" && await serveStatic(publicDir, "/index.html", res)) return;
      return sendJson(res, 404, { error: "NOT_FOUND" });
    }
    const token = parseCookies(req.headers.cookie)[COOKIE];
    const userId = userFromToken(db, token);
    if (url.pathname === "/api/stream" && req.method === "GET") {
      if (!userId) fail(401, "UNAUTHORIZED", "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0432\u0445\u043E\u0434");
      const u = getUser(db, userId);
      subscribe(res, userId, u.plot_id);
      return;
    }
    const m = r.match(req.method ?? "GET", url.pathname);
    if (!m) fail(404, "NOT_FOUND", "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441 API");
    const { route, params } = m;
    if (req.method !== "GET") {
      if (!String(req.headers["content-type"] ?? "").includes("application/json") || req.headers["x-experiment"] !== "1")
        fail(400, "BAD_REQUEST", "\u0417\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D \u0441\u0438\u0441\u0442\u0435\u043C\u043E\u0439");
    }
    if (route.auth && !userId) fail(401, "UNAUTHORIZED", "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0432\u0445\u043E\u0434");
    if (userId) {
      rateLimit(`api:${userId}`, 240, 6e4);
      touch(db, userId);
    } else {
      rateLimit(`anon:${ip}`, SERVER.anonPerMinute, 6e4);
    }
    const body = await readBody(req);
    const ctx = { req, res, url, params, body: body ?? {}, ip, userId };
    const data = await route.handler(ctx);
    sendJson(res, 200, data);
  } catch (e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.code, message: e.message });
    console.error(e);
    sendJson(res, 500, { error: "INTERNAL", message: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u0441\u0438\u0441\u0442\u0435\u043C\u044B" });
  }
});
var timer = setInterval(() => schedulerTick(db), SERVER.schedulerIntervalMs);
schedulerTick(db);
server.listen(SERVER.port, "0.0.0.0", () => {
  console.log(`THE EXPERIMENT :: \u0441\u0435\u0440\u0432\u0435\u0440 \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u043D\u0430 http://localhost:${SERVER.port}`);
});
var shutdown = () => {
  clearInterval(timer);
  server.close();
  server.closeAllConnections();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
