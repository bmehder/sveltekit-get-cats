<script lang="ts">
	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'

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

	type Timeline = {
		past: Model[]
		present: Model
		future: Model[]
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
		| { kind: 'UserPressedKey'; key: 'c' | 'd' | 'D' | 'z' | 'Z' }
		| { kind: 'JumpTo'; index: number }
		| { kind: 'Noop' }

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
				nextCommands: [
					{ kind: 'LogError', message: `Cats failed to load: ${error}` },
				],
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

						z: () =>
							timeline.past.length === 0
								? { nextModel: timeline.present, nextCommands: [] }
								: {
										nextModel: timeline.past[timeline.past.length - 1],
										nextCommands: [],
									},

						Z: () =>
							timeline.future.length === 0
								? { nextModel: timeline.present, nextCommands: [] }
								: {
										nextModel: timeline.future[0],
										nextCommands: [],
									},
					}
				),

			JumpTo: ({ index }) => {
				const all = [...timeline.past, timeline.present, ...timeline.future]
				const clamped = Math.max(0, Math.min(index, all.length - 1))

				return {
					nextModel: all[clamped],
					nextCommands: [],
				}
			},

			Noop: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Idle' },
					cats: model.cats,
				},
				nextCommands: [],
			}),
		})

	const commitNextModel = (msg: Msg, nextModel: Model): void => {
		const all = [...timeline.past, timeline.present, ...timeline.future]

		const index = match(msg, {
			JumpTo: ({ index }) => index,

			UserPressedKey: ({ key }) =>
				match(
					{ kind: key },
					{
						z: () => timeline.past.length - 1,
						Z: () => timeline.past.length + 1,
						_: () => timeline.past.length + 1,
					}
				),

			_: () => timeline.past.length + 1,
		})

		timeline = {
			past: all.slice(0, index),
			present: nextModel,
			future: all.slice(index + 1),
		}
	}

	const processMessage = (msg: Msg): void => {
		const { nextModel, nextCommands } = computeNextModelAndCommands(msg)
		commitNextModel(msg, nextModel)
		nextCommands.forEach(executeCommand)
	}

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

	// Explicit state
	let timeline = $state<Timeline>({
		past: [],
		present: {
			remoteFetchStatus: { kind: 'Idle' },
			cats: [],
		},
		future: [],
	})

	// Derived values
	let model: Model = $derived(timeline.present)

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

	let timelineIndex: number = $derived(timeline.past.length)
	let timelineLength: number = $derived(
		timeline.past.length + 1 + timeline.future.length
	)

	// Smart Logger
	$inspect('New model: \n', model)
</script>

<svelte:window
	onkeydown={({ key }) =>
		match(
			{ kind: key },
			{
				z: () => processMessage({ kind: 'UserPressedKey', key: 'z' }),
				x: () => processMessage({ kind: 'UserPressedKey', key: 'Z' }),
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

<section>
	<div class="outer">
		<div class="inner">
			<div class="content">
				<label>
					Timeline
					<input
						type="range"
						min="0"
						max={timelineLength - 1}
						value={timelineIndex}
						oninput={({ target }) =>
							processMessage({
								kind: 'JumpTo',
								index: Number((target as HTMLInputElement).value),
							})}
					/>
				</label>
			</div>
		</div>
	</div>
</section>
