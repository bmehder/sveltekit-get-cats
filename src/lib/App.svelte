<script lang="ts">
	import { match, matchStrict } from 'canary-js'
	import { AnimalsResponseSchema } from './schemas'
	import type {
		Cmd,
		Frame,
		KeyboardShortcut,
		Model,
		Msg,
		NextModelAndCommands,
		SelectedAnimal,
	} from '$lib/types'
	import { fade } from 'svelte/transition'
	import Header from '$lib/Header.svelte'
	import TimeTravel from '$lib/TimeTravel.svelte'
	
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

			UserSelectedAnimal: ({ animal }) => ({
				nextModel: {
					...model,
					remoteFetchStatus: { kind: 'Idle' },
					selectedAnimal: animal,
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
	let isLastFrame = $derived(frameIndex === frames.length - 1)

	let visibleModel = $derived<Model>(
		isLastFrame ? model : frames[frameIndex]?.nextModel
	)

	let isTimeTraveling = $derived(!isLastFrame)

	let api = $derived(
		`https://api.the${visibleModel.selectedAnimal.toLowerCase()}api.com/v1/images/search`
	)
	
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

	let animalsCount = $derived(visibleModel.animals.length)

	let isNoAnimals = $derived(animalsCount === 0)
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

<div class="wrapper">
	<Header></Header>

	<main>
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
				<div class="inner">
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

					<div>
						{#if isAnimalRequestFailure}
							<pre class="text-red-600">{fetchRequestStatusMessage}</pre>
						{:else}
							<p>{fetchRequestStatusMessage}</p>
						{/if}
					</div>
				</div>
			</div>
		</section>
	</main>

	<TimeTravel {model} {frames} bind:frameIndex></TimeTravel>
</div>
