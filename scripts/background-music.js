/**
 * Background Music Controller
 * Plays quiet classical music in the background with mute toggle
 */

const BackgroundMusic = {
    // YouTube video ID for peaceful classical piano (3+ hours)
    // Using embedded YouTube player for reliable streaming
    youtubeVideoId: '4Tr0otuiQuU',
    
    player: null,
    isMuted: true, // Start muted due to browser autoplay policies
    isReady: false,
    
    init() {
        // Load saved preference
        const savedMute = localStorage.getItem('bgMusicMuted');
        this.isMuted = savedMute !== 'false'; // Default to muted
        
        // Create mute button in top bar
        this.createMuteButton();
        
        // Load YouTube IFrame API
        this.loadYouTubeAPI();
    },
    
    loadYouTubeAPI() {
        // Create script tag for YouTube API
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        // YouTube API will call onYouTubeIframeAPIReady when ready
        window.onYouTubeIframeAPIReady = () => this.createPlayer();
    },
    
    createPlayer() {
        // Create hidden container for YouTube player
        const container = document.createElement('div');
        container.id = 'bgMusicPlayer';
        container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
        document.body.appendChild(container);
        
        // Initialize YouTube player
        this.player = new YT.Player('bgMusicPlayer', {
            height: '1',
            width: '1',
            videoId: this.youtubeVideoId,
            playerVars: {
                autoplay: 1,
                loop: 1,
                playlist: this.youtubeVideoId, // Required for looping
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                rel: 0
            },
            events: {
                onReady: (event) => this.onPlayerReady(event),
                onStateChange: (event) => this.onPlayerStateChange(event),
                onError: (event) => this.onPlayerError(event)
            }
        });
    },
    
    onPlayerReady(event) {
        this.isReady = true;
        // Set volume to a comfortable background level (0-100)
        this.player.setVolume(25);
        
        // Apply saved mute state
        if (this.isMuted) {
            this.player.mute();
        } else {
            this.player.unMute();
        }
        
        this.updateButtonState();
        console.log('🎵 Background music ready');
    },
    
    onPlayerStateChange(event) {
        // If video ends, restart it (backup for loop)
        if (event.data === YT.PlayerState.ENDED) {
            this.player.playVideo();
        }
    },
    
    onPlayerError(event) {
        console.warn('Background music error:', event.data);
        // Update button to show error state
        const btn = document.getElementById('bgMusicBtn');
        if (btn) {
            btn.title = 'Music unavailable';
            btn.style.opacity = '0.5';
        }
    },
    
    createMuteButton() {
        // Create button element
        const btn = document.createElement('button');
        btn.id = 'bgMusicBtn';
        btn.className = 'bg-music-btn';
        btn.title = this.isMuted ? 'Unmute background music' : 'Mute background music';
        btn.innerHTML = this.getMuteIcon();
        btn.onclick = () => this.toggleMute();
        
        // Add styles
        this.addStyles();
        
        // Insert before theme selector in top bar
        const themeSelector = document.querySelector('.theme-selector');
        if (themeSelector) {
            themeSelector.parentNode.insertBefore(btn, themeSelector);
        }
    },
    
    getMuteIcon() {
        if (this.isMuted) {
            // Muted icon (speaker with X)
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>`;
        } else {
            // Unmuted icon (speaker with waves)
            return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>`;
        }
    },
    
    toggleMute() {
        if (!this.isReady) {
            console.log('Player not ready yet');
            return;
        }
        
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.player.mute();
        } else {
            this.player.unMute();
            // Ensure video is playing when unmuting
            if (this.player.getPlayerState() !== YT.PlayerState.PLAYING) {
                this.player.playVideo();
            }
        }
        
        // Save preference
        localStorage.setItem('bgMusicMuted', this.isMuted);
        
        this.updateButtonState();
    },
    
    updateButtonState() {
        const btn = document.getElementById('bgMusicBtn');
        if (btn) {
            btn.innerHTML = this.getMuteIcon();
            btn.title = this.isMuted ? 'Unmute background music' : 'Mute background music';
            btn.classList.toggle('unmuted', !this.isMuted);
        }
    },
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .bg-music-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 36px;
                height: 36px;
                border: none;
                border-radius: 8px;
                background: rgba(255, 255, 255, 0.1);
                color: var(--text-secondary, #8b949e);
                cursor: pointer;
                transition: all 0.2s ease;
                margin-right: 12px;
            }
            
            .bg-music-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                color: var(--text-primary, #e6edf3);
            }
            
            .bg-music-btn.unmuted {
                background: rgba(46, 160, 67, 0.2);
                color: #3fb950;
            }
            
            .bg-music-btn.unmuted:hover {
                background: rgba(46, 160, 67, 0.3);
            }
            
            .bg-music-btn svg {
                flex-shrink: 0;
            }
        `;
        document.head.appendChild(style);
    },
    
    // Public methods for external control
    setVolume(level) {
        if (this.isReady && this.player) {
            this.player.setVolume(Math.max(0, Math.min(100, level)));
        }
    },
    
    mute() {
        if (!this.isMuted) {
            this.toggleMute();
        }
    },
    
    unmute() {
        if (this.isMuted) {
            this.toggleMute();
        }
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BackgroundMusic.init());
} else {
    BackgroundMusic.init();
}
