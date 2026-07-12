//
// gamestr plugin for JSS (jss >= 0.0.219)
//
// Mount:  jspod --plugin /path/to/gamestr/plugin.js@/gamestr
//
// Routes (under the mount prefix, e.g. /gamestr):
//   GET  <prefix>/day/<YYYYMMDD>.json   one-shot aggregation of the 24 hour
//                                       files: { day, hours: [{hour, cats}] }
//   POST <prefix>/bump                  { category, points, stamp? } — atomic
//                                       read-modify-write of the hour file.
//                                       Auth: NIP-98 (api.auth.getAgent);
//                                       agent must hold acl:Write in the
//                                       gamestr container's .acl.
//   WS   <prefix>/stream                pushes { type:'update', day, stamp,
//                                       cats } after every bump.
//
// Storage stays plain hour files under <root>/public/gamestr/hour/ — the
// hours CLI, WAC-served GETs, and the pre-plugin dashboard keep working.
// A second copy goes to ~/.nosdav/data/gamestr/<day>/<stamp>.json to match
// addhour.js's historical layout.
//

import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

const STAMP_RE = /^\d{10}$/
const CATEGORY_RE = /^[a-z0-9_-]{1,32}$/
const MAX_POINTS = 1_000_000

function currentStamp() {
  const now = new Date()
  return now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0') +
    String(now.getUTCHours()).padStart(2, '0')
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

export async function activate(api) {
  const { fastify, prefix, config, log } = api

  // The pod data root is pluginDir's grandparent (<root>/.plugins/<id>).
  const root = config.root || path.resolve(api.storage.pluginDir(), '..', '..')
  const hourDir = config.hourDir || path.join(root, 'public', 'gamestr', 'hour')
  const aclFile = path.join(path.dirname(hourDir), '.acl')
  // Legacy second copy written by addhour.js since forever.
  const dayCopyBase = config.dayCopyBase ||
    path.join(os.homedir(), '.nosdav', 'data', 'gamestr')

  // Writers = did:nostr agents holding acl:Write in the container's .acl —
  // same source of truth the LDP PUT path uses, so revocation stays one file.
  // Re-read per request: it's one tiny local file and bumps are infrequent.
  async function allowedWriters() {
    const acl = await readJson(aclFile, null)
    const dids = new Set(config.writers || [])
    for (const node of acl?.['@graph'] || []) {
      const modes = [].concat(node['acl:mode'] || []).map((m) => m['@id'] || m)
      if (!modes.includes('acl:Write')) continue
      for (const a of [].concat(node['acl:agent'] || [])) {
        const id = a['@id'] || a
        if (typeof id === 'string' && id.startsWith('did:nostr:')) dids.add(id)
      }
    }
    return dids
  }

  async function loadDay(day) {
    const hours = []
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0')
      const cats = await readJson(path.join(hourDir, day + hh + '.json'), {})
      hours.push({ hour: h, cats: cats && typeof cats === 'object' ? cats : {} })
    }
    return hours
  }

  // --- stream ---------------------------------------------------------------
  const sockets = new Set()
  const broadcast = (msg) => {
    const data = JSON.stringify(msg)
    for (const s of sockets) {
      if (s.readyState === 1) { try { s.send(data) } catch { /* closing */ } }
    }
  }
  await api.ws.route(prefix + '/stream', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.send(JSON.stringify({ type: 'hello', day: currentStamp().slice(0, 8) }))
  })

  // --- day aggregation --------------------------------------------------------
  fastify.get(prefix + '/day/:day.json', async (req, reply) => {
    const day = req.params.day
    if (!/^\d{8}$/.test(day)) return reply.code(400).send({ error: 'bad day' })
    reply.header('cache-control', 'no-store')
    reply.header('access-control-allow-origin', '*')
    return { day, hours: await loadDay(day) }
  })

  // --- bump -------------------------------------------------------------------
  // Serialize writes so concurrent bumps can't lose updates.
  let queue = Promise.resolve()

  fastify.post(prefix + '/bump', async (req, reply) => {
    const agent = await api.auth.getAgent(req)
    if (!agent) return reply.code(401).send({ error: 'unauthorized' })
    if (!(await allowedWriters()).has(agent)) {
      return reply.code(403).send({ error: 'forbidden', agent })
    }

    const { category, points, stamp: rawStamp } = req.body || {}
    const stamp = rawStamp === undefined ? currentStamp() : String(rawStamp)
    const increment = Number(points)
    if (typeof category !== 'string' || !CATEGORY_RE.test(category)) {
      return reply.code(400).send({ error: 'bad category' })
    }
    if (!Number.isInteger(increment) || Math.abs(increment) > MAX_POINTS) {
      return reply.code(400).send({ error: 'bad points' })
    }
    if (!STAMP_RE.test(stamp)) return reply.code(400).send({ error: 'bad stamp' })

    const result = queue = queue.then(async () => {
      const file = path.join(hourDir, stamp + '.json')
      const cats = await readJson(file, {})
      cats[category] = (parseInt(cats[category], 10) || 0) + increment
      const body = JSON.stringify(cats, null, 2)
      await fs.mkdir(hourDir, { recursive: true })
      await fs.writeFile(file, body, 'utf8')
      // legacy day-dir copy (best effort — never fails the bump)
      try {
        const dayDir = path.join(dayCopyBase, stamp.slice(0, 8))
        await fs.mkdir(dayDir, { recursive: true })
        await fs.writeFile(path.join(dayDir, stamp + '.json'), body, 'utf8')
      } catch (err) {
        log.warn(`gamestr: day copy failed: ${err.message}`)
      }
      return cats
    })
    const cats = await result
    broadcast({ type: 'update', day: stamp.slice(0, 8), stamp, cats })
    return { ok: true, stamp, cats }
  })

  log.info(`gamestr plugin: hour dir ${hourDir}`)
  return {
    deactivate() {
      for (const s of sockets) { try { s.close() } catch { /* already gone */ } }
      sockets.clear()
    },
  }
}
