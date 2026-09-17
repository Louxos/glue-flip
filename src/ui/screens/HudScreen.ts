import type { LandingResult } from '@/gameplay/LandingEvaluator';
import type { ScoreBreakdown } from '@/gameplay/ScoreSystem';
import type { HudState } from '@/gameplay/modes';
import { Screen } from '@/ui/Screen';
import { el, restartAnimation } from '@/utils/dom';
import type { UiCallbacks } from '@/ui/UIManager';

const RESULT_TITLES: Record<string, string> = {
  perfect: 'Perfect',
  landing: 'Landed',
  failed: 'Missed',
  lost: 'Lost it',
};

/**
 * The in-game HUD. Everything here is transient: score, combo, objective, the
 * power meter while holding, and the landing verdict.
 */
export class HudScreen extends Screen {
  private scoreValue: HTMLElement;
  private combo: HTMLElement;
  private comboValue: HTMLElement;
  private objective: HTMLElement;
  private detail: HTMLElement;
  private attempts: HTMLElement;
  private hint: HTMLElement;
  private power: HTMLElement;
  private powerFill: HTMLElement;
  private powerLabel: HTMLElement;
  private result: HTMLElement;
  private resultTitle: HTMLElement;
  private resultSub: HTMLElement;
  private resultPoints: HTMLElement;
  private lastScore = -1;

  constructor(callbacks: UiCallbacks) {
    super('gf-hud');

    this.scoreValue = el('div', { class: 'gf-hud__score-value', text: '0' });
    this.comboValue = el('span', { class: 'gf-hud__combo-value', text: '0' });
    this.combo = el('div', { class: 'gf-hud__combo' }, [
      el('span', { text: 'Combo' }),
      this.comboValue,
    ]);
    this.objective = el('div', { class: 'gf-hud__objective', text: '' });
    this.detail = el('div', { class: 'gf-hud__detail', text: '' });
    this.attempts = el('div', { class: 'gf-hud__attempts', text: '' });
    this.hint = el('div', { class: 'gf-hud__hint', text: 'Drag the glue stick to throw' });

    this.powerFill = el('div', { class: 'gf-power__fill' });
    this.powerLabel = el('div', { class: 'gf-power__label', text: '0%' });
    this.power = el('div', { class: 'gf-power' }, [
      this.powerLabel,
      el('div', { class: 'gf-power__bar' }, [this.powerFill]),
    ]);

    const pauseButton = el('button', {
      class: 'gf-icon-button',
      type: 'button',
      'aria-label': 'Pause',
      title: 'Pause (Esc)',
      html:
        '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
        '<rect x="2.5" y="1.5" width="3" height="11" rx="1.2" fill="currentColor"/>' +
        '<rect x="8.5" y="1.5" width="3" height="11" rx="1.2" fill="currentColor"/></svg>',
    });
    pauseButton.addEventListener('click', () => callbacks.onPause());

    this.resultTitle = el('div', { class: 'gf-result__title', text: '' });
    this.resultSub = el('div', { class: 'gf-result__sub', text: '' });
    this.resultPoints = el('div', { class: 'gf-result__points', text: '' });
    this.result = el('div', { class: 'gf-result' }, [
      this.resultTitle,
      this.resultSub,
      this.resultPoints,
    ]);

    this.element.append(
      el('div', { class: 'gf-hud__top' }, [
        el('div', { class: 'gf-hud__score' }, [
          el('span', { class: 'gf-eyebrow', text: 'Score' }),
          this.scoreValue,
          this.combo,
        ]),
        el('div', { class: 'gf-hud__center' }, [this.objective, this.detail]),
        el('div', { class: 'gf-hud__right' }, [this.attempts, pauseButton]),
      ]),
      el('div', { class: 'gf-hud__bottom' }, [this.hint, this.power]),
      this.result,
    );
  }

  update(state: HudState): void {
    if (state.score !== this.lastScore) {
      this.scoreValue.textContent = String(state.score);
      if (state.score > this.lastScore && this.lastScore >= 0) {
        restartAnimation(this.scoreValue, 'is-bump');
        window.setTimeout(() => this.scoreValue.classList.remove('is-bump'), 240);
      }
      this.lastScore = state.score;
    }

    this.comboValue.textContent = `×${state.combo}`;
    this.combo.classList.toggle('is-visible', state.comboVisible && state.combo > 1);

    this.objective.textContent = state.objectiveVisible ? state.objective : '';
    this.detail.textContent = state.detail;
    this.attempts.textContent =
      state.attemptsLeft !== null ? `${state.attemptsLeft} left` : '';
  }

  setHint(text: string | null): void {
    this.hint.textContent = text ?? '';
    this.hint.classList.toggle('is-hidden', !text);
  }

  /** Power meter shown while the stick is held. */
  setPower(power: number | null, rotations = 0): void {
    if (power === null) {
      this.power.classList.remove('is-visible');
      return;
    }
    this.power.classList.add('is-visible');
    this.powerFill.style.width = `${Math.round(power * 100)}%`;
    this.powerLabel.textContent = `${Math.round(power * 100)}% · ${rotations.toFixed(1)} rot`;
  }

  /** Big landing verdict. */
  showLanding(result: LandingResult, breakdown: ScoreBreakdown): void {
    this.resultTitle.textContent = RESULT_TITLES[result.status] ?? 'Missed';
    this.resultSub.textContent = result.reason;
    this.resultPoints.textContent = breakdown.success ? `+${breakdown.total}` : '';
    this.result.classList.toggle('is-perfect', result.status === 'perfect');
    this.result.classList.toggle('is-fail', result.status === 'failed' || result.status === 'lost');
    this.result.classList.remove('is-show');
    restartAnimation(this.result, 'is-show');
  }

  protected override onShow(): void {
    this.lastScore = -1;
    this.setPower(null);
  }
}
