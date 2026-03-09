# BizSim - Business Simulator

## Project Overview

BizSim is a multiplayer business strategy game where players run virtual companies and compete against each other. Each player makes business decisions every "quarter" (round) - like setting prices, spending on marketing, improving product quality, etc. The goal is to make the most profit and have the highest market share by the end of the game.

---

## The 6 Steps of Design Thinking (How This Game Was Built)

### Step 1: Empathize - Understanding the User

**What this means:** Before building anything, the creator asked - who will play this game and what do they want?

**In this project:**
- The game is meant for students, teams, or anyone who wants to learn how businesses work
- Players need to understand real business concepts without getting a business degree
- The game should be fun and competitive, not boring like a textbook
- Users wanted something they could play with friends or coworkers
- People needed a way to see their performance history

The creator thought about regular people - maybe a college student, a team lead at work, or someone curious about business. These people don't know complex business formulas but want to understand how pricing, marketing, and quality affect a company's success.

---

### Step 2: Define - Pinpointing the Problem

**What this means:** Clearly state what problem the project solves.

**In this project:**
- Business education is often too theoretical and hard to understand
- There's no fun, hands-on way to learn business decision-making
- Traditional learning doesn't show how different business choices affect outcomes
- People need a safe space to experiment with business strategies without losing real money
- Multiplayer competition makes learning more engaging

**The core problem solved:** How do we teach business basics in a way that's fun, interactive, and shows real consequences of decisions?

---

### Step 3: Ideate - Coming Up with Solutions

**What this means:** Brainstorm different ways to solve the problem.

**In this project, the creator thought of:**

- **Player Interface:** Simple sliders and inputs for decisions (price, marketing budget, research, quality, distribution channels)
- **Game Flow:** Players join a room → wait for others → make decisions each quarter → see results → repeat for 12 quarters
- **Business Logic:** How to calculate revenue based on choices - price affects demand, marketing brings customers, quality keeps them happy
- **Admin Panel:** Someone needs to control the game - create rooms, start games, move to next quarter
- **Results Display:** Leaderboards, market share charts, profit/loss statements
- **Reports:** Ability to download performance as PDF

The creator picked the best ideas and combined them into one system. They used web technologies (HTML, JavaScript, Node.js) because everyone has a browser - no installation needed.

---

### Step 4: Prototype - Building a Model

**What this means:** Create a basic working version to see if the idea works.

**In this project:**
- Built a simple web page where players can enter a room code and name
- Created the core game loop: join → decide → submit → see results
- Added basic business math: price × demand - costs = profit
- Made a waiting room so players can see who's joined
- Created admin controls to start and manage games
- Added visual elements: progress bars for market share, tables for rankings

The first version had just the basics. It worked - players could join, make choices, and see who won. This proved the concept was sound.

---

### Step 5: Test - Checking If It Works

**What this means:** Try it out with real people and see what needs improvement.

**In this project:**
- Tested if the business calculations made sense (did high prices really reduce sales?)
- Checked if the game was fair (did all players have equal chances?)
- Verified the admin could control rooms properly
- Tested what happens if someone disconnects mid-game
- Made sure multiple people could play at the same time
- Checked if reports showed correct numbers
- Tested both dark and light themes for different preferences

Based on testing, they added:
- Reconnection feature so players don't lose progress if they accidentally close the browser
- Better error messages when something goes wrong
- PDF reports so players can keep a record of their performance
- Kicking players feature for admin to manage troublemakers

---

### Step 6: Implement - Putting It Into Action

**What this means:** Finalize the product and make it ready for use.

**In this project:**
- **Complete Features:**
  - Player login with room codes
  - 5 business decisions per quarter (price, marketing, research, quality, distribution)
  - Real-time market share visualization
  - Leaderboards and quarterly results
  - Full admin panel for game management
  - PDF report generation for individuals and full games
  - Game history tracking
  - Dark and light themes

- **Technical Implementation:**
  - Server: Node.js with Express and Socket.io for real-time communication
  - Client: Plain HTML/CSS/JavaScript (no complex frameworks needed)
  - Data storage: Simple JSON files for games and history
  - Config: Editable settings for max players, quarters, starting cash

- **How to Run:**
  - Install: `npm install`
  - Start server: `node server.js`
  - Open player page: `http://localhost:3000`
  - Open admin page: `http://localhost:3000/admin.html`
  - Default admin login: username `admin`, password `admin123`

---

## Game Features Summary

| Feature | Description |
|---------|-------------|
| **Multiplayer** | Up to 10 players per room |
| **Decisions** | 5 choices per quarter: Price, Marketing, Research, Quality, Distribution |
| **Duration** | Configurable quarters (default 12) |
| **Visuals** | Market share bars, leaderboards, profit charts |
| **Reports** | Downloadable PDF performance reports |
| **Themes** | Dark and light mode |
| **Admin** | Full control panel for managing rooms and games |

---

## How Business Results Are Calculated

The game uses simplified but realistic business math:

1. **Demand** = Base market demand × Price factor × Marketing effect × Quality effect × Distribution effect × Economic condition
2. **Revenue** = Demand × Price per unit
3. **Profit** = Revenue - (Marketing + Research + Quality + Distribution costs)
4. **Market Share** = Your demand ÷ Total demand from all companies

This teaches players that:
- Lower prices can increase demand but reduce profit margin
- More marketing brings more customers
- Better quality commands higher prices
- More distribution channels reach more customers
- Economic conditions change each quarter (sometimes boom, sometimes bust)

---

## Quick Start Guide

1. **Admin creates a room** from the admin panel
2. **Players join** using the room code
3. **Admin starts the game** when ready
4. **Each quarter:**
   - Players make their 5 decisions using sliders
   - Players submit when ready
   - Admin clicks "Next Round" when everyone submits
   - Results are shown to all players
5. **After all quarters** - winner is announced, final rankings shown
6. **Players download** their PDF reports

---

*This documentation explains the BizSim project using simple, everyday language. The game is designed to teach business concepts through hands-on play rather than boring lectures.*
