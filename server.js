require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const dns = require("node:dns/promises");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

dns.setServers(["8.8.8.8", "8.8.4.4"]);

if (!process.env.MONGODB_URI || !process.env.SESSION_SECRET ||
    !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
  console.error("Missing required environment variables. Check your .env file.");
  process.exit(1);
}

mongoose.set("strictQuery", true);

const requestSchema = new mongoose.Schema({
  referenceNumber: { type: String, unique: true, index: true },
  fullName: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
  contactNumber: { type: String, required: true, trim: true, maxlength: 30 },
  address: { type: String, required: true, trim: true, maxlength: 250 },
  documentType: {
    type: String,
    required: true,
    enum: ["Barangay Clearance", "Certificate of Indigency", "Certificate of Residency", "Barangay ID", "Other"]
  },
  purpose: { type: String, required: true, trim: true, maxlength: 500 },
  notes: { type: String, trim: true, maxlength: 500, default: "" },
  status: {
    type: String,
    enum: ["Pending", "Processing", "Ready for Pickup", "Completed", "Rejected"],
    default: "Pending"
  }
}, { timestamps: true });

const Request = mongoose.model("Request", requestSchema);

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true, limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  name: "barangay.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 60 * 60 * 8
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many submissions. Please try again later." }
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ message: "Please log in as an administrator." });
}

function makeReference() {
  return "BRGY-" + Date.now().toString().slice(-8) + "-" +
    Math.floor(1000 + Math.random() * 9000);
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", database: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// Public request submission (CREATE)
app.post("/api/requests", submitLimiter, async (req, res) => {
  try {
    const { fullName, email, contactNumber, address, documentType, purpose, notes } = req.body;
    if (![fullName, email, contactNumber, address, documentType, purpose].every(v => typeof v === "string" && v.trim())) {
      return res.status(400).json({ message: "Please complete all required fields." });
    }
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!validEmail) return res.status(400).json({ message: "Please enter a valid email address." });

    const record = await Request.create({
      referenceNumber: makeReference(),
      fullName, email, contactNumber, address, documentType, purpose, notes: notes || ""
    });
    res.status(201).json({
      message: "Your request was submitted successfully.",
      referenceNumber: record.referenceNumber
    });
  } catch (error) {
    console.error("Create request error:", error);
    res.status(500).json({ message: "Unable to submit request. Please try again." });
  }
});

// Admin authentication
app.post("/api/admin/login", submitLimiter, async (req, res) => {
  const { username, password } = req.body;
  const usernameOk = typeof username === "string" && username === process.env.ADMIN_USERNAME;
  const passwordOk = typeof password === "string" && password === process.env.ADMIN_PASSWORD;
  if (!usernameOk || !passwordOk) return res.status(401).json({ message: "Incorrect username or password." });

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ message: "Could not start admin session." });
    req.session.isAdmin = true;
    res.json({ message: "Login successful." });
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Logout failed." });
    res.clearCookie("barangay.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.isAdmin) });
});

// READ all requests (admin only)
app.get("/api/requests", requireAdmin, async (req, res) => {
  try {
    const { search = "", status = "" } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(safe, "i");
      filter.$or = [
        { fullName: regex }, { email: regex },
        { referenceNumber: regex }, { documentType: regex }
      ];
    }
    const records = await Request.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    res.json(records);
  } catch (error) {
    console.error("Read requests error:", error);
    res.status(500).json({ message: "Unable to load requests." });
  }
});

// READ one request (admin only)
app.get("/api/requests/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const record = await Request.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: "Request not found." });
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Unable to load request." });
  }
});

// UPDATE request details/status (admin only)
app.put("/api/requests/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const allowed = ["fullName", "email", "contactNumber", "address", "documentType", "purpose", "notes", "status"];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];

    const record = await Request.findByIdAndUpdate(req.params.id, update, {
      new: true, runValidators: true
    });
    if (!record) return res.status(404).json({ message: "Request not found." });
    res.json({ message: "Request updated successfully.", record });
  } catch (error) {
    res.status(400).json({ message: error.message || "Unable to update request." });
  }
});

// DELETE request (admin only)
app.delete("/api/requests/:id", requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid request ID." });
    const record = await Request.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Request not found." });
    res.json({ message: "Request deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Unable to delete request." });
  }
});

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas.");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(error => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
