export class Camera2D {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  zoom: number;
  minZoom: number;
  maxZoom: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.1;
    this.maxZoom = 3;
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = (screenX - rect.left - this.canvas.width / 2) / this.zoom + this.x;
    const y = (screenY - rect.top - this.canvas.height / 2) / this.zoom + this.y;
    return { x, y };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const x = (worldX - this.x) * this.zoom + this.canvas.width / 2;
    const y = (worldY - this.y) * this.zoom + this.canvas.height / 2;
    return { x, y };
  }

  // Apply camera transform to canvas context
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  // Pan the camera
  pan(dx: number, dy: number): void {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
  }

  // Zoom the camera at a specific point
  zoomAt(screenX: number, screenY: number, delta: number): void {
    const worldBefore = this.screenToWorld(screenX, screenY);

    const zoomFactor = delta > 0 ? 1.1 : 0.9;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * zoomFactor));

    const worldAfter = this.screenToWorld(screenX, screenY);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
  }

  // Reset camera to default position
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  }
}
