const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB connection (optional - for storing video metadata)
mongoose.connect('mongodb://localhost:27017/videoupload', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Video Schema
const videoSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  uploadDate: { type: Date, default: Date.now },
  description: String
});

const Video = mongoose.model('Video', videoSchema);

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept video files only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: fileFilter
});

// Routes

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload video endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    // Save video metadata to database
    const video = new Video({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      description: req.body.description || ''
    });

    await video.save();

    res.json({
      message: 'Video uploaded successfully!',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      videoId: video._id
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get all videos
app.get('/videos', async (req, res) => {
  try {
    const videos = await Video.find().sort({ uploadDate: -1 });
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// Get specific video
app.get('/video/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json(video);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Delete video
app.delete('/video/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, 'uploads', video.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await Video.findByIdAndDelete(req.params.id);

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
