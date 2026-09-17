declare module 'mind-ar/dist/mindar-image-three.prod.js' {
  export class MindARThree {
    constructor(options: Record<string, unknown>);
    renderer: any;
    scene: any;
    camera: any;
    addAnchor(index: number): {
      group: any;
      targetIndex: number;
      onTargetFound?: () => void;
      onTargetLost?: () => void;
      onTargetUpdate?: () => void;
    };
    start(): Promise<void>;
    stop(): void;
  }
}