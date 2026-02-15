// ========================================
// 設定區域 - 請在這裡設定你的 Cloudflare Worker 網址
// ========================================
const PROXY_URL = 'https://seomarketer.billionkmstudio.workers.dev'; // ← 你的 Worker 網址

// ========================================
// API Key 管理
// ========================================

let API_KEY = null;

// 檢查是否有儲存的 API Key
function checkApiKey() {
  const savedKey = localStorage.getItem('anthropic_api_key');
  if (savedKey) {
    API_KEY = savedKey;
    document.getElementById('apiKeyModal').classList.add('hidden');
    return true;
  } else {
    document.getElementById('apiKeyModal').classList.remove('hidden');
    return false;
  }
}

// 儲存 API Key
function saveApiKey() {
  const keyInput = document.getElementById('apiKeyInput');
  const key = keyInput.value.trim();
  
  if (!key) {
    alert('請輸入 API Key');
    return;
  }
  
  if (!key.startsWith('sk-ant-')) {
    alert('API Key 格式不正確，應該以 "sk-ant-" 開頭');
    return;
  }
  
  API_KEY = key;
  localStorage.setItem('anthropic_api_key', key);
  document.getElementById('apiKeyModal').classList.add('hidden');
  alert('✅ API Key 已儲存！現在可以開始使用了');
}

// 打開 API 設定
function openApiSettings() {
  document.getElementById('apiKeyModal').classList.remove('hidden');
  const savedKey = localStorage.getItem('anthropic_api_key');
  if (savedKey) {
    document.getElementById('apiKeyInput').value = savedKey;
  }
}

// ========================================
// Claude API 呼叫函數（使用代理）
// ========================================

async function callClaudeAPI(prompt, systemPrompt = '') {
  if (!API_KEY) {
    throw new Error('請先設定 API Key');
  }

  // 檢查是否已設定 PROXY_URL
  if (PROXY_URL === 'https://your-worker.workers.dev') {
    throw new Error('請先設定 Cloudflare Worker 網址。請參考 DEPLOYMENT_GUIDE.md');
  }

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '調用 API 失敗';
      
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || errorMessage;
        
        if (errorMessage.includes('credit') || errorMessage.includes('balance')) {
          errorMessage = 'API 額度不足，請前往 Anthropic Console 查看';
        } else if (errorMessage.includes('invalid') && errorMessage.includes('api key')) {
          errorMessage = 'API Key 無效，請檢查是否正確';
        } else if (errorMessage.includes('rate_limit')) {
          errorMessage = 'API 調用過於頻繁，請稍後再試';
        }
      } catch (e) {
        // ignore
      }
      
      throw new Error(errorMessage + ' (狀態碼: ' + response.status + ')');
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error('網路連線失敗。請確認已正確設定 Cloudflare Worker');
    }
    throw error;
  }
}

// ========================================
// 分頁切換
// ========================================

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  document.getElementById(tabName).classList.add('active');
  event.target.closest('.nav-item').classList.add('active');
}

// ========================================
// 功能 1: 關鍵字探測器
// ========================================

async function detectKeywords() {
  const businessType = document.getElementById('businessType').value.trim();
  const targetAudience = document.getElementById('targetAudience').value.trim();
  const btn = document.getElementById('keywordBtn');
  const resultArea = document.getElementById('keywordResult');
  
  if (!businessType) {
    alert('請輸入業務類型');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  resultArea.innerHTML = '';
  resultArea.classList.remove('show');
  
  try {
    const systemPrompt = `你是一位專業的 SEO 和內容行銷專家，專精於關鍵字研究和搜尋意圖分析。`;
    
    const prompt = `請針對以下業務類型進行關鍵字研究分析：

業務類型：${businessType}
${targetAudience ? `目標受眾：${targetAudience}` : ''}

請提供 8-10 個高潛力的長尾關鍵字建議，並以 JSON 格式回應（不要包含 markdown 程式碼區塊標記）：

{
  "keywords": [
    {
      "keyword": "具體的長尾關鍵字",
      "competition": "低|中|高",
      "searchIntent": "資訊型|商業型|交易型|導航型",
      "monthlySearchVolume": "估計的月搜尋量範圍",
      "reason": "為什麼推薦這個關鍵字的簡短說明"
    }
  ]
}

注意：
1. 關鍵字應該是台灣地區用戶會搜尋的繁體中文用語
2. 優先推薦競爭度「低」到「中」的關鍵字
3. 關鍵字應該具有明確的商業價值或轉換潛力
4. 考慮 2026 年的趨勢和用戶行為`;

    const response = await callClaudeAPI(prompt, systemPrompt);
    
    let data;
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      data = JSON.parse(cleanResponse);
    } catch (e) {
      throw new Error('無法解析 API 回應');
    }
    
    let html = '<h3>🎯 關鍵字建議</h3>';
    
    data.keywords.forEach((item, index) => {
      const competitionClass = 
        item.competition === '低' ? 'badge-low' : 
        item.competition === '中' ? 'badge-medium' : 'badge-high';
      
      html += `
        <div class="keyword-item">
          <h4>${index + 1}. ${item.keyword}</h4>
          <div class="keyword-meta">
            <span><strong>競爭度：</strong><span class="badge ${competitionClass}">${item.competition}</span></span>
            <span><strong>搜尋意圖：</strong>${item.searchIntent}</span>
            <span><strong>預估搜尋量：</strong>${item.monthlySearchVolume}</span>
          </div>
          <p style="margin-top: 8px; color: #5a6c7d;">${item.reason}</p>
        </div>
      `;
    });
    
    resultArea.innerHTML = html;
    resultArea.classList.add('show');
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-message">❌ 錯誤：${error.message}</div>`;
    resultArea.classList.add('show');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ========================================
// 功能 2: AI 內容生成器
// ========================================

async function generateContent() {
  const keyword = document.getElementById('contentKeyword').value.trim();
  const contentType = document.getElementById('contentType').value;
  const contentLength = document.getElementById('contentLength').value;
  const btn = document.getElementById('contentBtn');
  const resultArea = document.getElementById('contentResult');
  
  if (!keyword) {
    alert('請輸入主要關鍵字');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  resultArea.innerHTML = '';
  resultArea.classList.remove('show');
  
  try {
    const systemPrompt = `你是一位專業的 SEO 內容撰寫專家，擅長創作高品質、符合搜尋引擎優化的內容。`;
    
    const typeMap = {
      'blog': '部落格文章',
      'guide': '完整指南',
      'comparison': '比較評測',
      'howto': '教學文章',
      'qa': '常見問答'
    };
    
    const lengthMap = {
      'short': '800-1200 字',
      'medium': '1500-2000 字',
      'long': '2500 字以上'
    };
    
    const prompt = `請為以下主題創作一個完整的 SEO 優化內容大綱和草稿：

關鍵字：${keyword}
內容類型：${typeMap[contentType]}
目標長度：${lengthMap[contentLength]}

請以 JSON 格式回應（不要包含 markdown 程式碼區塊標記）：

{
  "title": "吸引人的文章標題（包含關鍵字）",
  "metaDescription": "150 字以內的 Meta Description",
  "outline": [
    {
      "heading": "H2 或 H3 標題",
      "content": "這個段落的內容重點描述"
    }
  ],
  "seoChecklist": [
    {
      "item": "檢查項目",
      "status": "完成|待處理",
      "note": "說明"
    }
  ],
  "suggestedImages": [
    "建議配圖的描述 1",
    "建議配圖的描述 2"
  ],
  "internalLinkSuggestions": [
    "建議的內部連結主題 1",
    "建議的內部連結主題 2"
  ]
}

注意：
1. 標題和內容都應使用繁體中文
2. 確保內容符合 E-E-A-T 原則（經驗、專業、權威、可信）
3. 包含具體的數據、案例或實用建議
4. 大綱應該邏輯清晰、層次分明`;

    const response = await callClaudeAPI(prompt, systemPrompt);
    
    let data;
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      data = JSON.parse(cleanResponse);
    } catch (e) {
      throw new Error('無法解析 API 回應');
    }
    
    let html = `
      <h3>📝 內容大綱與草稿</h3>
      
      <div class="content-section">
        <h4>📌 文章標題</h4>
        <p><strong>${data.title}</strong></p>
      </div>
      
      <div class="content-section">
        <h4>📄 Meta Description</h4>
        <p>${data.metaDescription}</p>
      </div>
      
      <div class="content-section">
        <h4>📋 內容大綱</h4>
        <ol>
    `;
    
    data.outline.forEach(section => {
      html += `
        <li>
          <strong>${section.heading}</strong>
          <p style="margin-top: 4px; color: #5a6c7d;">${section.content}</p>
        </li>
      `;
    });
    
    html += `
        </ol>
      </div>
      
      <div class="content-section">
        <h4>✅ SEO 檢查清單</h4>
        <ul style="list-style: none;">
    `;
    
    data.seoChecklist.forEach(item => {
      const icon = item.status === '完成' ? '✅' : '⏳';
      html += `<li>${icon} <strong>${item.item}</strong> - ${item.note}</li>`;
    });
    
    html += `
        </ul>
      </div>
      
      <div class="content-section">
        <h4>🖼️ 建議配圖</h4>
        <ul>
    `;
    
    data.suggestedImages.forEach(img => {
      html += `<li>${img}</li>`;
    });
    
    html += `
        </ul>
      </div>
      
      <div class="content-section">
        <h4>🔗 內部連結建議</h4>
        <ul>
    `;
    
    data.internalLinkSuggestions.forEach(link => {
      html += `<li>${link}</li>`;
    });
    
    html += `
        </ul>
      </div>
    `;
    
    resultArea.innerHTML = html;
    resultArea.classList.add('show');
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-message">❌ 錯誤：${error.message}</div>`;
    resultArea.classList.add('show');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ========================================
// 功能 3: 內容分發
// ========================================

async function distributeContent() {
  const title = document.getElementById('articleTitle').value.trim();
  const summary = document.getElementById('articleSummary').value.trim();
  const platforms = [];
  
  if (document.getElementById('platformFB').checked) platforms.push('Facebook');
  if (document.getElementById('platformIG').checked) platforms.push('Instagram');
  if (document.getElementById('platformThreads').checked) platforms.push('Threads');
  if (document.getElementById('platformXHS').checked) platforms.push('小紅書');
  if (document.getElementById('platformLinkedIn').checked) platforms.push('LinkedIn');
  if (document.getElementById('platformGBP').checked) platforms.push('Google 商家');
  
  const btn = document.getElementById('distributeBtn');
  const resultArea = document.getElementById('distributeResult');
  
  if (!title || !summary) {
    alert('請輸入文章標題和摘要');
    return;
  }
  
  if (platforms.length === 0) {
    alert('請至少選擇一個分發平台');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  resultArea.innerHTML = '';
  resultArea.classList.remove('show');
  
  try {
    const systemPrompt = `你是一位專業的社群媒體行銷專家，擅長為不同平台改寫內容，使其符合各平台的特性和受眾喜好。`;
    
    const prompt = `請將以下文章內容改寫成適合不同社群平台的版本：

文章標題：${title}
文章摘要：${summary}

需要分發到的平台：${platforms.join('、')}

請以 JSON 格式回應（不要包含 markdown 程式碼區塊標記）：

{
  "platforms": [
    {
      "platform": "平台名稱",
      "content": "適合該平台的貼文內容",
      "tips": "發布建議或注意事項",
      "hashtags": "建議使用的標籤（若適用）"
    }
  ]
}

注意：
1. Facebook：可以較長（300-500字），包含表情符號，鼓勵互動提問
2. Instagram：簡短有力（150-200字），多用表情符號，包含 3-5 個熱門標籤
3. Threads：簡潔對話式（100-150字），輕鬆友善的語氣
4. 小紅書：標題黨風格，多用表情符號，分段清晰，包含熱門標籤
5. LinkedIn：專業正式（200-300字），強調價值和專業見解，避免過多表情符號
6. Google 商家：簡潔明瞭（100-150字），包含行動呼籲和聯絡資訊
7. 所有內容都應使用繁體中文`;

    const response = await callClaudeAPI(prompt, systemPrompt);
    
    let data;
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      data = JSON.parse(cleanResponse);
    } catch (e) {
      throw new Error('無法解析 API 回應');
    }
    
    let html = '<h3>📢 分發內容</h3><p class="hint" style="margin-bottom: 20px;">💡 請複製以下內容到對應平台手動發布</p>';
    
    const platformIcons = {
      'Facebook': '📘',
      'Instagram': '📷',
      'Threads': '🧵',
      '小紅書': '📕',
      'LinkedIn': '💼',
      'Google 商家': '🏢'
    };
    
    data.platforms.forEach(platform => {
      const icon = platformIcons[platform.platform] || '📱';
      
      html += `
        <div class="platform-content">
          <h4>${icon} ${platform.platform}</h4>
          <div style="background: var(--bg-main); padding: var(--space-md); border-radius: var(--radius-sm); margin: var(--space-sm) 0;">
            <p style="white-space: pre-wrap; background: transparent; padding: 0;">${platform.content}</p>
          </div>
      `;
      
      if (platform.hashtags) {
        html += `
          <p style="margin-top: 8px; font-size: 0.9rem; color: var(--primary);">
            <strong>📌 建議標籤：</strong>${platform.hashtags}
          </p>
        `;
      }
      
      html += `
          <button class="copy-btn" onclick="copyToClipboard(\`${platform.content.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, this)">
            📋 複製內容
          </button>
          <p style="margin-top: 12px; font-size: 0.85rem; color: #5a6c7d;">
            <strong>💡 發布建議：</strong>${platform.tips}
          </p>
        </div>
      `;
    });
    
    resultArea.innerHTML = html;
    resultArea.classList.add('show');
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-message">❌ 錯誤：${error.message}</div>`;
    resultArea.classList.add('show');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ========================================
// 功能 4: SEO 健康度檢查
// ========================================

async function checkSeoHealth() {
  const siteUrl = document.getElementById('siteUrl').value.trim();
  const targetKeywords = document.getElementById('targetKeywords').value.trim();
  const btn = document.getElementById('healthBtn');
  const resultArea = document.getElementById('healthResult');
  
  if (!siteUrl) {
    alert('請輸入網站網址');
    return;
  }
  
  btn.classList.add('loading');
  btn.disabled = true;
  resultArea.innerHTML = '';
  resultArea.classList.remove('show');
  
  try {
    const systemPrompt = `你是一位專業的 SEO 顧問，擅長網站分析和 SEO 優化建議。`;
    
    const prompt = `請為以下網站提供 SEO 健康度分析和優化建議：

網站網址：${siteUrl}
${targetKeywords ? `目標關鍵字：${targetKeywords}` : ''}

請基於 SEO 最佳實踐，以 JSON 格式提供分析報告（不要包含 markdown 程式碼區塊標記）：

{
  "overallScore": 75,
  "scores": {
    "技術 SEO": 80,
    "內容品質": 70,
    "使用者體驗": 75,
    "行動友善": 85
  },
  "criticalIssues": [
    "需要立即修正的嚴重問題"
  ],
  "suggestions": [
    {
      "category": "分類（技術/內容/連結/使用者體驗）",
      "title": "建議標題",
      "description": "詳細說明",
      "priority": "高|中|低",
      "impact": "預期影響"
    }
  ],
  "quickWins": [
    "可以快速實施的改善項目"
  ]
}

注意：
1. 提供具體、可執行的建議
2. 考慮台灣地區的 SEO 特性
3. 所有回應使用繁體中文
4. 評分範圍為 0-100`;

    const response = await callClaudeAPI(prompt, systemPrompt);
    
    let data;
    try {
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      data = JSON.parse(cleanResponse);
    } catch (e) {
      throw new Error('無法解析 API 回應');
    }
    
    let html = `
      <h3>📊 SEO 健康度報告</h3>
      
      <div class="health-score">
        <div class="score-card">
          <div class="score-label">總體評分</div>
          <div class="score-value" style="color: ${getScoreColor(data.overallScore)}">
            ${data.overallScore}
          </div>
        </div>
    `;
    
    Object.entries(data.scores).forEach(([key, value]) => {
      html += `
        <div class="score-card">
          <div class="score-label">${key}</div>
          <div class="score-value" style="color: ${getScoreColor(value)}; font-size: 2rem;">
            ${value}
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    
    if (data.criticalIssues && data.criticalIssues.length > 0) {
      html += `
        <div class="content-section" style="border-left-color: #e74c3c;">
          <h4>🚨 嚴重問題</h4>
          <ul>
      `;
      data.criticalIssues.forEach(issue => {
        html += `<li style="color: #e74c3c;">${issue}</li>`;
      });
      html += `</ul></div>`;
    }
    
    html += `
      <div class="suggestions-list">
        <h4>💡 優化建議</h4>
    `;
    
    data.suggestions.forEach(suggestion => {
      const priorityColor = 
        suggestion.priority === '高' ? '#e74c3c' :
        suggestion.priority === '中' ? '#f39c12' : '#27ae60';
      
      html += `
        <div class="suggestion-item">
          <strong style="color: ${priorityColor};">
            [${suggestion.priority}] ${suggestion.category}：${suggestion.title}
          </strong>
          <p style="margin-top: 4px;">${suggestion.description}</p>
          <p style="margin-top: 4px; font-size: 0.85rem; color: #5a6c7d;">
            <strong>預期影響：</strong>${suggestion.impact}
          </p>
        </div>
      `;
    });
    
    html += `</div>`;
    
    if (data.quickWins && data.quickWins.length > 0) {
      html += `
        <div class="content-section" style="border-left-color: #27ae60;">
          <h4>⚡ 快速改善項目</h4>
          <ul>
      `;
      data.quickWins.forEach(win => {
        html += `<li>${win}</li>`;
      });
      html += `</ul></div>`;
    }
    
    // 加入生成 PDF 報告按鈕
    html += `
      <div style="margin-top: 30px; text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
        <button onclick="generateSEOPDF()" class="btn-pdf" style="background: white; color: #667eea; padding: 16px 32px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: all 0.3s ease;">
          📄 生成 PDF 報告
        </button>
        <p style="margin-top: 12px; color: white; font-size: 0.9rem; opacity: 0.9;">
          將分析報告匯出為 PDF，方便分享給團隊成員
        </p>
      </div>
    `;
    
    resultArea.innerHTML = html;
    resultArea.classList.add('show');
    
    // 儲存報告數據以供 PDF 生成使用
    window.seoReportData = {
      siteUrl: siteUrl,
      targetKeywords: targetKeywords,
      date: new Date().toLocaleDateString('zh-TW'),
      ...data
    };
    
    
  } catch (error) {
    resultArea.innerHTML = `<div class="error-message">❌ 錯誤：${error.message}</div>`;
    resultArea.classList.add('show');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ========================================
// 輔助函數
// ========================================

function getScoreColor(score) {
  if (score >= 80) return '#27ae60';
  if (score >= 60) return '#f39c12';
  return '#e74c3c';
}

// ========================================
// 生成 SEO PDF 報告（使用 jsPDF + AutoTable）
// ========================================
async function generateSEOPDF() {
  if (!window.seoReportData) {
    alert('找不到報告數據，請重新執行分析');
    return;
  }
  
  // 檢查函式庫
  if (typeof jspdf === 'undefined' || typeof jspdf.jsPDF === 'undefined') {
    alert('PDF 函式庫載入失敗，請重新整理頁面');
    return;
  }
  
  const data = window.seoReportData;
  const btn = event.target;
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ 生成中...';
  btn.disabled = true;
  
  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = margin;
    
    // 輔助函數：檢查換頁
    const checkPageBreak = (neededSpace) => {
      if (y + neededSpace > pageHeight - 20) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };
    
    // 1. 標題背景
    doc.setFillColor(26, 77, 122);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // 標題文字
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('SEO Health Analysis Report', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Professional Website SEO Diagnosis & Optimization', pageWidth / 2, 30, { align: 'center' });
    
    y = 55;
    
    // 2. 網站資訊框
    doc.setFillColor(248, 249, 252);
    doc.rect(margin, y, pageWidth - 2 * margin, 25, 'F');
    
    doc.setDrawColor(243, 156, 18);
    doc.setLineWidth(2);
    doc.line(margin, y, margin, y + 25);
    
    doc.setTextColor(90, 108, 125);
    doc.setFontSize(10);
    doc.text(`Website: ${data.siteUrl}`, margin + 5, y + 8);
    if (data.targetKeywords) {
      doc.text(`Keywords: ${data.targetKeywords}`, margin + 5, y + 16);
    }
    doc.text(`Date: ${data.date}`, margin + 5, y + (data.targetKeywords ? 24 : 16));
    
    y += 35;
    
    // 3. 總體評分
    checkPageBreak(40);
    doc.setTextColor(26, 77, 122);
    doc.setFontSize(16);
    doc.text('Overall Score', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    const scoreColor = getScoreColorRGB(data.overallScore);
    doc.setFillColor(...scoreColor);
    doc.circle(pageWidth / 2, y + 15, 18, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(36);
    doc.setFont('helvetica', 'bold');
    doc.text(data.overallScore.toString(), pageWidth / 2, y + 20, { align: 'center' });
    
    doc.setTextColor(90, 108, 125);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('/ 100', pageWidth / 2, y + 32, { align: 'center' });
    
    y += 45;
    
    // 4. 分項評分表格
    checkPageBreak(60);
    doc.setTextColor(26, 77, 122);
    doc.setFontSize(14);
    doc.text('Category Scores', margin, y);
    y += 8;
    
    const categoryMap = {
      '技術 SEO': 'Technical SEO',
      '內容品質': 'Content Quality',
      '使用者體驗': 'User Experience',
      '行動友善': 'Mobile Friendly'
    };
    
    const scoreTableData = Object.entries(data.scores).map(([key, value]) => {
      const engName = categoryMap[key] || key;
      return [engName, value.toString()];
    });
    
    doc.autoTable({
      startY: y,
      head: [['Category', 'Score']],
      body: scoreTableData,
      theme: 'grid',
      headStyles: { fillColor: [26, 77, 122], fontSize: 11 },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 40, halign: 'center', fontStyle: 'bold' }
      },
      didDrawCell: function(data) {
        if (data.column.index === 1 && data.section === 'body') {
          const score = parseInt(data.cell.text[0]);
          const color = getScoreColorRGB(score);
          doc.setTextColor(...color);
        }
      }
    });
    
    y = doc.lastAutoTable.finalY + 15;
    
    // 5. 嚴重問題
    if (data.criticalIssues && data.criticalIssues.length > 0) {
      checkPageBreak(40);
      
      doc.setFillColor(254, 242, 242);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setDrawColor(231, 76, 60);
      doc.setLineWidth(2);
      doc.line(margin, y, margin, y + 10);
      
      doc.setTextColor(231, 76, 60);
      doc.setFontSize(14);
      doc.text('Critical Issues', margin + 5, y + 7);
      y += 15;
      
      const issuesData = data.criticalIssues.map((issue, i) => [`${i + 1}`, issue]);
      
      doc.autoTable({
        startY: y,
        body: issuesData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 10, fontStyle: 'bold', textColor: [231, 76, 60] },
          1: { cellWidth: 'auto' }
        }
      });
      
      y = doc.lastAutoTable.finalY + 15;
    }
    
    // 6. 優化建議
    checkPageBreak(30);
    doc.setTextColor(26, 77, 122);
    doc.setFontSize(14);
    doc.text('Optimization Suggestions', margin, y);
    y += 10;
    
    const priorityMap = {
      '高': 'High',
      '中': 'Medium',  
      '低': 'Low'
    };
    
    data.suggestions.forEach((suggestion, index) => {
      checkPageBreak(35);
      
      const priorityColor = 
        suggestion.priority === '高' ? [231, 76, 60] :
        suggestion.priority === '中' ? [243, 156, 18] : [39, 174, 96];
      
      // 優先級標籤
      doc.setFillColor(...priorityColor);
      doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      const engPriority = priorityMap[suggestion.priority] || suggestion.priority;
      doc.text(`[${engPriority}] ${suggestion.category}`, margin + 3, y + 5.5);
      
      y += 12;
      
      // 建議內容
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(suggestion.title, pageWidth - 2 * margin - 4);
      doc.text(titleLines, margin + 2, y);
      y += titleLines.length * 5 + 2;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(suggestion.description, pageWidth - 2 * margin - 4);
      doc.text(descLines, margin + 2, y);
      y += descLines.length * 4.5 + 2;
      
      doc.setTextColor(90, 108, 125);
      doc.setFontSize(8);
      const impactLines = doc.splitTextToSize(`Impact: ${suggestion.impact}`, pageWidth - 2 * margin - 4);
      doc.text(impactLines, margin + 2, y);
      y += impactLines.length * 4 + 10;
    });
    
    // 7. 快速改善項目
    if (data.quickWins && data.quickWins.length > 0) {
      checkPageBreak(40);
      
      doc.setFillColor(232, 245, 233);
      doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
      doc.setDrawColor(39, 174, 96);
      doc.setLineWidth(2);
      doc.line(margin, y, margin, y + 10);
      
      doc.setTextColor(39, 174, 96);
      doc.setFontSize(14);
      doc.text('Quick Wins', margin + 5, y + 7);
      y += 15;
      
      const winsData = data.quickWins.map((win, i) => [`${i + 1}`, win]);
      
      doc.autoTable({
        startY: y,
        body: winsData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 10, fontStyle: 'bold', textColor: [39, 174, 96] },
          1: { cellWidth: 'auto' }
        }
      });
    }
    
    // 8. 頁尾（所有頁面）
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${totalPages}`,
        margin,
        pageHeight - 12
      );
      
      doc.text(
        'Generated by SEO Assistant',
        pageWidth / 2,
        pageHeight - 12,
        { align: 'center' }
      );
      
      doc.text(
        `Powered by Billion Studio | ${data.date}`,
        pageWidth - margin,
        pageHeight - 12,
        { align: 'right' }
      );
    }
    
    // 儲存
    const fileName = `SEO分析報告_${data.siteUrl.replace(/https?:\/\//, '').replace(/[\/\:]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    btn.innerHTML = '✅ 已下載！';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 2000);
    
  } catch (error) {
    console.error('PDF Error:', error);
    alert('生成 PDF 失敗：' + error.message);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// RGB 顏色轉換
function getScoreColorRGB(score) {
  if (score >= 80) return [39, 174, 96];
  if (score >= 60) return [243, 156, 18];
  return [231, 76, 60];
}

// 輔助函數：將分數轉換為 RGB 顏色
function getScoreColorRGB(score) {
  if (score >= 80) return [39, 174, 96];  // 綠色
  if (score >= 60) return [243, 156, 18]; // 橙色
  return [231, 76, 60]; // 紅色
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = '✅ 已複製！';
    button.style.background = '#27ae60';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
    }, 2000);
  }).catch(err => {
    alert('複製失敗：' + err);
  });
}

// ========================================
// 初始化
// ========================================

window.addEventListener('DOMContentLoaded', () => {
  checkApiKey();
});
