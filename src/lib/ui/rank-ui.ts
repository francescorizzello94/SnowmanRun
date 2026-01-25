export type RankIconName = 'snowflake' | 'wind' | 'mountain' | 'crown' | 'star';

export type RankTone = 'cool' | 'vibrant' | 'deep' | 'mythic' | 'legend';

export type RankUiConfig = {
	title: string;
	accent: string;
	accent2?: string;
	tone: RankTone;
	icon: RankIconName;
};

export const RANK_UI: Record<string, RankUiConfig> = {
	NEWCOMER: {
		title: 'NEWCOMER',
		accent: '#334155',
		tone: 'cool',
		icon: 'snowflake'
	},
	SURVIVOR: {
		title: 'SURVIVOR',
		accent: '#0891b2',
		tone: 'vibrant',
		icon: 'wind'
	},
	'FROST WALKER': {
		title: 'FROST WALKER',
		accent: '#1d4ed8',
		tone: 'deep',
		icon: 'mountain'
	},
	'BLIZZARD RUNNER': {
		title: 'BLIZZARD RUNNER',
		accent: '#4338ca',
		tone: 'deep',
		icon: 'mountain'
	},
	'AVALANCHE MASTER': {
		title: 'AVALANCHE MASTER',
		accent: '#a855f7',
		accent2: '#ec4899',
		tone: 'mythic',
		icon: 'crown'
	},
	'WINTER LEGEND': {
		title: 'WINTER LEGEND',
		accent: '#f59e0b',
		accent2: '#ffffff',
		tone: 'legend',
		icon: 'star'
	},

	// Spec aliases (in case we rename ranks later)
	'BLIZZARD WALKER': {
		title: 'BLIZZARD WALKER',
		accent: '#4338ca',
		tone: 'deep',
		icon: 'mountain'
	},
	'ABSOLUTE ZERO': {
		title: 'ABSOLUTE ZERO',
		accent: '#f59e0b',
		accent2: '#ffffff',
		tone: 'legend',
		icon: 'star'
	}
};

export const RANK_ICON_PATHS: Record<RankIconName, string> = {
	// Simple snowflake (6-armed)
	snowflake:
		'M12 2v20M12 2l2.5 2.5M12 2L9.5 4.5M12 22l2.5-2.5M12 22L9.5 19.5M2 12h20M2 12l2.5-2.5M2 12l2.5 2.5M22 12l-2.5-2.5M22 12l-2.5 2.5M4.5 4.5l15 15M19.5 4.5l-15 15',

	// Wind swirl
	wind: 'M3 8h10a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M3 16h9a2 2 0 1 1-2 2',

	// Mountain
	mountain: 'M3 20l6-10 3 5 3-5 6 10H3Z',

	// Crown
	crown: 'M3 8l4 4 5-8 5 8 4-4v10H3V8Z',

	// Star
	star: 'M12 2l2.8 6.1 6.7.6-5 4.3 1.5 6.6L12 16.9 6 19.6l1.5-6.6-5-4.3 6.7-.6L12 2Z'
};

export function normalizeRankKey(name: string): string {
	const raw = (name ?? '').trim();
	if (!raw) return 'NEWCOMER';

	if (raw in RANK_UI) return raw;

	const normalized = raw.toUpperCase().replace(/\s+/g, ' ');
	if (normalized in RANK_UI) return normalized;

	return 'NEWCOMER';
}

export function getRankUi(rankName: string): RankUiConfig {
	return RANK_UI[normalizeRankKey(rankName)];
}

export function heroGradientStyle(c: RankUiConfig): string {
	if (c.tone === 'mythic') {
		return `linear-gradient(135deg, ${c.accent} 0%, ${c.accent2 ?? c.accent} 100%)`;
	}
	if (c.tone === 'legend') {
		return 'linear-gradient(135deg, rgba(245, 158, 11, 0.85) 0%, rgba(255, 255, 255, 0.85) 70%)';
	}
	return `linear-gradient(135deg, ${c.accent} 0%, ${c.accent} 100%)`;
}
