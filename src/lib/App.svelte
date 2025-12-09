<script lang="ts">
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
		url: z.url(),
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

	type RemoteDataStatus<E> =
		| { kind: 'Idle' }
		| { kind: 'Loading' }
		| { kind: 'Failure'; error: E }
		| { kind: 'Success' }

	type PromiseCallback<T = any> =
		| ((value: T) => void | PromiseLike<void>)
		| null
		| undefined

	type Cat = z.infer<typeof CatSchema>

	type Model = {
		cats: Cat[]
		catRequestStatus: RemoteDataStatus<string>
	}

	type Msg =
		| { kind: 'UserClickedGetNewCat' }
		| { kind: 'CatsLoaded'; cats: Cat[] }
		| { kind: 'CatsFailedToLoad'; error: string }
		| { kind: 'UserClickedRemoveLast' }
		| { kind: 'UserClickedRemoveAll' }

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
		catRequestStatus: { kind: 'Idle' },
		cats: [],
	})

	// Derived values
	let numberOfCats = $derived(model.cats.length)

	let isDisabled = $derived(
		model.cats.length === 0 || model.catRequestStatus.kind === 'Loading'
	)

	let isFailure = $derived(model.catRequestStatus.kind === 'Failure')

	let catRequestMessage = $derived<string | null>(
		matchStrict(model.catRequestStatus, {
			Idle: () => null,
			Loading: () => 'Loading a new cat...',
			Failure: ({ error }) => error,
			Success: () => null,
		})
	)

	// UPDATE --------------------------------------------------------------------

	/**
	 * Central message dispatcher and state transition function.
	 *
	 * `update` receives a typed message (event) and applies the corresponding
	 * state transition via exhaustive pattern matching. This function defines
	 * the authoritative rules for how the model may change over time.
	 *
	 * Responsibilities:
	 * - Enforces that all valid messages are handled
	 * - Encapsulates all state mutations in one place
	 * - Acts as the boundary between external events and internal state
	 *
	 * This pattern enables predictable state evolution, simplifies debugging,
	 * and makes the system behave like a finite state machine.
	 */

	const update = (msg: Msg): void =>
		matchStrict(msg, {
			UserClickedGetNewCat: () => {
				model.catRequestStatus = { kind: 'Loading' }

				fetch('https://api.thecatapi.com/v1/images/search')
					.then(response => response.json())
					.then(json => {
						const parsedCatsResponse = CatsResponseSchema.safeParse(json)

						parsedCatsResponse.success
							? update({
									kind: 'CatsLoaded',
									cats: parsedCatsResponse.data,
								})
							: update({
									kind: 'CatsFailedToLoad',
									error: 'API response failed validation.',
								})
					})
					.catch(err => {
						update({
							kind: 'CatsFailedToLoad',
							error: String(err),
						})
					})
			},

			CatsLoaded: ({ cats }) => {
				model = {
					catRequestStatus: { kind: 'Success' },
					cats: [...model.cats, ...cats],
				}
			},

			CatsFailedToLoad: ({ error }) => {
				model = {
					catRequestStatus: { kind: 'Failure', error },
					cats: model.cats,
				}
			},

			UserClickedRemoveLast: () => {
				model = {
					catRequestStatus: { kind: 'Idle' },
					cats: model.cats.slice(0, -1),
				}
			},

			UserClickedRemoveAll: () => {
				model = {
					catRequestStatus: { kind: 'Idle' },
					cats: [],
				}
			},
		})
</script>

<!-- VIEW --------------------------------------------------------------------->

<section>
	<div class="outer">
		<div class="inner">
			<div class="grid auto-fill gap-1">
				{#each model.cats as cat}
					<img
						class="aspect-square object-cover rounded-lg"
						src={cat.url}
						alt="cat"
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
				<button onclick={() => update({ kind: 'UserClickedGetNewCat' })}>
					Get New Cat
				</button>

				<button
					onclick={() => update({ kind: 'UserClickedRemoveLast' })}
					disabled={isDisabled}
				>
					Remove Last
				</button>

				<button
					onclick={() => update({ kind: 'UserClickedRemoveAll' })}
					disabled={isDisabled}
				>
					Remove All
				</button>

				<div>Number of Cats: {numberOfCats}</div>

				<div class:text-red-600={isFailure}>
					{catRequestMessage}
				</div>
			</div>
		</div>
	</div>
</section>
