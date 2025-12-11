# SvelteKit Get Cats

This architecture embraces a pure function approach inspired by Elm and other functional state machines. The entire logic is expressed as schemas, types, algebraic data types (ADTs), and pure functions: `computeNextModelAndCommands`, `executeCommand`, and `processMessage`. The design eliminates nullish checks, avoids control-flow statements (except one `if` in the view), and centralizes all side effects into a single interpreter. This separation ensures predictable state transitions, unidirectional data flow, and maintains clear boundaries between model evolution and commands that interact with the external world.

A small demonstration app built with SvelteKit that explores:

- Finite State Machines (FSM)
- Typed message protocols
- Exhaustive pattern matching
- Runtime validation with Zod
- Derived state as pure projections
- Explicit commands for side effects

This project is intentionally minimal and architectural in nature. It is less about features and more about **making state transitions explicit, predictable, and safe**.

---

## Core Ideas

This app models application behavior using a small set of concepts:

1. **Validation Schemas** – Zod schemas define the runtime shape of external data (the cat API) and give you inferred TypeScript types.
2. **Types** – `Model`, `Msg`, `Cmd`, and the “next step” type all describe the structural and behavioral protocol of the app.
3. **Model (State)** – A single, explicit source of truth for the UI.
4. **Unidirectional Message Handling & Commands** – All state changes flow in one direction:  
   **view → message → next-model-and-commands → model → derived state → view**,  
   with outgoing side effects modeled as data (`Cmd`) and interpreted in one place.

Together, these form a small but complete state machine.

<!-- Unidirectional data flow and predictable state transition notes were moved to the introduction above to avoid redundancy. -->

---

## Message Handling

The “heart” of the architecture is a pure function that takes a message and produces:

```ts
type NextModelAndCommands = {
  model: Model
  commands: Cmd[]
}
```

Conceptually, this function:

```ts
const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands => { ... }
```

- **does not mutate** the model
- **does not execute side effects**
- only describes *what the next model should be* and *which commands should run*

This is the TEA-style `update` function, but with a more descriptive name.

On top of that, there is a message entrypoint function (e.g. `processMessage`) that:

1. Calls `computeNextModelAndCommands(msg)` to get `{ model, command[] }`
2. Commits the new `model` to Svelte state
3. Passes each `Cmd` to a central `executeSideEffect` interpreter

This keeps **state evolution pure and testable**, while side effects remain explicit and easy to audit.

All valid messages are defined as a discriminated union (`Msg`), and pattern matching is done via `matchStrict` so that:

- Every valid message is handled
- No unreachable branches exist
- Adding a new `Msg` forces the compiler to guide you to all the places that need updating

---

## Commands (Side Effects)

Side effects are modeled as a small `Cmd` union, for example:

```ts
type Cmd =
  | { kind: 'FetchCat' }
  | { kind: 'LogInfo'; message: string }
  | { kind: 'LogError'; message: string }
```

Commands are **not part of the model**. Instead, they are **instructions** for the runtime:

- `FetchCat` – perform an HTTP request to the cat API and eventually emit a new `Msg` (`CatsLoaded` or `CatsFailedToLoad`)
- `LogInfo` / `LogError` – write debugging information to the console (fire-and-forget; they don’t emit messages)

The interpreter for these commands is an impure function such as:

```ts
const executeSideEffect = (cmd: Cmd): void => {
  // switch on cmd.kind and perform the effect
}
```

This function is the only place where network requests, logging, and other side effects happen.

---

## Keyboard Shortcuts (Lightweight “Subscriptions”)

Earlier versions of this project modeled **subscriptions** as their own typed ADT. That worked, but added more ceremony than was helpful for such a small app.

The current approach keeps the idea of **“external events become messages”** but implements it in a simpler way using Svelte:

- `<svelte:window onkeydown={...} />` listens for keyboard events
- Relevant key presses (`c`, `d`, `Shift+D`) are turned into `Msg` values
- Those messages are passed into the same message pipeline as button clicks

Conceptually this still fits the Elm-style loop:

```
View (clicks / key presses)
  → Msg
  → computeNextModelAndCommands
  → Model
  → View
           ↓
        Commands
```

But instead of a full `Subscription` ADT, we rely on Svelte’s built‑in event system plus our message API.

If you wanted to, you could reintroduce a `Subscription` type and a `runSubscription` interpreter, but the current implementation intentionally favors simplicity over abstraction.

---

## Project Structure

At a high level, the main component is organized around these sections:

- **Validation Schemas** – Zod schemas defining and validating external data
- **Types** – Domain and protocol definitions (`Model`, `Msg`, `Cmd`, etc.)
- **Model (State)** – The single source of truth
- **Derived State** – Pure projections from the model that simplify the view
- **Next Model + Commands** – The pure transition function (`computeNextModelAndCommands`)
- **Command Interpreter** – `executeSideEffect` runs the side effects described by `Cmd`
- **Message Entry Point** – A function that wires messages into the transition and command execution
- **View** – A Svelte template rendering the current model and dispatching messages

This mirrors ideas from The Elm Architecture (TEA), adapted to SvelteKit and Svelte 5’s rune-based state.

---

## Development

Install dependencies:

```sh
npm install
```

Run the dev server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

---

## Deployment

This project is deployed via Vercel using the standard SvelteKit adapter.

---

## Notes

This repo intentionally favors **clarity over abstraction**, **unidirectional flow over implicit coupling**, and **explicit commands over hidden side effects**. All major concepts (state, messages, transitions, commands, and simple event wiring) live close together to make the architecture easy to explore and reason about.

If you are interested in:

- Functional state modeling
- Algebraic data types in TypeScript
- Exhaustive pattern matching
- Or building small, explicit state machines in UI apps

…this project is meant to be a readable starting point.

By making state transitions exhaustively typed and side effects explicit, the codebase is structured to encourage experimentation and confident change without fear of breaking hidden behavior (“fearless refactoring”).
