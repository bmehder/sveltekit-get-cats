<script lang="ts">
	// This app is a sequence of interpreted messages, each producing a new state and an optional set of commands.

	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'

	// Validation Schemas
	const CatSchema = z.object({
		id: z.string().min(1),
		url: z.httpUrl().min(32),
	})

	const CatsSchema = z.array(CatSchema)

	// TYPES
	type Cat = z.infer<typeof CatSchema>

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		cats: Cat[]
	}

	type Cmd =
		| { kind: 'FetchCat' }
		| { kind: 'LogInfo'; message: string }
		| { kind: 'LogError'; message: string }

	type HistoryEntry = {
		msg: Msg
		prevModel: Model
		nextModel: Model
		commands: Cmd[]
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

	// Message -> (NextModel, NextCommand) Mapper
	const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands =>
		matchStrict(msg, {
			UserClickedGetNewCat: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Loading' },
					cats: model.cats,
				},
				nextCommands: [{ kind: 'FetchCat' }],
			}),

			CatsLoaded: ({ cats }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Success' },
					cats: [...model.cats, ...cats],
				},
				nextCommands: [],
			}),

			CatsFailedToLoad: ({ error }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Failure', error },
					cats: model.cats,
				},
				nextCommands: [],
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
							nextModel: {
								remoteFetchStatus: { kind: 'Loading' },
								cats: model.cats,
							},
							nextCommands: [{ kind: 'FetchCat' }],
						}),

						d: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: model.cats.slice(0, -1),
							},
							nextCommands: [],
						}),

						D: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								cats: [],
							},
							nextCommands: [],
						}),
					}
				),
		})

	// Command Executor
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

	// Message Processor - a single impure runtime boundary
	const processMessage = (msg: Msg): void => {
		const { nextModel, nextCommands } = computeNextModelAndCommands(msg)

		history = [
			...history,
			{
				msg,
				prevModel: model,
				nextModel,
				commands: nextCommands,
			},
		]

		model = nextModel

		nextCommands.forEach(executeCommand)
	}

	// Explicit state
	let model = $state<Model>({
		remoteFetchStatus: { kind: 'Idle' },
		cats: [],
	})

	let history = $state<HistoryEntry[]>([])

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

	$inspect(history).with((type, history) => {
		if (type === 'update') {
			const entry = history.at(-1)

			console.group(`History #${history.length}`)
			console.log('msg', entry?.msg)
			console.log('prevModel', {
				prevModel: entry?.prevModel,
			})
			console.log('nextModel', {
				nextModel: entry?.nextModel,
			})
			console.log('commands', entry?.commands)
			console.groupEnd()
		}
	})
</script>

<svelte:window
	onkeydown={({ key }) =>
		match(
			{ kind: key },
			{
				c: () => processMessage({ kind: 'UserPressedKey', key: 'c' }),
				d: () => processMessage({ kind: 'UserPressedKey', key: 'd' }),
				D: () => processMessage({ kind: 'UserPressedKey', key: 'D' }),
				_: () => {},
			}
		)}
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
