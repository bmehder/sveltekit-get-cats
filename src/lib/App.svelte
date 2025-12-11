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

	type Transition = {
		model: Model
		commands: Cmd[]
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

	// Transition Interpreter
	const transition = (msg: Msg): Transition =>
		matchStrict(msg, {
			UserClickedGetNewCat: () => ({
				model: {
					remoteFetchStatus: { kind: 'Loading' },
					cats: model.cats,
				},
				commands: [
					{ kind: 'LogInfo', message: 'User clicked Get New Cat' },
					{ kind: 'FetchCat' },
				],
			}),

			CatsLoaded: ({ cats }) => ({
				model: {
					remoteFetchStatus: { kind: 'Success' },
					cats: [...model.cats, ...cats],
				},
				commands: [
					{ kind: 'LogInfo', message: `Cats loaded: ${JSON.stringify(cats)}` },
				],
			}),

			CatsFailedToLoad: ({ error }) => ({
				model: {
					remoteFetchStatus: { kind: 'Failure', error },
					cats: model.cats,
				},
				commands: [{ kind: 'LogError', message: `Cats failed to load: ${error}` }],
			}),

			UserClickedRemoveLast: () => ({
				model: {
					remoteFetchStatus: model.remoteFetchStatus,
					cats: model.cats.slice(0, -1),
				},
				commands: [],
			}),

			UserClickedRemoveAll: () => ({
				model: {
					remoteFetchStatus: model.remoteFetchStatus,
					cats: [],
				},
				commands: [],
			}),

			UserPressedKey: ({ key }) =>
				matchStrict(
					{ kind: key },
					{
						c: () => ({
							model: { remoteFetchStatus: { kind: 'Loading' }, cats: model.cats },
							commands: [
								{ kind: 'LogInfo', message: 'User pressed c' },
								{ kind: 'FetchCat' },
							],
						}),

						d: () => ({
							model: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: model.cats.slice(0, -1),
							},
							commands: [{ kind: 'LogInfo', message: 'User pressed d' }],
						}),

						D: () => ({
							model: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: [],
							},
							commands: [{ kind: 'LogInfo', message: 'User pressed shift + d' }],
						}),
					}
				),
		})

	// Command Interpreter
	const handleCommand = (command: Cmd): void =>
		matchStrict(command, {
			FetchCat: () =>
				fetch('https://api.thecatapi.com/v1/images/search')
					.then(response => response.json())
					.then(json => {
						const { success, data, error } = CatsSchema.safeParse(json)

						success
							? handleMessage({
									kind: 'CatsLoaded',
									cats: data,
								})
							: handleMessage({
									kind: 'CatsFailedToLoad',
									error: error.message,
								})
					})
					.catch(err => {
						handleMessage({ kind: 'CatsFailedToLoad', error: String(err) })
					}),

			LogInfo: ({ message }) => {
				console.log(message)
			},

			LogError: ({ message }) => {
				console.error(message)
			},
		})

	// Message Interpreter
	const handleMessage = (msg: Msg): void => {
		const { model: nextModel, commands } = transition(msg)

		model = nextModel

		commands.forEach(handleCommand)
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

	$inspect('New model: \n', model)
</script>

<svelte:window
	onkeydown={({ key }) => {
		;['c', 'd', 'D'].includes(key) &&
			handleMessage({ kind: 'UserPressedKey', key: key as 'c' | 'd' | 'D' })
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
					onclick={() => handleMessage({ kind: 'UserClickedGetNewCat' })}
					disabled={isLoading}
				>
					Get New Cat
				</button>

				<button
					onclick={() => handleMessage({ kind: 'UserClickedRemoveLast' })}
					disabled={isLoading || isNoCats}
				>
					Remove Last
				</button>

				<button
					onclick={() => handleMessage({ kind: 'UserClickedRemoveAll' })}
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
