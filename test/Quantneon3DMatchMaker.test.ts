import test from 'node:test';
import assert from 'node:assert/strict';
import { Quantneon3DMatchMaker, Quantneon3DProfile } from '../src/services/3d/Quantneon3DMatchMaker';
import { BCIContext } from '../src/services/MatchMaker';

test('Quantneon3DMatchMaker enhances scores for 3D hologram availability', () => {
  const matchMaker = new Quantneon3DMatchMaker(undefined, 40);

  const user: Quantneon3DProfile = {
    id: 'u1',
    interestGraph: { music: 100, travel: 80 }
  };

  const candidates: Quantneon3DProfile[] = [
    {
      id: 'u2',
      interestGraph: { music: 85, travel: 70 },
      hologramMeshUrl: 'https://example.com/hologram.gltf'
    },
    {
      id: 'u3',
      interestGraph: { music: 85, travel: 72 }
    }
  ];

  const context: BCIContext = {
    eyeTrackingFocus: 80,
    engagementScore: 75,
    dopamineIndex: 60
  };

  const ranked = matchMaker.rankCandidates(user, candidates, context);

  // u2 should rank higher due to hologram availability bonus
  assert.equal(ranked[0]?.candidate.id, 'u2');
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test('Quantneon3DMatchMaker gives higher score for ultra quality 3D scans', () => {
  const matchMaker = new Quantneon3DMatchMaker(undefined, 40);

  const user: Quantneon3DProfile = {
    id: 'u1',
    interestGraph: { gaming: 100 }
  };

  const candidates: Quantneon3DProfile[] = [
    {
      id: 'u2',
      interestGraph: { gaming: 100 },
      hologramMeshUrl: 'url',
      avatar3DData: {
        scanDate: '2026-04-01',
        quality: 'ultra',
        format: 'gltf'
      }
    },
    {
      id: 'u3',
      interestGraph: { gaming: 100 },
      hologramMeshUrl: 'url',
      avatar3DData: {
        scanDate: '2026-04-01',
        quality: 'medium',
        format: 'gltf'
      }
    }
  ];

  const context: BCIContext = {
    eyeTrackingFocus: 80,
    engagementScore: 75,
    dopamineIndex: 60
  };

  const ranked = matchMaker.rankCandidates(user, candidates, context);

  // u2 should rank higher due to ultra quality
  assert.equal(ranked[0]?.candidate.id, 'u2');
  assert.ok(ranked[0]!.score > ranked[1]!.score);
});

test('Quantneon3DMatchMaker inherits base MatchMaker behavior', () => {
  const matchMaker = new Quantneon3DMatchMaker(undefined, 40);

  const user: Quantneon3DProfile = {
    id: 'u1',
    interestGraph: { music: 100, travel: 80 }
  };

  const candidates: Quantneon3DProfile[] = [
    {
      id: 'u2',
      interestGraph: { music: 100, travel: 80 }
    },
    {
      id: 'u3',
      interestGraph: { gaming: 90, coding: 70 }
    }
  ];

  const context: BCIContext = {
    eyeTrackingFocus: 80,
    engagementScore: 85,
    dopamineIndex: 65
  };

  const ranked = matchMaker.rankCandidates(user, candidates, context);

  // u2 should rank higher due to better interest match
  assert.equal(ranked[0]?.candidate.id, 'u2');
  assert.equal(ranked.length, 2);
});

test('Quantneon3DMatchMaker respects engagement threshold', () => {
  const matchMaker = new Quantneon3DMatchMaker(undefined, 40);

  const lowEngagementContext: BCIContext = {
    eyeTrackingFocus: 60,
    engagementScore: 35,
    dopamineIndex: 40
  };

  const highEngagementContext: BCIContext = {
    eyeTrackingFocus: 90,
    engagementScore: 85,
    dopamineIndex: 80
  };

  assert.equal(matchMaker.shouldTransitionLoop(lowEngagementContext), true);
  assert.equal(matchMaker.shouldTransitionLoop(highEngagementContext), false);
});
