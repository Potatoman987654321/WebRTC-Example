const HTTPS_PORT = 8443;

const fs = require("fs");
const https = require("https");
const WebSocket = require("ws");
const WebSocketServer = WebSocket.Server;
const express = require("express");
const app = express();

const rooms = new Map();

// Yes, TLS is required for WebRTC
const serverConfig = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};

function main() {
  const httpsServer = startHttpsServer(serverConfig);
  startWebSocketServer(httpsServer);
  printHelp();
}

function startHttpsServer(serverConfig) {
  app.get("/", (req, res) => {
    res.sendFile(__dirname + "/client/index.html");
  });

  app.get("/webrtc.js", (req, res) => {
    res.sendFile(__dirname + "/client/webrtc.js");
  });

  app.get("/style.css", (req, res) => {
    res.sendFile(__dirname + "/client/style.css");
  });

  const httpsServer = https.createServer(serverConfig, app);
  httpsServer.listen(HTTPS_PORT, "0.0.0.0");
  return httpsServer;
}

function startWebSocketServer(httpsServer) {
  // Create a server for handling websocket calls
  const wss = new WebSocketServer({ server: httpsServer });

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      // Broadcast any received message to all clients
      const data = JSON.parse(message);

      if (data.roomcode) {
        console.log(`Received room code: ${data.roomcode}`);
        // Add the client to the room
        if (!rooms.has(data.roomcode)) {
          rooms.set(data.roomcode, []);
        }
        rooms.get(data.roomcode).push(ws);
      } else {
        console.log(`received: ${message}`);
        // Broadcast the message to all clients in the same room
        const room = findRoom(ws);
        if (room) {
          broadcast(room, message);
        }
      }
    });
  });
}

function findRoom(ws) {
  for (const [roomcode, clients] of rooms.entries()) {
    if (clients.includes(ws)) {
      return roomcode;
    }
  }
  return null;
}

function broadcast(roomcode, data) {
  const clients = rooms.get(roomcode);
  if (clients) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: false });
      }
    });
  }
}

function printHelp() {
  console.log(
    `Server running. Visit https://localhost:${HTTPS_PORT} in Firefox/Chrome/Safari.\n`
  );
  console.log("Please note the following:");
  console.log(
    "  * Note the HTTPS in the URL; there is no HTTP -> HTTPS redirect."
  );
  console.log(
    "  * You'll need to accept the invalid TLS certificate as it is self-signed."
  );
  console.log(
    "  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines."
  );
}

main();
