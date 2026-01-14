import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

type Quality = 'low' | 'medium' | 'high';

interface DeviceInfo {
  screenWidth: () => number;
  screenHeight: () => number;
  screenRatio: () => number;
  screenCenterX: () => number;
  screenCenterY: () => number;
  mouseCenterX: (e: MouseEvent) => number;
  mouseCenterY: (e: MouseEvent) => number;
}

const getDeviceInfo = (): DeviceInfo => ({
  screenWidth: () =>
    Math.max(
      0,
      window.innerWidth ||
        document.documentElement.clientWidth ||
        document.body.clientWidth ||
        0
    ),
  screenHeight: () =>
    Math.max(
      0,
      window.innerHeight ||
        document.documentElement.clientHeight ||
        document.body.clientHeight ||
        0
    ),
  screenRatio: function () {
    return this.screenWidth() / this.screenHeight();
  },
  screenCenterX: function () {
    return this.screenWidth() / 2;
  },
  screenCenterY: function () {
    return this.screenHeight() / 2;
  },
  mouseCenterX: function (e: MouseEvent) {
    return e.clientX - this.screenCenterX();
  },
  mouseCenterY: function (e: MouseEvent) {
    return e.clientY - this.screenCenterY();
  },
});

const addEase = (
  pos: THREE.Vector3,
  to: { x: number; y: number; z: number },
  ease: number
) => {
  pos.x += (to.x - pos.x) / ease;
  pos.y += (to.y - pos.y) / ease;
  pos.z += (to.z - pos.z) / ease;
};

const addEaseEuler = (rot: THREE.Euler, to: THREE.Euler, ease: number) => {
  rot.x += (to.x - rot.x) / ease;
  rot.y += (to.y - rot.y) / ease;
  rot.z += (to.z - rot.z) / ease;
};

const getElementBackground = (element: HTMLElement): string | null => {
  let current: HTMLElement | null = element;
  while (current) {
    const bg = getComputedStyle(current).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    current = current.parentElement;
  }
  return null;
};

const parseColor = (color: string): THREE.Color => {
  try {
    return new THREE.Color(color);
  } catch {
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return new THREE.Color(
          parseInt(matches[0], 10) / 255,
          parseInt(matches[1], 10) / 255,
          parseInt(matches[2], 10) / 255
        );
      }
    }
    return new THREE.Color(0xffffff);
  }
};

const isColorDark = (color: THREE.Color): boolean => {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  return luminance < 0.5;
};

@Component({
  selector: 'app-animated-wave',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './animated-wave.component.html',
  styleUrls: ['./animated-wave.component.scss'],
})
export class AnimatedWaveComponent implements AfterViewInit, OnDestroy, OnChanges {
  // ==== Props ====
  @Input() className?: string;

  @Input() speed = 0.015;
  @Input() amplitude = 30;
  @Input() smoothness = 300;
  @Input() wireframe = true;
  @Input() waveColor?: string;
  @Input() opacity = 1;

  @Input() mouseInteraction = true;
  @Input() quality: Quality = 'medium';

  @Input() fov = 60;
  @Input() waveOffsetY = -300;
  @Input() waveRotation = 29.8;
  @Input() cameraDistance = -1000;

  @Input() autoDetectBackground = true;
  @Input() backgroundColor?: string;

  @Input() ease = 12;

  @Input() mouseDistortionStrength = 0.5;
  @Input() mouseDistortionSmoothness = 100;
  @Input() mouseDistortionDecay = 0.0005;

  @Input() mouseShrinkScaleStrength = 0.7;
  @Input() mouseShrinkScaleRadius = 200;

  @ViewChild('container', { static: true })
  containerRef!: ElementRef<HTMLDivElement>;

  webGLFailed = false;

  // ==== Three state ====
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private animationFrameId: number | null = null;

  private mouse = { x: 0, y: 0 };

  private pointLight: THREE.PointLight | null = null;
  private groundPlain: ReturnType<AnimatedWaveComponent['createGroundPlain']> | null =
    null;

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.mouseInteraction) return;
    const device = getDeviceInfo();
    this.mouse.x = device.mouseCenterX(e);
    this.mouse.y = device.mouseCenterY(e);
  };

  private handleResize = () => {
    if (!this.camera || !this.renderer) return;
    const device = getDeviceInfo();
    this.camera.aspect = device.screenRatio();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(device.screenWidth(), device.screenHeight());
  };

  ngAfterViewInit(): void {
    this.setupScene();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.scene || !this.renderer || !this.groundPlain) return;

    // Update material/light for small changes
    const mat = this.groundPlain.material;
    if (mat) {
      const newWaveColor = this.determineWaveColor();
      mat.color.copy(newWaveColor);
      mat.wireframe = this.wireframe;
      mat.opacity = this.opacity;
      mat.transparent = this.opacity < 1;
      mat.depthWrite = this.opacity < 1 ? false : true;
      mat.blending = this.opacity < 1 ? THREE.NormalBlending : THREE.NoBlending;
      mat.needsUpdate = true;

      if (this.pointLight) this.pointLight.color.copy(newWaveColor);
    }

    // Rebuild for heavy changes
    const heavyKeys = [
      'quality',
      'smoothness',
      'amplitude',
      'speed',
      'waveOffsetY',
      'waveRotation',
      'cameraDistance',
      'fov',
      'mouseInteraction',
    ];
    const shouldRebuild = heavyKeys.some((k) => !!changes[k]);
    if (shouldRebuild) this.setupScene(true);
  }

  ngOnDestroy(): void {
    this.cleanupScene();
  }

  private getQualitySettings(q: Quality) {
    switch (q) {
      case 'low':
        return { width: 64, height: 32 };
      case 'high':
        return { width: 256, height: 128 };
      default:
        return { width: 128, height: 64 };
    }
  }

  private determineWaveColor(): THREE.Color {
    if (this.waveColor) return parseColor(this.waveColor);

    if (this.autoDetectBackground && this.containerRef?.nativeElement) {
      const detected = getElementBackground(this.containerRef.nativeElement);
      if (detected) {
        const bg = parseColor(detected);
        return isColorDark(bg)
          ? new THREE.Color(0xffffff)
          : new THREE.Color(0x000000);
      }
    }
    return new THREE.Color(0x000000);
  }

  private createGroundPlain() {
    const { width: geometryWidth, height: geometryHeight } =
      this.getQualitySettings(this.quality);

    const groundPlain = {
      group: null as THREE.Object3D | null,
      geometry: null as THREE.PlaneGeometry | null,
      material: null as THREE.MeshLambertMaterial | null,
      plane: null as THREE.Mesh | null,
      simplex: null as ReturnType<typeof createNoise2D> | null,

      factor: this.smoothness,
      scale: this.amplitude,
      speed: this.speed,
      cycle: 0,

      ease: this.ease,
      move: new THREE.Vector3(0, this.waveOffsetY, this.cameraDistance),
      look: new THREE.Euler((this.waveRotation * Math.PI) / 180, 0, 0),

      mouseDistortionStrength: this.mouseDistortionStrength,
      mouseDistortionSmoothness: this.mouseDistortionSmoothness,
      mouseDistortionDecay: this.mouseDistortionDecay,
      distortionTime: 0,

      mouseShrinkScaleStrength: this.mouseShrinkScaleStrength,
      mouseShrinkScaleRadius: this.mouseShrinkScaleRadius,

      _originalPositions: new Float32Array(),

      create: (scene: THREE.Scene) => {
        groundPlain.group = new THREE.Object3D();
        groundPlain.group.position.copy(groundPlain.move);
        groundPlain.group.rotation.copy(groundPlain.look);

        groundPlain.geometry = new THREE.PlaneGeometry(
          4000,
          2000,
          geometryWidth,
          geometryHeight
        );

        groundPlain._originalPositions = new Float32Array(
          groundPlain.geometry.attributes['position'].array as Float32Array
        );

        const waveColorValue = this.determineWaveColor();
        groundPlain.material = new THREE.MeshLambertMaterial({
          color: waveColorValue,
          opacity: this.opacity,
          blending: this.opacity < 1 ? THREE.NormalBlending : THREE.NoBlending,
          side: THREE.DoubleSide,
          transparent: this.opacity < 1,
          depthWrite: this.opacity < 1 ? false : true,
          wireframe: this.wireframe,
        });

        groundPlain.plane = new THREE.Mesh(groundPlain.geometry, groundPlain.material);
        groundPlain.plane.position.set(0, 0, 0);

        groundPlain.simplex = createNoise2D();
        groundPlain.moveNoise({ x: 0, y: 0 });

        groundPlain.group.add(groundPlain.plane);
        scene.add(groundPlain.group);
      },

      moveNoise: (mouse: { x: number; y: number }) => {
        if (!groundPlain.geometry || !groundPlain.simplex) return;

        const positions = groundPlain.geometry.attributes['position'];
        const currentMouseX = this.mouseInteraction ? mouse.x : 0;
        const currentMouseY = this.mouseInteraction ? mouse.y : 0;

        groundPlain.distortionTime += groundPlain.mouseDistortionDecay;

        for (let i = 0; i < positions.count; i++) {
          const originalX = groundPlain._originalPositions[i * 3];
          const originalY = groundPlain._originalPositions[i * 3 + 1];

          let newX = originalX;
          let newY = originalY;

          const xoff_wave = originalX / groundPlain.factor;
          const yoff_wave = originalY / groundPlain.factor + groundPlain.cycle;
          let zOffset =
            groundPlain.simplex(xoff_wave, yoff_wave) * groundPlain.scale;

          // Mouse ripple (approx 2D noise + time)
          if (this.mouseInteraction && groundPlain.mouseDistortionStrength > 0) {
            const distX = originalX - currentMouseX * 0.5;
            const distY = originalY - currentMouseY * 0.5;
            const dist = Math.sqrt(distX * distX + distY * distY);

            const t = groundPlain.distortionTime * 1000;
            const ripple =
              groundPlain.simplex(
                distX / groundPlain.mouseDistortionSmoothness + t,
                distY / groundPlain.mouseDistortionSmoothness - t
              ) * groundPlain.mouseDistortionStrength;

            const zFalloff = Math.max(
              0,
              1 - dist / (groundPlain.mouseShrinkScaleRadius * 2)
            );

            zOffset += ripple * groundPlain.scale * zFalloff;
          }

          // Mouse shrink/scale
          if (this.mouseInteraction && groundPlain.mouseShrinkScaleStrength > 0) {
            const dx = originalX - currentMouseX;
            const dy = originalY - currentMouseY;
            const d = Math.sqrt(dx * dx + dy * dy);

            let falloff = 0;
            if (d < groundPlain.mouseShrinkScaleRadius) {
              falloff = 1 - d / groundPlain.mouseShrinkScaleRadius;
              falloff = Math.pow(falloff, 2);
            }

            const shrinkAmount = groundPlain.mouseShrinkScaleStrength * falloff;
            newX = originalX - dx * shrinkAmount;
            newY = originalY - dy * shrinkAmount;
          }

          positions.setXYZ(i, newX, newY, zOffset);
        }

        positions.needsUpdate = true;
        groundPlain.cycle += groundPlain.speed;
      },

      update: (mouse: { x: number; y: number }) => {
        groundPlain.moveNoise(mouse);

        if (this.mouseInteraction && groundPlain.group) {
          groundPlain.move.x = -(mouse.x * 0.04);
          groundPlain.move.y = this.waveOffsetY + mouse.y * 0.04;

          addEase(groundPlain.group.position, groundPlain.move, groundPlain.ease);
          addEaseEuler(groundPlain.group.rotation, groundPlain.look, groundPlain.ease);
        }
      },

      dispose: () => {
        groundPlain.geometry?.dispose();
        groundPlain.material?.dispose();
        if (groundPlain.group && groundPlain.plane) {
          groundPlain.group.remove(groundPlain.plane);
        }
        groundPlain.plane = null;
        groundPlain.geometry = null;
        groundPlain.material = null;
        groundPlain.simplex = null;
        groundPlain.group = null;
        groundPlain._originalPositions = new Float32Array();
      },
    };

    return groundPlain;
  }

  private setupScene(rebuild = false) {
    if (!this.containerRef?.nativeElement) return;
    if (rebuild) this.cleanupScene();

    const container = this.containerRef.nativeElement;
    const device = getDeviceInfo();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      device.screenRatio(),
      0.1,
      20000
    );

    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        precision: 'mediump',
      });
      this.renderer.setSize(device.screenWidth(), device.screenHeight());
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setClearColor(0x000000, 0);
      container.appendChild(this.renderer.domElement);
      this.webGLFailed = false;
    } catch (e) {
      console.error('Failed to create WebGL context:', e);
      this.webGLFailed = true;
      return;
    }

    const waveColorValue = this.determineWaveColor();
    this.pointLight = new THREE.PointLight(waveColorValue, 4, 1000);
    this.pointLight.position.set(0, 200, -500);
    this.scene.add(this.pointLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    this.groundPlain = this.createGroundPlain();
    this.groundPlain.create(this.scene);

    this.mouse = { x: device.screenCenterX(), y: device.screenCenterY() };

    if (this.mouseInteraction) window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);

    const animate = () => {
      if (!this.scene || !this.camera || !this.renderer || !this.groundPlain) return;

      this.groundPlain.update(this.mouse);
      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private cleanupScene() {
    if (this.mouseInteraction) window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('resize', this.handleResize);

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    this.groundPlain?.dispose();
    this.groundPlain = null;

    if (this.scene) this.scene.clear();

    if (this.renderer) {
      const canvas = this.renderer.domElement;
      this.renderer.dispose();
      if (this.containerRef?.nativeElement?.contains(canvas)) {
        this.containerRef.nativeElement.removeChild(canvas);
      }
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animationFrameId = null;
    this.pointLight = null;
  }
}
