# A Svelte-Native Take on The Elm Architecture

This project is a deliberate, minimal exploration of **The Elm Architecture (TEA)** implemented in Svelte — not by mimicking Elm’s APIs, but by preserving its *core ideas* while respecting Svelte’s strengths and constraints.

The result is an architecture that is:
- Explicit
- Observable
- Snapshot-based
- Effect-safe
- And debuggable without replaying side effects

---

## Core Goals

This project is intentionally opinionated.

It aims to demonstrate:

- A **single impure boundary**
- **Pure state transitions**
- **Explicit effects**
- **Message-driven updates**
- **Time travel debugging without effect replay**
- A clear separation between *runtime state* and *historical state*

What it does **not** aim to do:
- Recreate Elm inside Svelte
- Hide complexity behind helpers or macros
- Depend on framework magic for correctness

---

## The Big Picture

At a high level, the app is structured around five concepts:

1. **Model** — the complete state of the application
2. **Msg** — all possible events that can affect the model
3. **Update** — a pure function that computes the next model
4. **Cmd** — descriptions of side effects
5. **Runtime** — the only place effects are executed

This should feel familiar if you know Elm — but the way these pieces are *wired* is intentionally Svelte-native.

---

## The Model

The `Model` represents the *entire* application state at a point in time.

```ts
type Model = {
	selectedAnimal: SelectedAnimal
	animals: Animal[]
	remoteFetchStatus: RemoteFetchStatus
}
```

There is exactly one live model at runtime:

```ts
let model = $state<Model>({...})
```

This model always represents **now**.

---

## Messages (`Msg`)

All state changes flow through explicit messages.

```ts
type Msg =
	| { kind: 'UserSelectedAnimal'; animal: SelectedAnimal }
	| { kind: 'UserClickedGetNewAnimal' }
	| { kind: 'UserClickedRemoveLast' }
	| { kind: 'UserClickedRemoveAll' }
	| { kind: 'RemoteFetchSucceeded'; animal: Animal }
	| { kind: 'RemoteFetchFailed'; error: string }
```

Messages are:
- Finite
- Serializable
- Observable
- Easy to log and inspect

No state changes happen outside a message.

---

## Pure Updates

All application logic lives in a pure function:

```ts
function computeNextModelAndCommands(msg: Msg): [Model, Cmd[]]
```

This function:
- Never performs effects
- Never mutates the model
- Returns the next model *and* a list of commands

This mirrors Elm’s `update` function in spirit.

---

## Commands (`Cmd`)

Commands describe *what should happen*, not *how it happens*.

```ts
type Cmd =
	| { kind: 'FetchAnimal'; url: string }
```

Commands are data — not promises, not callbacks, not effects.

---

## The Runtime Boundary

The **only impure function** that is allowed to advance application state is `processMessage`.

```ts
function processMessage(msg: Msg) {
   const { nextModel, nextCommands } = computeNextModelAndCommands(msg)

   model = nextModel

   nextCommands.forEach(executeCommand)

   frames = [
      ...frames,
      {
         msg,
         nextModel,
         nextCommands,
      },
   ]

   frameIndex = frames.length - 1
}
```

This function is responsible for:
- Applying the next model
- Executing commands
- Recording history

This is the architectural heart of the app.

---

## The Application Lifecycle

One of the primary benefits of this architecture is that the **entire lifecycle of the application is explicit, predictable, and unidirectional**.

There is exactly one way the app moves forward in time.

### 1. An Event Occurs

An event originates from one of two places:

- A **user interaction** (clicks, input changes, key presses)
- An **external result** (such as a network response)

In both cases, the event is immediately translated into a `Msg`.

Nothing else is allowed to affect state.

---

### 2. A Message Is Processed

Every `Msg` flows into the same entry point:

```ts
processMessage(msg)
```

This function is the **gatekeeper of time**.  
If state changes, it happens here — and only here.

---

### 3. State Advances Purely

Inside the runtime boundary, the message is handed to the pure update logic:

```ts
computeNextModelAndCommands(msg)
```

This step:
- Computes the next model deterministically
- Describes any effects that should occur
- Performs no I/O
- Has no hidden dependencies

Given the same inputs, it always produces the same outputs.

---

### 4. The Model Is Replaced

The live model is replaced wholesale:

```ts
model = nextModel
```

There is no mutation, patching, or partial updates.

Time advances by replacement, not modification.

---

### 5. Effects Are Executed Once

Any returned commands are executed by the runtime:

```ts
nextCommands.forEach(executeCommand)
```

Effects:
- Are triggered only once
- Never feed back into state directly
- Can only influence the app by emitting a *new* `Msg`

This keeps side effects honest and observable.

---

### 6. History Is Recorded

Each processed message produces an immutable frame:

```ts
{ msg, nextModel, nextCommands }
```

History is:
- Append-only
- Never recomputed
- Never replayed

The past is a fact, not a function.

---

### 7. Rendering Is a Pure Projection

The UI renders from a derived value:

```ts
visibleModel
```

Rendering:
- Never mutates state
- Never triggers effects
- Is a pure projection of data → view

Time travel simply selects a different snapshot to project.

---

## Why This Matters

Because state only moves in one direction:

```
View → Event → Msg → Update → [Model, (Commands → Msg)] → View
```

The system gains:

- Predictable behavior
- Debuggable execution
- Deterministic state transitions
- Confidence that “what you see” is “what happened”

There are no shortcuts, side channels, or hidden control flow.

Time only moves forward — and when you look back, you see exactly what occurred.

---

## Frame Recording (Event Sourcing Lite)

Every processed message produces a **frame**:

```ts
type Frame = {
	msg: Msg
	nextModel: Model
	nextCommands: Cmd[]
}
```

Frames are stored immutably:

```ts
let frames = $state<Frame[]>([])
```

Each frame represents:
> “What the app looked like *after* this message.”

These snapshots power the debugger.

---

## Developer Instrumentation with `$inspect`

This project intentionally leverages Svelte’s **dev-only `$inspect` rune** to make the internal execution of the architecture *visible* during development.

Each recorded frame is logged to the console in a structured, readable format, showing:

- The frame number
- The triggering `Msg`
- The resulting model snapshot
- Any commands that were produced

This allows you to observe the exact progression of application state over time, frame by frame.

Because `$inspect` is:
- **Development-only**
- **Side-effect free**
- **Non-invasive**

…it fits naturally into the architecture without compromising purity or runtime behavior.

---

### Why `$inspect` Works So Well Here

The architecture already guarantees that:

- Every state transition is explicit
- Every transition produces a complete snapshot
- Time advances in discrete, inspectable steps

`$inspect` simply *surfaces* that structure.

Rather than logging ad hoc values, the debugger logs **meaningful architectural events** — the same frames used by the time travel debugger.

This makes the console output a first-class debugging tool, not an afterthought.

---

### Production Safety

Because `$inspect` is stripped in production builds:

- There is no performance cost
- There is no runtime branching
- There is no risk of leaking debug behavior

The instrumentation exists purely to aid understanding during development.

In other words, the same code that powers time travel also powers the console — and disappears cleanly when it’s no longer needed.

---

## Time Travel Debugging (Without Effect Replay)

Time travel is **observational only**.

- Effects are **never replayed**
- History is immutable
- The debugger only selects snapshots

The key derived value is:

```ts
let visibleModel = $derived<Model>(
	frameIndex === frames.length - 1
		? model
		: frames[frameIndex].nextModel
)
```

The UI renders from `visibleModel`, not from `model`.

This keeps:
- runtime state honest
- history safe
- side effects one-shot

---

## Why Effects Are Not Replayed

Replaying effects:
- breaks idempotence
- re-triggers network calls
- introduces non-determinism

Instead, this architecture treats effects as:
> “Things that happened once — and are now facts of history.”

This mirrors real systems and event sourcing principles.

---

## Why This Isn’t “Just Elm in Svelte”

Elm enforces its architecture at the language level.

This project:
- Enforces it by **discipline**
- Makes boundaries visible
- Leaves escape hatches open — but obvious

You can violate the rules.
You can also see *exactly when you do*.

---

## Takeaway

This architecture shows that:

> You don’t need Elm to think in *The Elm Architecture*.

You need:
- explicit messages
- pure transitions
- honest effects
- and respect for time

Svelte becomes the *host*, not the boss.

---

## Who This Is For

This project is for developers who:
- Like Elm’s ideas
- Live in the JS/TS ecosystem
- Want debuggability without magic
- Prefer clarity over cleverness

If that’s you — welcome.

---

## Design Constraints

This architecture is guided by a small set of intentional constraints:

1. All state changes must originate from a `Msg`
1. All state transitions must be pure
1. Side effects must be described, not performed
1. Effects may only run once (per Message)
1. Historical state must never be recomputed

These rules are not enforced by the framework.
They are enforced by **discipline, structure, and visibility**.

Breaking them is possible — and obvious.

---

## What This Architecture Is Not Optimized For

This approach is intentionally not a universal solution.

It may not be ideal for:

- Extremely high-frequency state updates
- Highly local, ephemeral UI-only state
- Scenarios that require effect replay or speculative execution

The tradeoff is deliberate:  
**clarity, debuggability, and temporal correctness** over raw convenience.

---

## A Simple Mental Model

At its core, the system moves in one direction:

```
User Action
   ↓
Msg
   ↓
computeNextModelAndCommands
   ↓
[ nextModel, Cmd[] ]
   ↓
Model Replacement
   ↓
Command Execution
   ↓
New Msg (optional)
```

There are no shortcuts.
There is no hidden control flow.
Every transition is explicit.

---

## Scaling the Architecture

As applications grow, this architecture scales by:

- Splitting `Msg` into domain-specific message unions
- Composing update logic by feature or concern
- Grouping commands by responsibility rather than by component

The core rule never changes:
state changes through messages, and time flows forward.

---

## Naming the Approach

This project demonstrates an opinionated, Svelte-native interpretation of The Elm Architecture.

For clarity and reference, this approach is referred to as:

**SvelteTEA** (pronounced *“Sveltey”*)

SvelteTEA is not a framework or a library, it is a set of architectural commitments.

If you follow the rules, you get:
- Predictable state
- Honest effects
- Observable history

If you break the rules, you can see exactly where — and why.