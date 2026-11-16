# IRONHOLD — build milestones

Bounty: make.fun threejs-fps-02, deadline 2026-11-17 04:30 WIB (21:30 UTC).
Target: complete verified entry by 02:30 WIB.

## M1 — structure, vendored three.js, entry program
- [x] Repo skeleton: main.ts, LICENSE (starter's MIT), vendor/makefun-threejs.ts,
      game/vendor/three/, screenshots/, .makefun/owner.json (agent wallet).
- [x] Vendored bytes verified by sha256 against the kit's copies:
      three.module.min.js ef510bae547ab3789d…, three.core.min.js 613e370f76638fde…,
      vendor/makefun-threejs.ts f9622210e6a0aed7… — all identical to the kit.
- [x] serve.ts for local play.
- [x] First rendered scene in headless Chromium (playtests, M2 onward).
- [x] Transcript bundle dry-run (command below) — result recorded here.

Bundle dry-run (from ~/workspace/makefun/threejs-fps-02-kit):
  node cli/makefun.mjs bundle --repo ~/workspace/makefun/ironhold-tactical-fps \
    --out /tmp/bundle-test.tar.gz --dry-run
Result (2026-11-16 ~21:27 WIB): IT DISCOVERS MUSE SESSIONS. 2 session files found,
both muse-app, "recording no directory and naming it in their tool calls":
the top-level session 4af42b0d… and this build subagent's session 890e59a5…,
each cut to this repository's work. 1 instruction file collected (AGENTS.md).
Redactions applied automatically (1 email, 8 home paths, 3 usernames).
Notes for the real bundle at submission time (parent's step, not a blocker):
  * attach Muse usage rows: export from muse.db and pass --muse-usage <file>
    (dry-run warns 0 usage rows attached so far; rows are written as messages
    are delivered, and a subagent's row lands when its run completes);
  * declare agent facts: --harness, --harness-version, --provider, --model,
    --effort, and the MCP servers used (--mcp … or --mcp none);
  * repo had uncommitted changes during the dry run (repo.dirty) — commit first.

## M2 — playable core
- [x] Fixed-step simulation (60 Hz) apart from rendering; state in one place.
- [x] Player: pointer lock, WASD, sprint, crouch, jump, AABB collision.
- [x] Weapons: hitscan, spread/recoil model, reload, slots, grenades.
- [x] Bots: waypoint graph, perception, states, plant/defuse.
- [x] Rounds and economy: buy phase, rewards, first to 7, winner screen.
- [x] HUD: health, armor, ammo, money, timer, scores, killfeed, buy menu.
      Live playtest (headless Chromium): boots with zero console errors,
      deploy starts the match, BUY to LIVE transition ticks, bots spread
      and converge on lanes, rounds play through.

## Defects found in progress review (Karina) and fixed
- [x] Black void behind the title menu: root cause was `G.feed` never being
      initialised in state.js — hud.updateHud() threw on the killfeed line
      every frame, before renderer.render() ran, so the canvas never drew.
      Fixed by initialising feed, playerHitmark, playerHurt, phaseT and the
      staging hooks in the G literal, plus per-round deathProcessed, channel
      and killedBy resets in resetRound.
- [x] Timer reading NaN:NaN in the menu state: G.phaseT was unset before the
      first startRound, and sim/hud read MATCH keys that do not exist
      (roundTime, fuseTime, buyTime, endTime, defuseKitTime, winElim,
      lossCap, plantPlanter). All references aligned to config.js keys
      (roundSeconds, chargeSeconds, buySeconds, endSeconds,
      winElimination, lossMax, plant). The title screen now stages a live
      match behind the briefing, so the HUD shows real round state.
- [x] Menu backdrop is now the composed opening view itself: a staged match
      at the GARUDA spawn with a slow camera drift behind the briefing panel.
- [x] Buy menu keys dead (found in live playtest): main.js cleared
      input.pressed before updateHud() ran, and the buy keys (B, digits)
      are read inside updateHud, so they always saw an empty set. Slot
      keys worked because the sim reads them earlier. Fix: pressed is now
      cleared at the end of the frame, after every consumer. Verified live:
      B opens the menu, Digit9 buys the Steel Vest ($800 to $150, armor 1),
      an unaffordable Digit6 is rejected, zero console errors.
- [x] Planted and dropped charge device invisible: fx.js positioned the
      charge meshes from plantPos.y / droppedAt.y, but the sim stores
      only {x, z}, so the position went NaN. Fixed to sit on the pad (y 0).

## Directives applied (Arya, 2026-11-16 evening)
- [x] LANGUAGE: the whole game is in ENGLISH — HUD labels, briefing, buy
      menu, banners, scoreboard, controls, and all painted signage and
      posters in the world textures. Weapon and gear display names are
      English codenames (P1 Kestrel, AR-7 Falcon, LR-8 Osprey, Frag
      Grenade, Defusal Kit, and so on). Internal code ids are unchanged.
- [x] UI REDESIGN: military tactical interface — condensed letterspaced
      headings, monospace data readouts, angular clip-path panels with thin
      sand borders and scanline grain, hazard-stripe accents, olive drab,
      gunmetal, sand and signal orange, unit insignia blocks for both
      teams, and a command-briefing title screen (objective, opposition,
      victory, theater spec rows) over the live 3D scene. HUD numbers stay
      large and legible.

## M3 — polish and screenshots
- [x] Procedural textures on every surface; dusk lighting; dust; tracers.
- [x] Synthesized WebAudio sound set.
- [x] 4 screenshots at spec (≤256 KiB, 1280×720) via ?shot= modes,
      re-shot after the realism pass: 1-cover.jpg 99,158 B, 2-buy.jpg
      123,225 B, 3-action.jpg 104,388 B, 4-plant.jpg 125,351 B.
- [x] OPENING FRAME (Arya's hard requirement): the first view at round start —
      GARUDA spawn, first-person, viewmodel in hand, full live HUD — is composed
      deliberately: spawn facing picked so the frame holds the crane and site
      pad in the foreground, containers and a teammate midground, catwalk,
      warehouse signage and the dusk sun behind; foreground, midground and
      background all dressed, no void, no flat or unfinished area in frame.
      The cover screenshot (first file by name) IS that opening view, checked
      pixel by pixel before it ships. Evidence: screenshots/1-cover.jpg.

## Realism and design pass (Arya's verdict: still flat and boxy)
Before: containers were smooth boxes with painted lettering; barrels and
crates were plain boxes and cylinders; characters read as toy figurines
with bare skin arms; the rifle viewmodel was stacked blocks; the site pad
was one flat slab; UI panels were clean web boxes.
After:
- World geometry: containers gained instanced corrugation ribs, corner
  posts, top rails, door frames with locking rods and handles (the truck
  cargo too; the truck gained torus wheels and a glass windshield);
  barrels are groups with rim rings and lids; crates have edge battens;
  pallets have slats; sandbag rows are squashed spheres; a tire stack,
  cable spool, glossy oil stains and 64 instanced debris pieces dress the
  ground; the warehouse gained twin wall pipes with drops, a louvered
  vent and an AC unit; the catwalk has 42 instanced balusters with
  handrail and mid rail; container textures bake an AO gradient.
- Characters: magazine pouches, backpack, radio, helmet brim, team
  shoulder pads, knee pads; arms are uniform sleeves with dark gloved
  hands (no more bare skin); bot guns gained handguards.
- Viewmodels: rail segments, front sight post, muzzle brake, curved
  magazine, ejection port, charging handle; shotgun tube magazine; pistol
  rear sight and hammer; a warm camera fill light so the rig reads.
- Light: sun 3.05 with tighter shadow bias, warm eastern fill, ACES
  exposure 1.18; surfaces vary value within one colour family.
- UI: rivet dots baked into panel backgrounds, heavier display sizes
  (timer 34px, health 39px, ammo 37px, banner 48px), hazard rule under
  the wordmark, and a sector schematic block in the briefing (warehouse,
  catwalk, site, power core target, dashed approach routes).
Known remaining weaknesses, stated honestly: characters are still
stylised low-poly (better proportioned and geared, not realistic);
viewmodel hands are boxy gloves; the cover's rifle reads dark against
the dusk; warehouse posters tile a set of four designs.

## M4 — verification
- [x] node main.ts run twice, identical dossier bytes (771,320 B).
- [x] Gate self-check against every RULES.txt row (listed below).
- [x] Bundle dry-run final result: same as M1 (discovers both Muse
      sessions); the real bundle is a submission-time step for the parent,
      gated on Arya's review. Nothing pushed, nothing submitted.

## Gate self-check (RULES.txt)
- game_files: PASS — 18 entries, 2.2 MiB (caps 993 entries, 48 MiB);
  static ES modules, no build step, no network, all references relative
  or import-mapped; index.html 17.4 KB with exactly one import map.
- three_js: PASS — three.module.min.js sha256 ef510bae…, three.core.min.js
  613e370f…, byte-identical to the kit (three.js 0.187.0);
  vendor/makefun-threejs.ts f9622210…, byte-identical to the kit.
- references: PASS — the only import-map target is
  ./vendor/three/three.module.min.js; all module imports are relative
  ./ paths inside game/.
- screenshots: PASS — 4 JPEGs, 1280×720 each, 99 to 125 KiB (caps:
  256 KiB, long side 1280, short side at least 480); real unedited
  browser renders via ?shot= staging; 1-cover.jpg is the cover.
- dossier_matches: PASS — MAKEFUN_OUTPUT_DIR runs produce byte-identical
  dossier.json (771,320 B, under the 1.5 MiB cap); cover index 0;
  walked source 162,483 B of the 163,840 B cap with ZERO truncation
  (the dossier text ends at hud.js's real last line).
- js_parses: PASS — all 15 source files (index.html module + 14 JS
  modules) parse as ES modules; live boot with zero console errors.
