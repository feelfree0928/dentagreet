/**
 * lib/recording.ts
 *
 * Canvas composite recording logic.
 * Composites replica video + patient PiP onto a hidden canvas,
 * mixes both audio tracks, and produces a MediaRecorder stream.
 *
 * Usage:
 *   const recorder = new CompositeRecorder(replicaVideoEl, patientVideoEl);
 *   await recorder.start();
 *   // ... call happens ...
 *   const blob = await recorder.stop();
 */

import { getSupportedMimeType } from './utils';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const FRAME_RATE = 24;

// PiP dimensions (bottom-right of the left 75% area)
const PIP_WIDTH = 240;
const PIP_HEIGHT = 135;
const PIP_MARGIN = 16;
const REPLICA_AREA_WIDTH = Math.floor(CANVAS_WIDTH * 0.75);

export class CompositeRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private animFrameId: number | null = null;
  private audioCtx: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private startTime: Date | null = null;
  private mimeType: string;

  constructor(
    private replicaVideo: HTMLVideoElement | null,
    private patientVideo: HTMLVideoElement | null,
    private replicaAudioTrack: MediaStreamTrack | null = null,
    private patientAudioTrack: MediaStreamTrack | null = null
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas 2D context');
    this.ctx = ctx;
    this.mimeType = getSupportedMimeType();
  }

  /** Update video element references (call after tracks become available) */
  updateSources(
    replicaVideo: HTMLVideoElement | null,
    patientVideo: HTMLVideoElement | null,
    replicaAudioTrack: MediaStreamTrack | null,
    patientAudioTrack: MediaStreamTrack | null
  ) {
    this.replicaVideo = replicaVideo;
    this.patientVideo = patientVideo;
    this.replicaAudioTrack = replicaAudioTrack;
    this.patientAudioTrack = patientAudioTrack;
  }

  async start(): Promise<void> {
    this.chunks = [];
    this.startTime = new Date();

    // ── Audio mixing ──────────────────────────────────────────────────────────
    this.audioCtx = new AudioContext();
    this.audioDestination = this.audioCtx.createMediaStreamDestination();

    const addAudioTrack = (track: MediaStreamTrack | null) => {
      if (!track || !this.audioCtx || !this.audioDestination) return;
      try {
        const stream = new MediaStream([track]);
        const source = this.audioCtx.createMediaStreamSource(stream);
        source.connect(this.audioDestination);
      } catch (e) {
        console.warn('[Recording] Could not add audio track:', e);
      }
    };

    addAudioTrack(this.replicaAudioTrack);
    addAudioTrack(this.patientAudioTrack);

    // ── Canvas stream ─────────────────────────────────────────────────────────
    const canvasStream = this.canvas.captureStream(FRAME_RATE);

    // Combine canvas video + mixed audio
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...this.audioDestination.stream.getAudioTracks(),
    ]);

    // ── MediaRecorder ─────────────────────────────────────────────────────────
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: 128_000,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.mediaRecorder.start(1000); // collect chunks every 1s

    // ── Draw loop ─────────────────────────────────────────────────────────────
    this.drawFrame();
  }

  private drawFrame() {
    const ctx = this.ctx;
    const now = new Date();

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Replica video (left 75%)
    if (this.replicaVideo && this.replicaVideo.readyState >= 2) {
      ctx.drawImage(this.replicaVideo, 0, 0, REPLICA_AREA_WIDTH, CANVAS_HEIGHT);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, REPLICA_AREA_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#64748b';
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Connecting...', REPLICA_AREA_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    // Patient PiP (bottom-right of replica area)
    const pipX = REPLICA_AREA_WIDTH - PIP_WIDTH - PIP_MARGIN;
    const pipY = CANVAS_HEIGHT - PIP_HEIGHT - PIP_MARGIN;

    if (this.patientVideo && this.patientVideo.readyState >= 2) {
      // Rounded clip
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(pipX, pipY, PIP_WIDTH, PIP_HEIGHT, 8);
      ctx.clip();
      ctx.drawImage(this.patientVideo, pipX, pipY, PIP_WIDTH, PIP_HEIGHT);
      ctx.restore();

      // PiP border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pipX, pipY, PIP_WIDTH, PIP_HEIGHT, 8);
      ctx.stroke();
    }

    // REC indicator (top-left)
    const elapsed = Math.floor((now.getTime() - (this.startTime?.getTime() ?? now.getTime())) / 1000);
    const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const ss = (elapsed % 60).toString().padStart(2, '0');

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(12, 12, 110, 32, 6);
    ctx.fill();

    // Blinking red dot
    if (Math.floor(now.getTime() / 500) % 2 === 0) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(28, 28, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`REC ${mm}:${ss}`, 40, 33);

    // Timestamp (bottom-left)
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(12, CANVAS_HEIGHT - 36, 200, 24, 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC', 16, CANVAS_HEIGHT - 18);

    this.animFrameId = requestAnimationFrame(() => this.drawFrame());
  }

  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not started'));
        return;
      }

      // Stop animation loop
      if (this.animFrameId !== null) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.cleanup();
        resolve(blob);
      };

      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      } else {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.cleanup();
        resolve(blob);
      }
    });
  }

  private cleanup() {
    // Close audio context
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    // Remove hidden canvas
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  get elapsedSeconds(): number {
    if (!this.startTime) return 0;
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}
