# SvelteKit Get Cats

This project explores a **message-driven, unidirectional architecture** inspired by The Elm Architecture (TEA), adapted for Svelte 5. The focus is on making **state transitions explicit, predictable, and testable**, while keeping side effects centralized and easy to reason about.

Rather than relying on implicit reactivity or lifecycle hooks, all meaningful behavior flows through a small set of well-defined concepts: messages, pure state transitions, and explicit commands.

This repository is intentionally minimal and experimental. It is less about features and more about **clarity of control flow and confident refactoring**.

---

## Core Ideas

The application is built around a few simple but powerful ideas:

1. **Messages as the Driver of Change**  
   All interactions—user input, async results, and external events—are represented as typed messages (`Msg`). Messages describe *what happened*, not *what to do*.

2. **Pure State Transitions**  
   A single pure function (`computeNextModelAndCommands`) takes a message and returns:
   - the next `Model`
   - a list of `Cmd` values describing side effects to run

3. **Explicit Commands for Side Effects**  
   Side effects (HTTP requests, logging, etc.) are modeled as data (`Cmd`) and interpreted in exactly one place.

4. **Unidirectional Data Flow**  

   ```
   View → Msg → Next Model + Commands → Model → Derived State → View
   ```

   Data flows in one direction. There are no hidden mutations or implicit effects.

Together, these form a small, explicit state machine.

---

## Validation Schemas

External data (the cat API response) is validated at runtime using **Zod** schemas. This provides:

- Runtime safety when dealing with untrusted input
- Inferred TypeScript types from the same schema
- A clear boundary between the outside world and the app’s internal model

This is a key part of making the architecture robust and debuggable.

---

## Types

The core protocol of the app is described entirely in types:

- `Model` — the complete state of the application
- `Msg` — all valid messages the app can respond to
- `Cmd` — explicit descriptions of side effects
- `NextModelAndCommands` — the pair of results from handling a message

All of these are discriminated unions, enabling exhaustive pattern matching.

---

## Message Handling

At the heart of the app is a pure transition function:

```ts
const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands => { ... }
```

This function:

- does not mutate state
- does not perform side effects
- describes *what the next state should be* and *which commands should run*

Pattern matching is done with `matchStrict`, so every valid message must be handled explicitly. Adding a new message forces the compiler to guide you to all the necessary updates.

---

## Commands (Explicit Side Effects)

Side effects are modeled as a small `Cmd` union, for example:

```ts
type Cmd =
  | { kind: 'FetchCat' }
  | { kind: 'LogInfo'; message: string }
  | { kind: 'LogError'; message: string }
```

Commands are **not part of the model**. They are instructions for the runtime.

A single interpreter function executes them:

```ts
const executeCommand = (cmd: Cmd): void => {
  // perform the effect
}
```

This keeps all impure behavior localized and auditable.

---

## External Events as Messages

User interactions and async results are all turned into messages:

- Clicking a button dispatches a message
- Pressing a key dispatches a message
- Fetch success or failure dispatches a message

The meaning of those events is determined entirely inside the pure transition function, not spread across event handlers.

---

## Project Structure

At a high level, the main component is organized into these sections:

- Validation Schemas (Zod)
- Types (Model, Msg, Cmd, etc.)
- Model (state)
- Derived State (pure projections for the view)
- Next Model + Commands (pure transition)
- Command Interpreter (side effects)
- Message Entry Point (orchestration)
- View (Svelte template)

Keeping these concepts close together makes the architecture easy to follow and modify.

---

## Why Not Just `$effect`?

In this project, side effects are triggered by **messages**, not by **state changes**. The choice was made to make behavior easier to trace, reason about, and test. Effects happen because *something happened*, not because *some value changed*.

---

## What This Is (and Isn’t)

This project is:

- ✔️ An exploration of TEA-style ideas in Svelte
- ✔️ A demonstration of explicit state machines in UI code
- ✔️ A foundation for experimentation and learning

It is **not**:

- A framework
- A replacement for idiomatic Svelte in simple cases
- A full Elm runtime reimplementation

The goal is clarity, not abstraction for its own sake.

---

## Notes

This codebase favors:

- Explicit over implicit behavior
- Typed protocols over ad-hoc state
- Centralized side effects
- Confidence when refactoring

If you’re interested in functional state modeling, exhaustive pattern matching, or applying Elm-inspired ideas in a Svelte context, this project is meant to be a readable and adaptable starting point.
