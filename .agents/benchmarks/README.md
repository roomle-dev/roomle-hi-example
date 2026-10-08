# Benchmarks

One document per performance question: how long the HI agent takes for a kind of request, where the
time goes, which flaws cost it steps, and what would make it faster — with the benchmark it is based
on in a folder of the same name (`benchmark.md` step by step, `benchmark.json` for the next
comparison).

Written with the skill [hi-mcp-benchmarking.md](../skills/hi-mcp-benchmarking.md), which also
says how to repeat a benchmark after an improvement.

## What belongs here

Point-in-time measurements and their analysis. A document covers:

- what was asked, and the tests, models and runs measured
- how it was measured, and which runs were left out and why
- where the time goes: per test, per kind of step, per tool, and what the context is made of
- the flaws that cost steps and time, each with its evidence and its cause
- the proposed improvements, each with its expected saving
- what is open, and the measurement gaps

## What does not belong here

How the chat, the server or the tools work today — that is living reference in
[`docs/`](../../docs/) and the skills. A benchmark is evidence of what was true on its date and for
its build; confirm against the code before acting on one.

## Lifecycle

A benchmark stays as the baseline until the improvements it proposes are measured. The new
benchmark goes next to it, with a before/after table in the document. Once the improvements have
landed and are measured, the durable outcome — the step cost of a model, a rejected approach — is
promoted into the living reference, and the document can be deleted.

## Current Documents

No benchmark yet.
