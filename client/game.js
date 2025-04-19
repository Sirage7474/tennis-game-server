// Game elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const menuButton = document.getElementById('menuButton');
const gameMenu = document.getElementById('gameMenu');
const deviceSpecificOptions = document.getElementById('deviceSpecificOptions');
const aiOptions = document.getElementById('aiOptions');
const startAiGame = document.getElementById('startAiGame');
const difficultySelect = document.getElementById('difficulty');
const linksButton = document.getElementById('linksButton');
const linksMenu = document.getElementById('linksMenu');
const themeButton = document.getElementById('themeButton');
const twoPlayerButton = document.getElementById('twoPlayerButton');
const aiButton = document.getElementById('aiButton');

// Game state
let gameState = {
    paused: false,
    aiMode: false,
    multiplayer: false,
    online: false,
    player1Score: 0,
    player2Score: 0,
    winner: null,
    difficulty: 'medium',
    roomId: null,
    isHost: false
};

// Theme state
let currentTheme = {
    background: '#2D2B8C',
    paddle: '#FFFFFF',
    ball: '#FFFFFF',
    text: '#FFFFFF'
};

const themes = [
    {
        background: '#2D2B8C',
        paddle: '#FFFFFF',
        ball: '#FFFFFF',
        text: '#FFFFFF'
    },
    {
        background: '#000000',
        paddle: '#00FF00',
        ball: '#00FF00',
        text: '#00FF00'
    },
    {
        background: '#1A1A1A',
        paddle: '#FF4444',
        ball: '#FFFFFF',
        text: '#FF4444'
    }
];

let currentThemeIndex = 0;

// Game objects
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 7,
    dx: 7,
    dy: 7,
    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.dx = this.speed * (Math.random() > 0.5 ? 1 : -1);
        this.dy = this.speed * (Math.random() > 0.5 ? 1 : -1);
    }
};

const paddleHeight = 100;
const paddleWidth = 10;
const player1 = {
    x: 0,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    speed: 8,
    score: 0
};

const player2 = {
    x: canvas.width - paddleWidth,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    speed: 8,
    score: 0
};

// AI settings
const aiSettings = {
    easy: { speed: 5, reactionDelay: 0.3 },
    medium: { speed: 6, reactionDelay: 0.2 },
    hard: { speed: 7, reactionDelay: 0.1 },
    expert: { speed: 8, reactionDelay: 0 }
};

// Keyboard state
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// Multiplayer
let socket = null;
const SERVER_URL = 'https://tennis-server-y2jb.onrender.com';

// Initialize socket connection
function initializeSocket() {
    socket = io(SERVER_URL);
    
    socket.on('gameState', (state) => {
        if (!gameState.isHost) {
            ball.x = canvas.width - state.ballX;
            ball.y = state.ballY;
            player2.y = canvas.height - state.player1Y - player2.height;
            player1.y = canvas.height - state.player2Y - player1.height;
            gameState.player1Score = state.player2Score;
            gameState.player2Score = state.player1Score;
        }
    });

    socket.on('playerMove', (data) => {
        if (!gameState.isHost) {
            const targetPlayer = data.isPlayer1 ? player2 : player1;
            targetPlayer.y = canvas.height - data.y - targetPlayer.height;
        }
    });

    socket.on('playerJoined', () => {
        gameState.online = true;
        hideAllMenus();
        resetGame();
    });

    socket.on('gameEnd', () => {
        gameState.online = false;
        socket.disconnect();
    });
}

// Menu handling
function showMenu(menuElement) {
    gameState.paused = true;
    menuElement.style.display = 'block';
}

function hideAllMenus() {
    gameMenu.style.display = 'none';
    linksMenu.style.display = 'none';
    gameState.paused = false;
}

// Event listeners
document.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
    }
    
    switch (e.key.toLowerCase()) {
        case 'p':
            togglePause();
            break;
        case 'r':
            resetGame();
            break;
        case 'm':
            showMenu(gameMenu);
            break;
        case 'l':
            showMenu(linksMenu);
            break;
        case 't':
            cycleTheme();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

// Button handlers
pauseButton.addEventListener('click', togglePause);
resetButton.addEventListener('click', resetGame);
menuButton.addEventListener('click', () => showMenu(gameMenu));
linksButton.addEventListener('click', () => showMenu(linksMenu));
themeButton.addEventListener('click', cycleTheme);

// Menu button handlers
document.getElementById('twoPlayerButton').addEventListener('click', () => {
    gameState.aiMode = false;
    gameState.multiplayer = true;
    gameState.online = false;
    hideAllMenus();
    resetGame();
});

document.getElementById('aiButton').addEventListener('click', () => {
    document.getElementById('deviceSpecificOptions').style.display = 'none';
    document.getElementById('aiOptions').style.display = 'block';
});

document.getElementById('createPartyButton').addEventListener('click', () => {
    document.getElementById('deviceSpecificOptions').style.display = 'none';
    document.getElementById('createPartyMenu').style.display = 'block';
});

document.getElementById('joinPartyButton').addEventListener('click', () => {
    document.getElementById('deviceSpecificOptions').style.display = 'none';
    document.getElementById('joinPartyMenu').style.display = 'block';
});

// Back buttons
const backButtons = document.querySelectorAll('[id$="BackButton"]');
backButtons.forEach(button => {
    button.addEventListener('click', () => {
        button.parentElement.style.display = 'none';
        document.getElementById('deviceSpecificOptions').style.display = 'block';
    });
});

document.getElementById('startAiGame').addEventListener('click', () => {
    gameState.aiMode = true;
    gameState.multiplayer = false;
    gameState.online = false;
    gameState.difficulty = document.getElementById('difficulty').value;
    hideAllMenus();
    resetGame();
});

document.getElementById('createRoomButton').addEventListener('click', () => {
    const roomId = document.getElementById('createRoomId').value;
    const password = document.getElementById('createPassword').value;
    
    if (roomId && password) {
        initializeSocket();
        socket.emit('createRoom', { roomId, password });
        gameState.roomId = roomId;
        gameState.isHost = true;
        
        document.getElementById('createPartyMenu').style.display = 'none';
        document.getElementById('waitingRoom').style.display = 'block';
        document.getElementById('roomIdDisplay').textContent = roomId;
        document.getElementById('passwordDisplay').textContent = password;
    }
});

document.getElementById('joinRoomButton').addEventListener('click', () => {
    const roomId = document.getElementById('joinRoomId').value;
    const password = document.getElementById('joinPassword').value;
    
    if (roomId && password) {
        initializeSocket();
        socket.emit('joinRoom', { roomId, password });
        gameState.roomId = roomId;
        gameState.isHost = false;
    }
});

// Game functions
function togglePause() {
    gameState.paused = !gameState.paused;
    pauseButton.textContent = gameState.paused ? 'Resume (P)' : 'Pause (P)';
}

function resetGame() {
    ball.reset();
    player1.y = canvas.height / 2 - paddleHeight / 2;
    player2.y = canvas.height / 2 - paddleHeight / 2;
    gameState.player1Score = 0;
    gameState.player2Score = 0;
    gameState.winner = null;
    gameState.paused = false;
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    currentTheme = themes[currentThemeIndex];
    document.documentElement.style.setProperty('--background-color', currentTheme.background);
    canvas.style.backgroundColor = currentTheme.background;
}

function updateAI() {
    if (!gameState.aiMode) return;
    
    const settings = aiSettings[gameState.difficulty];
    const targetY = ball.y - player2.height / 2;
    const diff = targetY - player2.y;
    
    if (Math.random() > settings.reactionDelay) {
        if (diff > 0) {
            player2.y += Math.min(diff, settings.speed);
        } else {
            player2.y += Math.max(diff, -settings.speed);
        }
    }
}

function movePlayers() {
    // Player 1 movement
    if (keys.w && player1.y > 0) {
        player1.y -= player1.speed;
    }
    if (keys.s && player1.y + player1.height < canvas.height) {
        player1.y += player1.speed;
    }

    // Player 2 movement (if not AI or online mode)
    if (!gameState.aiMode && !gameState.online) {
        if (keys.ArrowUp && player2.y > 0) {
            player2.y -= player2.speed;
        }
        if (keys.ArrowDown && player2.y + player2.height < canvas.height) {
            player2.y += player2.speed;
        }
    }

    // Send player position in online mode
    if (gameState.online && socket) {
        socket.emit('playerMove', {
            y: gameState.isHost ? player1.y : player2.y,
            isPlayer1: gameState.isHost
        });
    }
}

function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision (top/bottom)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy = -ball.dy;
    }

    // Paddle collision
    const paddles = [
        { paddle: player1, isLeft: true },
        { paddle: player2, isLeft: false }
    ];

    for (const { paddle, isLeft } of paddles) {
        if (ball.x - ball.radius < paddle.x + paddle.width &&
            ball.x + ball.radius > paddle.x &&
            ball.y > paddle.y &&
            ball.y < paddle.y + paddle.height) {
            
            // Calculate angle based on where the ball hits the paddle
            const relativeIntersectY = (paddle.y + (paddle.height / 2)) - ball.y;
            const normalizedIntersectY = relativeIntersectY / (paddle.height / 2);
            const bounceAngle = normalizedIntersectY * Math.PI / 3;

            ball.dx = ball.speed * (isLeft ? Math.cos(bounceAngle) : -Math.cos(bounceAngle));
            ball.dy = ball.speed * -Math.sin(bounceAngle);
        }
    }

    // Score points
    if (ball.x - ball.radius < 0) {
        gameState.player2Score++;
        ball.reset();
    } else if (ball.x + ball.radius > canvas.width) {
        gameState.player1Score++;
        ball.reset();
    }

    // Send ball position in online mode
    if (gameState.online && gameState.isHost && socket) {
        socket.emit('gameState', {
            ballX: ball.x,
            ballY: ball.y,
            player1Y: player1.y,
            player2Y: player2.y,
            player1Score: gameState.player1Score,
            player2Score: gameState.player2Score
        });
    }
}

function checkWinner() {
    const winningScore = 5;
    if (gameState.player1Score >= winningScore) {
        gameState.winner = 'Player 1';
        gameState.paused = true;
    } else if (gameState.player2Score >= winningScore) {
        gameState.winner = gameState.aiMode ? 'AI' : 'Player 2';
        gameState.paused = true;
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = currentTheme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw center line
    ctx.setLineDash([5, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = currentTheme.text;
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = currentTheme.paddle;
    ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
    ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = currentTheme.ball;
    ctx.fill();
    ctx.closePath();

    // Draw scores
    ctx.font = '48px Arial';
    ctx.fillStyle = currentTheme.text;
    ctx.textAlign = 'center';
    ctx.fillText(gameState.player1Score.toString(), canvas.width / 4, 60);
    ctx.fillText(gameState.player2Score.toString(), (canvas.width * 3) / 4, 60);

    // Draw winner message
    if (gameState.winner) {
        ctx.font = '36px Arial';
        ctx.fillStyle = currentTheme.text;
        ctx.textAlign = 'center';
        ctx.fillText(`${gameState.winner} wins!`, canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 40);
    }

    // Draw pause message
    if (gameState.paused && !gameState.winner) {
        ctx.font = '36px Arial';
        ctx.fillStyle = currentTheme.text;
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 40);
    }
}

// Game loop
function gameLoop() {
    if (!gameState.paused) {
        movePlayers();
        updateAI();
        moveBall();
        checkWinner();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
resetGame();
gameLoop(); 