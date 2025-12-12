# SvelteKit Get Cats

This architecture embraces a pure function approach inspired by Elm and other functional state machines, extended with explicit time travel. The entire logic is expressed as schemas, types, algebraic data types (ADTs), and pure functions: `computeNextModelAndCommands`, `executeCommand`, and `processMessage`. State is modeled as a timeline (`past / present / future`), enabling undo, redo, and scrubbing without replaying side effects. The design eliminates nullish checks, avoids control-flow statements (except one `if` in the view), and centralizes all side effects into a single interpreter.

A small demonstration app built with SvelteKit that explores:

- Finite State Machines (FSM)
- Typed message protocols
- Exhaustive pattern matching
- Runtime validation with Zod
- Derived state as pure projections
- Explicit commands for side effects
- Time travel via explicit state timelines
- Deterministic undo / redo and timeline scrubbing

This project is intentionally minimal and architectural in nature. It is less about features and more about **making state transitions explicit, predictable, and safe**.

---

## Core Ideas

This app models application behavior using a small set of concepts:

1. **Validation Schemas** – Zod schemas define the runtime shape of external data (the cat API) and give you inferred TypeScript types.
2. **Types** – `Model`, `Msg`, `Cmd`, and the `NextModelAndCommands` type all describe the structural and behavioral protocol of the app.
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

## Commands (Explicit Side Effects)

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
  // match on cmd.kind and perform the effect
}
```

This function is the only place where network requests, logging, and other side effects happen.

---

## Time Travel & Timeline

Instead of storing a single model value, the app stores state as a timeline:

```ts
type Timeline = {
  past: Model[]
  present: Model
  future: Model[]
}
```

All state transitions move the timeline forward by pushing the current model into `past` and clearing `future`. Undo, redo, and timeline scrubbing are modeled as messages that rearrange the timeline without producing commands.

Crucially:

- **Only models are stored in the timeline**
- **Commands are never replayed**
- **Side effects only occur when handling forward messages**

This separation allows time travel, undo/redo, and debugging without accidentally re-running network requests or other effects.

---

## External Events as Messages

User interactions (button clicks and keyboard events) are treated uniformly as messages.

For example:

- Clicking a button dispatches a message
- Pressing a key dispatches a `{ kind: 'UserPressedKey', key }` message

All messages—regardless of origin—flow through the same pipeline:

```
Event → Msg → computeNextModelAndCommands → Model → View
```

The meaning of a key press (e.g. fetching a cat, removing one, undoing, redoing) is determined exclusively inside the pure transition function. This keeps input handling declarative and avoids spreading logic across event handlers.

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

### Why Commands Instead of `$effect`

Svelte’s `$effect` rune is excellent for DOM and integration concerns, but it re-runs when reactive state changes. That makes it unsuitable for domain-level side effects in a time-traveling architecture.

In this project, side effects are triggered by **messages**, not by **state changes**. This ensures that undoing, redoing, or scrubbing the timeline never replays network requests or logs. Effects happen once, at the moment a message is handled, and are never inferred from state alone.

---


## Timeline Mental Model (DAW Metaphor)

A helpful way to visualize this architecture is as a multi-track timeline, similar to a digital audio workstation (DAW):

```
MODEL TRACK (scrubbable)
| M0 | M1 | M2 | M3 | M4 |
              ▲
           playhead

COMMAND TRACK (live only)
|    |    | F  |    |
```

- Each `Mi` is a complete, immutable snapshot of the `Model`.
- The playhead represents the current `present` model.
- Scrubbing the playhead (undo, redo, or range input) moves across model snapshots.
- Commands (effects) live on a separate track and are **not replayed**.

Only the model track is time-travelable. The command track runs once, in real time, when a message is handled.

## Why This Isn’t Redux or Elm

This architecture borrows ideas from both Redux and Elm, but it is intentionally neither.

**Not Redux**
- There is no global store or reducer tree.
- There is no implicit subscription mechanism.
- Side effects are not driven by middleware or state observation.
- Time travel works because effects are modeled explicitly, not inferred.

**Not Elm**
- This runs inside SvelteKit and embraces local component state.
- There is no separate runtime or virtual DOM.
- Commands are interpreted imperatively rather than by a framework-managed runtime.
- Subscriptions are handled explicitly via browser events, not a formal subscription system.

The goal is not to reimplement another framework, but to apply the *useful constraints* of TEA in a lightweight, idiomatic Svelte context.

## Where This Breaks Down

This approach is intentionally explicit and opinionated, and it is not a universal solution.

Some tradeoffs to be aware of:

- The architecture is more verbose than idiomatic Svelte for small, simple components.
- Modeling everything as messages and commands can feel heavy for purely local UI interactions.
- Long-lived or highly dynamic subscriptions (e.g. websockets, complex timers) would require additional structure.
- This does not attempt to be a full framework or runtime—just a pattern.

In other words, this architecture shines when:
- State transitions matter
- Side effects must be controlled
- Debugging, replayability, or time travel are valuable

And it may be overkill when:
- State is trivial
- Effects are incidental
- The component is short-lived or purely presentational

Being explicit about these limits helps keep the approach honest and practical.

## Notes

This repo intentionally favors **clarity over abstraction**, **unidirectional flow over implicit coupling**, and **explicit commands over hidden side effects**. All major concepts (state, messages, transitions, commands, and simple event wiring) live close together to make the architecture easy to explore and reason about.

If you are interested in:

- Functional state modeling
- Algebraic data types in TypeScript
- Exhaustive pattern matching
- Or building small, explicit state machines in UI apps

…this project is meant to be a readable starting point.

By making state transitions exhaustively typed, time-travel-safe, and side effects explicit, the codebase is structured to encourage experimentation and confident change without fear of breaking hidden behavior (“fearless refactoring”).
