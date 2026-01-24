<script lang="ts">
  export type RankBadgeConfig = {
    title: string;
    accent: string;
    accent2?: string;
    tone: 'cool' | 'vibrant' | 'deep' | 'mythic' | 'legend';
    icon: 'snowflake' | 'wind' | 'mountain' | 'crown' | 'star';
  };

  type Props = {
    label?: string;
    rankName: string;
  };

  let { label = 'Final Rank', rankName }: Props = $props();

  const RANK_CONFIG: Record<string, RankBadgeConfig> = {
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

  const ICON_PATHS: Record<RankBadgeConfig['icon'], string> = {
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

  function normalizeRankKey(name: string): string {
    const raw = (name ?? '').trim();
    if (!raw) return 'NEWCOMER';

    // Prefer exact keys first.
    if (raw in RANK_CONFIG) return raw;

    // Fall back to uppercase with single spaces.
    const normalized = raw.toUpperCase().replace(/\s+/g, ' ');
    if (normalized in RANK_CONFIG) return normalized;

    return 'NEWCOMER';
  }

  let cfg = $derived(RANK_CONFIG[normalizeRankKey(rankName)]);

  function heroGradientStyle(c: RankBadgeConfig): string {
    if (c.tone === 'mythic') {
      return `linear-gradient(135deg, ${c.accent} 0%, ${c.accent2 ?? c.accent} 100%)`;
    }
    if (c.tone === 'legend') {
      return `linear-gradient(135deg, rgba(245, 158, 11, 0.85) 0%, rgba(255, 255, 255, 0.85) 70%)`;
    }
    return `linear-gradient(135deg, ${c.accent} 0%, ${c.accent} 100%)`;
  }
</script>

<div
  class="rank-hero tone-{cfg.tone}"
  style="--accent: {cfg.accent}; --accent2: {cfg.accent2 ?? cfg.accent}; --hero-gradient: {heroGradientStyle(cfg)}"
  role="group"
  aria-label="{label}: {cfg.title}"
>
  <div class="rank-hero__bg" aria-hidden="true"></div>

  <div class="rank-hero__label">{label}</div>

  <div class="rank-hero__icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d={ICON_PATHS[cfg.icon]} />
    </svg>
  </div>

  <div class="rank-hero__name">{cfg.title}</div>
  <div class="rank-hero__sub">Press Enter / Space to play again</div>
</div>

<style>
  .rank-hero {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.45rem;
    padding: 1.25rem 1.25rem 1.1rem 1.25rem;
    border-radius: 18px;

    /* Frosted container (glassmorphism) */
    background: rgba(255, 255, 255, 0.62);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.45);

    box-shadow:
      0 10px 26px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05);

    overflow: hidden;
    min-width: 15rem;
  }

  .rank-hero__bg {
    position: absolute;
    inset: -2px;
    background: var(--hero-gradient);
    opacity: 0.11;
    filter: saturate(1.15);
    pointer-events: none;
  }

  /* Tiered “inner glow” */
  .rank-hero.tone-cool {
    box-shadow:
      0 10px 26px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05),
      inset 0 0 18px rgba(51, 65, 85, 0.12);
  }

  .rank-hero.tone-vibrant {
    box-shadow:
      0 10px 26px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05),
      inset 0 0 22px color-mix(in srgb, var(--accent) 30%, transparent);
  }

  .rank-hero.tone-deep {
    box-shadow:
      0 10px 26px rgba(15, 23, 42, 0.14),
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05),
      inset 0 0 26px color-mix(in srgb, var(--accent) 34%, transparent);
  }

  .rank-hero.tone-mythic {
    box-shadow:
      0 12px 30px rgba(15, 23, 42, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.72),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05),
      inset 0 0 30px color-mix(in srgb, var(--accent) 36%, transparent);
  }

  .rank-hero.tone-legend {
    box-shadow:
      0 14px 34px rgba(15, 23, 42, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.75),
      inset 0 0 0 1px rgba(15, 23, 42, 0.05),
      inset 0 0 34px rgba(245, 158, 11, 0.22);
  }

  .rank-hero__label {
    position: relative;
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #334155;
  }

  .rank-hero__icon {
    position: relative;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 999px;
    display: grid;
    place-items: center;

    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.6);

    box-shadow:
      0 8px 18px rgba(15, 23, 42, 0.12),
      inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);

    color: var(--accent);
  }

  .rank-hero__icon svg {
    width: 1.9rem;
    height: 1.9rem;
    color: var(--accent);
  }

  .rank-hero__name {
    position: relative;

    /* Hero treatment */
    font-size: 2.35rem;
    line-height: 1.02;
    font-weight: 950;
    letter-spacing: 0.02em;

    /* Accessibility: ensure readable against light glass */
    color: #0f172a;

    text-shadow:
      0 2px 10px rgba(15, 23, 42, 0.16);
  }

  /* Rank-colored emphasis without sacrificing contrast */
  .rank-hero__name::after {
    content: '';
    display: block;
    margin: 0.45rem auto 0 auto;
    width: 6.5rem;
    height: 6px;
    border-radius: 999px;
    background: var(--hero-gradient);
    opacity: 0.9;
    filter: saturate(1.1);
  }

  .rank-hero__sub {
    position: relative;
    font-size: 0.95rem;
    font-weight: 700;
    color: #334155;
    opacity: 0.9;
  }

  /* Newcomer: explicitly dark slate label/name */
  .rank-hero.tone-cool .rank-hero__name {
    color: #334155;
  }

  @media (max-width: 540px), (max-height: 740px) {
    .rank-hero {
      min-width: 0;
      width: 100%;
      padding: 1.05rem 1.05rem 0.95rem 1.05rem;
    }

    .rank-hero__name {
      font-size: 2.05rem;
    }
  }
</style>
