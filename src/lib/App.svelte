<script lang="ts">
	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'

	// Validation Schemas
	const AnimalSchema = z.object({
		id: z.string().min(1),
		url: z.httpUrl().min(32),
	})

	const AnimalsSchema = z.array(AnimalSchema)

	// TYPES
	type Animal = z.infer<typeof AnimalSchema>

	type SelectedAnimal = 'cat' | 'dog'

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		animals: Animal[]
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
		| { kind: 'AnimalsLoaded'; animals: Animal[] }
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
					animals: model.animals,
				},
				nextCommands: [{ kind: 'FetchAnimal' }],
			}),

			AnimalsLoaded: ({ animals }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Success' },
					animals: [...model.animals, ...animals],
				},
				nextCommands: [],
			}),

			AnimalsFailedToLoad: ({ error }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Failure', error },
					animals: model.animals,
				},
				nextCommands: [],
			}),

			UserClickedRemoveLast: () => ({
				nextModel: {
					remoteFetchStatus: model.remoteFetchStatus,
					animals: model.animals.slice(0, -1),
				},
				nextCommands: [],
			}),

			UserClickedRemoveAll: () => ({
				nextModel: {
					remoteFetchStatus: model.remoteFetchStatus,
					animals: [],
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
								animals: model.animals,
							},
							nextCommands: [{ kind: 'FetchAnimal' }],
						}),

						d: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								animals: model.animals.slice(0, -1),
							},
							nextCommands: [],
						}),

						D: () => ({
							nextModel: {
								remoteFetchStatus: model.remoteFetchStatus,
								animals: [],
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
				fetch(`https://api.the${selectedAnimal}api.com/v1/images/search`)
					.then(response => response.json())
					.then(json => {
						const { success, data, error } = AnimalsSchema.safeParse(json)

						success
							? processMessage({
									kind: 'AnimalsLoaded',
									animals: data,
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
		const prevModel = $state.snapshot(model)
		const { nextModel, nextCommands } = computeNextModelAndCommands(msg)

		history = [
			...history,
			{
				msg,
				prevModel,
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
		animals: [],
	})

	let history = $state<HistoryEntry[]>([])

	let selectedAnimal = $state<SelectedAnimal>('cat')

	// Derived values
	let formattedAnimal = $derived<string>(
		(selectedAnimal.at(0)?.toUpperCase() + selectedAnimal.slice(1))
	)

	let animalsCount: number = $derived(model.animals.length)

	let isLoading: boolean = $derived(model.remoteFetchStatus.kind === 'Loading')

	let isAnimalRequestFailure: boolean = $derived(model.remoteFetchStatus.kind === 'Failure')

	let isNoAnimals: boolean = $derived(animalsCount === 0)

	let fetchRequestStatusMessage: string | null = $derived(
		matchStrict(model.remoteFetchStatus, {
			Idle: () => null,
			Loading: () => `Loading a new ${selectedAnimal}...`,
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
				<select id="animals" bind:value={selectedAnimal}>
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
				{#each model.animals as animal}
					<img
						id={animal.id}
						class="aspect-square object-cover rounded-lg"
						src={animal.url}
						alt="random {selectedAnimal}"
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
					disabled={isLoading || isNoAnimals}
				>
					Remove Last
				</button>

				<button
					onclick={() => processMessage({ kind: 'UserClickedRemoveAll' })}
					disabled={isLoading || isNoAnimals}
				>
					Remove All
				</button>

				<div>Number of animals: {animalsCount}</div>

				<div class:text-red-600={isAnimalRequestFailure}>
					{#if isAnimalRequestFailure}
						<pre>{fetchRequestStatusMessage}</pre>
					{:else}
						<p>{fetchRequestStatusMessage}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
