let localStream;
let localVideo;
let peerConnection;
let remoteVideo;
let serverConnection;
let uuid;
let dataChannel;

const peerConnectionConfig = {
    iceServers: [
        { urls: "stun:stun.stunprotocol.org:3478" },
        { urls: "stun:stun.l.google.com:19302" },
    ],
};

async function pageReady() {
    uuid = createUUID();

    localVideo = document.getElementById("localVideo");
    remoteVideo = document.getElementById("remoteVideo");

    serverConnection = new WebSocket(`wss://${window.location.hostname}:8443`);
    serverConnection.onmessage = gotMessageFromServer;

    document
        .getElementById("sendButton")
        .addEventListener("click", sendChatMessage);

    const constraints = {
        video: true,
        audio: true,
    };

    if (!navigator.mediaDevices.getUserMedia) {
        alert("Your browser does not support getUserMedia API");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        localStream = stream;
        localVideo.srcObject = stream;
    } catch (error) {
        errorHandler(error);
    }
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    if (isCaller) {
        dataChannel = peerConnection.createDataChannel("dataChannel");
        dataChannel.onmessage = handleDataChannelMessage;
        dataChannel.onopen = (e) => console.log("open!!!!");
        dataChannel.onclose = (e) => console.log("closed!!!!!!");
        peerConnection.createOffer().then(createdDescription).catch(errorHandler);
    } else {
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            dataChannel.onmessage = handleDataChannelMessage;
            dataChannel.onopen = (e) => console.log("open!!!!");
            dataChannel.onclose = (e) => console.log("closed!!!!!!");
        };
    }
}

function gotMessageFromServer(message) {
    if (!peerConnection) start(false);

    const signal = JSON.parse(message.data);

    // Ignore messages from ourself
    if (signal.uuid == uuid) return;

    if (signal.sdp) {
        peerConnection
            .setRemoteDescription(new RTCSessionDescription(signal.sdp))
            .then(() => {
                // Only create answers in response to offers
                if (signal.sdp.type !== "offer") return;

                peerConnection
                    .createAnswer()
                    .then(createdDescription)
                    .catch(errorHandler);
            })
            .catch(errorHandler);
    } else if (signal.ice) {
        peerConnection
            .addIceCandidate(new RTCIceCandidate(signal.ice))
            .catch(errorHandler);
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(JSON.stringify({ ice: event.candidate, uuid: uuid }));
    }
}

function createdDescription(description) {
    console.log("got description");

    peerConnection
        .setLocalDescription(description)
        .then(() => {
            serverConnection.send(
                JSON.stringify({ sdp: peerConnection.localDescription, uuid: uuid })
            );
        })
        .catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log("got remote stream");
    remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
    console.log(error);
}

function createUUID() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }

    return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
}

function sendChatMessage() {
    const chatInput = document.getElementById("chatInput");
    const message = chatInput.value;
    chatInput.value = "";

    // Send the message over the data channel
    dataChannel.send(message);

    // Add the message to the chat area
    const chatArea = document.getElementById("chatArea");
    chatArea.innerHTML =
        `<div class="my-message">${message}</div>` + chatArea.innerHTML;
}

function handleDataChannelMessage(event) {
    const message = event.data;

    // Add the message to the chat area
    const chatArea = document.getElementById("chatArea");
    chatArea.innerHTML =
        `<div class="their-message">${message}</div>` + chatArea.innerHTML;
}
function enterRoom(roomCode) {
    serverConnection.send(JSON.stringify({roomcode:roomCode}));
}