# EverBot Robot Work Allocation System

EverBot is a terminal-based application for assigning Bravo, Charlie, and Delta
robots to client work. The challenge develops the allocation behaviour through
four cumulative levels: category distribution, charging-cost optimisation,
standby activation, and prioritised multi-client allocation.

## Robot catalogue

| Robot type | Working hours per day | Charging cost per day |
| ---------- | --------------------: | --------------------: |
| Bravo      |                     3 |                    $2 |
| Charlie    |                     5 |                    $3 |
| Delta      |                     8 |                    $4 |

An assigned robot contributes its full daily hours, incurs its daily charging
cost, and cannot be assigned again in the same daily allocation. An allocation
may provide more hours than requested, but never fewer.

## Required capabilities

The four levels are cumulative requirements:

1. Allocate all three robot categories when applying the category-distribution
   strategy, then minimise excess hours.
2. Produce a charging-cost-optimised alternative and compare the two strategies
   for a single client.
3. Activate cost-optimised standby robots when a request exceeds active-fleet
   capacity.
4. Accept one or more client requests, serve the highest-hour requests first,
   and prevent active robots from being reused across that daily batch.

Selection objectives and tie-breakers will remain explicit so identical inputs
produce identical results. Invalid input and infeasible strategy outcomes will
remain visible through clear terminal messages.

## Project status

The tested TypeScript project scaffold, client work-request validation, fixed
robot catalogue, immutable fleet inventory, category-distribution strategy, and
cost-optimised strategy are in place. For one client, the terminal displays both
active-only strategy outcomes, compares their charging costs when both succeed,
and automatically activates cost-optimised standby robots when the request
exceeds active capacity. The terminal also accepts an ordered batch of client
requests, serves the highest-hour requests first through one shared active
inventory, and activates standby robots for any remaining shortfall. The four
core challenge levels are now implemented. An interactive session can run
multiple allocations and lets the operator select the multi-client allocation
policy or disable standby activation for active-only operation. Multi-client
results conclude with aggregate robot usage, charging cost, and active-fleet
utilisation metrics.

## Allocation summary metrics

Total robot usage and charging cost include active and standby robots assigned
to fulfilled clients. Active-fleet utilisation excludes on-demand standby
robots because the challenge supplies no standby inventory counts. Overall
utilisation is the weighted ratio of active robots used to active robots
available; each category uses the same ratio for that category. Percentages are
rounded to at most one decimal place, and a zero active-inventory denominator is
shown as `N/A`.

## Run EverBot

Choose either the native Node.js path or the optional Docker path. The native
path is recommended for development and gives the fastest repeat runs.

### Native Node.js (recommended)

Install Node.js 24 LTS. Version 24.19.0 is pinned in `.nvmrc` for users of a
compatible Node version manager. Node.js 22.13 or later on the Node 22 release
line is also supported.

The same commands work in macOS and Linux terminals, Windows PowerShell, and
Windows Command Prompt:

```sh
npm ci
npm start
```

`npm start` builds the TypeScript project before launching the interactive
terminal application. For development without a separate build, run:

```sh
npm run dev
```

To run formatting, linting, type checking, tests, and the production build:

```sh
npm run check
```

### Docker (no local Node.js required)

Install Docker Desktop on macOS or Windows, or Docker Engine with the Compose
plugin on Linux. Then run:

```sh
docker compose run --rm --build everbot
```

The first run builds the pinned Node.js 24 image. Docker reuses cached build
layers on later runs and removes the stopped application container when the
session ends. No ports, volumes, or background services are created.

## Terminal presentation

Interactive terminals use a restrained amber, cyan, coral-red, and green palette
to make headings, errors, operational states, and selected values easier to
scan. Every state remains explicit in words, and output stays plain when
terminal colour is unsupported or redirected. Set a non-empty `NO_COLOR`
environment variable to disable ANSI styling explicitly. This is optional and
is not needed for normal startup.

macOS or Linux:

```sh
NO_COLOR=1 npm start
```

Windows PowerShell:

```powershell
$env:NO_COLOR = "1"; npm start
```

Windows Command Prompt:

```bat
set NO_COLOR=1 && npm start
```

With Docker on any platform:

```sh
docker compose run --rm --build -e NO_COLOR=1 everbot
```

## Engineering approach

- Keep allocation rules independent from terminal input and output.
- Represent category distribution and cost optimisation as interchangeable
  allocation strategies.
- Keep robot inventory immutable at domain boundaries and consume one shared
  active inventory while coordinating a multi-client batch.
- Test observable behaviour against the challenge examples, objective order,
  error cases, and deterministic ties.

## AI assistance

OpenAI Codex assisted with interpreting the challenge brief, exploring design
trade-offs, and drafting and reviewing tests, implementation, and documentation.
