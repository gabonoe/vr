import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let camera, scene, renderer;
let playerRig;
let controller1, controller2;
let controllerGrip1, controllerGrip2;
let hand1, hand2;

let grabbableObjects = [];
let mesaMesh = null;

const raycaster = new THREE.Raycaster();
const downRaycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

// Grab tuning
const NEAR_GRAB_DISTANCE = 0.12;   // meters: distance for direct (touch) grab
const RAY_GRAB_DISTANCE = 6;       // meters: max distance for ray grab
const HIGHLIGHT_COLOR = new THREE.Color(0x33aaff);

let glbCamera = null;
const glbCamWorldPos = new THREE.Vector3();
const glbCamWorldQuat = new THREE.Quaternion();
let sceneModel = null;
const desktopCamPos = new THREE.Vector3(0, 1.6, 3);
const desktopCamQuat = new THREE.Quaternion();

init();
animate();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Default camera for non-VR mode, parented to a movable player rig
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3);

    playerRig = new THREE.Group();
    playerRig.add(camera);
    scene.add(playerRig);

    // Enhanced Lighting
    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    // Hemisphere light for sky/ground color variation
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Main directional light (sun-like)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 50;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    // Fill light (soft blue-ish)
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    // Rim light (warm orange for contrast)
    const rimLight = new THREE.DirectionalLight(0xffaa55, 0.3);
    rimLight.position.set(0, 2, -10);
    scene.add(rimLight);

    // Point lights for interesting highlights
    const pointLight1 = new THREE.PointLight(0xff6b6b, 0.5, 10);
    pointLight1.position.set(3, 2, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.5, 10);
    pointLight2.position.set(-3, 2, -3);
    scene.add(pointLight2);

    // Load GLB scene
    const loader = new GLTFLoader();
    loader.load('assets/escena.glb', function (gltf) {
        sceneModel = gltf.scene;
        scene.add(sceneModel);
        sceneModel.updateWorldMatrix(true, true);

        // Find the camera from GLB and capture its world transform
        if (gltf.cameras && gltf.cameras.length > 0) {
            glbCamera = gltf.cameras[0];
            glbCamera.getWorldPosition(glbCamWorldPos);
            glbCamera.getWorldQuaternion(glbCamWorldQuat);

            // Apply GLB camera transform to the desktop camera
            desktopCamPos.copy(glbCamWorldPos);
            desktopCamQuat.copy(glbCamWorldQuat);
            camera.position.copy(desktopCamPos);
            camera.quaternion.copy(desktopCamQuat);
            camera.updateProjectionMatrix();

            console.log('Found camera in GLB file:', glbCamera.name, glbCamWorldPos);
        } else {
            console.log('No camera found in GLB, using default camera position');
        }

        // Find the table mesh and grabbable objects
        sceneModel.traverse((child) => {
            if (child.isMesh) {
                if (child.name === 'mesa') {
                    child.receiveShadow = true;
                    mesaMesh = child;
                } else if (child.name === 'a' || child.name === 'b' || child.name === 'c') {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Clone material so highlighting one object does not affect others
                    if (child.material) {
                        child.material = child.material.clone();
                        child.userData.baseEmissive = child.material.emissive
                            ? child.material.emissive.clone()
                            : new THREE.Color(0x000000);
                    }
                    child.userData.heldBy = null;
                    grabbableObjects.push(child);
                }
            }
        });

        console.log('Scene loaded. Grabbable objects:', grabbableObjects.map(obj => obj.name));
        console.log('Table mesh found:', !!mesaMesh);
    }, undefined, function (error) {
        console.error('Error loading GLB:', error);
    });

    // Renderer with enhanced quality settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Enhanced shadow settings
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    
    // Tone mapping for better color reproduction
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    // Color space settings
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // XR enabled
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // VR Button (Three.js). It already requests 'hand-tracking', 'local-floor'
    // and 'bounded-floor' as optional features for Quest 2/3.
    document.body.appendChild(VRButton.createButton(renderer));

    // Position the player at the GLB camera viewpoint when VR starts
    renderer.xr.addEventListener('sessionstart', () => {
        if (glbCamera) {
            const euler = new THREE.Euler().setFromQuaternion(glbCamWorldQuat, 'YXZ');
            playerRig.position.set(glbCamWorldPos.x, 0, glbCamWorldPos.z);
            playerRig.rotation.set(0, euler.y, 0);
        }
        // The headset drives the camera in VR; clear local transform
        camera.position.set(0, 0, 0);
        camera.quaternion.identity();
        console.log('VR session started. Player positioned at GLB camera viewpoint');
    });

    renderer.xr.addEventListener('sessionend', () => {
        // Restore the desktop camera viewpoint
        playerRig.position.set(0, 0, 0);
        playerRig.rotation.set(0, 0, 0);
        camera.position.copy(desktopCamPos);
        camera.quaternion.copy(desktopCamQuat);
    });

    // Controllers and hands
    setupControllers();

    window.addEventListener('resize', onWindowResize);
}

function buildPointer() {
    // Visible ray used to aim at distant objects
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]);
    const material = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.6
    });
    const line = new THREE.Line(geometry, material);
    line.name = 'pointer';
    line.scale.z = RAY_GRAB_DISTANCE;
    return line;
}

function setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();
    const handModelFactory = new XRHandModelFactory().setPath('assets/hands/');

    // ----- Controller 0 -----
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.add(buildPointer());
    playerRig.add(controller1);

    controllerGrip1 = renderer.xr.getControllerGrip(0);
    controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
    playerRig.add(controllerGrip1);

    // ----- Controller 1 -----
    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.add(buildPointer());
    playerRig.add(controller2);

    controllerGrip2 = renderer.xr.getControllerGrip(1);
    controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
    playerRig.add(controllerGrip2);

    // ----- Hand tracking (Quest 2/3) with realistic Meta hand meshes -----
    hand1 = renderer.xr.getHand(0);
    hand1.addEventListener('pinchstart', onPinchStart);
    hand1.addEventListener('pinchend', onPinchEnd);
    hand1.add(handModelFactory.createHandModel(hand1, 'mesh'));
    playerRig.add(hand1);

    hand2 = renderer.xr.getHand(1);
    hand2.addEventListener('pinchstart', onPinchStart);
    hand2.addEventListener('pinchend', onPinchEnd);
    hand2.add(handModelFactory.createHandModel(hand2, 'mesh'));
    playerRig.add(hand2);
}

// ---------- Grab core ----------

function grab(source, object) {
    if (!object || object.userData.heldBy) return;
    object.userData.heldBy = source;
    source.userData.held = object;
    source.attach(object); // keeps world transform, parents object to the hand/controller
    setEmissive(object, HIGHLIGHT_COLOR, 0.6);
}

function release(source) {
    const object = source.userData.held;
    if (!object) return;
    scene.attach(object); // back to world space, preserving transform
    object.userData.heldBy = null;
    source.userData.held = null;
    if (object.userData.baseEmissive) setEmissive(object, object.userData.baseEmissive, 1);
    snapToTable(object);
}

function onSelectStart(event) {
    const controller = event.target;
    // Prefer a direct (touch) grab, then fall back to ray grab
    let object = getNearestGrabbable(controller, NEAR_GRAB_DISTANCE);
    if (!object) object = getRayHit(controller);
    if (object) grab(controller, object);
}

function onSelectEnd(event) {
    release(event.target);
}

function onPinchStart(event) {
    const hand = event.target;
    const tip = hand.joints['index-finger-tip'];
    const reference = tip || hand;
    const object = getNearestGrabbable(reference, NEAR_GRAB_DISTANCE);
    if (object) grab(hand, object);
}

function onPinchEnd(event) {
    release(event.target);
}

// ---------- Helpers ----------

function getRayHit(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.far = RAY_GRAB_DISTANCE;
    const hits = raycaster.intersectObjects(grabbableObjects, false);
    return hits.length > 0 ? hits[0].object : null;
}

const _srcPos = new THREE.Vector3();
const _objPos = new THREE.Vector3();

function getNearestGrabbable(source, maxDistance) {
    source.getWorldPosition(_srcPos);
    let nearest = null;
    let nearestDist = maxDistance;
    for (const obj of grabbableObjects) {
        if (obj.userData.heldBy) continue;
        obj.getWorldPosition(_objPos);
        const dist = _objPos.distanceTo(_srcPos);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = obj;
        }
    }
    return nearest;
}

function setEmissive(object, color, intensity) {
    if (object.material && object.material.emissive) {
        object.material.emissive.copy(color);
        if (object.material.emissiveIntensity !== undefined) {
            object.material.emissiveIntensity = intensity;
        }
    }
}

const _box = new THREE.Box3();
const _center = new THREE.Vector3();

function snapToTable(object) {
    if (!mesaMesh) return;
    object.updateWorldMatrix(true, false);
    _box.setFromObject(object);
    _box.getCenter(_center);

    // Cast straight down from above the object's center onto the table
    downRaycaster.ray.origin.set(_center.x, _center.y + 5, _center.z);
    downRaycaster.ray.direction.set(0, -1, 0);
    downRaycaster.far = 20;
    const hits = downRaycaster.intersectObject(mesaMesh, true);
    if (hits.length > 0) {
        const surfaceY = hits[0].point.y;
        const bottomOffset = _center.y - _box.min.y; // half-height from center to base
        object.position.y += (surfaceY + bottomOffset) - _center.y;
    }
}

let hoveredObjects = new Set();

function updateHover() {
    if (!renderer.xr.isPresenting) return;

    const nowHovered = new Set();

    [controller1, controller2].forEach((controller) => {
        if (!controller || controller.userData.held) return;

        // Direct (near) hover takes priority over ray hover
        let object = getNearestGrabbable(controller, NEAR_GRAB_DISTANCE);
        let rayDist = RAY_GRAB_DISTANCE;

        if (!object) {
            const hit = getRayFirstHit(controller);
            if (hit) {
                object = hit.object;
                rayDist = hit.distance;
            }
        }

        const pointer = controller.getObjectByName('pointer');
        if (pointer) pointer.scale.z = object ? rayDist : RAY_GRAB_DISTANCE;

        if (object) nowHovered.add(object);
    });

    // Apply / clear highlight (held objects keep their grab highlight)
    hoveredObjects.forEach((obj) => {
        if (!nowHovered.has(obj) && !obj.userData.heldBy && obj.userData.baseEmissive) {
            setEmissive(obj, obj.userData.baseEmissive, 1);
        }
    });
    nowHovered.forEach((obj) => {
        if (!obj.userData.heldBy) setEmissive(obj, HIGHLIGHT_COLOR, 0.35);
    });
    hoveredObjects = nowHovered;
}

function getRayFirstHit(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    raycaster.far = RAY_GRAB_DISTANCE;
    const hits = raycaster.intersectObjects(grabbableObjects, false);
    return hits.length > 0 ? hits[0] : null;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render() {
    updateHover();
    renderer.render(scene, camera);
}
