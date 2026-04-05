/**
 * HiveMindAlgorithm – reinforcement matrix for match-score refinement.
 *
 * Accepts standard sentiment arrays (valence / arousal / dominance) as a
 * mock substitute for live BCI telemetry.  A lightweight online-learning
 * weight matrix is updated via `reinforce()` whenever an outcome signal is
 * available; `applyWeights()` then adjusts raw compatibility scores before
 * they are returned to callers.
 */

/** Standard three-dimensional sentiment vector (VAD model). */
export interface SentimentArray {
  /** Positive–negative axis, clamped to [-1, 1]. */
  valence: number;
  /** Calm–excited axis, clamped to [0, 1]. */
  arousal: number;
  /** Submissive–dominant axis, clamped to [0, 1]. */
  dominance: number;
}

/** A single outcome-feedback event used to update the matrix. */
export interface ReinforcementFeedback {
  /** Identifies the feature dimension being reinforced (e.g. "music"). */
  featureKey: string;
  /**
   * Signed reward signal: positive values strengthen the weight,
   * negative values weaken it.
   */
  reward: number;
}

/** Snapshot of the current weight matrix state. */
export interface ReinforcementMatrix {
  weights: Record<string, number>;
  updateCount: number;
}

export class HiveMindAlgorithm {
  private readonly matrix: ReinforcementMatrix;

  /**
   * @param learningRate  Step size for weight updates (default 0.1).
   * @param initialWeights  Optional seed weights keyed by feature name.
   */
  constructor(
    private readonly learningRate = 0.1,
    initialWeights: Record<string, number> = {}
  ) {
    this.matrix = {
      weights: { ...initialWeights },
      updateCount: 0
    };
  }

  /**
   * Compute a sentiment-driven boost in [0, 20] from a VAD vector.
   *
   * The mapping normalises each dimension to [0, 1] and applies fixed
   * contribution weights (valence 50 %, arousal 30 %, dominance 20 %).
   */
  computeSentimentBoost(sentiment: SentimentArray): number {
    const valenceNorm = (Math.min(1, Math.max(-1, sentiment.valence)) + 1) / 2;
    const arousalNorm = Math.min(1, Math.max(0, sentiment.arousal));
    const dominanceNorm = Math.min(1, Math.max(0, sentiment.dominance));

    return Number(((valenceNorm * 0.5 + arousalNorm * 0.3 + dominanceNorm * 0.2) * 20).toFixed(2));
  }

  /**
   * Apply one step of gradient-free reinforcement to the named feature weight.
   * Uses a simple additive update: w ← w + α · r
   */
  reinforce(feedback: ReinforcementFeedback): void {
    const current = this.matrix.weights[feedback.featureKey] ?? 1.0;
    this.matrix.weights[feedback.featureKey] = Number(
      (current + this.learningRate * feedback.reward).toFixed(4)
    );
    this.matrix.updateCount += 1;
  }

  /** Return the current weight for a feature (defaults to 1.0 if unseen). */
  getWeight(featureKey: string): number {
    return this.matrix.weights[featureKey] ?? 1.0;
  }

  /**
   * Multiply a raw compatibility score by the learned feature weight.
   * The result is clamped to [0, 100] and rounded to 2 decimal places.
   */
  applyWeights(rawScore: number, featureKey: string): number {
    const weighted = rawScore * this.getWeight(featureKey);
    return Number(Math.min(100, Math.max(0, weighted)).toFixed(2));
  }

  /** Return a defensive copy of the current matrix state. */
  getMatrix(): Readonly<ReinforcementMatrix> {
    return { weights: { ...this.matrix.weights }, updateCount: this.matrix.updateCount };
  }
}
