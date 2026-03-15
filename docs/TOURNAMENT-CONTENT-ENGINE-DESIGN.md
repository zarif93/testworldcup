# Tournament Content Engine – Design & Implementation Plan

**Status:** Proposal for approval before implementation.  
**Goal:** Separate tournament shell (metadata, lifecycle, prize) from tournament content (matches, questions, options, results) and provide a full admin content layer with type-specific editing and safe player-facing rendering.

---

## Current State (Summary)

| Area | Current behavior |
|------|------------------|
| **Shell** | `tournaments` table holds name, type, amount, status, dates, lifecycle, prize; no explicit "content ready" flag. |
| **Football (worldcup)** | Global `matches` table (not per-tournament); hardcoded World Cup data; submissions keyed by match id. |
| **Football custom** | `custom_football_matches` per tournament; admin manages via "משחקים / עדכון תוצאות" in AdminPanel (one section per tournament). |
| **Lotto** | No content table; fixed structure (6+1 numbers). Results in `lotto_draw_results`. |
| **Chance** | No content table; fixed structure (4 suits). Results in `chance_draw_results`. |
| **Universal items** | `competition_item_sets` + `competition_items` exist; resolution prefers legacy by type; no single admin flow for "content". |
| **Player UI** | `DynamicPredictionForm` uses `getResolvedFormSchema` + resolved items (legacy or universal); football/lotto/chance render correctly when content exists. |

**Gaps:** No single "ניהול תוכן" entry; custom questions/options not modeled; lottery/chance "content" is implicit; no validation that content is complete before publish; basketball/tennis/custom lack dedicated content structures.

---

## PART 1 — Proposed Data Model

### 1.1 Principles

- **One content layer** that all tournament types can use, with type-specific fields where needed.
- **Backward compatibility:** Keep existing `custom_football_matches`, `lotto_draw_results`, `chance_draw_results` and legacy resolution working; new content can either fill these or live in the new tables and be resolved uniformly.
- **Extensibility:** New sports or question types add new `content_kind` / `option_type` values and optional JSON, not new tables per type.
- **First-class prediction model:** Markets (not events) carry prediction type and input/scoring models; events are real-world objects (match, draw, question). See PART 1A and PART 1B below.
- **First-class reward / prize logic:** Reward distribution is a separate layer from scoring; reward_model_kind and config can live at tournament, event, or market level. Settlement engine resolves reward after scoring. See PART 1C below.

---

## PART 1A — Prediction Model (First-Class)

To avoid long-term fragility and enable consistent scoring and UI generation, the content layer is driven by an explicit **prediction model** rather than opaque JSON. Every item that a user can predict on has a **prediction type**, a **prediction input model**, and a **scoring model**.

### 1A.1 Prediction Model Taxonomy

#### A. Reference table: `prediction_types`

Stored in DB so new types can be added without code deploys (optional). Alternatively, a code-time enum/const is acceptable for Phase 1; the important part is that the *taxonomy* is explicit and stable.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| code | text, unique | Stable identifier used in APIs and resolution. |
| family | text | `sports_match` \| `draw_lotto` \| `draw_chance` \| `custom_question` – groups types for admin and validation. |
| title_he | text | Hebrew label for admin (e.g. "תוצאה 1/X/2", "בחירה יחידה"). |
| description_he | text | Optional short description. |
| input_model_kind | text | See 1A.2 – determines allowed submission shape. |
| result_model_kind | text | See 1A.3 – determines stored result shape. |
| scoring_model_kind | text | See 1A.4 – determines which scorer runs. |
| sort_order | int | For admin dropdowns. |
| is_active | boolean | Can disable deprecated types. |

#### B. Canonical prediction type codes (taxonomy)

**Sports (family: `sports_match`)**

| code | title_he (example) | Input from user | Result stored | Scoring |
|------|--------------------|-----------------|---------------|---------|
| `result_1x2` | תוצאה 1/X/2 | One of 1, X, 2 | homeScore, awayScore | Match: 1/X/2 vs result |
| `exact_score` | תוצאה מדויקת | homeGoals, awayGoals | homeScore, awayScore | Exact match |
| `over_under` | מעל/מתחת | over_under value + line | totalGoals, line | Over/under vs result |
| `winner_only` | מנצח בלבד | winner (side A / side B) | winnerSide or entity_id | Match winner |
| `handicap` | הנחתה | handicap value + chosen side | handicap, result scores | Handicap result |
| `sets` | סטים (טניס) | sets per player/side | set scores | Set result |
| `points_range` | טווח נקודות | range key or value | actual points | Range hit |

**Lottery (family: `draw_lotto`)**

| code | title_he (example) | Input from user | Result stored | Scoring |
|------|--------------------|-----------------|---------------|---------|
| `fixed_numbers` | 6 מספרים | 6 numbers (1–37) | num1..num6 | Per-number match |
| `strong_number` | מספר חזק | 1 number (1–7) | strongNumber | Strong hit bonus |
| `matrix` | מטריצה | Matrix selection (if used) | Same as draw | Per rules |
| `quick_pick` | בחירה אקראית | System-generated same shape | Same as draw | Same as fixed_numbers |

**Chance (family: `draw_chance`)**

| code | title_he (example) | Input from user | Result stored | Scoring |
|------|--------------------|-----------------|---------------|---------|
| `hearts` | לבבות | One value per suit (e.g. 7..A) | heartCard, clubCard, diamondCard, spadeCard | Per-suit match |
| `cards` | קלפים | Same as hearts (alias) | Same | Same |
| `shapes` | צורות | Shape-based options | Shape result | Per-shape match |

**Custom / questions (family: `custom_question`)**

| code | title_he (example) | Input from user | Result stored | Scoring |
|------|--------------------|-----------------|---------------|---------|
| `single_choice` | בחירה יחידה | One option_id or option_key | correct_option_id or key | Correct option match |
| `multi_choice` | בחירה מרובה | Set of option_ids | set of correct_option_ids | Per-option or all-or-nothing |
| `numeric` | מספר | Numeric value | correct_numeric or range | Exact or range |
| `range` | טווח | Range key | correct_range or value | Range hit |
| `free_text` | טקסט חופשי | Text (optional; scoring often manual) | correct_text or manual | Manual or match |

### 1A.2 Prediction input model

The **prediction input model** defines what the user is allowed to send for one item (and thus what the UI must render).

- Stored per **prediction type** (in `prediction_types` or a const map keyed by `code`), or overridden per **content item** when the same type allows variants (e.g. different option sets for `single_choice`).

**Structured shape (first-class), not free-form JSON:**

| input_model_kind | Description | Config shape (DB or JSON) | Example |
|------------------|-------------|---------------------------|---------|
| `choice_fixed` | Fixed set of choices (1X2, winner A/B). | `{ "choices": ["1","X","2"] }` or `{ "optionKeys": ["1","X","2"], "labels": { "1": "בית", "X": "תיקו", "2": "חוץ" } }` | result_1x2, winner_only |
| `choice_options` | Choices from tournament_content_options. | `{ "optionIds": [1,2,3] }` or derived from item’s options | single_choice |
| `multi_choice_options` | Multiple options from list. | `{ "optionIds": [1,2,3], "min": 1, "max": 3 }` | multi_choice |
| `numeric_exact` | Single number. | `{ "min": 0, "max": 20 }` | exact_score (goals), numeric |
| `numeric_range` | User picks a range key. | `{ "ranges": [{"key":"0-1","label":"0–1"},{"key":"2-3","label":"2–3"}] }` | points_range, range |
| `numbers_set` | Set of numbers (e.g. lotto). | `{ "count": 6, "min": 1, "max": 37 }` | fixed_numbers |
| `numbers_single` | Single number in range. | `{ "min": 1, "max": 7 }` | strong_number |
| `suits_values` | One value per suit/category. | `{ "suits": ["heart","club","diamond","spade"], "values": ["7","8","9","10","J","Q","K","A"] }` | hearts, cards |
| `text` | Free text. | `{ "maxLength": 500 }` | free_text |

Content item table stores **prediction_input_config** (JSON) that must conform to the schema for its `prediction_type`. For example, `result_1x2` might have `{}` (default 1/X/2); `single_choice` has `{ "optionIds": [1,2,3] }` or the options are loaded from `tournament_content_options` by item id.

### 1A.3 Result model (stored result per event/market/tournament)

The **result model** defines how the official result is stored: at **event** level (e.g. match score — one result drives all markets of that event), **market** level (e.g. correct option for a question), or **tournament** level (e.g. one draw per tournament). See PART 1B.4.

| result_model_kind | Stored shape | Used by |
|-------------------|--------------|--------|
| `score_pair` | `{ "homeScore": n, "awayScore": m }` | result_1x2, exact_score, winner_only (derive from score) |
| `winner_side` | `{ "winnerSide": "home" \| "away" }` or entity_id | winner_only |
| `over_under_result` | `{ "totalGoals": n, "line": 2.5 }` | over_under |
| `handicap_result` | `{ "handicap": -1, "homeScore", "awayScore" }` | handicap |
| `sets_result` | `{ "setScores": [...] }` | sets |
| `correct_option` | `{ "correctOptionId": id }` or `correctOptionKey` | single_choice, multi_choice (array) |
| `numeric_result` | `{ "value": n }` or `{ "min", "max" }` | numeric, range |
| `lotto_draw` | `{ "num1".."num6", "strongNumber" }` | fixed_numbers, strong_number (one row per tournament) |
| `chance_draw` | `{ "heartCard", "clubCard", "diamondCard", "spadeCard" }` | hearts, cards |

Scoring reads from this stored result and compares to the user’s prediction using the **scoring model**.

### 1A.4 Scoring model

The **scoring model** defines how points are computed for one item (and optionally for the whole tournament, e.g. lotto strong-hit bonus).

| scoring_model_kind | Description | Parameters (per type or per tournament) |
|--------------------|-------------|----------------------------------------|
| `match_1x2` | 1 point if prediction matches result (1/X/2). | `pointsPerCorrect` (e.g. 3) |
| `exact_score` | Points only if exact score. | `pointsExact` |
| `over_under_match` | Points if over/under matches. | `pointsPerCorrect` |
| `winner_match` | Points if winner correct. | `pointsPerCorrect` |
| `handicap_match` | Points by handicap result. | `pointsPerCorrect` |
| `sets_match` | Points by set result. | Per-set or total |
| `lotto_per_number` | 1 point per matching number; optional strong bonus. | `pointsPerNumber`, `pointsStrongHit` |
| `chance_per_suit` | 1 point per matching suit value. | `pointsPerSuit` |
| `single_choice_correct` | Points if selected option is correct. | `pointsPerCorrect` |
| `multi_choice` | All correct, or partial. | `pointsAllOrNothing` or `pointsPerOption` |
| `numeric_exact` | Points if value matches. | `pointsExact` |
| `range_contains` | Points if value in range. | `pointsPerRange` |

Scoring engine (existing or new) selects the scorer by `scoring_model_kind` (or by `prediction_type` → default scoring model) and uses the stored result + user prediction to compute points.

### 1A.5 How prediction types map to events and markets

- **Prediction type is at market level.** With the Event/Market layer (PART 1B), **tournament_markets** (not events) carry `prediction_type_code`, `prediction_input_config`, and `scoring_config`. One event can have multiple markets (e.g. one match → result_1x2, over_under, exact_score). Legacy/single-market: when there is no explicit market table, resolution exposes a logical market per match with `prediction_type_code = "result_1x2"`. So:
  - New table: add columns `prediction_type_id` (FK to `prediction_types`) or `prediction_type_code` (text). Prefer **code** for simplicity and so that legacy resolution can set code without needing a prediction_types row.
- **One content item = one prediction “slot”** (one match, one question, or one draw). For lotto/chance, the **tournament** is treated as a single draw; the tournament has an implied prediction type (e.g. `lotto_6_1` = fixed_numbers + strong_number, `chance_cards` = hearts). So:
  - **Sports:** Each match (event) has one or more markets; today typically one market `result_1x2` per match. Stored in tournament_markets or implied by legacy match row.
  - **Custom:** One event (question) + one market (single_choice or multi_choice); options in tournament_market_options.
  - **Lotto/Chance:** One draw event per tournament; one or two markets (fixed_numbers, strong_number or hearts). Resolution returns markets that read from the same tournament-level draw result. “virtual” 
- **Legacy:** When resolving from `custom_football_matches` or global `matches`, resolver attaches a canonical market with `prediction_type_code = "result_1x2"` so that UI and scoring use the same taxonomy.

### 1A.6 How scoring logic maps to prediction type

- **Inputs:** Tournament, submission (predictions JSON), stored results (per event/market or tournament-level draw).
- **Lookup:** For each prediction key (market id or legacy match id), get market (or legacy match → implied market) → read `prediction_type_code` → resolve to `scoring_model_kind` (from prediction_types table or const map).
- **Execution:** Scoring module has one function per scoring_model_kind (e.g. `score_1x2`, `score_lotto_match`, `score_chance_draw`, `score_single_choice`). It receives (user_value, result_value, optional config) and returns points (and optional strongHit flag for lotto).
- **Existing code:** Current football/lotto/chance scorers stay as-is; they are *mapped* to the canonical prediction types (result_1x2, fixed_numbers + strong_number, hearts/cards). New markets that use the same prediction type code will use the same scorer.

### 1A.7 How UI form generation maps to prediction type

- **Input:** Resolved markets (each with prediction_type_code, prediction_input_config, and any options from tournament_market_options); event context for display (e.g. match title).
- **Registry:** A map `prediction_type_code → { component, getDefaultInputConfig }`:
  - `result_1x2` → Toggle12X (or 1/X/2 buttons), config unused or for labels.
  - `single_choice` → Radio group or buttons from options; config = option list.
  - `fixed_numbers` → Number grid 1–37, pick 6; `strong_number` → 1–7 pick one.
  - `hearts` / `cards` → One dropdown or button set per suit, values 7..A.
  - `multi_choice` → Checkbox group from options.
  - `numeric`, `range`, `free_text` → Input number, range selector, text input.
- **Rendering:** For each item, UI looks up prediction_type_code, renders the right component, and validates that the user input matches the prediction input model (e.g. exactly 6 numbers, one per suit, etc.). Submission payload is built in the same shape as today (e.g. match id → "1"|"X"|"2", or item id → option_key).
- **Backward compatibility:** Legacy resolution already returns something like `optionSchema: { type: "1X2", options: ["1","X","2"] }`. That can be derived from prediction_type_code = `result_1x2` so the current DynamicPredictionForm still works; later the form can be driven purely by prediction_type + prediction_input_config.

### 1A.8 Migration compatibility with existing football / lotto / chance

| Current system | Prediction type(s) | Input model | Result storage | Scoring |
|----------------|--------------------|-------------|----------------|---------|
| **Football (worldcup + custom)** | `result_1x2` | choice_fixed ["1","X","2"] | score_pair (homeScore, awayScore) in matches or custom_football_matches | match_1x2 (pointsPerCorrect e.g. 3) |
| **Lotto** | `fixed_numbers` + `strong_number` (or single composite `lotto_6_1`) | numbers_set (6, 1–37) + numbers_single (1–7) | lotto_draw_results (num1..num6, strongNumber) | lotto_per_number + strong_hit bonus |
| **Chance** | `hearts` (or `cards`) | suits_values (4 suits × values 7..A) | chance_draw_results (heartCard, clubCard, diamondCard, spadeCard) | chance_per_suit |

**Compatibility rules:**

1. **Existing submissions:** Prediction payload shape does not change. Keys (match id, or "numbers"/"strongNumber", or heart/club/diamond/spade) and value shapes stay the same. So existing submissions remain valid.
2. **Resolution:** When resolving from legacy (matches, custom_football_matches, lotto, chance), the resolver attaches `prediction_type_code` (and optionally input/result/scoring model kinds) so that:
   - Player UI can use the same registry (prediction_type → component).
   - Scoring can use the same scoring_model dispatch.
3. **New content layer:** When we add tournament_events + tournament_markets, each market stores `prediction_type_code` and optional configs. Resolution from new tables returns markets (with event context) in the same shape as legacy so that existing form and scoring code keeps working; under the hood, optionSchema/resultSchema are derived from market’s prediction_type + config.
4. **No duplicate scoring logic:** Football/lotto/chance scoring remains implemented once; they are *tagged* with the canonical prediction type and scoring model so that both legacy and new content items use the same code path.

---

## PART 1B — Event & Market Layer

In real prediction/betting systems the hierarchy is **Tournament → Event → Market → Prediction**. The previous design treated each “item” as a single prediction slot. Here we separate:

1. **Event** — the real-world object (match, draw, question group / single question).
2. **Market** — the prediction opportunity; one event can have multiple markets.
3. **Prediction** — the user’s input per market (stored in submissions, keyed by market or legacy key).

Example: **Match: Barcelona vs Real Madrid** (event) can have markets: `result_1x2`, `over_under_2_5`, `exact_score`, `both_teams_score`, `first_goal`, `handicap`. Each market has its own prediction_type, input model, and scoring.

**Implicit single-market mode:** An event may optionally have **exactly one implicit market**. In that case the system does **not** require explicit rows in `tournament_markets`; prediction_type_code and reward model (and related configs) are stored at **event** level. This keeps the full multi-market architecture while allowing simpler admin UX and faster tournament creation when each event has only one prediction (e.g. one 1X2 per match, or one single_choice per question). See 1B.1a below.

### 1B.1 Event layer (real-world object)

**Table: `tournament_events`**

An event is the thing that happens in the real world: a match, a single draw, or a question (or a group of questions, if we model that).

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| group_id | FK → tournament_content_groups | Which tab/section this event belongs to. |
| external_key | text | Optional; for syncing with legacy (e.g. legacy match id, worldcup match id). |
| event_kind | text | `football_match` \| `basketball_match` \| `tennis_match` \| `lotto_draw` \| `chance_draw` \| `question` \| `question_group` \| `custom`. |
| title | text | e.g. "Barcelona vs Real Madrid", "Question 1", or empty for draw. |
| subtitle | text | Optional (e.g. group name, date, round). |
| sort_order | int | Order within group. |
| metadata_json | jsonb | Event-specific data: for matches → home_team, away_team, home_entity_id, away_entity_id, match_date, match_time; for question → question_text; for draw → empty or draw_date. |
| **implicit_single_market** | boolean | **Optional.** If true, this event has exactly one **implicit** market: no row in tournament_markets required; prediction and reward config live on this event (see 1B.1a). If false or null, event uses **explicit** markets from tournament_markets. |
| **prediction_type_code** | text | **When implicit_single_market = true:** Required. Canonical type from PART 1A (e.g. result_1x2, single_choice). When explicit markets: optional override or unused. |
| **prediction_input_config** | jsonb | **When implicit_single_market = true:** Config for the single market; must conform to prediction_type. When explicit: unused for resolution. |
| **scoring_config** | jsonb | **When implicit_single_market = true:** Optional scoring overrides for the single market. When explicit: unused. |
| reward_model_kind | text | Optional. Override for reward at event level (PART 1C). When implicit single market, this applies to that market. Null = inherit from tournament. |
| reward_config | jsonb | Optional. Config for reward at event level. When implicit single market, applies to that market. |
| status | text | `draft` \| `open` \| `locked` \| `finalized`. |
| created_at, updated_at | timestamp | |

**Indexes:** `(group_id)`, `(group_id, sort_order)`.

- **Explicit mode (implicit_single_market = false or null):** The event describes *what* is being played or asked; **markets** in `tournament_markets` describe *what can be predicted* (one or more per event).
- **Implicit single-market mode (implicit_single_market = true):** The event itself represents one prediction slot; prediction_type_code and configs on the event define that market. No `tournament_markets` rows required for this event.

### 1B.1a Implicit single-market events (design rule)

- **Purpose:** Simpler admin UX and faster tournament creation when each event has only one prediction (e.g. classic football 1X2 per match, or one question with single choice). No need to create a separate market row per event.
- **Rule:** When `tournament_events.implicit_single_market = true`:
  - The event **must** have `prediction_type_code` set (and optionally prediction_input_config, scoring_config, reward_model_kind, reward_config).
  - The system **does not** require any row in `tournament_markets` for this event. The event is treated as having exactly one logical market whose type and config come from the event.
  - Submission key for this “market” is **event_id** (or external_key for legacy). Resolution yields one slot per such event, with prediction_type_code and config from the event.
- **Rule:** When `implicit_single_market = false` or null:
  - The event’s markets are defined by rows in `tournament_markets` with this event_id. Event-level prediction_type_code / prediction_input_config / scoring_config are **not** used for resolution (reward_model_kind/reward_config on event remain optional overrides).
  - At least one market row per event is expected for validation when content is required (or the event can be implicit single-market).
- **Options for implicit single-market (e.g. single_choice):** When the implicit market is single_choice or multi_choice, options are needed. Either: (a) allow `tournament_market_options` to reference **event_id** when market_id is null (one row per option, event_id set, market_id null), or (b) store options in event metadata_json. Recommendation: (a) so one options table serves both explicit and implicit markets; schema: market_id nullable, event_id nullable; for explicit market → market_id set; for implicit market → event_id set, market_id null.
- **Market table unchanged:** `tournament_markets` still exists and is used for all **multi-market** scenarios (one event → many markets). Implicit mode only avoids creating a single market row when the event has exactly one prediction.

### 1B.2 Market layer (prediction opportunity)

**Table: `tournament_markets`**

A market is one prediction context under an event. Prediction type and scoring are defined at **market** level. **When an event uses implicit single-market mode** (implicit_single_market = true), this table is **not** used for that event; the single market is logical only and defined by the event row (1B.1a). This table is required for **explicit** multi-market (or single-market) scenarios: one or more rows per event with event_id = that event.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| event_id | FK → tournament_events | The event this market belongs to. |
| prediction_type_code | text | **Required.** Canonical type from PART 1A (e.g. `result_1x2`, `over_under`, `exact_score`, `single_choice`, `fixed_numbers`, `strong_number`). |
| market_code | text | Optional. Stable key for resolution and submission (e.g. `result_1x2`, `over_under_2_5`). If null, default from prediction_type or id. |
| title_he | text | Optional override for display (e.g. "תוצאה 1/X/2", "מעל/מתחת 2.5"). |
| sort_order | int | Order of markets under the same event. |
| prediction_input_config | jsonb | Config for input shape; must conform to prediction_type (e.g. for over_under: `{ "line": 2.5 }`; for single_choice: option list from tournament_market_options). |
| scoring_config | jsonb | Optional overrides (e.g. `{ "pointsPerCorrect": 5 }`). Scoring is tied to market. |
| status | text | `draft` \| `open` \| `locked` \| `finalized`. |
| created_at, updated_at | timestamp | |

**Indexes:** `(event_id)`, `(event_id, sort_order)`, `(prediction_type_code)`.

- **One event → one or many markets (explicit mode).** Example: one football match event → markets result_1x2, over_under_2_5, exact_score. When event uses **implicit single-market**, that event has zero rows here and one logical market from the event (1B.1a).
- **Submission key:** Player submissions are keyed by market (market_id for explicit markets, or **event_id** when the event is implicit single-market) or by legacy key. Scoring engine resolves by market (explicit or logical from event).

### 1B.3 Prediction layer (user input)

- **Prediction** = one user’s answer for one market. Stored in `submissions.predictions` (JSON).
- Keying: by **market_id** (new content) or by legacy key (match id, or "numbers"/"strongNumber", or suit keys) that resolution maps to the corresponding market(s).
- Shape of the value is determined by the market’s prediction_type and prediction_input_config (see PART 1A).

### 1B.4 Results: event-level vs market-level vs tournament-level

Results are stored at the level that provides the underlying outcome:

| Level | When to use | Stored in | Example |
|-------|-------------|-----------|---------|
| **Event** | One outcome drives multiple markets (e.g. match score). | tournament_event_results or legacy match/draw table | homeScore, awayScore for a match; all match markets derive from this. |
| **Market** | Outcome is specific to that market (e.g. correct option for a question). | tournament_market_results | correctOptionId for single_choice market. |
| **Tournament** | Single outcome for the whole tournament (e.g. one draw). | lotto_draw_results, chance_draw_results, or tournament_draw_results | num1..num6 + strongNumber; heart/club/diamond/spade. |

- **Sports match:** Result at **event** level (score_pair). Each market (result_1x2, over_under, exact_score) interprets that same result for its own scoring.
- **Custom question:** Result at **market** level (correct_option), because the “event” is the question and the only market is “which option is correct”.
- **Lotto / Chance:** Result at **tournament** level (one draw per tournament). The draw event has one or two markets (fixed_numbers, strong_number; or hearts) that all read from the same tournament-level result.

### 1B.5 How existing football logic maps

| Current | Event layer | Market layer | Submission / scoring |
|---------|-------------|--------------|------------------------|
| **custom_football_matches** (one row per match) | One **tournament_event** per match: event_kind = `football_match`, metadata = home, away, date, time. external_key = legacy match id. | One **tournament_market** per match (today): prediction_type_code = `result_1x2`, event_id = that event. Later: add more markets per event (over_under, exact_score). | Legacy: submission key = match id → value "1"\|"X"\|"2". Resolution: match id → event + default market (result_1x2). Scoring: read result from event (score_pair); run match_1x2 scorer for that market. |

- **Worldcup:** Same idea: global `matches` row = one event (or virtual event), one market result_1x2; submission key = match id.
- **Multi-market future:** Same match event gets a second market e.g. over_under_2_5; submission key = market_id or (event_id, market_code). Result still at event (one score); both markets read it.

### 1B.6 How lottery / chance map

| Current | Event layer | Market layer | Submission / scoring |
|---------|-------------|--------------|------------------------|
| **Lotto** (fixed 6+1) | One **tournament_event** per tournament: event_kind = `lotto_draw`, title e.g. "הגרלה". Or tournament itself is the “draw” and we have one virtual event per tournament. | Two **tournament_markets** under that event: (1) prediction_type_code = `fixed_numbers`, (2) prediction_type_code = `strong_number`. Or one composite market if we keep a single form. | Submission: "numbers" (array of 6), "strongNumber" (1–7). Keys map to the two markets. Result at **tournament** level (lotto_draw_results). Scoring: both markets read same draw; lotto_per_number for fixed_numbers, strong hit bonus for strong_number. |
| **Chance** (4 suits) | One **tournament_event** per tournament: event_kind = `chance_draw`. | One **tournament_market**: prediction_type_code = `hearts` (or `cards`). | Submission: heart, club, diamond, spade. Result at **tournament** level (chance_draw_results). Scoring: chance_per_suit. |

- Lotto/chance can keep fixed structure: one event + one or two markets defined by tournament type, no admin-added events/markets. UI and scoring still resolve through the same event/market taxonomy.

### 1B.7 How custom questions map

| Current | Event layer | Market layer | Submission / scoring |
|---------|-------------|--------------|------------------------|
| **Custom (questions)** | One **tournament_event** per question: event_kind = `question`, title = question text (or question in metadata_json). | One **tournament_market** per question: prediction_type_code = `single_choice` or `multi_choice`, event_id = that question event. Options for the market live in tournament_market_options (see below). | Submission key = market_id (or event_id) → option_id(s). Result at **market** level: correctOptionId. Scoring: single_choice_correct (or multi_choice) for that market. |

- One question = one event + one market. Option list is attached to the market (single_choice / multi_choice).

### 1B.8 How UI builder will generate markets per event

- **Admin flow:** By content group and event kind:
  - **Matches:** List events (matches). For each event, show “משחקים” (event) + “שווקים” (markets). Add event → form: home, away, date, time. Add market → select prediction type (result_1x2, over_under, exact_score, …), optionally set line/options and scoring_config. Reorder markets per event.
  - **Draw (lotto/chance):** One event (draw); markets are fixed (fixed_numbers + strong_number, or hearts). Builder shows read-only “הגרלה” event and its markets; no add/remove markets.
  - **Questions:** List events (questions). Add event → question text. Add market → single_choice (default) or multi_choice; add options to that market. One market per question in typical case.
- **Player UI:** Resolution returns a flat or nested list of “prediction slots”. Each slot = one market (with event context for display). So: “Barcelona vs Real Madrid” (event title) → [ result_1x2 (1/X/2), over_under_2_5 (over/under), … ]. Form generator uses market.prediction_type_code + prediction_input_config to pick component (Toggle12X, over/under selector, etc.). Submission payload: key by market_id (or legacy key) → value per market.

### 1B.9 How scoring engine will resolve markets

- **Inputs:** Tournament, submission (predictions JSON), stored results (event / market / tournament level).
- **Resolution per prediction key:**
  - Resolve key → **market** (and its event). Key can be market_id (explicit), event_id (implicit single-market), or legacy. If key is event_id and event has implicit_single_market = true, treat as one logical market with prediction_type_code and scoring_config from the event. If market_id, load from tournament_markets.
  - Load market’s prediction_type_code and scoring_config from market row (explicit) or event row (implicit single-market).
  - Load **result:** for sports → from event (score_pair); for question → from market (correct_option); for lotto/chance → from tournament-level draw.
  - Select scorer by market’s prediction_type → scoring_model_kind (PART 1A).
  - Compute points: scorer(user_value, result_value, scoring_config). Sum per market (or per tournament for bonuses).
- **Backward compatibility:** Existing submission keys (match id, "numbers", "strongNumber", suit keys) continue to work; resolver maps each to the correct market (explicit or logical from event) and result source so current scoring logic runs unchanged.

---

## PART 1C — Reward / Prize Logic Layer

Scoring computes **points** per market; the **Reward / Prize Logic Layer** defines how those points (and/or monetary stakes) are turned into **rewards** (rankings, payouts, prizes). This layer is first-class so we can support fixed prize pools, lottery-style payout tables, rank-based distribution, and future odds-based betting without hardcoding reward logic in scoring.

### 1C.1 reward_model_kind taxonomy

Reward model defines **how** the prize or pool is distributed to participants. Stored as `reward_model_kind` (code or FK to a reference table) at the level where the reward applies (tournament, event, or market — see 1C.2).

| reward_model_kind | Description | Typical use | Config / inputs |
|-------------------|-------------|-------------|----------------|
| `fixed_prize_pool` | Single prize pool at tournament level; distribution by rank or score. | Football, custom leagues | Pool amount (or fixed list of prizes); rank cutoffs or score thresholds. |
| `dynamic_pool_per_market` | Separate pool or reward logic per market; participant can win per market. | Multi-market contests | Pool per market or % of entry fee per market; per-market payout rules. |
| `payout_table` | Lottery-style: predefined payouts by “hit level” (e.g. 6/6, 5+strong, 5/6). | Lotto, Chance | Table: hit_level → prize amount or share; optional pari-mutuel (pool / winners). |
| `odds_based_reward` | Payout = stake × odds (future betting). Odds can be fixed or dynamic. | Future real-money betting | Odds per outcome; stake per market; settlement = stake × odds if correct. |
| `rank_based_distribution` | Rank 1 gets X, rank 2 gets Y, … (explicit or percentage of pool). | Leaderboards, leagues | Rank → prize or %; or sorted by total score then apply payout table. |
| `hybrid_scoring_monetary` | Points determine rank; monetary prize (or bonus) allocated by rank; or points + separate cash pool. | Promotions, hybrid games | scoring_config (points) + reward_config (prize pool + rank→payout); settlement uses both. |

- **Optional reference table:** `reward_models` (id, code, title_he, description_he, config_schema_kind, settlement_handler_kind, is_active) so new reward types can be added without code deploy. For Phase 1, a code-time enum/const is acceptable.
- **Extensibility:** New kinds (e.g. `tiered_bonus`, `consolation_prize`) add a new code and a settlement handler; config shape is defined per kind.

### 1C.2 Where reward logic lives (tournament / event / market level)

Reward configuration can be attached at one or more levels. The **settlement engine** resolves the effective reward for a participant by level (see 1C.4).

| Level | When to use | Stored in | Example |
|-------|--------------|-----------|---------|
| **Tournament** | One reward model for the whole tournament (e.g. fixed pool, rank-based). | `tournaments.reward_model_kind` + `tournaments.reward_config` (or tournament_reward_config table) | Football: single prize pool; rank 1–3 get fixed amounts. Lotto: payout_table at tournament level. |
| **Event** | Reward specific to an event (e.g. “match of the round” bonus). | `tournament_events.reward_model_kind` + `reward_config` on event | Optional: bonus prize for best predictor on one marquee match. |
| **Market** | Reward per market (e.g. dynamic pool per market, or odds per market in betting). | `tournament_markets.reward_model_kind` + `reward_config` on market | Multi-market contest: each market has its own mini-pool; or future: odds and stake per market. |

- **Default:** If a market (or event) has no reward_model_kind, **inherit from parent**: market → event → tournament. So most tournaments set reward only at **tournament** level; event/market override only when needed.
- **Current behavior:** Existing prize is effectively “tournament level” (e.g. tournaments.prize or similar). Mapping: current prize field = tournament-level reward_config (e.g. fixed_prize_pool with one or more rank-based payouts).

### 1C.3 How reward integrates with scoring

- **Scoring** (PART 1A, 1B): Produces **points** per market (and optionally per event/tournament total). Inputs: submission, results, scoring_config. Output: points per market (and aggregated per participant).
- **Reward** (this layer): Consumes **points** (and optionally stakes, odds) and produces **rewards** (rank, prize amount, bonus). Inputs: participant’s points (and rank), reward_model_kind, reward_config, pool/stakes. Output: per-participant reward (rank, amount, currency, etc.).
- **Flow:**  
  1. **Scoring engine** runs first: for each participant, compute points per market (and total) from submissions + results.  
  2. **Ranking:** Sort participants by total points (or by per-market points if reward is per market).  
  3. **Settlement / reward engine** runs: for each participant (and optionally per market), resolve reward_model_kind and reward_config at tournament → event → market; compute payout/rank; persist to leaderboard and/or payout table.
- **No circular dependency:** Scoring does not depend on reward; reward depends on scoring output (points, rank). So scoring remains pure “did they get it right?”; reward is “what do they get for that?”.

### 1C.4 How settlement engine will resolve reward per market

- **Inputs:** Tournament (and its events/markets), all participants’ submissions, all results, reward config at tournament (and optionally event/market) level.
- **Steps:**  
  1. Run **scoring** for every participant and every market; store or compute **total score** per participant (and optionally per-market score).  
  2. **Rank** participants (e.g. by total score; tie-break by rules if defined).  
  3. For **each participant** (and, if reward is per market, for each market):  
     - Resolve **effective reward config:** market.reward_model_kind ?? event.reward_model_kind ?? tournament.reward_model_kind (first non-null); same for reward_config.  
     - Call **settlement handler** for that reward_model_kind: e.g. `fixed_prize_pool` → look up rank → payout from pool; `payout_table` → determine hit level (e.g. 6/6) → look up prize; `odds_based_reward` → stake × odds if correct.  
     - Write **settlement result:** e.g. participant_id, market_id (if per market), rank, points, reward_amount, reward_currency, status (pending/paid).  
  4. Persist leaderboard and any payout records (existing or new tables).
- **Per-market vs tournament-level:** If reward is only at tournament level (typical today), step 3 runs once per participant using tournament reward config and global rank. If reward is per market, step 3 runs per (participant, market) and may aggregate or display per-market rewards in UI.

### 1C.5 Compatibility with current prize distribution logic

- **Current state:** Tournaments likely have a single “prize” or “prize pool” (e.g. on `tournaments` table or in config). Distribution is often: rank 1 gets X, rank 2 gets Y, or “top N share pool.”
- **Mapping:**  
  - Treat current prize as **tournament-level** reward.  
  - Set `reward_model_kind = fixed_prize_pool` (or `rank_based_distribution`).  
  - Set `reward_config` to the existing structure (e.g. list of rank → amount, or single pool + distribution rule).  
  - **Settlement engine:** When processing a tournament, if reward_model_kind is fixed_prize_pool / rank_based_distribution and reward_config matches current format, use existing prize-distribution code path so behavior is unchanged.  
- **Lotto/Chance:** Current payout tables (e.g. 6/6 → amount, 5+strong → amount) map to `reward_model_kind = payout_table`, reward_config = current payout table; settlement uses hit level from scoring (e.g. lotto_per_number + strong hit) to look up prize.  
- **No breaking change:** Existing prize fields and distribution logic remain valid; they are **described** by reward_model_kind + reward_config and invoked by the settlement engine so that current prize distribution remains compatible.

### 1C.6 Future extensibility for odds and real betting

- **Odds-based reward** is already in the taxonomy (`odds_based_reward`). When we add real betting:  
  - **Market** can carry `reward_model_kind = odds_based_reward`, reward_config = { odds per outcome, currency, max_stake }.  
  - Submission may include **stake** per market (when product allows).  
  - **Settlement:** If prediction is correct, payout = stake × odds (and optionally minus commission); otherwise stake is lost.  
- **Real-money:** Reward layer does not mandate currency; it only defines **how** to compute the reward (points, rank, or amount). When we introduce real money, we add: currency, stake storage, compliance (e.g. balance checks, responsible gambling), and regulatory fields. The same settlement engine can support “points” today and “amount” later by reward_model_kind and config.  
- **Extensibility:** New reward_model_kind values (e.g. `parimutuel`, `spread_betting`) can be added with their own config schema and settlement handler; no change to scoring or event/market structure.

---

### 1.2 Core Tables (new or extended)

#### A. `tournament_content_groups` (new)

Logical grouping of content items per tournament (e.g. "משחקי שלב הבתים", "שאלות ידע", "הגרלה").

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| tournament_id | FK → tournaments | |
| code | text | e.g. `matches`, `questions`, `draw` – used for resolution and UI tabs. |
| title | text | Hebrew title for admin and optional display. |
| description | text | Optional. |
| content_kind | text | `match` \| `question` \| `draw_structure` \| `custom` – drives which editor and resolver to use. |
| sort_order | int | For ordering groups in admin and player. |
| created_at, updated_at | timestamp | |

**Unique:** `(tournament_id, code)`.

#### A2. `prediction_types` (new, optional for Phase 1)

Reference table for the prediction model taxonomy (PART 1A). Can be implemented as a DB table (extensible) or as a code-time enum/const; at least the **taxonomy and codes** must be defined and used consistently.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| code | text, unique | e.g. `result_1x2`, `single_choice`, `fixed_numbers`. |
| family | text | `sports_match` \| `draw_lotto` \| `draw_chance` \| `custom_question`. |
| title_he | text | Hebrew label for admin. |
| input_model_kind | text | e.g. `choice_fixed`, `choice_options`, `numbers_set`. |
| result_model_kind | text | e.g. `score_pair`, `correct_option`, `lotto_draw`. |
| scoring_model_kind | text | e.g. `match_1x2`, `single_choice_correct`, `lotto_per_number`. |
| sort_order | int | For admin dropdowns. |
| is_active | boolean | Default true. |

If this table is omitted in Phase 1, the same taxonomy is enforced in code (const map / enum); `tournament_markets.prediction_type_code` references the code as plain text.

#### B. `tournament_events` (new)

Real-world object: match, draw, or question. Full spec in PART 1B.1 and 1B.1a (implicit single-market).

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| group_id | FK → tournament_content_groups | |
| external_key | text | Optional; legacy match id, etc. |
| event_kind | text | `football_match` \| `basketball_match` \| `tennis_match` \| `lotto_draw` \| `chance_draw` \| `question` \| `question_group` \| `custom`. |
| title | text | e.g. "Barcelona vs Real Madrid", "Question 1". |
| subtitle | text | Optional. |
| sort_order | int | |
| metadata_json | jsonb | home_team, away_team, match_date, question_text, etc. |
| implicit_single_market | boolean | Optional. If true, one logical market; prediction/reward on event; no tournament_markets rows (1B.1a). |
| prediction_type_code | text | When implicit_single_market = true: required. When explicit: unused. |
| prediction_input_config | jsonb | When implicit_single_market = true: config for single market. |
| scoring_config | jsonb | When implicit_single_market = true: optional scoring overrides. |
| status | text | `draft` \| `open` \| `locked` \| `finalized`. |
| reward_model_kind | text | Optional. Override for reward at event level (PART 1C). When implicit single market, applies to that market. |
| reward_config | jsonb | Optional. Config for reward at event level (e.g. bonus for “match of the round”). |
| created_at, updated_at | timestamp | |

**Indexes:** `(group_id)`, `(group_id, sort_order)`.

#### C. `tournament_markets` (new)

Prediction opportunity under an event; prediction type and scoring at **market** level. Not used when event has implicit_single_market = true (single market is logical from event). Full spec in PART 1B.2.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| event_id | FK → tournament_events | |
| prediction_type_code | text | **Required.** From PART 1A taxonomy. |
| market_code | text | Optional; e.g. `result_1x2`, `over_under_2_5`. |
| title_he | text | Optional display override. |
| sort_order | int | |
| prediction_input_config | jsonb | Conforms to prediction_type. |
| scoring_config | jsonb | Optional; scoring tied to market. |
| reward_model_kind | text | Optional. Override for reward at market level (PART 1C). Null = inherit from event or tournament. |
| reward_config | jsonb | Optional. Config for reward at market level (e.g. pool share, odds for future betting). |
| status | text | `draft` \| `open` \| `locked` \| `finalized`. |
| created_at, updated_at | timestamp | |

**Indexes:** `(event_id)`, `(event_id, sort_order)`, `(prediction_type_code)`.

#### D. `tournament_market_options` (new)

Answer options for markets that use choice from a list (single_choice, multi_choice). Replaces the former “content options” and is attached to **market**, not event.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| market_id | FK → tournament_markets | Nullable when event_id set (implicit single-market options). |
| event_id | FK → tournament_events | Optional. When set and market_id null, options apply to event implicit single market. |
| option_key | text | e.g. `1`, `X`, `2` or `A`,`B`,`C` – value stored in submission. |
| label | text | Hebrew label for display. |
| sort_order | int | |
| is_correct | boolean | Set when result is finalized (market-level result). |
| points | int | Optional override per option. |
| created_at, updated_at | timestamp | |

**Constraint:** Exactly one of market_id or event_id must be set (explicit market vs implicit single-market options).

#### E. Results: event-level, market-level, tournament-level

**Event-level result** (e.g. match score — one result drives all markets of that event):

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| event_id | FK → tournament_events | |
| result_json | jsonb | e.g. `{ "homeScore": 2, "awayScore": 1 }`. |
| finalized_at | timestamp | |
| updated_by | FK → users | |
| created_at, updated_at | timestamp | |

**Market-level result** (e.g. correct answer for a question market):

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| market_id | FK → tournament_markets | |
| result_json | jsonb | e.g. `{ "correctOptionId": 3 }`. |
| finalized_at | timestamp | |
| updated_by | FK → users | |
| created_at, updated_at | timestamp | |

**Tournament-level result** (draw): keep existing `lotto_draw_results`, `chance_draw_results`; or add a generic `tournament_draw_results` if we unify. No change to current draw result tables for Phase 1.

#### F. `tournament_participant_entities` (new, optional for Phase 1)

Teams / players / sides – reusable labels for match builders.

| Column | Type | Description |
|--------|------|-------------|
| id | PK | |
| tournament_id | FK | Optional; null = global pool. |
| entity_type | text | `team` \| `player` \| `side`. |
| name | text | Display name. |
| short_name | text | Optional. |
| external_key | text | Optional (e.g. API id). |
| created_at, updated_at | timestamp | |

Use in `tournament_events.metadata_json` as `home_entity_id` / `away_entity_id` or store names inline for MVP.

### 1.3 Mapping to Current Tables

- **Football (worldcup):** Continue to use global `matches`; no change or add a content_group that "points" to legacy worldcup (sourceType=legacy). No new rows in tournament_events/tournament_markets for worldcup unless we migrate.
- **Football custom:** Option A – Keep `custom_football_matches`; add one content_group per tournament with code `matches`, and either (1) sync from custom_football_matches into tournament_events + tournament_markets (one event per match, one market result_1x2 per event) for unified resolution, or (2) resolve custom football from custom_football_matches as today and add a separate "ניהול תוכן" that edits custom_football_matches. Option B – Migrate custom football to tournament_content_groups + tournament_events + tournament_markets and deprecate custom_football_matches. **Recommendation:** Option A (2) for Phase 1 – reuse custom_football_matches, add content group that "wraps" it in UI; later migrate to Option B if desired.
- **Lotto / Chance:** Add content_group with code `draw`, content_kind `draw_structure`. One tournament_event per tournament (event_kind = lotto_draw or chance_draw); one or two tournament_markets under that event (fixed_numbers, strong_number for lotto; hearts for chance). Results stay in `lotto_draw_results` / `chance_draw_results` (tournament-level).
- **Custom (questions):** Use tournament_content_groups + tournament_events (event_kind=question) + tournament_markets (one market per question, prediction_type single_choice/multi_choice) + tournament_market_options. New tables only.

### 1.4 Tournament Shell Addition

Add to `tournaments` (or equivalent):

- `content_status` — `empty` \| `draft` \| `ready` \| `finalized`. Admin sets `ready` when content is complete; validation can block moving to OPEN/LOCKED if `content_status != ready` and type requires content.
- Optional: `content_version` (int) for cache busting / audit.
- **Reward / prize layer (PART 1C):**  
  - `reward_model_kind` — text (e.g. `fixed_prize_pool`, `rank_based_distribution`, `payout_table`, `dynamic_pool_per_market`, `odds_based_reward`, `hybrid_scoring_monetary`). Default at tournament level; can be overridden at event or market level.  
  - `reward_config` — jsonb. Shape depends on reward_model_kind (e.g. pool amount + rank→payout, or payout table by hit level). Optional at event/market if reward is only at tournament level.

---

## PART 2 — Admin UX Flow

### 2.1 Entry Point

- In admin tournament list (and in tournament detail if exists), add a single clear action per tournament:
  - **"ניהול תוכן"** or **"משחקים / שאלות / תוצאות"**
- Action opens a **dedicated content management flow** (page or modal):
  - If modal: large modal or full-screen overlay with steps/tabs.
  - If page: e.g. `/admin/tournaments/:id/content`.

### 2.2 Content Management Flow (single flow, type-adaptive)

1. **Header:** Tournament name + type; breadcrumb "ניהול תוכן".
2. **Content status banner:** Shows content_status (empty / draft / ready / finalized); if empty or draft, show CTA "השלם תוכן" or "סמן מוכן לפרסום".
3. **Tabs or sections by content group:**
   - Football/sports: one tab "משחקים" (matches).
   - Custom: one tab "שאלות" (questions).
   - Lotto/Chance: one tab "הגרלה / תוצאות" (read-only structure + link to result entry).
4. **Per-tab actions:** Add item, Edit item, Delete item, Reorder (drag or up/down). Publish/Save saves all pending changes.
5. **Result entry:** Separate sub-view or tab "תוצאות" – for matches: score per match; for lotto/chance: existing result screens; for questions: set correct answer.
6. **Validation before publish:** If validation fails (e.g. missing required fields, no items), show errors and block "סמן מוכן" until fixed.

### 2.3 Type-Specific Editors (see Part 3)

Editors are embedded in the same flow; only the active tab and form fields change by type.

---

## PART 3 — Type-Specific Content Editing

### 3.1 Football / Sports (match-based)

- **Group:** One group, code `matches`, content_kind `match`.
- **Events:** One **event** per match (tournament_events: event_kind = football_match, title = home vs away, metadata = home_team, away_team, date, time).
- **Markets per event — two modes:** (1) **Implicit single-market:** Set implicit_single_market = true on the event and prediction_type_code = result_1x2 (and optional configs) on the event; no market rows. Simpler, faster creation. (2) **Explicit:** Add one or more **markets** per match in tournament_markets (result_1x2, over_under, exact_score, etc.). Use explicit when multiple markets per match are needed.
- **List:** Table or cards: בית, חוץ, תאריך, שעה, שווקים (markets), תוצאה סופית, סטטוס.
- **Add/Edit event form (Hebrew):** בית (home team), חוץ (away team), תאריך, שעה. **Add/Edit markets:** For this event, add market(s): select prediction type (1/X/2, מעל/מתחת, תוצאה מדויקת), set line/config and scoring_config.
- **Result:** Stored at **event** level (homeScore, awayScore); all markets of that event derive from it. Editable until finalized.
- **Reorder:** sort_order on events; sort_order on markets within event.
- **Delete:** Soft or hard with confirmation; ensure no submissions reference the event/markets or handle gracefully.

### 3.2 Basketball / Tennis

- Same as football (event = match, markets per event) but:
  - Event: event_kind = basketball_match / tennis_match; labels "צד א", "צד ב" or "שחקן/קבוצה A", "שחקן/קבוצה B" in metadata.
  - Markets: prediction_type_code = winner_only, sets, points_range, etc.; prediction_input_config and scoring_config per market.
- Result at event level (winner_id or score/sets structure); markets derive from it.

### 3.3 Lottery / Chance

- **One event per tournament** (event_kind = lotto_draw or chance_draw); **markets** fixed: lotto = fixed_numbers + strong_number, chance = hearts. No add/remove events or markets.
- **Tab "הגרלה / תוצאות":**
  - Short explanation: "מבנה ההגרלה קבוע. הזן תאריך ושעת הגרלה בתחרות, ואחרי הסגירה עדכן תוצאות כאן."
  - Link or embed existing result entry (lotto: 6+1, chance: 4 suits). Result at **tournament** level (lotto_draw_results / chance_draw_results).
- **Content group:** One group `draw`, content_kind `draw_structure`; one event "הגרלה" and its markets for display/status only.

### 3.4 Custom (questions)

- **Group:** code `questions`, content_kind `question`.
- **Events:** One **event** per question (event_kind = question, title or metadata = question text).
- **Markets — two modes:** (1) **Implicit single-market:** Set implicit_single_market = true and prediction_type_code = single_choice or multi_choice on the event; options in tournament_market_options with event_id set (market_id null). (2) **Explicit:** One **market** per question in tournament_markets; options in tournament_market_options (market_id).
- **List:** Question text, answer type, number of options, correct answer (if set), points, order.
- **Add/Edit form:** שאלה (question text) → event; סוג תשובה (single_choice / multi_choice) → market; אפשרויות תשובה → tournament_market_options for that market; תשובה נכונה (optional until result) – pick one option; נקודות in scoring_config; סדר (sort_order).
- **Result:** At **market** level: correct_option_id when finalizing.

---

## PART 4 — Player-Facing Rendering

### 4.1 Strategy

- **Single resolution path:** For a given tournament, resolve **events** and **markets** to display from (in order):
  1. New content layer: `tournament_content_groups` + `tournament_events` + `tournament_markets` (+ options per market or per event when implicit) for that tournament.
  2. Legacy: existing `matches`, `custom_football_matches`, lotto/chance (map to one event + one or two markets; form schema fixed).
- **Both modes supported:** For each event, if `implicit_single_market = true` the resolver yields **one logical market** from the event (key = event_id; prediction_type_code and config from event). If false or null, resolver yields markets from `tournament_markets` for that event (key = market_id). Player form and submission contract are unchanged; key is either market_id or event_id.
- **Existing API:** Keep `getResolvedFormSchema` and `resolveTournamentItems`; extend resolution so that:
  - If tournament has content_groups with events/markets, resolve from new tables and return a **flat or nested list of markets** (each with event context for display). Each resolved "slot" = one market (prediction_type_code, prediction_input_config, options); event supplies title, metadata. optionSchema/resultSchema can be derived from market for backward compatibility.
  - Else fall back to legacy; resolver builds logical event(s) + market(s) (e.g. one event per match, one market result_1x2 per event; or one draw event + fixed_numbers + strong_number markets) and attaches prediction_type_code so UI and scoring use the same taxonomy.
- **Rendering:** DynamicPredictionForm receives formSchema + list of prediction slots (each = market + event context). Each slot supplies **prediction_type_code** and prediction_input_config so the form can choose the right component; event title/subtitle used for display (e.g. "Barcelona vs Real Madrid" → markets result_1x2, over_under_2_5).

### 4.2 Submission Payload

- Predictions still stored in `submissions.predictions` (JSON).
- **Keying:** By **market_id** (new content) or by legacy key (match id, or "numbers"/"strongNumber", or suit keys) so resolution and scoring can map back to the correct market. Ensure backend submission validation accepts keys from resolved markets (new or legacy).

### 4.3 When Content Is Missing

- **Admin:** In content management flow, show banner "תוכן לא מלא – הוסף משחקים/שאלות לפי סוג התחרות." List required content by type (e.g. "לפחות משחק אחד", "לפחות שאלה אחת עם אפשרויות").
- **Player:** If tournament is OPEN but content is empty or not ready:
  - Option A: Do not show tournament on public list, or show with "לא זמין כרגע".
  - Option B: Show tournament but prediction form shows "תוכן בתהליך הכנה" and disable submit.
- **Recommendation:** Option A when content_status != ready; Option B as fallback if we allow OPEN without content temporarily.

---

## PART 5 — Safety and Lifecycle

### 5.1 Validation Rules

- **By type (before content_status = ready):**
  - Football/sports: At least one **event** (match); each event has home, away, date, time. Either (implicit) event has implicit_single_market = true and prediction_type_code set, or (explicit) at least one **market** per event with valid prediction_input_config.
  - Custom: At least one **event** (question). Either (implicit) event has implicit_single_market = true, prediction_type single_choice/multi_choice, and at least one option (event_id in tournament_market_options), or (explicit) one market per event with options; correct answer can be set later.
  - Lotto/Chance: One draw event and its fixed markets; only draw date/time on tournament and later result entry.
- **Schema checks:** prediction_input_config on each **market** must conform to that market’s prediction_type_code (validated on save).

### 5.2 Publishing / Opening

- Prevent setting tournament status to OPEN (or LOCKED) if content_status is not `ready` when the type requires content (football, football_custom, custom). Lotto/chance can be OPEN once draw date/time is set.
- Admin action "סמן תוכן מוכן" sets content_status = ready and runs validation; on failure show errors.

### 5.3 Locking / Finalizing

- When tournament status becomes LOCKED or CLOSED:
  - Content items can be set to `locked`; no more add/delete/reorder for that group.
  - Result entry still allowed until "תוצאות סופיות" (resultsFinalizedAt or equivalent).
- After results finalized:
  - Result updates only via dedicated "תיקון תוצאות" with audit (optional Phase 2).
  - Content structure (matches/questions) no longer editable.

### 5.4 Result Updates, Scoring, and Settlement

- **Event-level results** (e.g. match score): stored in tournament_event_results or existing custom_football_matches. Scoring engine resolves each **market** of that event and reads the event result; runs the scorer for that market’s prediction_type.
- **Market-level results** (e.g. correct option for question): stored in tournament_market_results.
- **Tournament-level results** (draw): Keep using lotto_draw_results and chance_draw_results; ensure content flow does not duplicate or conflict with these tables.
- **Settlement / reward (PART 1C):** After results are finalized and scoring has run, the **settlement engine** uses reward_model_kind and reward_config (at tournament, then event/market override) to compute rank and payouts; persist leaderboard and any payout records. Current prize distribution logic maps to tournament-level reward (e.g. fixed_prize_pool or payout_table).

---

## PART 6 — Architecture Requirements (Recap)

- No hacks: new content layer is first-class; legacy remains until migrated.
- No fake data: all content from DB or explicit "no content" state.
- TypeScript: strict types for new tables and resolvers.
- RTL/Hebrew: all new admin strings in Hebrew.
- Current tournament creation flow unchanged; content management is an additional flow after create.
- Scalable: new sport or question type = new item_kind + metadata/option/result schema, not new tables.

---

## PART 7 — Implementation Plan in Phases

### Phase 1 — Schema and content status (foundation)

- Define **prediction model taxonomy** in code (const/enum) or add `prediction_types` table with canonical codes and model kinds (PART 1A).
- Add **Event & Market layer** (PART 1B): `tournament_content_groups`, `tournament_events`, `tournament_markets`, `tournament_market_options`; event-level and market-level result tables (or equivalent); keep tournament-level draw results (lotto/chance) as-is.
- Add `content_status` (and optional `content_version`) to `tournaments`.
- Migrations: create tables; backfill content_status for existing tournaments (e.g. football_custom with custom_football_matches → content_status = ready; lotto/chance → ready when draw set; rest empty or draft).
- No UI yet; only DB and one or two server APIs to create/read groups, events, and markets (for testing).

### Phase 2 — Admin entry and content shell UI

- Add "ניהול תוכן" (or "משחקים / שאלות / תוצאות") action to admin tournament list/detail.
- Open content management page/modal: header, content_status banner, tabs by type (matches / questions / draw). For football custom, tab "משחקים" can still use existing custom_football_matches CRUD under the hood (no migration yet); present as events (one per match) with one implied market (result_1x2) per event.
- Implement "משחקים" tab for football_custom: reuse existing getCustomFootballMatches / add / update / delete / reorder; show in new layout with unified header and status.
- Optional: Add one content_group per tournament (code `matches`) and sync custom_football_matches into tournament_events + tournament_markets read path so resolution can later switch to new tables.

### Phase 3 — Type-specific editors

- Football/sports: **Event** builder (בית, חוץ, תאריך, שעה) + **market** builder per event (add markets: result_1x2, over_under, etc.; set prediction_input_config, scoring_config); persist to custom_football_matches or to tournament_events + tournament_markets (if migrated).
- Custom: **Event** (question) + **market** (single_choice/multi_choice) + options; persist to tournament_events + tournament_markets + tournament_market_options.
- Lotto/Chance: Tab with explanation and link to existing result screens; one draw event + fixed markets, content_status and UX consistency.

### Phase 4 — Resolution and player rendering

- Extend resolveTournamentItems (or equivalent) to prefer new content layer when tournament has content_groups with events/markets; return resolved **markets** (with event context) in same shape as today for backward compatibility (each slot = one market; key = market_id or legacy key).
- Ensure getResolvedFormSchema and submission validation accept keys from resolved markets (market_id or legacy match id / draw keys).
- DynamicPredictionForm: receive list of markets (with event title); render one form block per market using prediction_type_code; test football custom, lotto, chance, and custom (questions) on player side.
- When content_status != ready and type requires content: hide tournament from public list or show "לא זמין" and disable submit.

### Phase 5 — Validation and lifecycle

- Validation: by type, require minimum content before content_status = ready; block OPEN when content_status not ready (for types that need content).
- Lock content when tournament locks; restrict result edits after finalized; add audit where needed.

### Phase 6 — Optional enhancements

- Migrate football custom from custom_football_matches to tournament_events + tournament_markets fully; deprecate custom_football_matches.
- tournament_participant_entities for team/player picker in event (match) builder.
- Basketball/tennis specific metadata and multiple markets per event (winner_only, sets, points_range).
- "תיקון תוצאות" with audit log after finalization.
- **Reward / settlement:** Implement settlement engine that reads reward_model_kind and reward_config (PART 1C); run after scoring; support fixed_prize_pool, rank_based_distribution, payout_table (lotto/chance); optional event/market-level reward overrides. Future: odds_based_reward, dynamic_pool_per_market, hybrid.

---

## Deliverables Summary

| # | Deliverable | Description |
|---|-------------|-------------|
| 1 | **Proposed DB/schema design** | Above: prediction_types (optional), tournament_content_groups, **tournament_events**, **tournament_markets**, tournament_market_options, event-level and market-level result tables, optional tournament_participant_entities; content_status and **reward_model_kind / reward_config** on tournaments (and optional on events/markets); PART 1.2, PART 1B, PART 1C. |
| 1A | **Prediction model (first-class)** | Taxonomy of prediction_type, input_model, result_model, scoring_model; prediction type at **market** level; scoring and UI form generation driven by market’s prediction type; migration compatibility (PART 1A). |
| 1B | **Event & Market layer** | Clear separation: Event → Market → Prediction. tournament_events, tournament_markets; **implicit single-market** option (event may have exactly one logical market, no market row; prediction_type and reward at event level); resolution supports both modes; UI builder supports simple (implicit) and advanced (explicit) flows (PART 1B, 1B.1a). |
| 1C | **Reward / Prize logic layer** | reward_model_kind taxonomy (fixed_prize_pool, dynamic_pool_per_market, payout_table, odds_based_reward, rank_based_distribution, hybrid); reward at tournament / event / market level; integration with scoring; settlement engine resolves reward per market; compatibility with current prize distribution; extensibility for odds and real betting (PART 1C). |
| 2 | **Admin UX flow** | Single "ניהול תוכן" entry → content management with events + markets per tab (משחקים / שאלות / הגרלה), add/edit events and markets, publish/save, result entry at event or market or tournament level. |
| 3 | **Player rendering strategy** | Resolve events + markets from new content layer when present, else legacy; return list of markets (with event context); form generation keyed by market’s prediction_type_code; submission keyed by market_id or legacy key. |
| 4 | **Validation rules** | By-type content requirements (events + markets); content_status = ready only when valid; block OPEN when content required but not ready; lock content with tournament. |
| 5 | **Implementation plan** | Six phases: (1) schema + event/market layer + content_status, (2) admin entry + shell UI + football custom, (3) type-specific editors (events + markets), (4) resolution + player rendering, (5) validation + lifecycle, (6) optional migration and extras. |

---

**Next step:** Review and approve this design; then implement Phase 1 and proceed phase by phase.
