<script lang="ts">
	// IMPORTS ---------------------------------------------------------------------
	import { z } from 'zod'
	import { matchStrict } from 'canary-js'

	// VALIDATION SCHEMAS ----------------------------------------------------------

	const CatSchema = z.object({
		url: z.url(),
	})

	const CatsResponseSchema = z.array(CatSchema)

	// TYPES -----------------------------------------------------------------------

	type Cat = z.infer<typeof CatSchema>

	type RemoteDataStatus<E> =
		| { kind: 'Idle' }
		| { kind: 'Loading' }
		| { kind: 'Failure'; error: E }
		| { kind: 'Success' }

	type Model = {
		cats: Cat[]
		catRequest: RemoteDataStatus<string>
	}

	type Msg =
		| { kind: 'UserClickedAddCat' }
		| { kind: 'CatsLoaded'; cats: Cat[] }
		| { kind: 'CatsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveCat' }
		| { kind: 'UserClickedReset' }

	// MODEL (STATE) --------------------------------------------------------------

	// Explicit state
	let model = $state<Model>({
		cats: [],
		catRequest: { kind: 'Idle' },
	})

	// Derived values
	let numberOfCats = $derived(model.cats.length)

	let isDisabled = $derived(
		model.cats.length === 0 || model.catRequest.kind === 'Loading'
	)

	let catRequestMessage = $derived<string | null>(
		matchStrict(model.catRequest, {
			Idle: () => null,
			Loading: () => 'Loading a new cat...',
			Failure: ({ error }) => error,
			Success: () => null,
		})
	)

	let isFailure = $derived(model.catRequest.kind === 'Failure')

	// UPDATE --------------------------------------------------------------------

	// Replace state based on message
	const update = (msg: Msg): void =>
		matchStrict(msg, {
			UserClickedAddCat: () => {
				model.catRequest = { kind: 'Loading' }

				fetch('https://api.thecatapi.com/v1/images/search')
					.then(response => response.json())
					.then(json => {
						const parsedCatsResponse = CatsResponseSchema.safeParse(json)

						parsedCatsResponse.success
							? update({
									kind: 'CatsLoaded',
									cats: parsedCatsResponse.data,
								})
							: update({
									kind: 'CatsFailedToLoad',
									error: 'API response failed validation.',
								})
					})
					.catch(err => {
						update({
							kind: 'CatsFailedToLoad',
							error: String(err),
						})
					})
			},

			CatsLoaded: ({ cats }) => {
				model.catRequest = { kind: 'Success' }
				model.cats = [...model.cats, ...cats]
			},

			CatsFailedToLoad: ({ error }) => {
				model.catRequest = { kind: 'Failure', error }
			},

			UserClickedRemoveCat: () => {
				model.catRequest = { kind: 'Idle' }
				model.cats = model.cats.slice(0, model.cats.length - 1)
			},

			UserClickedReset: () => {
				model = {
					cats: [],
					catRequest: { kind: 'Idle' },
				}
			},
		})
</script>

<!-- VIEW --------------------------------------------------------------------->

<section>
	<div class="outer">
		<div class="inner">
			<div class="grid auto-fill gap-1">
				{#each model.cats as cat}
					<img
						class="aspect-square object-cover rounded-lg"
						src={cat.url}
						alt="cat"
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
				<button onclick={() => update({ kind: 'UserClickedAddCat' })}>Get Cat</button
				>

				<button
					onclick={() => update({ kind: 'UserClickedRemoveCat' })}
					disabled={isDisabled}
				>
					Remove Cat
				</button>

				<button
					onclick={() => update({ kind: 'UserClickedReset' })}
					disabled={isDisabled}
				>
					Reset
				</button>

				<div>Number of Cats: {numberOfCats}</div>

				<div class:text-red-600={isFailure}>
					{catRequestMessage}
				</div>
			</div>
		</div>
	</div>
</section>
