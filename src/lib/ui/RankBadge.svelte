<script lang="ts">
  import { getRankUi, heroGradientStyle, RANK_ICON_PATHS } from '$lib/ui/rank-ui';

  type Props = {
    label?: string;
    rankName: string;
  };

  let { label = 'Final Rank', rankName }: Props = $props();

  let cfg = $derived(getRankUi(rankName));
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
      <path d={RANK_ICON_PATHS[cfg.icon]} />
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
