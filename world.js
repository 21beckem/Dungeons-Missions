import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';


class MissionMinecraft {
	constructor(mode) {
		this.playMode = mode;
		this.runningMulti = false;
	}

	InitializeWorld() {
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
		this.SUB_setupTerraining();

		this.SUB_createSkybox();

		this.SUB_createFloor();
		this.SUB_saveWorldFile();

		this.SUB_createTokens();

		this.SUB_RAF();
	}

	SUB_loadWorldFile() {
		if (this.playMode == 'local') {
			try {
				let idToOpen = localStorage.getItem('worldIdToOpen');
				this._worldFile = JSON.parse(localStorage.getItem('WorldFile-' + idToOpen));
				if (!idToOpen || !this._worldFile) {
					location.href = 'index.html';
				}
			} catch (e) {
				console.log(e);
				location.href = 'index.html';
			}
			Playroom.setState('WorldFile', this._worldFile);
		} else {
			try {
				this._worldFile = Playroom.getState('WorldFile');
				console.log(Playroom.getRoomCode());
				console.log(this._worldFile);
				if (!this._worldFile) {
					location.href = 'joinGame.html';
				}
			} catch (e) {
				console.log(e);
				location.href = 'joinGame.html';
			}
		}
	}
	SUB_saveWorldFile() {
		if (JSON.stringify(this._worldFile) == localStorage.getItem('WorldFile-' + this._worldFile.id)) {
			return;
		}
		this._worldFile.lastEdited = new Date();
		localStorage.setItem('WorldFile-' + this._worldFile.id, JSON.stringify(this._worldFile));
		if (this.runningMulti && this.playMode == 'local') {
			Playroom.setState('WorldFile', this._worldFile);
		}
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
			this.SUB_terrainSquareOnMouseMove();
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
		this._selectedPaint = 'wud';
		this._paintTool = 'brush';
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
					if (this._paintTool != 'bucket') {
						this._drawing = true;
						this.SUB_paintTileAtThisIntersect(found[0]);
					}
				}
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			//console.log('up');
			if (this._mouseMode != 'paint') { return; }
			if (this._paintTool == 'bucket') {
				this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
				this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
				this._raycaster.setFromCamera(this._clickMouse, this._camera);
				let found = this._raycaster.intersectObjects(this._groundTiles1D);
				if (found.length > 0) {
					this.SUB_bucketFillAtThisIntersect(found[0]);
				}
			}
			this._drawing = false;
			this.SUB_saveWorldFile();
		});
	}
	SUB_paintTileAtThisIntersect(intersect) {
		//console.log(intersect);
		//console.log(intersect.point);
		let thisPaint = (this._paintTool == 'eraser') ? this._worldFile.floor.defaultTexture : this._selectedPaint;
		this._worldFile.floor.arr[intersect.object.userData.tilePos.i][intersect.object.userData.tilePos.j][0] = thisPaint;
		intersect.object.material = this._paints[thisPaint];
	}
	SUB_bucketFillAtThisIntersect(intersect) {
		const bucketFillMatrix = (row, col, original) => {
			if ( !(row >= 0 && row < this._worldFile.floor.arr.length && col >= 0 && col < this._worldFile.floor.arr[row].length) ) {
				return;
			}
			
			// return if different than original clicked tile in terms of paint or height
			if (this._worldFile.floor.arr[row][col][0] != original[0] || this._worldFile.floor.arr[row][col][1] != original[1]) {
				return;
			}
			
			// set to new
			this._groundTiles1D.filter(x => x.userData.tilePos.i == row && x.userData.tilePos.j == col)[0].material = this._paints[this._selectedPaint];
			this._worldFile.floor.arr[row][col][0] = this._selectedPaint;

			bucketFillMatrix(row + 1, col, original);
			bucketFillMatrix(row - 1, col, original);
			bucketFillMatrix(row, col + 1, original);
			bucketFillMatrix(row, col - 1, original);
		}
		let pos = intersect.object.userData.tilePos;
		bucketFillMatrix(pos.i, pos.j, [...this._worldFile.floor.arr[pos.i][pos.j]]);
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
	SUB_calculateRectangleOrLine(coord1, coord2, offset) {
		// Determine the minimum and maximum x and y coordinates
		const minX = Math.min(coord1[0], coord2[0]);
		const maxX = Math.max(coord1[0], coord2[0]);
		const minY = Math.min(coord1[1], coord2[1]);
		const maxY = Math.max(coord1[1], coord2[1]);
	
		// Check if the provided coordinates form a line (either vertical or horizontal)
		const isVerticalLine = minX === maxX;
		const isHorizontalLine = minY === maxY;
	
		if ((isVerticalLine || isHorizontalLine) && !(isVerticalLine && isHorizontalLine)) {
			// Extend the line into a rectangle by adding offset to the line coordinates
			const lineStart = isVerticalLine ? minY : minX;
			const lineEnd = isVerticalLine ? maxY : maxX;
			const extendedStart = lineStart - offset;
			const extendedEnd = lineEnd + offset;
	
			// Determine the corners of the rectangle based on the extended line
			const topLeft = isVerticalLine ? [minX - offset, extendedStart] : [extendedStart, minY - offset];
			const topRight = isVerticalLine ? [maxX + offset, extendedStart] : [extendedEnd, minY - offset];
			const bottomRight = isVerticalLine ? [maxX + offset, extendedEnd] : [extendedEnd, maxY + offset];
			const bottomLeft = isVerticalLine ? [minX - offset, extendedEnd] : [extendedStart, maxY + offset];
	
			return [topLeft, topRight, bottomRight, bottomLeft];
		}
	
		// Calculate corners of the rectangle with the specified offset
		const topLeft = [minX - offset, minY - offset];
		const topRight = [maxX + offset, minY - offset];
		const bottomLeft = [minX - offset, maxY + offset];
		const bottomRight = [maxX + offset, maxY + offset];
	
		return [topLeft, topRight, bottomRight, bottomLeft];
	}
	SUB_setupTerrainSquare() {
		this._terrainSquare = new THREE.Line(
			new THREE.BufferGeometry().setFromPoints([]),
			new THREE.LineBasicMaterial( { color: 0x0000ff, visible: true } )
		);
		this._terrainSquare.renderOrder = 999;
		this._terrainSquare.material.depthTest = false;
		this._terrainSquare.material.depthWrite = false;
		this._scene.add(this._terrainSquare);
		this._worldSpaceOffset = ((this._worldFile.floor.size*this._squareSize) / 2) - (this._squareSize / 2);
	}
	SUB_drawTerrainSquare(pos1, pos2) {
		const w = this._squareSize / 2;
		const h = 0.2;
		let points = new Array();
		const corners = this.SUB_calculateRectangleOrLine(
			[(pos1.i * this._squareSize) - this._worldSpaceOffset, (pos1.j * this._squareSize) - this._worldSpaceOffset],
			[(pos2.i * this._squareSize) - this._worldSpaceOffset, (pos2.j * this._squareSize) - this._worldSpaceOffset],
			w
		);
		points.push( new THREE.Vector3( corners[0][0], h, corners[0][1] ) );
		points.push( new THREE.Vector3( corners[1][0], h, corners[1][1] ) );
		points.push( new THREE.Vector3( corners[2][0], h, corners[2][1] ) );
		points.push( new THREE.Vector3( corners[3][0], h, corners[3][1] ) );
		points.push( new THREE.Vector3( corners[0][0], h, corners[0][1] ) );

		this._terrainSquare.geometry = new THREE.BufferGeometry().setFromPoints( points );
	}
	SUB_setupTerraining() {
		this._firstTerrainSquarePos = null;
		this._lastTerrainSquarePos = null;
		this._terrain
		this._terrainSquareIncludedTiles = new Array();
		this.SUB_setupTerrainSquare();

		this._threejs.domElement.addEventListener('pointerdown', event => {
			//console.log('down');
			if (this._mouseMode != 'terrain') { return; }
			this._draggingMouseMovedYet = false;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;


			this._raycaster.setFromCamera(this._clickMouse, this._camera);
			let found = this._raycaster.intersectObjects(this._groundTiles1D);

			if (found.length > 0) {
				if (found[0].object.userData.ground) {
					this._drawing = true;
					this._firstTerrainSquarePos = found[0].object.userData.tilePos;
					this._lastTerrainSquarePos = found[0].object.userData.tilePos;
					this.SUB_drawTerrainSquare(this._firstTerrainSquarePos, this._lastTerrainSquarePos);
				}
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			//console.log('up');
			if (this._mouseMode != 'terrain') { return; }
			this._drawing = false;

			// calculate tiles inside range
			//console.log(this._firstTerrainSquarePos, this._lastTerrainSquarePos);

			const minI = Math.min(this._firstTerrainSquarePos.i, this._lastTerrainSquarePos.i);
			const maxI = Math.max(this._firstTerrainSquarePos.i, this._lastTerrainSquarePos.i);
			const minJ = Math.min(this._firstTerrainSquarePos.j, this._lastTerrainSquarePos.j);
			const maxJ = Math.max(this._firstTerrainSquarePos.j, this._lastTerrainSquarePos.j);
			this._terrainSquareIncludedTiles = new Array();
			for (let i = minI; i <= maxI; i++) {
				for (let j = minJ; j <= maxJ; j++) {
					this._terrainSquareIncludedTiles.push( [i,j] );
				}
			}
			//console.log(this._terrainSquareIncludedTiles);
		});
	}
	SUB_terrainSquareOnMouseMove() {
		if (this._mouseMode != 'terrain') { return; }
		if (!this._drawing) { return; }
		this._raycaster.setFromCamera(this._moveMouse, this._camera);
		let found = this._raycaster.intersectObjects(this._groundTiles1D);
		if (found.length > 0) {
			if (found[0].object.userData.ground && found[0].object.userData.tilePos != this._lastTerrainSquarePos) {
				this._lastTerrainSquarePos = found[0].object.userData.tilePos;
				this.SUB_drawTerrainSquare(this._firstTerrainSquarePos, this._lastTerrainSquarePos);
			}
		}
	}
	TERRAIN_add() {
		if (this._mouseMode != 'terrain' || this._terrainSquareIncludedTiles.length < 1) { return; }
		for (let i = 0; i < this._terrainSquareIncludedTiles.length; i++) {
			const tilePos = this._terrainSquareIncludedTiles[i];
			this._worldFile.floor.arr[tilePos[0]][tilePos[1]][1] += 1;
		}
		this.SUB_saveWorldFile();
		this.TERRAIN_clear();
		this.SUB_createFloor();
	}
	TERRAIN_subtract() {
		if (this._mouseMode != 'terrain' || this._terrainSquareIncludedTiles.length < 1) { return; }
		for (let i = 0; i < this._terrainSquareIncludedTiles.length; i++) {
			const tilePos = this._terrainSquareIncludedTiles[i];
			this._worldFile.floor.arr[tilePos[0]][tilePos[1]][1] = Math.max(this._worldFile.floor.arr[tilePos[0]][tilePos[1]][1]-1, 0);
		}
		this.SUB_saveWorldFile();
		this.TERRAIN_clear();
		this.SUB_createFloor();
	}
	TERRAIN_clear() {
		for (let i = 0; i < this._groundTiles1D.length; i++) {
			const tile = this._groundTiles1D[i];
			if (tile.userData.wallMesh) {
				this._scene.remove(tile.userData.wallMesh);
				tile.userData.wallMesh.geometry.dispose();
				tile.userData.wallMesh.material.dispose();
				delete this._groundTiles1D[i].userData.wallMesh;
			}
			this._scene.remove(tile);
			tile.geometry.dispose();
			tile.material.dispose();
			delete this._groundTiles1D[i];
		}
		this._groundTiles1D = new Array();
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
					this._worldFile.floor.arr[i][l] = [this._worldFile.floor.defaultTexture, 0, 0];
				}
			}
			let littleSquare = new THREE.Mesh(
				new THREE.PlaneGeometry(this._squareSize, this._squareSize, 1, 1),
				this._paints[this._worldFile.floor.arr[i][j][0]]
			);
			const height = this._worldFile.floor.arr[i][j][1];
			const wallColor = this._worldFile.floor.arr[i][j][2];
			littleSquare.position.set(x, height * this._squareSize, z);
			littleSquare.rotation.x = -Math.PI / 2;
			littleSquare.castShadow = false;
			littleSquare.receiveShadow = true;
			littleSquare.userData.ground = true;
			littleSquare.userData.tilePos = { i: i, j: j };
			this._scene.add(littleSquare);
			this._groundTiles1D.push(littleSquare);

			// make walls if has height:
			if (height > 0) {
				// for each of the 4 adjacent tiles
				let rawVerts = new Array();
				
				// find 4 corners for this tile
				let numHelperI = (i * this._squareSize) - (realWorldSize / 2);
				let numHelperJ = (j * this._squareSize) - (realWorldSize / 2);
				const corners = [
					[ // topLeft
						numHelperI + this._squareSize,
						numHelperJ + this._squareSize
					],
					[ // topRight
						numHelperI,
						numHelperJ + this._squareSize
					],
					[ // bottomLeft
						numHelperI + this._squareSize,
						numHelperJ
					],
					[ // bottomRight
						numHelperI,
						numHelperJ
					]
				]

				let sides = [ [1,0, 0,2], [-1,0, 3,1], [0,1, 1,0], [0,-1, 2,3] ];
				for (let k = 0; k < sides.length; k++) {
					const side = sides[k];

					// if that tiles doesn't exist: continue
					let opponent;
					try {
						opponent = this._worldFile.floor.arr[i + side[0]][j + side[1]][1];
					} catch (e) { opponent = 0; }
					if (opponent == undefined) { opponent = 0; }
					
					// if their height is more than or equal to mine: continue
					if (opponent >= height) { continue; }
					//console.log(opponent, k);
					let minRealH = height * this._squareSize;
					let oppRealH = opponent * this._squareSize;
					
					// add to points to rawVerts for this wall
					rawVerts.push( corners[side[2]][0], oppRealH, corners[side[2]][1] );
					rawVerts.push( corners[side[3]][0], minRealH, corners[side[3]][1] );
					rawVerts.push( corners[side[2]][0], minRealH, corners[side[2]][1] );

					rawVerts.push( corners[side[2]][0], oppRealH, corners[side[2]][1] );
					rawVerts.push( corners[side[3]][0], oppRealH, corners[side[3]][1] );
					rawVerts.push( corners[side[3]][0], minRealH, corners[side[3]][1] );
				}
				if (rawVerts.length > 0) {
					const geometry = new THREE.BufferGeometry();
					geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(rawVerts), 3 ) );
					geometry.computeFaceNormals();
    				geometry.computeVertexNormals();
					let walls = new THREE.Mesh(
						geometry,
						this._paints[this._worldFile.floor.arr[i][j][0]]
					);
					walls.castShadow = true;
					walls.receiveShadow = true;
					walls.userData.wall = true;
					this._scene.add(walls);
					littleSquare.userData.wallMesh = walls;
				}
			}
		};

		for (let i = 0; i < size; i += 1) {
			for (let j = 0; j < size; j += 1) {
				makeLittleGroundPlane((i * this._squareSize) - (realWorldSize / 2) + (this._squareSize / 2), (j * this._squareSize) - (realWorldSize / 2) + (this._squareSize / 2), i, j);
			}
		}


		const divisions = realWorldSize / gridSquareSize;
		const gridHelper = new THREE.GridHelper(realWorldSize, divisions);
		gridHelper.position.set(0, 0.01, 0);
		this._scene.add(gridHelper);
	}

	SUB_createCustomObject(objJson) {
		console.log(objJson);
		const sideTriangles = {
			front: [
				-1, 1, 1,
				1, 1, 1,
				-1, -1, 1,
				1, -1, 1
			],
			back: [
				1, 1, -1,
				-1, 1, -1,
				1, -1, -1,
				-1, -1, -1
			],
			left: [
				-1, 1, -1,
				-1, 1, 1,
				-1, -1, -1,
				-1, -1, 1
			],
			right: [
				1, 1, 1,
				1, 1, -1,
				1, -1, 1,
				1, -1, -1
			],
			top: [
				-1, 1, 1,
				1, 1, 1,
				-1, 1, -1,
				1, 1, -1
			],
			bottom: [
				1, -1, 1,
				-1, -1, 1,
				1, -1, -1,
				-1, -1, -1
			]
		}
		// loop through keys in objJson

			// loop through each side of cube

			// if that coordinate exists in objJson keys
				// skip
			// else
				// create that face
				// assign triangle colors
		
		// somehow create hitbox

		// retrun created obj and hitbox as JSON
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
			let playFile = Playroom.getState('WorldFile');
			if (playFile) {
				if (this._worldFile.lastEdited != playFile.lastEdited) {
					this._worldFile = playFile;
					this.TERRAIN_clear();
					this.SUB_createFloor();
				}
			}
			this.SUB_dragObjectEveryFrame();
			this._threejs.render(this._scene, this._camera);
			this.SUB_RAF();
		});
	}
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//  # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//
	//                                              PLAYROOM TIME
	//
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//  # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	async startHosting(beginHostingBtn) {
		if (Playroom.getRoomCode()) {
			// copy the code
			navigator.clipboard.writeText(Playroom.getRoomCode());
		} else {
			// start the loader
			beginHostingBtn.innerHTML = '<div class="loader" style="margin-left: calc(50% - 15px);"></div>';
			// start multiplayer
			await Playroom.insertCoin({skipLobby: true}, () => {
				beginHostingBtn.innerHTML = Playroom.getRoomCode();
				this.runningMulti = true;
			
				Playroom.setState('WorldFile', this._worldFile);
			});
		}
	}
	async joinGameWithCode(beginHostingBtn, code) {
		await Playroom.insertCoin({
			skipLobby: true,
			roomCode: code
		}, () => {
			beginHostingBtn.innerHTML = code;
		});
		this.runningMulti = true;
		await sleep(100);
	}
	getRoomCode() {
		return Playroom.getRoomCode();
	}
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//  # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//
	//                                        USER INTERFACE FUNCTIONS
	//
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	//  # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
	// # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
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
		if (mode == 'terrain') {
			this._controls.enabled = false;
			this._terrainSquare.material.visible = true;
		} else if (mode == 'paint' || mode == 'drag') {
			this._controls.enabled = false;
			this._terrainSquare.material.visible = false;
		} else {
			this._controls.enabled = true;
			this._terrainSquare.material.visible = false;
		}
	}
	async importPresetEntity(objFileName) {
		let res = await fetch('entities/' + objFileName);
		let jsn = await res.json();
		this.SUB_createCustomObject(jsn);
	}
}
globalThis.InitMissionMinecraft = (mode='local') => {
	if (!globalThis._APP) {
		globalThis._APP = new MissionMinecraft(mode);
	}
}
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}