/**
 * Quantneon 3D Hologram MatchMaker Service
 * Deep integration of Quantchill MatchMaker with Quantneon 3D Holograms
 * Renders matched user's 3D avatar scan with physics and haptic feedback
 */

import { MatchMaker, UserProfile, BCIContext, MatchResult } from '../MatchMaker';
import { HologramRenderer, HologramData } from './HologramRenderer';
import { HologramPhysicsEngine, Vec3 } from './HologramPhysicsEngine';
import { HapticFeedbackService } from './HapticFeedbackService';

export interface Quantneon3DProfile extends UserProfile {
  hologramMeshUrl?: string;
  hologramTextureUrl?: string;
  avatar3DData?: {
    scanDate: string;
    quality: 'low' | 'medium' | 'high' | 'ultra';
    format: 'gltf' | 'obj' | 'fbx';
  };
}

export interface SwipeGesture {
  type: 'push' | 'pull';
  force: Vec3;
  velocity: number;
}

export class Quantneon3DMatchMaker extends MatchMaker {
  private renderer: HologramRenderer | null = null;
  private physicsEngine: HologramPhysicsEngine;
  private hapticService: HapticFeedbackService;
  private currentHologramProfile: Quantneon3DProfile | null = null;
  private lastFrameTime = 0;
  private renderLoopActive = false;

  constructor(
    container?: HTMLElement,
    lowEngagementThreshold = 40
  ) {
    super(lowEngagementThreshold);

    // Initialize physics engine with optimized parameters
    this.physicsEngine = new HologramPhysicsEngine({
      mass: 1.2,
      damping: 0.92,
      springConstant: 0.6
    });

    // Initialize haptic feedback
    this.hapticService = new HapticFeedbackService({
      enabled: true,
      intensityMultiplier: 1.0
    });

    // Initialize renderer if container provided
    if (container) {
      this.initializeRenderer(container);
    }
  }

  /**
   * Initialize WebGL renderer
   */
  async initializeRenderer(container: HTMLElement): Promise<void> {
    this.renderer = new HologramRenderer(container, {
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });

    await this.physicsEngine.initialize();

    // Start zero-latency render loop
    this.startRenderLoop();
  }

  /**
   * Rank candidates and prepare 3D hologram data
   */
  override rankCandidates(
    user: UserProfile,
    candidates: UserProfile[],
    context: BCIContext
  ): MatchResult[] {
    // Use parent MatchMaker logic for ranking
    const ranked = super.rankCandidates(user, candidates, context);

    // Enhance with 3D hologram priorities
    return ranked.map(result => ({
      ...result,
      score: this.enhance3DScore(result, context)
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Enhance match score with 3D hologram availability
   */
  private enhance3DScore(result: MatchResult, context: BCIContext): number {
    const profile = result.candidate as Quantneon3DProfile;
    let score = result.score;

    // Boost score if 3D hologram is available
    if (profile.hologramMeshUrl || profile.avatar3DData) {
      score += 5;
    }

    // Additional boost for high-quality 3D scans
    if (profile.avatar3DData?.quality === 'ultra') {
      score += 3;
    } else if (profile.avatar3DData?.quality === 'high') {
      score += 2;
    }

    return Number(score.toFixed(2));
  }

  /**
   * Load and display matched user's 3D hologram
   */
  async displayMatchHologram(profile: Quantneon3DProfile): Promise<void> {
    if (!this.renderer) {
      throw new Error('Renderer not initialized. Call initializeRenderer first.');
    }

    this.currentHologramProfile = profile;

    const hologramData: HologramData = {
      userId: profile.id,
      meshUrl: profile.hologramMeshUrl,
      textureUrl: profile.hologramTextureUrl,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1.5
    };

    await this.renderer.loadHologram(hologramData);

    // Trigger success haptic feedback
    await this.hapticService.triggerNotification('success');
  }

  /**
   * Handle swipe gesture with physics and haptics
   */
  async handleSwipeGesture(gesture: SwipeGesture): Promise<void> {
    if (!this.renderer || !this.currentHologramProfile) return;

    if (gesture.type === 'push') {
      // Apply push force to physics engine
      this.physicsEngine.applyPushForce(gesture.force);

      // Trigger haptic feedback based on force
      await this.hapticService.triggerPushFeedback(gesture.velocity);

      // Check if hologram pushed out of frame
      const position = this.physicsEngine.getPosition();
      if (Math.abs(position.z) > 8) {
        await this.onHologramDismissed();
      }
    } else if (gesture.type === 'pull') {
      // Apply pull force to physics engine
      this.physicsEngine.applyPullForce(gesture.force);

      // Trigger lighter haptic for pull
      await this.hapticService.triggerPullFeedback(gesture.velocity);

      // Check if hologram pulled very close
      const position = this.physicsEngine.getPosition();
      if (position.z < -3) {
        await this.onHologramEngaged();
      }
    }
  }

  /**
   * Zero-latency render loop for smooth 60fps+ hologram interactions
   */
  private startRenderLoop(): void {
    if (this.renderLoopActive) return;

    this.renderLoopActive = true;
    this.lastFrameTime = performance.now();

    const renderFrame = (currentTime: number) => {
      if (!this.renderLoopActive) return;

      // Calculate delta time in seconds
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;

      // Update physics (zero-latency)
      if (this.renderer && this.currentHologramProfile) {
        const position = this.physicsEngine.updatePosition(deltaTime);
        this.renderer.updateHologramPosition(position);
      }

      // Render next frame
      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);

    // Also start renderer's internal loop
    if (this.renderer) {
      this.renderer.startRenderLoop();
    }
  }

  /**
   * Stop render loop
   */
  stopRenderLoop(): void {
    this.renderLoopActive = false;
    if (this.renderer) {
      this.renderer.stopRenderLoop();
    }
  }

  /**
   * Handle hologram dismissed (swiped away)
   */
  private async onHologramDismissed(): Promise<void> {
    await this.hapticService.triggerNotification('warning');
    this.currentHologramProfile = null;
    // Emit event for next match
  }

  /**
   * Handle hologram engaged (pulled close)
   */
  private async onHologramEngaged(): Promise<void> {
    await this.hapticService.triggerNotification('success');
    // Emit event for match acceptance
  }

  /**
   * Get current hologram profile
   */
  getCurrentProfile(): Quantneon3DProfile | null {
    return this.currentHologramProfile;
  }

  /**
   * Get renderer instance for advanced control
   */
  getRenderer(): HologramRenderer | null {
    return this.renderer;
  }

  /**
   * Get physics engine instance
   */
  getPhysicsEngine(): HologramPhysicsEngine {
    return this.physicsEngine;
  }

  /**
   * Get haptic service instance
   */
  getHapticService(): HapticFeedbackService {
    return this.hapticService;
  }

  /**
   * Dispose and cleanup all resources
   */
  dispose(): void {
    this.stopRenderLoop();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.currentHologramProfile = null;
  }
}
