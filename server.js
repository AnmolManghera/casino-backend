const express = require('express');
const Redis = require('ioredis');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv').config();


const app = express();
const server = require('http').createServer(app);
const io = socketIo(server, {
  cors: {
    origin: `${process.env.FRONTEND_URL}`, 
    methods: ['GET', 'POST'],
  },
});

// Redis client
const redisClient = new Redis({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Middleware
app.use(cors({ origin: `${process.env.FRONTEND_URL}` }));   
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

const users = [
  { id: 1, username: 'user1', password: 'password1' },
  { id: 2, username: 'user2', password: 'password2' },
  { id: 3, username: 'user3', password: 'password3' },
  { id: 4, username: 'user4', password: 'password4' },
  { id: 5, username: 'user5', password: 'password5' },
  { id: 6, username: 'user6', password: 'password6' },
  { id: 7, username: 'user7', password: 'password7' },
  { id: 8, username: 'user8', password: 'password8' },
  { id: 9, username: 'user9', password: 'password9' },
  { id: 10, username: 'user10', password: 'password10' },
  { id: 11, username: 'user11', password: 'password11' },
  { id: 12, username: 'user12', password: 'password12' },
  { id: 13, username: 'user13', password: 'password13' },
  { id: 14, username: 'user14', password: 'password14' },
  { id: 15, username: 'user15', password: 'password15' },
  { id: 16, username: 'user16', password: 'password16' },
  { id: 17, username: 'user17', password: 'password17' },
  { id: 18, username: 'user18', password: 'password18' },
  { id: 19, username: 'user19', password: 'password19' },
  { id: 20, username: 'user20', password: 'password20' }
];


app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  
  try {
    const userScore = await redisClient.zscore('leaderboard', username);
    if (userScore === null) {
      await redisClient.zadd('leaderboard', 0, username);
    }
  } catch (err) {
    console.error('Error initializing user score:', err);
  }

  const token = jwt.sign({ username: user.username }, JWT_SECRET, {
    expiresIn: '1h',
  });
  res.json({ token });
});

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    req.user = decoded;
    next();
  });
};


io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});


app.post('/increment-score', authenticate, async (req, res) => {
  const { username } = req.user;
  const { increment } = req.body; 
  
  try {
    
    const scoreIncrement = parseInt(increment);
    await redisClient.zincrby('leaderboard', scoreIncrement, username);

    
    const leaderboard = await redisClient.zrevrange('leaderboard', 0, -1, 'WITHSCORES');
    const formattedLeaderboard = [];
    
    for (let i = 0; i < leaderboard.length; i += 2) {
      formattedLeaderboard.push({
        username: leaderboard[i],
        score: parseFloat(leaderboard[i + 1]),
        rank: Math.floor(i/2) + 1
      });
    }

    io.emit('leaderboard-update', { leaderboard: formattedLeaderboard });

    res.json({ 
      message: 'Score updated',
      leaderboard: formattedLeaderboard
    });
  } catch (err) {
    console.error('Error updating score:', err);
    res.status(500).json({ message: 'Error updating score' });
  }
});


app.get('/leaderboard', async (req, res) => {
  try {
    const result = await redisClient.zrevrange('leaderboard', 0, 9, 'WITHSCORES');
    const leaderboard = [];
    for (let i = 0; i < result.length; i += 2) {
      leaderboard.push({ username: result[i], score: parseFloat(result[i + 1]) });
    }
    res.json(leaderboard);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});


app.get('/user-rank', authenticate, async (req, res) => {
  const { username } = req.user;
  try {
    const rank = await redisClient.zrevrank('leaderboard', username);
    res.json({ username, rank: rank + 1 });
  } catch (err) {
    console.error('Error fetching rank:', err);
    res.status(500).json({ message: 'Error fetching rank' });
  }
});


const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});