<script lang="ts">
	import { onMount } from 'svelte';
	import PromptBar from '../lib/components/PromptBar.svelte';
	import type { PromptBarSendDetail } from '../lib/components/PromptBar.svelte';
	import ThoughtLine from '../lib/components/ThoughtLine.svelte';
	import GridReveal from '../lib/components/GridReveal.svelte';
	import FaultyTerminal from '../lib/components/FaultyTerminal.svelte';

	type Role = 'user' | 'assistant';
	interface ChatMessage {
		id: number;
		role: Role;
		content: string;
		kind?: 'text' | 'image';
		imagePrompt?: string;
		imageSrc?: string;
		imageProgress?: number;
		model?: string;
		effort?: string;
		attachments?: string[];
		time: string;
		stopped?: boolean;
		steps?: string[];
		thoughtSeconds?: number;
	}

	let messages = $state<ChatMessage[]>([]);
	let busy = $state(false);
	let isDark = $state(true);
	let currentEffort = $state('Équilibré');
	let scrollEl = $state<HTMLDivElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let pendingFiles = $state<{ resolve: (v: string[]) => void } | null>(null);
	let streamTimer: ReturnType<typeof setInterval> | null = null;
	let streamReject: (() => void) | null = null;
	let thinkTimer: ReturnType<typeof setTimeout> | null = null;
	let thinkReject: (() => void) | null = null;
	let genTimer: ReturnType<typeof setInterval> | null = null;
	let activeAssistantId: number | null = null;
	let pendingResolve: (() => void) | null = null;
	const revealWaiters = new Map<number, () => void>();

	function resolveReveal(id: number) {
		revealWaiters.get(id)?.();
	}
	let thoughtSteps = $state<string[]>([]);
	let thoughtTimers: ReturnType<typeof setTimeout>[] = [];
	let thoughtT0 = 0;
	let thoughtElapsed = $state(0);
	let thoughtClock: ReturnType<typeof setInterval> | null = null;
	let idCounter = $state(0);

	function clearThoughtTimers() {
		thoughtTimers.forEach((t) => clearTimeout(t));
		thoughtTimers = [];
	}

	function startThoughtClock() {
		stopThoughtClock();
		thoughtT0 = performance.now();
		thoughtElapsed = 0;
		thoughtClock = setInterval(() => {
			thoughtElapsed = Math.round((performance.now() - thoughtT0) / 100) / 10;
		}, 100);
	}

	function stopThoughtClock() {
		if (thoughtClock) clearInterval(thoughtClock);
		thoughtClock = null;
	}

	function thoughtFinal() {
		return Math.round((performance.now() - thoughtT0) / 100) / 10;
	}

	function settleThought(id: number, stopped: boolean, fallback = '') {
		const final = thoughtFinal();
		stopThoughtClock();
		messages = messages.map((m) =>
			m.id === id
				? {
						...m,
						...(stopped ? { stopped: true, content: m.content || fallback } : {}),
						thoughtSeconds: m.thoughtSeconds ?? final,
						steps: m.steps?.length ? m.steps : [...thoughtSteps]
					}
				: m
		);
	}

	function onThoughtSettle(id: number, seconds: number) {
		messages = messages.map((m) =>
			m.id === id
				? {
						...m,
						thoughtSeconds: m.thoughtSeconds ?? (seconds > 0 ? seconds : undefined),
						steps: m.steps?.length ? m.steps : [...thoughtSteps]
					}
				: m
		);
	}

	const models = [
		{ key: 'nova-3', name: 'Nova 3', tag: 'Puissant' },
		{ key: 'nova-mini', name: 'Nova Mini', tag: 'Rapide' },
		{ key: 'nova-2', name: 'Nova 2', tag: 'Léger' }
	];

	const efforts = ['Rapide', 'Équilibré', 'Approfondi', 'Expert', 'Max'];

	const commands = [
		{ key: 'resumer', name: '/resumer', description: 'Résume la conversation' },
		{ key: 'comparer', name: '/comparer', description: 'Compare deux options' },
		{ key: 'brouillon', name: '/brouillon', description: 'Rédige un premier jet' },
		{ key: 'expliquer', name: '/expliquer', description: 'Explication simple' },
		{ key: 'taches', name: '/taches', description: 'Transforme en to-do list' },
		{ key: 'image', name: '/image', description: 'Génère une image' }
	];

	function now(): string {
		return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
	}

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggleTheme() {
		isDark = !isDark;
		document.documentElement.classList.toggle('dark', isDark);
		try {
			localStorage.setItem('nova-theme', isDark ? 'dark' : 'light');
		} catch {
			// stockage indisponible : le thème reste pour la session
		}
	}

	function scrollBottom() {
		requestAnimationFrame(() => {
			scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
		});
	}

	$effect(() => {
		messages.length;
		messages.map((m) => m.content);
		scrollBottom();
	});

	function fakeAnswer(
		text: string,
		detail: PromptBarSendDetail,
		effort: string
	): string {
		const t = text.trim();
		const lower = t.toLowerCase();
		const modelName = detail.model?.name ?? 'Nova 3';
		const attachNote =
			detail.attachments.length > 0
				? `\n\n📎 J'ai bien pris en compte ${detail.attachments.length} fichier(s) : ${detail.attachments.join(', ')}.`
				: '';

		if (lower.startsWith('/resumer')) {
			const n = messages.filter((m) => m.role === 'user').length;
			return `Voici le résumé de notre échange (${n} message(s)) :\n\n• Vous explorez l'interface Nova avec PromptBar.\n• Effort actuel : ${effort}, modèle : ${modelName}.\n• Sujet en cours : « ${t.replace(/^\/resumer\s*/i, '') || 'discussion générale'} ».\n\nDites-moi si vous voulez un résumé plus court ou détaillé.${attachNote}`;
		}
		if (lower.startsWith('/comparer')) {
			const sujet = t.replace(/^\/comparer\s*/i, '') || 'option A vs option B';
			return `Comparaison — ${sujet} :\n\n**Option 1** : simple, rapide à mettre en place, idéale pour valider.\n**Option 2** : plus puissante, mieux à long terme, mais plus coûteuse.\n\nMon avis (effort ${effort}) : commencez par l'option 1, migrez si ça décolle.${attachNote}`;
		}
		if (lower.startsWith('/brouillon')) {
			const sujet = t.replace(/^\/brouillon\s*/i, '') || 'votre message';
			return `Voici un premier jet :\n\n---\n\nObjet : ${sujet}\n\nBonjour,\n\nJe me permets de vous écrire au sujet de « ${sujet} ». Voici ma proposition en 3 points : contexte, valeur apportée, prochain pas concret.\n\nSeriez-vous disponible cette semaine pour en discuter ?\n\nCordialement${attachNote}\n\n---\n\nDites-moi le ton souhaité (formel, amical, direct) et je l'ajuste.`;
		}
		if (lower.startsWith('/expliquer')) {
			const sujet = t.replace(/^\/expliquer\s*/i, '') || 'ce concept';
			return `Explication simple — ${sujet} :\n\n1. **L'idée de base** : on part d'un problème concret.\n2. **Le mécanisme** : on le découpe en petites étapes.\n3. **L'exemple** : imaginez que chaque étape est une brique LEGO.\n\nEn mode ${effort}, je peux aller ${effort === 'Rapide' ? 'à l\'essentiel' : 'beaucoup plus en profondeur avec des exemples de code'}. On creuse ?${attachNote}`;
		}
		if (lower.startsWith('/taches')) {
			const sujet = t.replace(/^\/taches\s*/i, '') || 'votre objectif';
			return `To-do — ${sujet} :\n\n- [ ] Cadrer l'objectif en une phrase\n- [ ] Lister les 3 risques principaux\n- [ ] Faire un prototype en 2 jours\n- [ ] Tester avec 3 utilisateurs\n- [ ] Itérer et planifier la v1${attachNote}`;
		}
		if (lower.startsWith('@')) {
			return `J'ai noté le contexte « ${t} ». En mode ${effort} avec ${modelName}, voici comment je l'utiliserais : je croise cette source avec votre question pour donner une réponse ciblée.\n\nPosez votre vraie question et j'y réponds directement.${attachNote}`;
		}

		const long = ['Approfondi', 'Expert', 'Max'].includes(effort);
		let base = `Bonne question ! Voici ma réponse (modèle ${modelName}, effort ${effort}) :\n\n« ${t} » — je pars du besoin, puis je propose un plan concret :\n\n1. **Comprendre** : reformuler le problème en une phrase.\n2. **Agir** : la plus petite étape utile dès aujourd'hui.\n3. **Valider** : comment mesurer que ça marche.`;
		if (long) {
			base += `\n\n**Pour aller plus loin** :\n- Exemple concret adapté à votre cas\n- Erreurs fréquentes à éviter\n- 3 ressources pour creuser\n\nDites « détaille le point 2 » et je développe.`;
		} else {
			base += `\n\nPassez l'effort en Max pour une version ultra-détaillée avec étincelles ✨.`;
		}
		return base + attachNote;
	}

	async function handleSend(text: string, detail: PromptBarSendDetail) {
		if (busy) return;
		const userMsg: ChatMessage = {
			id: ++idCounter,
			role: 'user',
			content: text,
			model: detail.model?.name,
			effort: detail.effort,
			attachments: [...detail.attachments],
			time: now()
		};
		messages = [...messages, userMsg];
		if (detail.effort) currentEffort = detail.effort;

		busy = true;
		const assistantId = ++idCounter;
		activeAssistantId = assistantId;
		const clean = text.trim();
		const isImage = clean.toLowerCase().startsWith('/image');
		const imagePrompt = isImage
			? clean.replace(/^\/image\s*/i, '').trim() || 'paysage onirique'
			: '';
		const full = isImage ? '' : fakeAnswer(text, detail, detail.effort ?? currentEffort);
		const vitesse = (detail.effort ?? currentEffort) === 'Rapide' ? 14 : 26;

		// Trace de réflexion animée pendant la génération (texte uniquement)
		clearThoughtTimers();
		thoughtSteps = [];
		startThoughtClock();
		if (!isImage) {
			['Analyse de la question', 'Préparation de la réponse', 'Vérification du ton'].forEach(
				(step, i) => {
					thoughtTimers.push(
						setTimeout(() => {
							thoughtSteps = [...thoughtSteps, step];
						}, 500 + i * 1000)
					);
				}
			);
		}

		// Message assistant vide, rempli ensuite (texte streamé ou image révélée)
		messages = [
			...messages,
			{
				id: assistantId,
				role: 'assistant',
				content: '',
				kind: isImage ? 'image' : 'text',
				imagePrompt: isImage ? imagePrompt : undefined,
				imageProgress: isImage ? 0 : undefined,
				model: detail.model?.name ?? 'Nova 3',
				effort: detail.effort ?? currentEffort,
				time: now()
			}
		];

		await new Promise<void>((resolve) => {
			pendingResolve = resolve;
			const finish = () => {
				pendingResolve = null;
				thinkReject = null;
				streamReject = null;
				resolve();
			};
			const markStopped = (fallback: string) => {
				settleThought(assistantId, true, fallback);
			};
			streamReject = () => {
				if (streamTimer) clearInterval(streamTimer);
				streamTimer = null;
				markStopped('');
				finish();
			};
			// Phase de réflexion (3 s) : ThoughtLine respire avant la réponse
			thinkReject = () => {
				if (thinkTimer) clearTimeout(thinkTimer);
				thinkTimer = null;
				markStopped('_Réflexion interrompue._');
				finish();
			};
			thinkTimer = setTimeout(() => {
				thinkTimer = null;
				thinkReject = null;
				if (!isImage) {
					let i = 0;
					streamTimer = setInterval(() => {
						i += vitesse;
						const slice = full.slice(0, i);
						messages = messages.map((m) =>
							m.id === assistantId ? { ...m, content: slice } : m
						);
						if (i >= full.length) {
							if (streamTimer) clearInterval(streamTimer);
							streamTimer = null;
							finish();
						}
					}, 40);
					return;
				}
				// Branche image : progression simulée puis révélation GridReveal
				streamReject = () => {
					if (genTimer) clearInterval(genTimer);
					genTimer = null;
					revealWaiters.delete(assistantId);
					markStopped('');
					finish();
				};
				genTimer = setInterval(() => {
					const cur = messages.find((m) => m.id === assistantId)?.imageProgress ?? 0;
					const p = Math.min(0.9, Math.round((cur + 0.03) * 100) / 100);
					messages = messages.map((m) =>
						m.id === assistantId ? { ...m, imageProgress: p } : m
					);
					if (p < 0.9 || !genTimer) return;
					clearInterval(genTimer);
					genTimer = null;
					const seed =
						imagePrompt
							.toLowerCase()
							.replace(/[^a-z0-9]+/gi, '-')
							.replace(/^-+|-+$/g, '')
							.slice(0, 40) || 'nova';
					messages = messages.map((m) =>
						m.id === assistantId
							? { ...m, imageSrc: `https://picsum.photos/seed/${seed}/900/600` }
							: m
					);
					const to = setTimeout(() => {
						revealWaiters.delete(assistantId);
						finish();
					}, 20000);
					revealWaiters.set(assistantId, () => {
						clearTimeout(to);
						revealWaiters.delete(assistantId);
						finish();
					});
				}, 120);
			}, 3000);
		});

		activeAssistantId = null;
		pendingResolve = null;
		if (genTimer) {
			clearInterval(genTimer);
			genTimer = null;
		}
		settleThought(assistantId, false);
		busy = false;
		streamReject = null;
		thinkReject = null;
		clearThoughtTimers();
	}

	function handleStop() {
		thinkReject?.();
		streamReject?.();
		if (activeAssistantId !== null && revealWaiters.delete(activeAssistantId)) {
			// Stop pendant l'attente de la révélation : aucun reject actif
			settleThought(activeAssistantId, true);
			pendingResolve?.();
			pendingResolve = null;
		}
		clearThoughtTimers();
		busy = false;
	}

	function handleAttach(): Promise<string[]> {
		return new Promise((resolve) => {
			pendingFiles = { resolve };
			fileInput?.click();
		});
	}

	function onFileChange(e: Event & { currentTarget: HTMLInputElement }) {
		const files = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
		pendingFiles?.resolve(files);
		pendingFiles = null;
		e.currentTarget.value = '';
	}

	function handleDictate(): Promise<string> {
		return new Promise((resolve) => {
			const w = window as unknown as {
				SpeechRecognition?: new () => any;
				webkitSpeechRecognition?: new () => any;
			};
			const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
			if (!Rec) {
				// Fallback : simulation
				setTimeout(() => resolve('Bonjour Nova, explique-moi ce composant'), 1200);
				return;
			}
			try {
				const rec = new Rec();
				rec.lang = 'fr-FR';
				rec.interimResults = false;
				rec.onresult = (ev: any) => {
					resolve(ev.results?.[0]?.[0]?.transcript ?? '');
				};
				rec.onerror = () => resolve('');
				rec.onend = () => resolve('');
				rec.start();
			} catch {
				resolve('');
			}
		});
	}

	function newChat() {
		handleStop();
		messages = [];
		thoughtSteps = [];
	}
</script>

<svelte:head>
	<title>Nova — Interface IA</title>
</svelte:head>

<div class="relative flex min-h-screen flex-col bg-(--bg) text-(--ink)">
	{#if messages.length === 0}
		<div
			class="fixed inset-0 z-0 opacity-90 [mask-image:radial-gradient(85%_85%_at_50%_40%,black,transparent)]"
		>
			{#key isDark}
						<FaultyTerminal
							scale={isDark ? 2.4 : 1.7}
							digitSize={isDark ? 1.0 : 1.5}
					timeScale={0.55}
					scanlineIntensity={0.45}
					curvature={0.12}
					tint={isDark ? '#FFFFFF' : '#111113'}
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
	<!-- Header -->
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
						<span class="animate-pulse">Nova réfléchit…</span>
					</p>
				{/if}
			</div>
			<span class="flex-1"></span>
			<button
				type="button"
				onclick={toggleTheme}
				aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
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
					<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
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
				onclick={newChat}
				class="rounded-lg border border-(--line) bg-(--chip) px-3 py-1.5 text-xs font-medium text-(--ink-2) transition outline-none hover:bg-(--hover) hover:text-(--ink) focus-visible:ring-2 focus-visible:ring-(--ring)"
			>
				+ Nouvelle conversation
			</button>
		</div>
	</header>

	<!-- Messages -->
	<div
		bind:this={scrollEl}
		class="relative mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6"
	>
		{#if messages.length === 0}
			<div class="relative px-4 pt-10 pb-8 text-center">
				<div class="relative">
					<div
						class="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-(--line) bg-(--chip) text-2xl text-(--ink) shadow-[0_0_60px_-15px_var(--glow)] backdrop-blur-md"
					>
						✦
					</div>
					<h1
						class="mt-4 text-2xl font-semibold tracking-tight text-(--ink) [text-shadow:0_1px_16px_var(--bg)]"
					>
						Parlons avec Nova
					</h1>
				</div>
			</div>
		{:else}
			<ol class="flex flex-col gap-5">
				{#each messages as m (m.id)}
					{#if m.role === 'user'}
						<li class="flex justify-end">
							<div class="max-w-[85%]">
								{#if m.attachments && m.attachments.length > 0}
									<div class="mb-1.5 flex flex-wrap justify-end gap-1.5">
										{#each m.attachments as f}
											<span
												class="inline-flex items-center gap-1 rounded-lg bg-(--chip) px-2 py-0.5 text-xs text-(--ink-2)"
											>
												📎 {f}
											</span>
										{/each}
									</div>
								{/if}
								<div
									class="rounded-2xl rounded-br-md bg-(--user-bg) px-4 py-2.5 text-sm leading-6 font-medium text-(--user-ink) shadow-[0_2px_12px_-4px_var(--glow)] whitespace-pre-wrap"
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
											label="Réflexion…"
											doneLabel="Réfléchi pendant"
											color="var(--thought-ink)"
											glyphColor="var(--thought-ink)"
											fontSize={13}
											glyph="sparkle"
											working={busy && m.id === messages[messages.length - 1]?.id}
											steps={
												m.id === messages[messages.length - 1]?.id
													? thoughtSteps
													: (m.steps ?? [])
											}
											elapsed={
												busy && m.id === messages[messages.length - 1]?.id
													? thoughtElapsed
													: m.thoughtSeconds
											}
											showTimer={true}
											collapsible={true}
											onSettle={(s: number) => onThoughtSettle(m.id, s)}
										/>
									</div>
								{/if}
								{#if m.kind === 'image'}
									<div
										class="mb-2 overflow-hidden rounded-2xl rounded-tl-md border border-(--line)"
									>
										<GridReveal
											src={m.imageSrc ?? null}
											alt={m.imagePrompt ?? 'Image générée'}
											progress={m.imageProgress ?? 0}
											aspect={3 / 2}
											caption={m.imagePrompt ?? 'Image'}
											estimatedDuration={6000}
											onRevealComplete={() => resolveReveal(m.id)}
											onError={() => resolveReveal(m.id)}
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
										{m.content}{#if busy && m.id === messages[messages.length - 1].id}<span
												class="animate-pulse">▍</span
											>{/if}
									{:else}
										<span class="flex items-center gap-1 text-(--ink-2)">
											<i
												class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-current"
											></i>
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
								<p
									class="mt-1 flex items-center gap-2 text-[11px] tracking-wide text-(--ink-3)"
								>
									<span>{m.model ?? 'Nova 3'}</span>
									<span>·</span>
									<span>{m.effort ?? currentEffort}</span>
									<span>·</span>
									<span>{m.time}</span>
									{#if m.stopped}
										<span class="text-(--ink-2)">· arrêté</span>
									{/if}
								</p>
							</div>
						</li>
					{/if}
				{/each}
			</ol>
		{/if}
	</div>

	<!-- Input -->
	<footer
		class="relative sticky bottom-0 border-t border-(--line) bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] pb-4 backdrop-blur"
	>
		<div class="mx-auto flex w-full max-w-3xl justify-center px-4 pt-3">
			<div
				class="w-full max-w-[760px] rounded-[20px] shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] ring-1 ring-(--line)"
			>
				<PromptBar
					placeholder="Posez votre question… (@ sources, / commandes)"
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
				defaultEffort="Équilibré"
				onEffortChange={(e: string) => (currentEffort = e)}
				{busy}
				onSend={handleSend}
				onStop={handleStop}
				onAttach={handleAttach}
				onDictate={handleDictate}
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
	onchange={onFileChange}
/>
