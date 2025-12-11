<script lang="ts">
	import { z } from 'zod'
	import { matchStrict } from 'canary-js'

	// Validation Schemas
	const CatSchema = z.object({
		id: z.string().min(1),
		url: z.httpUrl().min(41),
	})

	const CatsSchema = z.array(CatSchema)

	// TYPES
	type Cat = z.infer<typeof CatSchema>

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		cats: Cat[]
	}

	type NextModelAndCommands = {
		nextModel: Model
		nextCommands: Cmd[]
	}

	// ADTs
	type RemoteFetchStatus<E> =
		| { kind: 'Idle' }
		| { kind: 'Loading' }
		| { kind: 'Failure'; error: E }
		| { kind: 'Success' }

	type Msg =
		| { kind: 'UserClickedGetNewCat' }
		| { kind: 'CatsLoaded'; cats: Cat[] }
		| { kind: 'CatsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveLast' }
		| { kind: 'UserClickedRemoveAll' }
		| { kind: 'UserPressedKey'; key: 'c' | 'd' | 'D' }

	type Cmd =
		| { kind: 'FetchCat' }
		| { kind: 'LogInfo'; message: string }
		| { kind: 'LogError'; message: string }

	const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands =>
		matchStrict(msg, {
			UserClickedGetNewCat: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Loading' },
					cats: model.cats,
				},
				nextCommands: [
					{ kind: 'LogInfo', message: 'User clicked Get New Cat' },
					{ kind: 'FetchCat' },
				],
			}),

			CatsLoaded: ({ cats }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Success' },
					cats: [...model.cats, ...cats],
				},
				nextCommands: [
					{ kind: 'LogInfo', message: `Cats loaded: ${JSON.stringify(cats)}` },
				],
			}),

			CatsFailedToLoad: ({ error }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Failure', error },
					cats: model.cats,
				},
				nextCommands: [{ kind: 'LogError', message: `Cats failed to load: ${error}` }],
			}),

			UserClickedRemoveLast: () => ({
				nextModel: {
					remoteFetchStatus: model.remoteFetchStatus,
					cats: model.cats.slice(0, -1),
				},
				nextCommands: [],
			}),

			UserClickedRemoveAll: () => ({
				nextModel: {
					remoteFetchStatus: model.remoteFetchStatus,
					cats: [],
				},
				nextCommands: [],
			}),

			UserPressedKey: ({ key }) =>
				matchStrict(
					{ kind: key },
					{
						c: () => ({
							nextModel: { remoteFetchStatus: { kind: 'Loading' }, cats: model.cats },
							nextCommands: [
								{ kind: 'LogInfo', message: 'User pressed c' },
								{ kind: 'FetchCat' },
							],
						}),

						d: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: model.cats.slice(0, -1),
							},
							nextCommands: [{ kind: 'LogInfo', message: 'User pressed d' }],
						}),

						D: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: [],
							},
							nextCommands: [{ kind: 'LogInfo', message: 'User pressed shift + d' }],
						}),
					}
				),
		})

	const executeCommand = (cmd: Cmd): void =>
		matchStrict(cmd, {
			FetchCat: () =>
				fetch('https://api.thecatapi.com/v1/images/search')
					.then(response => response.json())
					.then(json => {
						const { success, data, error } = CatsSchema.safeParse(json)

						success
							? processMessage({
									kind: 'CatsLoaded',
									cats: data,
								})
							: processMessage({
									kind: 'CatsFailedToLoad',
									error: error.message,
								})
					})
					.catch(err => {
						processMessage({ kind: 'CatsFailedToLoad', error: String(err) })
					}),

			LogInfo: ({ message }) => {
				console.log(message)
			},

			LogError: ({ message }) => {
				console.error(message)
			},
		})

	const processMessage = (msg: Msg): void => {
		const { nextModel, nextCommands } = computeNextModelAndCommands(msg)

		model = nextModel

		nextCommands.forEach(executeCommand)
	}

	// Explicit state
	let model = $state<Model>({
		remoteFetchStatus: { kind: 'Idle' },
		cats: [],
	})

	// Derived values
	let catsCount: number = $derived(model.cats.length)

	let isLoading: boolean = $derived(model.remoteFetchStatus.kind === 'Loading')

	let isFailure: boolean = $derived(model.remoteFetchStatus.kind === 'Failure')

	let isNoCats: boolean = $derived(catsCount === 0)

	let catRequestMessage: string | null = $derived(
		matchStrict(model.remoteFetchStatus, {
			Idle: () => null,
			Loading: () => 'Loading a new cat...',
			Failure: ({ error }) => error,
			Success: () => null,
		})
	)

	// Smart Logger
	$inspect('New model: \n', model)
</script>

<svelte:window
	onkeydown={({ key }) => {
		;['c', 'd', 'D'].includes(key) &&
			processMessage({ kind: 'UserPressedKey', key: key as 'c' | 'd' | 'D' })
	}}
/>

<section>
	<div class="outer">
		<div class="inner">
			<div class="grid auto-fill gap-1">
				{#each model.cats as cat}
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
				<button
					onclick={() => processMessage({ kind: 'UserClickedGetNewCat' })}
					disabled={isLoading}
				>
					Get New Cat
				</button>

				<button
					onclick={() => processMessage({ kind: 'UserClickedRemoveLast' })}
					disabled={isLoading || isNoCats}
				>
					Remove Last
				</button>

				<button
					onclick={() => processMessage({ kind: 'UserClickedRemoveAll' })}
					disabled={isLoading || isNoCats}
				>
					Remove All
				</button>

				<div>Number of Cats: {catsCount}</div>

				<div class:text-red-600={isFailure}>
					{#if isFailure}
						<pre>{catRequestMessage}</pre>
					{:else}
						<p>{catRequestMessage}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
