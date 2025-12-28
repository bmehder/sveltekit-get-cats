<script lang="ts">
	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'
	import { fade } from 'svelte/transition'

	// Validation Schemas
	const AnimalResponseSchema = z.object({
		id: z.string().nonempty(),
		url: z.httpUrl(),
	})

	const AnimalsResponseSchema = z.array(AnimalResponseSchema)

	// TYPES
	type Animal = z.infer<typeof AnimalResponseSchema>

	type SelectedAnimal = 'Cat' | 'Dog'

	type KeyboardShortcut = 'c' | 'd' | 'x' | 'X'

	// --- Remote Fetch State (async state machine) ---
	type RemoteFetchStatus<E> =
		| { kind: 'Idle' }
		| { kind: 'Loading' }
		| { kind: 'Failure'; error: E }
		| { kind: 'Success' }

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		animals: Animal[]
		selectedAnimal: SelectedAnimal
	}

	type NextModelAndCommands = {
		nextModel: Model
		nextCommands: Cmd[]
	}

	type Frame = NextModelAndCommands & {
		msg: Msg
	}

	// Messages & Commands
	type Msg =
		| { kind: 'UserClickedGetNewAnimal' }
		| { kind: 'AnimalsLoaded'; animals: Animal[] }
		| { kind: 'AnimalsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveLast' }
		| { kind: 'UserClickedRemoveAll' }
		| { kind: 'UserPressedKey'; key: KeyboardShortcut }
		| { kind: 'UserSelectedAnimal'; animal: SelectedAnimal }

	type Cmd =
		| { kind: 'FetchAnimal' }
		| { kind: 'LogInfo'; message: string }
		| { kind: 'LogError'; message: string }

	// Message -> (NextModel, NextCommand)
	const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands =>
		matchStrict(msg, {
			UserClickedGetNewAnimal: () => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Loading' },
				},
				nextCommands: [{ kind: 'FetchAnimal' }],
			}),

			AnimalsLoaded: ({ animals }) => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Success' },
					animals: [...model.animals, ...animals],
				},
				nextCommands: [],
			}),

			AnimalsFailedToLoad: ({ error }) => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Failure', error },
				},
				nextCommands: [],
			}),

			UserClickedRemoveLast: () => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Idle' },
					animals: model.animals.slice(0, -1),
				},
				nextCommands: [],
			}),

			UserClickedRemoveAll: () => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Idle' },
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
								...model,
								remoteFetchStatus: { kind: 'Loading' },
								selectedAnimal: 'Cat',
							},
							nextCommands: [{ kind: 'FetchAnimal' }],
						}),

						d: () => ({
							nextModel: {
								...model,
								remoteFetchStatus: { kind: 'Loading' },
								selectedAnimal: 'Dog',
							},
							nextCommands: [{ kind: 'FetchAnimal' }],
						}),

						x: () => ({
							nextModel: {
								...model,
								remoteFetchStatus: { kind: 'Idle' },
								animals: model.animals.slice(0, -1),
							},
							nextCommands: [],
						}),

						X: () => ({
							nextModel: {
								...model,
								remoteFetchStatus: { kind: 'Idle' },
								animals: [],
							},
							nextCommands: [],
						}),
					}
				),

			UserSelectedAnimal: ({ animal }) => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Idle' },
					selectedAnimal: animal,
				},
				nextCommands: [],
			}),
		})

	// Command Executor
	const executeCommand = (cmd: Cmd): void =>
		matchStrict(cmd, {
			FetchAnimal: () =>
				fetch(api)
					.then(response => response.json())
					.then(json => {
						const { success, data, error } = AnimalsResponseSchema.safeParse(json)

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
					.catch(error => {
						processMessage({ kind: 'AnimalsFailedToLoad', error: String(error) })
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

		// Update state
		model = nextModel

		// Run commands
		nextCommands.forEach(executeCommand)

		// Update logging state
		frames = [
			...frames,
			{
				msg,
				nextModel,
				nextCommands,
			},
		]

		// Always jump to the newest frame
		frameIndex = frames.length - 1
	}

	// Explicit state
	let model = $state<Model>({
		remoteFetchStatus: { kind: 'Idle' },
		animals: [],
		selectedAnimal: 'Cat',
	})

	let frames = $state<Frame[]>([])

	let frameIndex = $state<number>(-1)

	// Derived values
	let visibleModel = $derived<Model>(
		frameIndex === frames.length - 1 ? model : frames[frameIndex]?.nextModel
	)

	let isTimeTraveling = $derived(frameIndex !== frames.length - 1)

	let api = $derived(
		`https://api.the${visibleModel.selectedAnimal.toLowerCase()}api.com/v1/images/search`
	)

	let animalsCount = $derived(visibleModel.animals.length)

	let isNoAnimals = $derived(animalsCount === 0)

	let isLoading = $derived(visibleModel.remoteFetchStatus.kind === 'Loading')

	let isAnimalRequestFailure = $derived(
		visibleModel.remoteFetchStatus.kind === 'Failure'
	)

	let fetchRequestStatusMessage: string = $derived(
		matchStrict(visibleModel.remoteFetchStatus, {
			Idle: () => '',
			Loading: () => `Loading a new ${visibleModel.selectedAnimal.toLowerCase()}...`,
			Failure: ({ error }) => error,
			Success: () => '',
		})
	)

	$inspect(frames).with((type, frames) =>
		matchStrict(
			{ kind: type },
			{
				init: () => {
					console.group(`%cFrame #${frames.length}`, 'color: cornflowerblue;')
					console.log('App Started 🚀')
					console.group('%cInitial Model:', 'color: deepskyblue;')
					console.log(
						'%cremoteFetchStatus:',
						'color: mediumseagreen;',
						$state.snapshot(model.remoteFetchStatus)
					)
					console.log(
						'%canimals:',
						'color: mediumseagreen;',
						$state.snapshot(model.animals)
					)
					console.log(
						'%cselectedAnimal:',
						'color: mediumseagreen;',
						$state.snapshot(model.selectedAnimal)
					)
					console.groupEnd()
					console.groupEnd()
				},

				update: () => {
					const frame = frames.at(-1)

					console.group(`%cFrame #${frames.length}`, 'color: cornflowerblue;')
					console.log('%cmsg:', 'color: deepskyblue;', frame?.msg)
					console.group('%cNext Model & Next Commands:', 'color: cornflowerblue;')
					console.log(
						'%cremoteFetchStatus:',
						'color: mediumseagreen;',
						frame?.nextModel.remoteFetchStatus
					)
					console.log(
						'%canimals:',
						'color: mediumseagreen;',
						frame?.nextModel.animals
					)
					console.log(
						'%cselectedAnimal:',
						'color: mediumseagreen;',
						frame?.nextModel.selectedAnimal
					)
					console.log(
						'%ccommands:',
						'color: goldenrod;',
						JSON.stringify(frame?.nextCommands, null, 2)
					)
					console.groupEnd()
					console.groupEnd()
				},
			}
		)
	)
</script>

<svelte:window
	onkeydown={({ key }) =>
		match<{ kind: KeyboardShortcut }, void>(
			{ kind: key as KeyboardShortcut },
			{
				c: () => processMessage({ kind: 'UserPressedKey', key: 'c' }),
				d: () => processMessage({ kind: 'UserPressedKey', key: 'd' }),
				x: () => processMessage({ kind: 'UserPressedKey', key: 'x' }),
				X: () => processMessage({ kind: 'UserPressedKey', key: 'X' }),
				_: () => {},
			}
		)}
/>

<section>
	<div class="outer">
		<div class="inner">
			<div class="content grid justify-start">
				<label for="animals">Select Animal:</label>
				<select
					id="animals"
					value={visibleModel.selectedAnimal}
					onchange={(e: Event) =>
						processMessage({
							kind: 'UserSelectedAnimal',
							animal: (e?.target as HTMLSelectElement)?.value as SelectedAnimal,
						})}
					disabled={isLoading || isTimeTraveling}
				>
					<option>Cat</option>
					<option>Dog</option>
				</select>
			</div>
		</div>
	</div>
</section>

<section>
	<div class="outer">
		<div class="inner" style="--inner-padding-block: 0 var(--size-3)">
			<div class="grid auto-fill gap-1">
				{#each visibleModel.animals as animal}
					<img
						id={animal.id}
						class="aspect-square object-cover rounded-lg"
						src={animal.url}
						alt="random {visibleModel.selectedAnimal}"
						transition:fade
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
					disabled={isLoading || isTimeTraveling}
				>
					Get New {visibleModel.selectedAnimal}
				</button>

				<button
					onclick={() => processMessage({ kind: 'UserClickedRemoveLast' })}
					disabled={isLoading || isNoAnimals || isTimeTraveling}
				>
					Remove Last
				</button>

				<button
					onclick={() => processMessage({ kind: 'UserClickedRemoveAll' })}
					disabled={isLoading || isNoAnimals || isTimeTraveling}
				>
					Remove All
				</button>

				<div>Number of animals: {animalsCount}</div>
			</div>

			<div class:text-red-600={isAnimalRequestFailure}>
				{#if isAnimalRequestFailure}
					<pre>{fetchRequestStatusMessage}</pre>
				{:else}
					<p>{fetchRequestStatusMessage}</p>
				{/if}
			</div>
		</div>
	</div>
</section>

<section class="time-travel">
	<div class="outer">
		<div class="inner">
			<details class="flow" open>
				<summary>Dev Features</summary>

				<div class="inline-flex flex-wrap items-center gap-1">
					<label for="timeline"> Frame: </label>
					<input
						id="timeline"
						class="p-0-5"
						type="number"
						min="1"
						max={frames.length}
						value={frameIndex + 1}
						disabled={frames.length === 0}
						oninput={e => {
							const raw = Number((e.target as HTMLInputElement).value) - 1

							frameIndex = Math.min(Math.max(raw, 0), frames.length - 1)
						}}
					/>
					<button onclick={() => (frameIndex = Math.max(frameIndex - 1, 0))}>
						Undo
					</button>
					<button
						onclick={() =>
							(frameIndex = Math.min(frameIndex + 1, frames.length - 1))}
					>
						Redo
					</button>
					<button onclick={() => (frameIndex = frames.length - 1)}> Live </button>
				</div>
			</details>
		</div>
	</div>
</section>
