<script lang="ts">
	import { z } from 'zod'
	import { match, matchStrict } from 'canary-js'

	// Validation Schemas
	const AnimalResponseSchema = z.object({
		id: z.string().min(1),
		url: z.httpUrl().min(32),
	})

	const AnimalsResponseSchema = z.array(AnimalResponseSchema)

	// TYPES
	type Animal = z.infer<typeof AnimalResponseSchema>

	type SelectedAnimal = 'Cat' | 'Dog'

	type KeyboardShortcut = 'c' | 'd' | 'x' | 'X'

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

	// Message -> (NextModel, NextCommand) Mapper
	const computeNextModelAndCommands = (msg: Msg): NextModelAndCommands =>
		matchStrict(msg, {
			UserClickedGetNewAnimal: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Loading' },
					animals: model.animals,
					selectedAnimal: model.selectedAnimal,
				},
				nextCommands: [{ kind: 'FetchAnimal' }],
			}),

			AnimalsLoaded: ({ animals }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Success' },
					animals: [...model.animals, ...animals],
					selectedAnimal: model.selectedAnimal,
				},
				nextCommands: [],
			}),

			AnimalsFailedToLoad: ({ error }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Failure', error },
					animals: model.animals,
					selectedAnimal: model.selectedAnimal,
				},
				nextCommands: [],
			}),

			UserClickedRemoveLast: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Idle' },
					animals: model.animals.slice(0, -1),
					selectedAnimal: model.selectedAnimal,
				},
				nextCommands: [],
			}),

			UserClickedRemoveAll: () => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Idle' },
					animals: [],
					selectedAnimal: model.selectedAnimal,
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
								selectedAnimal: 'Cat',
							},
							nextCommands: [{ kind: 'FetchAnimal' }],
						}),

						d: () => ({
							nextModel: {
								remoteFetchStatus: { kind: 'Loading' },
								animals: model.animals,
								selectedAnimal: 'Dog',
							},
							nextCommands: [{ kind: 'FetchAnimal' }],
						}),

						x: () => ({
							nextModel: {
								remoteFetchStatus: { kind: 'Idle' },
								animals: model.animals.slice(0, -1),
								selectedAnimal: model.selectedAnimal,
							},
							nextCommands: [],
						}),

						X: () => ({
							nextModel: {
								remoteFetchStatus: { kind: 'Idle' },
								animals: [],
								selectedAnimal: model.selectedAnimal,
							},
							nextCommands: [],
						}),
					}
				),

			UserSelectedAnimal: ({ animal }) => ({
				nextModel: {
					remoteFetchStatus: { kind: 'Idle' },
					animals: model.animals,
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
	}

	// Explicit state
	let model = $state<Model>({
		remoteFetchStatus: { kind: 'Idle' },
		animals: [],
		selectedAnimal: 'Cat',
	})

	let frames = $state<Frame[]>([])

	// Derived values
	let api = $derived(`https://api.the${model.selectedAnimal}api.com/v1/images/search`)

	let animalsCount = $derived(model.animals.length)

	let isNoAnimals = $derived(animalsCount === 0)

	let isLoading = $derived(model.remoteFetchStatus.kind === 'Loading')

	let isAnimalRequestFailure = $derived(
		model.remoteFetchStatus.kind === 'Failure'
	)

	let fetchRequestStatusMessage: string  = $derived(
		matchStrict(model.remoteFetchStatus, {
			Idle: () => '',
			Loading: () => `Loading a new ${model.selectedAnimal.toLowerCase()}...`,
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
					console.log('%cInitial Model:', 'color: deepskyblue;')
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
				},

				update: () => {
					const frame = frames.at(-1)

					console.group(`%cFrame #${frames.length}`, 'color: cornflowerblue;')
					console.log('%cmsg:', 'color: deepskyblue;', frame?.msg)
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
					value={model.selectedAnimal}
					onchange={(e: Event) =>
						processMessage({
							kind: 'UserSelectedAnimal',
							animal: (e?.target as HTMLSelectElement)?.value as SelectedAnimal,
						})}
					disabled={isLoading}
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
				{#each model.animals as animal}
					<img
						id={animal.id}
						class="aspect-square object-cover rounded-lg"
						src={animal.url}
						alt="random {model.selectedAnimal}"
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
					Get New {model.selectedAnimal}
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
