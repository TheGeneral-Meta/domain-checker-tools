let resultsData = [];
let isChecking = false;

// API endpoint (Vercel Serverless Function)
const API_URL = '/api/check-domain';

// Switch mode between single and batch
function switchMode(mode) {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.mode-content').forEach(content => content.classList.remove('active'));
    
    if (mode === 'single') {
        document.querySelector('.mode-btn:first-child').classList.add('active');
        document.getElementById('singleMode').classList.add('active');
    } else {
        document.querySelector('.mode-btn:last-child').classList.add('active');
        document.getElementById('batchMode').classList.add('active');
    }
}

// Check single URL
async function checkSingleUrl() {
    const url = document.getElementById('singleUrl').value.trim();
    if (!url) {
        showNotification('⚠️ Mohon masukkan URL!', 'error');
        return;
    }
    await checkUrls([url]);
}

// Check batch URLs
async function checkBatchUrls() {
    const urlsText = document.getElementById('batchUrls').value;
    if (!urlsText.trim()) {
        showNotification('⚠️ Mohon masukkan URL!', 'error');
        return;
    }
    
    const urls = urlsText.split('\n')
        .map(url => url.trim())
        .filter(url => url && !url.startsWith('#'));
    
    if (urls.length === 0) {
        showNotification('⚠️ Mohon masukkan URL yang valid!', 'error');
        return;
    }
    
    await checkUrls(urls);
}

// Main checking function
async function checkUrls(urls) {
    if (isChecking) {
        showNotification('Sedang melakukan pengecekan, harap tunggu!', 'warning');
        return;
    }
    
    isChecking = true;
    const loading = document.getElementById('loading');
    const resultsTable = document.getElementById('resultsTable');
    const noResults = document.getElementById('noResults');
    const resultsHeader = document.getElementById('resultsHeader');
    const progressFill = document.getElementById('progressFill');
    const loadingText = document.getElementById('loadingText');
    
    loading.style.display = 'block';
    resultsTable.style.display = 'none';
    noResults.style.display = 'none';
    resultsHeader.style.display = 'none';
    
    resultsData = [];
    let completed = 0;
    
    for (let i = 0; i < urls.length; i++) {
        const url = normalizeUrl(urls[i]);
        loadingText.textContent = `Memproses URL ${i + 1} dari ${urls.length}: ${url}`;
        progressFill.style.width = `${(i / urls.length) * 100}%`;
        
        try {
            const result = await checkUrlWithRetry(url);
            resultsData.push(result);
        } catch (error) {
            console.error(`Error checking ${url}:`, error);
            resultsData.push({
                url: url,
                statusCode: 'Error',
                statusText: error.message,
                title: '❌ Gagal mengambil halaman',
                canonical: '-',
                amp: '-',
                responseTime: 0,
                timestamp: new Date().toLocaleString('id-ID'),
                error: error.message
            });
        }
        
        completed++;
        updateResultsTable();
        
        // Delay to avoid rate limiting
        if (i < urls.length - 1) {
            await delay(500);
        }
    }
    
    progressFill.style.width = '100%';
    loadingText.textContent = 'Selesai! Memuat hasil...';
    await delay(500);
    
    loading.style.display = 'none';
    resultsTable.style.display = 'table';
    resultsHeader.style.display = 'flex';
    isChecking = false;
    
    showNotification(`✅ Pengecekan selesai! ${resultsData.length} URL diproses.`, 'success');
}

// Check URL with retry mechanism
async function checkUrlWithRetry(url, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await checkUrl(url);
        } catch (error) {
            if (i === retries) throw error;
            await delay(1000);
        }
    }
}

// Check single URL via API
async function checkUrl(url) {
    const useProxy = document.getElementById('useProxy').checked;
    const startTime = Date.now();
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            url: url,
            useProxy: useProxy
        })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const responseTime = Date.now() - startTime;
    
    return {
        ...data,
        responseTime: responseTime,
        timestamp: new Date().toLocaleString('id-ID')
    };
}

// Normalize URL
function normalizeUrl(url) {
    url = url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    return url;
}

// Update results table
function updateResultsTable() {
    const tbody = document.getElementById('resultsBody');
    const showResponseTime = document.getElementById('showResponseTime').checked;
    tbody.innerHTML = '';
    
    resultsData.forEach((result, index) => {
        const row = tbody.insertRow();
        
        row.insertCell(0).textContent = index + 1;
        
        // URL Cell
        const urlCell = row.insertCell(1);
        urlCell.className = 'url-cell';
        const urlLink = document.createElement('a');
        urlLink.href = result.url;
        urlLink.textContent = result.url;
        urlLink.target = '_blank';
        urlLink.title = 'Klik untuk membuka';
        urlCell.appendChild(urlLink);
        
        // Status HTTP
        const statusCell = row.insertCell(2);
        const statusCode = parseInt(result.statusCode);
        
        if (statusCode && statusCode < 400) {
            statusCell.className = 'status-success';
            statusCell.innerHTML = `✓ ${result.statusCode} ${result.statusText}`;
        } else if (statusCode && statusCode >= 300 && statusCode < 400) {
            statusCell.className = 'status-warning';
            statusCell.innerHTML = `↻ ${result.statusCode} ${result.statusText}`;
        } else {
            statusCell.className = 'status-error';
            statusCell.innerHTML = `✗ ${result.statusCode || 'Error'} ${result.statusText || ''}`;
        }
        
        // Title
        const titleCell = row.insertCell(3);
        titleCell.title = result.title;
        titleCell.textContent = result.title.length > 80 ? result.title.substring(0, 80) + '...' : result.title;
        
        // Canonical
        const canonicalCell = row.insertCell(4);
        if (result.canonical && result.canonical !== '-') {
            const canonicalLink = document.createElement('a');
            canonicalLink.href = result.canonical;
            canonicalLink.textContent = result.canonical.length > 60 ? result.canonical.substring(0, 60) + '...' : result.canonical;
            canonicalLink.target = '_blank';
            canonicalLink.style.color = '#4ecdc4';
            canonicalLink.style.textDecoration = 'none';
            canonicalCell.appendChild(canonicalLink);
        } else {
            canonicalCell.textContent = result.canonical || '-';
        }
        
        // AMP
        const ampCell = row.insertCell(5);
        if (result.amp && result.amp !== '-') {
            const isAmpUrl = result.amp.includes('http');
            if (isAmpUrl) {
                const ampLink = document.createElement('a');
                ampLink.href = result.amp;
                ampLink.textContent = result.amp.length > 60 ? result.amp.substring(0, 60) + '...' : result.amp;
                ampLink.target = '_blank';
                ampLink.style.color = '#ff6b6b';
                ampLink.style.textDecoration = 'none';
                ampCell.appendChild(ampLink);
            } else {
                ampCell.innerHTML = `<span class="badge-amp">${result.amp}</span>`;
            }
        } else {
            ampCell.textContent = result.amp || '-';
        }
        
        // Response Time
        if (showResponseTime) {
            const timeCell = row.insertCell(6);
            if (result.responseTime) {
                timeCell.textContent = `${result.responseTime} ms`;
                timeCell.style.color = result.responseTime < 1000 ? '#28a745' : result.responseTime < 3000 ? '#ffc107' : '#dc3545';
            } else {
                timeCell.textContent = '-';
            }
            row.insertCell(7).textContent = result.timestamp;
        } else {
            row.insertCell(6).textContent = result.timestamp;
        }
    });
    
    updateSummary(showResponseTime);
}

// Update summary statistics
function updateSummary(showResponseTime) {
    const totalUrls = resultsData.length;
    const successUrls = resultsData.filter(r => r.statusCode && parseInt(r.statusCode) < 400).length;
    const redirectUrls = resultsData.filter(r => r.statusCode && parseInt(r.statusCode) >= 300 && parseInt(r.statusCode) < 400).length;
    const failedUrls = totalUrls - successUrls - redirectUrls;
    const avgResponseTime = resultsData.filter(r => r.responseTime).reduce((sum, r) => sum + r.responseTime, 0) / totalUrls;
    const withCanonical = resultsData.filter(r => r.canonical && r.canonical !== '-').length;
    const withAmp = resultsData.filter(r => r.amp && r.amp !== '-').length;
    
    const summaryDiv = document.getElementById('summaryInfo');
    summaryDiv.innerHTML = `
        <div><strong>📊 Total:</strong> ${totalUrls}</div>
        <div><strong style="color: #28a745;">✓ Sukses:</strong> ${successUrls}</div>
        <div><strong style="color: #ffc107;">↻ Redirect:</strong> ${redirectUrls}</div>
        <div><strong style="color: #dc3545;">✗ Gagal:</strong> ${failedUrls}</div>
        ${showResponseTime ? `<div><strong>⏱️ Avg Response:</strong> ${Math.round(avgResponseTime)} ms</div>` : ''}
        <div><strong>🔗 With Canonical:</strong> ${withCanonical}</div>
        <div><strong>⚡ With AMP:</strong> ${withAmp}</div>
    `;
}

// Clear all results
function clearResults() {
    resultsData = [];
    document.getElementById('resultsBody').innerHTML = '';
    document.getElementById('resultsTable').style.display = 'none';
    document.getElementById('noResults').style.display = 'block';
    document.getElementById('resultsHeader').style.display = 'none';
    document.getElementById('singleUrl').value = '';
    document.getElementById('batchUrls').value = '';
    showNotification('🗑️ Hasil pengecekan telah dibersihkan', 'info');
}

// Export to CSV
function exportToCSV() {
    if (resultsData.length === 0) {
        showNotification('Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const showResponseTime = document.getElementById('showResponseTime').checked;
    const headers = ['No', 'URL', 'Status Code', 'Status Text', 'Title', 'Canonical', 'AMP'];
    if (showResponseTime) headers.push('Response Time (ms)');
    headers.push('Waktu Cek');
    
    const csvRows = [headers];
    
    resultsData.forEach((result, index) => {
        const row = [
            index + 1,
            result.url,
            result.statusCode,
            result.statusText,
            `"${result.title.replace(/"/g, '""')}"`,
            result.canonical,
            result.amp
        ];
        if (showResponseTime) row.push(result.responseTime || '-');
        row.push(result.timestamp);
        csvRows.push(row.join(','));
    });
    
    downloadFile(csvRows.join('\n'), 'csv', 'domain_check_report.csv');
}

// Export to JSON
function exportToJSON() {
    if (resultsData.length === 0) {
        showNotification('Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const exportData = resultsData.map((result, index) => ({
        no: index + 1,
        ...result
    }));
    
    downloadFile(JSON.stringify(exportData, null, 2), 'json', 'domain_check_report.json');
}

// Download file helper
function downloadFile(content, type, filename) {
    const mimeTypes = {
        csv: 'text/csv;charset=utf-8;',
        json: 'application/json;charset=utf-8;'
    };
    
    const blob = new Blob([content], { type: mimeTypes[type] });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification(`📥 File ${filename} berhasil diunduh`, 'success');
}

// Load example URLs
function loadExamples() {
    const examples = [
        'https://www.google.com',
        'https://github.com',
        'https://www.bbc.com',
        'https://www.cnn.com',
        'https://www.nytimes.com'
    ];
    document.getElementById('batchUrls').value = examples.join('\n');
    showNotification('📝 Contoh URL telah dimuat', 'info');
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warning' ? '#ffc107' : '#17a2b8'};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Delay helper
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Event listeners
document.getElementById('singleUrl').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkSingleUrl();
    }
});

document.getElementById('showResponseTime').addEventListener('change', function() {
    if (resultsData.length > 0) {
        updateResultsTable();
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('✅ Domain Checker Tools Pro siap digunakan!');
