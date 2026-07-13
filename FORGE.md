# 🎮⛓️ Gamestr, decentralized — forged · mirrored · marked

How Gamestr goes from a self-hosted tracker to a **real-time, mirrored,
Bitcoin-anchored** app with **no GitHub, no central CI, and no single point of
failure** — running entirely on your own box, publishing outward.

This is a case study of the [JSS `forge` plugin](https://github.com/JavaScriptSolidServer)
pattern applied to Gamestr's hourly data. Everything below is host-agnostic —
substitute your own forge, relay, and mirrors.

## The idea

Gamestr already has an hourly heartbeat: every hour is a tiny JSON file, updated
live as you log time. That cadence *is* the anchoring cadence. So we run Gamestr
through three tiers of permanence — the same three git already has, made
explicit:

| Tier | What it is for Gamestr | Cost | Where it lives |
|---|---|---|---|
| ⌨️ **unstaged** | the hour *in progress* — updating live as you bump | free, real-time | an ephemeral Nostr event (relays don't store it) |
| ✓ **committed** | each hour written & committed to a forge | a git commit | git, fanned out over Nostr to mirrors |
| ⛓️ **marked** | a periodic checkpoint anchored on Bitcoin | one tx / period | a Blocktrails mark chain (single-writer) |

## The pipeline

```
you bump a value
   │
   ▼  (live)  ephemeral event on a relay you control
mirrors re-render in real-time  ⌨️        ← no commit, no mark, no cost
   │
   ▼  (periodic sync)  commit the accumulated hours to the forge
mirrors pull & redeploy over Nostr  ✓     ← git, verifiable, fanned out
   │
   ▼  (per period)  advance the mark chain by one Bitcoin tx
the checkpoint is settled  ⛓️              ← the sync becomes the super-commit
```

Every node — origin and mirrors — can prove the whole chain from Bitcoin alone.

## The two channels

The trick to being both *fresh* and *cheap* is running two channels over the
same repo:

1. **Ephemeral (real-time).** On every bump, an ephemeral event carries the new
   hour value to subscribers, who render it instantly. Nothing is committed or
   anchored. A slow heartbeat re-emit lets a freshly-loaded page catch up
   (ephemeral events aren't stored by relays). The change is sourced from the
   app's **own push stream** — event-driven, not a filesystem poll.
2. **Super-commit (durable + anchored).** A periodic *sync* commits the hours;
   with **sparse marking** those commits collapse into a single re-targeted
   pending mark, so anchoring is **one Bitcoin tx per period** no matter how many
   bumps happened. *The sync becomes the next super-commit.*

## Properties you get for free

- **No GitHub.** The repo lives on your forge (and any number of mirrors).
- **No central CI.** A verified Nostr event triggers each mirror's pull + deploy.
- **Mirror-verifiable.** Each mirror ships a `marks.json` snapshot in the repo,
  so it proves the mark chain straight from Bitcoin — no reach back to origin.
- **Kill-test resilient.** Drop any host; the others still serve the app *and*
  the on-chain proof.
- **Real-time everywhere.** Mirror apps subscribe to the same ephemeral channel
  and re-render live — latency is just one hop through a relay you control.

## One hard-won lesson

Real-time latency is the **relay you choose**, not the design. Route the live
channel through a relay you control and co-locate with consumers — a shared
public relay can add unpredictable seconds; a local one is sub-second. And
**measure each hop** (stream → emit → each relay → render) before tuning
anything: the slow link is almost always the public relay, not your code.

## Reproducing it

You need: the JSS `forge` plugin (hosting + Bitcoin marks + NIP-34 emission), a
Nostr relay you control, a [`nostr-git-sync`](https://github.com/) subscriber per
mirror, and two tiny helpers — one that commits the hours periodically (the
super-commit), and one that streams the live hour as ephemeral events. Enable
`config.sparseMarks` so the periodic anchor stays one tx. See the forge plugin's
`AGENT.md` (*"Live data on a cheaply-anchored mesh"*) for the full pattern.
