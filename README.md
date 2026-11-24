# LokaTalenta Backlog

Dedicated Backlog & Multi-Agent Grooming application for Epics, Stories, Tasks, Bugs, Tech Debt, MoSCoW/Story Points, Given-When-Then Acceptance Criteria, dependency tracking, formula-safe CSV export, and real-time telemetry emission (`API: 4102`, `Dev UI: 4112`) via [`lokatalenta-event-gateway`](https://github.com/zixew/lokatalenta-event-gateway).

## Repository Layout

- `server/` — Node/TypeScript API + SQLite persistence + Gateway emitter (planned M3)
- `client/` — Vite + React + TypeScript + Tailwind UI (planned M3)
- `tests/` — Automated API & UI test suite (planned M3)

## Commands (Planned M3 Baseline)

```bash
npm install
npm run dev   # API 4102, Dev UI 4112
npm test
```
