import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

async function extractTranscript() {
    try {
        // Get video ID from current URL
        const url = window.location.href;
        const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
        
        if (!videoId) {
            throw new Error('Could not find a valid YouTube video ID');
        }

        // Try to get English transcript first
        let transcript;
        try {
            transcript = await YoutubeTranscript.fetchTranscript(videoId, {
                lang: 'en'
            });
        } catch (error) {
            // If English not available, get default transcript
            transcript = await YoutubeTranscript.fetchTranscript(videoId);
        }

        if (!transcript || transcript.length === 0) {
            throw new Error('Failed to get transcript');
        }

        // Format the transcript
        const formattedTranscript = transcript
            .map(entry => {
                const timestamp = formatTimestamp(entry.offset / 1000);
                const cleanText = decodeHTMLEntities(entry.text);
                return `${timestamp} ${cleanText}`;
            })
            .join('\n');

        return formattedTranscript;

    } catch (error) {
        console.error('Transcript extraction error:', error);
        return `⚠ ${error.message}`;
    }
}

function formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function generateSummary(text) {
    try {
        // If no text provided, try to get transcript first
        if (!text || text.trim().length === 0) {
            try {
                text = await extractTranscript();
                if (!text || text.trim().length === 0) {
                    throw new Error('No text provided to summarize');
                }
            } catch (error) {
                throw new Error('Failed to get transcript: ' + error.message);
            }
        }

        // Initialize Gemini AI with safety settings
        const apiKey = "AIzaSyD71WGdepjZOC4uf3smuqY4zkYRtzYHKHw";
        const genAI = new GoogleGenerativeAI(apiKey);

        // Configure comprehensive safety settings
        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            }
        ];

        // Initialize model with enhanced configuration
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            safetySettings,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });

        // Craft a detailed prompt for better summaries
        const prompt = `
            I need you to create a summary of this video transcript that is both detailed and easy to read.

            Instructions:
            1. If the transcript is not in English, translate it to English first
            2. Break down the content into clear, logical sections
            3. Use bullet points to highlight key information
            4. Keep the summary concise while capturing the main ideas
            5. Include any important quotes, statistics, or specific details
            6. Format the output with HTML tags for better readability

            Here is the transcript to summarize:
            ${text}
        `;

        // Generate content with streaming
        const result = await model.generateContentStream(prompt);
        let formattedContent = '';

        // Process and format chunks as they arrive
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            formattedContent += chunkText;

            // Format the current content
            const formattedSummary = formattedContent
                .split('\n')
                .map(line => {
                    line = line.trim();
                    if (line.length === 0) return '';

                    if (line.endsWith(':')) {
                        return `<h2 style="font-size: 1.1em; color: #000; margin: 1em 0 0.3em 0; border-bottom: 1px solid #ddd; padding-bottom: 0.2em;">${line}</h2>`;
                    }

                    if (line.startsWith('* **')) {
                        const content = line.replace(/^\* \*\*(.*)\*\*$/, '$1');
                        return `<li style="font-size: 1em; margin: 0.3em 0; font-weight: bold;">${content}</li>`;
                    }

                    if (line.startsWith('*')) {
                        const content = line.replace(/^\* /, '');
                        return `<li style="font-size: 1em; margin: 0.3em 0;">${content}</li>`;
                    }

                    return `<p style="font-size: 1em; margin: 0.3em 0; line-height: 1.3;">${line}</p>`;
                })
                .filter(line => line.length > 0)
                .join('\n');

            // Wrap bullet points in unordered lists
            const wrappedSummary = formattedSummary.replace(
                /(<li[^>]*>.*?<\/li>\n*)+/g, 
                match => `<ul style="list-style-type: disc; margin: 0.3em 0 0.3em 1.5em;">${match}</ul>`
            );

            // Update the summary div with the latest content
            const summaryDiv = document.getElementById('summary');
            if (summaryDiv) {
                summaryDiv.innerHTML = wrappedSummary;
            }
        }

        return formattedContent;

    } catch (error) {
        console.error('Summary generation error:', error);
        
        if (error.message.includes('API key')) {
            throw new Error('❌ Invalid API key or quota exceeded. Please try again later.');
        }
        if (error.message.includes('SAFETY')) {
            throw new Error('⚠️ Content was blocked by safety filters. Please check the content and try again.');
        }
        if (error.message.includes('timeout')) {
            throw new Error('⏳ Request timed out. Please try again with a shorter transcript.');
        }
        
        throw new Error(`🔴 Summary generation failed: ${error.message}`);
    }
}

// Add this new function to decode HTML entities
function decodeHTMLEntities(text) {
    // First replace common HTML entities
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#32;': ' ',
        '&nbsp;': ' '
    };
    
    // Replace named entities
    text = text.replace(/&[a-z]+;/gi, entity => entities[entity] || entity);
    
    // Replace numeric entities (both decimal and hexadecimal)
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    text = text.replace(/&#x([a-f0-9]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // Use textarea for any remaining entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Function to create and add the summary button to YouTube's player controls
function createSummaryButton() {
    if (document.querySelector('.summary-btn')) return;

    const playerControls = document.querySelector('.ytp-right-controls');
    if (!playerControls) return;

    const summaryButton = document.createElement('button');
    summaryButton.className = 'ytp-button summary-btn';
    summaryButton.title = 'Generate Summary';
    summaryButton.innerHTML = `
        <svg height="100%" viewBox="0 0 24 24" width="100%">
            <path d="M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z" fill="currentColor"/>
        </svg>
    `;

    summaryButton.addEventListener('click', () => {
        const panel = document.getElementById('summary-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        } else {
            createSummaryPanel();
        }
    });

    playerControls.appendChild(summaryButton);
}

// Function to create and inject the summary panel
function createSummaryPanel() {
    if (document.getElementById('summary-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'summary-panel';
    panel.className = 'summary-panel';
    
    panel.innerHTML = `
        <div class="summary-header">
            <h2>Video Summary</h2>
            <div class="summary-controls">
                <button id="generateSummary" class="summary-btn">
                    <svg height="16" viewBox="0 0 16 16" width="16">
                        <path d="M2 2a1 1 0 011-1h10a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" fill="currentColor"/>
                        <path d="M4 4h8v2H4V4zm0 3h8v2H4V7zm0 3h4v2H4v-2z" fill="currentColor"/>
                    </svg>
                    Generate Summary
                </button>
            </div>
        </div>
        <div class="summary-content">
            <div id="summary" style="display: none; font-size: 14px; line-height: 1.4;"></div>
        </div>`;

    // Find the primary content area
    const primaryContent = document.querySelector('#primary-inner') || 
                          document.querySelector('#primary');
    
    if (primaryContent) {
        // Insert after the video player but before the comments
        const videoPlayer = primaryContent.querySelector('#player');
        if (videoPlayer) {
            videoPlayer.parentNode.insertBefore(panel, videoPlayer.nextSibling);
        } else {
            primaryContent.insertBefore(panel, primaryContent.firstChild);
        }
    }

    // Initialize event listener
    document.getElementById('generateSummary')?.addEventListener('click', handleSummarize);
}

// Handler for summarizing the transcript
async function handleSummarize() {
    const summaryDiv = document.getElementById('summary');
    
    if (!summaryDiv) {
        console.error('Summary div not found');
        return;
    }

    summaryDiv.style.display = 'block';
    summaryDiv.textContent = 'Generating summary...';

    try {
        await generateSummary();
    } catch (error) {
        if (summaryDiv) {
            summaryDiv.textContent = '⚠ Error generating summary: ' + error.message;
        }
    }
}

// Function to initialize the extension
function initializeExtension() {
    createSummaryButton();
    createSummaryPanel();
}

// Watch for YouTube navigation (since YouTube is a SPA)
const observer = new MutationObserver((mutations) => {
    if (window.location.pathname === '/watch' && !document.querySelector('.summary-btn')) {
        initializeExtension();
    }
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial run
if (window.location.pathname === '/watch') {
    initializeExtension();
}