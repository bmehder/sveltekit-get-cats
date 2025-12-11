# Building Reliable Svelte Apps with TEA‑Inspired Architecture
### A Practical Comparison of Naive State Management vs. Typed Commands, Subscriptions, and Pure Transitions

Modern Svelte development makes it wonderfully easy to build interactive UIs. With `$state`, `$derived`, and `$effect` in Svelte 5, you can create sophisticated behavior with very little code.

But “easy to build” and “easy to evolve” are not the same thing.

Most Svelte apps begin with:
- a few reactive variables  
- a couple `fetch` calls  
- some `onclick` handlers  
- some optimistic assumptions about API data  

Everything works fine — until the app grows. Suddenly:
- state becomes scattered  
- async logic creeps into multiple components  
- UI events mix with global events  
- effects fire in unexpected ways  
- updates become harder to reason about  
- refactoring becomes dangerous  

This article walks through two implementations of the same small app:

> **A button that fetches random cat images.**

Both versions work.  
One of them remains simple even as it grows.

---

# 1. The Naive Svelte Version  
*(file: `Other.svelte`)*

The naive version uses patterns most Svelte developers start with:

- `let` state variables  
- inline `fetch` calls  
- boolean flags  
- errors as strings  
- global keyboard listeners  
- implicit transitions  
- mutating arrays  

A simplified example:

```ts
let cats: Cat[] = $state([])
let isLoading = $state(false)
let error: string | null = $state(null)

async function getNewCat() {
	isLoading = true
	error = null
	try {
		const res = await fetch(...)
		const json = await res.json()
		cats = [...cats, json[0]]  // assume valid data
	} catch (e) {
		error = String(e)
	} finally {
		isLoading = false
	}
}
```

### What’s nice about this?
- It’s familiar.
- It’s small.
- It works.

### What becomes painful later?

#### ❌ State is scattered
`isLoading`, `error`, and `cats` are **independent**. Nothing enforces which combinations are valid.

#### ❌ Boolean flags drift
You can have states like:
```
isLoading = true
error = "oops"
cats = []
```
That shouldn’t be possible — but nothing prevents it.

#### ❌ Side effects and state updates are interleaved
`fetch` happens *inside* the function that mutates state. This makes:
- testing harder
- replaying state impossible
- debugging unpredictable

#### ❌ No runtime validation
If the API returns malformed data, you learn the hard way.

#### ❌ Subscriptions are ad‑hoc
```svelte
<svelte:window onkeydown={handleKeydown} />
```
No cleanup. No centralization. Easy to leak.

This is fine for demos… until it isn’t.

---

# 2. The TEA‑Inspired Version  
*(file: `App.svelte`)*

The Elm Architecture (TEA) gives us a powerful idea:

> **Explicit data flows. Pure transitions. Side effects as data. A predictable unidirectional loop.**

Here’s how we adapt that to Svelte while staying idiomatic.

### 🟦 Model
A single object, the source of truth.

### 🟦 Msg (Messages)
A discriminated union of everything that can happen.

### 🟦 Transition
A pure function:
```ts
Msg → { model, commands[] }
```
No I/O. No async. Just pure state.

### 🟦 Command
A declarative effect:
```ts
{ kind: "FetchCat" }
{ kind: "LogInfo", message: string }
```
Commands describe what to do — not how.

### 🟦 Subscription
A long‑lived external event source:
```ts
{ kind: "UserPressedKeyC" }
```
Subscriptions turn external events (keyboard, timers, sockets) into `Msg`.

### 🟦 Central interpreters
```ts
runCommand(cmd)
runSubscription(sub)
```
One impure boundary for each side of the loop.

### 🟦 Runtime validation
Zod schemas guard your app at the data boundary.

### 🟦 Fearless refactoring
When transitions are pure and effects are typed, you can reorganize without worrying about hidden mutation chains.

---

# 3. Architecture Comparison

### Naive Version
```
View → local handlers → fetch + state mutation → view
```

### TEA Version
```
View → Msg → Transition → { model, commands[] }
                                     ↓
                               runCommand(cmd)
                                     ↓
                               handleMessage
```

Add subscriptions:
```
Subscriptions → Msg → Transition → Model → View
```

One is implicit and fragile.  
One is explicit and reliable.

---

# 4. Why Commands Matter

In the naive version, effects happen invisibly inside handlers. In the TEA version, effects become **data**:

```ts
{ kind: "FetchCat" }
```

This enables:
- logging
- testing
- batching
- retry logic
- central orchestration

Effects become predictable.

---

# 5. Why Subscriptions Matter

Both versions support keyboard shortcuts. But only one treats global events safely.

### Naive
- Event listener is attached directly
- No cleanup
- Hard to test

### TEA
- Subscription is modeled as declarative data
- Interpreter handles setup + teardown
- Clean, typed, predictable

Keyboard events become part of the architecture.

---

# 6. Why Zod Matters

The naive version blindly trusts the network. The TEA version validates inputs:

```ts
CatsResponseSchema.safeParse(json)
```

This gives you **runtime type safety** — the missing half of TypeScript.

---

# 7. Why Pure Transitions Matter

Pure transitions:
- are testable
- are replayable
- make debugging trivial
- eliminate hidden coupling
- encode your domain rules explicitly

TEA gives you clarity you can feel.

---

# 8. Conclusion

This architecture is not heavy. It’s not academic. It’s practical.

You get:
- predictable updates
- explicit commands
- controlled subscriptions
- runtime validation
- centralized error paths
- easier debugging
- stable long‑term maintenance
- fearless refactoring

Both apps fetch cats.  
Only one is designed to grow.
