document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');
    const uploadResult = document.getElementById('uploadResult');
    const videosList = document.getElementById('videosList');

    // Load videos on page load
    loadVideos();

    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData();
        const videoFile = document.getElementById('video').files[0];
        const description = document.getElementById('description').value;

        if (!videoFile) {
            showResult('Please select a video file', 'error');
            return;
        }

        formData.append('video', videoFile);
        formData.append('description', description);

        // Show progress
        progressContainer.style.display = 'block';
        uploadResult.style.display = 'none';

        try {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = percentComplete + '%';
                }
            });

            xhr.onload = function() {
                progressContainer.style.display = 'none';
                
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    showResult(`Video uploaded successfully: ${response.originalName}`, 'success');
                    uploadForm.reset();
                    loadVideos(); // Refresh video list
                } else {
                    const error = JSON.parse(xhr.responseText);
                    showResult(`Upload failed: ${error.error}`, 'error');
                }
            };

            xhr.onerror = function() {
                progressContainer.style.display = 'none';
                showResult('Upload failed: Network error', 'error');
            };

            xhr.open('POST', '/upload');
            xhr.send(formData);

        } catch (error) {
            progressContainer.style.display = 'none';
            showResult(`Upload failed: ${error.message}`, 'error');
        }
    });

    function showResult(message, type) {
        uploadResult.textContent = message;
        uploadResult.className = type;
        uploadResult.style.display = 'block';
        
        setTimeout(() => {
            uploadResult.style.display = 'none';
        }, 5000);
    }

    async function loadVideos() {
        try {
            const response = await fetch('/videos');
            const videos = await response.json();
            
            if (videos.length === 0) {
                videosList.innerHTML = '<p>No videos uploaded yet.</p>';
                return;
            }

            videosList.innerHTML = videos.map(video => `
                <div class="video-item" data-id="${video._id}">
                    <div class="video-info">
                        <div class="video-details">
                            <h3>${video.originalName}</h3>
                            <div class="video-meta">
                                <p>Size: ${formatFileSize(video.size)}</p>
                                <p>Uploaded: ${new Date(video.uploadDate).toLocaleDateString()}</p>
                                ${video.description ? `<p>Description: ${video.description}</p>` : ''}
                            </div>
                        </div>
                        <div class="video-actions">
                            <button class="btn-sm btn-danger" onclick="deleteVideo('${video._id}')">Delete</button>
                        </div>
                    </div>
                    <video controls>
                        <source src="/uploads/${video.filename}" type="${video.mimetype}">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load videos:', error);
            videosList.innerHTML = '<p>Failed to load videos.</p>';
        }
    }

    // Make deleteVideo function global
    window.deleteVideo = async function(videoId) {
        if (!confirm('Are you sure you want to delete this video?')) {
            return;
        }

        try {
            const response = await fetch(`/video/${videoId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showResult('Video deleted successfully', 'success');
                loadVideos(); // Refresh video list
            } else {
                const error = await response.json();
                showResult(`Delete failed: ${error.error}`, 'error');
            }
        } catch (error) {
            showResult(`Delete failed: ${error.message}`, 'error');
        }
    };

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
