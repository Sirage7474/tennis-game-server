const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 10000;

// Store active rooms
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('createRoom', ({ roomId, password }) => {
        if (rooms.has(roomId)) {
            socket.emit('roomError', 'Room already exists');
            return;
        }

        rooms.set(roomId, {
            password,
            players: [socket.id],
            gameState: {}
        });

        socket.join(roomId);
        socket.emit('roomCreated', { roomId });
    });

    socket.on('joinRoom', ({ roomId, password }) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('roomError', 'Room not found');
            return;
        }

        if (room.password !== password) {
            socket.emit('roomError', 'Incorrect password');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('roomError', 'Room is full');
            return;
        }

        room.players.push(socket.id);
        socket.join(roomId);

        // Assign positions to players
        io.to(room.players[0]).emit('gameStart', { position: 'left', roomId });
        io.to(room.players[1]).emit('gameStart', { position: 'right', roomId });
    });

    socket.on('playerMove', (data) => {
        socket.to(data.roomId).emit('opponentMove', {
            x: data.x,
            y: data.y
        });
    });

    socket.on('ballUpdate', (data) => {
        socket.to(data.roomId).emit('ballSync', {
            ballState: data.ballState,
            scores: data.scores
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        
        // Find and clean up any rooms the player was in
        for (const [roomId, room] of rooms.entries()) {
            if (room.players.includes(socket.id)) {
                io.to(roomId).emit('playerDisconnected');
                rooms.delete(roomId);
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 