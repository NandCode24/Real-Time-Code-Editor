const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const cors = require("cors");

const ACTIONS = require("../src/actions/Actions"); // Adjust path if needed

const app = express();
const server = http.createServer(app);

// ✅ Fix: Enable CORS for WebSockets
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

app.use(cors());

// Serve static frontend in production
app.use(express.static("build"));

app.get("/", (req, res) => {
    res.send("<h1>Real-Time Code Editor Backend</h1>");
});

const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
        socketId,
        username: userSocketMap[socketId],
    }));
}

io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);

        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        console.log(`👤 ${username} joined room: ${roomId}`);
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];

        console.log(`🔴 Socket disconnected: ${socket.id}`);
    });

    socket.on("error", (err) => {
        console.error("Socket error:", err);
    });
});

// Vercel automatically assigns a port
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));

// ✅ Export handler for Vercel
module.exports = app;
