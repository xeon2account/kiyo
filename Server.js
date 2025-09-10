require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Debug logging
console.log('Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', PORT);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Check if public directory exists
const publicPath = path.join(__dirname, 'public');
console.log('Public directory path:', publicPath);
console.log('Public directory exists:', fs.existsSync(publicPath));

if (fs.existsSync(publicPath)) {
  const files = fs.readdirSync(publicPath);
  console.log('Files in public:', files);
  app.use(express.static(publicPath));
} else {
  console.error('PUBLIC DIRECTORY NOT FOUND!');
}

// Create uploads directory
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}
app.use('/uploads', express.static('uploads'));

// MongoDB connection (optional for basic functionality)
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'mongodb://localhost:27017/videoupload') {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('MongoDB connected successfully');
    } else {
      console.log('No MongoDB URI provided, running without database');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Running without database connection');
  }
};

connectDB();

// Video Schema (only if MongoDB is connected)
let Video = null;
if (mongoose.connection.readyState === 1) {
  const videoSchema = new mongoose.Schema({
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: { type: Date, default: Date.now },
    description: String
  });
  Video = mongoose.model('Video', videoSchema);
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    publicExists: fs.existsSync(publicPath),
    publicPath: publicPath,
    files: fs.existsSync(publicPath) ? fs.readdirSync(publicPath) : []
  });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Main route
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Debug Information</h1>
      <p><strong>Error:</strong> index.html not found</p>
      <p><strong>Looking for:</strong> ${indexPath}</p>
      <p><strong>Current directory:</strong> ${__dirname}</p>
      <p><strong>Public directory exists:</strong> ${fs.existsSync(publicPath)}</p>
      <p><strong>Files in root:</strong> ${fs.readdirSync(__dirname).join(', ')}</p>
      ${fs.existsSync(publicPath) ? `<p><strong>Files in public:</strong> ${fs.readdirSync(publicPath).join(', ')}</p>` : '<p><strong>Public directory not found!</strong></p>'}
      <hr>
      <p>Try visiting <a href="/health">/health</a> or <a href="/test">/test</a></p>
    `);
  }
});

// Upload route
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Only save to database if available
    let videoId = null;
    if (Video && mongoose.connection.readyState === 1) {
      try {
        const video = new Video({
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          description: req.body.description || ''
        });
        const savedVideo = await video.save();
        videoId = savedVideo._id;
      } catch (dbError) {
        console.error('Database save error:', dbError);
      }
    }

    res.json({
      message: 'Video uploaded successfully!',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      videoId: videoId
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed: ' + error.message });
  }
});

// Get videos route
app.get('/videos', async (req, res) => {
  try {
    if (!Video || mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const videos = await Video.find().sort({ uploadDate: -1 });
    res.json(videos);
  } catch (error) {
    console.error('Database error:', error);
    res.json([]);
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error middleware caught:', error);
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// 404 handler (must be last)
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.originalUrl);
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: ['/', '/health', '/test', '/upload', '/videos']
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Public directory: ${fs.existsSync(publicPath) ? '✅ Found' : '❌ Missing'}`);
  console.log(`🗄️  Database: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
  process.exit(0);
});
