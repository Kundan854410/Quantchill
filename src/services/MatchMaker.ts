import { HiveMindAlgorithm, SentimentArray } from './HiveMindAlgorithm';

export interface InterestGraph {
  [interest: string]: number;
}

export interface UserProfile {
  id: string;
  interestGraph: InterestGraph;
}

export interface BCIContext {
  eyeTrackingFocus: number;
  engagementScore: number;
  dopamineIndex?: number;
}

export interface MatchResult {
  candidate: UserProfile;
  score: number;
  shouldTransitionLoop: boolean;
}

export class MatchMaker {
  constructor(
    private readonly lowEngagementThreshold = 40,
    private readonly hiveMind?: HiveMindAlgorithm
  ) {}

  rankCandidates(user: UserProfile, candidates: UserProfile[], context: BCIContext): MatchResult[] {
    return candidates
      .filter((candidate) => candidate.id !== user.id)
      .map((candidate) => ({
        candidate,
        score: this.calculateCompatibility(user.interestGraph, candidate.interestGraph, context),
        shouldTransitionLoop: this.shouldTransitionLoop(context)
      }))
      .sort((a, b) => b.score - a.score);
  }

  shouldTransitionLoop(context: BCIContext): boolean {
    return context.engagementScore < this.lowEngagementThreshold;
  }

  private calculateCompatibility(
    source: InterestGraph,
    target: InterestGraph,
    context: BCIContext
  ): number {
    const keys = new Set([...Object.keys(source), ...Object.keys(target)]);
    let overlapScore = 0;
    let totalWeight = 0;

    for (const key of keys) {
      const left = Math.max(0, source[key] ?? 0);
      const right = Math.max(0, target[key] ?? 0);

      // Apply HiveMind learned weight for this feature when available.
      const featureWeight = this.hiveMind ? this.hiveMind.getWeight(key) : 1.0;
      overlapScore += Math.min(left, right) * featureWeight;
      totalWeight += Math.max(left, right) * featureWeight;
    }

    const graphSimilarity = totalWeight === 0 ? 0 : (overlapScore / totalWeight) * 100;
    const focusBoost = Math.min(1, Math.max(0, context.eyeTrackingFocus / 100)) * 15;

    // Replace the fixed dopamine heuristic with a sentiment-driven boost when
    // a HiveMindAlgorithm is present; fall back to the legacy calculation
    // otherwise so existing behaviour is unchanged.
    let dopamineBoost: number;
    if (this.hiveMind) {
      const sentiment = this.bciContextToSentiment(context);
      dopamineBoost = this.hiveMind.computeSentimentBoost(sentiment);
    } else {
      dopamineBoost = Math.min(1, Math.max(0, (context.dopamineIndex ?? 50) / 100)) * 10;
    }

    return Number((graphSimilarity + focusBoost + dopamineBoost).toFixed(2));
  }

  /**
   * Map a BCIContext onto a SentimentArray so the HiveMindAlgorithm can
   * consume it.  Uses standard VAD (valence–arousal–dominance) normalisation:
   *  - valence:   derived from engagementScore (high engagement → positive)
   *  - arousal:   derived from eyeTrackingFocus (high focus → high arousal)
   *  - dominance: derived from dopamineIndex (optional; defaults to 0.5)
   */
  private bciContextToSentiment(context: BCIContext): SentimentArray {
    const valence = (Math.min(100, Math.max(0, context.engagementScore)) / 100) * 2 - 1;
    const arousal = Math.min(1, Math.max(0, context.eyeTrackingFocus / 100));
    const dominance = Math.min(1, Math.max(0, (context.dopamineIndex ?? 50) / 100));
    return { valence, arousal, dominance };
  }
}
