<script lang="ts">
	interface Props {
		busy: boolean;
		isDark: boolean;
		onToggleTheme: () => void;
		onNewChat: () => void;
	}

	let { busy, isDark, onToggleTheme, onNewChat }: Props = $props();
</script>

<header
	class="sticky top-0 z-10 border-b border-(--line) bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur"
>
	<div class="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
		<span
			class="grid h-8 w-8 place-items-center rounded-xl bg-(--logo-bg) text-lg font-bold text-(--logo-ink) shadow-[0_0_24px_-6px_var(--glow)]"
			aria-hidden="true">✦</span
		>
		<div class="leading-tight">
			<p class="text-sm font-semibold tracking-tight">Nova Chat</p>
			{#if busy}
				<p class="flex items-center gap-1.5 text-xs text-(--ink-2)">
					<i class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-(--ink)"></i>
					<span class="animate-pulse">Nova is thinking…</span>
				</p>
			{/if}
		</div>
		<span class="flex-1"></span>
		<button
			type="button"
			onclick={onToggleTheme}
			aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
			aria-pressed={isDark}
			class="grid h-8 w-8 place-items-center rounded-lg border border-(--line) bg-(--chip) text-(--ink-2) transition outline-none hover:bg-(--hover) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--ring)"
		>
			<svg
				class="hidden h-4 w-4 dark:block"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="4" />
				<path
					d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
				/>
			</svg>
			<svg
				class="h-4 w-4 dark:hidden"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
			</svg>
		</button>
		<button
			type="button"
			onclick={onNewChat}
			class="rounded-lg border border-(--line) bg-(--chip) px-3 py-1.5 text-xs font-medium text-(--ink-2) transition outline-none hover:bg-(--hover) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--ring)"
		>
			+ New chat
		</button>
	</div>
</header>
