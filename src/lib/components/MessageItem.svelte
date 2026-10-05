<script lang="ts">
	import ThoughtLine from './ThoughtLine.svelte';
	import GridReveal from './GridReveal.svelte';
	import type { ChatMessage } from '../demo';

	interface Props {
		message: ChatMessage;
		last: boolean;
		busy: boolean;
		effortLabel: string;
		thoughtSteps: string[];
		thoughtElapsed: number;
		onThoughtSettle: (id: number, seconds: number) => void;
		onReveal: (id: number) => void;
	}

	let {
		message: m,
		last,
		busy,
		effortLabel,
		thoughtSteps,
		thoughtElapsed,
		onThoughtSettle,
		onReveal
	}: Props = $props();
</script>

{#if m.role === 'user'}
	<li class="flex justify-end">
		<div class="max-w-[85%]">
			{#if m.attachments && m.attachments.length > 0}
				<div class="mb-1.5 flex flex-wrap justify-end gap-1.5">
					{#each m.attachments as f, i (i)}
						<span
							class="inline-flex items-center gap-1 rounded-lg bg-(--chip) px-2 py-0.5 text-xs text-(--ink-2)"
						>
							📎 {f}
						</span>
					{/each}
				</div>
			{/if}
			<div
				class="rounded-2xl rounded-br-md bg-(--user-bg) px-4 py-2.5 text-sm leading-6 font-medium whitespace-pre-wrap text-(--user-ink) shadow-[0_2px_12px_-4px_var(--glow)]"
			>
				{m.content}
			</div>
			<p class="mt-1 text-right text-[11px] text-(--ink-3)">{m.time}</p>
		</div>
	</li>
{:else}
	<li class="flex gap-3">
		<span
			class="grid h-8 w-8 flex-none place-items-center rounded-xl border border-(--line-2) bg-(--chip) text-base text-(--ink)"
			aria-hidden="true">✦</span
		>
		<div class="min-w-0 flex-1">
			{#if m.kind !== 'image'}
				<div class="mb-1.5">
					<ThoughtLine
						label="Thinking…"
						doneLabel="Thought for"
						color="var(--thought-ink)"
						glyphColor="var(--thought-ink)"
						fontSize={13}
						glyph="sparkle"
						working={busy && last}
						steps={last ? thoughtSteps : (m.steps ?? [])}
						elapsed={busy && last ? thoughtElapsed : m.thoughtSeconds}
						showTimer={true}
						collapsible={true}
						onSettle={(s: number) => onThoughtSettle(m.id, s)}
					/>
				</div>
			{/if}
			{#if m.kind === 'image'}
				<div class="mb-2 overflow-hidden rounded-2xl rounded-tl-md border border-(--line)">
					<GridReveal
						src={m.imageSrc ?? null}
						alt={m.imagePrompt ?? 'Generated image'}
						progress={m.imageProgress ?? 0}
						aspect={3 / 2}
						caption={m.imagePrompt ?? 'Image'}
						estimatedDuration={6000}
						onRevealComplete={() => onReveal(m.id)}
						onError={() => onReveal(m.id)}
						class="ring-1 ring-(--line)"
						style="--muted: var(--reveal-muted)"
					/>
				</div>
			{/if}
			{#if m.kind !== 'image' || m.content}
				<div
					class="rounded-2xl rounded-tl-md border border-(--line) bg-(--panel) px-4 py-3 text-sm leading-6 whitespace-pre-wrap"
				>
					{#if m.content}
						{m.content}{#if busy && last}<span class="animate-pulse">▍</span>{/if}
					{:else}
						<span class="flex items-center gap-1 text-(--ink-2)">
							<i class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current"></i>
							<i
								class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]"
							></i>
							<i
								class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]"
							></i>
						</span>
					{/if}
				</div>
			{/if}
			<p class="mt-1 flex items-center gap-2 text-[11px] tracking-wide text-(--ink-3)">
				<span>{m.model ?? 'Nova 3'}</span>
				<span>·</span>
				<span>{effortLabel}</span>
				<span>·</span>
				<span>{m.time}</span>
				{#if m.stopped}
					<span class="text-(--ink-2)">· stopped</span>
				{/if}
			</p>
		</div>
	</li>
{/if}
