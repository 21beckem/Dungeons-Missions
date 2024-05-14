let roomCode;
let Playroom = globalThis.Playroom;
async function startHosting() {
    if (Playroom.getRoomCode()) {
        // copy the code
        navigator.clipboard.writeText(Playroom.getRoomCode());
    } else {
        // start the loader
        _('beginHostingBtn').innerHTML = '<div class="loader" style="margin-left: calc(50% - 15px);"></div>';
        // start multiplayer
        await Playroom.insertCoin({skipLobby: true}, () => {
            roomCode = Playroom.getRoomCode()
            _('beginHostingBtn').innerHTML = roomCode;
        
            Playroom.setState('WorldFile', _APP._worldFile);
        });
    }
}
async function joinHostedMap(code) {
    await Playroom.insertCoin({
        skipLobby: true,
        roomCode: code
    }, () => {
        roomCode = Playroom.getRoomCode()
        _('beginHostingBtn').innerHTML = roomCode;
    });
}