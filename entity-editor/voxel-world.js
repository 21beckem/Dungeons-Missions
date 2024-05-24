import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.3/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118.3/examples/jsm/loaders/OBJLoader.js';


class BasicWorldDemo {
	constructor() {
		this.SUB_Initialize();
	}

	SUB_Initialize() {
		this._threejs = new THREE.WebGLRenderer({
			antialias: true,
		});
		this._threejs.shadowMap.enabled = true;
		this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
		this._threejs.setPixelRatio(window.devicePixelRatio);
		this._threejs.setSize(window.innerWidth, window.innerHeight);

		this._mouseMode = 'pan';

		document.body.appendChild(this._threejs.domElement);

		window.addEventListener('resize', () => {
			this.SUB_OnWindowResize();
		}, false);
		setTimeout(() => { this.SUB_OnWindowResize(); }, 10);

		this.SUB_createCamera();

		this._scene = new THREE.Scene();

		this.SUB_createLight();

		this.SUB_createFloor();

		this._controls = new OrbitControls(
			this._camera, this._threejs.domElement
		);
		this._controls.target.set(0, 20, 0);
		this._controls.update();

		this.SUB_createRaycaster();
		this.SUB_setupPainting();
		this.SUB_setupBuilding();

		this.SUB_createSkybox();

		this.SUB_RAF();
	}

	SUB_createCamera() {
		const fov = 60;
		const aspect = 1920 / 1080;
		const near = 1.0;
		const far = 1000.0;
		this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		this._camera.position.set(14, 147, -124);
		this._camera.rotation.set(0, 0, 0);
	}

	SUB_createLight() {
		let light = new THREE.DirectionalLight(0xFFFFFF, 0.5);
		light.position.set(20, 100, 10);
		light.target.position.set(0, 0, 0);
		light.castShadow = true;
		light.shadow.bias = -0.001;
		light.shadow.mapSize.width = 2048;
		light.shadow.mapSize.height = 2048;
		light.shadow.camera.near = 0.1;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.near = 0.5;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.left = 100;
		light.shadow.camera.right = -100;
		light.shadow.camera.top = 100;
		light.shadow.camera.bottom = -100;
		this._scene.add(light);

		light = new THREE.AmbientLight(0x101010, 8.0);
		this._scene.add(light);
	}

	SUB_intersect(pos) {
		this._raycaster.setFromCamera(pos, this._camera);
		return this._raycaster.intersectObjects(this._scene.children);
	}

	SUB_createRaycaster() {
		this._raycaster = new THREE.Raycaster();
		this._pointer = new THREE.Vector2();
		this._clickMouse = new THREE.Vector2();
		this._moveMouse = new THREE.Vector2();

		this._threejs.domElement.addEventListener('pointermove', event => {
			//console.log('move');
			event.preventDefault();
			this._moveMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._moveMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
			this._draggingMouseMovedYet = true;
			this.SUB_paintOnMouseMove();
		});
	}

	SUB_setupPainting() {
		this._selectedPaint = new THREE.Color('#FF0000');
		this._eyeDropEnabled = false;
		this._drawing = false;

		this._threejs.domElement.addEventListener('pointerdown', event => {
			//console.log('down');
			if (this._mouseMode != 'paint') { return; }
			this._draggingMouseMovedYet = false;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;


			this._raycaster.setFromCamera(this._clickMouse, this._camera);
			let found = this._raycaster.intersectObjects(this._builtVoxels);

			if (found.length > 0) {
				this._drawing = true;
				this.SUB_paintAtThisIntersect(found[0]);
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			//console.log('up');
			if (this._mouseMode != 'paint') { return; }
			this._drawing = false;
			if (this._eyeDropEnabled) {
				this.SUB_grabColorWithRaycast(event);
			}
		});
	}
	SUB_paintOnMouseMove() {
		if (this._mouseMode != 'paint') { return; }
		if (!this._drawing) { return; }
		this._raycaster.setFromCamera(this._moveMouse, this._camera);
		let found = this._raycaster.intersectObjects(this._builtVoxels);
		if (found.length > 0) {
			this.SUB_paintAtThisIntersect(found[0]);
		}
	}
	SUB_paintAtThisIntersect(intersect) {
		if (this._eyeDropEnabled) { return; }
		intersect.object.material.color = new THREE.Color(this._selectedPaint);
		let pos = this.SUB_voxelPosToLoc(intersect.object.position);
		this._builtBlocks[ pos.join(',') ] = this._selectedPaint.getHexString();
		this.SUB_saveTempVoxelBuilderBuilt();
	}
	SUB_setupBuilding() {
		this._buildSize = 5;
		this._selectedPaint = new THREE.Color('#FF0000');
		this._eyeDropEnabled = false;
		this._builtVoxels = new Array();
		this._canBuildOn = new Array();
		this._canBuildOn.push(this._groundPlane);
		this._builtBlocks = JSON.parse(localStorage.getItem('tempVoxelBuilderBuilt')) || {};

		this.SUB_generateVoxels();

		this._threejs.domElement.addEventListener('pointerdown', event => {
			if (this._mouseMode != 'build' && this._mouseMode != 'erase') { return; }
			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
			this._draggingMouseMovedYet = false;
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			if (this._eyeDropEnabled) {
				this.SUB_grabColorWithRaycast(event);
			} else {
				if (!(this._mouseMode == 'build' || this._mouseMode == 'erase')) { return; }
				//console.log('click');
				this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
				this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	
	
				this._raycaster.setFromCamera(this._clickMouse, this._camera);
				let found = this._raycaster.intersectObjects(this._mouseMode=='build' ? this._canBuildOn : this._builtVoxels);
	
				if (found.length > 0) {
					if (found[0].object.userData.canBuildOn) {
						if (this._mouseMode == 'erase') {
							this.SUB_eraseCubeAtThisIntersect(found[0]);
						} else {
							this.SUB_buildCubeAtThisIntersect(found[0]);
						}
					}
				}
			}
		});
	}
	SUB_generateVoxels() {
		// create temp built blocks
		Object.entries(this._builtBlocks).forEach(([key, val]) => {
			//console.log(key, val);
			let pos = this.SUB_voxelLocToPos(key.split(','));
			//console.log(pos);
			const voxel = new THREE.Mesh(
				new THREE.BoxGeometry(this._buildSize, this._buildSize, this._buildSize),
				new THREE.MeshPhongMaterial( {color: new THREE.Color('#'+val) } )
			);
			voxel.position.set( pos[0], pos[1], pos[2] );
			voxel.castShadow = true;
			voxel.receiveShadow = true;
			voxel.userData.canBuildOn = true;
			this._scene.add(voxel);
			this._builtVoxels.push(voxel);
			this._canBuildOn.push(voxel);
		});
	}
	SUB_eraseCubeAtThisIntersect(intersect) {
		this._scene.remove( intersect.object );
		this._builtVoxels.splice( this._builtVoxels.indexOf( intersect.object ), 1 );
		this._canBuildOn.splice( this._canBuildOn.indexOf( intersect.object ), 1 );
		let pos = this.SUB_voxelPosToLoc(intersect.object.position);
		delete this._builtBlocks[ pos.join(',') ];
		this.SUB_saveTempVoxelBuilderBuilt();
	}
	SUB_buildCubeAtThisIntersect(intersect) {
		const voxel = new THREE.Mesh(
			new THREE.BoxGeometry(this._buildSize, this._buildSize, this._buildSize),
			new THREE.MeshPhongMaterial( {color: this._selectedPaint} )
		);
		voxel.position.copy(intersect.point).add(intersect.face.normal);
		voxel.castShadow = true;
		voxel.receiveShadow = true;
		voxel.userData.canBuildOn = true;
		voxel.position.divideScalar(this._buildSize).floor().multiplyScalar(this._buildSize).addScalar(this._buildSize / 2);
		let pos = this.SUB_voxelPosToLoc(voxel.position);
		if (pos.join(',') in this._builtBlocks) {
			return;
		}
		this._builtBlocks[ pos.join(',') ] = this._selectedPaint.getHexString();
		this.SUB_saveTempVoxelBuilderBuilt();
		//console.log(pos);
		this._scene.add(voxel);
		this._builtVoxels.push(voxel);
		this._canBuildOn.push(voxel);
	}
	SUB_grabColorWithRaycast(event) {
		this._raycaster.setFromCamera(this._moveMouse, this._camera);
		let found = this._raycaster.intersectObjects(this._builtVoxels);
		if (found.length > 0) {
			this._selectedPaint = found[0].object.material.color;
			this._eyeDropEnabled = false;
			this.setMouseMode(this._mouseMode);
			this._afterUsedEyeDropCallback(this._selectedPaint.getHexString());
		}
	}
	SUB_voxelPosToLoc(position) {
		let { x, y, z } = position;
		let pos = [ x, y, z ];
		return pos.map(x => x = (x - (this._buildSize / 2)) / this._buildSize );
	}
	SUB_voxelLocToPos(location) {
		return location.map(x => x = (parseInt(x) * this._buildSize) + (this._buildSize / 2) );
	}
	SUB_saveTempVoxelBuilderBuilt() {
		this.SUB_addHistory();
		localStorage.setItem('tempVoxelBuilderBuilt', JSON.stringify(this._builtBlocks));
	}
	SUB_clear() {
		this._builtVoxels.forEach(voxel => {
			this._scene.remove(voxel);
			voxel.geometry.dispose();
			voxel.material.dispose();
		});
		this._builtVoxels = new Array();
		this._canBuildOn = [this._groundPlane];
	}

	SUB_addHistory() {
		if (!this._history) {
			this._history = [];
		}
		this._redoHistory = [];
		if (this._history.length >= 10) {
			this._history.shift();
		}
		this._history.push(JSON.parse(localStorage.getItem('tempVoxelBuilderBuilt') || '{}'));
	}
	SUB_undo() {
		if (!this._history || this._history.length < 1) { return; }

		if (this._redoHistory.length >= 10) {
			this._redoHistory.shift();
		}
		this._redoHistory.push(this._builtBlocks);
		this._builtBlocks = this._history.pop();
		
		this.SUB_clear();
		this.SUB_generateVoxels();
	}
	
	SUB_redo() {
		if (!this._history || this._redoHistory.length < 1) { return; }
		let toSet = this._redoHistory[this._redoHistory.length - 1] || null;
		if (!toSet) { console.log('no redo set'); return; }
		this._redoHistory.pop();
		this._history.push( Object.assign({}, this._builtBlocks) );
		this._builtBlocks = toSet;
		this.SUB_clear();
		this.SUB_generateVoxels();
	}

	async SUB_ModelFileToMesh(file) {
        const arrayBuffer = await this.SUB_readFileAsArrayBuffer(file);
        let geometry;
        if (file.name.toLowerCase().endsWith('.stl')) {
            geometry = await this.SUB_loadSTLFromArrayBuffer(arrayBuffer);
        } else if (file.name.toLowerCase().endsWith('.obj')) {
            geometry = await this.SUB_loadOBJFromArrayBuffer(arrayBuffer);
        } else {
            throw new Error('Unsupported file format');
        }
		if (geometry.type == 'Group') {
			let mesh = new THREE.Mesh(
				geometry.children[0].geometry,
				new THREE.MeshPhongMaterial({
					color: 0xff0000,
					side: THREE.DoubleSide
				})
			);
			console.log('Mesh loaded:', mesh);
			return mesh;
		} else if (geometry.type == 'BufferGeometry') {
			let mesh = new THREE.Mesh(
				geometry,
				new THREE.MeshPhongMaterial({
					color: 0xff0000,
					side: THREE.DoubleSide
				})
			);
			console.log('Mesh loaded:', mesh);
			return mesh;
		}
		return null;
	}

	SUB_readFileAsArrayBuffer(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(file);
		});
	}
	async SUB_loadSTLFromArrayBuffer(arrayBuffer) {
		const loader = new STLLoader();
		return new Promise((resolve, reject) => {
			try {
				const geometry = loader.parse(arrayBuffer);
				resolve(geometry);
			} catch (error) {
				reject(error);
			}
		});
	}
	async SUB_loadOBJFromArrayBuffer(arrayBuffer) {
		const loader = new OBJLoader();
		return new Promise((resolve, reject) => {
			try {
				const text = new TextDecoder().decode(arrayBuffer);
				const object = loader.parse(text);
				resolve(object);
			} catch (error) {
				reject(error);
			}
		});
	}
	async SUB_voxelizeMesh(mesh) {
		await sleep(500);

		// voxelize
		this._voxelizerRaycaster = new THREE.Raycaster();
		let output = {};
		const boundingBox = new THREE.Box3().setFromObject(mesh);
		let startX = (this._buildSize*Math.ceil( boundingBox.min.x /this._buildSize)) - this._buildSize;
		let startY = (this._buildSize*Math.ceil( boundingBox.min.y /this._buildSize)) - this._buildSize;
		let startZ = (this._buildSize*Math.ceil( boundingBox.min.z /this._buildSize)) - this._buildSize;
		for (let i = startX; i < boundingBox.max.x; i += this._buildSize) {
			for (let j = startY; j < boundingBox.max.y; j += this._buildSize) {
				for (let k = startZ; k < boundingBox.max.z; k += this._buildSize) {
					const pos = new THREE.Vector3(i, j, k);
					console.log('.');
					if (await this.SUB_isInsideMesh(pos, mesh)) {
						output[ [i / this._buildSize, j / this._buildSize, k / this._buildSize].join(',') ] = 'FF0000';
					}
				}
			}
		}
		sleep(1000);
		return output;
	}
	async SUB_isInsideMesh(pos, mesh) {
		this._voxelizerRaycaster.set(pos, {x: 0, y: -1, z: 0});
		let rayCasterIntersects = this._voxelizerRaycaster.intersectObject(mesh, false);
		return rayCasterIntersects.length % 2 === 1; // we need odd number of intersections
	}

	SUB_createSkybox() {
		/*const loader = new THREE.CubeTextureLoader();
		const texture = loader.load([
			'./resources/posx.jpg',
			'./resources/negx.jpg',
			'./resources/posy.jpg',
			'./resources/negy.jpg',
			'./resources/posz.jpg',
			'./resources/negz.jpg',
		]);
		this._scene.background = texture;*/
		this._scene.background = new THREE.Color( 0xf0f0f0 );
	}

	SUB_createFloor() {
		const gridSquareSize = 10;
		const realWorldSize = 100;
		const divisions = realWorldSize / gridSquareSize;
		const gridHelper = new THREE.GridHelper(realWorldSize, divisions);
		gridHelper.position.set(0, 0, 0);
		this._scene.add(gridHelper);

		this._groundPlane = new THREE.Mesh(
			new THREE.PlaneGeometry( realWorldSize, realWorldSize ),
			new THREE.MeshBasicMaterial({ visible: false }) // THIS MAT CANNOT NOT FÅ SHADOW
		);
		this._groundPlane.rotateX(-Math.PI / 2);
		this._groundPlane.position.set(0, 0.001, 0);
		this._groundPlane.userData.canBuildOn = true;
		this._scene.add( this._groundPlane );
	}

	SUB_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._threejs.setSize(window.innerWidth, window.innerHeight);
	}

	SUB_RAF() {
		requestAnimationFrame(() => {
			this._threejs.render(this._scene, this._camera);
			this.SUB_RAF();
		});
	}
	setMouseMode(mode) {
		this._mouseMode = mode;
		if (mode == 'pan') {
			this._controls.enabled = true;
		} else {
			this._controls.enabled = false;
		}
	}
	updateSlectedPaint(clrStr) {
		this._selectedPaint = new THREE.Color(clrStr);
	}
	enableEyeDrop(callback) {
		this._afterUsedEyeDropCallback = callback;
		this._eyeDropEnabled = true;
		this._controls.enabled = false;
	}
	addThisGeometryToScene(geometry) {
		let mesh = new THREE.Mesh(
			geometry,
			new THREE.MeshPhongMaterial({
				color: 0xff0000
			})
		);
		this._scene.add(mesh);
	}
}



window.addEventListener('DOMContentLoaded', () => {
	globalThis._APP = new BasicWorldDemo();
});
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}