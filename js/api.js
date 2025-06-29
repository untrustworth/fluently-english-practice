class GeminiAPIManager {
    constructor() {
        this.apiKey = null;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent';
        this.usageTracker = new UsageTracker();
        this.loadAPIKey();
    }

    loadAPIKey() {
        try {
            const encrypted = localStorage.getItem('geminiApiKey');
            if (encrypted) {
                this.apiKey = this.decrypt(encrypted);
            }
        } catch (error) {
            console.error('Failed to load API key:', error);
        }
    }

    saveAPIKey(key) {
        try {
            if (!key || key.trim() === '') {
                throw new Error('APIキーが空です');
            }

            const encrypted = this.encrypt(key.trim());
            localStorage.setItem('geminiApiKey', encrypted);
            this.apiKey = key.trim();
            return true;
        } catch (error) {
            console.error('Failed to save API key:', error);
            throw error;
        }
    }

    encrypt(text) {
        return btoa(encodeURIComponent(text));
    }

    decrypt(encrypted) {
        return decodeURIComponent(atob(encrypted));
    }

    validateInput(userInput) {
        if (!userInput || typeof userInput !== 'string') {
            throw new Error('入力が無効です');
        }

        const trimmed = userInput.trim();

        if (trimmed.length === 0) {
            throw new Error('入力が空です');
        }

        if (trimmed.length > 1000) {
            throw new Error('入力が長すぎます（1000文字以内）');
        }

        const suspiciousPatterns = [
            /system\s*:/i,
            /assistant\s*:/i,
            /prompt\s*:/i,
            /ignore\s+previous/i,
            /forget\s+everything/i,
            /<[^>]*>/g
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(trimmed)) {
                throw new Error('不正な入力が検出されました');
            }
        }

        return trimmed;
    }

    async generateResponse(userInput, scenario, conversationHistory = []) {
        try {
            if (!this.apiKey) {
                throw new Error('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
            }

            this.usageTracker.checkLimits();

            const validatedInput = this.validateInput(userInput);

            const prompt = this.buildPrompt(validatedInput, scenario, conversationHistory);

            const response = await this.callGeminiAPI(prompt);

            this.usageTracker.recordUsage();

            return this.parseResponse(response, validatedInput);

        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async generateHint(japaneseText, scenario) {
        try {
            if (!this.apiKey) {
                throw new Error('APIキーが設定されていません。設定画面からAPIキーを入力してください。');
            }

            this.usageTracker.checkLimits();

            const validatedInput = this.validateInput(japaneseText);

            const prompt = this.buildHintPrompt(validatedInput, scenario);

            const response = await this.callGeminiAPI(prompt);

            this.usageTracker.recordUsage();

            return this.parseHintResponse(response);

        } catch (error) {
            console.error('Hint API Error:', error);
            throw error;
        }
    }

    buildPrompt(userInput, scenario, conversationHistory = []) {
        const isFirstInteraction = conversationHistory.length <= 1; // ウェルカムメッセージ + 最初の返答

        if (isFirstInteraction) {
            // 初回の会話：シチュエーション重視
            const systemPrompt = `あなたは日本のクラシカル劇場を訪れた親しみやすい外国人観光客です。英会話を練習している日本人劇場スタッフと会話しています。自然な英語で対応をしてください。

**現在のシチュエーション:** ${scenario}

**あなたの役割:**
- 観光客として返答する（スタッフではない）
- 簡潔な返答（1-2文）
- 明確で自然な英語を使用
- 文意が取れなかった場合は、スタッフの英語を決して訂正せず、聞き返す。
- シチュエーションに基づいて会話を始める

**スタッフが言ったこと:** "${userInput}"

**観光客としてのあなたの英語での返答:**`;

            return systemPrompt;
        } else {
            // 継続会話：文脈重視
            const recentHistory = conversationHistory.slice(-6); // 直近6メッセージ（3往復）
            const historyText = recentHistory.map(msg =>
                `${msg.speaker === 'user' ? 'スタッフ' : '観光客'}: "${msg.text}"`
            ).join('\n');

            const systemPrompt = `あなたは日本のクラシカル劇場を訪れた親しみやすい外国人観光客です。英会話を練習している日本人劇場スタッフと継続的な会話をしています。

**背景シチュエーション:** ${scenario}

**最近の会話:**
${historyText}

**スタッフが今言ったこと:** "${userInput}"

**あなたの役割:**
- 文脈に基づいて自然に会話を続ける
- 観光客として返答する（スタッフではない）
- 簡潔な返答（1-2文）
- 明確で自然な英語を使用
- 丁寧で魅力的に
- 適切な場合はフォローアップの質問をする
- スタッフの英語を決して訂正しない
- 会話の自然な流れに従う

**観光客としてのあなたの英語での返答:**`;

            return systemPrompt;
        }
    }

    buildHintPrompt(japaneseText, scenario) {
        const hintPrompt = `You are a professional English translation assistant helping a Japanese theater staff member translate Japanese phrases into natural English suitable for customer service.

**Context:** The staff member is working at a classical theater and needs to communicate with foreign tourists.

**Current Scenario:** ${scenario}

**Task:** Translate the following Japanese text into natural, polite English that would be appropriate for theater customer service. Provide only the English translation, nothing else.

**Japanese text:** "${japaneseText}"

**English translation:**`;

        return hintPrompt;
    }

    async callGeminiAPI(prompt) {
        const url = `${this.baseURL}?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200,
                    topP: 0.9,
                    topK: 20,
                    candidateCount: 1
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            if (response.status === 429) {
                throw new Error('API使用量制限に達しました。しばらく後にお試しください。');
            } else if (response.status === 401 || response.status === 403) {
                throw new Error('APIキーが無効です。Google AI Studioで正しいAPIキーを確認してください。');
            } else if (response.status === 400) {
                const errorMsg = errorData.error?.message || 'リクエストが無効です';
                if (errorMsg.includes('model')) {
                    throw new Error('Gemini 2.0 Flash モデルへのアクセスでエラーが発生しました。APIキーの権限を確認してください。');
                }
                throw new Error(`リクエストエラー: ${errorMsg}`);
            } else if (response.status >= 500) {
                throw new Error('Gemini APIサーバーでエラーが発生しました。しばらく後にお試しください。');
            } else {
                throw new Error(`APIエラー (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
            }
        }

        return await response.json();
    }

    parseResponse(apiResponse, userInput) {
        try {
            if (!apiResponse.candidates || !apiResponse.candidates[0] ||
                !apiResponse.candidates[0].content || !apiResponse.candidates[0].content.parts ||
                !apiResponse.candidates[0].content.parts[0]) {
                throw new Error('APIからの応答が無効です');
            }

            const aiResponse = apiResponse.candidates[0].content.parts[0].text.trim();

            const grammarCorrection = this.checkGrammar(userInput);

            return {
                aiResponse: aiResponse,
                correction: grammarCorrection,
                hasCorrection: grammarCorrection !== null
            };

        } catch (error) {
            console.error('Failed to parse API response:', error);
            throw new Error('応答の解析に失敗しました');
        }
    }

    parseHintResponse(apiResponse) {
        try {
            if (!apiResponse.candidates || !apiResponse.candidates[0] ||
                !apiResponse.candidates[0].content || !apiResponse.candidates[0].content.parts ||
                !apiResponse.candidates[0].content.parts[0]) {
                throw new Error('APIからの応答が無効です');
            }

            const englishTranslation = apiResponse.candidates[0].content.parts[0].text.trim();

            // Remove any unwanted prefixes or formatting
            const cleanTranslation = englishTranslation
                .replace(/^(English translation:|Translation:|Answer:)/i, '')
                .replace(/^["']|["']$/g, '')
                .trim();

            return {
                englishText: cleanTranslation
            };

        } catch (error) {
            console.error('Failed to parse hint response:', error);
            throw new Error('翻訳結果の解析に失敗しました');
        }
    }

    checkGrammar(userInput) {
        const commonMistakes = [
            {
                pattern: /\bi'm wanting\b/gi,
                correction: "I want"
            },
            {
                pattern: /\bcan you tell me that\b/gi,
                correction: "can you tell me"
            },
            {
                pattern: /\bhow much is the price\b/gi,
                correction: "how much is it"
            },
            {
                pattern: /\bi am come from\b/gi,
                correction: "I come from"
            },
            {
                pattern: /\bwhere is the toilet\?\s*$/gi,
                correction: "Where is the restroom?"
            }
        ];

        for (const mistake of commonMistakes) {
            if (mistake.pattern.test(userInput)) {
                return userInput.replace(mistake.pattern, mistake.correction);
            }
        }

        return null;
    }

    deleteAPIKey() {
        try {
            // LocalStorageから削除
            localStorage.removeItem('geminiApiKey');

            // メモリからクリア
            this.apiKey = null;

            console.log('API key deleted successfully');
            return true;
        } catch (error) {
            console.error('Failed to delete API key:', error);
            throw new Error('APIキーの削除に失敗しました');
        }
    }

    isConfigured() {
        return this.apiKey !== null && this.apiKey.trim() !== '';
    }

    getAPIKeyStatus() {
        if (this.isConfigured()) {
            return {
                configured: true,
                message: '✅ APIキー設定済み',
                className: 'configured'
            };
        } else {
            return {
                configured: false,
                message: '❌ APIキー未設定',
                className: 'not-configured'
            };
        }
    }
}

class UsageTracker {
    constructor() {
        this.limits = {
            hourly: 1000,
            daily: 1500
        };
        this.loadUsageData();
    }

    loadUsageData() {
        try {
            const saved = localStorage.getItem('apiUsage');
            if (saved) {
                this.usage = JSON.parse(saved);
                this.cleanOldData();
            } else {
                this.usage = {
                    hourly: {},
                    daily: {}
                };
            }
        } catch (error) {
            console.error('Failed to load usage data:', error);
            this.usage = { hourly: {}, daily: {} };
        }
    }

    saveUsageData() {
        try {
            localStorage.setItem('apiUsage', JSON.stringify(this.usage));
        } catch (error) {
            console.error('Failed to save usage data:', error);
        }
    }

    cleanOldData() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.toDateString();

        this.usage.hourly = this.usage.hourly || {};
        this.usage.daily = this.usage.daily || {};

        for (const hour in this.usage.hourly) {
            if (parseInt(hour) !== currentHour) {
                delete this.usage.hourly[hour];
            }
        }

        for (const day in this.usage.daily) {
            if (day !== currentDay) {
                delete this.usage.daily[day];
            }
        }
    }

    getCurrentUsage() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.toDateString();

        return {
            hourly: this.usage.hourly[currentHour] || 0,
            daily: this.usage.daily[currentDay] || 0
        };
    }

    checkLimits() {
        const current = this.getCurrentUsage();

        if (current.hourly >= this.limits.hourly) {
            throw new Error(`1時間の使用制限（${this.limits.hourly}回）に達しました。しばらく後にお試しください。`);
        }

        if (current.daily >= this.limits.daily) {
            throw new Error(`1日の使用制限（${this.limits.daily}回）に達しました。明日お試しください。`);
        }
    }

    recordUsage() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.toDateString();

        this.usage.hourly[currentHour] = (this.usage.hourly[currentHour] || 0) + 1;
        this.usage.daily[currentDay] = (this.usage.daily[currentDay] || 0) + 1;

        this.saveUsageData();
        this.updateUsageDisplay();
    }

    updateUsageDisplay() {
        const current = this.getCurrentUsage();

        const dailyElement = document.getElementById('daily-usage');
        const hourlyElement = document.getElementById('hourly-usage');

        if (dailyElement) {
            dailyElement.textContent = current.daily;
        }

        if (hourlyElement) {
            hourlyElement.textContent = current.hourly;
        }
    }
}

function initGeminiAPI() {
    const apiManager = new GeminiAPIManager();

    window.apiManager = apiManager;

    if (apiManager.usageTracker) {
        apiManager.usageTracker.updateUsageDisplay();
    }

    return apiManager;
}

window.GeminiAPIManager = GeminiAPIManager;
window.UsageTracker = UsageTracker;
window.initGeminiAPI = initGeminiAPI;