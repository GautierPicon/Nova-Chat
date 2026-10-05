<script lang="ts">
	import { onMount } from 'svelte';
	import PromptBar from '../lib/components/PromptBar.svelte';
	import FaultyTerminal from '../lib/components/FaultyTerminal.svelte';
	import ChatHeader from '../lib/components/ChatHeader.svelte';
	import EmptyState from '../lib/components/EmptyState.svelte';
	import MessageItem from '../lib/components/MessageItem.svelte';
	import { commands, efforts, models } from '../lib/demo';
	import { ChatStore } from '../lib/chat.svelte';

	const chat = new ChatStore();
	let scrollEl: HTMLDivElement | null = null;
	let fileInput: HTMLInputElement | null = null;

	onMount(() => {
		chat.initTheme();
	});

	function scrollBottom() {
		requestAnimationFrame(() => {
			scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
		});
	}

	$effect(() => {
		chat.messages.map((m) => m.content);
		scrollBottom();
	});
</script>

<svelte:head>
	<title>Nova — AI Interface</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col bg-(--bg) text-(--ink)">
	{#if chat.messages.length === 0}
		<div
			class="fixed inset-0 z-0 [mask-image:radial-gradient(85%_85%_at_50%_40%,black,transparent)] opacity-90"
		>
			{#key chat.isDark}
				<FaultyTerminal
					scale={chat.isDark ? 2.4 : 1.7}
					digitSize={chat.isDark ? 1.0 : 1.5}
					timeScale={0.55}
					scanlineIntensity={0.45}
					curvature={0.12}
					tint={chat.isDark ? '#FFFFFF' : '#111113'}
					mouseReact={true}
					mouseStrength={1.1}
					pageLoadAnimation={true}
					noiseAmp={1}
					brightness={0.9}
				/>
			{/key}
		</div>
	{/if}
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--halo),transparent_70%)]"
	></div>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] bg-[radial-gradient(60%_100%_at_50%_100%,var(--halo),transparent_70%)]"
	></div>
	<ChatHeader
		busy={chat.busy}
		isDark={chat.isDark}
		onToggleTheme={chat.toggleTheme}
		onNewChat={chat.newChat}
	/>

	<div
		bind:this={scrollEl}
		class="relative mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6"
	>
		{#if chat.messages.length === 0}
			<EmptyState />
		{:else}
			<ol class="flex flex-col gap-5">
				{#each chat.messages as m (m.id)}
					<MessageItem
						message={m}
						last={m.id === chat.messages[chat.messages.length - 1]?.id}
						busy={chat.busy}
						effortLabel={m.effort ?? chat.currentEffort}
						thoughtSteps={chat.thoughtSteps}
						thoughtElapsed={chat.thoughtElapsed}
						onThoughtSettle={chat.onThoughtSettle}
						onReveal={chat.resolveReveal}
					/>
				{/each}
			</ol>
		{/if}
	</div>

	<footer class="relative sticky bottom-0 bg-transparent pb-4">
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(to_top,var(--bg)_20%,transparent)]"
		></div>
		<div class="relative mx-auto flex w-full max-w-3xl justify-center px-4 pt-3">
			<div
				class="w-full max-w-[760px] rounded-[20px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] ring-1 ring-(--line)"
			>
				<PromptBar
					placeholder="Ask anything… (@ sources, / commands)"
					background="var(--prompt-bg)"
					color="var(--prompt-ink)"
					menuBackground="var(--prompt-menu)"
					sparkColor="var(--prompt-spark)"
					sparkBoost={1}
					width={760}
					radius={20}
					maxRows={5}
					morphDuration={240}
					squash={0.12}
					tilt={8}
					pressScale={0.96}
					{models}
					{commands}
					{efforts}
					defaultEffort="Balanced"
					onEffortChange={(e: string) => (chat.currentEffort = e)}
					busy={chat.busy}
					onSend={chat.handleSend}
					onStop={chat.handleStop}
					onAttach={() => chat.handleAttach(fileInput)}
					onDictate={chat.handleDictate}
				/>
			</div>
		</div>
	</footer>
</div>

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	aria-hidden="true"
	tabindex={-1}
	onchange={chat.onFileChange}
/>
