class SpeechManager {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isRecording = false;
        this.isSupported = this.checkSupport();
        this.stopTimer = null; // 1.5秒猶予時間用のタイマー
        this.settings = {
            rate: 1,
            volume: 1,
            lang: 'en-US'
        };
        
        this.initRecognition();
        this.loadSettings();
    }

    checkSupport() {
        const hasRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const hasSynthesis = 'speechSynthesis' in window;
        
        if (!hasRecognition || !hasSynthesis) {
            console.warn('Web Speech API is not fully supported');
            return false;
        }
        return true;
    }

    initRecognition() {
        if (!this.isSupported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.onRecordingStart?.();
        };

        this.recognition.onresult = (event) => {
            // 既存のタイマーをクリア
            if (this.stopTimer) {
                clearTimeout(this.stopTimer);
                this.stopTimer = null;
            }
            
            const transcript = event.results[0][0].transcript;
            
            // 1.5秒後に自動停止するタイマーを設定
            this.stopTimer = setTimeout(() => {
                this.stopRecognition();
            }, 1500);
            
            this.onRecognitionResult?.(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            // タイマーをクリア
            if (this.stopTimer) {
                clearTimeout(this.stopTimer);
                this.stopTimer = null;
            }
            
            this.isRecording = false;
            this.onRecognitionError?.(event.error);
        };

        this.recognition.onend = () => {
            // タイマーをクリア
            if (this.stopTimer) {
                clearTimeout(this.stopTimer);
                this.stopTimer = null;
            }
            
            this.isRecording = false;
            this.onRecordingEnd?.();
        };
    }

    startRecognition() {
        if (!this.isSupported || this.isRecording) {
            return false;
        }

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.onRecognitionError?.('start_failed');
            return false;
        }
    }

    stopRecognition() {
        // タイマーをクリア
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    waitForRecordingToEnd() {
        return new Promise((resolve) => {
            // 既に録音が終了している場合は即座に解決
            if (!this.isRecording) {
                resolve();
                return;
            }
            
            // 録音終了を待つリスナーを一時的に設定
            const originalOnEnd = this.onRecordingEnd;
            this.onRecordingEnd = () => {
                // 元のコールバックを実行
                if (originalOnEnd) {
                    originalOnEnd();
                }
                // 元に戻す
                this.onRecordingEnd = originalOnEnd;
                // Promise解決
                resolve();
            };
        });
    }

    speak(text, options = {}) {
        if (!this.isSupported || !text) {
            return Promise.reject('Speech synthesis not supported or no text provided');
        }

        return new Promise((resolve, reject) => {
            if (this.synthesis.speaking) {
                this.synthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            
            utterance.lang = options.lang || this.settings.lang;
            utterance.rate = options.rate || this.settings.rate;
            utterance.volume = options.volume || this.settings.volume;
            utterance.pitch = options.pitch || 1;

            utterance.onend = () => {
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                reject(event.error);
            };

            utterance.onstart = () => {
                this.onSpeechStart?.();
            };

            this.synthesis.speak(utterance);
        });
    }

    stopSpeaking() {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();
    }

    saveSettings() {
        try {
            localStorage.setItem('speechSettings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Failed to save speech settings:', error);
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('speechSettings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('Failed to load speech settings:', error);
        }
    }

    getAvailableVoices() {
        return this.synthesis.getVoices().filter(voice => 
            voice.lang.startsWith('en')
        );
    }

    setCallbacks(callbacks) {
        this.onRecordingStart = callbacks.onRecordingStart;
        this.onRecordingEnd = callbacks.onRecordingEnd;
        this.onRecognitionResult = callbacks.onRecognitionResult;
        this.onRecognitionError = callbacks.onRecognitionError;
        this.onSpeechStart = callbacks.onSpeechStart;
    }
}

function initSpeechManager() {
    const speechManager = new SpeechManager();
    
    if (!speechManager.isSupported) {
        showError('お使いのブラウザはWeb Speech APIに対応していません。Chrome、Safari、Edgeの最新版をお使いください。');
        return null;
    }

    speechManager.setCallbacks({
        onRecordingStart: () => {
            const voiceBtn = document.getElementById('voice-btn');
            if (voiceBtn) {
                voiceBtn.classList.add('recording');
                voiceBtn.querySelector('.voice-text').textContent = '録音中...';
            }
        },
        
        onRecordingEnd: () => {
            const voiceBtn = document.getElementById('voice-btn');
            if (voiceBtn) {
                voiceBtn.classList.remove('recording');
                voiceBtn.querySelector('.voice-text').textContent = '話す';
            }
        },
        
        onRecognitionResult: (transcript) => {
            console.log('Recognition result:', transcript);
            window.appManager?.handleUserSpeech(transcript);
        },
        
        onRecognitionError: (error) => {
            console.error('Recognition error:', error);
            let errorMessage = '音声認識でエラーが発生しました。';
            
            switch (error) {
                case 'network':
                    errorMessage = 'ネットワークエラーが発生しました。接続を確認してください。';
                    break;
                case 'not-allowed':
                    errorMessage = 'マイクの使用が許可されていません。ブラウザの設定を確認してください。';
                    break;
                case 'no-speech':
                    errorMessage = '音声が検出されませんでした。もう一度お試しください。';
                    break;
                case 'start_failed':
                    errorMessage = '音声認識を開始できませんでした。ページを再読み込みしてください。';
                    break;
            }
            
            showError(errorMessage);
        },
        
        onSpeechStart: () => {
            console.log('Speech synthesis started');
        }
    });

    return speechManager;
}

window.SpeechManager = SpeechManager;
window.initSpeechManager = initSpeechManager;