# EverBot Robot Work Allocation System

EverBot is a terminal-based application for assigning Bravo, Charlie, and Delta
robots to client work. The challenge develops the allocation behaviour through
four cumulative levels: category distribution, charging-cost optimisation,
standby activation, and prioritised multi-client allocation.

## Robot catalogue

| Robot type | Working hours per day | Charging cost per day |
| --- | ---: | ---: |
| Bravo | 3 | $2 |
| Charlie | 5 | $3 |
| Delta | 8 | $4 |

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

Implementation has not started. Source code, automated tests, setup instructions,
and run commands will be added in independently reviewable increments.

## Planned engineering direction

- Keep allocation rules independent from terminal input and output.
- Represent category distribution and cost optimisation as interchangeable
  allocation strategies.
- Keep robot inventory immutable at domain boundaries and consume one shared
  active inventory while coordinating a multi-client batch.
- Test observable behaviour against the challenge examples, objective order,
  error cases, and deterministic ties.

These are design directions, not claims about code that already exists.

## AI assistance

OpenAI Codex assisted with interpreting the challenge brief, exploring design
trade-offs, and drafting and reviewing this initial project overview. This
disclosure will be updated to describe any later assistance with tests,
implementation, documentation, or review.
