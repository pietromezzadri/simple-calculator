# Coverage report

CI regenerates these numbers on every push and keeps the HTML reports as build artifacts, named `backend-coverage` and `frontend-coverage`.

## Backend

```bash
cd backend
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

| Package | Statements |
|---|---|
| `internal/calculator` | 95.6% |
| `internal/api` | 99.0% |
| `cmd/server` | 22.9% |
| **Total** | **83.4%** |

What isn't covered:

| Code | Coverage | Why |
|---|---|---|
| `main` and `run` in `cmd/server` | 0% | Process startup, signals and shutdown. CI's Docker smoke test runs them, but that doesn't count towards this figure. |
| `calculator.Sqrt` | 83.3% | Handling for a library error that can't occur, because negative input is rejected first. |
| `calculator.Power` | 94.7% | Handling for a library error that the size estimate should prevent. |
| `api.parseOperand` | 91.7% | A failure to decode a JSON string the decoder has already validated. |

Every function in `internal/api` and `internal/calculator` not listed here is at 100%.

## Frontend

```bash
cd frontend
npm test -- --coverage
```

The HTML report is written to `frontend/coverage/index.html`.

| Measure | Coverage | Count |
|---|---|---|
| Statements | 100% | 152 / 152 |
| Branches | 97.81% | 134 / 137 |
| Functions | 100% | 37 / 37 |
| Lines | 100% | 130 / 130 |

The three branches not covered:

| Code | Why |
|---|---|
| `useCalculator.ts` line 20 | The check that drops a successful answer arriving just after cancellation. `fetch` rejects once aborted, so this needs an answer to land in a narrow window. |
| `useCalculator.ts` line 35 | The general message for an error that isn't an `ApiError`. The API client turns every failure except cancellation into one. |
| `Display.tsx` line 12 | The size class for the longest values, which only changes the font size. |

The build fails if frontend coverage falls below 90% on any measure, a threshold set in `vite.config.ts`.
