import test from 'node:test';
import assert from 'node:assert/strict';
import { HiveMindAlgorithm } from '../src/services/HiveMindAlgorithm';
import { MatchMaker } from '../src/services/MatchMaker';

// ─── HiveMindAlgorithm unit tests ────────────────────────────────────────────

test('HiveMindAlgorithm: computeSentimentBoost returns max for fully positive sentiment', () => {
  const algo = new HiveMindAlgorithm();
  const boost = algo.computeSentimentBoost({ valence: 1, arousal: 1, dominance: 1 });
  assert.equal(boost, 20);
});

test('HiveMindAlgorithm: computeSentimentBoost returns min for fully negative sentiment', () => {
  const algo = new HiveMindAlgorithm();
  const boost = algo.computeSentimentBoost({ valence: -1, arousal: 0, dominance: 0 });
  assert.equal(boost, 0);
});

test('HiveMindAlgorithm: computeSentimentBoost clamps out-of-range inputs', () => {
  const algo = new HiveMindAlgorithm();
  // valence beyond [-1,1] and arousal/dominance beyond [0,1] must be clamped.
  const boost = algo.computeSentimentBoost({ valence: 5, arousal: -3, dominance: 99 });
  // Clamped: valence=1→norm=1, arousal=0, dominance=1
  // 1*0.5 + 0*0.3 + 1*0.2 = 0.7 → 0.7*20 = 14
  assert.equal(boost, 14);
});

test('HiveMindAlgorithm: reinforce increases weight on positive reward', () => {
  const algo = new HiveMindAlgorithm({}, 0.1);
  algo.reinforce({ featureKey: 'music', reward: 1 });
  assert.ok(algo.getWeight('music') > 1.0);
});

test('HiveMindAlgorithm: reinforce decreases weight on negative reward', () => {
  const algo = new HiveMindAlgorithm({}, 0.1);
  algo.reinforce({ featureKey: 'music', reward: -1 });
  assert.ok(algo.getWeight('music') < 1.0);
});

test('HiveMindAlgorithm: reinforce updates updateCount', () => {
  const algo = new HiveMindAlgorithm();
  algo.reinforce({ featureKey: 'travel', reward: 1 });
  algo.reinforce({ featureKey: 'movies', reward: -0.5 });
  assert.equal(algo.getMatrix().updateCount, 2);
});

test('HiveMindAlgorithm: applyWeights scales score by learned weight', () => {
  const algo = new HiveMindAlgorithm({ music: 1.5 });
  const result = algo.applyWeights(60, 'music');
  assert.equal(result, 90);
});

test('HiveMindAlgorithm: applyWeights clamps result to [0, 100]', () => {
  const algo = new HiveMindAlgorithm({ music: 10 });
  assert.equal(algo.applyWeights(99, 'music'), 100);

  const algo2 = new HiveMindAlgorithm({ music: -5 });
  assert.equal(algo2.applyWeights(50, 'music'), 0);
});

test('HiveMindAlgorithm: unseen feature defaults to weight 1.0', () => {
  const algo = new HiveMindAlgorithm();
  assert.equal(algo.getWeight('nonexistent'), 1.0);
});

test('HiveMindAlgorithm: getMatrix returns a defensive copy', () => {
  const algo = new HiveMindAlgorithm({ music: 1.2 });
  const snapshot = algo.getMatrix();
  snapshot.weights['music'] = 99;
  assert.equal(algo.getWeight('music'), 1.2);
});

// ─── MatchMaker + HiveMindAlgorithm integration ──────────────────────────────

test('MatchMaker uses HiveMind sentiment boost when algorithm is provided', () => {
  const hiveMind = new HiveMindAlgorithm();
  const matchMaker = new MatchMaker(40, hiveMind);

  const user = { id: 'u1', interestGraph: { music: 100 } };
  const candidates = [{ id: 'u2', interestGraph: { music: 100 } }];

  const ranked = matchMaker.rankCandidates(user, candidates, {
    eyeTrackingFocus: 80,
    engagementScore: 85,
    dopamineIndex: 65
  });

  assert.equal(ranked.length, 1);
  assert.ok(ranked[0]!.score > 0);
});

test('MatchMaker with HiveMind respects learned feature weights', () => {
  const hiveMind = new HiveMindAlgorithm();

  // Reinforce 'music' strongly and penalize 'gaming'.
  hiveMind.reinforce({ featureKey: 'music', reward: 5 });
  hiveMind.reinforce({ featureKey: 'gaming', reward: -0.9 });

  const matchMaker = new MatchMaker(40, hiveMind);

  const user = { id: 'u1', interestGraph: { music: 80, gaming: 80 } };
  const musicCandidate = { id: 'u2', interestGraph: { music: 80 } };
  const gamingCandidate = { id: 'u3', interestGraph: { gaming: 80 } };

  const ranked = matchMaker.rankCandidates(user, [musicCandidate, gamingCandidate], {
    eyeTrackingFocus: 50,
    engagementScore: 60
  });

  // Music candidate should rank higher because its shared feature has a much
  // higher learned weight.
  assert.equal(ranked[0]!.candidate.id, 'u2');
});

test('MatchMaker without HiveMind preserves original scoring behaviour', () => {
  const matchMaker = new MatchMaker();

  const user = { id: 'u1', interestGraph: { music: 100, travel: 80, movies: 40 } };
  const candidates = [
    { id: 'u2', interestGraph: { music: 100, travel: 75, movies: 35 } },
    { id: 'u3', interestGraph: { gaming: 90, coding: 70 } }
  ];

  const ranked = matchMaker.rankCandidates(user, candidates, {
    eyeTrackingFocus: 80,
    engagementScore: 85,
    dopamineIndex: 65
  });

  assert.equal(ranked[0]!.candidate.id, 'u2');
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});
