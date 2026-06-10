import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

let camera, scene, renderer;
let controller1, controller2;
let controllerModel1, controllerModel2;
let hand1, hand2;
let handModel1, handModel2;

let grabbableObjects = [];
let grabbedObject = null;
let grabOffset = new THREE.Vector3();
let intersectingObject = null;

const tableMesh = null;
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

let glbCamera = null;
let glbCameraPosition = new THREE.Vector3();
let glbCameraQuaternion = new THREE.Quaternion();
let sceneModel = null;

init();
animate();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Default camera for non-VR mode
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3);

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

        // Find the camera from GLB and use it as the main camera
        if (gltf.cameras && gltf.cameras.length > 0) {
            glbCamera = gltf.cameras[0];
            glbCameraPosition.copy(glbCamera.position);
            glbCameraQuaternion.copy(glbCamera.quaternion);
            
            // Use GLB camera as main camera for non-VR mode
            camera = glbCamera;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            
            console.log('Using camera from GLB file:', glbCamera.name);
            console.log('Camera position:', glbCameraPosition);
            console.log('Camera quaternion:', glbCameraQuaternion);
        } else {
            console.log('No camera found in GLB, using default camera');
        }

        // Find the table mesh and grabbable objects
        sceneModel.traverse((child) => {
            if (child.isMesh) {
                if (child.name === 'mesa') {
                    child.receiveShadow = true;
                } else if (child.name === 'a' || child.name === 'b' || child.name === 'c') {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    grabbableObjects.push(child);
                }
            }
        });

        console.log('Scene loaded. Grabbable objects:', grabbableObjects.map(obj => obj.name));
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

    // VR Button - Official Three.js VR button
    document.body.appendChild(VRButton.createButton(renderer));

    // Adjust scene position when VR session starts
    renderer.xr.addEventListener('sessionstart', () => {
        if (glbCamera && sceneModel) {
            // Reset scene position to original when entering VR
            sceneModel.position.set(0, 0, 0);
            sceneModel.quaternion.set(0, 0, 0, 1);
            
            console.log('VR session started. Scene position reset');
        }
    });

    // Controllers
    setupControllers();

    window.addEventListener('resize', onWindowResize);
}

function setupControllers() {
    controller1 = renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    scene.add(controller1);

    controller2 = renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    scene.add(controller2);

    // Controller models
    const controllerModelFactory = new XRControllerModelFactory();
    controllerModel1 = controllerModelFactory.createControllerModel(controller1);
    controllerModel2 = controllerModelFactory.createControllerModel(controller2);
    controller1.add(controllerModel1);
    controller2.add(controllerModel2);

    // Hand tracking
    const handModelFactory = new XRHandModelFactory();
    
    hand1 = renderer.xr.getHand(0);
    hand1.addEventListener('pinchstart', onPinchStart);
    hand1.addEventListener('pinchend', onPinchEnd);
    handModel1 = handModelFactory.createHandModel(hand1, 'oculus');
    hand1.add(handModel1);
    scene.add(hand1);

    hand2 = renderer.xr.getHand(1);
    hand2.addEventListener('pinchstart', onPinchStart);
    hand2.addEventListener('pinchend', onPinchEnd);
    handModel2 = handModelFactory.createHandModel(hand2, 'oculus');
    hand2.add(handModel2);
    scene.add(hand2);
}

function onSelectStart(event) {
    const controller = event.target;
    const intersections = getIntersections(controller, grabbableObjects);

    if (intersections.length > 0) {
        const intersection = intersections[0];
        grabbedObject = intersection.object;
        grabbedObject.attach(controller);
        
        // Calculate offset
        const intersectPoint = intersection.point;
        const controllerPosition = new THREE.Vector3();
        controller.getWorldPosition(controllerPosition);
        grabOffset.subVectors(intersectPoint, controllerPosition);
    }
}

function onSelectEnd(event) {
    const controller = event.target;
    if (grabbedObject) {
        scene.attach(grabbedObject);
        
        // Apply the offset when releasing
        const controllerPosition = new THREE.Vector3();
        controller.getWorldPosition(controllerPosition);
        grabbedObject.position.addVectors(controllerPosition, grabOffset);
        
        grabbedObject = null;
    }
}

function onPinchStart(event) {
    const hand = event.target;
    const indexTip = hand.joints['index-finger-tip'];
    
    if (!indexTip) return;

    const intersections = getIntersections(indexTip, grabbableObjects);

    if (intersections.length > 0) {
        const intersection = intersections[0];
        grabbedObject = intersection.object;
        grabbedObject.attach(hand);
        
        const intersectPoint = intersection.point;
        const handPosition = new THREE.Vector3();
        hand.getWorldPosition(handPosition);
        grabOffset.subVectors(intersectPoint, handPosition);
    }
}

function onPinchEnd(event) {
    const hand = event.target;
    if (grabbedObject) {
        scene.attach(grabbedObject);
        
        const handPosition = new THREE.Vector3();
        hand.getWorldPosition(handPosition);
        grabbedObject.position.addVectors(handPosition, grabOffset);
        
        grabbedObject = null;
    }
}

function getIntersections(object, objects) {
    tempMatrix.identity().extractRotation(object.matrixWorld);
    raycaster.set(object.position, object.getWorldDirection(new THREE.Vector3()));
    raycaster.far = 2;
    return raycaster.intersectObjects(objects, false);
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
    renderer.render(scene, camera);
}
