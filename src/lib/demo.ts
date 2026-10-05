import type { PromptBarSendDetail } from './components/PromptBar.svelte';

export type Role = 'user' | 'assistant';

export interface ChatMessage {
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

export const models = [
	{ key: 'nova-3', name: 'Nova 3', tag: 'Powerful' },
	{ key: 'nova-mini', name: 'Nova Mini', tag: 'Fast' },
	{ key: 'nova-2', name: 'Nova 2', tag: 'Light' }
];

export const efforts = ['Quick', 'Balanced', 'Thorough', 'Expert', 'Max'];

export const commands = [
	{ key: 'summarize', name: '/summarize', description: 'Summarize the conversation' },
	{ key: 'compare', name: '/compare', description: 'Compare two options' },
	{ key: 'draft', name: '/draft', description: 'Write a first draft' },
	{ key: 'explain', name: '/explain', description: 'Plain-language explanation' },
	{ key: 'tasks', name: '/tasks', description: 'Turn this into a to-do list' },
	{ key: 'image', name: '/image', description: 'Generate an image' }
];

export function fakeAnswer(
	history: ChatMessage[],
	text: string,
	detail: PromptBarSendDetail,
	effort: string
): string {
	const t = text.trim();
	const lower = t.toLowerCase();
	const modelName = detail.model?.name ?? 'Nova 3';
	const attachNote =
		detail.attachments.length > 0
			? `\n\n📎 Noted ${detail.attachments.length} file(s): ${detail.attachments.join(', ')}.`
			: '';

	if (lower.startsWith('/summarize')) {
		const n = history.filter((m) => m.role === 'user').length;
		return `Here's a summary of our exchange (${n} message(s)):\n\n• You're exploring the Nova interface with PromptBar.\n• Current effort: ${effort}, model: ${modelName}.\n• Current topic: "${t.replace(/^\/summarize\s*/i, '') || 'general discussion'}".\n\nTell me if you want a shorter or more detailed summary.${attachNote}`;
	}
	if (lower.startsWith('/compare')) {
		const subject = t.replace(/^\/compare\s*/i, '') || 'option A vs option B';
		return `Comparison — ${subject}:\n\n**Option 1**: simple, quick to set up, ideal for validating.\n**Option 2**: more powerful, better long term, but more costly.\n\nMy take (effort ${effort}): start with option 1, migrate if it takes off.${attachNote}`;
	}
	if (lower.startsWith('/draft')) {
		const subject = t.replace(/^\/draft\s*/i, '') || 'your message';
		return `Here's a first draft:\n\n---\n\nSubject: ${subject}\n\nHello,\n\nI'm writing about "${subject}". Here's my proposal in 3 points: context, value delivered, concrete next step.\n\nWould you be available this week to discuss it?\n\nBest regards${attachNote}\n\n---\n\nTell me the tone you want (formal, friendly, direct) and I'll adjust it.`;
	}
	if (lower.startsWith('/explain')) {
		const subject = t.replace(/^\/explain\s*/i, '') || 'this concept';
		return `Simple explanation — ${subject}:\n\n1. **The basic idea**: start from a concrete problem.\n2. **The mechanism**: break it into small steps.\n3. **The example**: imagine each step is a LEGO brick.\n\nIn ${effort} mode, I can go ${effort === 'Quick' ? 'straight to the essentials' : 'much deeper with code examples'}. Shall we dig in?${attachNote}`;
	}
	if (lower.startsWith('/tasks')) {
		const subject = t.replace(/^\/tasks\s*/i, '') || 'your goal';
		return `To-do — ${subject}:\n\n- [ ] Frame the goal in one sentence\n- [ ] List the 3 main risks\n- [ ] Build a prototype in 2 days\n- [ ] Test with 3 users\n- [ ] Iterate and plan v1${attachNote}`;
	}
	if (lower.startsWith('@')) {
		return `Noted the context "${t}". In ${effort} mode with ${modelName}, here's how I'd use it: I cross-reference this source with your question for a focused answer.\n\nAsk your actual question and I'll answer it directly.${attachNote}`;
	}

	const long = ['Thorough', 'Expert', 'Max'].includes(effort);
	let base = `Good question! Here's my answer (${modelName} model, ${effort} effort):\n\n"${t}" — I start from the need, then suggest a concrete plan:\n\n1. **Understand**: restate the problem in one sentence.\n2. **Act**: the smallest useful step you can take today.\n3. **Validate**: how to measure that it works.`;
	if (long) {
		base += `\n\n**Going further**:\n- Concrete example for your case\n- Common mistakes to avoid\n- 3 resources to dig deeper\n\nSay "expand on point 2" and I'll elaborate.`;
	} else {
		base += `\n\nSwitch effort to Max for an ultra-detailed version with sparks ✨.`;
	}
	return base + attachNote;
}
