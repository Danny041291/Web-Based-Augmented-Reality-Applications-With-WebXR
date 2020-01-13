import { Component, ViewChild, ElementRef } from '@angular/core';
import * as THREE from 'three';

declare var XRWebGLLayer: any;
declare var XRSession: any;
declare var XRRay: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  @ViewChild('render', { static: false }) render: ElementRef;
  @ViewChild('canvas', { static: false }) canvas: ElementRef;

  reticle: any;
  isOnField: boolean = false;

  constructor() { }

  public test() {
    this.initSession();
  }

  private async initSession() {
    var xr = (window.navigator as any).xr;
    if (xr && XRSession.prototype.requestHitTest) {
      try {
        await xr.isSessionSupported('immersive-ar');
      } catch (e) {
        console.log("Device not supported.");
        return;
      }
    } else {
      console.log("Device not supported.");
      return;
    }
    const outputCanvas = document.createElement('canvas');
    try {
      var session = await xr.requestSession('immersive-ar');
      this.render.nativeElement.appendChild(outputCanvas);
      this.onSessionStarted(session);
    } catch (e) {
      console.log("Device not supported.");
      return;
    }
  }

  private async onSessionStarted(session: any) {

    // Renderer initialization
    var renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.autoClear = false;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    renderer.xr.setSession(session);

    // Context initialization
    var gl = renderer.getContext();
    session.baseLayer = new XRWebGLLayer(session, gl);

    // Scene initialization
    var scene = new THREE.Scene();

    // Camera initialization
    var camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;

    // Creating a cubic model
    const geometry = new THREE.BoxBufferGeometry(0.1, 0.1, 0.1);
    const material = new THREE.MeshNormalMaterial();
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0.25, 0));
    var model = new THREE.Mesh(geometry, material);

    var frameOfRef = await session.requestReferenceSpace('local');
    session.requestAnimationFrame((time: any, frame: any) => this.onXRFrame(frame, frameOfRef, renderer, camera, scene, model));

  }

  private onXRFrame(frame: any, frameOfRef: any, renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, scene: THREE.Scene, model: THREE.Mesh) {
    const { session } = frame;
    const pose = 'getDevicePose' in frame ? frame.getDevicePose(frameOfRef) : frame.getViewerPose(frameOfRef);
    session.requestAnimationFrame((time: any, frame: any) => this.onXRFrame(frame, frameOfRef, renderer, camera, scene, model));
    if (!pose) return;
    for (const view of frame.getViewerPose(frameOfRef).views) {
      const viewport = session.renderState.baseLayer.getViewport(view);
      renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
      camera.projectionMatrix.fromArray(view.projectionMatrix);
      const viewMatrix = new THREE.Matrix4().fromArray(view.transform.inverse.matrix);
      camera.matrix.getInverse(viewMatrix);
      camera.updateMatrixWorld(true);
      this.processXRInput(frame, camera, frameOfRef, model, scene);
      renderer.render(scene, camera);
    }
  }

  private processXRInput(frame: any, camera: THREE.PerspectiveCamera, frameOfRef: any, model: THREE.Mesh, scene: THREE.Scene) {
    const { session } = frame;
    const sources = Array.from<any>(session.inputSources).filter((input: any) => input.targetRayMode === 'screen');
    if (sources.length === 0) return;
    const pose = frame.getPose(sources[0].targetRaySpace, frameOfRef);
    if (!pose) return;
    const raycaster = new THREE.Raycaster();
    this.onClick(raycaster, camera, session, frameOfRef, model, scene);
  }

  private async onClick(raycaster: THREE.Raycaster, camera: THREE.PerspectiveCamera, session: any, frameOfRef: any, model: THREE.Mesh, scene: THREE.Scene) {
    if (!session) return;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    let xrray = new XRRay(raycaster.ray.origin, raycaster.ray.direction);
    let hits;
    try {
      hits = await session.requestHitTest(xrray, frameOfRef);
    } catch (e) {
      console.log(e);
    }
    if (hits && hits.length) {
      const hitMatrix = new THREE.Matrix4().fromArray(hits[0].hitMatrix);
      model.position.setFromMatrixPosition(hitMatrix);
      scene.add(model);
      const camPosition = new THREE.Vector3().setFromMatrixPosition(camera.matrix);
      model.lookAt(camPosition.x, model.position.y, camPosition.z);
      model.rotateY(-scene.rotation.y);
    }
  }

}