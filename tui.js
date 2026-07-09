#!/usr/bin/env node
//
// gamestr-tui — a terminal dashboard for gamestr.
//
// Mirrors the web dashboard (index.html): subscribes to the same Nostr relay
// for kind 33334 events from a pubkey, whose `content` is JSON of running point
// totals per category, e.g. {"work":13000,"chores":210000}. Renders one live
// progress bar per category and plays a chime when a category levels up.
//
// Zero dependencies — uses Node's built-in global WebSocket (Node >= 22).
//
// Usage:
//   node tui.js [--relay <wss-url>] [--pubkey <hex>] [--sound <file>] [--no-sound]
//
// Keys:  q / Ctrl-C quit   ·   m mute   ·   r redraw

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

// --- config (CLI > env > defaults), kept in sync with index.html ----------
const DEFAULTS = {
  relay: 'wss://nostr.rocks:4444/',
  pubkey: '64401c0577261886bff71b49f22fb35225268f27313fb5af7d5eda7934574746',
  kind: 33334,
  sound: join(HERE, 'audio', 'Confirmation.ogg'),
}
const LEVELS = [
  0, 5000, 11000, 19000, 29000, 43000, 60000, 78000, 98000,
  120000, 140000, 160000, 180000, 200000,
]

function parseArgs(argv) {
  const cfg = { ...DEFAULTS, sound: process.env.GAMESTR_SOUND || DEFAULTS.sound, muted: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--relay') cfg.relay = argv[++i]
    else if (a === '--pubkey') cfg.pubkey = argv[++i]
    else if (a === '--sound') cfg.sound = argv[++i]
    else if (a === '--no-sound') cfg.muted = true
    else if (a === '--demo') cfg.demo = true
    else if (a === '-h' || a === '--help') { printHelp(); process.exit(0) }
  }
  return cfg
}
function printHelp() {
  process.stdout.write(
    'gamestr-tui — terminal dashboard for gamestr\n\n' +
    'Usage: node tui.js [options]\n\n' +
    '  --relay <wss-url>   Nostr relay (default ' + DEFAULTS.relay + ')\n' +
    '  --pubkey <hex>      Author pubkey to track\n' +
    '  --sound <file>      Level-up sound file (default audio/Confirmation.ogg)\n' +
    '  --no-sound          Start muted\n' +
    '  --demo              Offline demo: scripted events that cross a level\n' +
    '  -h, --help          This help\n\n' +
    'Keys: q/Ctrl-C quit · m mute · r redraw\n'
  )
}

// --- ansi helpers ----------------------------------------------------------
const ESC = '\x1b['
const A = {
  clear: ESC + '2J' + ESC + 'H',
  home: ESC + 'H',
  hideCursor: ESC + '?25l',
  showCursor: ESC + '?25h',
  reset: ESC + '0m',
  bold: ESC + '1m',
  dim: ESC + '2m',
  clearLine: ESC + '2K',
}
const fg = (n) => ESC + '38;5;' + n + 'm'
// stable color per category name
const PALETTE = [208, 220, 39, 47, 201, 51, 198, 154, 105, 214, 45, 213]
function colorFor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const fmt = (n) => n.toLocaleString('en-US')

function levelOf(points) {
  for (let i = LEVELS.length - 1; i >= 0; i--) if (points >= LEVELS[i]) return i + 1
  return 1
}

// --- sound -----------------------------------------------------------------
function playSound(cfg) {
  if (cfg.muted || !cfg.sound || !existsSync(cfg.sound)) return
  const isMp3 = /\.mp3$/i.test(cfg.sound)
  // pw-play handles ogg/wav cleanly; mp3 needs ffplay
  const [cmd, args] = isMp3
    ? ['ffplay', ['-autoexit', '-nodisp', '-loglevel', 'quiet', cfg.sound]]
    : ['pw-play', [cfg.sound]]
  try {
    const env = { ...process.env }
    if (!env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = '/run/user/' + process.getuid()
    const p = spawn(cmd, args, { stdio: 'ignore', env, detached: true })
    p.on('error', () => {}) // missing player: just stay silent
    p.unref()
  } catch { /* ignore */ }
}

// --- state -----------------------------------------------------------------
const cfg = parseArgs(process.argv.slice(2))
const state = {
  content: {},          // { category: totalPoints }
  levels: {},           // { category: level } — baseline for level-up detection
  status: 'connecting', // connecting | connected | reconnecting
  lastUpdate: null,
  flash: [],            // [{ msg, until }]
}

function applyEvent(content) {
  const first = Object.keys(state.levels).length === 0
  for (const key of Object.keys(content)) {
    const pts = parseInt(content[key] || 0, 10)
    const lvl = levelOf(pts)
    const prev = state.levels[key]
    // Only celebrate a genuine increase, and never on the very first snapshot
    if (!first && prev !== undefined && lvl > prev) {
      state.flash.push({ msg: `🎉 ${key} reached Level ${lvl}!`, until: Date.now() + 6000 })
      playSound(cfg)
    }
    state.levels[key] = lvl
  }
  state.content = content
  state.lastUpdate = new Date()
  render()
}

// --- render ----------------------------------------------------------------
function bar(pct, width, color) {
  const filled = Math.round((pct / 100) * width)
  return fg(color) + '█'.repeat(filled) + A.dim + '░'.repeat(width - filled) + A.reset
}

function render() {
  const cols = Math.max(40, process.stdout.columns || 80)
  const now = Date.now()
  state.flash = state.flash.filter((f) => f.until > now)

  const keys = Object.keys(state.content).sort((a, b) =>
    parseInt(state.content[b], 10) - parseInt(state.content[a], 10)
  )
  const total = keys.reduce((s, k) => s + parseInt(state.content[k] || 0, 10), 0)
  const nameW = Math.min(14, Math.max(6, ...keys.map((k) => k.length), 6))
  // budget the bar to whatever's left after the fixed columns
  const barW = Math.max(10, Math.min(40, cols - (nameW + 4 + 7 + 26)))

  const dot = state.status === 'connected' ? fg(47) + '●' : fg(208) + '●'
  const lines = []
  lines.push('')
  lines.push(
    '  ' + A.bold + '🎮 gamestr' + A.reset + A.dim + ' — live' + A.reset +
    '   ' + dot + A.reset + A.dim + ' ' + state.status + '  ' + cfg.relay + A.reset
  )
  lines.push('')

  if (keys.length === 0) {
    lines.push('  ' + A.dim + 'waiting for data…' + A.reset)
  }

  for (const key of keys) {
    const pts = parseInt(state.content[key] || 0, 10)
    const lvl = levelOf(pts)
    const color = colorFor(key)
    const maxed = lvl === LEVELS.length
    const cur = LEVELS[lvl - 1]
    const next = LEVELS[lvl]
    const pct = maxed ? 100 : Math.min(((pts - cur) / (next - cur)) * 100, 100)

    const name = (key + ' '.repeat(nameW)).slice(0, nameW)
    const lvlTag = (A.bold + fg(color) + 'Lv ' + String(lvl).padStart(2) + A.reset)
    const tail = maxed
      ? A.bold + fg(220) + ' MAX' + A.reset + '  ' + A.dim + fmt(pts) + A.reset
      : '  ' + String(Math.round(pct)).padStart(3) + '%  ' +
        fmt(pts) + A.dim + ' → ' + fmt(next) +
        ' (+' + fmt(next - pts) + ')' + A.reset

    lines.push('  ' + fg(color) + name + A.reset + ' ' + lvlTag + ' ▕' + bar(pct, barW, color) + '▏' + tail)
  }

  lines.push('')
  lines.push(
    '  ' + A.dim + 'total ' + A.reset + A.bold + fmt(total) + A.reset + A.dim + ' pts' +
    '  ·  ' + keys.length + (keys.length === 1 ? ' category' : ' categories') +
    (state.lastUpdate ? '  ·  updated ' + state.lastUpdate.toLocaleTimeString() : '') + A.reset
  )

  for (const f of state.flash) {
    lines.push('  ' + A.bold + fg(220) + f.msg + A.reset)
  }

  lines.push('')
  lines.push('  ' + A.dim + '[q] quit  [m] ' + (cfg.muted ? 'unmute' : 'mute') +
    ' (' + (cfg.muted ? 'off' : 'on') + ')  [r] redraw' + A.reset)

  // redraw: home + clear each line to avoid leftover artifacts
  let out = A.home
  const rows = process.stdout.rows || lines.length + 2
  for (let i = 0; i < lines.length; i++) out += A.clearLine + lines[i] + '\n'
  // clear any rows below previous frame
  for (let i = lines.length; i < rows - 1; i++) out += A.clearLine + '\n'
  out += A.home
  process.stdout.write(out)
}

// --- nostr connection ------------------------------------------------------
let ws = null
let reconnectTimer = null
function connect() {
  state.status = ws ? 'reconnecting' : 'connecting'
  render()
  ws = new WebSocket(cfg.relay)
  ws.onopen = () => {
    state.status = 'connected'
    ws.send(JSON.stringify(['REQ', 'gamestr-tui', { kinds: [cfg.kind], authors: [cfg.pubkey] }]))
    render()
  }
  ws.onmessage = (m) => {
    let d
    try { d = JSON.parse(m.data) } catch { return }
    if (d[0] === 'EVENT' && d[2] && typeof d[2].content === 'string') {
      try {
        const content = JSON.parse(d[2].content)
        if (content && typeof content === 'object') applyEvent(content)
      } catch { /* ignore malformed content */ }
    }
  }
  ws.onclose = () => {
    state.status = 'reconnecting'
    render()
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 2000)
  }
  ws.onerror = () => { try { ws.close() } catch {} }
}

// --- input / lifecycle -----------------------------------------------------
function shutdown() {
  process.stdout.write(A.showCursor + '\n')
  try { if (process.stdin.isTTY) process.stdin.setRawMode(false) } catch {}
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.stdout.on('resize', render)

if (process.stdin.isTTY) {
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (k) => {
    if (k === 'q' || k === '\x03') shutdown()
    else if (k === 'm') { cfg.muted = !cfg.muted; render() }
    else if (k === 'r') render()
  })
}

process.stdout.write(A.clear + A.hideCursor)
render()

if (cfg.demo) {
  // Scripted offline run: build up a few categories, then nudge "work" across
  // the Level 3 → 4 threshold (19,000) to show the level-up chime + flash.
  state.status = 'connected'
  const steps = [
    { work: 12000, chores: 64000, study: 3000 },
    { work: 15500, chores: 64000, study: 3000 },
    { work: 18200, chores: 78000, study: 3000 }, // chores 60k→78k crosses Lv7→8
    { work: 19500, chores: 78000, study: 3000 }, // work 19k crosses Lv3→4
    { work: 19500, chores: 78000, study: 5200 },
  ]
  let i = 0
  const tick = () => {
    if (i >= steps.length) return
    applyEvent(steps[i++])
    if (i < steps.length) setTimeout(tick, 1800)
  }
  tick()
} else {
  connect()
}
