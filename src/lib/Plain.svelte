<script lang="ts">
	// Types
	type Cat = {
		id: string
		url: string
	}

	// Explicit State
	let cats: Cat[] = $state([])
	let isLoading = $state(false)
	let error: string | null = $state(null)

	// Implicit State
	let catsCount = $derived(cats.length)
	let isNoCats = $derived(catsCount === 0)
	let hasError = $derived(!!error)

	// Effect
	async function getNewCat(): Promise<void> {
		isLoading = true
		error = null

		try {
			const response = await fetch('https://api.thecatapi.com/v1/images/search')
			const json = await response.json()

			const cat = json[0] as Cat
			cats = [...cats, cat]
		} catch (err) {
			error = String(err)
		} finally {
			isLoading = false
		}
	}

	// State transformations
	function removeLast(): void {
		cats = cats.slice(0, -1)
	}

	function removeAll(): void {
		cats = []
	}

	// Event handlers
	const handleKeydown = (event: KeyboardEvent): void => {
		event.key === 'c' && getNewCat()
		event.key === 'd' && removeLast()
		event.key === 'D' && removeAll()
	}
</script>

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
