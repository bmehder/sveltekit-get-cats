<script lang="ts">
	import { matchStrict } from 'canary-js'
	
	let { model, frameIndex = $bindable(), frames } = $props()

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

<footer class="time-travel">
	<div class="outer bg-slate-900">
		<div class="inner">
			<div class="content flow">
				<h2>Time Travel Debugger</h2>
				<div class="flex flex-wrap items-center gap-1">
					<label for="timeline">Frame: {frameIndex + 1}</label>
					<input
						id="timeline"
						class="p-0-5"
						type="range"
						min="1"
						max={frames.length}
						value={frameIndex + 1}
						disabled={frames.length === 0}
						oninput={e => {
							frameIndex = Number((e.target as HTMLInputElement).value) - 1
						}}
					/>
					<button
						onclick={() => (frameIndex = Math.max(frameIndex - 1, 0))}
						disabled={frames.length === 0 || frameIndex === 0}
					>
						Undo
					</button>
					<button
						onclick={() =>
							(frameIndex = Math.min(frameIndex + 1, frames.length - 1))}
						disabled={frames.length === 0}
					>
						Redo
					</button>
					<button
						onclick={() => (frameIndex = frames.length - 1)}
						disabled={frames.length === 0}
					>
						Live
					</button>
				</div>
			</div>
		</div>
	</div>
</footer>
