// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Game elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // UI elements
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
    const createPartyButton = document.getElementById('createPartyButton');
    const joinPartyButton = document.getElementById('joinPartyButton');
    const findGameButton = document.getElementById('findGameButton');
    const findGameMenu = document.getElementById('findGameMenu');
    const cancelFindGame = document.getElementById('cancelFindGame');
    const playersInQueue = document.getElementById('playersInQueue');
    const chatBox = document.getElementById('chatBox');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const playerNameInput = document.getElementById('playerName');

    // Game state
    let isPaused = false;
    let isAiMode = false;
    let aiDifficulty = 'easy';
    let showingMenu = true;
    let isDarkMode = true;
    let isOnlineMode = false;
    let socket = null;
    let playerPosition = null;
    let currentRoomId = null;
    let lastBallUpdate = Date.now();
    let countdownTime = 0;
    let lastCountdownUpdate = 0;
    let isTouchDevice = 'ontouchstart' in window;
    let lastTouchY = 0;
    let touchStartY = 0;
    let touchStartX = 0;
    let playerName = 'Player';
    let opponentName = 'Opponent';

    // Game objects
    const player1 = {
        x: 50,
        y: canvas.height/2,
        width: 10,
        height: 60,
        score: 0,
        speed: 7
    };

    const player2 = {
        x: canvas.width - 60,
        y: canvas.height/2,
        width: 10,
        height: 60,
        score: 0,
        speed: 7
    };

    const ball = {
        x: canvas.width/2,
        y: canvas.height/2,
        radius: 5,
        speedX: 7,
        speedY: 7
    };

    // Key states
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

    // Initialize socket connection
    function initializeSocket() {
        socket = io('https://tennis-server-y2jb.onrender.com', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        socket.on('connect', () => {
            console.log('Connected to server with socket ID:', socket.id);
            // If we were searching for a game before disconnecting, rejoin queue
            if (findGameMenu.style.display === 'block') {
                joinQueue();
            }
        });

        socket.on('roomCreated', (data) => {
            currentRoomId = data.roomId;
            document.getElementById('createPartyMenu').style.display = 'none';
            document.getElementById('waitingRoom').style.display = 'block';
            document.getElementById('roomIdDisplay').textContent = currentRoomId;
            document.getElementById('passwordDisplay').textContent = document.getElementById('createPassword').value;
            chatBox.style.display = 'flex';
            addChatMessage('System', 'Waiting for opponent to join...');
        });

        socket.on('gameStart', (data) => {
            playerPosition = data.position;
            currentRoomId = data.roomId;
            opponentName = data.opponentName || 'Opponent';
            console.log('Game started:', { playerPosition, opponentName, currentRoomId });
            isOnlineMode = true;
            showingMenu = false;
            gameMenu.style.display = 'none';
            document.getElementById('waitingRoom').style.display = 'none';
            document.getElementById('joinPartyMenu').style.display = 'none';
            chatBox.style.display = 'flex';
            resetPoints(); // Reset scores at game start
            addChatMessage('System', `Game started! You (${playerName}) are playing against ${opponentName}. Good luck!`);
            startCountdown();
        });

        socket.on('opponentMove', (data) => {
            if (playerPosition === 'left') {
                player2.x = data.x;
                player2.y = data.y;
            } else {
                player1.x = data.x;
                player1.y = data.y;
            }
        });

        socket.on('ballSync', (data) => {
            if (playerPosition === 'right') {
                ball.x = data.ballState.x;
                ball.y = data.ballState.y;
                ball.speedX = data.ballState.speedX;
                ball.speedY = data.ballState.speedY;
                if (data.scores) {
                    player1.score = data.scores.player1;
                    player2.score = data.scores.player2;
                }
            }
        });

        socket.on('chat', (data) => {
            console.log('Received chat message:', data);
            if (data.roomId === currentRoomId && data.sender !== playerName) {
                addChatMessage(data.sender, data.message);
            }
        });

        socket.on('togglePause', (data) => {
            console.log('Received pause toggle:', data);
            if (data.roomId === currentRoomId) {
                isPaused = data.isPaused;
                pauseButton.textContent = isPaused ? 'Resume (P)' : 'Pause (P)';
                if (isPaused) {
                    addChatMessage('System', `Game paused by ${data.sender}`);
                } else {
                    addChatMessage('System', `Game resumed by ${data.sender}`);
                }
            }
        });

        socket.on('playerDisconnected', () => {
            alert('Opponent disconnected!');
            isOnlineMode = false;
            showingMenu = true;
            currentRoomId = null;
            resetPoints();
            chatBox.style.display = 'none';
            chatMessages.innerHTML = '';
        });

        socket.on('queueUpdate', (data) => {
            console.log('Queue update:', data);
            if (data.playersInQueue !== undefined) {
                playersInQueue.textContent = data.playersInQueue;
                if (data.playersInQueue >= 2) {
                    addChatMessage('System', 'Found potential opponent, attempting to create match...');
                }
            }
        });

        socket.on('matchFound', (data) => {
            console.log('Match found:', data);
            if (!data.roomId || !data.position || !data.opponentName) {
                console.error('Invalid match data received:', data);
                return;
            }

            currentRoomId = data.roomId;
            playerPosition = data.position;
            opponentName = data.opponentName;
            
            // Hide menus and show game
            findGameMenu.style.display = 'none';
            deviceSpecificOptions.style.display = 'none';
            gameMenu.style.display = 'none';
            
            // Set game state
            isOnlineMode = true;
            showingMenu = false;
            chatBox.style.display = 'flex';
            
            // Reset game state
            resetPoints();
            resetBall();
            
            // Update UI
            addChatMessage('System', `Match found! You (${playerName}) are playing against ${opponentName}. Starting in 3 seconds...`);
            
            // Join the match room
            socket.emit('joinMatch', {
                roomId: currentRoomId,
                playerName: playerName,
                position: playerPosition
            });

            // Start countdown after joining room
            startCountdown();
        });

        socket.on('matchStart', (data) => {
            console.log('Match starting:', data);
            if (data.success) {
                addChatMessage('System', 'Both players connected. Game starting!');
            }
        });

        socket.on('matchError', (error) => {
            console.error('Match error:', error);
            addChatMessage('System', 'Error creating match. Please try again.');
            findGameMenu.style.display = 'none';
            deviceSpecificOptions.style.display = 'block';
        });

        socket.on('matchCancelled', () => {
            console.log('Match search cancelled');
            findGameMenu.style.display = 'none';
            deviceSpecificOptions.style.display = 'block';
            addChatMessage('System', 'Match search cancelled.');
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
            alert('Connection error: ' + error);
            findGameMenu.style.display = 'none';
            deviceSpecificOptions.style.display = 'block';
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            if (findGameMenu.style.display === 'block') {
                findGameMenu.style.display = 'none';
                deviceSpecificOptions.style.display = 'block';
                addChatMessage('System', 'Disconnected from matchmaking server.');
            }
        });
    }

    // Hide all submenus initially
    linksMenu.style.display = 'none';
    document.getElementById('createPartyMenu').style.display = 'none';
    document.getElementById('joinPartyMenu').style.display = 'none';
    document.getElementById('waitingRoom').style.display = 'none';
    aiOptions.style.display = 'none';

    // Show main menu
    gameMenu.style.display = 'block';
    deviceSpecificOptions.style.display = 'block';

    // Menu button handlers
    menuButton.onclick = () => {
        showingMenu = true;
        isPaused = true;
        gameMenu.style.display = 'block';
        deviceSpecificOptions.style.display = 'block';
        aiOptions.style.display = 'none';
        document.getElementById('createPartyMenu').style.display = 'none';
        document.getElementById('joinPartyMenu').style.display = 'none';
        document.getElementById('waitingRoom').style.display = 'none';
    };

    // Links menu
    linksButton.onclick = () => {
        linksMenu.style.display = 'block';
    };

    document.getElementById('backFromLinksButton').onclick = () => {
        linksMenu.style.display = 'none';
    };

    // Two player mode
    twoPlayerButton.onclick = () => {
        isAiMode = false;
        isOnlineMode = false;
        showingMenu = false;
        isPaused = false;
        gameMenu.style.display = 'none';
        resetPoints();
    };

    // AI mode
    aiButton.onclick = () => {
        deviceSpecificOptions.style.display = 'none';
        aiOptions.style.display = 'block';
    };

    document.getElementById('backFromAiButton').onclick = () => {
        aiOptions.style.display = 'none';
        deviceSpecificOptions.style.display = 'block';
    };

    startAiGame.onclick = () => {
        isAiMode = true;
        isOnlineMode = false;
        aiDifficulty = difficultySelect.value;
        showingMenu = false;
        isPaused = false;
        gameMenu.style.display = 'none';
        resetPoints();
    };

    // Multiplayer mode
    createPartyButton.onclick = () => {
        if (!socket) initializeSocket();
        deviceSpecificOptions.style.display = 'none';
        document.getElementById('createPartyMenu').style.display = 'block';
    };

    joinPartyButton.onclick = () => {
        if (!socket) initializeSocket();
        deviceSpecificOptions.style.display = 'none';
        document.getElementById('joinPartyMenu').style.display = 'block';
    };

    document.getElementById('createRoomButton').onclick = () => {
        const roomId = document.getElementById('createRoomId').value;
        const password = document.getElementById('createPassword').value;
        if (roomId && password) {
            socket.emit('createRoom', { 
                roomId, 
                password,
                playerName: playerName
            });
        } else {
            alert('Please enter both room name and password');
        }
    };

    document.getElementById('joinRoomButton').onclick = () => {
        const roomId = document.getElementById('joinRoomId').value;
        const password = document.getElementById('joinPassword').value;
        if (roomId && password) {
            socket.emit('joinRoom', { 
                roomId, 
                password,
                playerName: playerName
            });
        } else {
            alert('Please enter both room name and password');
        }
    };

    // Back buttons
    document.getElementById('backFromCreateButton').onclick = () => {
        document.getElementById('createPartyMenu').style.display = 'none';
        deviceSpecificOptions.style.display = 'block';
    };

    document.getElementById('backFromJoinButton').onclick = () => {
        document.getElementById('joinPartyMenu').style.display = 'none';
        deviceSpecificOptions.style.display = 'block';
    };

    document.getElementById('backFromWaitingButton').onclick = () => {
        document.getElementById('waitingRoom').style.display = 'none';
        deviceSpecificOptions.style.display = 'block';
        if (socket) {
            socket.emit('leaveRoom', { roomId: currentRoomId });
        }
    };

    // Game controls
    resetButton.onclick = resetPoints;
    themeButton.onclick = toggleTheme;

    // Event listeners
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = true;
        }
        if (e.key in keys) {
            keys[e.key] = true;
        }
        if (e.key.toLowerCase() === 'r') {
            resetPoints();
        }
        if (e.key.toLowerCase() === 'm') {
            showingMenu = true;
            isPaused = true;
            gameMenu.style.display = 'block';
        }
        if (e.key.toLowerCase() === 'l') {
            linksMenu.style.display = 'block';
        }
        if (e.key.toLowerCase() === 't') {
            toggleTheme();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = false;
        }
        if (e.key in keys) {
            keys[e.key] = false;
        }
    });

    // Resize canvas for mobile
    function resizeCanvas() {
        const container = document.getElementById('gameContainer');
        const containerWidth = container.clientWidth;
        // Use 16:9 aspect ratio
        const containerHeight = (containerWidth * 9) / 16;
        
        canvas.style.width = containerWidth + 'px';
        canvas.style.height = containerHeight + 'px';
        
        // Set fixed internal dimensions with 16:9 aspect ratio
        canvas.width = 800;  // Base width
        canvas.height = 450; // Height for 16:9 ratio
    }

    // Update initial player positions for new canvas height
    player1.y = canvas.height/2 - player1.height/2;
    player2.y = canvas.height/2 - player2.height/2;
    player2.x = canvas.width - 60;

    // Update ball position for new canvas height
    function resetBall() {
        ball.x = canvas.width/2;
        ball.y = canvas.height/2;
        ball.speedX = (Math.random() > 0.5 ? 1 : -1) * 7;
        ball.speedY = (Math.random() * 2 - 1) * 7;
    }

    // Call resize on load and window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Touch controls
    canvas.addEventListener('touchstart', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        touchStartY = touch.clientY - rect.top;
        touchStartX = touch.clientX - rect.left;
        lastTouchY = touchStartY;
    });

    canvas.addEventListener('touchmove', function(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const touchY = touch.clientY - rect.top;
        const touchX = touch.clientX - rect.left;
        
        // Convert touch coordinates to canvas coordinates
        const canvasY = (touchY / rect.height) * canvas.height;
        const canvasX = (touchX / rect.width) * canvas.width;
        
        if (isOnlineMode) {
            const playerToMove = playerPosition === 'left' ? player1 : player2;
            
            // Vertical movement
            playerToMove.y = Math.max(0, Math.min(canvas.height - playerToMove.height, canvasY - playerToMove.height/2));
            
            // Horizontal movement with boundaries
            const minX = playerPosition === 'left' ? 0 : canvas.width/2;
            const maxX = playerPosition === 'left' ? canvas.width/2 - playerToMove.width : canvas.width - playerToMove.width;
            playerToMove.x = Math.max(minX, Math.min(maxX, canvasX - playerToMove.width/2));
            
            // Send position to server
            if (socket) {
                socket.emit('playerMove', {
                    roomId: currentRoomId,
                    position: playerPosition,
                    x: playerToMove.x,
                    y: playerToMove.y
                });
            }
        } else if (!isAiMode) {
            // Local multiplayer touch controls
            const rect = canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            
            if (touchX < rect.width / 2) {
                // Left side - control player 1
                player1.y = Math.max(0, Math.min(canvas.height - player1.height, canvasY - player1.height/2));
            } else {
                // Right side - control player 2
                player2.y = Math.max(0, Math.min(canvas.height - player2.height, canvasY - player2.height/2));
            }
        }
        
        lastTouchY = touchY;
    });

    function updateAI() {
        if (!isAiMode) return;

        // Calculate ball prediction
        let predictedY = ball.y;
        
        // Only predict if ball is moving towards AI
        if (ball.speedX > 0) {
            // Calculate time for ball to reach AI paddle
            const distanceX = player2.x - ball.x;
            const timeToReach = distanceX / ball.speedX;
            
            // Predict ball Y position
            predictedY = ball.y + (ball.speedY * timeToReach);
            
            // Account for bounces
            const bounces = Math.floor(Math.abs(predictedY) / canvas.height);
            if (bounces > 0) {
                const remainder = predictedY % canvas.height;
                predictedY = (bounces % 2 === 0) ? remainder : canvas.height - remainder;
            }
        }

        // Add difficulty-based randomness and delay
        const aiSpeed = {
            'easy': 3,
            'medium': 5,
            'hard': 7,
            'expert': 9
        }[aiDifficulty];

        const predictionError = {
            'easy': 100,
            'medium': 50,
            'hard': 25,
            'expert': 10
        }[aiDifficulty];

        const reactionDelay = {
            'easy': 0.5,
            'medium': 0.3,
            'hard': 0.1,
            'expert': 0
        }[aiDifficulty];

        // Add random offset based on difficulty
        predictedY += (Math.random() - 0.5) * predictionError;

        // Move paddle with delay based on difficulty
        if (Math.random() > reactionDelay) {
            // Target the center of the paddle to the predicted Y position
            const targetY = predictedY - (player2.height / 2);
            
            // Add some randomness to paddle movement
            const currentDiff = targetY - player2.y;
            const moveAmount = Math.min(Math.abs(currentDiff), aiSpeed) * Math.sign(currentDiff);

            // Move paddle
            player2.y += moveAmount;

            // Keep paddle within bounds
            player2.y = Math.max(0, Math.min(canvas.height - player2.height, player2.y));

            // Add some horizontal movement based on ball position
            if (ball.x > canvas.width * 0.6) {
                // Move horizontally only when ball is close
                if (ball.x > player2.x + player2.width/2) {
                    player2.x = Math.min(player2.x + aiSpeed/2, canvas.width - player2.width);
                } else {
                    player2.x = Math.max(player2.x - aiSpeed/2, canvas.width/2);
                }
            } else {
                // Return to default position when ball is far
                const defaultX = canvas.width - 60;
                if (Math.abs(player2.x - defaultX) > aiSpeed) {
                    player2.x += Math.sign(defaultX - player2.x) * aiSpeed/2;
                }
            }
        }
    }

    function movePlayers() {
        if (!isTouchDevice) {  // Only process keyboard if not touch device
            if (isOnlineMode) {
                // Online multiplayer movement
                let playerToMove = playerPosition === 'left' ? player1 : player2;
                
                // WASD controls
                if (keys.w && playerToMove.y > 0) {
                    playerToMove.y -= playerToMove.speed;
                }
                if (keys.s && playerToMove.y < canvas.height - playerToMove.height) {
                    playerToMove.y += playerToMove.speed;
                }
                if (keys.a && playerToMove.x > (playerPosition === 'left' ? 0 : canvas.width/2)) {
                    playerToMove.x -= playerToMove.speed;
                }
                if (keys.d && playerToMove.x < (playerPosition === 'left' ? canvas.width/2 - playerToMove.width : canvas.width - playerToMove.width)) {
                    playerToMove.x += playerToMove.speed;
                }

                // Arrow key controls (alternative)
                if (keys.arrowup && playerToMove.y > 0) {
                    playerToMove.y -= playerToMove.speed;
                }
                if (keys.arrowdown && playerToMove.y < canvas.height - playerToMove.height) {
                    playerToMove.y += playerToMove.speed;
                }
                if (keys.arrowleft && playerToMove.x > (playerPosition === 'left' ? 0 : canvas.width/2)) {
                    playerToMove.x -= playerToMove.speed;
                }
                if (keys.arrowright && playerToMove.x < (playerPosition === 'left' ? canvas.width/2 - playerToMove.width : canvas.width - playerToMove.width)) {
                    playerToMove.x += playerToMove.speed;
                }

                // Send player position
                if (socket) {
                    socket.emit('playerMove', {
                        roomId: currentRoomId,
                        position: playerPosition,
                        x: playerToMove.x,
                        y: playerToMove.y
                    });
                }
            } else {
                // Local gameplay
                // Player 1 movement (WASD keys)
                if (keys.w && player1.y > 0) {
                    player1.y -= player1.speed;
                }
                if (keys.s && player1.y < canvas.height - player1.height) {
                    player1.y += player1.speed;
                }
                if (keys.a && player1.x > 0) {
                    player1.x -= player1.speed;
                }
                if (keys.d && player1.x < canvas.width/2 - player1.width) {
                    player1.x += player1.speed;
                }

                // Player 2 movement (Arrow keys or AI)
                if (!isAiMode) {
                    if (keys.arrowup && player2.y > 0) {
                        player2.y -= player2.speed;
                    }
                    if (keys.arrowdown && player2.y < canvas.height - player2.height) {
                        player2.y += player2.speed;
                    }
                    if (keys.arrowleft && player2.x > canvas.width/2) {
                        player2.x -= player2.speed;
                    }
                    if (keys.arrowright && player2.x < canvas.width - player2.width) {
                        player2.x += player2.speed;
                    }
                } else {
                    updateAI();
                }
            }
        }
        // Touch movement is handled by touch event listeners
    }

    function moveBall() {
        // Store previous position
        const prevX = ball.x;
        const prevY = ball.y;

        // Update position
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Wall collisions
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.speedY = -ball.speedY;
            ball.y = ball.y + ball.radius > canvas.height ? canvas.height - ball.radius : ball.radius;
        }

        // Paddle collisions with interpolation
        const interpolationSteps = 4;
        for (let i = 0; i <= interpolationSteps; i++) {
            const interpolatedX = prevX + (ball.x - prevX) * (i / interpolationSteps);
            const interpolatedY = prevY + (ball.y - prevY) * (i / interpolationSteps);
            
            // Create interpolated ball position for collision check
            const interpolatedBall = {
                x: interpolatedX,
                y: interpolatedY,
                radius: ball.radius
            };

            if (checkCollision(interpolatedBall, player1)) {
                ball.speedX = Math.abs(ball.speedX) * 1.1; // Ensure ball moves right
                ball.x = player1.x + player1.width + ball.radius; // Place ball at edge of paddle
                // Add vertical angle based on where the ball hits the paddle
                const hitPosition = (ball.y - player1.y) / player1.height;
                ball.speedY = (hitPosition - 0.5) * 15;
                return;
            }
            
            if (checkCollision(interpolatedBall, player2)) {
                ball.speedX = -Math.abs(ball.speedX) * 1.1; // Ensure ball moves left
                ball.x = player2.x - ball.radius; // Place ball at edge of paddle
                // Add vertical angle based on where the ball hits the paddle
                const hitPosition = (ball.y - player2.y) / player2.height;
                ball.speedY = (hitPosition - 0.5) * 15;
                return;
            }
        }

        // Score points
        if (ball.x < 0) {
            player2.score++;
            resetBall();
        } else if (ball.x > canvas.width) {
            player1.score++;
            resetBall();
        }

        // Cap maximum ball speed
        const maxSpeed = 15;
        const currentSpeed = Math.sqrt(ball.speedX * ball.speedX + ball.speedY * ball.speedY);
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            ball.speedX *= scale;
            ball.speedY *= scale;
        }

        // Send ball state in online mode
        if (isOnlineMode && playerPosition === 'left' && socket) {
            if (Date.now() - lastBallUpdate > 16) { // Sync ball ~60 times per second
                socket.emit('ballUpdate', {
                    roomId: currentRoomId,
                    ballState: {
                        x: ball.x,
                        y: ball.y,
                        speedX: ball.speedX,
                        speedY: ball.speedY
                    },
                    scores: {
                        player1: player1.score,
                        player2: player2.score
                    }
                });
                lastBallUpdate = Date.now();
            }
        }
    }

    function checkCollision(ball, player) {
        // Get the closest point on the paddle to the ball
        const closestX = Math.max(player.x, Math.min(ball.x, player.x + player.width));
        const closestY = Math.max(player.y, Math.min(ball.y, player.y + player.height));
        
        // Calculate the distance between the closest point and the ball's center
        const distanceX = ball.x - closestX;
        const distanceY = ball.y - closestY;
        
        // Check if the distance is less than the ball's radius
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
        return distanceSquared <= (ball.radius * ball.radius);
    }

    function resetPoints() {
        player1.score = 0;
        player2.score = 0;
        isPaused = false;
        resetBall();
        if (isOnlineMode) {
            startCountdown();
        }
    }

    function checkWinner() {
        if (!isOnlineMode) return; // Only check winner in online mode
        if (countdownTime > 0) return; // Don't check winner during countdown

        if (player1.score >= 10) {
            isPaused = true;
            const winnerName = playerPosition === 'left' ? playerName : opponentName;
            displayWinner(winnerName);
            addChatMessage('System', `${winnerName} won the game!`);
        } else if (player2.score >= 10) {
            isPaused = true;
            const winnerName = playerPosition === 'right' ? playerName : opponentName;
            displayWinner(winnerName);
            addChatMessage('System', `${winnerName} won the game!`);
        }
    }

    function displayWinner(winnerName) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(winnerName + ' WON!', canvas.width/2, canvas.height/2);
        ctx.font = '24px Arial';
        ctx.fillText('Press R to play again', canvas.width/2, canvas.height/2 + 40);
    }

    function draw() {
        if (showingMenu) {
            gameMenu.style.display = 'block';
            return;
        } else {
            gameMenu.style.display = 'none';
        }

        // Clear canvas
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--background-color');
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw center line
        ctx.setLineDash([5, 15]);
        ctx.beginPath();
        ctx.moveTo(canvas.width/2, 0);
        ctx.lineTo(canvas.width/2, canvas.height);
        ctx.strokeStyle = 'white';
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw paddles
        ctx.fillStyle = 'white';
        ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
        ctx.fillRect(player2.x, player2.y, player2.width, player2.height);

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.closePath();

        // Draw scores and player labels
        ctx.font = '32px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        
        // Draw player names
        ctx.font = '20px Arial';
        let leftName, rightName;
        
        if (isOnlineMode) {
            if (playerPosition === 'left') {
                leftName = playerName;
                rightName = opponentName;
            } else {
                leftName = opponentName;
                rightName = playerName;
            }
        } else {
            leftName = 'PLAYER 1';
            rightName = isAiMode ? 'AI' : 'PLAYER 2';
        }

        console.log('Drawing names:', { leftName, rightName, playerPosition });
        
        // Draw left player name and info
        ctx.fillText(leftName, canvas.width/4, 30);
        ctx.font = '16px Arial';
        ctx.fillText(isOnlineMode ? '(WASD or Arrow keys)' : '(WASD keys)', canvas.width/4, 50);
        ctx.font = '32px Arial';
        ctx.fillText(player1.score, canvas.width/4, 80);

        // Draw right player name and info
        ctx.font = '20px Arial';
        ctx.fillText(rightName, 3*canvas.width/4, 30);
        ctx.font = '16px Arial';
        ctx.fillText(isOnlineMode ? '(WASD or Arrow keys)' : (isAiMode ? `(${aiDifficulty.toUpperCase()})` : '(Arrow keys)'), 3*canvas.width/4, 50);
        ctx.font = '32px Arial';
        ctx.fillText(player2.score, 3*canvas.width/4, 80);

        // Add credit text at the bottom
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Made by Sirage7474', canvas.width/2, canvas.height - 10);

        // Check for winner
        checkWinner();

        // Add touch controls hint for mobile
        if (isTouchDevice) {
            ctx.font = '14px Arial';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            if (isOnlineMode) {
                ctx.fillText('Touch and drag to move your paddle', canvas.width/2, canvas.height - 30);
            } else if (!isAiMode) {
                ctx.fillText('Touch left/right side to control respective paddle', canvas.width/2, canvas.height - 30);
            }
        }
    }

    function gameLoop() {
        if (countdownTime > 0) {
            updateCountdown();
        }
        
        if (!isPaused && countdownTime === 0) {
            movePlayers();
            moveBall();
        }
        
        draw();
        drawCountdown();
        requestAnimationFrame(gameLoop);
    }

    function toggleTheme() {
        isDarkMode = !isDarkMode;
        if (isDarkMode) {
            document.documentElement.style.setProperty('--background-color', '#2D2B8C');
            document.documentElement.style.setProperty('--button-color', '#333');
            document.documentElement.style.setProperty('--button-hover', '#505557');
        } else {
            document.documentElement.style.setProperty('--background-color', '#4CAF50');
            document.documentElement.style.setProperty('--button-color', '#4CAF50');
            document.documentElement.style.setProperty('--button-hover', '#45a049');
        }
    }

    // Initialize player name from localStorage if available
    if (localStorage.getItem('playerName')) {
        playerName = localStorage.getItem('playerName');
        playerNameInput.value = playerName;
    }

    // Update player name when input changes
    playerNameInput.addEventListener('change', function() {
        playerName = this.value || 'Player';
        localStorage.setItem('playerName', playerName);
    });

    // Update chat functionality
    chatInput.addEventListener('keydown', function(e) {
        e.stopPropagation();
        
        if (e.key === 'Enter' && this.value.trim() && socket && currentRoomId) {
            const message = this.value.trim();
            console.log('Sending chat message:', {
                roomId: currentRoomId,
                sender: playerName,
                message: message
            });
            
            socket.emit('chat', {
                roomId: currentRoomId,
                sender: playerName,
                message: message
            });
            
            // Add our own message locally
            addChatMessage(playerName, message, true);
            this.value = '';
        }
    });

    // Prevent game controls when chat is focused
    chatInput.addEventListener('focus', function() {
        // Disable game controls
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
    });

    chatInput.addEventListener('blur', function() {
        // Re-enable game controls
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
    });

    // Separate key handlers for game controls
    function handleKeyDown(e) {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = true;
        }
        if (e.key in keys) {
            keys[e.key] = true;
        }
        if (e.key.toLowerCase() === 'r') {
            resetPoints();
        }
        if (e.key.toLowerCase() === 'm') {
            showingMenu = true;
            isPaused = true;
            gameMenu.style.display = 'block';
        }
        if (e.key.toLowerCase() === 'l') {
            linksMenu.style.display = 'block';
        }
        if (e.key.toLowerCase() === 't') {
            toggleTheme();
        }
    }

    function handleKeyUp(e) {
        if (e.key.toLowerCase() in keys) {
            keys[e.key.toLowerCase()] = false;
        }
        if (e.key in keys) {
            keys[e.key] = false;
        }
    }

    // Initialize key event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    function addChatMessage(sender, message, isMe = false) {
        console.log('Adding chat message:', { sender, message, isMe });
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (sender === 'System') {
            messageDiv.classList.add('system-message');
            messageDiv.textContent = message;
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'player-name';
            nameSpan.style.color = isMe ? '#4CAF50' : '#ff6b6b';
            nameSpan.textContent = sender + ': ';
            messageDiv.appendChild(nameSpan);
            messageDiv.appendChild(document.createTextNode(message));
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Countdown timer
    function startCountdown() {
        countdownTime = 3;
        lastCountdownUpdate = Date.now();
        isPaused = true;
        
        // Reset game state
        player1.score = 0;
        player2.score = 0;
        resetBall();
        
        // Position players based on their assigned positions
        if (isOnlineMode) {
            if (playerPosition === 'left') {
                player1.x = 50;
                player2.x = canvas.width - 60;
            } else {
                player1.x = canvas.width - 60;
                player2.x = 50;
            }
        }
    }

    function updateCountdown() {
        if (countdownTime > 0) {
            const now = Date.now();
            if (now - lastCountdownUpdate >= 1000) {
                countdownTime--;
                lastCountdownUpdate = now;
                if (countdownTime === 0) {
                    isPaused = false;
                    if (isOnlineMode) {
                        addChatMessage('System', 'Game started! Good luck!');
                    }
                }
            }
        }
    }

    function drawCountdown() {
        if (countdownTime > 0) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'white';
            ctx.font = '72px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(countdownTime.toString(), canvas.width/2, canvas.height/2);
        }
    }

    function joinQueue() {
        const queueData = {
            playerName: playerName,
            socketId: socket.id,
            timestamp: Date.now()
        };
        
        console.log('Joining queue with data:', queueData);
        socket.emit('findGame', queueData);
        
        addChatMessage('System', 'Searching for an opponent...');
        playersInQueue.textContent = '1';
    }

    // Find Game button handler
    findGameButton.onclick = () => {
        if (!playerName || playerName === 'Player') {
            alert('Please enter your name before finding a game!');
            return;
        }

        if (!socket) {
            initializeSocket();
        } else if (!socket.connected) {
            console.log('Reconnecting to server...');
            socket.connect();
        }
        
        deviceSpecificOptions.style.display = 'none';
        findGameMenu.style.display = 'block';
        
        joinQueue();
    };

    // Cancel Find Game button handler
    cancelFindGame.onclick = () => {
        if (socket && socket.connected) {
            console.log('Cancelling match search');
            socket.emit('cancelFind', {
                socketId: socket.id,
                playerName: playerName
            });
            
            findGameMenu.style.display = 'none';
            deviceSpecificOptions.style.display = 'block';
            addChatMessage('System', 'Cancelled match search.');
        }
    };

    // Update the disconnect handling
    window.onbeforeunload = () => {
        if (socket && socket.connected) {
            if (findGameMenu.style.display === 'block') {
                socket.emit('cancelFind', {
                    socketId: socket.id,
                    playerName: playerName
                });
            }
            if (currentRoomId) {
                socket.emit('leaveRoom', { 
                    roomId: currentRoomId,
                    playerName: playerName
                });
            }
        }
    };

    // Add reconnection handling
    window.addEventListener('online', () => {
        console.log('Network connection restored');
        if (socket && !socket.connected) {
            console.log('Attempting to reconnect...');
            socket.connect();
        }
    });

    // Start the game
    gameLoop();
}); 
