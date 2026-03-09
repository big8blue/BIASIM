const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_DIR = path.join(__dirname, 'config');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR);

let config = {
    admin: { username: 'admin', password: 'admin123' },
    game: { 
        maxPlayers: 10, 
        totalQuarters: 12, 
        startingCash: 1000000,
        companyName: 'My Company'
    }
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } else {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        }
    } catch (e) { console.log('Using default config'); }
}
loadConfig();

const MAX_PLAYERS = () => config.game?.maxPlayers || 10;
const TOTAL_QUARTERS = () => config.game?.totalQuarters || 12;
const STARTING_CASH = () => config.game?.startingCash || 1000000;

let adminSocket = null;

const games = new Map();
const gameHistory = [];

function checkAdmin(username, password) {
    return config.admin?.username === username && config.admin?.password === password;
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        io.emit('configUpdated', config);
    } catch (e) { console.error('Config save error:', e.message); }
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function loadData() {
    try {
        if (fs.existsSync(GAMES_FILE)) {
            const data = JSON.parse(fs.readFileSync(GAMES_FILE, 'utf8'));
            data.forEach(([id, game]) => games.set(id, game));
            console.log(`Loaded ${games.size} games`);
        }
        if (fs.existsSync(HISTORY_FILE)) {
            const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history.forEach(h => gameHistory.push(h));
        }
    } catch (e) { console.error('Load error:', e.message); }
}

function saveGame(gameId) {
    try {
        const arr = Array.from(games.entries());
        fs.writeFileSync(GAMES_FILE, JSON.stringify(arr, null, 2));
    } catch (e) { console.error('Save error:', e.message); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(gameHistory, null, 2));
    } catch (e) { console.error('History save error:', e.message); }
}

function createNewGame(roomCode, params = {}) {
    const maxPlayers = params.maxPlayers || MAX_PLAYERS();
    // enforce a sensible minimum for quarters (standard is 4)
    let totalQuarters = (params.totalQuarters != null) ? parseInt(params.totalQuarters, 10) : TOTAL_QUARTERS();
    if (isNaN(totalQuarters)) totalQuarters = TOTAL_QUARTERS();
    totalQuarters = Math.max(4, totalQuarters);
    const startingCash = params.startingCash || STARTING_CASH();
    
    return {
        id: roomCode,
        roomCode: roomCode,
        status: 'waiting',
        quarter: 1,
        maxPlayers: maxPlayers,
        totalQuarters: totalQuarters,
        startingCash: startingCash,
        players: [],
        marketConditions: generateMarketConditions(),
        createdAt: new Date().toISOString()
    };
}

function generateMarketConditions() {
    return {
        baseDemand: 10000 + Math.random() * 5000,
        competition: 3,
        economicFactor: 0.9 + Math.random() * 0.2,
        trend: Math.random() > 0.5 ? 1 : -1
    };
}

function createPlayer(id, name, companyName, startingCash) {
    return {
        id,
        name,
        companyName,
        cash: startingCash || STARTING_CASH(),
        revenue: 0,
        profit: 0,
        marketShare: 0,
        submitted: false,
        decisions: {
            price: 50,
            marketingBudget: 50000,
            researchBudget: 25000,
            qualityInvestment: 30000,
            distribution: 1
        },
        history: []
    };
}

function calculateResults(game) {
    const market = game.marketConditions;
    let totalDemand = 0;
    
    game.players.forEach(p => {
        const d = p.decisions;
        const priceFactor = Math.max(0.3, 1.5 - (d.price / 100));
        const marketingEffect = 1 + (d.marketingBudget / 100000);
        const qualityEffect = 1 + (d.qualityInvestment / 200000);
        const distributionEffect = 1 + (d.distribution * 0.2);
        
        const demand = market.baseDemand * priceFactor * marketingEffect * qualityEffect * distributionEffect * market.economicFactor;
        p.demand = Math.max(0, demand);
        totalDemand += demand;
    });
    
    game.players.forEach(p => {
        p.marketShare = totalDemand > 0 ? (p.demand / totalDemand) * 100 : 0;
        p.revenue = p.demand * p.decisions.price;
        
        const costs = p.decisions.marketingBudget + p.decisions.researchBudget + 
                      p.decisions.qualityInvestment + (p.decisions.distribution * 20000);
        p.profit = p.revenue - costs;
        p.cash += p.profit;
        
        p.history.push({
            quarter: game.quarter,
            revenue: p.revenue,
            profit: p.profit,
            marketShare: p.marketShare,
            decisions: { ...p.decisions }
        });
    });
    
    market.baseDemand *= (1 + market.trend * 0.05);
    market.economicFactor = Math.max(0.7, Math.min(1.3, market.economicFactor + (Math.random() - 0.5) * 0.1));
}

function emitToAdmin(event, data) {
    if (adminSocket) {
        adminSocket.emit(event, data);
    }
}

io.on('connection', (socket) => {
    console.log('Connection:', socket.id);
    socket.isAdmin = false;
    
    socket.on('adminLogin', (user, pass, cb) => {
        if (checkAdmin(user, pass)) {
            socket.isAdmin = true;
            adminSocket = socket;
            socket.adminUser = user;
            socket.emit('config', config);
            cb({ success: true });
        } else {
            cb({ success: false, error: 'Invalid credentials' });
        }
    });
    
    socket.on('adminUpdateConfig', (newConfig, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        config = { ...config, ...newConfig };
        // enforce sensible minimums for game config
        if (!config.game) config.game = {};
        config.game.totalQuarters = parseInt(config.game.totalQuarters, 10) || TOTAL_QUARTERS();
        if (isNaN(config.game.totalQuarters)) config.game.totalQuarters = TOTAL_QUARTERS();
        config.game.totalQuarters = Math.max(4, config.game.totalQuarters);
        config.game.maxPlayers = parseInt(config.game.maxPlayers, 10) || MAX_PLAYERS();
        config.game.maxPlayers = Math.max(2, config.game.maxPlayers);
        saveConfig();
        cb({ success: true, config });
    });
    
    socket.on('adminCreateRoom', (params, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        let roomCode = generateRoomCode();
        while (games.has(roomCode)) roomCode = generateRoomCode();
        
        const game = createNewGame(roomCode, params);
        games.set(roomCode, game);
        saveGame(roomCode);
        
        emitToAdmin('roomsUpdated', getRoomsList());
        cb({ success: true, roomCode, game });
    });
    
    socket.on('adminStartGame', (roomCode, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        const game = games.get(roomCode);
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        if (game.players.length < 1) { cb({ success: false, error: 'Need at least 1 player' }); return; }
        
        game.status = 'playing';
        game.quarter = 1;
        game.players.forEach(p => { p.submitted = false; });
        saveGame(roomCode);
        
        io.to(roomCode).emit('gameStarted', { quarter: 1, players: game.players, totalQuarters: game.totalQuarters });
        emitToAdmin('roomsUpdated', getRoomsList());
        cb({ success: true });
    });
    
    socket.on('adminProceedRound', (roomCode, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        const game = games.get(roomCode);
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        
        const allSubmitted = game.players.every(p => p.submitted);
        if (!allSubmitted) {
            const pending = game.players.filter(p => !p.submitted).map(p => p.name).join(', ');
            cb({ success: false, error: `Waiting for: ${pending}` });
            return;
        }
        
        calculateResults(game);
        
        // use per-game totalQuarters when available (fallback to global config)
        const gameTotalQuarters = game.totalQuarters || TOTAL_QUARTERS();
        if (game.quarter >= gameTotalQuarters) {
            game.status = 'ended';
            
            const winner = game.players.reduce((a, b) => {
                const aTotal = (a.history || []).reduce((s, h) => s + (h.profit || 0), 0);
                const bTotal = (b.history || []).reduce((s, h) => s + (h.profit || 0), 0);
                return bTotal > aTotal ? b : a;
            });
            
            const historyEntry = {
                roomCode: game.roomCode,
                winner: winner.name,
                company: winner.companyName,
                players: game.players.map(p => ({
                    name: p.name,
                    company: p.companyName,
                    finalCash: p.cash,
                    totalProfit: (p.history || []).reduce((s, h) => s + (h.profit || 0), 0),
                    avgShare: (p.history || []).length ? (p.history || []).reduce((s, h) => s + (h.marketShare || 0), 0) / p.history.length : 0,
                    history: p.history
                })),
                quarters: gameTotalQuarters,
                playedAt: new Date().toISOString()
            };
            
            gameHistory.push(historyEntry);
            saveHistory();
            saveGame(roomCode);
            
        io.to(roomCode).emit('gameEnded', {
            players: game.players.sort((a, b) => {
                const aT = a.history.reduce((s, h) => s + h.profit, 0);
                const bT = b.history.reduce((s, h) => s + h.profit, 0);
                return bT - aT;
            }),
            winner
        });
            // notify admin with updated history and rooms
            emitToAdmin('historyUpdated', gameHistory);
            emitToAdmin('roomsUpdated', getRoomsList());
            cb({ success: true, ended: true });
        } else {
            game.quarter++;
            game.players.forEach(p => p.submitted = false);
            saveGame(roomCode);
            
            io.to(roomCode).emit('quarterResults', {
                quarter: game.quarter,
                players: game.players,
                marketConditions: game.marketConditions,
                totalQuarters: game.totalQuarters
            });
            
            emitToAdmin('roomsUpdated', getRoomsList());
            cb({ success: true, quarter: game.quarter });
        }
    });
    
    socket.on('adminDeleteRoom', (roomCode, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        if (games.has(roomCode)) {
            io.to(roomCode).emit('roomDeleted');
            games.delete(roomCode);
            saveGame(roomCode);
            emitToAdmin('roomsUpdated', getRoomsList());
            cb({ success: true });
        } else {
            cb({ success: false, error: 'Room not found' });
        }
    });
    
    socket.on('adminKickPlayer', (roomCode, playerId, cb) => {
        if (!socket.isAdmin) { cb({ success: false, error: 'Admin only' }); return; }
        
        const game = games.get(roomCode);
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        
        const idx = game.players.findIndex(p => p.id === playerId);
        if (idx > -1) {
            const player = game.players[idx];
            game.players.splice(idx, 1);
            saveGame(roomCode);
            io.to(roomCode).emit('playerKicked', { player, players: game.players });
            emitToAdmin('roomsUpdated', getRoomsList());
            cb({ success: true });
        } else {
            cb({ success: false, error: 'Player not found' });
        }
    });
    
    socket.on('playerJoin', (roomCode, name, companyName, cb) => {
        const game = games.get(roomCode);
        
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        if (game.status !== 'waiting') { cb({ success: false, error: 'Game already started' }); return; }
        if (game.players.length >= game.maxPlayers) { cb({ success: false, error: 'Room is full' }); return; }
        
        const player = createPlayer(socket.id, name, companyName, game.startingCash);
        game.players.push(player);
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerId = socket.id;
        
        saveGame(roomCode);
        io.to(roomCode).emit('playerJoined', game.players);
        emitToAdmin('roomsUpdated', getRoomsList());
        
        cb({ success: true, player, game, totalQuarters: game.totalQuarters });
    });
    
    socket.on('playerSubmit', (roomCode, decisions, cb) => {
        const game = games.get(roomCode);
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        
        const player = game.players.find(p => p.id === socket.id);
        if (!player) { cb({ success: false, error: 'Player not found' }); return; }
        
        player.decisions = {
            price: decisions.price,
            marketingBudget: decisions.marketingBudget,
            researchBudget: decisions.researchBudget,
            qualityInvestment: decisions.qualityInvestment,
            distribution: decisions.distribution
        };
        player.submitted = true;
        
        const submitted = game.players.filter(p => p.submitted).length;
        io.to(roomCode).emit('decisionsUpdated', { submitted, total: game.players.length });
        emitToAdmin('roomsUpdated', getRoomsList());
        
        cb({ success: true });
    });
    
    socket.on('playerReconnect', (roomCode, playerId, cb) => {
        const game = games.get(roomCode);
        if (!game) { cb({ success: false, error: 'Room not found' }); return; }
        
        const player = game.players.find(p => p.id === playerId);
        if (!player) { cb({ success: false, error: 'Player not found' }); return; }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.playerId = playerId;
        
        cb({ success: true, game, player, totalQuarters: game.totalQuarters });
    });
    
    socket.on('disconnect', () => {
        if (socket === adminSocket) {
            adminSocket = null;
        }
        
        if (socket.roomCode && socket.playerId && !socket.isAdmin) {
            const game = games.get(socket.roomCode);
            if (game && game.status === 'waiting') {
                const idx = game.players.findIndex(p => p.id === socket.playerId);
                if (idx > -1) {
                    game.players.splice(idx, 1);
                    saveGame(socket.roomCode);
                    io.to(socket.roomCode).emit('playerLeft', game.players);
                    emitToAdmin('roomsUpdated', getRoomsList());
                }
            }
        }
    });
});

function getRoomsList() {
    return Array.from(games.values()).map(g => ({
        roomCode: g.roomCode,
        status: g.status,
        quarter: g.quarter,
        totalQuarters: g.totalQuarters || TOTAL_QUARTERS(),
        maxPlayers: g.maxPlayers || MAX_PLAYERS(),
        startingCash: g.startingCash || STARTING_CASH(),
        players: g.players.length,
        playerDetails: g.players.map(p => ({
            id: p.id,
            name: p.name,
            company: p.companyName,
            submitted: p.submitted,
            cash: p.cash
        })),
        createdAt: g.createdAt
    }));
}

app.get('/api/admin/stats', (req, res) => {
    const active = Array.from(games.values()).filter(g => g.status !== 'ended');
    res.json({
        activeRooms: active.length,
        waitingRooms: active.filter(g => g.status === 'waiting').length,
        playingRooms: active.filter(g => g.status === 'playing').length,
        totalHistory: gameHistory.length,
        config: config
    });
});

app.get('/api/admin/rooms', (req, res) => {
    res.json(getRoomsList());
});

app.get('/api/admin/history', (req, res) => {
    res.json(gameHistory);
});

app.get('/api/admin/config', (req, res) => {
    res.json(config);
});

app.post('/api/admin/config', (req, res) => {
    config = { ...config, ...req.body };
    saveConfig();
    res.json(config);
});

loadData();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Admin: http://localhost:${PORT}/admin.html`);
});
