class ScenarioManager {
    constructor() {
        this.defaultScenarios = [
            {
                id: 'ticket-reservation',
                title: 'チケット予約',
                description: '観光客が今日の公演のチケットを予約したいと相談してきます。座席の空き状況、料金、公演時間などを案内してください。',
                isDefault: true
            },
            {
                id: 'restroom-direction',
                title: 'トイレ案内',
                description: '観光客がトイレの場所を尋ねています。劇場内のトイレの場所と行き方を分かりやすく案内してください。',
                isDefault: true
            },
            {
                id: 'today-performance',
                title: '今日の公演情報',
                description: '観光客が今日の公演について詳しく知りたがっています。演目、出演者、開演時間、休憩時間などを説明してください。',
                isDefault: true
            },
            {
                id: 'seat-consultation',
                title: '座席相談',
                description: '観光客が良い座席を選びたいと相談してきます。見やすさ、料金、特徴などを説明して適切な座席を提案してください。',
                isDefault: true
            },
            {
                id: 'lost-items',
                title: '忘れ物対応',
                description: '観光客が忘れ物をしたようです。どこで何を落としたか聞き取り、対応方法を案内してください。',
                isDefault: true
            },
            {
                id: 'facility-directions',
                title: '館内道案内',
                description: '観光客が館内の様々な場所（ロビー、カフェ、ギフトショップなど）への道順を尋ねています。分かりやすく案内してください。',
                isDefault: true
            },
            {
                id: 'meeting-room',
                title: '貸し会議室案内',
                description: '観光客が貸し会議室について問い合わせています。利用可能な会議室、料金、予約方法などを説明してください。',
                isDefault: true
            },
            {
                id: 'nearby-attractions',
                title: '近隣観光地案内',
                description: '観光客が劇場周辺の観光地について尋ねています。おすすめの場所、行き方、所要時間などを案内してください。',
                isDefault: true
            },
            {
                id: 'merchandise',
                title: 'グッズ案内',
                description: '観光客が劇場のグッズに興味を示しています。商品の種類、価格、特徴などを紹介してください。',
                isDefault: true
            }
        ];
        
        this.scenarios = [];
        this.loadScenarios();
    }

    loadScenarios() {
        try {
            const saved = localStorage.getItem('scenarios');
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // デフォルトシチュエーションをベースにする
                this.scenarios = [...this.defaultScenarios];
                
                // 保存されたシチュエーションをマージ
                parsed.forEach(savedScenario => {
                    if (savedScenario.isDefault) {
                        // 変更されたプリセットシチュエーション
                        const index = this.scenarios.findIndex(s => s.id === savedScenario.id);
                        if (index !== -1) {
                            // 既存のプリセットを変更されたバージョンに置き換え
                            this.scenarios[index] = savedScenario;
                        }
                    } else {
                        // カスタムシチュエーション
                        this.scenarios.push(savedScenario);
                    }
                });
            } else {
                this.scenarios = [...this.defaultScenarios];
                this.saveScenarios();
            }
        } catch (error) {
            console.error('Failed to load scenarios:', error);
            this.scenarios = [...this.defaultScenarios];
        }
    }

    saveScenarios() {
        try {
            // カスタムシチュエーションと変更されたプリセットを保存
            const scenariosToSave = this.scenarios.filter(s => 
                !s.isDefault || s.isDeleted || s.isModifiedDefault || s.updatedAt
            );
            localStorage.setItem('scenarios', JSON.stringify(scenariosToSave));
        } catch (error) {
            console.error('Failed to save scenarios:', error);
            throw error;
        }
    }

    getAllScenarios() {
        return this.scenarios.filter(s => !s.isDeleted);
    }

    getScenarioById(id) {
        return this.scenarios.find(s => s.id === id);
    }

    addCustomScenario(title, description) {
        if (!title || !description) {
            throw new Error('タイトルと説明の両方を入力してください');
        }

        const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newScenario = {
            id: id,
            title: title.trim(),
            description: description.trim(),
            isDefault: false,
            createdAt: new Date().toISOString()
        };

        this.scenarios.push(newScenario);
        this.saveScenarios();
        
        return newScenario;
    }

    updateScenario(id, title, description) {
        const scenario = this.scenarios.find(s => s.id === id);
        if (!scenario) {
            throw new Error('シチュエーションが見つかりません');
        }

        if (!title || !description) {
            throw new Error('タイトルと説明の両方を入力してください');
        }

        scenario.title = title.trim();
        scenario.description = description.trim();
        scenario.updatedAt = new Date().toISOString();
        
        // デフォルトシチュエーションが編集された場合、カスタム扱いにする
        if (scenario.isDefault) {
            scenario.isDefault = false;
            scenario.isModifiedDefault = true;
        }

        this.saveScenarios();
        return scenario;
    }

    deleteScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index === -1) {
            throw new Error('シチュエーションが見つかりません');
        }

        const scenario = this.scenarios[index];
        
        // デフォルトシチュエーションの場合、削除マークをつけるが完全には削除しない
        if (scenario.isDefault) {
            scenario.isDeleted = true;
            scenario.deletedAt = new Date().toISOString();
        } else {
            // カスタムシチュエーションは完全削除
            this.scenarios.splice(index, 1);
        }

        this.saveScenarios();
        
        return true;
    }

    getRandomScenario() {
        const availableScenarios = this.scenarios.filter(s => !s.isDeleted);
        if (availableScenarios.length === 0) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * availableScenarios.length);
        return availableScenarios[randomIndex];
    }

    searchScenarios(query) {
        const availableScenarios = this.scenarios.filter(s => !s.isDeleted);
        if (!query) {
            return availableScenarios;
        }

        const lowerQuery = query.toLowerCase();
        return availableScenarios.filter(scenario => 
            scenario.title.toLowerCase().includes(lowerQuery) ||
            scenario.description.toLowerCase().includes(lowerQuery)
        );
    }

    exportScenarios() {
        const customScenarios = this.scenarios.filter(s => !s.isDefault);
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            scenarios: customScenarios
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    importScenarios(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (!data.scenarios || !Array.isArray(data.scenarios)) {
                throw new Error('無効なデータ形式です');
            }

            let importedCount = 0;
            
            for (const scenario of data.scenarios) {
                if (scenario.title && scenario.description && !scenario.isDefault) {
                    const exists = this.scenarios.some(s => 
                        s.title === scenario.title && !s.isDefault
                    );
                    
                    if (!exists) {
                        const id = 'imported-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                        this.scenarios.push({
                            id: id,
                            title: scenario.title,
                            description: scenario.description,
                            isDefault: false,
                            createdAt: new Date().toISOString(),
                            imported: true
                        });
                        importedCount++;
                    }
                }
            }

            if (importedCount > 0) {
                this.saveScenarios();
            }

            return importedCount;
            
        } catch (error) {
            console.error('Import failed:', error);
            throw new Error('インポートに失敗しました: ' + error.message);
        }
    }

    resetToDefaults() {
        // デフォルトシチュエーションを完全にクリーンな状態で復元
        this.scenarios = this.defaultScenarios.map(scenario => ({
            ...scenario,
            isDeleted: false,
            isModifiedDefault: false,
            updatedAt: undefined,
            deletedAt: undefined
        }));
        
        // LocalStorageからカスタムシチュエーションを完全削除
        localStorage.removeItem('scenarios');
        
        console.log('Reset to defaults completed. Restored scenarios:', this.scenarios.length);
    }

    getStatistics() {
        const total = this.scenarios.length;
        const custom = this.scenarios.filter(s => !s.isDefault).length;
        const defaults = this.scenarios.filter(s => s.isDefault).length;
        
        return {
            total: total,
            custom: custom,
            default: defaults
        };
    }
}

class ConversationManager {
    constructor() {
        this.currentConversation = [];
        this.currentScenario = null;
    }

    startConversation(scenario) {
        this.currentScenario = scenario;
        this.currentConversation = [];
        
        const welcomeMessage = this.generateWelcomeMessage(scenario);
        this.addMessage('assistant', welcomeMessage, false);
        
        return welcomeMessage;
    }

    addMessage(speaker, text, isUser = true) {
        const message = {
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            speaker: speaker,
            text: text,
            timestamp: new Date().toISOString(),
            isUser: isUser
        };
        
        this.currentConversation.push(message);
        return message;
    }

    getConversationHistory() {
        return this.currentConversation;
    }

    getCurrentScenario() {
        return this.currentScenario;
    }

    clearConversation() {
        const cleared = this.currentConversation.length;
        this.currentConversation = [];
        this.currentScenario = null;
        
        console.log(`Privacy protection: Cleared ${cleared} conversation messages`);
        return cleared;
    }

    generateWelcomeMessage(scenario) {
        const welcomeMessages = [
            "Hello! I need some help, please.",
            "Excuse me, could you help me?",
            "Hi there! I have a question.",
            "Good morning! Could you assist me?",
            "Hello, I'm looking for some information."
        ];
        
        const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
        return welcomeMessages[randomIndex];
    }

    exportConversation() {
        if (this.currentConversation.length === 0) {
            throw new Error('会話履歴がありません');
        }

        const exportData = {
            scenario: this.currentScenario,
            conversation: this.currentConversation,
            exportDate: new Date().toISOString()
        };

        return JSON.stringify(exportData, null, 2);
    }
}

function initStorageManager() {
    const scenarioManager = new ScenarioManager();
    const conversationManager = new ConversationManager();
    
    window.scenarioManager = scenarioManager;
    window.conversationManager = conversationManager;
    
    return {
        scenarioManager,
        conversationManager
    };
}

window.ScenarioManager = ScenarioManager;
window.ConversationManager = ConversationManager;
window.initStorageManager = initStorageManager;