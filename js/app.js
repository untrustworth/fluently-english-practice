class AppManager {
    constructor() {
        this.currentScreen = 'home';
        this.selectedScenario = null;
        this.isProcessing = false;
        
        this.speechManager = null;
        this.apiManager = null;
        this.scenarioManager = null;
        this.conversationManager = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            this.registerServiceWorker();
            
            const { scenarioManager, conversationManager } = initStorageManager();
            this.scenarioManager = scenarioManager;
            this.conversationManager = conversationManager;
            
            this.apiManager = initGeminiAPI();
            this.speechManager = initSpeechManager();
            
            this.setupEventListeners();
            this.renderScenarioList();
            this.showScreen('home');
            
            console.log('App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('アプリケーションの初期化に失敗しました。ページを再読み込みしてください。');
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    setupEventListeners() {
        document.getElementById('random-conversation-btn').addEventListener('click', () => {
            this.startRandomConversation();
        });

        document.getElementById('scenario-select-btn').addEventListener('click', () => {
            this.showScreen('scenario');
        });

        document.getElementById('admin-btn').addEventListener('click', () => {
            this.showScreen('admin');
        });

        document.getElementById('scenario-back-btn').addEventListener('click', () => {
            this.showScreen('home');
        });

        document.getElementById('start-conversation-btn').addEventListener('click', () => {
            this.addCustomScenario();
        });

        document.getElementById('conversation-home-btn').addEventListener('click', () => {
            this.endConversation();
        });

        document.getElementById('voice-btn').addEventListener('click', () => {
            this.handleVoiceInput();
        });

        document.getElementById('hint-translate-btn').addEventListener('click', () => {
            this.handleHintTranslation();
        });

        document.getElementById('next-conversation-btn').addEventListener('click', () => {
            this.startNextRandomConversation();
        });

        document.getElementById('admin-back-btn').addEventListener('click', () => {
            this.showScreen('home');
        });

        document.getElementById('scenario-mgmt-btn').addEventListener('click', () => {
            this.showScreen('scenario-mgmt');
            this.renderScenarioManagement();
        });

        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showScreen('settings');
        });

        document.getElementById('scenario-mgmt-back-btn').addEventListener('click', () => {
            this.showScreen('admin');
        });

        document.getElementById('settings-back-btn').addEventListener('click', () => {
            this.showScreen('admin');
        });

        document.getElementById('save-api-key-btn').addEventListener('click', () => {
            this.saveAPIKey();
        });

        document.getElementById('delete-api-key-btn').addEventListener('click', () => {
            this.deleteAPIKey();
        });

        document.getElementById('save-scenarios-btn').addEventListener('click', () => {
            this.saveScenarios();
        });

        document.getElementById('reset-scenarios-btn').addEventListener('click', () => {
            this.resetScenarios();
        });

        document.getElementById('error-ok-btn').addEventListener('click', () => {
            this.hideError();
        });

        document.getElementById('speech-rate').addEventListener('input', (e) => {
            this.updateSpeechSettings({ rate: parseFloat(e.target.value) });
        });

        document.getElementById('speech-volume').addEventListener('input', (e) => {
            this.updateSpeechSettings({ volume: parseFloat(e.target.value) });
        });

        window.addEventListener('beforeunload', () => {
            this.conversationManager?.clearConversation();
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId + '-screen');
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            
            // 設定画面表示時にAPIキー状態を更新
            if (screenId === 'settings') {
                this.updateAPIKeyStatus();
            }
        }
    }

    renderScenarioList() {
        const presetList = document.getElementById('preset-list');
        if (!presetList) return;

        presetList.innerHTML = '';
        
        const scenarios = this.scenarioManager.getAllScenarios();
        
        scenarios.forEach(scenario => {
            const item = document.createElement('div');
            item.className = 'scenario-item';
            item.innerHTML = `
                <strong>${scenario.title}</strong>
                <p>${scenario.description}</p>
            `;
            
            item.addEventListener('click', () => {
                this.selectedScenario = scenario;
                this.startConversation();
            });
            
            presetList.appendChild(item);
        });
    }

    renderScenarioManagement() {
        const mgmtList = document.getElementById('scenario-mgmt-list');
        if (!mgmtList) return;

        mgmtList.innerHTML = '';
        
        const scenarios = this.scenarioManager.getAllScenarios();
        
        scenarios.forEach(scenario => {
            const item = document.createElement('div');
            item.className = 'scenario-mgmt-item';
            
            let statusLabel = '';
            if (scenario.isDefault && !scenario.isModifiedDefault) {
                statusLabel = '<small> (プリセット)</small>';
            } else if (scenario.isModifiedDefault) {
                statusLabel = '<small> (編集済みプリセット)</small>';
            } else {
                statusLabel = '<small> (カスタム)</small>';
            }
            
            item.innerHTML = `
                <div>
                    <strong>${scenario.title}</strong>
                    ${statusLabel}
                </div>
                <div class="scenario-mgmt-actions">
                    <button class="edit-btn" onclick="app.editScenario('${scenario.id}')">編集</button>
                    <button class="delete-btn" onclick="app.deleteScenario('${scenario.id}')">削除</button>
                </div>
            `;
            
            mgmtList.appendChild(item);
        });
    }

    startRandomConversation() {
        const randomScenario = this.scenarioManager.getRandomScenario();
        if (randomScenario) {
            this.selectedScenario = randomScenario;
            this.startConversation();
        } else {
            this.showError('利用可能なシチュエーションがありません。');
        }
    }

    startNextRandomConversation() {
        if (!this.apiManager.isConfigured()) {
            this.showError('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
            return;
        }

        // 現在の会話データをクリア
        this.conversationManager.clearConversation();
        
        // ヒント結果をクリア
        this.clearHintResult();

        // 新しいランダムシチュエーションを選択
        const randomScenario = this.scenarioManager.getRandomScenario();
        if (randomScenario) {
            this.selectedScenario = randomScenario;
            
            // シチュエーション表示を更新
            document.getElementById('current-scenario').textContent = `現在: ${this.selectedScenario.title}`;
            
            // 新しい会話を開始
            const welcomeMessage = this.conversationManager.startConversation(this.selectedScenario);
            
            // 会話ログを更新
            this.updateConversationLog();
            
            // ウェルカムメッセージを音声で再生
            this.speechManager.speak(welcomeMessage).catch(error => {
                console.error('Failed to speak welcome message:', error);
            });
            
        } else {
            this.showError('利用可能なシチュエーションがありません。');
        }
    }

    addCustomScenario() {
        const customTitle = document.getElementById('custom-title').value.trim();
        const customDescription = document.getElementById('custom-description').value.trim();
        
        if (!customTitle || !customDescription) {
            this.showError('タイトルと説明の両方を入力してください。');
            return;
        }
        
        try {
            const customScenario = this.scenarioManager.addCustomScenario(customTitle, customDescription);
            
            // 入力フィールドをクリア
            document.getElementById('custom-title').value = '';
            document.getElementById('custom-description').value = '';
            
            // 一覧を更新
            this.renderScenarioList();
            
            this.showSuccess('カスタムシチュエーションを追加しました。一覧から選択してください。');
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    startConversation() {
        if (!this.apiManager.isConfigured()) {
            this.showError('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
            return;
        }

        this.showScreen('conversation');
        
        document.getElementById('current-scenario').textContent = `現在: ${this.selectedScenario.title}`;
        
        const welcomeMessage = this.conversationManager.startConversation(this.selectedScenario);
        
        this.speechManager.speak(welcomeMessage).catch(error => {
            console.error('Failed to speak welcome message:', error);
        });
        
        this.updateConversationLog();
    }

    async handleVoiceInput() {
        if (this.isProcessing) return;

        if (!this.speechManager || !this.speechManager.isSupported) {
            this.showError('音声機能がサポートされていません。');
            return;
        }

        if (this.speechManager.isRecording) {
            this.speechManager.stopRecognition();
            return;
        }

        const started = this.speechManager.startRecognition();
        if (!started) {
            this.showError('音声認識を開始できませんでした。');
        }
    }

    async handleUserSpeech(transcript) {
        if (this.isProcessing) return;

        try {
            this.isProcessing = true;

            this.conversationManager.addMessage('user', transcript, true);

            // 会話履歴を取得してAPIに渡す
            const conversationHistory = this.conversationManager.getConversationHistory();

            const response = await this.apiManager.generateResponse(
                transcript, 
                this.selectedScenario.description,
                conversationHistory
            );

            this.conversationManager.addMessage('assistant', response.aiResponse, false);

            this.updateConversationLog();

            // 録音終了まで待機
            await this.speechManager.waitForRecordingToEnd();

            await this.speechManager.speak(response.aiResponse);

        } catch (error) {
            console.error('Conversation error:', error);
            this.showError(error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    async handleHintTranslation() {
        if (this.isProcessing) return;

        const japaneseInput = document.getElementById('hint-japanese-input');
        const japaneseText = japaneseInput.value.trim();

        if (!japaneseText) {
            this.showError('日本語のテキストを入力してください。');
            return;
        }

        if (!this.apiManager.isConfigured()) {
            this.showError('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
            return;
        }

        try {
            this.isProcessing = true;

            const currentScenario = this.conversationManager.getCurrentScenario();
            const scenarioDescription = currentScenario ? currentScenario.description : 'General customer service';

            const response = await this.apiManager.generateHint(japaneseText, scenarioDescription);

            this.showHintResult(response.englishText);

        } catch (error) {
            console.error('Hint translation error:', error);
            this.showError(error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    showHintResult(englishText) {
        const hintResult = document.getElementById('hint-result');
        const hintEnglishText = document.getElementById('hint-english-text');

        hintEnglishText.textContent = englishText;
        hintResult.classList.remove('hidden');

        // Scroll to result
        hintResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    clearHintResult() {
        const hintResult = document.getElementById('hint-result');
        const japaneseInput = document.getElementById('hint-japanese-input');
        
        hintResult.classList.add('hidden');
        japaneseInput.value = '';
    }

    updateConversationLog() {
        const logContainer = document.getElementById('conversation-log');
        if (!logContainer) return;

        logContainer.innerHTML = '';
        
        const messages = this.conversationManager.getConversationHistory();
        
        messages.forEach(message => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.innerHTML = `
                <div class="log-speaker">${message.speaker === 'user' ? '職員' : '観光客'}:</div>
                <div class="log-text">${message.text}</div>
            `;
            logContainer.appendChild(entry);
        });
        
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    endConversation() {
        this.conversationManager.clearConversation();
        this.selectedScenario = null;
        
        // Clear hint results
        this.clearHintResult();
        
        this.showScreen('home');
    }

    editScenario(scenarioId) {
        const scenario = this.scenarioManager.getScenarioById(scenarioId);
        if (!scenario) {
            this.showError('シチュエーションが見つかりません。');
            return;
        }

        const newTitle = prompt('新しいタイトルを入力してください:', scenario.title);
        if (newTitle === null) return;

        const newDescription = prompt('新しい説明を入力してください:', scenario.description);
        if (newDescription === null) return;

        try {
            this.scenarioManager.updateScenario(scenarioId, newTitle, newDescription);
            this.renderScenarioManagement();
            this.renderScenarioList();
            
            if (scenario.isDefault) {
                this.showSuccess('プリセットシチュエーションを編集しました。元に戻すには「デフォルトに戻す」機能をご利用ください。');
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    deleteScenario(scenarioId) {
        const scenario = this.scenarioManager.getScenarioById(scenarioId);
        if (!scenario) {
            this.showError('シチュエーションが見つかりません。');
            return;
        }

        let confirmMessage = `「${scenario.title}」を削除しますか？`;
        if (scenario.isDefault) {
            confirmMessage += '\n\n※ プリセットシチュエーションは非表示になりますが、「デフォルトに戻す」機能で復元できます。';
        } else {
            confirmMessage += '\n\n※ カスタムシチュエーションは完全に削除され、復元できません。';
        }

        if (confirm(confirmMessage)) {
            try {
                this.scenarioManager.deleteScenario(scenarioId);
                this.renderScenarioManagement();
                this.renderScenarioList();
                
                if (scenario.isDefault) {
                    this.showSuccess('プリセットシチュエーションを非表示にしました。「デフォルトに戻す」で復元できます。');
                } else {
                    this.showSuccess('カスタムシチュエーションを削除しました。');
                }
            } catch (error) {
                this.showError(error.message);
            }
        }
    }

    saveAPIKey() {
        const apiKeyInput = document.getElementById('api-key-input');
        const apiKey = apiKeyInput.value.trim();

        try {
            this.apiManager.saveAPIKey(apiKey);
            apiKeyInput.value = '';
            this.updateAPIKeyStatus();
            this.showSuccess('APIキーを保存しました。');
        } catch (error) {
            this.showError(error.message);
        }
    }

    deleteAPIKey() {
        if (!this.apiManager.isConfigured()) {
            this.showError('削除するAPIキーがありません。');
            return;
        }

        const confirmed = confirm(
            'APIキーを完全に削除しますか？\n\n' +
            '削除すると:\n' +
            '• LocalStorageから完全に削除されます\n' +
            '• 会話機能が使用できなくなります\n' +
            '• 再度設定が必要になります'
        );

        if (confirmed) {
            try {
                this.apiManager.deleteAPIKey();
                this.updateAPIKeyStatus();
                this.showSuccess('APIキーを完全に削除しました。');
            } catch (error) {
                this.showError(error.message);
            }
        }
    }

    updateAPIKeyStatus() {
        const statusElement = document.getElementById('api-key-status');
        const indicatorElement = document.getElementById('api-key-indicator');
        const deleteButton = document.getElementById('delete-api-key-btn');

        if (!statusElement || !indicatorElement || !deleteButton) return;

        const status = this.apiManager.getAPIKeyStatus();

        // ステータス表示の更新
        indicatorElement.textContent = status.message;
        statusElement.className = `api-status ${status.className}`;

        // 削除ボタンの状態更新
        deleteButton.disabled = !status.configured;
        
        if (status.configured) {
            deleteButton.textContent = '🗑️ 削除';
        } else {
            deleteButton.textContent = '削除（未設定）';
        }
    }

    saveScenarios() {
        try {
            this.scenarioManager.saveScenarios();
            this.showSuccess('シチュエーションを保存しました。');
        } catch (error) {
            this.showError('保存に失敗しました: ' + error.message);
        }
    }

    resetScenarios() {
        const confirmMessage = `すべてのシチュエーションをデフォルトに戻しますか？\n\n` +
            `• 編集されたプリセットが元に戻ります\n` +
            `• 削除されたプリセットが復元されます\n` +
            `• カスタムシチュエーションは完全に削除されます\n\n` +
            `※ この操作は取り消せません。`;

        if (confirm(confirmMessage)) {
            try {
                this.scenarioManager.resetToDefaults();
                this.renderScenarioManagement();
                this.renderScenarioList();
                this.showSuccess('すべてのシチュエーションをデフォルトに戻しました。');
            } catch (error) {
                this.showError('リセットに失敗しました: ' + error.message);
            }
        }
    }

    updateSpeechSettings(settings) {
        if (this.speechManager) {
            this.speechManager.updateSettings(settings);
        }
    }

    showError(message) {
        const errorModal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error-modal').classList.add('hidden');
    }

    showSuccess(message) {
        console.log('Success:', message);
        
        // 一時的な成功メッセージを表示
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(76,175,80,0.3);
            z-index: 1002;
            max-width: 90%;
            text-align: center;
            font-weight: 600;
            animation: fadeInOut 3s ease forwards;
        `;
        
        document.body.appendChild(successDiv);
        
        // 3秒後に自動削除
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

function showLog() {
    const logElement = document.getElementById('conversation-log');
    if (logElement) {
        logElement.classList.remove('hidden');
    }
}

function hideLog() {
    const logElement = document.getElementById('conversation-log');
    if (logElement) {
        logElement.classList.add('hidden');
    }
}

function toggleLog() {
    const logElement = document.getElementById('conversation-log');
    const logButton = document.getElementById('log-btn');
    
    if (logElement && logButton) {
        const isHidden = logElement.classList.contains('hidden');
        
        if (isHidden) {
            // ログを表示
            logElement.classList.remove('hidden');
            logButton.textContent = '会話ログを非表示';
        } else {
            // ログを非表示
            logElement.classList.add('hidden');
            logButton.textContent = '会話ログを表示';
        }
    }
}

function showError(message) {
    if (window.app) {
        window.app.showError(message);
    } else {
        console.error(message);
        alert(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new AppManager();
    window.appManager = window.app;
    
    console.log('App loaded successfully');
});

window.AppManager = AppManager;
window.showLog = showLog;
window.hideLog = hideLog;
window.toggleLog = toggleLog;
window.showError = showError;