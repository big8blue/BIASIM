const socket = io();

let currentGame = null;
let currentPlayer = null;
let roomCode = null;
let isDarkMode = true;

const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'];

function saveSession(code, pid) {
    try {
        localStorage.setItem('bizsim_room', code);
        localStorage.setItem('bizsim_player', pid);
        localStorage.setItem('bizsim_theme', isDarkMode ? 'dark' : 'light');
    } catch (e) {}
}

function clearSession() {
    try {
        localStorage.removeItem('bizsim_room');
        localStorage.removeItem('bizsim_player');
    } catch (e) {}
}

function getSession() {
    try {
        return { 
            room: localStorage.getItem('bizsim_room'), 
            player: localStorage.getItem('bizsim_player'),
            theme: localStorage.getItem('bizsim_theme')
        };
    } catch (e) { return { room: null, player: null, theme: 'dark' }; }
}

function initTheme() {
    const { theme } = getSession();
    isDarkMode = theme !== 'light';
    applyTheme();
}

function applyTheme() {
    document.body.classList.toggle('light-mode', !isDarkMode);
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.textContent = isDarkMode ? '☀️ Light' : '🌙 Dark';
    }
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    try {
        localStorage.setItem('bizsim_theme', isDarkMode ? 'dark' : 'light');
    } catch (e) {}
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
}

function notify(msg, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
}

function formatMoney(v) { return '$' + Math.round(v).toLocaleString(); }
function formatPct(v) { return (v || 0).toFixed(1) + '%'; }

function joinRoom() {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    const name = document.getElementById('playerName').value.trim().toUpperCase();
    const company = document.getElementById('companyName').value.trim().toUpperCase();
    
    if (!code || !name || !company) {
        notify('Please fill all fields', 'error');
        return;
    }
    
    socket.emit('playerJoin', code, name, company, (res) => {
        if (res.success) {
            roomCode = code;
            currentPlayer = res.player;
            currentGame = res.game;
            saveSession(code, currentPlayer.id);
            showScreen('waitingScreen');
            updateWaitingRoom(res.game.players);
            notify('Joined successfully!', 'success');
        } else {
            notify(res.error || 'Failed to join', 'error');
        }
    });
}

function tryReconnect() {
    const { room, player } = getSession();
    if (room && player) {
        socket.emit('playerReconnect', room, player, (res) => {
            if (res.success) {
                roomCode = room;
                currentPlayer = res.player;
                currentGame = res.game;
                
                notify('Reconnected!', 'success');
                
                if (res.game.status === 'waiting') {
                    showScreen('waitingScreen');
                    updateWaitingRoom(res.game.players);
                } else if (res.game.status === 'playing') {
                    showScreen('gameScreen');
                    updateGameUI(res.game);
                } else if (res.game.status === 'ended') {
                    showEndScreen(res.game.players, res.game.players.reduce((a, b) => {
                        const aT = a.history.reduce((s, h) => s + h.profit, 0);
                        const bT = b.history.reduce((s, h) => s + h.profit, 0);
                        return bT > aT ? b : a;
                    }));
                }
            } else {
                clearSession();
            }
        });
    }
}

function updateWaitingRoom(players) {
    const list = document.getElementById('waitingPlayers');
    list.innerHTML = players.map((p, i) => `
        <li class="player-item">
            <div class="player-avatar" style="background: ${colors[i % colors.length]}">${p.name[0]}</div>
            <div>
                <div class="player-name">${p.name}</div>
                <div class="player-company">${p.companyName}</div>
            </div>
        </li>
    `).join('');
    
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    document.getElementById('playerCount').textContent = `${players.length}/${currentGame?.maxPlayers || config?.game?.maxPlayers || 10}`;
    
    if (currentPlayer) {
        document.getElementById('yourName').textContent = currentPlayer.name;
        document.getElementById('yourCompany').textContent = currentPlayer.companyName;
    }
}

function submitDecisions() {
    const decisions = {
        price: parseInt(document.getElementById('priceSlider').value),
        marketingBudget: parseInt(document.getElementById('marketingSlider').value),
        researchBudget: parseInt(document.getElementById('researchSlider').value),
        qualityInvestment: parseInt(document.getElementById('qualitySlider').value),
        distribution: parseInt(document.getElementById('distributionSlider').value)
    };
    
    socket.emit('playerSubmit', roomCode, decisions, (res) => {
        if (res.success) {
            notify('Submitted! Waiting for other players...', 'success');
            document.getElementById('submitBtn').textContent = 'Submitted - Waiting';
            document.getElementById('submitBtn').disabled = true;
            showScreen('waitingScreen');
        } else {
            notify(res.error || 'Failed to submit', 'error');
        }
    });
}

function updateSlider(type) {
    const map = {
        price: { el: 'priceSlider', val: 'priceValue', pre: '$' },
        marketing: { el: 'marketingSlider', val: 'marketingValue', pre: '$' },
        research: { el: 'researchSlider', val: 'researchValue', pre: '$' },
        quality: { el: 'qualitySlider', val: 'qualityValue', pre: '$' },
        distribution: { el: 'distributionSlider', val: 'distributionValue', pre: '' }
    };
    const s = map[type];
    document.getElementById(s.val).textContent = s.pre + parseInt(document.getElementById(s.el).value).toLocaleString();
}

function updateGameUI(game) {
    const totalQuarters = game.totalQuarters || config?.game?.totalQuarters || 12;
    document.getElementById('quarterDisplay').textContent = `${game.quarter}/${totalQuarters}`;
    
    const me = game.players.find(p => p.id === socket.id);
    if (me) {
        document.getElementById('playerInfoBarContent').innerHTML = `
            <span><strong>${me.name}</strong> | ${me.companyName}</span>
        `;
        
        document.getElementById('cashDisplay').textContent = formatMoney(me.cash);
        document.getElementById('revenueDisplay').textContent = formatMoney(me.revenue || 0);
        document.getElementById('shareDisplay').textContent = formatPct(me.marketShare);
        
        const btn = document.getElementById('submitBtn');
        if (me.submitted) {
            btn.textContent = 'Submitted - Waiting';
            btn.disabled = true;
        } else {
            btn.textContent = 'Submit Decisions';
            btn.disabled = false;
        }
    }
    
    updateMarketView(game.players);
    updateLeaderboard(game.players);
    updateResultsTable(game.players);
}

function updateMarketView(players) {
    const bar = document.getElementById('marketBar');
    if (!players?.length) return;
    
    const sorted = [...players].sort((a, b) => b.marketShare - a.marketShare);
    bar.innerHTML = sorted.map((p, i) => 
        `<div style="width: ${Math.max(p.marketShare, 2)}%; background: ${colors[i % colors.length]}; height: 100%;">
            ${p.marketShare > 8 ? p.name.substring(0, 8) : ''}
        </div>`
    ).join('');
    
    document.getElementById('marketLegend').innerHTML = sorted.map((p, i) => 
        `<span class="market-legend-item">
            <span class="market-legend-color" style="background: ${colors[i % colors.length]}"></span>
            ${p.name} (${p.companyName}): ${formatPct(p.marketShare)}
        </span>`
    ).join('');
}

function updateLeaderboard(players) {
    if (!players?.length) return;
    
    const sorted = [...players].sort((a, b) => {
        const aT = (a.history || []).reduce((s, h) => s + h.profit, 0);
        const bT = (b.history || []).reduce((s, h) => s + h.profit, 0);
        return bT - aT;
    });
    
    document.getElementById('leaderboardBody').innerHTML = sorted.map((p, i) => {
        const total = (p.history || []).reduce((s, h) => s + h.profit, 0);
        const avg = (p.history || []).length ? (p.history || []).reduce((s, h) => s + h.marketShare, 0) / p.history.length : 0;
        const isMe = p.id === socket.id;
        return `
            <tr class="${isMe ? 'current-player' : ''}">
                <td class="rank-${i + 1}">${i + 1}</td>
                <td>
                    <div class="leader-name">${p.name}</div>
                    <div class="leader-company">${p.companyName}</div>
                </td>
                <td style="color: ${total >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatMoney(total)}</td>
                <td>${formatPct(avg)}</td>
            </tr>
        `;
    }).join('');
}

function updateResultsTable(players) {
    if (!players?.length) return;
    
    const sorted = [...players].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
    
    document.getElementById('resultsBody').innerHTML = sorted.map((p, i) => `
        <tr>
            <td class="rank-${i + 1}">${i + 1}</td>
            <td>
                <div class="leader-name">${p.name}</div>
                <div class="leader-company">${p.companyName}</div>
            </td>
            <td>${formatMoney(p.revenue || 0)}</td>
            <td style="color: ${(p.profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatMoney(p.profit || 0)}</td>
            <td>${formatPct(p.marketShare)}</td>
        </tr>
    `).join('');
}

function showEndScreen(players, winner) {
    showScreen('endScreen');
    
    document.getElementById('winnerName').textContent = winner.name;
    document.getElementById('winnerCompany').textContent = winner.companyName;
    document.getElementById('winnerStats').innerHTML = `
        Total Profit: ${formatMoney(winner.history.reduce((s, h) => s + h.profit, 0))} | 
        Final Cash: ${formatMoney(winner.cash)}
    `;
    
    const sorted = [...players].sort((a, b) => {
        const aT = (a.history || []).reduce((s, h) => s + h.profit, 0);
        const bT = (b.history || []).reduce((s, h) => s + h.profit, 0);
        return bT - aT;
    });
    
    document.getElementById('finalBody').innerHTML = sorted.map((p, i) => {
        const total = (p.history || []).reduce((s, h) => s + h.profit, 0);
        const avg = (p.history || []).length ? (p.history || []).reduce((s, h) => s + h.marketShare, 0) / p.history.length : 0;
        return `
            <tr>
                <td class="rank-${i + 1}">${i + 1}</td>
                <td>
                    <div class="leader-name"><strong>${p.name}</strong></div>
                    <div class="leader-company">${p.companyName}</div>
                </td>
                <td>${formatMoney(p.history.reduce((s, h) => s + h.revenue, 0))}</td>
                <td style="color: ${p.cash >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatMoney(p.cash)}</td>
                <td>${formatPct(avg)}</td>
            </tr>
        `;
    }).join('');
}

function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#gameScreen .card').forEach(c => c.style.display = 'none');
    event.target.classList.add('active');
    document.getElementById(name + 'Tab').style.display = 'block';
}

// Socket events
socket.on('playerJoined', (players) => {
    updateWaitingRoom(players);
});

socket.on('playerLeft', (players) => {
    notify('A player left', 'info');
    updateWaitingRoom(players);
});

socket.on('decisionsUpdated', ({ submitted, total }) => {
    notify(`${submitted}/${total} submitted`, 'info');
    const msg = document.querySelector('#waitingScreen .waiting-text');
    if (msg) msg.textContent = `${submitted}/${total} players submitted. Waiting for admin...`;
});

socket.on('gameStarted', (data) => {
    currentGame = { ...currentGame, status: 'playing', ...data };
    showScreen('gameScreen');
    updateGameUI(currentGame);
    notify('Game Started!', 'success');
});

socket.on('quarterResults', (data) => {
    currentGame = { ...currentGame, ...data };
    updateGameUI(currentGame);
    showScreen('gameScreen');
    notify(`Quarter ${data.quarter} Results Ready!`, 'success');
    
    const btn = document.getElementById('submitBtn');
    btn.textContent = 'Submit Decisions';
    btn.disabled = false;
});

socket.on('gameEnded', (data) => {
    clearSession();
    showEndScreen(data.players, data.winner);
});

socket.on('roomDeleted', () => {
    notify('Room deleted by admin', 'error');
    clearSession();
    showScreen('joinScreen');
});

socket.on('playerKicked', ({ player, players }) => {
    if (player.id === socket.id) {
        notify('You were kicked', 'error');
        clearSession();
        showScreen('joinScreen');
    } else {
        notify(`${player.name} was kicked`, 'info');
        if (currentGame?.status === 'waiting') {
            updateWaitingRoom(players);
        }
    }
});

socket.on('config', (cfg) => {
    window.config = cfg;
});

// Keep clients in sync when config changes from admin
socket.on('configUpdated', (cfg) => {
    window.config = cfg;
    // refresh UI elements that depend on config when not in a specific game
    try {
        if (currentGame && document.getElementById('playerCount')) {
            updateWaitingRoom(currentGame.players);
        }
        if (currentGame && document.getElementById('quarterDisplay')) {
            updateGameUI(currentGame);
        }
    } catch (e) { /* ignore UI update errors */ }
});

function exportMyReport() {
    if (!currentGame || !currentPlayer) {
        notify('No game data available', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(30, 60, 100);
    doc.text('My BizSim Performance Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Room: ${roomCode}`, 105, 30, { align: 'center' });
    
    // Player Info
    const me = currentGame.players.find(p => p.id === socket.id);
    if (!me) return;
    
    const isWinner = me.name === currentGame.winner?.name;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`Player: ${me.name}`, 20, 45);
    doc.text(`Company: ${me.companyName}`, 20, 53);
    
    if (isWinner) {
        doc.setFontSize(16);
        doc.setTextColor(255, 215, 0);
        doc.text('🏆 YOU WON!', 105, 65, { align: 'center' });
    }
    
    // Summary
    doc.setFontSize(12);
    doc.setTextColor(0);
    const totalProfit = me.history.reduce((s, h) => s + h.profit, 0);
    const avgShare = me.history.length ? me.history.reduce((s, h) => s + h.marketShare, 0) / me.history.length : 0;
    
    doc.text(`Final Cash: ${formatMoney(me.cash)}`, 20, 80);
    doc.text(`Total Profit: ${formatMoney(totalProfit)}`, 20, 88);
    doc.text(`Average Market Share: ${formatPct(avgShare)}`, 20, 96);
    doc.text(`Rank: #${currentGame.players.sort((a, b) => {
        const aT = a.history.reduce((s, h) => s + h.profit, 0);
        const bT = b.history.reduce((s, h) => s + h.profit, 0);
        return bT - aT;
    }).findIndex(p => p.id === me.id) + 1}`, 20, 104);
    
    // Quarterly Table
    if (me.history && me.history.length > 0) {
        const qData = me.history.map(h => [
            `Q${h.quarter}`,
            formatMoney(h.revenue),
            formatMoney(h.profit),
            formatPct(h.marketShare)
        ]);
        
        doc.autoTable({
            startY: 115,
            head: [['Quarter', 'Revenue', 'Profit', 'Market Share']],
            body: qData,
            theme: 'grid',
            headStyles: { fillColor: [30, 60, 100] }
        });
    }
    
    // Decisions
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(30, 60, 100);
    doc.text('My Decisions Each Quarter', 20, 20);
    
    me.history.forEach((h, i) => {
        if (h.decisions) {
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.text(`Quarter ${h.quarter}:`, 20, 35 + i * 45);
            doc.text(`Price: $${h.decisions.price} | Marketing: $${h.decisions.marketingBudget} | Research: $${h.decisions.researchBudget}`, 25, 42 + i * 45);
            doc.text(`Quality: $${h.decisions.qualityInvestment} | Distribution: ${h.decisions.distribution} channels`, 25, 49 + i * 45);
        }
    });
    
    doc.save(`MyBizSim_Report_${roomCode}.pdf`);
    notify('Report downloaded!', 'success');
}

initTheme();
tryReconnect();
