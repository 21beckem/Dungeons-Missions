let roomCode, hostBtnEl;
let PlayroomRunning = false;
async function startHosting(buttonEl) {
    hostBtnEl = buttonEl;
    if (Playroom.getRoomCode()) {
        // copy the code
        navigator.clipboard.writeText('code').then(
            () => {
                /* clipboard successfully set */
                JSAlert.alert('', 'Code Copied', JSAlert.Icons.Success).dismissIn(700);
            },
            () => {
                /* clipboard write failed */
                JSAlert.alert('', 'Code Copy Failed', JSAlert.Icons.Fail);
            },
        );
    } else {
        // start the loader
        hostBtnEl.innerHTML = '<div class="loader" style="margin-left: calc(50% - 15px);"></div>';
        // start multiplayer
        await Playroom.insertCoin({skipLobby: true});
        roomCode = Playroom.getRoomCode()
        hostBtnEl.innerHTML = roomCode;
    
        Playroom.setState('WorldFile', _APP._worldFile);
    }
}
//startHosting();