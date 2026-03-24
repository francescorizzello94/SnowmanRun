/**
 * Adaptive Quality System
 *
 * Detects device capabilities and provides quality presets that scene
 * components consume to scale GPU/CPU workload.
 *
 * Three tiers:
 *   LOW    — budget phones (Samsung A14, older iPads)
 *   MEDIUM — mid-range (Pixel 6a, iPhone 12)
 *   HIGH   — desktop & flagship phones
 *
 * Auto-detection runs once at startup; components read the reactive
 * `qualityTier` via context.  A one-way ratchet can drop the tier
 * if measured frame-times exceed budget.
 */

import { getContext, setContext } from 'svelte';

export type QualityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface QualitySettings {
	/** Shadow map resolution (0 = shadows OFF) */
	shadowMapSize: number;
	/** Use PCFSoftShadowMap (true) or BasicShadowMap (false). Ignored when shadowMapSize is 0. */
	softShadows: boolean;
	/** Snowballs cast shadows */
	snowballShadows: boolean;

	/** Ambient snowfall particle count */
	snowfallCount: number;
	/** Snow-spurt particle count */
	snowSpurtCount: number;
	/** Use additive blending on snow-spurt (true) or normal blending (false) */
	snowSpurtAdditive: boolean;

	/** Terrain X segments */
	terrainSegmentsX: number;
	/** Terrain Z segments */
	terrainSegmentsZ: number;
	/** Enable terrain trail deformation */
	terrainTrailEnabled: boolean;
	/** Trail update Hz (ignored when disabled) */
	terrainTrailHz: number;
	/** Max trail points (ignored when disabled) */
	terrainTrailMaxPoints: number;

	/** Frost-shield sphere segments */
	frostShieldSegments: number;
	/** Device pixel ratio cap */
	maxDpr: number;

	/** Use MeshPhysicalMaterial (true) or MeshStandardMaterial (false) for snowballs */
	physicalMaterial: boolean;
	/** Enable Fresnel edge-glow shader on snowballs */
	fresnelShader: boolean;
	/** Enable profile badge sprites above elite snowballs */
	badgeSprites: boolean;
	/** Enable rim (back) light */
	rimLight: boolean;
	/** Icosahedron detail level for snowball geometry (2-4) */
	snowballDetail: number;
}

const PRESETS: Record<QualityTier, QualitySettings> = {
	LOW: {
		shadowMapSize: 0,
		softShadows: false,
		snowballShadows: false,
		snowfallCount: 0,
		snowSpurtCount: 80,
		snowSpurtAdditive: false,
		terrainSegmentsX: 30,
		terrainSegmentsZ: 50,
		terrainTrailEnabled: false,
		terrainTrailHz: 0,
		terrainTrailMaxPoints: 0,
		frostShieldSegments: 8,
		maxDpr: 0.65,
		physicalMaterial: false,
		fresnelShader: false,
		badgeSprites: false,
		rimLight: false,
		snowballDetail: 2
	},
	MEDIUM: {
		shadowMapSize: 512,
		softShadows: false,
		snowballShadows: false,
		snowfallCount: 600,
		snowSpurtCount: 400,
		snowSpurtAdditive: false,
		terrainSegmentsX: 45,
		terrainSegmentsZ: 75,
		terrainTrailEnabled: true,
		terrainTrailHz: 12,
		terrainTrailMaxPoints: 40,
		frostShieldSegments: 12,
		maxDpr: 1.25,
		physicalMaterial: false,
		fresnelShader: false,
		badgeSprites: true,
		rimLight: false,
		snowballDetail: 3
	},
	HIGH: {
		shadowMapSize: 1024,
		softShadows: true,
		snowballShadows: false,
		snowfallCount: 1400,
		snowSpurtCount: 700,
		snowSpurtAdditive: true,
		terrainSegmentsX: 60,
		terrainSegmentsZ: 100,
		terrainTrailEnabled: true,
		terrainTrailHz: 18,
		terrainTrailMaxPoints: 80,
		frostShieldSegments: 24,
		maxDpr: 1.5,
		physicalMaterial: true,
		fresnelShader: true,
		badgeSprites: true,
		rimLight: true,
		snowballDetail: 4
	}
};

/**
 * Detect device tier from available signals.
 * Runs once before the canvas is created.
 */
export function detectQualityTier(): QualityTier {
	if (typeof window === 'undefined') return 'HIGH'; // SSR fallback

	// 1. Device memory (Chrome/Edge only)
	const mem = (navigator as { deviceMemory?: number }).deviceMemory;
	if (mem !== undefined && mem <= 2) return 'LOW';

	// 2. Hardware concurrency
	const cores = navigator.hardwareConcurrency ?? 4;
	if (cores <= 2) return 'LOW';

	// 3. Touch + low core count → likely mid-range mobile
	const isTouch = window.matchMedia('(pointer: coarse)').matches;
	if (isTouch) {
		if (cores <= 4 || (mem !== undefined && mem <= 4)) return 'MEDIUM';
		// Flagship phone: 8+ cores AND > 4 GB → still HIGH
		if (cores >= 8 && (mem === undefined || mem >= 6)) return 'HIGH';
		return 'MEDIUM';
	}

	return 'HIGH';
}

export function getPreset(tier: QualityTier): QualitySettings {
	return PRESETS[tier];
}

// ── Svelte context helpers ──────────────────────────────────────────

const QUALITY_CTX = Symbol('quality');

export interface QualityContext {
	tier: QualityTier;
	settings: QualitySettings;
}

export function createQualityContext(): QualityContext {
	const tier = detectQualityTier();
	const ctx: QualityContext = { tier, settings: getPreset(tier) };
	setContext(QUALITY_CTX, ctx);
	return ctx;
}

export function getQualityContext(): QualityContext {
	return getContext<QualityContext>(QUALITY_CTX);
}
