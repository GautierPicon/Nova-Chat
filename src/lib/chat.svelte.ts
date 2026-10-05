import { SvelteMap } from 'svelte/reactivity';
import type { PromptBarSendDetail } from './components/PromptBar.svelte';
import type { ChatMessage } from './demo';
import { fakeAnswer } from './demo';

interface SpeechRecognitionInstance {
	lang: string;
	interimResults: boolean;
	onresult: ((event: SpeechRecognitionResult) => void) | null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
	start: () => void;
}

interface SpeechRecognitionResult {
	results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
}

function now(): string {
	return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export class ChatStore {
	messages = $state<ChatMessage[]>([]);
	busy = $state(false);
	isDark = $state(true);
	currentEffort = $state('Balanced');
	thoughtSteps = $state<string[]>([]);
	thoughtElapsed = $state(0);

	private pendingFiles: { resolve: (names: string[]) => void } | null = null;
	private streamTimer: ReturnType<typeof setInterval> | null = null;
	private streamReject: (() => void) | null = null;
	private thinkTimer: ReturnType<typeof setTimeout> | null = null;
	private thinkReject: (() => void) | null = null;
	private genTimer: ReturnType<typeof setInterval> | null = null;
	private activeAssistantId: number | null = null;
	private pendingResolve: (() => void) | null = null;
	private revealWaiters = new SvelteMap<number, () => void>();
	private thoughtTimers: ReturnType<typeof setTimeout>[] = [];
	private thoughtT0 = 0;
	private thoughtClock: ReturnType<typeof setInterval> | null = null;
	private idCounter = 0;

	resolveReveal = (id: number) => {
		this.revealWaiters.get(id)?.();
	};

	private clearThoughtTimers() {
		this.thoughtTimers.forEach((t) => clearTimeout(t));
		this.thoughtTimers = [];
	}

	private startThoughtClock() {
		this.stopThoughtClock();
		this.thoughtT0 = performance.now();
		this.thoughtElapsed = 0;
		this.thoughtClock = setInterval(() => {
			this.thoughtElapsed = Math.round((performance.now() - this.thoughtT0) / 100) / 10;
		}, 100);
	}

	private stopThoughtClock() {
		if (this.thoughtClock) clearInterval(this.thoughtClock);
		this.thoughtClock = null;
	}

	private thoughtFinal() {
		return Math.round((performance.now() - this.thoughtT0) / 100) / 10;
	}

	private settleThought(id: number, stopped: boolean, fallback = '') {
		const final = this.thoughtFinal();
		this.stopThoughtClock();
		this.messages = this.messages.map((m) =>
			m.id === id
				? {
						...m,
						...(stopped ? { stopped: true, content: m.content || fallback } : {}),
						thoughtSeconds: m.thoughtSeconds ?? final,
						steps: m.steps?.length ? m.steps : [...this.thoughtSteps]
					}
				: m
		);
	}

	onThoughtSettle = (id: number, seconds: number) => {
		this.messages = this.messages.map((m) =>
			m.id === id
				? {
						...m,
						thoughtSeconds: m.thoughtSeconds ?? (seconds > 0 ? seconds : undefined),
						steps: m.steps?.length ? m.steps : [...this.thoughtSteps]
					}
				: m
		);
	};

	initTheme = () => {
		this.isDark = document.documentElement.classList.contains('dark');
	};

	toggleTheme = () => {
		this.isDark = !this.isDark;
		document.documentElement.classList.toggle('dark', this.isDark);
		try {
			localStorage.setItem('nova-theme', this.isDark ? 'dark' : 'light');
		} catch {
			document.documentElement.classList.add('dark');
		}
	};

	handleSend = async (text: string, detail: PromptBarSendDetail) => {
		if (this.busy) return;
		const userMsg: ChatMessage = {
			id: ++this.idCounter,
			role: 'user',
			content: text,
			model: detail.model?.name,
			effort: detail.effort,
			attachments: [...detail.attachments],
			time: now()
		};
		this.messages = [...this.messages, userMsg];
		if (detail.effort) this.currentEffort = detail.effort;

		this.busy = true;
		const assistantId = ++this.idCounter;
		this.activeAssistantId = assistantId;
		const clean = text.trim();
		const isImage = clean.toLowerCase().startsWith('/image');
		const imagePrompt = isImage
			? clean.replace(/^\/image\s*/i, '').trim() || 'dreamlike landscape'
			: '';
		const full = isImage
			? ''
			: fakeAnswer(this.messages, text, detail, detail.effort ?? this.currentEffort);
		const speed = (detail.effort ?? this.currentEffort) === 'Quick' ? 14 : 26;

		this.clearThoughtTimers();
		this.thoughtSteps = [];
		this.startThoughtClock();
		if (!isImage) {
			['Analyzing the question', 'Preparing the answer', 'Checking the tone'].forEach((step, i) => {
				this.thoughtTimers.push(
					setTimeout(
						() => {
							this.thoughtSteps = [...this.thoughtSteps, step];
						},
						500 + i * 1000
					)
				);
			});
		}

		this.messages = [
			...this.messages,
			{
				id: assistantId,
				role: 'assistant',
				content: '',
				kind: isImage ? 'image' : 'text',
				imagePrompt: isImage ? imagePrompt : undefined,
				imageProgress: isImage ? 0 : undefined,
				model: detail.model?.name ?? 'Nova 3',
				effort: detail.effort ?? this.currentEffort,
				time: now()
			}
		];

		await new Promise<void>((resolve) => {
			this.pendingResolve = resolve;
			const finish = () => {
				this.pendingResolve = null;
				this.thinkReject = null;
				this.streamReject = null;
				resolve();
			};
			const markStopped = (fallback: string) => {
				this.settleThought(assistantId, true, fallback);
			};
			this.streamReject = () => {
				if (this.streamTimer) clearInterval(this.streamTimer);
				this.streamTimer = null;
				markStopped('');
				finish();
			};
			this.thinkReject = () => {
				if (this.thinkTimer) clearTimeout(this.thinkTimer);
				this.thinkTimer = null;
				markStopped('_Thinking interrupted._');
				finish();
			};
			this.thinkTimer = setTimeout(() => {
				this.thinkTimer = null;
				this.thinkReject = null;
				if (!isImage) {
					let i = 0;
					this.streamTimer = setInterval(() => {
						i += speed;
						const slice = full.slice(0, i);
						this.messages = this.messages.map((m) =>
							m.id === assistantId ? { ...m, content: slice } : m
						);
						if (i >= full.length) {
							if (this.streamTimer) clearInterval(this.streamTimer);
							this.streamTimer = null;
							finish();
						}
					}, 40);
					return;
				}
				this.streamReject = () => {
					if (this.genTimer) clearInterval(this.genTimer);
					this.genTimer = null;
					this.revealWaiters.delete(assistantId);
					markStopped('');
					finish();
				};
				this.genTimer = setInterval(() => {
					const cur = this.messages.find((m) => m.id === assistantId)?.imageProgress ?? 0;
					const p = Math.min(0.9, Math.round((cur + 0.03) * 100) / 100);
					this.messages = this.messages.map((m) =>
						m.id === assistantId ? { ...m, imageProgress: p } : m
					);
					if (p < 0.9 || !this.genTimer) return;
					clearInterval(this.genTimer);
					this.genTimer = null;
					const seed =
						imagePrompt
							.toLowerCase()
							.replace(/[^a-z0-9]+/gi, '-')
							.replace(/^-+|-+$/g, '')
							.slice(0, 40) || 'nova';
					this.messages = this.messages.map((m) =>
						m.id === assistantId
							? { ...m, imageSrc: `https://picsum.photos/seed/${seed}/900/600` }
							: m
					);
					const to = setTimeout(() => {
						this.revealWaiters.delete(assistantId);
						finish();
					}, 20000);
					this.revealWaiters.set(assistantId, () => {
						clearTimeout(to);
						this.revealWaiters.delete(assistantId);
						finish();
					});
				}, 120);
			}, 3000);
		});

		this.activeAssistantId = null;
		this.pendingResolve = null;
		if (this.genTimer) {
			clearInterval(this.genTimer);
			this.genTimer = null;
		}
		this.settleThought(assistantId, false);
		this.busy = false;
		this.streamReject = null;
		this.thinkReject = null;
		this.clearThoughtTimers();
	};

	handleStop = () => {
		this.thinkReject?.();
		this.streamReject?.();
		if (this.activeAssistantId !== null && this.revealWaiters.delete(this.activeAssistantId)) {
			this.settleThought(this.activeAssistantId, true);
			this.pendingResolve?.();
			this.pendingResolve = null;
		}
		this.clearThoughtTimers();
		this.busy = false;
	};

	newChat = () => {
		this.handleStop();
		this.messages = [];
		this.thoughtSteps = [];
	};

	handleAttach = (input: HTMLInputElement | null): Promise<string[]> => {
		return new Promise((resolve) => {
			this.pendingFiles = { resolve };
			input?.click();
		});
	};

	onFileChange = (e: Event & { currentTarget: HTMLInputElement }) => {
		const files = Array.from(e.currentTarget.files ?? []).map((f) => f.name);
		this.pendingFiles?.resolve(files);
		this.pendingFiles = null;
		e.currentTarget.value = '';
	};

	handleDictate = (): Promise<string> => {
		return new Promise((resolve) => {
			const w = window as unknown as {
				SpeechRecognition?: new () => SpeechRecognitionInstance;
				webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
			};
			const Rec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
			if (!Rec) {
				setTimeout(() => resolve('Hello Nova, explain this component to me'), 1200);
				return;
			}
			try {
				const rec = new Rec();
				rec.lang = 'en-US';
				rec.interimResults = false;
				rec.onresult = (ev: SpeechRecognitionResult) => {
					resolve(ev.results?.[0]?.[0]?.transcript ?? '');
				};
				rec.onerror = () => resolve('');
				rec.onend = () => resolve('');
				rec.start();
			} catch {
				resolve('');
			}
		});
	};
}
