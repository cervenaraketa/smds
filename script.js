// ==========================================
// AICODE STUDIO - Pokročilý AI Code Generator
// ==========================================

// Konfigurace API
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
let API_KEY = localStorage.getItem('openrouter_api_key') || '';
let MODEL = localStorage.getItem('selected_model') || 'deepseek/deepseek-chat-v3-0324';

// Globální stav
let SYSTEM_PROMPT = '';
let conversation = [];
let currentPrompts = [];
let customModels = JSON.parse(localStorage.getItem('custom_models') || '[]');

// Parametry modelu
let modelSettings = {
    temperature: parseFloat(localStorage.getItem('model_temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('model_max_tokens') || '4000'),
    topP: parseFloat(localStorage.getItem('model_top_p') || '0.9')
};

// Monaco Editor
let indexModel, thingModel, editor;

// Buffery pro živé vykreslování
let htmlBuffer = '';
let thinkBuffer = '';
let streamBuffer = '';
let partialAssistant = '';
let lastPreviewContent = '';

// Streaming pomocníci
let inThink = false;
let thingShown = false;
let revealScheduled = false;
let autoUpdateEnabled = true;
let overflowFlag = false;
let finishReason = null;

// DOM reference
const aiPrompt = document.getElementById('aiPrompt');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const continueBtn = document.getElementById('continueBtn');
const toggleAutoUpdateBtn = document.getElementById('toggleAutoUpdateBtn');
const renderFrame = document.getElementById('renderFrame');
const previewWrapper = document.querySelector('.preview-frame-wrapper');

// Výchozí modely
const defaultModels = [
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3 0324', tag: 'Premium' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tag: 'Premium' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', tag: 'Premium' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', tag: 'Premium' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Standard' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tag: 'Premium' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', tag: 'Standard' },
    { id: 'x-ai/grok-beta', name: 'Grok Beta', tag: 'Premium' }
];

// Výchozí prompty
const defaultPrompts = [
    {
        id: 'web_developer',
        name: 'Web Developer',
        description: 'Vytváří moderní webové stránky',
        outputType: 'mixed',
        content: `Jsi expertní web developer specializovaný na tvorbu moderních, responzivních webových stránek. Vytváříš čistý, sémantický HTML kód s moderním CSS a funkčním JavaScriptem. Vždy dodržuješ nejlepší praktiky a accessibility standardy.

Když vytváříš kód:
1. Používej moderní HTML5 sémantické elementy
2. Vytvoř responzivní design s CSS Grid/Flexbox
3. Přidej interaktivní prvky s JavaScriptem
4. Optimalizuj pro rychlost a přístupnost
5. Používej moderní CSS vlastnosti (custom properties, animations)

Výstup musí být kompletní HTML dokument s vloženým CSS a JS.`
    },
    {
        id: 'game_developer',
        name: 'Game Developer',
        description: 'Vytváří HTML5 hry s Canvas',
        outputType: 'mixed',
        content: `Jsi expertní vývojář HTML5 her specializovaný na Canvas API a moderní webové technologie. Vytváříš zábavné, interaktivní hry s plynulou animací a responzivním designem.

Když vytváříš hru:
1. Používej HTML5 Canvas pro vykreslování
2. Implementuj herní smyčku s requestAnimationFrame
3. Přidej ovládání klávesnicí/myší/dotykem
4. Vytvoř responzivní canvas který se přizpůsobí obrazovce
5. Přidej zvukové efekty a hudbu (pokud je to vhodné)
6. Implementuj skóre a herní mechaniky

Výstup musí být kompletní HTML dokument s funkční hrou.`
    },
    {
        id: 'ui_designer',
        name: 'UI Designer',
        description: 'Vytváří moderní uživatelská rozhraní',
        outputType: 'mixed',
        content: `Jsi expertní UI/UX designer specializovaný na tvorbu krásných, funkčních uživatelských rozhraní. Vytváříš moderní, intuitivní designy s důrazem na uživatelskou zkušenost.

Když vytváříš UI:
1. Používej moderní design systémy a komponenty
2. Implementuj dark/light mode
3. Vytvoř plynulé animace a přechody
4. Optimalizuj pro různá zařízení
5. Používej moderní CSS techniky (CSS Grid, Flexbox, Custom Properties)
6. Přidej interaktivní prvky a mikrointerakce

Výstup musí být kompletní HTML dokument s krásným, funkčním rozhraním.`
    }
];

// ==========================================
// INICIALIZACE
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Načti prompty
    loadPrompts();
    
    // Načti modely
    loadModels();
    
    // Inicializuj Monaco Editor
    initializeMonacoEditor();
    
    // Nastav event listenery
    setupEventListeners();
    
    // Načti nastavení
    loadSettings();
    
    // Aktualizuj kredit
    updateCreditBalance();
    
    // Inicializuj snake border
    initSnakeBorder();
    
    // Načti výchozí prompt
    if (currentPrompts.length > 0) {
        selectPrompt(currentPrompts[0].id);
    }
}

// ==========================================
// MONACO EDITOR
// ==========================================

function initializeMonacoEditor() {
    require.config({ 
        paths: { 
            vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' 
        } 
    });
    
    require(['vs/editor/editor.main'], () => {
        // Definuj tmavý theme
        monaco.editor.defineTheme('aicode-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#000000',
                'editor.foreground': '#ffffff',
                'minimap.background': '#000000',
                'scrollbarSlider.background': '#66666650',
                'scrollbarSlider.hoverBackground': '#88888870',
                'scrollbarSlider.activeBackground': '#aaaaaa80'
            }
        });

        // Vytvoř modely
        indexModel = monaco.editor.createModel(
            `<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AICODE Logo Animation</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f0f0f0;
            margin: 0;
            overflow: hidden;
        }

        .logo-container {
            position: relative;
            width: 200px;
            height: 200px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .logo-text {
            font-family: 'Arial', sans-serif;
            font-size: 4em;
            font-weight: bold;
            color: #333;
            position: relative;
            z-index: 2;
            animation: scaleIn 1s ease-out forwards;
        }

        .logo-text span {
            display: inline-block;
            opacity: 0;
            transform: translateY(20px);
            animation: fadeInSlideUp 1s ease-out forwards;
        }

        .logo-text span:nth-child(1) { animation-delay: 0.2s; }
        .logo-text span:nth-child(2) { animation-delay: 0.3s; }
        .logo-text span:nth-child(3) { animation-delay: 0.4s; }
        .logo-text span:nth-child(4) { animation-delay: 0.5s; }
        .logo-text span:nth-child(5) { animation-delay: 0.6s; }
        .logo-text span:nth-child(6) { animation-delay: 0.7s; }

        .code-lines {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            overflow: hidden;
            z-index: 1;
        }

        .code-line {
            position: absolute;
            width: 2px;
            height: 100%;
            background: linear-gradient(to bottom, rgba(0, 123, 255, 0), rgba(0, 123, 255, 0.8), rgba(0, 123, 255, 0));
            opacity: 0;
            animation: codeFlow 3s infinite linear;
        }

        .code-line:nth-child(1) { left: 10%; animation-delay: 0s; height: 80%; top: 10%; }
        .code-line:nth-child(2) { left: 25%; animation-delay: 0.5s; height: 90%; top: 5%; }
        .code-line:nth-child(3) { left: 40%; animation-delay: 1s; height: 70%; top: 15%; }
        .code-line:nth-child(4) { left: 55%; animation-delay: 1.5s; height: 100%; top: 0; }
        .code-line:nth-child(5) { left: 70%; animation-delay: 2s; height: 85%; top: 8%; }
        .code-line:nth-child(6) { left: 85%; animation-delay: 2.5s; height: 75%; top: 12%; }

        @keyframes scaleIn {
            0% { transform: scale(0.5); opacity: 0; }
            80% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fadeInSlideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes codeFlow {
            0% { transform: translateY(-100%); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(100%); opacity: 0; }
        }
    </style>
</head>
<body>
    <div class="logo-container">
        <div class="code-lines">
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
        </div>
        <div class="logo-text">
            <span>A</span><span>I</span><span>C</span><span>O</span><span>D</span><span>E</span>
        </div>
    </div>
</body>
</html>`, 
            monaco.Uri.parse('file:///index.html')
        );
        
        thingModel = monaco.editor.createModel('', 'plaintext', monaco.Uri.parse('file:///thinking.txt'));

        // Vytvoř editor
        editor = monaco.editor.create(document.getElementById('editor'), {
            model: indexModel,
            theme: 'aicode-dark',
            automaticLayout: true,
            fontFamily: 'Fira Code',
            fontSize: 14,
            minimap: { 
                enabled: true, 
                showSlider: 'always', 
                renderCharacters: false, 
                maxColumn: 120 
            },
            scrollbar: { 
                verticalScrollbarSize: 14, 
                verticalSliderSize: 14 
            },
            wordWrap: 'on',
            cursorBlinking: 'solid',
            cursorSmoothCaretAnimation: true
        });

        // Event listener pro změny obsahu
        editor.onDidChangeModelContent(() => {
            if (editor.getModel() === indexModel) {
                updatePreview();
            }
        });

        // Nastav tab switching
        setupTabSwitching();
        
        // Nastav výchozí obsah
        htmlBuffer = indexModel.getValue();
        doUpdatePreview();
    });
}

function setupTabSwitching() {
    document.querySelectorAll('.filename').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filename').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.model === 'index') {
                editor.setModel(indexModel);
                updatePreview();
            } else {
                editor.setModel(thingModel);
            }
        });
    });
}

// ==========================================
// SPRÁVA PROMPTŮ
// ==========================================

function loadPrompts() {
    const savedPrompts = localStorage.getItem('custom_prompts');
    if (savedPrompts) {
        currentPrompts = JSON.parse(savedPrompts);
    } else {
        currentPrompts = [...defaultPrompts];
        savePrompts();
    }
    updatePromptDropdown();
}

function savePrompts() {
    localStorage.setItem('custom_prompts', JSON.stringify(currentPrompts));
    updatePromptDropdown();
}

function updatePromptDropdown() {
    const dropdown = document.getElementById('promptDropdown');
    dropdown.innerHTML = '';
    
    currentPrompts.forEach(prompt => {
        const option = document.createElement('div');
        option.className = 'prompt-option';
        option.dataset.promptId = prompt.id;
        
        option.innerHTML = `
            <div>
                <span class="prompt-option-name">${prompt.name}</span>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                    ${prompt.description}
                </div>
            </div>
        `;
        
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectPrompt(prompt.id);
            closeDropdowns();
        });
        
        dropdown.appendChild(option);
    });
}

function selectPrompt(promptId) {
    const prompt = currentPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    SYSTEM_PROMPT = prompt.content;
    document.getElementById('promptNameDisplay').textContent = prompt.name;
    
    // Aktualizuj selected stav
    document.querySelectorAll('.prompt-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.promptId === promptId) {
            opt.classList.add('selected');
        }
    });
    
    localStorage.setItem('selected_prompt', promptId);
}

// ==========================================
// SPRÁVA MODELŮ
// ==========================================

function loadModels() {
    updateModelDropdown();
    
    // Nastav aktuální model
    const savedModel = localStorage.getItem('selected_model');
    if (savedModel) {
        selectModel(savedModel);
    }
}

function updateModelDropdown() {
    const dropdown = document.getElementById('modelDropdown');
    dropdown.innerHTML = '';
    
    const allModels = [...defaultModels, ...customModels];
    
    allModels.forEach(model => {
        const option = document.createElement('div');
        option.className = 'model-option';
        option.dataset.modelId = model.id;
        
        option.innerHTML = `
            <span class="model-option-name">${model.name}</span>
            ${model.tag ? `<span class="model-option-tag">${model.tag}</span>` : ''}
        `;
        
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectModel(model.id);
            closeDropdowns();
        });
        
        dropdown.appendChild(option);
    });
}

function selectModel(modelId) {
    MODEL = modelId;
    
    const allModels = [...defaultModels, ...customModels];
    const model = allModels.find(m => m.id === modelId);
    
    if (model) {
        document.getElementById('currentModelName').textContent = model.name;
    }
    
    // Aktualizuj selected stav
    document.querySelectorAll('.model-option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.modelId === modelId) {
            opt.classList.add('selected');
        }
    });
    
    localStorage.setItem('selected_model', modelId);
}

function addCustomModel(modelId, modelName) {
    const newModel = {
        id: modelId,
        name: modelName || modelId,
        tag: 'Custom'
    };
    
    customModels.push(newModel);
    localStorage.setItem('custom_models', JSON.stringify(customModels));
    updateModelDropdown();
    updateCustomModelsList();
}

function removeCustomModel(modelId) {
    customModels = customModels.filter(m => m.id !== modelId);
    localStorage.setItem('custom_models', JSON.stringify(customModels));
    updateModelDropdown();
    updateCustomModelsList();
}

// ==========================================
// GENEROVÁNÍ KÓDU
// ==========================================

async function generate() {
    const prompt = aiPrompt.value.trim();
    if (!prompt) {
        aiPrompt.focus();
        return;
    }
    
    if (!API_KEY) {
        showNotification('Chyba', 'Prosím nastavte OpenRouter API klíč v nastavení.', 'error');
        return;
    }

    const baseMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: 'Když generuješ kód, neuváděj markdownové bloky (```html ani ```).' },
        { role: 'user', content: prompt }
    ];

    await streamGeneration(baseMessages, false);
}

async function continueGeneration() {
    if (!overflowFlag) return;
    
    continueBtn.disabled = true;
    continueBtn.style.display = 'none';

    const messages = conversation.concat([
        { role: 'user', content: 'Pokračuj tam kde jsi skončil.' }
    ]);
    
    await streamGeneration(messages, true);
}

async function streamGeneration(messages, isContinuation = false) {
    // Zapni hadí efekt
    previewWrapper.classList.add('generating');

    // Uložíme konverzaci pro pokračování
    conversation = messages.map(m => ({ ...m }));

    // Aktivujeme auto-update
    if (!autoUpdateEnabled) {
        autoUpdateEnabled = true;
        toggleAutoUpdateBtn.classList.add('active');
    }

    // Reset UI stavu
    sendBtn.disabled = true;
    continueBtn.disabled = true;
    overflowFlag = false;
    finishReason = null;
    streamBuffer = '';
    partialAssistant = '';

    if (!isContinuation) {
        // Fresh start: vyčistíme buffery i editor
        htmlBuffer = '';
        thinkBuffer = '';
        inThink = false;
        thingShown = false;
        indexModel.setValue('');
        thingModel.setValue('');
        document.querySelector('.filename[data-model="thing"]').style.display = 'none';
        document.querySelector('.filename[data-model="index"]').click();

        const skeleton = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI Generated Code</title></head><body><div id="preview"></div></body></html>`;
        renderFrame.srcdoc = skeleton;
        renderFrame.onload = () => { 
            if (autoUpdateEnabled) doUpdatePreview(); 
        };
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                stream: true,
                temperature: modelSettings.temperature,
                max_tokens: modelSettings.maxTokens,
                top_p: modelSettings.topP,
                stop: null
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        const sanitize = chunk => chunk
            .replace(/\n?```html\n?/gi, '')
            .replace(/```/g, '');

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            streamBuffer += decoder.decode(value, { stream: true });
            const parts = streamBuffer.split('\n\n');
            streamBuffer = parts.pop();

            for (let part of parts) {
                if (!part.startsWith('data:')) continue;
                
                const payload = part.replace(/^data:\s*/, '').trim();
                if (payload === '[DONE]') continue;

                let obj;
                try { 
                    obj = JSON.parse(payload).choices[0]; 
                } catch { 
                    continue; 
                }

                if (obj.finish_reason != null) {
                    finishReason = obj.finish_reason;
                    continue;
                }

                const delta = obj.delta?.content ? sanitize(obj.delta.content) : '';
                if (!delta) continue;

                partialAssistant += delta;
                let pending = delta;

                // Parsování <think> tagů a // CONTINUE -->
                while (pending) {
                    if (pending.includes('// CONTINUE -->')) {
                        overflowFlag = true;
                        continueBtn.style.display = 'inline-block';
                        pending = pending.replace('// CONTINUE -->', '');
                    }

                    if (inThink) {
                        const idx = pending.search(/<\/think>/i);
                        if (idx !== -1) {
                            thinkBuffer += pending.slice(0, idx);
                            thingModel.setValue(thinkBuffer);
                            inThink = false;
                            pending = pending.slice(idx + '</think>'.length);
                        } else {
                            thinkBuffer += pending;
                            thingModel.setValue(thinkBuffer);
                            pending = '';
                        }
                    } else {
                        const match = pending.match(/<think\b[^>]*>/i);
                        if (match) {
                            const index = match.index;
                            htmlBuffer += pending.slice(0, index);
                            indexModel.setValue(htmlBuffer);
                            scheduleReveal();
                            updatePreview();
                            inThink = true;
                            
                            if (!thingShown) {
                                document.querySelector('.filename[data-model="thing"]').style.display = 'inline-block';
                                thingShown = true;
                            }
                            
                            pending = pending.slice(index + match[0].length);
                        } else {
                            htmlBuffer += pending;
                            indexModel.setValue(htmlBuffer);
                            scheduleReveal();
                            updatePreview();
                            pending = '';
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error('Generation error:', err);
        showNotification('Chyba generování', err.message, 'error');
    }

    // Dokončení
    previewWrapper.classList.remove('generating');
    overflowFlag = finishReason === 'length';
    continueBtn.style.display = overflowFlag ? 'inline-block' : 'none';
    sendBtn.disabled = false;
    continueBtn.disabled = false;

    updateCreditBalance();
    showNotification('Úspěch', 'Kód byl úspěšně vygenerován!', 'success');
}

// ==========================================
// NÁHLED
// ==========================================

function doUpdatePreview() {
    const buf = htmlBuffer.trim();

    // Plný HTML dokument
    if (/^<!DOCTYPE html>/i.test(buf) || /<html[\s>]/i.test(buf)) {
        if (lastPreviewContent === buf) return;
        renderFrame.srcdoc = buf;
        lastPreviewContent = buf;
        return;
    }

    // Fragment do #preview
    const doc = renderFrame.contentDocument;
    if (!doc) return;
    
    const preview = doc.getElementById('preview');
    if (!preview) return;

    if (lastPreviewContent === buf) return;
    preview.innerHTML = buf;
    lastPreviewContent = buf;
}

function updatePreview() {
    if (!autoUpdateEnabled) return;
    htmlBuffer = indexModel.getValue();
    doUpdatePreview();
}

function scheduleReveal() {
    if (revealScheduled) return;
    revealScheduled = true;
    requestAnimationFrame(() => {
        const lineCount = editor.getModel().getLineCount();
        editor.revealPositionInCenter({ lineNumber: lineCount, column: 1 });
        revealScheduled = false;
    });
}

// ==========================================
// DOWNLOAD FUNKCIONALITA
// ==========================================

function downloadProject() {
    const code = indexModel.getValue();
    if (!code.trim()) {
        showNotification('Chyba', 'Není co stáhnout. Nejprve vygenerujte nějaký kód.', 'error');
        return;
    }
    
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-generated-project.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Úspěch', 'Projekt byl úspěšně stažen!', 'success');
}

// ==========================================
// NASTAVENÍ
// ==========================================

function loadSettings() {
    // Načti API klíč
    if (API_KEY) {
        document.getElementById('apiKeyInput').value = API_KEY;
    }
    
    // Načti parametry modelu
    document.getElementById('temperatureInput').value = modelSettings.temperature;
    document.getElementById('temperatureValue').textContent = modelSettings.temperature;
    document.getElementById('maxTokensInput').value = modelSettings.maxTokens;
    document.getElementById('topPInput').value = modelSettings.topP;
    document.getElementById('topPValue').textContent = modelSettings.topP;
    
    // Aktualizuj seznam vlastních modelů
    updateCustomModelsList();
}

function saveSettings() {
    // Ulož API klíč
    API_KEY = document.getElementById('apiKeyInput').value.trim();
    localStorage.setItem('openrouter_api_key', API_KEY);
    
    // Ulož parametry modelu
    modelSettings.temperature = parseFloat(document.getElementById('temperatureInput').value);
    modelSettings.maxTokens = parseInt(document.getElementById('maxTokensInput').value);
    modelSettings.topP = parseFloat(document.getElementById('topPInput').value);
    
    localStorage.setItem('model_temperature', modelSettings.temperature);
    localStorage.setItem('model_max_tokens', modelSettings.maxTokens);
    localStorage.setItem('model_top_p', modelSettings.topP);
    
    closeModal('settingsModal');
    showNotification('Úspěch', 'Nastavení bylo uloženo!', 'success');
}

function updateCustomModelsList() {
    const container = document.getElementById('customModelsList');
    container.innerHTML = '';
    
    customModels.forEach(model => {
        const item = document.createElement('div');
        item.className = 'custom-model-item';
        item.innerHTML = `
            <span class="custom-model-name">${model.name} (${model.id})</span>
            <button class="custom-model-remove" onclick="removeCustomModel('${model.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(item);
    });
}

// ==========================================
// UTILITY FUNKCE
// ==========================================

function showNotification(title, message, type = 'success') {
    const container = document.getElementById('notificationsContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="notification-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
        <button class="notification-close" aria-label="Zavřít notifikaci">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    container.appendChild(notification);
    
    // Zobraz notifikaci
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Automatické zavření po 5 sekundách
    const timeout = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => container.removeChild(notification), 300);
    }, 5000);
    
    // Ruční zavření
    notification.querySelector('.notification-close').onclick = () => {
        clearTimeout(timeout);
        notification.classList.remove('show');
        setTimeout(() => container.removeChild(notification), 300);
    };
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
}

function closeDropdowns() {
    document.querySelector('.model-selector').classList.remove('open');
    document.querySelector('.prompt-selector').classList.remove('open');
}

async function updateCreditBalance() {
    if (!API_KEY) return;
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/credits', {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });
        
        const data = await response.json();
        const remaining = data.data.total_credits - data.data.total_usage;
        const element = document.getElementById('creditAmount');
        if (element) {
            element.textContent = remaining.toFixed(2);
        }
    } catch (err) {
        console.warn('Nepodařilo se načíst zůstatek:', err);
    }
}

function exportPrompt(prompt) {
    const dataStr = JSON.stringify(prompt, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prompt.name.toLowerCase().replace(/\s+/g, '_')}_prompt.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importPrompt(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const prompt = JSON.parse(e.target.result);
            
            // Validace struktury
            if (!prompt.name || !prompt.content) {
                throw new Error('Neplatná struktura promptu');
            }
            
            // Přidej unikátní ID pokud neexistuje
            if (!prompt.id) {
                prompt.id = 'imported_' + Date.now();
            }
            
            // Zkontroluj duplicity
            if (currentPrompts.find(p => p.id === prompt.id)) {
                prompt.id = prompt.id + '_' + Date.now();
            }
            
            currentPrompts.push(prompt);
            savePrompts();
            updatePromptManagerList();
            
            showNotification('Úspěch', 'Prompt byl úspěšně importován!', 'success');
        } catch (err) {
            showNotification('Chyba', 'Nepodařilo se importovat prompt: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

// ==========================================
// SPRÁVA PROMPTŮ - UI
// ==========================================

function updatePromptManagerList() {
    const container = document.getElementById('promptList');
    container.innerHTML = '';
    
    currentPrompts.forEach(prompt => {
        const item = document.createElement('div');
        item.className = 'prompt-item';
        item.innerHTML = `
            <div class="prompt-item-info">
                <div class="prompt-item-name">${prompt.name}</div>
                <div class="prompt-item-description">${prompt.description || 'Bez popisu'}</div>
            </div>
            <div class="prompt-item-actions">
                <button class="prompt-item-btn" onclick="editPrompt('${prompt.id}')" title="Editovat">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="prompt-item-btn" onclick="exportPrompt(currentPrompts.find(p => p.id === '${prompt.id}'))" title="Exportovat">
                    <i class="fas fa-download"></i>
                </button>
                <button class="prompt-item-btn" onclick="deletePrompt('${prompt.id}')" title="Smazat">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function editPrompt(promptId) {
    const prompt = currentPrompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    document.getElementById('promptNameInput').value = prompt.name;
    document.getElementById('promptDescriptionInput').value = prompt.description || '';
    document.getElementById('promptOutputTypeInput').value = prompt.outputType || 'mixed';
    document.getElementById('promptContentInput').value = prompt.content;
    
    // Nastav akci pro uložení
    document.getElementById('savePromptBtn').onclick = () => savePrompt(promptId);
    document.getElementById('exportPromptBtn').onclick = () => exportPrompt(prompt);
    
    closeModal('promptManagerModal');
    openModal('promptEditorModal');
}

function newPrompt() {
    document.getElementById('promptNameInput').value = '';
    document.getElementById('promptDescriptionInput').value = '';
    document.getElementById('promptOutputTypeInput').value = 'mixed';
    document.getElementById('promptContentInput').value = '';
    
    // Nastav akci pro uložení
    document.getElementById('savePromptBtn').onclick = () => savePrompt();
    document.getElementById('exportPromptBtn').onclick = () => {
        const prompt = {
            name: document.getElementById('promptNameInput').value || 'Nový prompt',
            description: document.getElementById('promptDescriptionInput').value,
            outputType: document.getElementById('promptOutputTypeInput').value,
            content: document.getElementById('promptContentInput').value
        };
        exportPrompt(prompt);
    };
    
    closeModal('promptManagerModal');
    openModal('promptEditorModal');
}

function savePrompt(promptId = null) {
    const name = document.getElementById('promptNameInput').value.trim();
    const description = document.getElementById('promptDescriptionInput').value.trim();
    const outputType = document.getElementById('promptOutputTypeInput').value;
    const content = document.getElementById('promptContentInput').value.trim();
    
    if (!name || !content) {
        showNotification('Chyba', 'Název a obsah promptu jsou povinné.', 'error');
        return;
    }
    
    const prompt = {
        id: promptId || 'custom_' + Date.now(),
        name,
        description,
        outputType,
        content
    };
    
    if (promptId) {
        // Editace existujícího
        const index = currentPrompts.findIndex(p => p.id === promptId);
        if (index !== -1) {
            currentPrompts[index] = prompt;
        }
    } else {
        // Nový prompt
        currentPrompts.push(prompt);
    }
    
    savePrompts();
    updatePromptManagerList();
    closeModal('promptEditorModal');
    
    showNotification('Úspěch', 'Prompt byl úspěšně uložen!', 'success');
}

function deletePrompt(promptId) {
    if (confirm('Opravdu chcete smazat tento prompt?')) {
        currentPrompts = currentPrompts.filter(p => p.id !== promptId);
        savePrompts();
        updatePromptManagerList();
        showNotification('Úspěch', 'Prompt byl smazán.', 'success');
    }
}

// ==========================================
// SNAKE BORDER EFEKT
// ==========================================

function initSnakeBorder() {
    const wrapper = document.querySelector('.preview-frame-wrapper');
    const rects = wrapper.querySelectorAll('rect');

    function update() {
        const w = wrapper.clientWidth;
        const h = wrapper.clientHeight;
        const stroke = 2;

        rects.forEach(rect => {
            rect.setAttribute('x', stroke / 2);
            rect.setAttribute('y', stroke / 2);
            rect.setAttribute('width', w - stroke);
            rect.setAttribute('height', h - stroke);
        });

        const perimeter = 2 * (w + h) - 4 * stroke;
        wrapper.style.setProperty('--dash-length', `${perimeter}px`);

        const segment = perimeter * 0.6;
        wrapper.style.setProperty('--snake-segment', `${segment}px`);
    }

    update();
    new ResizeObserver(update).observe(wrapper);
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
    // Generování
    sendBtn.addEventListener('click', generate);
    continueBtn.addEventListener('click', continueGeneration);
    
    // Reset
    resetBtn.addEventListener('click', () => {
        aiPrompt.value = '';
        htmlBuffer = '';
        thinkBuffer = '';
        streamBuffer = '';
        partialAssistant = '';
        inThink = false;
        thingShown = false;
        overflowFlag = false;
        conversation = [];
        indexModel.setValue(`<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AICODE Logo Animation</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #f0f0f0;
            margin: 0;
            overflow: hidden;
        }

        .logo-container {
            position: relative;
            width: 200px;
            height: 200px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .logo-text {
            font-family: 'Arial', sans-serif;
            font-size: 4em;
            font-weight: bold;
            color: #333;
            position: relative;
            z-index: 2;
            animation: scaleIn 1s ease-out forwards;
        }

        .logo-text span {
            display: inline-block;
            opacity: 0;
            transform: translateY(20px);
            animation: fadeInSlideUp 1s ease-out forwards;
        }

        .logo-text span:nth-child(1) { animation-delay: 0.2s; }
        .logo-text span:nth-child(2) { animation-delay: 0.3s; }
        .logo-text span:nth-child(3) { animation-delay: 0.4s; }
        .logo-text span:nth-child(4) { animation-delay: 0.5s; }
        .logo-text span:nth-child(5) { animation-delay: 0.6s; }
        .logo-text span:nth-child(6) { animation-delay: 0.7s; }

        .code-lines {
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            overflow: hidden;
            z-index: 1;
        }

        .code-line {
            position: absolute;
            width: 2px;
            height: 100%;
            background: linear-gradient(to bottom, rgba(0, 123, 255, 0), rgba(0, 123, 255, 0.8), rgba(0, 123, 255, 0));
            opacity: 0;
            animation: codeFlow 3s infinite linear;
        }

        .code-line:nth-child(1) { left: 10%; animation-delay: 0s; height: 80%; top: 10%; }
        .code-line:nth-child(2) { left: 25%; animation-delay: 0.5s; height: 90%; top: 5%; }
        .code-line:nth-child(3) { left: 40%; animation-delay: 1s; height: 70%; top: 15%; }
        .code-line:nth-child(4) { left: 55%; animation-delay: 1.5s; height: 100%; top: 0; }
        .code-line:nth-child(5) { left: 70%; animation-delay: 2s; height: 85%; top: 8%; }
        .code-line:nth-child(6) { left: 85%; animation-delay: 2.5s; height: 75%; top: 12%; }

        @keyframes scaleIn {
            0% { transform: scale(0.5); opacity: 0; }
            80% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fadeInSlideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes codeFlow {
            0% { transform: translateY(-100%); opacity: 0; }
            20% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(100%); opacity: 0; }
        }
    </style>
</head>
<body>
    <div class="logo-container">
        <div class="code-lines">
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
            <div class="code-line"></div>
        </div>
        <div class="logo-text">
            <span>A</span><span>I</span><span>C</span><span>O</span><span>D</span><span>E</span>
        </div>
    </div>
</body>
</html>`);
        thingModel.setValue('');
        renderFrame.srcdoc = '';
        sendBtn.disabled = false;
        continueBtn.style.display = 'none';
        document.querySelector('.filename[data-model="thing"]').style.display = 'none';
        document.querySelector('.filename[data-model="index"]').click();
    });
    
    // Enter pro odeslání
    aiPrompt.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generate();
        }
    });
    
    // Auto-update toggle
    toggleAutoUpdateBtn.addEventListener('click', () => {
        autoUpdateEnabled = !autoUpdateEnabled;
        toggleAutoUpdateBtn.classList.toggle('active', autoUpdateEnabled);
        if (autoUpdateEnabled) updatePreview();
    });
    
    // Dropdowny
    document.querySelector('.model-dropdown-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.model-selector').classList.toggle('open');
        document.querySelector('.prompt-selector').classList.remove('open');
    });
    
    document.querySelector('.prompt-dropdown-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelector('.prompt-selector').classList.toggle('open');
        document.querySelector('.model-selector').classList.remove('open');
    });
    
    // Zavření dropdownů při kliku mimo
    document.addEventListener('click', closeDropdowns);
    
    // Modální okna
    document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
    document.getElementById('promptManagerBtn').addEventListener('click', () => {
        updatePromptManagerList();
        openModal('promptManagerModal');
    });
    
    // Zavření modálů
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal.id);
        });
    });
    
    // Zavření modálů při kliku na pozadí
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
    
    // Nastavení
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    
    // Range inputy
    document.getElementById('temperatureInput').addEventListener('input', (e) => {
        document.getElementById('temperatureValue').textContent = e.target.value;
    });
    
    document.getElementById('topPInput').addEventListener('input', (e) => {
        document.getElementById('topPValue').textContent = e.target.value;
    });
    
    // Přidání vlastního modelu
    document.getElementById('addModelBtn').addEventListener('click', () => {
        const input = document.getElementById('customModelInput');
        const modelId = input.value.trim();
        
        if (!modelId) return;
        
        if (modelId.includes('/')) {
            addCustomModel(modelId, modelId.split('/')[1]);
            input.value = '';
        } else {
            showNotification('Chyba', 'Model musí být ve formátu provider/model-name', 'error');
        }
    });
    
    // Správa promptů
    document.getElementById('newPromptBtn').addEventListener('click', newPrompt);
    document.getElementById('importPromptBtn').addEventListener('click', () => {
        document.getElementById('importPromptFile').click();
    });
    
    document.getElementById('importPromptFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importPrompt(file);
            e.target.value = '';
        }
    });
    
    // Download
    document.getElementById('downloadBtn').addEventListener('click', downloadProject);
    
    // Preview controls
    document.getElementById('refreshPreviewBtn').addEventListener('click', () => {
        doUpdatePreview();
    });
    
    document.getElementById('openNewWindowBtn').addEventListener('click', () => {
        const code = indexModel.getValue();
        const newWindow = window.open();
        newWindow.document.write(code);
        newWindow.document.close();
    });
    
    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
            previewWrapper.requestFullscreen().then(() => {
                document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-compress"></i>';
            }).catch(err => {
                console.error('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-expand"></i>';
            });
        }
    });
    
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.getElementById('fullscreenBtn').innerHTML = '<i class="fas fa-expand"></i>';
        }
    });
    
    // Resize functionality
    setupResizeHandlers();
}

// ==========================================
// RESIZE HANDLERS
// ==========================================

function setupResizeHandlers() {
    // Sidebar resizer
    const dragbar = document.getElementById('dragbar');
    const sidebar = document.getElementById('sidebar');
    
    let startX, startW;
    
    dragbar.addEventListener('pointerdown', e => {
        e.preventDefault();
        startX = e.clientX;
        startW = sidebar.offsetWidth;
        document.body.classList.add('dragging');
        dragbar.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onSidebarDrag);
        window.addEventListener('pointerup', onSidebarDragEnd);
    });
    
    function onSidebarDrag(e) {
        const delta = e.clientX - startX;
        const newWidth = Math.min(Math.max(60, startW + delta), window.innerWidth - 400);
        sidebar.style.width = newWidth + 'px';
    }
    
    function onSidebarDragEnd() {
        document.body.classList.remove('dragging');
        window.removeEventListener('pointermove', onSidebarDrag);
        window.removeEventListener('pointerup', onSidebarDragEnd);
    }
    
    // Main content resizer
    const resizeBar = document.getElementById('resizeBar');
    const editorContainer = document.querySelector('.editor-container');
    const previewContainer = document.querySelector('.preview-container');
    
    let startMainX, startEditorW, startPreviewW;
    let rafId = null;
    
    resizeBar.addEventListener('pointerdown', e => {
        e.preventDefault();
        startMainX = e.clientX;
        const rectEditor = editorContainer.getBoundingClientRect();
        const rectPreview = previewContainer.getBoundingClientRect();
        startEditorW = rectEditor.width;
        startPreviewW = rectPreview.width;
        document.body.classList.add('resizing');
        
        resizeBar.setPointerCapture(e.pointerId);
        window.addEventListener('pointermove', onMainDrag);
        window.addEventListener('pointerup', onMainDragEnd);
    });
    
    function onMainDrag(e) {
        const delta = e.clientX - startMainX;
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                const newEditorW = Math.max(300, startEditorW + delta);
                const newPreviewW = Math.max(300, startPreviewW - delta);
                editorContainer.style.flexBasis = newEditorW + 'px';
                previewContainer.style.flexBasis = newPreviewW + 'px';
                rafId = null;
            });
        }
    }
    
    function onMainDragEnd() {
        document.body.classList.remove('resizing');
        window.removeEventListener('pointermove', onMainDrag);
        window.removeEventListener('pointerup', onMainDragEnd);
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }
}

// ==========================================
// GLOBÁLNÍ FUNKCE PRO HTML
// ==========================================

// Tyto funkce musí být globální pro použití v HTML onclick atributech
window.removeCustomModel = removeCustomModel;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.exportPrompt = exportPrompt;