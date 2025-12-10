<script lang="ts">
	// NAIVE IMPLEMENTATION ------------------------------------------------------
	// NOTE: This approach is simple and familiar, but it mixes concerns
	// (state, transitions, and side effects) in ways that become fragile
	// as applications grow.
	//
	// This version intentionally uses a more common, direct style of Svelte +
	// TypeScript development:
	//
	// - Local mutable state via independent variables
	// - Direct side effects inside event handlers
	// - Boolean flags for async state
	// - No runtime validation of external data
	// - No centralized message protocol
	// - No effect or subscription algebra
	//
	// This file exists specifically for contrast with the architected version
	// shown on the root route.

	// TYPES ---------------------------------------------------------------------

	type Cat = {
		id: string
		url: string
	}

	// STATE ---------------------------------------------------------------------

	// In this naive version, state is spread across independent variables.
	// There is no single source of truth or modeled state machine, which
	// makes it harder to reason about valid vs invalid states. Is essentially 
	// treats a component as an object encapsulating state and functions (methods).

	let cats: Cat[] = $state([])
	let isLoading = $state(false)
	let error: string | null = $state(null)

	// DERIVED FLAGS --------------------------------------------------------------

	// These derived values work, but they are implicitly tied to loose
	// boolean flags rather than explicit domain states. As complexity grows,
	// boolean flags tend to drift out of sync.

	let catsCount = $derived(cats.length)
	let isNoCats = $derived(catsCount === 0)
	let hasError = $derived(!!error)

	// SIDE EFFECTS ---------------------------------------------------------------

	// Here, async logic, state updates, and error handling are "intertwangled".
	// This makes testing harder and mixes pure and impure concerns. In the
	// TEA version, the transition remains pure and side effects are centrally
	// modeled as Commands.

	// NOTE: Because fetch() and state updates happen inside this function,
	// it cannot be replayed, logged, or tested in isolation. The TEA version
	// separates the effect (fetch) from the state transition.

	async function getNewCat(): Promise<void> {
		isLoading = true
		error = null

		try {
			const response = await fetch('https://api.thecatapi.com/v1/images/search')
			const json = await response.json()

			// Assume the API response is valid
			const cat = json[0] as Cat
			cats = [...cats, cat]
		} catch (err) {
			error = String(err)
		} finally {
			isLoading = false
		}
	}

	// NOTE: Direct mutation logic like this is simple but has no explicit
	// relationship to the rest of the state model. In TEA, all transitions
	// are centralized and typed.

	function removeLast(): void {
		cats = cats.slice(0, -1)
	}

	function removeAll(): void {
		cats = []
	}
	
	// NAIVE KEYBOARD HANDLING ----------------------------------------------------

	// A direct DOM subscription without a formal subscription model
	// and without a centralized lifecycle manager.
	
	// This works, but it is an ad-hoc subscription. There is no centralized
	// subscription model, no cleanup lifecycle, and no typing around which
	// messages keyboard events produce. The TEA version models subscriptions
	// explicitly and cleans them up automatically.

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.key === 'c') {
			getNewCat()
		}

		if (event.key === 'd') {
			removeLast()
		}
	}

	// NOTE: This listener is never cleaned up

</script>

<!-- NOTE: This attaches a global listener directly in the UI layer.
     In larger apps, this can lead to accidental global state leakage.
     The TEA version routes all external events through a Subscription
     interpreter instead. -->
<svelte:window onkeydown={handleKeydown} />

<section>
	<div class="outer">
		<div class="inner">
			<div class="grid auto-fill gap-1">
				{#each cats as cat}
					<img
						id={cat.id}
						class="aspect-square object-cover rounded-lg"
						src={cat.url}
						alt="random cat"
					/>
				{/each}
			</div>
		</div>
	</div>
</section>

<section>
	<div class="outer">
		<div class="inner" style="--inner-padding-block: 0;">
			<div class="flex flex-wrap items-center gap-0-5">
				<button onclick={getNewCat} disabled={isLoading}> Get New Cat </button>

				<button onclick={removeLast} disabled={isLoading || isNoCats}>
					Remove Last
				</button>

				<button onclick={removeAll} disabled={isLoading || isNoCats}>
					Remove All
				</button>

				<div>Number of Cats: {catsCount}</div>

				{#if hasError}
					<div class="text-red-600">
						<pre>{error}</pre>
					</div>
				{/if}
			</div>
		</div>
	</div>
</section>
