import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';


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

		this._controls = new OrbitControls(
			this._camera, this._threejs.domElement
		);
		this._controls.target.set(0, 20, 0);
		this._controls.update();
		this._squareSize = 5;

		this.SUB_loadWorldFile();

		this.SUB_createRaycaster();
		this.SUB_setupMoveToken();
		this.SUB_setupPainting();

		this.SUB_createSkybox();

		this.SUB_createFloor();

		this.SUB_createTokens();

		this.SUB_RAF();
	}

	SUB_loadWorldFile() {
		try {
			let idToOpen = localStorage.getItem('worldIdToOpen');
			this._worldFile = JSON.parse(localStorage.getItem('WorldFile-' + idToOpen));
		} catch (e) {
			console.log(e);
			location.href = 'index.html';
		}
	}
	SUB_saveWorldFile() {
		this._worldFile.lastEdited = new Date();
		localStorage.setItem('WorldFile-' + this._worldFile.id, JSON.stringify(this._worldFile));
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
	SUB_setupMoveToken() {
		this._dragging;
		this._draggingMouseMovedYet = false;

		this._threejs.domElement.addEventListener('pointerdown', event => {
			if (this._mouseMode != 'drag') { return; }
			this._draggingMouseMovedYet = false;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

			const found = this.SUB_intersect(this._clickMouse);
			if (found.length > 0) {
				if (found[0].object.userData.draggable) {
					this._dragging = found[0].object
					console.log(`found draggable ${this._dragging.userData.name}`);
				}
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			if (this._mouseMode != 'drag') { return; }
			this._dragging = null;
			this._draggingMouseMovedYet = false;
			this._controls.enabled = true;
		});
	}
	SUB_dragObjectEveryFrame() {
		if (this._mouseMode != 'drag') { return; }
		if (this._draggingMouseMovedYet && this._dragging != null) {
			const found = this.SUB_intersect(this._moveMouse);
			if (found.length > 0) {
				for (let i = 0; i < found.length; i++) {
					if (!found[i].object.userData.ground)
						continue;

					this._controls.enabled = false;
					let target = found[i].point;
					this._dragging.position.x = target.x;
					this._dragging.position.z = target.z;
					this._worldFile.tokens.filter(x => x.thisSessionUuid == this._dragging.uuid)[0].position = { 'x': target.x, 'z': target.z };
					this.SUB_saveWorldFile();
				}
			}
		}
	}

	SUB_setupPainting() {
		this._buildingMode = 'paint';
		this._selectedPaint = 'cr8';
		this._drawing = false;
		this.SUB_getPaints();

		this._threejs.domElement.addEventListener('pointerdown', event => {
			//console.log('down');
			if (this._mouseMode != 'paint') { return; }
			this._draggingMouseMovedYet = false;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;


			this._raycaster.setFromCamera(this._clickMouse, this._camera);
			let found = this._raycaster.intersectObjects(this._groundTiles1D);

			if (found.length > 0) {
				if (found[0].object.userData.ground) {
					this._drawing = true;
					this.SUB_paintTileAtThisIntersect(found[0]);
				}
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			//console.log('up');
			if (this._mouseMode != 'paint') { return; }
			this._drawing = false;
		});
	}
	SUB_paintTileAtThisIntersect(intersect) {
		//console.log(intersect);
		this._worldFile.floor.arr[intersect.object.userData.tilePos.i][intersect.object.userData.tilePos.j][0] = this._selectedPaint;
		this.SUB_saveWorldFile();
		intersect.object.material = this._paints[this._selectedPaint];
	}
	SUB_getPaints() {
		const textures = [
			['cbl_16.png', null],
			['cr8_16.png', 0xfeb74c],
			['drt_16.png', null],
			['grs_16.png', null],
			['snd_16.png', null],
			['stn_16.jpg', null],
			['wtr_16.png', 0x03e3fc],
			['wud_16.png', null]
		];
		this._paints = {};
		textures.forEach(text => {
			const key = text[0].split('_')[0];

			let map = new THREE.TextureLoader().load('textures/' + text[0]);
			map.colorSpace = THREE.SRGBColorSpace;
			let buildingVoxelMat = new THREE.MeshLambertMaterial({
				map: map,
				color: text[1]
			});
			this._paints[key] = buildingVoxelMat;
		});
		this._paints['blk'] = new THREE.MeshLambertMaterial({
			color: 0x000000
		});
		this._paints['000'] = new THREE.MeshLambertMaterial({
			color: 0xf9c834
		});
	}
	SUB_paintOnMouseMove() {
		if (this._mouseMode != 'paint') { return; }
		if (!this._drawing) { return; }
		this._raycaster.setFromCamera(this._moveMouse, this._camera);
		let found = this._raycaster.intersectObjects(this._groundTiles1D);
		if (found.length > 0) {
			if (found[0].object.userData.ground) {
				this.SUB_paintTileAtThisIntersect(found[0]);
			}
		}
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
		const size = this._worldFile.floor.size;
		const gridSquareSize = 10;
		const realWorldSize = size * this._squareSize;
		this._groundTiles1D = Array();
		if (this._worldFile.floor.arr == null) {
			this._worldFile.floor.arr = new Array(size).fill(0);
		}

		let makeLittleGroundPlane = (x, z, i, j) => {
			if (this._worldFile.floor.arr[i] == 0) {
				this._worldFile.floor.arr[i] = new Array(size);
				for (let l = 0; l < size; l++) {
					this._worldFile.floor.arr[i][l] = [this._worldFile.floor.defaultTexture, 0];
				}
			}
			let littleSquare = new THREE.Mesh(
				new THREE.PlaneGeometry(this._squareSize, this._squareSize, 1, 1),
				this._paints[this._worldFile.floor.arr[i][j][0]]
			);
			littleSquare.position.set(x, this._worldFile.floor.arr[i][j][1] * this._squareSize, z);
			littleSquare.rotation.x = -Math.PI / 2;
			littleSquare.castShadow = false;
			littleSquare.receiveShadow = true;
			littleSquare.userData.ground = true;
			littleSquare.userData.tilePos = { "i": i, "j": j };
			this._scene.add(littleSquare);
			this._groundTiles1D.push(littleSquare);
		};

		for (let i = 0; i < size; i += 1) {
			for (let j = 0; j < size; j += 1) {
				makeLittleGroundPlane((i * this._squareSize) - (realWorldSize / 2) + (this._squareSize / 2), (j * this._squareSize) - (realWorldSize / 2) + (this._squareSize / 2), i, j);
			}
		}
		this.SUB_saveWorldFile();


		const divisions = realWorldSize / gridSquareSize;
		const gridHelper = new THREE.GridHelper(realWorldSize, divisions);
		gridHelper.position.set(0, 0.01, 0);
		this._scene.add(gridHelper);
	}

	SUB_createTokens() {
		this._worldFile.tokens.forEach(token => {
			let scale = { x: 6, y: 10, z: 6 }

			let box = new THREE.Mesh(
				new THREE.BoxGeometry(scale.x, scale.y, scale.z),
				new THREE.MeshPhongMaterial({
					color: token.color
				})
			);
			box.position.set(token.position.x, scale.y / 2, token.position.z);
			box.castShadow = true;
			box.receiveShadow = true;
			this._scene.add(box)

			box.userData.draggable = true;
			box.userData.name = token.name;
			token.thisSessionUuid = box.uuid;
		});
	}

	SUB_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._threejs.setSize(window.innerWidth, window.innerHeight);
	}

	SUB_RAF() {
		requestAnimationFrame(() => {
			this.SUB_dragObjectEveryFrame();
			this._threejs.render(this._scene, this._camera);
			this.SUB_RAF();
		});
	}
	// above is all jobbig stuff to start scene and such
	makeBox(x, y, z) {
		const box = new THREE.Mesh(
			new THREE.BoxGeometry(2, 2, 2),
			new THREE.MeshStandardMaterial({
				color: 0x808080,
			}));
		box.position.set(x, y, z);
		box.castShadow = true;
		box.receiveShadow = true;
		this._scene.add(box);
	}
	setMouseMode(mode) {
		this._mouseMode = mode;
		if (mode == 'build' || mode == 'paint') {
			this._controls.enabled = false;
		} else {
			this._controls.enabled = true;
		}
	}
}



window.addEventListener('DOMContentLoaded', () => {
	globalThis._APP = new BasicWorldDemo();
});