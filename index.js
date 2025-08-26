const express = require("express")
const path = require("path")
const http = require("http")
const {Server} = require("socket.io")
const crypto = require("crypto")
const fs = require("fs")
const fetch = require("node-fetch")

const { OAuth2Client } = require("google-auth-library");

// CommonJS require syntax
const dotenv = require("dotenv");

// Load .env variables
dotenv.config();

const app = express()
const PORT = process.env.PORT || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ohsecret"

app.use(express.json())

// Serve React frontend
app.use(express.static(path.join(__dirname, "oh-client", "dist")))

// HTTP server + Socket.IO
const server = http.createServer(app)
const io = new Server(server)

//Initialize the queue
let queue = [];
QUEUE_FILE="./queue.json"

// Load queue if file exists
if (fs.existsSync(QUEUE_FILE)) {
  const data = fs.readFileSync(QUEUE_FILE, "utf-8");
  try {
    queue = JSON.parse(data);
    console.log("Loaded queue from file:", queue);
  } catch (err) {
    console.error("Error parsing queue.json:", err);
  }
}

//Utility for saving queue
function saveQueue() {
    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), "utf-8");
      console.log("Queue saved to queue.json");
    } catch (err) {
      console.error("Error saving queue:", err);
    }
  }

//Initialize dictionary of SocketIDs -> Students
const studentSockets = {}

//Initialize dictionary of valid tokens -> expiry dates
const validTokens = {}

// --- GOOGLE AUTHENTICATION ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const redirectUri = "https://enormous-robin-helping.ngrok-free.app/auth/callback";

const googleClient = new OAuth2Client(CLIENT_ID);

const verifyGoogleToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: CLIENT_ID, // must match your client ID
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    throw new Error("Token verification failed or email missing");
  }

  // Only allow CMU emails
  if (!payload.email.endsWith("@cmu.edu") && !payload.email.endsWith("@andrew.cmu.edu")) {
    throw new Error("Email is not a CMU address");
  }

  return payload?.email;
};

app.get("/auth/google", (req, res) => {
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&scope=email`;
  res.redirect(googleAuthUrl);
});

app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  // Extract the ID token (JWT)
  const idToken = tokenData.id_token;

  res.redirect(`/?idToken=${idToken}`);
});



// --- ADMIN LOGIN (UPDATE) ---
app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(403).json({success:true, error:"Incorrect Password"});
  
    const token = crypto.randomBytes(16).toString("hex");
    const expiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    validTokens[token] = expiry;
    res.json({success:true, token});
  });
  
  // Admin middleware
  function verifyAdmin(req, res, next) {
    const { token } = req.body;

    // If using a plain object
    if (!(token in validTokens)) {
      return res.status(401).send({success:true, error:"Invalid Token"});
    }

    // Check expiration
    if (Date.now() >= validTokens[token]) {
      return res.status(401).send({success:true, error:"Expired Token"});
    }

    // Token valid → continue
    next();
  }
  
  // --- ADMIN ENDPOINTS (UPDATE)  ---
  app.post("/api/admin/queue", verifyAdmin, (req, res) => {
    res.json({success: true, queue});
  });

  app.post("/api/admin/finish", verifyAdmin, (req,res) => {
    queue.shift()
    broadcastPositions()
    saveQueue()
    res.json({success: true, queue});
  })
  
  app.post("/api/admin/deleteByEmail", verifyAdmin, (req, res) => {
    const { email } = req.body;
    queue = queue.filter(s => s.email !== email);
  
    // Notify all affected students via socket
    broadcastPositions()
    saveQueue()
  
    res.json({ success: true, queue });
  });

  app.post("/api/admin/deleteByIndex", verifyAdmin, (req, res) => {
    const { index } = req.body;
    queue = queue.filter((_,i) => i+1 !== parseInt(index, 10))
  
    // Notify all affected students via socket
    broadcastPositions()
    saveQueue()
  
    res.json({ success: true, queue });
  });

  function broadcastPositions() {
    // Iterate over all connected socket IDs
    Object.entries(studentSockets).forEach(([socketId, student]) => {
      // Find this student's position in the queue
      const index = queue.findIndex(s => s.email === student.email);
  
      const socket = io.sockets.sockets.get(socketId); // get socket instance
      if (!socket) return; // skip if socket is disconnected
  
      if (index >= 0) {
        // Student is in the queue → send position update
        socket.emit("positionUpdate", { position: index + 1 });
      } else {
        // Student not in queue → send missing message
        socket.emit("positionUpdate", { message: "You are not currently in the queue." });
      }
    });
  }

  // --- STUDENT ENDPOINTS ---
  app.post("/api/join", async (req, res) => {
    const { name, idToken } = req.body;
    try{
      const email = await verifyGoogleToken(idToken)
      // Queue logic goes here
      if (!(queue.some(s => s.email == email))) {
        queue.push({ name, email })
        saveQueue()
        res.json({ success: true })
      }
      else {
        throw new Error("Already In Queue")
      }
    }
    catch (error) {
      console.log(error.message)
      res.json({error: error.message})
    }
  });
  
  // --- Lookup WebSocket ---
  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);
  
    // Log the connection's associated student
    socket.on("register", async ({idToken}) => {
      try {
        const email = await verifyGoogleToken(idToken)

        const student = queue.find(s => s.email === email);
        if (student) {
          studentSockets[socket.id] = student

          const index = queue.findIndex(s => s.email === email);
          const position = index >= 0 ? index + 1 : null;
          socket.emit("positionUpdate", { position });
        }
        else {
          socket.emit("positionUpdate", { message: "You are not currently in the queue." });
        }
        }
      catch (error) {
        if (error.message == "Email is not a CMU address") {
          socket.emit("positionUpdate", { message: "Out of CMU"})
          socket.disconnect()
          delete studentSockets[socket.id]
        }
        else {
          socket.emit("positionUpdate", { message: "Invalid Token"})
          socket.disconnect()
          delete studentSockets[socket.id]
        }
      }
      
    });
  
    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
      delete studentSockets[socket.id]; // remove mapping
    });
  });
  
  // Any requests that did not match the specific routes above will reach this middleware
  app.use((req, res, next) => {
    res.sendFile(path.resolve(__dirname, "oh-client", "dist", "index.html"))
  });
  
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));