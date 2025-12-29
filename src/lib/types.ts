import type z from 'zod';
import type { AnimalResponseSchema } from './schemas';

// TYPES
export type Animal = z.infer<typeof AnimalResponseSchema>

export type SelectedAnimal = 'Cat' | 'Dog'

export type KeyboardShortcut = 'c' | 'd' | 'x' | 'X'

// --- Remote Fetch State (async state machine) ---
export type RemoteFetchStatus<E> =
	| { kind: 'Idle' }
	| { kind: 'Loading' }
	| { kind: 'Failure'; error: E }
	| { kind: 'Success' }

export type Model = {
	remoteFetchStatus: RemoteFetchStatus<string>
	animals: Animal[]
	selectedAnimal: SelectedAnimal
}

export type NextModelAndCommands = {
	nextModel: Model
	nextCommands: Cmd[]
}

export type Frame = NextModelAndCommands & {
	msg: Msg
}

// Messages & Commands
export type Msg =
	| { kind: 'UserClickedGetNewAnimal' }
	| { kind: 'AnimalsLoaded'; animals: Animal[] }
	| { kind: 'AnimalsFailedToLoad'; error: string }
	| { kind: 'UserClickedRemoveLast' }
	| { kind: 'UserClickedRemoveAll' }
	| { kind: 'UserPressedKey'; key: KeyboardShortcut }
	| { kind: 'UserSelectedAnimal'; animal: SelectedAnimal }

export type Cmd =
	| { kind: 'FetchAnimal' }
	| { kind: 'LogInfo'; message: string }
	| { kind: 'LogError'; message: string }
