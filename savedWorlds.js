// const { onPlayerJoin, insertCoin, isHost, myPlayer } = Playroom;

function _(x) {return document.getElementById(x);}
const txtToColor = {
	'cbl': '#939991',
	'cr8': '#9c6d28',
	'drt': '#5f5045',
	'grs': '#2f8b00',
	'snd': '#ded399',
	'stn': '#c1b4a1',
	'wtr': '#5497c3',
	'wud': '#c28653',
	'blk': '#000000',
	'000': '#f9c834'
}
function loadInWorlds() {
	// load in list of worlds
	let worldsListRaw = localStorage.getItem('worldsList');
	if (!worldsListRaw) {
		localStorage.setItem('worldsList', '[]');
		worldsListRaw = '[]';
	}
	let worldsList = JSON.parse(worldsListRaw);
	// sort worldsList by accessing the WorldFile- localstorage of that id and sorting my the last edited date
	worldsList.sort((a, b) => {
		let aWorld = JSON.parse(localStorage.getItem('WorldFile-' + a));
		let bWorld = JSON.parse(localStorage.getItem('WorldFile-' + b));
		return new Date(bWorld.lastEdited) - new Date(aWorld.lastEdited);
	})
	const worldsListParent = document.getElementById('worldsListParent');
	const worldPreviewScaler = 10;
	for (let i = 0; i < worldsList.length; i++) {
		const worldJson = JSON.parse(localStorage.getItem('WorldFile-' + worldsList[i]));
		addWorldButton(worldPreviewScaler, i, worldJson, worldsListParent);
	}
}

function createNewWorld(name, size, defaultTexture = 'grs', defaultWallTexture = 'drt') {
	let newWorldId = new Date().valueOf();
	let newWorld = {
		name: name,
		id: newWorldId,
		lastEdited: new Date().toISOString(),
		floor: {
			lastEdited : new Date().toISOString(),
			size: size,
			arr: null,
			defaultTexture: defaultTexture,
			defaultWallTexture: defaultWallTexture
		},
		entities: {
			lastEdited : new Date().toISOString(),
			arr : new Array()
		}
	}
	let thisWorldsList = JSON.parse(localStorage.getItem('worldsList'));
	thisWorldsList.push(newWorldId);
	localStorage.setItem('worldsList', JSON.stringify(thisWorldsList));
	localStorage.setItem('WorldFile-' + newWorldId, JSON.stringify(newWorld));
	openWorld(newWorldId);
}

let addWorldButton = (scaler, i, worldJson, worldsListParent) => {
	const thisD = new Date(worldJson.lastEdited);
	const offset = thisD.getTimezoneOffset()
	yourDate = new Date(thisD.getTime() - (offset * 60 * 1000))
	const LED = thisD.toISOString().split('T')[0].split('-');
	const lastEditDateText = LED[1] + '/' + LED[2] + '/' + LED[0].substring(2);
	worldsListParent.innerHTML += `
		<div class="world pixel-corners-4-4" id="world-${i}">
			<img class="pixel-corners-4-2" src="" style="width: 65px; height: 65px" id="world-img-${i}" onclick="openWorld(${worldJson.id})">
			<div class="world-info" onclick="openWorld(${worldJson.id})">
				<div style="font-size: 24px; transform: translateY(3px)">${worldJson.name}</div>
				<div style="margin-top:8px">Last Edit Date</div>
				<div style="color: #8c8b87">${lastEditDateText}</div>
			</div>
			<div class="editBtn" onclick="editWorldBtn(${worldJson.id})"><img src="beckBtns/pencil.png" style="width:35px; image-rendering: pixelated;"></div>
		</div>
	`;

	if (!worldJson.floor.arr) {
		return;
	}
	const canvas = document.getElementById('makeImgCanvas');
	const ctx = canvas.getContext('2d');
	canvas.width = worldJson.floor.size * scaler;
	canvas.height = worldJson.floor.size * scaler;

	for (let x = 0; x < worldJson.floor.size; x++) {
		for (let y = 0; y < worldJson.floor.size; y++) {
			const colorCode = worldJson.floor.arr[worldJson.floor.size - y - 1][worldJson.floor.size - x - 1][0];
			if (txtToColor[colorCode]) {
				ctx.fillStyle = txtToColor[colorCode];
				ctx.fillRect(y * scaler, x * scaler, scaler, scaler);
			}
		}
	}
	canvas.toBlob((blob) => {
		document.getElementById('world-img-' + i).src = URL.createObjectURL(blob);
	}, "image/jpeg", 0.95);
}

function editWorldBtn(worldJsonId) {
	const worldJson = JSON.parse(localStorage.getItem('WorldFile-' + worldJsonId));
	var alert = new JSAlert("<br><br>Map Name:", "MAP EDITOR");
	alert.addTextField(worldJson.name);
	alert.addButton("Save").then(function() { // save
		saveWorldName(worldJsonId, alert.getTextFieldValue(0));
		JSAlert.alert('Saved!', '', JSAlert.Icons.Success).then(function() {
			location.reload();
		});
	});
	alert.addButton("Export").then(function() { // export
		downloadAsFile(worldJson.name + '.world', worldJson);
		JSAlert.alert('Exporting!', '', JSAlert.Icons.Info);
	});
	alert.addButton('Delete').then(function() {
		JSAlert.confirm('Are you sure you want to delete ' + worldJson.name + '?', '<span style="color:red">DANGER</span>', JSAlert.Icons.Warning)
			.then((result) => { // delete
				if (result) {
					let thisWorldsList = JSON.parse(localStorage.getItem('worldsList'));
					const index = thisWorldsList.indexOf(worldJsonId);
					if (index !== -1) {
						thisWorldsList.splice(index, 1);
						localStorage.setItem('worldsList', JSON.stringify(thisWorldsList));
						localStorage.removeItem('WorldFile-' + worldJsonId);
					}
					location.reload();
				}
			});
	});
	alert.show();
}
const downloadAsFile = (filename, dataObjToWrite) => {
	const blob = new Blob([JSON.stringify(dataObjToWrite)], { type: "text/json" });
	const link = document.createElement("a");

	link.download = filename;
	link.href = window.URL.createObjectURL(blob);
	link.dataset.downloadurl = ["text/json", link.download, link.href].join(":");

	const evt = new MouseEvent("click", {
		view: window,
		bubbles: true,
		cancelable: true,
	});

	link.dispatchEvent(evt);
	link.remove()
};
document.getElementById('importInput').onchange = async function() {
	let files = document.getElementById('importInput').files;
	//console.log(files);
	if (files.length < 1 || files.length > 1) {
		return false;
	}
	if (!files.item(0).name.toLowerCase().endsWith('.world')) {
		return;
	}
	let fr = new FileReader();
	fr.onload = function(e) {
		let newWorld = JSON.parse(e.target.result);
		let newWorldId = new Date().valueOf();
		newWorld.id = newWorldId;
		newWorld.lastEdited = new Date().toISOString();
		newWorld.name += ' (imported)';
		console.log(newWorld);

		let thisWorldsList = JSON.parse(localStorage.getItem('worldsList'));
		thisWorldsList.push(newWorldId);
		localStorage.setItem('WorldFile-' + newWorldId, JSON.stringify(newWorld));
		localStorage.setItem('worldsList', JSON.stringify(thisWorldsList));
		location.reload();
	}
	fr.readAsText(files.item(0));
};

function saveWorldName(worldId, nam) {
	const worldJson = JSON.parse(localStorage.getItem('WorldFile-' + worldId));
	worldJson.name = nam;
	localStorage.setItem('WorldFile-' + worldId, JSON.stringify(worldJson));
}

function openWorld(worldId) {
	if (worldId != localStorage.getItem('worldIdToOpen')) {
		localStorage.removeItem('goBackToHosting');
	}
	localStorage.setItem('worldIdToOpen', worldId);
	location.href = 'game.html';
}

history.pushState(null, document.title, location.href);
window.addEventListener('popstate', function (event) {
	this.location.href = 'home.html';
});

loadInWorlds();