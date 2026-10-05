<script lang="ts">
	import PromptBar from '../lib/components/PromptBar.svelte';
	import type { PromptBarSendDetail } from '../lib/components/PromptBar.svelte';

	type Role = 'user' | 'assistant';
	interface ChatMessage {
		id: number;
		role: Role;
		content: string;
		model?: string;
		effort?: string;
		attachments?: string[];
		time: string;
		stopped?: boolean;
	}

	let messages = $state<ChatMessage[]>([]);
	let busy = $state(false);
	let currentEffort = $state('Équilibré');
	let scrollEl = $state<HTMLDivElement | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let pendingFiles = $state<{ resolve: (v: string[]) => void } | null>(null);
	let streamTimer: ReturnType<typeof setInterval> | null = null;
	let streamReject: (() => void) | null = null;
	let idCounter = $state(0);

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
		{ key: 'taches', name: '/taches', description: 'Transforme en to-do list' }
	];

	const suggestions = [
		{ title: 'Expliquer', text: 'Explique-moi la photosynthèse simplement' },
		{ title: 'Comparer', text: '/comparer Svelte et React pour un SaaS' },
		{ title: 'Brouillon', text: '/brouillon un email de candidature spontanée' },
		{ title: 'To-do', text: '/taches lancer mon app IA en 2 semaines' }
	];

	function now(): string {
		return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
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
		const full = fakeAnswer(text, detail, detail.effort ?? currentEffort);
		const vitesse = (detail.effort ?? currentEffort) === 'Rapide' ? 14 : 26;

		// Message assistant vide, rempli en streaming
		messages = [
			...messages,
			{
				id: assistantId,
				role: 'assistant',
				content: '',
				model: detail.model?.name ?? 'Nova 3',
				effort: detail.effort ?? currentEffort,
				time: now()
			}
		];

		await new Promise<void>((resolve) => {
			let i = 0;
			streamReject = () => {
				if (streamTimer) clearInterval(streamTimer);
				streamTimer = null;
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, stopped: true } : m
				);
				resolve();
			};
			streamTimer = setInterval(() => {
				i += vitesse;
				const slice = full.slice(0, i);
				messages = messages.map((m) =>
					m.id === assistantId ? { ...m, content: slice } : m
				);
				if (i >= full.length) {
					if (streamTimer) clearInterval(streamTimer);
					streamTimer = null;
					streamReject = null;
					resolve();
				}
			}, 40);
		});

		busy = false;
		streamReject = null;
	}

	function handleStop() {
		streamReject?.();
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
	}

	function sendSuggestion(text: string) {
		handleSend(text, { attachments: [], model: models[0] as any, effort: currentEffort });
	}
</script>

<svelte:head>
	<title>Nova — Interface IA</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-[#161210] text-[#F5EFE9]">
	<!-- Header -->
	<header
		class="sticky top-0 z-10 border-b border-white/10 bg-[#161210]/90 backdrop-blur"
	>
		<div class="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
			<span
				class="grid h-8 w-8 place-items-center rounded-xl bg-[#FFB089] text-lg font-bold text-[#211812]"
				aria-hidden="true">✦</span
			>
			<div class="leading-tight">
				<p class="text-sm font-semibold">Nova Chat</p>
				<p class="text-xs text-white/50">
					{#if busy}
						<span class="animate-pulse">Nova réfléchit…</span>
					{:else}
						En ligne · {currentEffort}
					{/if}
				</p>
			</div>
			<span class="flex-1"></span>
			<button
				type="button"
				onclick={newChat}
				class="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
			>
				+ Nouvelle conversation
			</button>
		</div>
	</header>

	<!-- Messages -->
	<div bind:this={scrollEl} class="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-4 py-6">
		{#if messages.length === 0}
			<div class="pt-10 text-center">
				<div
					class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#3A312A] text-2xl shadow-lg"
				>
					✦
				</div>
				<h1 class="mt-4 text-2xl font-semibold tracking-tight">Parlons avec Nova</h1>
				<p class="mx-auto mt-2 max-w-md text-sm text-white/55">
					Posez une question, tapez <code class="rounded bg-white/10 px-1">@</code> pour les
					sources, <code class="rounded bg-white/10 px-1">/</code> pour les commandes. Réglez
					l'effort jusqu'à Max pour les étincelles.
				</p>
				<div class="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
					{#each suggestions as s}
						<button
							type="button"
							onclick={() => sendSuggestion(s.text)}
							class="rounded-xl border border-white/10 bg-[#221C17] p-3 text-left transition hover:border-[#FFB089]/40 hover:bg-[#2A231D]"
						>
							<p class="text-xs font-semibold text-[#FFB089]">{s.title}</p>
							<p class="mt-1 text-sm text-white/80">{s.text}</p>
						</button>
					{/each}
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
												class="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-xs text-white/70"
											>
												📎 {f}
											</span>
										{/each}
									</div>
								{/if}
								<div
									class="rounded-2xl rounded-br-md bg-[#3A312A] px-4 py-2.5 text-sm leading-6 whitespace-pre-wrap"
								>
									{m.content}
								</div>
								<p class="mt-1 text-right text-[11px] text-white/35">{m.time}</p>
							</div>
						</li>
					{:else}
						<li class="flex gap-3">
							<span
								class="grid h-8 w-8 flex-none place-items-center rounded-xl bg-[#FFB089]/15 text-base text-[#FFB089]"
								aria-hidden="true">✦</span
							>
							<div class="min-w-0 flex-1">
								<div
									class="rounded-2xl rounded-tl-md border border-white/8 bg-[#221C17] px-4 py-3 text-sm leading-6 whitespace-pre-wrap"
								>
									{#if m.content}
										{m.content}{#if busy && m.id === messages[messages.length - 1].id}<span
												class="animate-pulse">▍</span
											>{/if}
									{:else}
										<span class="flex items-center gap-1 text-white/50">
											<i
												class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFB089]"
											></i>
											<i
												class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFB089] [animation-delay:150ms]"
											></i>
											<i
												class="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#FFB089] [animation-delay:300ms]"
											></i>
										</span>
									{/if}
								</div>
								<p class="mt-1 flex items-center gap-2 text-[11px] text-white/35">
									<span>{m.model ?? 'Nova 3'}</span>
									<span>·</span>
									<span>{m.effort ?? currentEffort}</span>
									<span>·</span>
									<span>{m.time}</span>
									{#if m.stopped}
										<span class="text-[#FFB089]">· arrêté</span>
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
	<footer class="sticky bottom-0 border-t border-white/10 bg-[#161210]/95 pb-4 backdrop-blur">
		<div class="mx-auto flex w-full max-w-3xl justify-center px-4 pt-3">
			<PromptBar
				placeholder="Posez votre question… (@ sources, / commandes)"
				background="#3A312A"
				color="#F5EFE9"
				menuBackground="#493D33"
				sparkColor="#FFB089"
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
		<p class="mt-2 text-center text-[11px] text-white/30">
			Entrée pour envoyer · Maj+Entrée pour un saut de ligne · Demo locale sans backend
		</p>
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
