<p align="center">
  <img src="src/app/icon.svg" alt="Card Club logo" width="96" height="96" />
</p>

<h1 align="center">Card Club</h1>

<p align="center">Poker (Texas Hold'em), Rummy (13-card Indian Rummy) and UNO in the browser, on phones and laptops.</p>

- **Play with friends:** create a room, share the 5-letter code, link or QR code. Friends only type a name.
- **Computer players fill empty seats.** Set the table to 5 seats, and if 3 friends join, 2 computer players sit in when you start.
- **Play vs computer:** runs fully in the browser, starts instantly and needs no server setup.
- No accounts, no real money.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rules unit checks + full bot-vs-bot simulations of every game
```

Locally, rooms are kept in memory, so online rooms work across browser tabs on your machine with no setup.

## How it works

- `src/games/*`: each game is a pure, deterministic state machine (`init / act / view / botAct / timeoutActs …`). `view()` decides what each player may see, so other players' cards never leave the server.
- `src/lib/room.ts`: lobby, seats, bots, turn timers, auto-advance between hands, chat and reactions. Pure functions shared by the server and the offline mode.
- `src/app/api/rooms/*`: a server-authoritative API. Clients poll; bot moves and timeouts run during those requests, under a Redis lock.
- `useLocalRoom` runs the same room logic in the browser for vs-computer games, saved in `localStorage` so a refresh resumes the game.

## Rules implemented

**Poker:** No-limit Hold'em with 2–8 players: blinds (heads-up rules included), minimum-raise rules, short all-ins that don't reopen betting, side pots, split pots with odd-chip rule, all-in run-outs, and optional blind increases. Players bust out, and the last player with chips wins.

**Rummy:** 13 cards, 2–6 players (1 deck + 1 joker for 2 players, 2 decks + 2 jokers for 3–6), cut wild joker plus printed jokers. To declare you need 2+ sequences including a pure one. Scoring: face values, A/K/Q/J = 10, capped at 80. Drops cost 20/40 (25/50 in Pool 201), a wrong declaration costs 80, and discarded jokers can't be picked up. Formats: Points, Deals (best of 3), Pool 101 and Pool 201.

**UNO:** official 108-card deck. Wild +4 is only allowed when you have no card of the current color. You may play a drawn card if it matches. Reverse acts as Skip with 2 players. Calling UNO and catching a missed call costs +2. Scoring is official (to 200/500, or a single round), with optional +2/+4 stacking as a house rule.

## Details included

- Turn timers (off / 20s / 30s / 60s) with auto-play on timeout. A player who disconnects is auto-played after 25s, and a player who leaves mid-game is replaced by a computer player.
- Host controls: change game and settings, add or remove seats, remove players, start a new game after the current one. If the host leaves, hosting passes to another player.
- Reconnection: refreshing or closing the tab keeps your seat.
- Chat, emoji reactions, game log, rules for each game in-game, and sound effects with a mute toggle.
- Haptic feedback on phones and a "● Your turn" tab title.
- Poker: pre-actions (Check/Fold, Call any), raise presets (½ pot, pot …), and keyboard shortcuts (F / C / R / Enter).
- Rummy: tap-to-select grouping, drag & drop on desktop, live meld labels and points, and an auto-arranged deal result for every player.
- Installable as a home-screen app, with a share-preview image for invite links, and support for reduced-motion settings.
