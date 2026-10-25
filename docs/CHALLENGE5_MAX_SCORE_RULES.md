# [Challenge 5] Celebration & Event Planner — Rules for a Maximum Score

> **Challenge:** Create a GenAI-powered planning assistant that helps users organize
> weddings, birthdays, and community events with budgets, timelines, vendor checklists,
> and personalized ideas.

This document is the single source of truth for how your submission is scored and what
you must do **before you begin**, so that you land in the top tier of every evaluation
parameter.

---

## 1. Before You Begin

Complete these prerequisites first:

- [ ] The AI platform you are going to use is downloaded and set up on your system
- [ ] Git is installed and configured (`git config user.name` / `user.email`)
- [ ] You have an active GitHub account
- [ ] You are able to create and manage **public** repositories

---

## 2. Important Rules

Failure to follow these rules may result in your submission not being evaluated.

| #   | Rule       | Requirement                                   |
| --- | ---------- | --------------------------------------------- |
| 1   | Attempts   | **Maximum 3 attempts** allowed                |
| 2   | Repo size  | Must be **less than 10 MB**                   |
| 3   | Visibility | GitHub repository must be **public**          |
| 4   | Branching  | Repository should contain **only one branch** |

Practical notes to stay compliant:

- Commit only source code. Exclude `node_modules`, `.venv`, build artifacts, model files,
  videos, and large images via `.gitignore`.
- Never commit secrets (API keys, tokens, `.env`) — this also protects your Security score.
- Do not create extra branches, tags, or forks for the submission.

---

## 3. Challenge Expectations

Your solution should demonstrate:

- Ability to build a **smart, dynamic assistant**
- **Logical decision making** based on user context (budget, guest count, event type, date)
- **Practical and real-world usability**
- **Clean and maintainable code**

Participants must choose **one of the provided challenge verticals** and design their
solution around that persona and logic. For this challenge, the vertical is the
**Celebration & Event Planner** persona (weddings, birthdays, community events).

---

## 4. How to Work on Your Project

1. Create a new repository on GitHub.
2. Ensure the repository is set to **public**.
3. Open your AI platform.
4. Clone your repository inside the AI platform.
5. Build your solution through prompting and coding.
6. Regularly **commit and push** your progress (progress history is reviewed).
7. Keep all work within a **single branch**.

---

## 5. What to Submit

> For a detailed guide on how to submit, refer to the submission document (Link).

Your submission must include:

- [ ] A **public GitHub repository link**
- [ ] **Complete project code** inside the repository
- [ ] A **README** explaining:
  - [ ] Your chosen vertical
  - [ ] Approach and logic
  - [ ] How the solution works
  - [ ] Any assumptions made

---

## 6. How Your Work Is Evaluated — Impact Tiers

> **Important: all six evaluation parameters are HIGH IMPACT.** They are the core of your
> score — doing great in each heavily drives a high overall result, and missing points in
> **any** of them will drastically lower your standing. There is no "minor" parameter to
> skip.

| Tier                 | Weight of your score                  | Meaning                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **High Impact**   | Drives most of the final score        | **All six evaluation parameters below fall into this tier:** Code Quality, Security, Efficiency, Testing, Accessibility, Problem Statement Alignment. The most important parts of your project — do great here and your score is high; miss here and your standing drops drastically. |
| 🟡 **Medium Impact** | Steadily elevates / moderately lowers | Supporting work that checks how well the solution holds up under the surface: repo hygiene, commit history quality, documentation depth, deployment/run instructions. A miss **moderately lowers** your score.                                                                        |
| 🟢 **Low Impact**    | Small boost / polish                  | Final layers of polish (screenshots/GIFs, animations, extra exports). Excelling gives only a small boost, but you still need them for a **perfect score**.                                                                                                                            |

**Bottom line:** treat every one of the six parameters as mandatory high-impact work.
Balance your effort across **all six** — a perfect score requires each of them, not just
the ones you enjoy building.

---

## 7. Maximum-Score Rules per Parameter

> All **six** parameters below are **high impact** — each one directly shapes your final
> score. The rules inside each section are what "doing great" looks like; the checklist at
> the end of each section is the minimum bar.

### 🔴 Code Quality — _High Impact_

**Goal:** structure, readability, maintainability.

- **Clear project structure.** Separate concerns:
  `routes/controllers` → `services (LLM + business logic)` → `lib/utils` → `data` → `ui/components`.
  No "everything in one file" solutions.
- **Readable naming.** Descriptive function/variable names
  (`buildTimeline(eventType, budget)`, not `fn1()` / `data2`).
- **Modular GenAI logic.** Prompt construction, model calls, and response parsing live in
  their own module with **versioned/system prompts** clearly separated from user input.
- **Consistent style.** Linter + formatter configured (ESLint/Prettier, Ruff/Black, etc.)
  and the code passes cleanly. No commented-out dead code, no `console.log` debugging left in.
- **Configuration over hardcoding.** Event templates, budget bands, and vendor categories
  live in config/data files (JSON/TS constants), not scattered through the code.
- **Documentation.** Every non-obvious module has a short doc comment; the README contains
  setup, architecture, and a "how it works" flow diagram or walkthrough.
- **Error handling.** Graceful fallbacks (e.g., LLM timeout → cached template plan) instead
  of crashes or empty screens.

**Checklist:** Can a reviewer open any file and understand it in < 2 minutes? Is the
prompt logic isolated? Does the repo show incremental, sensible commits?

---

### 🔴 Security — _High Impact_

**Goal:** safe and responsible implementation.

- **Never expose secrets.** API keys live in environment variables only; ship a redacted
  `.env.example`. Never commit `.env`. Never hardcode keys in client-side code.
- **Server-side key custody.** LLM API calls happen on the backend/server — the browser
  never sees the provider key.
- **Input validation & sanitization.** Validate and sanitize every user input before it is
  interpolated into a prompt (**prompt-injection resistance**: delimit user content, instruct
  the model to ignore embedded instructions, cap input length).
- **Output handling.** Render model output as text/markdown with escaping — no raw
  `dangerouslySetInnerHTML`/`innerHTML` from LLM responses (XSS prevention).
- **Auth & data protection.** If you store users/events, require authentication; hash/never
  log PII; protect API routes with rate limiting and ownership checks.
- **Responsible AI.** No collection of unnecessary personal data; document how user data
  and prompt content are handled; add a disclaimer for vendor/pricing suggestions.
- **Dependencies.** No known-vulnerable packages; lockfile committed.

**Checklist:** Could a reviewer find a single secret in git history? Can a malicious input
break out of the prompt or the DOM?

---

### 🔴 Problem Statement Alignment — _High Impact_

**Goal:** relevance to the stated problem. This is where most submissions quietly fail.

The prompt requires a **GenAI-powered planning assistant** for **weddings, birthdays, and
community events** with **budgets, timelines, vendor checklists, and personalized ideas**.
All six elements must be visibly present:

- [ ] **GenAI-powered** — a real LLM is called to generate content (not just canned templates).
      At least one genuinely generative feature: personalized theme ideas, itinerary drafting,
      budget-saving tips, vendor shortlist rationale.
- [ ] **Assistant behavior** — conversational, follows up on user context
      (event type, date, guest count, budget, location, preferences) rather than a static form.
- [ ] **Budgets** — budget input, allocation across categories (venue, catering, décor,
      entertainment…), and a running total/variance indicator.
- [ ] **Timelines** — generated countdown / task schedule from the event date backwards
      (e.g., "book venue 6 months out", "send invites 3 weeks out").
- [ ] **Vendor checklists** — checkable vendor/task lists per event type, with what to ask
      and documents to collect.
- [ ] **Personalized ideas** — suggestions change with user context (budget tier, guest
      count, event vertical, cultural/theme preferences).
- [ ] **All three verticals** supported: **weddings, birthdays, and community events** —
      each with distinct templates, ideas, and timeline defaults.
- [ ] **Logical decision making based on user context** — explicit rules engine or prompt
      conditioning (e.g., budget < X → DIY ideas; outdoor wedding → rain-plan tasks).
- [ ] **Real-world usability** — a usable end-to-end flow: input → plan → edit/track →
      export/copy (export to Markdown/PDF/CSV is a strong plus).

**Checklist:** Cover the README's "Approach and logic" section with each of the six
required features and point to the file/section that implements it.

---

### 🔴 Efficiency — _High Impact_

**Goal:** optimal use of resources. A high-impact parameter — resource waste and sluggish
behavior directly lower your standing.

- **Minimal token usage.** Send only needed context to the LLM; cap prompt/response length;
  avoid re-sending the entire conversation every turn (trim/summarize history).
- **Caching.** Cache static/template content and repeated generations (event templates,
  category taxonomies) — do not re-call the model for identical requests.
- **Debounce & batch.** Debounce streaming UI requests; do not fire an LLM call per keystroke;
  batch parallel work sensibly.
- **Perceived performance.** Show streaming output or loading skeletons; keep first render fast.
- **No runaway loops.** Guard retries with backoff + max attempts; handle model timeouts.
- **Lean repo & runtime.** Repo < 10 MB; no heavy unnecessary dependencies; avoid fetching
  large assets; paginate long lists (vendors, checklist items).
- **Reasonable model choice.** Use an appropriately sized/fast model for simple tasks and
  reserve expensive calls for complex generation.

**Checklist:** How many LLM calls does one planning session take? What is re-fetched that
could be cached?

---

### 🔴 Testing — _High Impact_

**Goal:** validation of functionality. A high-impact parameter — an untested solution is
considered unvalidated and scores poorly no matter how good it looks.

- **Automated tests exist and pass.** At minimum: unit tests for the core logic
  (budget allocation, timeline generation, checklist builder, prompt builder) and
  integration tests for the main API/route.
- **LLM-layer tests without burning tokens.** Mock/stub the model provider; assert that
  prompts are built correctly and responses are parsed robustly (including malformed output).
- **Edge cases covered:** zero/oversized budget, event date in the past, very large guest
  counts, empty user input, provider failure (fallback path).
- **Documented test run.** README shows the exact command to run tests and the expected
  output/CI badge.
- **Manual QA notes.** A short "tested scenarios" section (three verticals × budget tiers).

**Checklist:** Does `npm test` / `pytest` work out of the box after clone? Do tests fail
loudly when logic breaks?

---

### 🔴 Accessibility — _High Impact_

**Goal:** inclusive and usable design. A high-impact parameter — an assistant only a few
people can use is not a usable solution; missing accessibility drastically lowers your score.

- **Semantic HTML.** Proper landmarks (`header/nav/main`), heading hierarchy, real
  `<button>`/`<label>` elements — not clickable `<div>`s.
- **Keyboard operable.** Full flow usable with Tab/Enter/Space/Esc; visible focus indicators;
  no keyboard traps in modals/chat input.
- **Screen-reader friendly.** ARIA only where needed; chat responses announced
  (`aria-live="polite"`); icon-only buttons have accessible names; images have alt text.
- **Color & contrast.** WCAG AA contrast (≥ 4.5:1 text); never convey state by color alone
  (budget overruns also get text/icon).
- **Responsive & zoomable.** Works at 320 px width and at 200% zoom; usable on mobile.
- **Motion & clarity.** Respect `prefers-reduced-motion`; clear labels and helper text on
  all inputs; sensible error messages.
- **Form accessibility.** Every input has a label, inline validation messages are associated
  with inputs, required fields are announced.

**Checklist:** Run an automated pass (Lighthouse / axe) with no serious/critical issues,
then do one manual keyboard-only run of the core flow.

---

### 🟢 README & Submission Polish — _Low Impact_ (required for a perfect score)

- README states: **chosen vertical → approach and logic → how it works → assumptions**.
- Quick-start with exact commands (install, env setup, run, test).
- Screenshots/GIF of the working assistant (keep files small — repo must stay < 10 MB).
- Clear list of assumptions and known limitations.
- Single branch, public repo, complete code, no secrets in history.

---

## 8. Suggested Work Order (maximizes score per attempt)

Because only **3 attempts** are allowed and **all six parameters are high impact**,
build in this order — but treat steps 1–6 as mandatory, equally weighted work:

1. **Problem Statement Alignment (🔴):** implement all six required features across all three verticals.
2. **Code Quality (🔴):** clean structure, separated prompt logic, docs, error handling.
3. **Security (🔴):** env-based keys, server-side calls, input sanitization, no secrets in git.
4. **Efficiency (🔴):** caching, capped tokens, debounced requests, fast first render.
5. **Testing (🔴):** unit + integration + mocked-LLM tests, edge cases, documented run.
6. **Accessibility (🔴):** semantics, keyboard, ARIA, contrast, responsiveness.
7. **README polish (🟢):** screenshots, quick-start, assumptions — then push final commit.

> **Do not trade one high-impact parameter for another.** A submission with perfect code
> but no tests, or great tests but poor accessibility, will lose points in _both_ areas —
> and every one of the six is high impact.

> **Final pre-submission gate**
>
> - [ ] Repo is **public**, **single branch**, **< 10 MB**, no secrets anywhere in history
> - [ ] Tests pass with one documented command
> - [ ] All 6 evaluation parameters have a corresponding README section or code artifact
> - [ ] End-to-end demo works: wedding, birthday, and community event plans generated
> - [ ] Attempts used: ≤ 3
