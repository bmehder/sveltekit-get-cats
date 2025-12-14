# SvelteKit Get Cats & Dogs

This project extends the original **message-driven, unidirectional architecture** inspired by The Elm Architecture (TEA) for Svelte 5 to support both **cats and dogs**. The core principles remain: making **state transitions explicit, predictable, and testable**, while keeping side effects centralized and easy to reason about.

Now, users can select between cats and dogs, and the app fetches data accordingly. The design continues to emphasize **fearless refactoring** through explicit messaging and unidirectional data flow.

---

## Core Philosophy

An app is fundamentally **a sequence of state and commands over time**. Each message describes *what happened*, driving pure state transitions and triggering explicit commands that represent real side effects like data fetching.

This philosophy encourages:

- Clear boundaries between pure logic and impure effects
- Predictable, testable state changes
- A single source of truth for the app’s behavior

---

## Core Ideas

The application is built around a few simple but powerful ideas:

1. **Messages as the Driver of Change**  
   All interactions—user input, async results, and external events—are represented as typed messages (`Msg`). Messages describe *what happened*, not *what to do*.

2. **Pure State Transitions**  
   A single pure function (`computeNextModelAndCommands`) takes a message and returns:
   - the next `Model`
   - a list of `Cmd` values describing side effects (limited strictly to real effects like fetching)

3. **Explicit Commands for Side Effects**  
   Side effects such as HTTP requests are modeled as data (`Cmd`) and interpreted in exactly one place. Logging commands have been removed to keep commands focused on real effects.

4. **Unidirectional Data Flow**  

   ```
   View → Msg → Next Model + Commands → Model → Derived State → View
   ```

   Data flows in one direction. There are no hidden mutations or implicit effects.

5. **Development-Time History and Debugging**  
   Leveraging Svelte 5’s `$inspect`, the app records message and state history during development, enabling easier debugging and understanding of state evolution over time.

---

## Types

The core protocol of the app remains:

- `Model` — the complete state of the application, including http request status and fetched data
- `Msg` — all valid messages the app can respond to
- `Cmd` — explicit descriptions of side effects (fetching cats or dogs)
- `NextModelAndCommands` — the pair of model and command results from handling a message

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

Pattern matching is done with `matchStrict`, so every valid message must be handled explicitly. This enforces comprehensive handling and guides refactoring.

---

## Commands (Explicit Side Effects Only)

Side effects are modeled as a focused `Cmd` union:

```ts
type Cmd =
   | { kind: 'FetchAnimal' }
   | { kind: 'LogInfo'; message: string }
   | { kind: 'LogError'; message: string }
```

Commands are **not part of the model**. They are instructions for the runtime to perform real side effects. Logging commands are intended for temporary use and should be used rarely.

A single interpreter function executes commands:

```ts
const executeCommand = (cmd: Cmd): void => {
  // perform the fetch effect
}
```

This keeps all impure behavior localized and auditable.

---

## External Events as Messages

User interactions, keyboard shortcuts, and async fetch results are all turned into messages:

- Keyboard shortcuts dispatch messages
- Fetch success or failure dispatch messages

This keeps the entire control flow explicit and centralized.

---

## Project Structure

The main component is organized into these sections:

- Validation Schemas (Zod) for runtime safety and inferred types
- Types (Model, Msg, Cmd, etc.)
- Model (state)
- Derived State (pure projections for the view)
- Next Model + Commands (pure transition)
- Command Interpreter (side effects)
- Message Entry Point (orchestration)
- View (Svelte template)

Keeping these concepts close together makes the architecture easy to follow and modify.

---

## Why This Approach?

This project prioritizes:

- **Fearless refactoring:** The explicit, typed message-driven design means adding or changing features guides you to all necessary updates.
- **Explicit control flow:** No hidden state mutations or implicit effects.
- **Testability:** Pure state transitions can be tested in isolation.
- **Clarity:** Side effects are explicit and localized.
- **Development tooling:** Using Svelte 5’s `$inspect` to trace message and state history during development.

---

## What This Is (and Isn’t)

This project is:

- ✔️ An experimental exploration of TEA-style ideas in Svelte
- ✔️ A demonstration of explicit state machines in UI code
- ✔️ A foundation for experimentation and learning

It is **not**:

- A full framework or runtime
- A replacement for idiomatic Svelte in simple cases
- A complete Elm runtime reimplementation

The goal is clarity, not abstraction for its own sake.

---

## Notes

This codebase favors:

- Explicit over implicit behavior
- Typed protocols over ad-hoc state
- Centralized side effects limited to real effects
- Confidence when refactoring

If you’re interested in functional state modeling, exhaustive pattern matching, or applying Elm-inspired ideas in a Svelte context, this project is meant to be a readable and adaptable starting point.
