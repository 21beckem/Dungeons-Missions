import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

function _(x) {return document.getElementById(x);}

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

		this._mouseMode = 'interact';

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
		this.SUB_setupDraggingEntities();
		this.SUB_setupPainting();
		this.SUB_setupTerraining();

		this.SUB_createSkybox();

		this.SUB_createFloor();
		this.SUB_saveWorldFile_floor();

		this.SUB_createEntitiesOnLoad();

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
			if (localStorage.getItem('goBackToHosting')) {
				let code = localStorage.getItem('goBackToHosting');
				history.pushState(null, null, '#r=' + code);
				localStorage.removeItem('goBackToHosting');
				if (localStorage.getItem('forceHostingBackOn') == '1') {
					localStorage.removeItem('forceHostingBackOn');
					this.startHosting(_('beginHostingBtn'));
				}
			}
			Playroom.setState('WorldFile', this._worldFile);
		} else {
			try {
				this._worldFile = Playroom.getState('WorldFile');
				console.log(Playroom.getRoomCode());
				console.log(this._worldFile);
				if (!this._worldFile) {
					console.log('no world file found');
					location.href = 'joinGame.html';
				}
			} catch (e) {
				console.log(e);
				location.href = 'joinGame.html';
			}
		}
	}
	SUB_saveWorldFile_floor() {
		if (JSON.stringify(this._worldFile) == localStorage.getItem('WorldFile-' + this._worldFile.id)) {
			return;
		}
		if (this.playMode != 'local') { return; }
		this._worldFile.lastEdited = new Date().toISOString();
		this._worldFile.floor.lastEdited = new Date().toISOString();
		if (this.playMode == 'local') {
			localStorage.setItem('WorldFile-' + this._worldFile.id, JSON.stringify(this._worldFile));
		}
		if (this.runningMulti && this.playMode == 'local') {
			Playroom.setState('WorldFile', this._worldFile);
		}
	}
	SUB_saveWorldFile_entities() {
		if (JSON.stringify(this._worldFile) == localStorage.getItem('WorldFile-' + this._worldFile.id)) {
			return;
		}
		if (this.playMode != 'local') { return; }
		this._worldFile.lastEdited = new Date().toISOString();
		this._worldFile.entities.lastEdited = new Date().toISOString();
		if (this.playMode == 'local') {
			localStorage.setItem('WorldFile-' + this._worldFile.id, JSON.stringify(this._worldFile));
		}
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

	SUB_createRaycaster() {
		this._raycaster = new THREE.Raycaster();
		this._pointer = new THREE.Vector2();
		this._clickMouse = new THREE.Vector2();
		this._moveMouse = new THREE.Vector2();
		this._moveMouseDistance = 0;

		this._threejs.domElement.addEventListener('pointermove', event => {
			//console.log('move');
			event.preventDefault();
			let newMouseX = (event.clientX / window.innerWidth) * 2 - 1;
			let newMouseY = -(event.clientY / window.innerHeight) * 2 + 1
			this._moveMouseDistance += Math.sqrt(Math.pow(this._moveMouse.y - newMouseY, 2) + Math.pow(this._moveMouse.x - newMouseX, 2));
			this._moveMouse.x = newMouseX;
			this._moveMouse.y = newMouseY;
			if (this._moveMouseDistance > 0.1) {
				this._draggingMouseMovedYet = true;
			}
			this.SUB_paintOnMouseMove();
			this.SUB_terrainSquareOnMouseMove();
			this.SUB_dragEntityOnMouseMove();
		});
	}
	SUB_setupDraggingEntities() {
		this._currentlyDragging = null;
		this._currentlySelected = null;
		this._pre_current_select = null;
		this._pre_deselect = false;
		this._currentlySelectedEntityJsonLoc;
		this._draggingMouseMovedYet = false;
		this._dragableObjects = new Array();

		this._threejs.domElement.addEventListener('pointerdown', event => {
			if (this._mouseMode != 'interact') { return; }
			this._draggingMouseMovedYet = false;
			this._moveMouseDistance = 0;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

			this._raycaster.setFromCamera(this._clickMouse, this._camera);
			const found = this._raycaster.intersectObjects(this._dragableObjects);
			
			if (found.length > 0) {
				let thisObj = found[0].object;
				let findSelected = found.filter(x => x.object == this._currentlySelected);
				if (findSelected.length > 0) {
					thisObj = findSelected[0].object;
				}

				if (this._currentlySelected == thisObj) { // already selected. now drag.
					this._currentlyDragging = this._currentlySelected;
					this._controls.enabled = false;
				} else {
					this._pre_current_select = thisObj;
				}
			} else {
				this._pre_deselect = true;
			}
		});
		this._threejs.domElement.addEventListener('pointerup', event => {
			if (this._mouseMode != 'interact') { return; }

			if (this._pre_current_select || this._currentlySelected) { // if I pre-selected something on mouse down
				this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
				this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
				this._raycaster.setFromCamera(this._clickMouse, this._camera);
				const found = this._raycaster.intersectObjects(this._dragableObjects);
				if (found.length > 0) {
					if (this._pre_current_select == found[0].object && !this._draggingMouseMovedYet) {
						this.SUB_SelectEntity(this._pre_current_select);
						this._pre_current_select = null;
					} else {
						this._pre_current_select = null;
					}
				} else {
					if (this._pre_deselect) {
						this._pre_deselect = false;
						if (!this._draggingMouseMovedYet) {
							this.SUB_UnselectEntity();
						}
					}
					this._pre_current_select = null;
				}
			}
			this._currentlyDragging = null;
			this._draggingMouseMovedYet = false;
			this._controls.enabled = true;
			this.SUB_saveWorldFile_entities();
		});
	}
	SUB_dragEntityOnMouseMove() {
		if (this.playMode != 'local') { return; }
		if (this._mouseMode != 'interact') { return; }
		if (this._draggingMouseMovedYet && this._currentlyDragging != null) {
			this._raycaster.setFromCamera(this._moveMouse, this._camera);
			const found = this._raycaster.intersectObjects(this._groundANDwallTiles1D);
			if (found.length > 0) {
				this._controls.enabled = false;
				let target = found[0].point;
				this._currentlyDragging.userData.entity.setPosition(target.x, target.y, target.z);
				this._currentlySelectedEntityJsonLoc.position = [target.x, target.y, target.z];
			}
		}
	}
	SUB_SelectEntity(newSelected) {
		if (this._currentlySelected) {
			this._currentlySelected.userData.entity.setOutline(false);
		}
		this._currentlySelected = newSelected;
		this._currentlySelected.userData.entity.setOutline(true);
		this._currentlySelectedEntityJsonLoc = this._worldFile.entities.arr.filter(x => x.id == newSelected.userData.entity.id)[0];

		_('inspector').style.transform = 'TranslateY(0px)';
		// fill in inspector
		_('entityNameInput').value = this._currentlySelectedEntityJsonLoc.name;
		_('entitySizeRangeValue').value = this._currentlySelectedEntityJsonLoc.scale * 25;
		if (this.playMode == 'local') {
			_('entityNameInput').oninput = () => {
				this._currentlySelectedEntityJsonLoc.name = _('entityNameInput').value;
			}
			_('entitySizeRangeValue').oninput = () => {
				this._currentlySelectedEntityJsonLoc.scale = parseFloat((_('entitySizeRangeValue').value) / 25) || 1;
				_('entitySizeRange').value = _('entitySizeRangeValue').value;
				this._currentlySelected.userData.entity.setScale(this._currentlySelectedEntityJsonLoc.scale);
			}
			_('entitySizeRange').value = this._currentlySelectedEntityJsonLoc.scale * 25;
			_('entitySizeRange').oninput = () => {
				this._currentlySelectedEntityJsonLoc.scale = parseFloat((_('entitySizeRange').value) / 25) || 1;
				_('entitySizeRangeValue').value = _('entitySizeRange').value;
				this._currentlySelected.userData.entity.setScale(this._currentlySelectedEntityJsonLoc.scale);
			}
			_('entityNotesInput').value = this._currentlySelectedEntityJsonLoc.notes;
			_('entityNotesInput').oninput = () => {
				this._currentlySelectedEntityJsonLoc.notes = _('entityNotesInput').value;
			}


			_('inspectEditVoxels').onclick = () => {
				localStorage.setItem('tempVoxelBuilderBuilt', JSON.stringify(this._currentlySelectedEntityJsonLoc.blocks));
				localStorage.setItem('whereToStoreVoxelBuilderEdits', this._currentlySelectedEntityJsonLoc.id);
				localStorage.setItem('forceHostingBackOn', this.runningMulti ? '1' : '0');
				location.href = 'entity-editor/';
			}
			_('inspectDuplicateBtn').onclick = () => {
				this.SUB_duplicateEntity(this._currentlySelectedEntityJsonLoc);
			}
	
			_('inspectAdd45Btn').onclick = () => {
				this._currentlySelectedEntityJsonLoc.rotation += 45;
				this._currentlySelected.userData.entity.setRotation(this._currentlySelectedEntityJsonLoc.rotation);
			}
			_('inspectSub45Btn').onclick = () => {
				this._currentlySelectedEntityJsonLoc.rotation -= 45;
				this._currentlySelected.userData.entity.setRotation(this._currentlySelectedEntityJsonLoc.rotation);
			}
			_('entityTrashButton').onclick = () => {
				JSAlert.confirm('Are you sure you want to delete ' + this._currentlySelectedEntityJsonLoc.name + '?', '<span style="color:red">DANGER</span>', JSAlert.Icons.Warning)
				.then((result) => {
					if (result) {
						this._currentlySelected.userData.entity.delete(this._currentlySelected.userData.entity);
						this.SUB_UnselectEntity();
					}
				});
			}
		} else {
			_('entityNameInput').disabled = true;
			_('entitySizeRangeValue').disabled = true;
			_('Inspector_DM_eyes_only').style.display = 'none';
			_('entityTrashButton').style.display = 'none';
		}

	}
	SUB_UnselectEntity() {
		_('inspector').style.transform = 'TranslateY(-' + _('inspector').offsetHeight + 'px)';
		this.SUB_saveWorldFile_entities();
		if (this._currentlySelected) {
			this._currentlySelected.userData.entity.setOutline(false);
		}
		this._currentlySelected = null;
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
			this._moveMouseDistance = 0;

			this._clickMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
			this._clickMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;


			this._raycaster.setFromCamera(this._clickMouse, this._camera);
			let found = this._raycaster.intersectObjects(this._groundANDwallTiles1D);

			if (found.length > 0) {
				if (this._paintTool != 'bucket') {
					this._drawing = true;
					this.SUB_paintTileAtThisIntersect(found[0]);
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
			this.SUB_saveWorldFile_floor();
		});
	}
	SUB_paintTileAtThisIntersect(intersect) {
		let thisPaint = (this._paintTool == 'eraser') ? this._worldFile.floor.defaultTexture : this._selectedPaint;
		if (intersect.object.userData.wall) {
			let tilePos = intersect.object.userData.motherTile.userData.tilePos;
			this._worldFile.floor.arr[tilePos.i][tilePos.j][2] = thisPaint;
			intersect.object.material = this._paints[thisPaint].clone();
			intersect.object.material.side = THREE.DoubleSide;
		} else {
			let tilePos = intersect.object.userData.tilePos;
			this._worldFile.floor.arr[tilePos.i][tilePos.j][0] = thisPaint;
			intersect.object.material = this._paints[thisPaint];
			if (this._worldFile.floor.arr[tilePos.i][tilePos.j][1] == 0) {
				this._worldFile.floor.arr[tilePos.i][tilePos.j][2] = thisPaint;
			}
		}
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
			['wud_16.png', null],
			['texture-map_16.png', null]
		];
		this._paints = {};
		textures.forEach(text => {
			const key = text[0].split('_')[0];

			let map = new THREE.TextureLoader().load('textures/' + text[0]);
			map.wrapS = THREE.RepeatWrapping;
			map.wrapT = THREE.RepeatWrapping;
			map.repeat.set( 1, 1 );
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
		let found = this._raycaster.intersectObjects(this._groundANDwallTiles1D);
		if (found.length > 0) {
			this.SUB_paintTileAtThisIntersect(found[0]);
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
			this._moveMouseDistance = 0;

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
		this.SUB_saveWorldFile_floor();
		this.TERRAIN_clear();
		this.SUB_createFloor();
	}
	TERRAIN_subtract() {
		if (this._mouseMode != 'terrain' || this._terrainSquareIncludedTiles.length < 1) { return; }
		for (let i = 0; i < this._terrainSquareIncludedTiles.length; i++) {
			const tilePos = this._terrainSquareIncludedTiles[i];
			this._worldFile.floor.arr[tilePos[0]][tilePos[1]][1] = Math.max(this._worldFile.floor.arr[tilePos[0]][tilePos[1]][1]-1, 0);
		}
		this.SUB_saveWorldFile_floor();
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
		this._groundANDwallTiles1D = new Array();
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
	SUB_BoxNoBottomGeometry(ww, hh, dd) {
		const geometry = new THREE.BufferGeometry();
		let w = ww / 2;
		let h = hh / 2;  // ┘ , ┐ , ┌  <-old            ┌ , └ , ┘
		let d = dd / 2; // ┘ , ┌ , └  <-old            ┌ , ┘ , ┐
		const vertices = new Float32Array([
			// Front face
			-w, h, d,  -w,-h, d,   w,-h, d,
			-w, h, d,   w,-h, d,   w, h, d,
			// Back face
			 w, h,-d,   w,-h,-d,  -w,-h,-d,
			 w, h,-d,  -w,-h,-d,  -w, h,-d,
			// Top face
			-w, h,-d,  -w, h, d,   w, h, d,
			-w, h,-d,   w, h, d,   w, h,-d,
			// Right face
			-w, h,-d,  -w,-h,-d,  -w,-h, d,
			-w, h,-d,  -w,-h, d,  -w, h, d,
			// Left face
			 w, h, d,   w,-h, d,   w,-h,-d,
			 w, h, d,   w,-h,-d,   w, h,-d,
		]);
		geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
		geometry.computeVertexNormals();
		const Y = 1 - (hh / ww);
		const uv = new Float32Array([
			// Front face
			Y, 0,  1, 0,  1, 1,	
			Y, 0,  1, 1,  Y, 1,
			// Back face
			Y, 0,  1, 0,  1, 1,	
			Y, 0,  1, 1,  Y, 1,
			// Top face
			0, 0, 1, 0, 1, 1,
			0, 0, 1, 1, 0, 1,
			// Right face
			Y, 0,  1, 0,  1, 1,	
			Y, 0,  1, 1,  Y, 1,
			// Left face
			Y, 0,  1, 0,  1, 1,	
			Y, 0,  1, 1,  Y, 1,
		]);
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	
		return geometry;
	}

	SUB_createFloor() {
		const size = this._worldFile.floor.size;
		const gridSquareSize = 10;
		const realWorldSize = size * this._squareSize;
		this._groundTiles1D = Array();
		this._groundANDwallTiles1D = Array();
		if (this._worldFile.floor.arr == null) {
			this._worldFile.floor.arr = new Array(size).fill(0);
		}

		let makeLittleGroundPlane = (x, z, i, j) => {
			const tileThick = 0.5;
			if (this._worldFile.floor.arr[i] == 0) {
				this._worldFile.floor.arr[i] = new Array(size);
				for (let l = 0; l < size; l++) {
					this._worldFile.floor.arr[i][l] = [this._worldFile.floor.defaultTexture, 0, this._worldFile.floor.defaultWallTexture];
				}
			}
			let littleSquare = new THREE.Mesh(
				// this.SUB_createCubeGeo(coordinates),
				this.SUB_BoxNoBottomGeometry(this._squareSize, tileThick, this._squareSize),
				this._paints[this._worldFile.floor.arr[i][j][0]]
			);
			const height = this._worldFile.floor.arr[i][j][1];
			littleSquare.position.set(x, (height * this._squareSize) - (tileThick / 2), z);
			//littleSquare.rotation.x = -Math.PI / 2;
			littleSquare.castShadow = false;
			littleSquare.receiveShadow = true;
			littleSquare.userData.ground = true;
			littleSquare.userData.tilePos = { i: i, j: j };
			this._scene.add(littleSquare);
			this._groundTiles1D.push(littleSquare);
			this._groundANDwallTiles1D.push(littleSquare);

			// make walls if has height:
			if (height > 0) {
				// for each of the 4 adjacent tiles
				let rawVerts = new Array();
				let rawUv = new Array();
				
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
				];
				const addFace = (x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4) => {
					rawVerts.push(x1, y1, z1, x2, y2, z2, x4, y4, z4);
					rawVerts.push(x2, y2, z2, x3, y3, z3, x4, y4, z4);
					let repeatY = (y1 - y2) / this._squareSize;
					rawUv.push(0, 0, repeatY, 0, 0, 1);
					rawUv.push(repeatY, 0, repeatY, 1, 0, 1);
				};

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
					let minRealH = (height * this._squareSize) - tileThick;
					let oppRealH = (opponent * this._squareSize) - tileThick;
					addFace(
						corners[side[2]][0], minRealH, corners[side[2]][1],
						corners[side[2]][0], oppRealH, corners[side[2]][1],
						corners[side[3]][0], oppRealH, corners[side[3]][1],
						corners[side[3]][0], minRealH, corners[side[3]][1]
					);
				}
				if (rawVerts.length > 0) {
					const geometry = new THREE.BufferGeometry();
					geometry.setAttribute('position', new THREE.BufferAttribute( new Float32Array(rawVerts), 3 ));
					geometry.setAttribute('uv', new THREE.Float32BufferAttribute(rawUv, 2));
					geometry.computeFaceNormals();
    				geometry.computeVertexNormals();
					let walls = new THREE.Mesh(
						geometry,
						this._paints[this._worldFile.floor.arr[i][j][2]].clone()
					);
					walls.material.side = THREE.DoubleSide;
					walls.userData.motherTile = littleSquare;
					walls.castShadow = true;
					walls.receiveShadow = true;
					walls.userData.wall = true;
					this._scene.add(walls);
					this._groundANDwallTiles1D.push(walls);
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
	SUB_createCubeGeo(coordinates) {
		const geometry = new THREE.BufferGeometry();
		const vertices = new Float32Array([
			coordinates[0], coordinates[1], coordinates[2],
			coordinates[3], coordinates[4], coordinates[5],
			coordinates[6], coordinates[7], coordinates[8],
			coordinates[9], coordinates[10], coordinates[11],
			coordinates[12], coordinates[13], coordinates[14],
			coordinates[15], coordinates[16], coordinates[17],
			coordinates[18], coordinates[19], coordinates[20],
			coordinates[21], coordinates[22], coordinates[23]
		]);
		const indices = new Uint16Array([
			2, 1, 0,  // Face 0
			3, 2, 0,  // Face 1
			4, 5, 6,  // Face 2
			4, 6, 7,  // Face 3
			0, 1, 5,  // Face 4
			0, 5, 4,  // Face 5
			2, 3, 7,  // Face 6
			2, 7, 6,  // Face 7
			7, 3, 0,  // Face 8
			4, 7, 0,  // Face 9
			1, 2, 6,  // Face 10
			1, 6, 5   // Face 11
		]);
		geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
		geometry.setIndex(new THREE.BufferAttribute(indices, 1));
		return geometry;
	}

	SUB_createCustomObject(objJson, thisId) {
		const qSiz = 1;
		const av = qSiz / 2;
		const sideTriangles = [
			[ // front
				-1, 1, 1,
				1, 1, 1,
				-1, -1, 1,
				1, -1, 1,
				0,0,1 // <- direction
			],
			[ // back
				1, 1, -1,
				-1, 1, -1,
				1, -1, -1,
				-1, -1, -1,
				0,0,-1 // <- direction
			],
			[ // left
				-1, 1, -1,
				-1, 1, 1,
				-1, -1, -1,
				-1, -1, 1,
				-1,0,0 // <- direction
			],
			[ // right
				1, 1, 1,
				1, 1, -1,
				1, -1, 1,
				1, -1, -1,
				1,0,0 // <- direction
			],
			[ // top
				1, 1, 1,
				-1, 1, 1,
				1, 1, -1,
				-1, 1, -1,
				0,1,0 // <- direction
			],
			[ // bottom
				1, -1, 1,
				1, -1, -1,
				-1, -1, 1,
				-1, -1, -1,
				0,-1,0 // <- direction
			]
		];
		// loop through keys in objJson
		let rawUtlin = new Array();
		let rawVerts = new Array();
		let rawIndis = new Array();
		let rawColrs = new Array();
		let [maxX, minX, maxY, minY, maxZ, minZ] = [-99,99,-99,99,-99,99];
		let iC = 0;
		const pushOffsetVrt = (triVal, av, Pos) => {
			let off = triVal > 0 ? 0.15 : -0.15;
			rawUtlin.push( (triVal*av) + Pos + off );
		}
		for (let i = 0; i < Object.keys(objJson).length; i++) {
			let pos = Object.keys(objJson)[i];
			let tmpClr = objJson[pos];
			tmpClr = tmpClr.includes('#') ? tmpClr : '#'+tmpClr;
			let BlockColor = new THREE.Color(tmpClr).toArray();
			pos = pos.split(',').map(x => parseInt(x));
			if (pos[0] > maxX) { maxX = pos[0]; }
			if (pos[0] < minX) { minX = pos[0]; }
			if (pos[1] > maxY) { maxY = pos[1]; }
			if (pos[1] < minY) { minY = pos[1]; }
			if (pos[2] > maxZ) { maxZ = pos[2]; }
			if (pos[2] < minZ) { minZ = pos[2]; }

			//console.log(pos, BlockColor);
			// loop through each side of cube
			for (let j = 0; j < sideTriangles.length; j++) {
				const sideTri = sideTriangles[j];

				let granne = (sideTri[12]+pos[0]) + ',' + (sideTri[13]+pos[1]) + ',' + (sideTri[14]+pos[2]);
				if (objJson.hasOwnProperty( granne )) {
					continue;
				}
				for (let k = 0; k < 12; k+=3) {
					rawVerts.push( (sideTri[k+0]*av) + (pos[0]*qSiz) + av );
					rawVerts.push( (sideTri[k+1]*av) + (pos[1]*qSiz) + av );
					rawVerts.push( (sideTri[k+2]*av) + (pos[2]*qSiz) + av );

					rawColrs.push(...BlockColor);

					pushOffsetVrt(sideTri[k+0], av, (pos[0]*qSiz) + av );
					pushOffsetVrt(sideTri[k+1], av, (pos[1]*qSiz) + av );
					pushOffsetVrt(sideTri[k+2], av, (pos[2]*qSiz) + av );
				}
				rawIndis.push(
					iC+ 2, iC+ 1, iC+ 0,
					iC+ 2, iC+ 3, iC+ 1
				);
				iC += 4;
			}
		}
		if (rawVerts.length > 0) {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(rawVerts), 3 ) );
			geometry.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array(rawColrs), 3 ) );
			geometry.setIndex(rawIndis);
			geometry.computeFaceNormals();
			geometry.computeVertexNormals();
			let entity = new THREE.Mesh(
				geometry,
				new THREE.MeshStandardMaterial( { vertexColors: true } )
			);
			entity.castShadow = true;
			entity.receiveShadow = false;
			entity.userData.entity = true;
			this._scene.add(entity);

			maxY += 1;
			maxX += 1;
			maxZ += 1;
			const coordinates = [
				minX*qSiz, minY*qSiz, minZ*qSiz,
				maxX*qSiz, minY*qSiz, minZ*qSiz,
				maxX*qSiz, maxY*qSiz, minZ*qSiz,
				minX*qSiz, maxY*qSiz, minZ*qSiz,
				minX*qSiz, minY*qSiz, maxZ*qSiz,
				maxX*qSiz, minY*qSiz, maxZ*qSiz,
				maxX*qSiz, maxY*qSiz, maxZ*qSiz,
				minX*qSiz, maxY*qSiz, maxZ*qSiz
			];
			let hitbox = new THREE.Mesh(
				this.SUB_createCubeGeo(coordinates),
				new THREE.MeshBasicMaterial({
					visible: false
				})
			);
			hitbox.userData.draggable = true;
			this._scene.add(hitbox);

			// outline
			const outlineGeo = new THREE.BufferGeometry();
			outlineGeo.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array(rawUtlin), 3 ) );
			outlineGeo.setIndex(rawIndis);
			outlineGeo.computeFaceNormals();
			let utLin = new THREE.Mesh(
				outlineGeo,
				new THREE.MeshBasicMaterial({
					color: 0xffffff,
					side: THREE.BackSide,
					visible: false
				})
			)
			this._scene.add(utLin);

			let output = {
				id: thisId,
				mesh: entity,
				hitbox: hitbox,
				outline: utLin,
				scale: 1,
				setScale: function(s) {
					this.scale = s;
					this.mesh.scale.set(s, s, s);
					this.hitbox.scale.set(s, s, s);
					this.outline.scale.set(s, s, s);
				},
				position: [0, 0, 0],
				setPosition: function(x, y, z) {
					this.position = [x, y, z];
					this.mesh.position.set(x, y, z);
					this.hitbox.position.set(x, y, z);
					this.outline.position.set(x, y, z);
				},
				setOutline: function(yesNo) {
					this.outline.material.visible = yesNo;
				},
				rotation: 0,
				setRotation: function(r) {
					this.rotation = r;
					let realR = (-r * Math.PI / 180);
					this.mesh.rotation.y = realR;
					this.hitbox.rotation.y = realR;
					this.outline.rotation.y = realR;
				},
				delete: (self) => {
					this._scene.remove(self.mesh);
					self.mesh.geometry.dispose();
					self.mesh.material.dispose();
					
					this._scene.remove(self.hitbox);
					self.hitbox.geometry.dispose();
					self.hitbox.material.dispose();

					this._scene.remove(self.outline);
					self.outline.geometry.dispose();
					self.outline.material.dispose();

					this._worldFile.entities.arr = this._worldFile.entities.arr.filter(x => x.id != self.id);
					this._dragableObjects = this._dragableObjects.filter(x => x.userData.entity.id != self.id);
				}
			}
			hitbox.userData.entity = output;
			hitbox.userData.name = 'entity hitbox';
			this._dragableObjects.push(hitbox);

			return output;
		}
		return null;
	}

	SUB_AddNewEntity(jsn, newId, name=null, autoSelect=true) {
		const defaultScale = 1;
		let thisObj = this.SUB_createCustomObject(jsn, defaultScale, null);
		thisObj.id = newId;

		// get raycast position
		this._raycaster.setFromCamera(new THREE.Vector2(), this._camera);
		let found = this._raycaster.intersectObjects(this._groundANDwallTiles1D);
		if (found.length > 0) {
			thisObj.setPosition(found[0].point.x, found[0].point.y, found[0].point.z);
		} else {
			thisObj.setPosition(0, 0, 0);
		}

		let newEnt = {
			id: newId,
			name: name ? name : objFileName.replace('.entity', ''),
			notes: '',
			blocks: jsn,
			scale: defaultScale,
			position: thisObj.position,
			rotation: thisObj.rotation
		}
		this._worldFile.entities.arr.push(newEnt);
		this.setMouseMode('interact');
		this.SUB_saveWorldFile_entities();
		if (autoSelect) {
			setTimeout(() => {
				this.SUB_SelectEntity(thisObj.hitbox);
			}, 100);
		}
		return newEnt;
	}
	SUB_duplicateEntity(entity) {
		const newId = Date.now().toString(36);
		let newEnt = this.SUB_AddNewEntity(entity.blocks, newId, entity.name + ' (copy)', false);
		newEnt.position = entity.position;
		newEnt.rotation = entity.rotation;
		newEnt.scale = entity.scale;

		let thisMesh = this._dragableObjects.filter(x => x.userData.entity.id == newId)[0];
		thisMesh.userData.entity.setPosition(...entity.position);
		thisMesh.userData.entity.setRotation(entity.rotation);
		thisMesh.userData.entity.setScale(entity.scale);
		this.SUB_saveWorldFile_entities();

		setTimeout(() => {
			this.SUB_SelectEntity(thisMesh.userData.entity.hitbox);
		}, 100);
	}

	SUB_createEntitiesOnLoad() {
		this._worldFile.entities.arr.forEach(entity => {
			let thisObj = this.SUB_createCustomObject(entity.blocks, entity.id);
			thisObj.setPosition(...entity.position);
			thisObj.setRotation(entity.rotation);
			thisObj.setScale(entity.scale);
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
			if (playFile && this.playMode == 'Playroom') {
				if (this._worldFile.lastEdited != playFile.lastEdited) {	// if floor has been edited
					if (this._worldFile.floor.lastEdited != playFile.floor.lastEdited) {
						this.TERRAIN_clear();
						var floorEdited = true;
					}
					if (this._worldFile.entities.lastEdited != playFile.entities.lastEdited) {	// if entity has been edited
						let theseEntities = [...this._worldFile.entities.arr.map(x => x.id)];
						playFile.entities.arr.forEach(entity => {
							let thisMesh = this._dragableObjects.filter(x => x.userData.entity.id == entity.id);
							if (thisMesh.length > 0) {
								thisMesh = thisMesh[0];
								var index = theseEntities.indexOf(thisMesh.userData.entity.id);
								if (index !== -1) {
									theseEntities.splice(index, 1);
								}
								if (JSON.stringify(entity.blocks) != JSON.stringify( this._worldFile.entities.arr.filter(x => x.id == entity.id)[0].blocks )) {
									console.log('re-blocking');
									thisMesh.userData.entity.delete(thisMesh.userData.entity);
									this.SUB_AddNewEntity(entity.blocks, entity.id, entity.name, false);
									thisMesh = this._dragableObjects.filter(x => x.userData.entity.id == entity.id)[0];
								}
								thisMesh.userData.entity.setPosition(...entity.position);
								thisMesh.userData.entity.setRotation(entity.rotation);
								thisMesh.userData.entity.setScale(entity.scale);
							} else {
								let thisObj = this.SUB_createCustomObject(entity.blocks, entity.id);
								thisObj.setPosition(...entity.position);
								thisObj.setRotation(entity.rotation);
								thisObj.setScale(entity.scale);
							}
						});
						if (theseEntities.length > 0) {
							theseEntities.forEach(id => {
								let thisGuy = this._dragableObjects.filter(x => x.userData.entity.id == id);
								if (thisGuy.length > 0) {
									thisGuy[0].userData.entity.delete(thisGuy[0].userData.entity);
								}
							});
						}
					}
					this._worldFile = Object.assign({}, playFile);
					if (floorEdited) {
						this.SUB_createFloor();
					}
				}
			}
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
				setTimeout(() => {
					Playroom.setState('WorldFile', this._worldFile);
				}, 100);
			});
		}
		localStorage.setItem('goBackToHosting', location.hash.replace('#r=', ''));
	}
	async joinGameWithCode(beginHostingBtn, code) {
		await Playroom.insertCoin({
			skipLobby: true,
			roomCode: code
		}, () => {
			beginHostingBtn.innerHTML = code.toUpperCase();
		});
		this.runningMulti = true;
		await sleep(100);
	}
	getRoomCode() {
		return Playroom.getRoomCode();
	}
	Playroom() {
		return Playroom;
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
		this.SUB_UnselectEntity();
		this._mouseMode = mode;
		if (mode == 'terrain') {
			this._controls.enabled = false;
			this._terrainSquare.material.visible = true;
		} else if (mode == 'paint') {
			this._controls.enabled = false;
			this._terrainSquare.material.visible = false;
		} else {
			this._controls.enabled = true;
			this._terrainSquare.material.visible = false;
		}
	}
	async importEntityFromFile(objFileName, name=null) {
		let res = await fetch(objFileName);
		let jsn = await res.json();
		const newId = Date.now().toString(36);
		this.SUB_AddNewEntity(jsn, newId, name);
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