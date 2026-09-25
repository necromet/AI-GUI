# If/Else Node UX Plan

## Connect-first branching, string conditions, no JavaScript required

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State](#2-current-state)
3. [Problems](#3-problems)
4. [Goals](#4-goals)
5. [Recommendation — How True/False Should Work](#5-recommendation--how-truefalse-should-work)
6. [UX Design](#6-ux-design)
7. [Data Model](#7-data-model)
8. [Condition Evaluation](#8-condition-evaluation)
9. [Implementation Phases](#9-implementation-phases)
10. [File Manifest](#10-file-manifest)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Executive Summary

Users should be able to branch workflows **without writing JavaScript**.

Three interaction levels, from simplest to most powerful:

| # | Mode | User does | Writes code? |
|---|------|-----------|--------------|
| 1 | **Connect branches** | Drag from **T** / **F** handles to next nodes | No |
| 2 | **Fill-in-the-blank** | Set `lastOutput` **contains** `"error"` via form fields | No |
| 3 | **Expression (advanced)** | Optional Monaco JS for complex logic | Yes (optional) |

**Core principle:** wiring the graph is always allowed and never blocked by the condition. The condition only decides *which* connected path runs.

---

## 2. Current State

### What exists

| Piece | Location | Notes |
|-------|----------|-------|
| Node type | `constants.ts` → `NODE_DEFS['if-else']` | defaults `{ condition: '' }` |
| Handles | `CustomNode.tsx:197-202` | `sourceHandle` `if` (T) and `else` (F) already present |
| Config UI | `nodes/IfElseNodeConfig.tsx` | **Monaco JS only** |
| Executor | `open-agent-builder/lib/workflow/executors/logic.ts` | `new Function(... return ${conditionExpr})` |
| LangGraph router | `open-agent-builder/lib/workflow/langgraph.ts:562-609` | same JS eval |
| Validation | `open-agent-builder/lib/workflow/validation.ts:79-87` | hard error if condition empty |
| Edge labels | `types.ts` `WorkflowEdge.label` | field exists, unused for if/else |
| Branch metadata | `types.ts` `NodeData.truePath/falsePath/trueLabel/falseLabel` | **declared but never used** |

### Current condition UX

```
┌─ If/Else settings ─────────────────────────────┐
│ Condition (JavaScript)                         │
│ ┌────────────────────────────────────────────┐ │
│ │ lastOutput.toLowerCase().includes("pass")  │ │  ← Monaco, code required
│ └────────────────────────────────────────────┘ │
│ Output Branches: T / F legend                  │
└────────────────────────────────────────────────┘
```

Example template condition (from `04-advanced-workflow.ts`):

```js
lastOutput.toLowerCase().includes("pass")
```

---

## 3. Problems

1. **JavaScript gate** — non-technical users cannot branch at all; empty condition = validation error.
2. **Connect ≠ configure** — users can drag T/F edges, but validation still demands a JS string first.
3. **No simple equals/contains UI** — 90% of conditions are `X contains/equals Y`; Monaco is overkill.
4. **`truePath` / `falsePath` unused** — types already anticipate string destinations; nothing implements them.
5. **Silent false on eval error** — bad JS falls through to `else` with little feedback in the UI.
6. **Weak branch labels** — handles show `T` / `F` only; edges have no auto label.

---

## 4. Goals

1. **Connect nodes for true and false with zero code** — drag from handles (or quick-add) and run.
2. **Fill-in-the-blank conditions by string** — field / operator / value form; no JS.
3. **Clear true/false semantics** — see recommendation below.
4. **Keep power-user escape hatch** — advanced JS expression, collapsed by default.
5. **Works for While conditions too** — same builder, reused.

Non-goals:

- Full expression language / scripting sandbox rewrite
- Multi-way switch/case (future node type)
- Changing LangGraph routing semantics

---

## 5. Recommendation — How True/False Should Work

### Short answer

Treat **connection** and **condition** as two independent steps. True/False are **graph ports**, not code branches.

### Recommended model: Connect-first, Condition-second

```
        ┌─────────────┐
   ────►│   If/Else   │
        │  condition? │
        └──┬──────┬───┘
        T  │      │  F
           ▼      ▼
        [Node A] [Node B]     ← always wireable, even with empty condition
```

| Layer | Rule |
|-------|------|
| **Wiring** | Always free. Drag T→X and F→Y with no condition. Quick-add creates + connects in one click. |
| **Condition** | Optional to *edit*; required to *execute* (validation → error only at Run). Default if empty: treat as `true` and take **T** — or block at Run with a clear empty-state on the node. |
| **Semantics** | `true` → all edges with `sourceHandle: 'if'`. `false` → all edges with `sourceHandle: 'else'`. |
| **Missing branch** | Allowed. If condition is false and no F edge → workflow **ends that path** with a notice (do not silently jump to T). |
| **Labels** | Edge labels auto-fill `True` / `False` from `sourceHandle`; user-editable via `trueLabel` / `falseLabel`. |
| **Destinations (optional)** | `truePath` / `falsePath` can name a node id as a **text alternative to dragging** — fill-in-the-blank connect. |

### What I suggest for if true / if false specifically

**Primary UX (recommended):**

1. **Ports stay T (green) / F (red)** — already on the canvas. Hover shows:
   - `+` quick-add → node picker → creates node **auto-wired** from that handle
   - or drag to an existing node
2. **Settings panel has three collapsed sections:**
   - **Condition** — Simple builder (default) or Advanced JS
   - **If true** — optional label + optional target node name (string)
   - **If false** — optional label + optional target node name (string)
3. **Simple condition is fill-in-the-blank:**

   ```
   [ lastOutput          ▼ ] [ contains ▼ ] [ "error"            ]
     ↑ VariableAutocomplete    ↑ operator     ↑ literal or {{var}}
   ```

   Chip preview under the form: `lastOutput contains "error"`
   Compiled preview (collapsible): `String(lastOutput ?? "").toLowerCase().includes("error")`

4. **No JS by default.** Monaco only under **Advanced → Expression**.

**Why this over alternatives:**

| Alternative | Why not primary |
|-------------|-----------------|
| Always require JS | Blocks non-devs (current pain) |
| Pure natural language (“if output has error…”) | Ambiguous parsing, hard to debug |
| Only string equals fields | Too weak (need contains / empty / number compare) |
| Code-only nodes A/B as “if true do X” | Forces fake nodes; graph ports already model branches better |

**Secondary sugar (nice-to-have):** if the user only fills `truePath`/`falsePath` strings and never drags, the canvas **auto-creates invisible links** or shows “target: Extract Data” badges so fill-in-the-blank users still get a visual graph.

---

## 6. UX Design

### 6.1 Canvas — connect without code

```
                    ┌────────────────┐
                    │   If/Else      │
                    │  ? has error   │  ← chip from simple rule, or “Click to set”
                    └──┬─────────┬───┘
                 T     │         │     F
              [True]   │         │  [False]
                       ▼         ▼
                  ┌────────┐  ┌────────┐
                  │ Retry  │  │ Done   │
                  └────────┘  └────────┘
```

Changes in `CustomNode.tsx`:

- Keep `if` / `else` handles (ids unchanged for compat).
- Show **True** / **False** labels (or keep T/F with tooltip).
- Hover **`+` button** next to each handle → `EdgeAddButton`-style picker → create node + edge with correct `sourceHandle` and `label`.
- Empty condition chip: dashed “Set condition” (not red error until Run).
- If `trueLabel`/`falseLabel` set, show those on the node edge of the handle.

### 6.2 Settings — three modes

```
┌─ Condition ───────────────────────────────────────────┐
│  ● Simple          ○ Expression (advanced)            │
│ ┌──────────────┐ ┌────────────┐ ┌──────────────────┐  │
│ │ lastOutput   │ │ contains   │ │ error            │  │
│ └──────────────┘ └────────────┘ └──────────────────┘  │
│  [+ Add AND]  [+ Add OR]                              │
│  preview: lastOutput contains "error"                 │
└───────────────────────────────────────────────────────┘

┌─ If true ─────────────────────────────────────────────┐
│  Label  [ True              ]                         │
│  Go to  [ Retry Agent       ▼ ]  (optional, by name)  │
└───────────────────────────────────────────────────────┘

┌─ If false ────────────────────────────────────────────┐
│  Label  [ False             ]                         │
│  Go to  [ Done              ▼ ]  (optional, by name)  │
└───────────────────────────────────────────────────────┘
```

**Simple builder fields:**

| Control | Options |
|---------|---------|
| **Left** | `lastOutput`, `lastOutput.<path>`, `input`, `input.<path>`, `state.<key>`, any upstream node output via `VariableAutocomplete` / `VariablePicker` |
| **Operator** | `equals`, `not equals`, `contains`, `not contains`, `starts with`, `ends with`, `is empty`, `is not empty`, `is true`, `is false`, `>`, `>=`, `<`, `<=`, `matches regex` |
| **Right** | Plain string / number (fill-in blank), or `{{var}}` via VariableAutocomplete. Hidden for unary ops (`is empty`, `is true`, …) |

**Combinators (v1 optional, v1.1):** single rule only for v1. v1.1 adds `AND` / `OR` groups (max 3 clauses) without free JS.

### 6.3 Fill-in-the-blank true/false destinations

Using existing unused fields:

| Field | UI | Runtime effect |
|-------|----|----------------|
| `trueLabel` | text | Edge label on T edges (default `True`) |
| `falseLabel` | text | Edge label on F edges (default `False`) |
| `truePath` | dropdown of node names + free text | If no T edge exists, route to node with this id/label |
| `falsePath` | dropdown of node names + free text | Same for F |

This is **string-based connect** for users who don’t want to drag.

Resolution order at runtime:

1. Explicit edges with matching `sourceHandle`
2. Else `truePath` / `falsePath` (resolve by node id, then by unique label)
3. Else branch unused → path ends with warning

---

## 7. Data Model

Backward compatible with existing JS `condition` string.

```ts
// open-agent-builder/lib/workflow/types.ts (extend NodeData)

interface ConditionRule {
  left: string;                    // "lastOutput.status" | "input.score"
  op: ConditionOperator;
  right?: string;                  // literal or {{var}}; omit for unary
  caseSensitive?: boolean;         // default false for string ops
}

type ConditionOperator =
  | 'eq' | 'neq' | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'empty' | 'not_empty' | 'truthy' | 'falsy'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'matches';

// NodeData additions:
//   conditionMode?: 'simple' | 'expression';   // default 'simple' when conditionRule set
//   conditionRule?: ConditionRule;             // v1 single rule
//   conditionRules?: ConditionRule[];          // v1.1 AND/OR
//   conditionJoin?: 'and' | 'or';
//   condition?: string;                        // kept for expression mode + old workflows
//   truePath?: string;                         // already declared
//   falsePath?: string;                        // already declared
//   trueLabel?: string;                        // already declared
//   falseLabel?: string;                       // already declared
```

**Compatibility rules**

| Stored state | Behavior |
|--------------|----------|
| Only `condition` (JS) | `conditionMode: 'expression'`; evaluate as today |
| Only `conditionRule` | `conditionMode: 'simple'`; evaluate via rule engine |
| Both | Prefer `conditionMode` if set; else rule wins if present |
| Neither | Empty condition — allow connect; block Run with node-level error |

---

## 8. Condition Evaluation

### New module

**Create** `open-agent-builder/lib/workflow/condition-engine.ts`

```ts
export function evaluateConditionRule(rule: ConditionRule, state: WorkflowState): boolean
export function evaluateConditionNode(data: NodeData, state: WorkflowState): {
  result: boolean;
  branch: 'if' | 'else';
  source: 'rule' | 'expression' | 'default';
  error?: string;
}
export function ruleToExpression(rule: ConditionRule): string  // for preview + legacy
export function expressionToRule(expr: string): ConditionRule | null  // best-effort import
```

### Evaluation semantics

| Op | Logic |
|----|--------|
| `eq` / `neq` | Strict after `String()` normalize; optional case-insensitive |
| `contains` | `String(left).toLowerCase().includes(String(right).toLowerCase())` |
| `starts_with` / `ends_with` | same case policy |
| `empty` / `not_empty` | `null`, `undefined`, `''`, `[]` count as empty |
| `truthy` / `falsy` | JS truthiness |
| `gt`/`gte`/`lt`/`lte` | numeric coerce; non-number → `false` + warning |
| `matches` | `RegExp(right)`; invalid regex → error → **else** + error surfaced |

### Wire into both executors

- `executors/logic.ts` → `executeIfElse` delegates to `evaluateConditionNode`
- `langgraph.ts` `executeIfElse` / router — same helper (single source of truth)

### Preview in UI

- Human: `lastOutput contains "error"`
- Debug (optional toggle): compiled expression + last eval result in Execution panel (`result`, `leftValue`, `rightValue`)

---

## 9. Implementation Phases

### Phase 1 — Connect without JavaScript (ship first)

**Goal:** users can wire T/F and run without any condition (or with a default).

| Step | File | Change |
|------|------|--------|
| 1.1 | `open-agent-builder/lib/workflow/validation.ts` | Change empty-condition **error** → **warning**. Add **error only at execute** (or soft-default `true` → T with banner). |
| 1.2 | `components/agent-builder/CustomNode.tsx` | Hover `+` on T and F handles; clearer True/False labels; non-blocking empty chip. |
| 1.3 | `components/agent-builder/WorkflowCanvas.tsx` | Quick-add create + `addEdge` with `sourceHandle` + default `label` True/False. |
| 1.4 | `components/agent-builder/EdgeAddButton.tsx` | Reuse picker; accept `sourceHandle` context from if/else handles. |
| 1.5 | `executors/logic.ts` + `langgraph.ts` | Empty condition → `{ branch: 'if', source: 'default' }` + warning in result. |

**Exit:** drop If/Else → quick-add Agent on T and End on F → Run works with zero typing.

### Phase 2 — Fill-in-the-blank simple condition

| Step | File | Change |
|------|------|--------|
| 2.1 | `open-agent-builder/lib/workflow/condition-engine.ts` | **Create** rule evaluator + `ruleToExpression`. |
| 2.2 | `components/agent-builder/nodes/IfElseNodeConfig.tsx` | Replace Monaco-first with mode toggle: Simple form (default) / Expression (collapsed Monaco). |
| 2.3 | Reuse `VariableAutocomplete` / `VariablePicker` | Left-hand field + right-hand value. |
| 2.4 | `constants.ts` | `defaults: { conditionMode: 'simple', conditionRule: { left: 'lastOutput', op: 'contains', right: '' } }` |
| 2.5 | `executors/logic.ts`, `langgraph.ts` | Call `evaluateConditionNode`. |
| 2.6 | `CustomNode.tsx` | Chip shows rule summary (`lastOutput contains "error"`). |
| 2.7 | `validation.ts` | Error if `conditionMode==='simple'` and rule incomplete (empty right for binary op). |

**Exit:** user picks `lastOutput` + `contains` + `error` and branches work. No JS anywhere.

### Phase 3 — True/False labels + string destinations

| Step | File | Change |
|------|------|--------|
| 3.1 | `IfElseNodeConfig.tsx` | **If true** / **If false** sections: `trueLabel`/`falseLabel`, `truePath`/`falsePath` dropdown (upstream/downstream node names). |
| 3.2 | `condition-engine.ts` or `logic.ts` | Resolve `truePath`/`falsePath` when edges missing. |
| 3.3 | `CustomNode.tsx` | Show custom labels on handles; “→ NodeName” when path set without edge. |
| 3.4 | Edge rendering | Auto `label: data.trueLabel ?? 'True'` on connect / save. |
| 3.5 | `validation.ts` | Warn if both edge and path conflict; warn if neither T edge nor `truePath`. |

**Exit:** fill-in-the-blank “If true → Retry Agent” without dragging.

### Phase 4 — Polish & While reuse

| Step | File | change |
|------|------|--------|
| 4.1 | `WhileNodeConfig.tsx` | Same simple builder for `whileCondition`. |
| 4.2 | Execution panel | Show eval trace: rule, left/right values, chosen branch. |
| 4.3 | Templates | Add “no-code branch” sample using `conditionRule` only. |
| 4.4 | Import/export | Preserve `conditionMode` + `conditionRule` in JSON. |

---

## 10. File Manifest

| File | Action | Phase |
|------|--------|-------|
| `open-agent-builder/lib/workflow/condition-engine.ts` | **Create** | 2 |
| `open-agent-builder/lib/workflow/types.ts` | **Modify** — `ConditionRule`, `conditionMode`, `conditionRule` | 2 |
| `open-agent-builder/lib/workflow/executors/logic.ts` | **Modify** — use engine; empty default | 1–2 |
| `open-agent-builder/lib/workflow/langgraph.ts` | **Modify** — same eval path | 1–2 |
| `open-agent-builder/lib/workflow/validation.ts` | **Modify** — warnings vs run errors | 1–2 |
| `components/agent-builder/nodes/IfElseNodeConfig.tsx` | **Rewrite** — simple form + advanced | 2–3 |
| `components/agent-builder/CustomNode.tsx` | **Modify** — quick-add, labels, chips | 1–3 |
| `components/agent-builder/WorkflowCanvas.tsx` | **Modify** — handle quick-add wiring | 1 |
| `components/agent-builder/EdgeAddButton.tsx` | **Modify** — branch-aware create | 1 |
| `components/agent-builder/constants.ts` | **Modify** — new defaults | 2 |
| `components/agent-builder/nodes/WhileNodeConfig.tsx` | **Modify** — shared builder | 4 |
| `components/agent-builder/ExecutionPanel.tsx` | **Modify** — eval trace | 4 |

Shared UI candidates (optional extract):

- `components/agent-builder/nodes/ConditionBuilder.tsx` — used by If/Else + While

---

## 11. Acceptance Criteria

### Must (Phases 1–2)

- [ ] Can connect **T** and **F** to nodes **without writing any JavaScript**
- [ ] Empty condition does **not** block editing/wiring
- [ ] Simple builder: pick field, operator, string value → branches correctly
- [ ] `contains` / `equals` / `is empty` work on `lastOutput` and `input`
- [ ] Old workflows with only `condition` JS still execute (expression mode)
- [ ] Advanced Monaco still available behind a toggle
- [ ] Run shows clear error if simple rule is incomplete

### Should (Phase 3)

- [ ] `trueLabel` / `falseLabel` appear on edges
- [ ] `truePath` / `falsePath` string targets route without manual edges
- [ ] Quick-add `+` on T/F creates and wires a node in one action

### Nice (Phase 4)

- [ ] While loop uses the same condition builder
- [ ] Execution panel shows which clause won and why
- [ ] Template demonstrating no-code if/else

---

## Appendix A — Operator cheat sheet (user-facing)

| Operator | Example | True when |
|----------|---------|-----------|
| equals | `lastOutput.status` equals `ok` | values match |
| not equals | `lastOutput.status` not equals `ok` | values differ |
| contains | `lastOutput` contains `error` | substring found |
| starts with | `lastOutput.id` starts with `ord_` | prefix match |
| is empty | `lastOutput.body` is empty | null / `''` / `[]` |
| is true | `input.approved` is true | truthy |
| greater than | `input.score` greater than `0.8` | numeric compare |
| matches regex | `lastOutput` matches `^ERR-` | RegExp test |

## Appendix B — Default branch policy (decision record)

| Situation | Behavior |
|-----------|----------|
| Condition true, T edges exist | Follow T edges |
| Condition true, no T edge, `truePath` set | Jump to that node |
| Condition true, nothing | Path completes with warning `if branch not connected` |
| Condition false | Symmetric with F / `falsePath` |
| Eval error | **Else** + error in Execution panel (not silent) |
| Empty condition at Run | Error on node (Phase 2+) or default True with warning (Phase 1) |

**Decision:** Phase 1 default True + warning so connect-first UX is usable immediately; Phase 2 makes incomplete simple rules a hard Run error for predictability.
