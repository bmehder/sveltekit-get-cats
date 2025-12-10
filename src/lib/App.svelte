<script lang="ts">
	/**
	 * ARCHITECTURE OVERVIEW
	 *
	 * This application follows a unidirectional data flow inspired by The Elm Architecture:
	 *   View → Msg → Transition → Model → View
	 *
	 * All side commands are modeled as typed data (`Command`) and executed
	 * exclusively by a central interpreter (`runCommand`), keeping state
	 * transitions pure and deterministic.
	 */

	// IMPORTS ---------------------------------------------------------------------

	import { z } from 'zod'
	import { matchStrict } from 'canary-js'

	// VALIDATION SCHEMAS ----------------------------------------------------------

	/**
	 * Runtime validation schemas.
	 *
	 * These schemas define the authoritative runtime shape of external data
	 * entering the system. They act as a defensive boundary between untrusted
	 * inputs (such as API responses) and the application’s typed internal model.
	 *
	 * Responsibilities:
	 * - Validate the structure of incoming data at runtime
	 * - Prevent invalid data from entering the state machine
	 * - Provide a safe bridge between dynamic inputs and static types
	 *
	 * By pairing these schemas with static TypeScript types, the application
	 * gains both compile-time guarantees and runtime safety.
	 */

	const CatSchema = z.object({
		id: z.string().min(3),
		url: z.httpUrl().min(41).max(50),
	})

	const CatsResponseSchema = z.array(CatSchema)

	// TYPES -----------------------------------------------------------------------

	/**
	 * Core domain and protocol types.
	 *
	 * These types define the shape of the application’s data, the finite set of
	 * valid states it may occupy, and the messages (events) that are allowed to
	 * drive state transitions. Together, they form the structural foundation of
	 * the system’s state machine.
	 *
	 * Responsibilities:
	 * - Describe the authoritative shape of domain data
	 * - Encode valid remote/request lifecycles as a constrained union
	 * - Define the complete message protocol for state transitions
	 *
	 * By modeling these concepts explicitly in the type system, the application
	 * gains stronger guarantees about correctness, exhaustiveness, and
	 * long-term maintainability.
	 */

	type Cat = z.infer<typeof CatSchema>

	type RemoteFetchStatus<E> =
		| { kind: 'Idle' }
		| { kind: 'Loading' }
		| { kind: 'Failure'; error: E }
		| { kind: 'Success' }

	type Model = {
		remoteFetchStatus: RemoteFetchStatus<string>
		cats: Cat[]
	}

	type Msg =
		| { kind: 'UserClickedGetNewCat' }
		| { kind: 'CatsLoaded'; cats: Cat[] }
		| { kind: 'CatsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveLast' }
		| { kind: 'UserClickedRemoveAll' }

	/**
	 * Command Algebra
	 *
	 * Commands are modeled as data (rather than direct function calls) to make all
	 * side commands explicit, declarative, and statically enumerable. This allows the
	 * state machine to remain pure while enabling centralized interpretation,
	 * testing, logging, replay, and instrumentation of impure behavior.
	 */

	type Command =
		| { kind: 'FetchCat' }
		| { kind: 'LogInfo'; message: string }
		| { kind: 'LogError'; message: string }

	type Transition = {
		model: Model
		commands: Command[]
	}

	/**
	 * Subscriptions
	 *
	 * Subscriptions represent long-lived external event sources that can emit
	 * messages into the system over time (e.g., keyboard input, timers, sockets).
	 * They are interpreted once at startup and are responsible for calling
	 * `handleMessage` when relevant events occur.
	 */

	type Subscription = { kind: 'UserPressedKeyC' } | { kind: 'UserPressedKeyD' }

	// COMMAND IMPLEMENTATION ------------------------------------------------------

	/**
	 * Concrete implementation of the `FetchCat` command.
	 *
	 * This function performs the actual HTTP request and feeds the resulting
	 * outcome back into the system by emitting new messages via `handleMessage`.
	 *
	 * This function is intentionally impure and lives strictly within the
	 * command layer.
	 */

	const getNewCat = (): Promise<void> =>
		fetch('https://api.thecatapi.com/v1/images/search')
			.then(response => response.json())
			.then(json => {
				const { success, data, error } = CatsResponseSchema.safeParse(json)

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
			})

	// EFFECT INTERPRETER ---------------------------------------------------------
	/**
	 * Central command interpreter.
	 *
	 * This function is the single impure execution boundary for the application.
	 * It interprets declarative `Command` values produced by pure state
	 * transitions and performs the corresponding real-world side commands.
	 *
	 * Responsibilities:
	 * - Execute all declared commands produced by transitions
	 * - Centralize and contain all side commands (I/O, logging, etc.)
	 * - Provide a single choke point for debugging, testing, and instrumentation
	 */

	const runCommand = (command: Command): void =>
		matchStrict(command, {
			FetchCat: () => {
				getNewCat()
			},

			LogInfo: ({ message }) => {
				console.log(message)
			},

			LogError: ({ message }) => {
				console.error(message)
			},
		})

	// SUBSCRIPTION INTERPRETER -----------------------------------------------------

	/**
	 * Interprets long-lived subscriptions and returns a cleanup function.
	 *
	 * For `KeyPress`, a global keydown listener is registered. When the configured
	 * key is pressed, a message is emitted back into the system via `handleMessage`.
	 */
	const runSubscription = (sub: Subscription): (() => void) =>
		matchStrict(sub, {
			UserPressedKeyC: () => {
				const handler = (event: KeyboardEvent) => {
					if (event.key === 'c') {
						handleMessage({ kind: 'UserClickedGetNewCat' })
					}
				}

				window.addEventListener('keydown', handler)

				return () => {
					window.removeEventListener('keydown', handler)
				}
			},

			UserPressedKeyD: () => {
				const handler = (event: KeyboardEvent) => {
					if (event.key === 'd') {
						handleMessage({ kind: 'UserClickedRemoveLast' })
					}
				}

				window.addEventListener('keydown', handler)

				return () => {
					window.removeEventListener('keydown', handler)
				}
			},
		})

	// SUBSCRIPTIONS ---------------------------------------------------------------

	/**
	 * Subscription configuration.
	 *
	 * In a larger app this could depend on the model (e.g., only subscribe to
	 * certain events in certain states). For this demo, we always listen for the
	 * 'c' key to fetch a new cat.
	 */
	const subscriptions = (_model: Model): Subscription[] => [
		{ kind: 'UserPressedKeyC' },
		{ kind: 'UserPressedKeyD' },
	]

	// TRANSITIONS ---------------------------------------------------------------

	/**
	 * Pure state transition function.
	 *
	 * Maps an incoming message to the next model state and a list of declarative
	 * commands. This function is completely pure: it performs no I/O and triggers
	 * no side commands directly.
	 *
	 * Responsibilities:
	 * - Define all valid state transitions
	 * - Declare any commands that should occur as a result of a transition
	 * - Preserve exhaustiveness and protocol correctness via `matchStrict`
	 */

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
		})

	// MESSAGE EXECUTION ----------------------------------------------------------

	/**
	 * Central message executor and command coordinator.
	 *
	 * Orchestrates the unidirectional flow:
	 *
	 *   Msg → Transition → Model Commit → Command Interpreter
	 *
	 * This function applies the pure transition, commits the resulting model as
	 * the new application state, then executes each declared command through the
	 * command interpreter.
	 *
	 * This structure cleanly separates pure decision-making from impure
	 * execution while preserving finite state machine guarantees.
	 */

	const handleMessage = (msg: Msg): void => {
		const { model: nextModel, commands } = transition(msg)

		model = nextModel

		commands.forEach(runCommand)
	}

	// MODEL (STATE) --------------------------------------------------------------

	/**
	 * Application model (state).
	 *
	 * The model represents the complete, authoritative snapshot of the
	 * application’s state at any point in time. It is the single source of truth
	 * from which all rendering and derived values flow.
	 *
	 * Responsibilities:
	 * - Hold the current domain data
	 * - Reflect the current remote/request lifecycle state
	 * - Serve as the input to all derived computations and rendering
	 *
	 * By centralizing state in an explicit model, the system gains predictability,
	 * easier reasoning about behavior, and a clear separation between data,
	 * transitions, and presentation.
	 */

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

	// Activate subscriptions
	$effect(() => {
		const activeSubscriptions = subscriptions(model).map(runSubscription)

		// Cleanup when the command is torn down
		return () => {
			activeSubscriptions.forEach(unsubscribe => {
				unsubscribe()
			})
		}
	})

	$inspect('New model: \n', model)
</script>

<!-- VIEW --------------------------------------------------------------------->

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
