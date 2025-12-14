<script lang="ts">
	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'

	// Validation Schemas
	const AnimalSchema = z.object({
		id: z.string().min(1),
		url: z.httpUrl().min(32),
	})

	const CatsSchema = z.array(AnimalSchema)

	// TYPES
	type Animal = z.infer<typeof AnimalSchema>

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		cats: Animal[]
	}

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
		| { kind: 'UserClickedGetNewAnimal' }
		| { kind: 'AnimalsLoaded'; cats: Animal[] }
		| { kind: 'AnimalsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveLast' }
		| { kind: 'UserClickedRemoveAll' }
		| { kind: 'UserPressedKey'; key: 'c' | 'd' | 'D' }

	type Cmd =
		| { kind: 'FetchAnimal' }
		| { kind: 'LogInfo'; message: string }
		| { kind: 'LogError'; message: string }

	// Message -> (NextModel, NextCommand) Mapper
	const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands =>
		matchStrict(msg, {
			UserClickedGetNewAnimal: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Loading' },
					cats: model.cats,
				},
				nextCommands: [{ kind: 'FetchAnimal' }],
			}),

			AnimalsLoaded: ({ cats }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Success' },
					cats: [...model.cats, ...cats],
				},
				nextCommands: [],
			}),

			AnimalsFailedToLoad: ({ error }) => ({
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
							nextCommands: [{ kind: 'FetchAnimal' }],
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
			FetchAnimal: () =>
				fetch(`https://api.the${animal}api.com/v1/images/search`)
					.then(response => response.json())
					.then(json => {
						const { success, data, error } = CatsSchema.safeParse(json)

						success
							? processMessage({
									kind: 'AnimalsLoaded',
									cats: data,
								})
							: processMessage({
									kind: 'AnimalsFailedToLoad',
									error: error.message,
								})
					})
					.catch(err => {
						processMessage({ kind: 'AnimalsFailedToLoad', error: String(err) })
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

	let animal = $state('cat')

	// Derived values
	let formattedAnimal = $derived(animal.at(0)?.toUpperCase() + animal.slice(1))
	
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

	$inspect(history).with((type, history) =>
		match(
			{ kind: type },
			{
				init: () => {
					console.log('App Started 🚀')
				},

				update: () => {
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
				},
			}
		)
	)
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
			<div class="content grid justify-start">
				<label for="animals">Choose Animal:</label>
				<select id="animals" bind:value={animal}>
					<option value="cat">Cats</option>
					<option value="dog">Dogs</option>
				</select>
			</div>
		</div>
	</div>
</section>

<section>
	<div class="outer">
		<div class="inner" style="--inner-padding-block: 0 var(--size-3)">
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
					onclick={() => processMessage({ kind: 'UserClickedGetNewAnimal' })}
					disabled={isLoading}
				>
					Get New {formattedAnimal}
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

				<div>Number of animals: {catsCount}</div>

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
