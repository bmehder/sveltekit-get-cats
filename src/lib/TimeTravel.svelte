<script lang="ts">
	let { frameIndex = $bindable(), frames } = $props()
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
