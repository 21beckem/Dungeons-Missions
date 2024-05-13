let roomCode;
let PlayroomRunning = false;
async function startHosting() {
    await Playroom.insertCoin({skipLobby: true});
    roomCode = Playroom.getRoomCode()
    JSAlert.alert(roomCode);

    Playroom.setState('WorldFile', _APP._worldFile);
}
//startHosting();