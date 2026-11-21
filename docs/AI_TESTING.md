# Manual Testing Guide — AI Features

How to exercise Horizon Airways' four AI features, both in the **UI** and via the **API** (curl).
Base URL: `http://localhost:4000` (single-process) or `http://localhost:5173` (dev). Demo logins
(password `Passw0rd!`): `demo@horizon.air` (passenger), `admin@horizon.air` (admin).

> All AI runs **local-first** (instant offline heuristics) and consults the LLM only for
> genuinely ambiguous input; every feature degrades gracefully if a key/service is missing.

## Get a token (for API testing)
```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@horizon.air","password":"Passw0rd!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
ADMIN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@horizon.air","password":"Passw0rd!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
```

---

## 1. Natural-language flight search  `POST /api/ai/search`

**UI:** Search page → **AI Search** tab → type a sentence → Search. A row of chips shows what
the AI parsed (destination, date, time-of-day, sort).

**API:**
```bash
curl -s -X POST http://localhost:4000/api/ai/search \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"cheap morning flight to Delhi next Friday"}'
```

**Try these and check the `parsed` field:**
| Input | Expect in `parsed` |
|-------|--------------------|
| `cheap morning flight to Delhi next Friday` | destination DEL, timeOfDay MORNING, sort CHEAPEST, next-Friday date |
| `evening flights from Mumbai to Bangalore` | origin BOM, destination BLR, timeOfDay EVENING |
| `fastest flight to Hyderabad tomorrow` | destination HYD, sort FASTEST, tomorrow's date |
| `flights from Chennai to Kolkata this weekend` | origin MAA, destination CCU, Sat–Sun date range |
| `asdf qwer` (gibberish) | `{}` — returns all flights (no crash) |

**Pass criteria:** responses are fast (<50ms for normal queries), `parsed` matches intent,
`flights` list respects the filters (morning results really depart in the morning, cheapest
is sorted ascending by fare).

---

## 2. Demand & Crew Optimizer  `GET /api/ai/optimizer`  (admin)

**UI:** Log in as admin → Admin → **Optimizer**. Each row shows a load-factor bar, a
recommended crew count, and an OVER / UNDER / OK flag with a rationale.

**API:**
```bash
curl -s http://localhost:4000/api/ai/optimizer -H "Authorization: Bearer $ADMIN"
```

**Pass criteria:** returns ~50 upcoming flights; you see a **mix** of flags
(UNDER = fewer crew assigned than recommended, OVER = more, OK = right-sized);
`predictedLoadFactor` is between 0 and 1 and higher for busier flights; each has a `rationale`.
Non-admins get **403**.

---

## 3. Fare forecast  `GET /api/ai/fare-forecast/:flightId`

**UI:** On any flight card in search results, a **fare badge** shows (e.g. "Prices rising —
book now" or "May drop — wait").

**API:**
```bash
# grab a flight id from a search, then:
curl -s http://localhost:4000/api/ai/fare-forecast/<flightId> -H "Authorization: Bearer $TOKEN"
```

**Pass criteria (depends on the flight's occupancy + days to departure):**
| Flight | Expect |
|--------|--------|
| Busy flight (≥60% full) or near-departure & filling | `RISING` / `BOOK_NOW` |
| Nearly empty (≤30%) and ≥7 days out | `FALLING` / `WAIT` |
| In between | `STEADY` / `BOOK_NOW` |

`confidence` is between 0 and 1.

---

## 4. Smart rebooking  `POST /api/ai/rebooking`

**UI:** My Bookings → cancel a booking → a panel suggests alternative flights on the same route.

**API:**
```bash
curl -s -X POST http://localhost:4000/api/ai/rebooking \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  -d '{"flightId":"<flightId>"}'
```

**Pass criteria:** returns alternative flights that are **(a)** on the same route,
**(b)** exclude the input flight, **(c)** have seats available, **(d)** are ranked by time
proximity then fare.

---

## Testing the LLM path (optional)
By default the fast local parser handles clear queries. To force the LLM, use deliberately
vague phrasing (e.g. `"I need to get to the tech capital of India sometime this week on a budget"`).
The server calls the configured LLM (6s timeout) and falls back to local on any error — so it
never hangs or 500s. Set `LLM_API_KEY=` empty in `.env` to run fully offline.

## Automated tests
```bash
npm test   # 103 tests incl. NL parser, optimizer, fare, rebooking — all run offline
```
