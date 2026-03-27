const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

// CORS Proxies
const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://cors-anywhere.herokuapp.com/'
];

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url, useProxy = true } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const result = await checkDomain(url, useProxy);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking domain:', error);
        res.status(500).json({ 
            error: error.message,
            url: url,
            statusCode: 'Error',
            statusText: error.message
        });
    }
};

async function checkDomain(url, useProxy) {
    // Normalize URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    let html;
    let statusCode;
    let statusText;

    try {
        // Try direct fetch first
        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000
        });

        statusCode = response.status;
        statusText = response.statusText;
        html = await response.text();
        
    } catch (directError) {
        if (!useProxy) {
            throw directError;
        }
        
        // Try with proxies
        let proxySuccess = false;
        for (const proxy of CORS_PROXIES) {
            try {
                const proxyUrl = proxy + encodeURIComponent(url);
                const response = await fetch(proxyUrl, {
                    headers: {
                        'User-Agent': getRandomUserAgent()
                    },
                    timeout: 15000
                });
                
                if (response.ok) {
                    html = await response.text();
                    statusCode = 200;
                    statusText = 'OK (via Proxy)';
                    proxySuccess = true;
                    break;
                }
            } catch (proxyError) {
                console.log(`Proxy ${proxy} failed:`, proxyError.message);
                continue;
            }
        }
        
        if (!proxySuccess) {
            throw new Error('Failed to fetch URL with all methods');
        }
    }

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract Title
    let title = 'Tidak ditemukan';
    const titleElement = document.querySelector('title');
    if (titleElement && titleElement.textContent) {
        title = titleElement.textContent.trim();
    }

    // Extract Canonical URL
    let canonical = '-';
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink && canonicalLink.getAttribute('href')) {
        canonical = canonicalLink.getAttribute('href');
    }

    // Detect AMP
    let amp = '-';
    const ampLink = document.querySelector('link[rel="amphtml"]');
    if (ampLink && ampLink.getAttribute('href')) {
        amp = ampLink.getAttribute('href');
    }

    // Check if page itself is AMP
    const htmlElement = document.querySelector('html');
    if (htmlElement) {
        const isAmp = htmlElement.hasAttribute('amp') || htmlElement.hasAttribute('⚡');
        if (isAmp && amp === '-') {
            amp = '✓ Halaman AMP (⚡)';
        }
    }

    // Check for AMP boilerplate
    if (html.includes('amp-boilerplate') && amp === '-') {
        amp = '✓ Menggunakan AMP Boilerplate';
    }

    return {
        url: url,
        statusCode: statusCode,
        statusText: statusText,
        title: title.substring(0, 200),
        canonical: canonical,
        amp: amp
    };
}

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}
