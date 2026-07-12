#!/usr/bin/env node
//
// serve.js — tiny web server for the gamestr hours page.
//
// Serves this directory's static files, plus the hour data:
//   GET /hour/<YYYYMMDDHH>.json  ->  ~/.nosdav/data/gamestr/hour/<YYYYMMDDHH>.json
//
// Standalone fallback — normally the page is served by jspod from
// ~/pod-data/public/gamestr/ which also provides websocket notifications.
//
// Usage: node serve.js [port]   (default 8787, binds 127.0.0.1)

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, extname, normalize } from 'node:path'

const HOUR_DIR = join(homedir(), '.nosdav', 'data', 'gamestr', 'hour')
const ROOT = new URL('.', import.meta.url).pathname
const PORT = parseInt(process.argv[2], 10) || 8787

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  const path = normalize(url.pathname)
  try {
    const hourMatch = path.match(/^\/hour\/(\d{10})\.json$/)
    if (hourMatch) {
      const body = await readFile(join(HOUR_DIR, hourMatch[1] + '.json'))
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*',
      })
      return res.end(body)
    }
    const file = path === '/' ? '/index.html' : path
    if (file.includes('..')) throw new Error('bad path')
    const data = await readFile(join(ROOT, file))
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`gamestr hours: http://127.0.0.1:${PORT}/`)
})
