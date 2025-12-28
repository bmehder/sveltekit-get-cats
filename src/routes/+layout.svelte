<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import "$lib/assets/app.css"

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header>
	<div class="outer bg-slate-900">
		<div class="inner" style="--inner-padding-block: var(--size-1-5)">
			<div class="content flex justify-between items-center gap-1">
				<h1>Stack of Cats (or Dogs)</h1>
				<div>
					<a
						href="https://github.com/bmehder/sveltekit-get-cats/blob/main/src/lib/App.svelte"
						target="_blank"
						aria-label="View source on GitHub"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="white"
							class="block w-2 h-2"
							aria-hidden="true"
						>
							<path
								d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.45 7.86 10.98.58.11.79-.25.79-.56v-2.02c-3.2.7-3.87-1.55-3.87-1.55-.53-1.36-1.3-1.72-1.3-1.72-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.11-.76.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.67.42.36.8 1.07.8 2.16v3.2c0 .31.21.68.8.56 4.57-1.53 7.85-5.87 7.85-10.98C23.5 5.74 18.27.5 12 .5z"
							/>
						</svg>
					</a>
				</div>
			</div>
		</div>
	</div>
</header>
<main>
	{@render children()}
</main>
