# EverBot Robot Work Allocation System

EverBot is a terminal-based TypeScript application for assigning Bravo,
Charlie, and Delta robots to client work. It implements the challenge's four
cumulative levels: category distribution, charging-cost optimisation, standby
activation, and prioritised multi-client allocation. It also includes the
requested summary metrics and a small set of operational extensions.

## Quick start

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

### Docker (no local Node.js required)

Install Docker Desktop on macOS or Windows, or Docker Engine with the Compose
plugin on Linux. Then run:

```sh
docker compose run --rm --build everbot
```

The first run builds the pinned Node.js 24 image. Docker reuses cached build
layers on later runs and removes the stopped application container when the
session ends. No ports, volumes, or background services are created.

## Try the core flows

For a single-client comparison, keep the default settings, select **Run
allocation**, and enter:

```text
Bravo: 2
Charlie: 3
Delta: 2
Client work hours: 20
```

The terminal displays the category-distribution and cost-optimised results,
then explains their charging-cost difference.

Single-client runs always compare both strategies. The policy setting selects
the strategy used for multi-client batches; cost optimisation is the default.
Automatic standby activation is enabled by default for both flows.

To exercise Level 4 with the same inventory, enter the following client hours:

```text
12,16,17,10,21
```

The requests are processed as 21, 17, 16, 12, and 10 hours. This demonstrates
stable priority, shared active inventory, automatic standby activation, and the
final allocation summary. Client requests may be separated by commas,
whitespace, or both.

## Challenge coverage

| Scope         | Implemented behaviour                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Level 1       | Allocate at least one robot from every category and minimise excess hours                                                         |
| Level 2       | Produce a charging-cost-optimised alternative and compare both single-client strategies                                           |
| Level 3       | Use all active capacity first, then activate cost-optimised standby robots for the shortfall                                      |
| Level 4       | Prioritise the highest-hour clients and consume one shared active inventory across the daily batch                                |
| Bonus metrics | Report total robot usage, charging cost, average active-fleet utilisation, and utilisation by category                            |
| Extensions    | Repeat allocations, select the batch policy, disable standby, preserve plain accessible output, and offer portable Docker startup |

## Robot catalogue and domain rules

| Robot type | Working hours per day | Charging cost per day |
| ---------- | --------------------: | --------------------: |
| Bravo      |                     3 |                    $2 |
| Charlie    |                     5 |                    $3 |
| Delta      |                     8 |                    $4 |

An assigned robot contributes its full daily hours, incurs its full daily
charging cost, and cannot be assigned again from the active fleet in the same
daily batch. An allocation may provide more hours than requested, but never
fewer.

Robot counts must be non-negative safe integers. Each client request must be a
positive safe integer. Duplicate requests and their original input order are
preserved before prioritisation.

### Deterministic allocation objectives

Every candidate must first fulfil the requested hours. The remaining objectives
are minimised from left to right:

| Policy                | Additional feasibility rule       | Objective order                                                            |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Category distribution | Include Bravo, Charlie, and Delta | Excess hours, charging cost, total robots, Bravo/Charlie/Delta count tuple |
| Cost optimised        | None                              | Charging cost, excess hours, total robots, Bravo/Charlie/Delta count tuple |

The final count tuple is compared in catalogue order: lower Bravo count first,
then lower Charlie count, then lower Delta count. This final tie-break makes the
same valid input produce the same result every time.

### Adopted assumptions

- One multi-client input represents one daily allocation, so active robots are
  shared and cannot be reused between clients.
- Clients are processed from highest to lowest requested hours. Equal-hour
  clients retain their original input order.
- Standby robots are available on demand because the challenge specifies no
  standby inventory counts.
- Standby activates only when a request exceeds the remaining active capacity.
  It does not repair a category-distribution failure when total active capacity
  is already sufficient.
- When standby is required, all remaining active robots are used first and the
  standby strategy allocates against only the shortfall.
- A failed client consumes no active inventory. The batch records that failure
  and continues with lower-priority clients.
- Multi-client allocation follows the required sequential priority rather than
  searching for one global optimum across the whole batch.

## Architecture and design

| Layer       | Responsibility                                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Domain      | Validate work requests and inventory, expose the fixed catalogue, calculate allocation values, and represent expected domain errors |
| Strategies  | Enumerate valid candidates and select the best result using explicit lexicographic objectives                                       |
| Application | Compare policies, recover capacity with standby robots, coordinate multi-client work, and calculate summaries                       |
| CLI         | Parse input, manage session settings, detect terminal capabilities, and render results without embedding allocation rules           |

`AllocationStrategy` is the one deliberate behavioural pattern. Application
services receive strategies through their public APIs, so active allocation,
comparison, and batch coordination do not depend on concrete strategy classes.
This supports the open-closed and dependency-inversion aspects of SOLID while
keeping the interface small.

Object-oriented modelling is used where it protects invariants or enables
polymorphism. `WorkRequest` rejects invalid hours, while `FleetInventory` owns
frozen counts and returns new inventories from `add` and `subtract`. Parsing,
score comparison, and presentation remain pure functions where classes would
add no value. Separating domain, application, and terminal responsibilities
keeps each part focused and independently testable.

## Failure handling and exit codes

Malformed interactive input produces a clear message and is requested again.
Expected allocation failures use `DomainError` values with a stable code,
message, and contextual details. For category distribution, an empty fleet is
reported before a missing category, and a missing category is reported before
insufficient capacity.

One infeasible client does not consume inventory or prevent later clients from
being attempted. Unexpected programming errors propagate instead of being
misreported as expected allocation failures.

The interactive session returns the result of its most recent allocation:

| Exit code | Meaning                                                                                     |
| --------: | ------------------------------------------------------------------------------------------- |
|       `0` | Normal exit with no operational failure in the most recent allocation, or no allocation run |
|       `1` | Normal exit after the most recent allocation contained an infeasible operational result     |
|     `130` | A prompt was interrupted with Ctrl+C                                                        |

## Allocation summary metrics

Total robot usage and charging cost include active and standby robots assigned
to fulfilled clients. Failed clients contribute neither robots nor cost.

Active-fleet utilisation excludes on-demand standby robots because the
challenge supplies no standby inventory counts. Overall utilisation is the
weighted ratio of active robots used to active robots available. Each category
uses the same ratio for that category. Percentages are rounded to at most one
decimal place, and a zero active-inventory denominator is shown as `N/A`.

## Testing, TDD, and Git history

Run the complete quality gate with:

```sh
npm run check
```

This runs Prettier, strict ESLint rules, strict TypeScript checking, 124 tests
across 13 files, and the production build. The behavioural suite covers:

- catalogue values, numeric boundaries, and domain validation
- immutable inventory arithmetic and prevention of robot reuse
- challenge examples and every allocation objective and tie-break level
- standby activation boundaries, disabled recovery, and failure isolation
- stable multi-client priority, shared inventory, and aggregate metrics
- complete fake-terminal flows, menus, validation loops, and exit codes
- Ctrl+C handling plus textual parity between coloured and plain output

Development followed a test-first workflow: expected behaviour and failures
were specified before each implementation slice, while only completed green
slices were committed. The public history contains focused, independently green
code-bearing commits rather than one final bulk change.

## Trade-offs, limitations, and improvements

This is a production-minded assessment CLI rather than a deployed fleet
service. It uses locked dependencies, strict compilation, deterministic rules,
structured errors, a non-root multi-stage Docker runtime, and graceful signal
handling. Its scope remains intentionally bounded.

- Both strategies exhaustively enumerate the three robot-count dimensions.
  This is transparent and reliable for challenge-sized fleets, but runtime
  scales with the product of the available counts. Input is numerically safe but
  does not impose a practical fleet-size limit.
- The catalogue, active inventory, and on-demand standby model live in memory.
  There is no persistent warehouse source or finite standby inventory.
- Sequential highest-hours priority matches the challenge, but it does not
  optimise one combined objective across every client.
- The repository has no committed operating-system CI matrix, coverage
  threshold, or performance test suite.

With more time, the next improvements would be:

1. Replace exhaustive enumeration with dynamic programming or an optimisation
   solver if the catalogue or fleet sizes grow.
2. Externalise the robot catalogue and finite standby inventory, then persist
   allocation and audit records behind a non-interactive application contract.
3. Add CI across the supported Node.js versions and operating systems, together
   with coverage thresholds and performance tests.

## Terminal presentation

Interactive terminals use a restrained amber, cyan, coral-red, and green
palette to make headings, errors, operational states, and selected values easier
to scan. Every state remains explicit in words, and output stays plain when
terminal colour is unsupported or redirected.

Set a non-empty `NO_COLOR` environment variable to disable ANSI styling
explicitly. This is optional and is not needed for normal startup.

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
set "NO_COLOR=1" && npm start
```

With Docker on any platform:

```sh
docker compose run --rm --build -e NO_COLOR=1 everbot
```

## AI assistance

OpenAI Codex assisted with interpreting the challenge brief, exploring design
trade-offs, and drafting and reviewing tests, implementation, and documentation.
