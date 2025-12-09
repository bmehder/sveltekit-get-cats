# SvelteKit Get Cats

A small demonstration app built with SvelteKit that explores:

- Finite State Machines (FSM)
- Typed message protocols
- Exhaustive pattern matching
- Runtime validation with Zod
- Derived state as pure projections

This project is intentionally minimal and architectural in nature. It is less about features and more about **making state transitions explicit, predictable, and safe for fearless refactoring**.

---

## Core Ideas

This app models application behavior using four central concepts:

1. **Validation Schemas** – Define the runtime shape of external data (Zod)
2. **Types** – Define the structural and behavioral protocol of the app
3. **Model (State)** – The single source of truth
4. **Unidirectional Message Handling & Effects** – All state changes flow in a single direction: view → message → transition → model → derived state → view, with side effects modeled explicitly as data and interpreted centrally.

Together, these form a small but complete state machine.

This design follows a strictly **unidirectional data flow** model. User interactions and side effects emit messages, messages are reduced into state transitions, and the resulting model is the only source of truth for the rendered view. Data never flows backward or mutates implicitly.

---

## Message Handling

Instead of an `update` function, this project uses a function called:

```ts
handleMessage
```

The name was chosen intentionally: rather than implying mutation, it emphasizes **receiving a message and applying a state transition**.

Internally, message handling is split into two explicit phases:

1. A **pure transition step** that maps a message to `{ model, effects[] }`
2. An **execution step** that commits the new model and runs each declared effect through a central interpreter

This keeps state evolution predictable while making side effects explicit and auditable.

All valid messages are defined as a discriminated union (`Msg`), and `handleMessage` processes them via **exhaustive pattern matching** using `matchStrict`.

This guarantees at compile time that:

- Every valid message is handled
- No unreachable transitions exist
- The state machine cannot silently drift out of sync with its protocol

---

## Project Structure

At a high level, the app is organized around these sections:

- **Validation Schemas** – Runtime safety boundary
- **Types** – Domain + protocol definitions
- **Model (State)** – Single source of truth
- **Derived State** – Pure projections from the model
- **Message Handling** – The only place state transitions occur
- **View** – Declarative rendering from state

This mirrors ideas from The Elm Architecture (TEA), adapted to Svelte.

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

This repo intentionally favors **clarity over abstraction**, **unidirectional flow over implicit coupling**, and **explicit effects over hidden side effects**. All major concepts (state, messages, transitions, effects, projections) live together in one place to make the architecture easy to explore, reason about, and support fearless refactoring.

If you are interested in:

- Functional state modeling
- Algebraic data types in TypeScript
- Exhaustive pattern matching
- Or building small, explicit state machines in UI apps

This project is meant to be a readable starting point.

By making state transitions exhaustively typed and side effects explicit, the codebase is structured to encourage experimentation and confident change without fear of breaking hidden behavior.
