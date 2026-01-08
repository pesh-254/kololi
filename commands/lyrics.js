const axios = require('axios');
const cheerio = require('cheerio');

async function lyricsCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || 
                    message.message?.extendedTextMessage?.text;

        if (!text) {
            return await sock.sendMessage(chatId, { 
                text: `🎵 *Lyrics Finder*\n\n!lyrics <song name>\n\nExamples:\n!lyrics "Home by NF"\n!lyrics "Blinding Lights The Weeknd"\n!lyrics "Shape of You Ed Sheeran"` 
            });
        }

        const parts = text.split(' ');
        const searchQuery = parts.slice(1).join(' ').trim();

        if (!searchQuery) {
            return await sock.sendMessage(chatId, { 
                text: `Need song name after !lyrics\nExample: !lyrics "blinding lights the weeknd"` 
            });
        }

        console.log(`🎵 [LYRICS] Searching for: ${searchQuery}`);

        const statusMsg = await sock.sendMessage(chatId, { 
            text: `🔍 *Searching lyrics*: "${searchQuery}"` 
        });

        const lyricsData = await getLyricsEnhanced(searchQuery);
        
        if (lyricsData && lyricsData.lyrics) {
            const formattedLyrics = formatLyrics(lyricsData);
            await sock.sendMessage(chatId, { 
                text: formattedLyrics
            });
            console.log(`✅ [LYRICS] Successfully sent lyrics for: ${lyricsData.title}`);
        } else {
            await sock.sendMessage(chatId, { 
                text: `❌ *Lyrics Not Found*\n\n"${searchQuery}"\n\n🌐 *Search manually:*\n• https://genius.com/search?q=${encodeURIComponent(searchQuery)}\n• https://www.azlyrics.com/lyrics/${generateAZLyricsPath(searchQuery)}\n• https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' lyrics')}\n\n💡 *Tip:* Try the exact song title with artist name`
            });
        }

    } catch (error) {
        console.error("❌ [LYRICS] ERROR:", error);
        await sock.sendMessage(chatId, { 
            text: `❌ Error: ${error.message}` 
        });
    }
}

// Enhanced lyrics search with multiple methods
async function getLyricsEnhanced(query) {
    const methods = [
        { name: 'Meta API', func: getMetaLyrics },
        { name: 'Lyrics.ovh API', func: getLyricsOvh },
        { name: 'Genius Scrape', func: scrapeGeniusLyrics },
        { name: 'AZLyrics Scrape', func: scrapeAZLyrics },
        { name: 'Google Search', func: searchGoogleLyrics }
    ];

    for (const method of methods) {
        try {
            console.log(`🔍 Trying ${method.name}...`);
            const result = await method.func(query);
            if (result && result.lyrics && result.lyrics.length > 50) {
                console.log(`✅ Found lyrics with ${method.name}`);
                return result;
            }
        } catch (error) {
            console.log(`❌ ${method.name} failed:`, error.message);
        }
    }
    return null;
}

// NEW: Meta API method
async function getMetaLyrics(query) {
    try {
        const metaUrl = `https://meta-api.zone.id/search/lyricsv2?title=${encodeURIComponent(query)}`;
        const response = await axios.get(metaUrl, { timeout: 15000 });

        if (response.data && response.data.data && response.data.data.length > 0) {
            const result = response.data.data[0];
            return {
                title: result.trackName || query,
                artist: result.artistName || 'Unknown Artist',
                lyrics: result.plainLyrics || '',
                source: 'Meta API',
                duration: result.duration || 0
            };
        }
    } catch (error) {
        throw new Error('Meta API failed');
    }
}

// Method 1: Lyrics.ovh API
async function getLyricsOvh(query) {
    try {
        const parsed = parseSongQuery(query);
        const response = await axios.get(
            `https://api.lyrics.ovh/v1/${encodeURIComponent(parsed.artist)}/${encodeURIComponent(parsed.title)}`,
            { timeout: 15000 }
        );

        if (response.data && response.data.lyrics) {
            return {
                title: parsed.title,
                artist: parsed.artist,
                lyrics: response.data.lyrics,
                source: 'Lyrics.ovh'
            };
        }
    } catch (error) {
        throw new Error('Lyrics.ovh API failed');
    }
}

// Method 2: Scrape Genius.com
async function scrapeGeniusLyrics(query) {
    try {
        const searchUrl = `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`;
        const searchResponse = await axios.get(searchUrl, { timeout: 20000 });
        
        if (searchResponse.data && searchResponse.data.response) {
            const sections = searchResponse.data.response.sections;
            for (const section of sections) {
                if (section.type === 'song') {
                    const song = section.hits[0]?.result;
                    if (song) {
                        const songResponse = await axios.get(song.url, { timeout: 20000 });
                        const $ = cheerio.load(songResponse.data);
                        
                        let lyrics = '';
                        $('[data-lyrics-container="true"]').each((i, elem) => {
                            lyrics += $(elem).text() + '\n\n';
                        });
                        
                        if (lyrics.trim().length > 100) {
                            return {
                                title: song.title,
                                artist: song.primary_artist.name,
                                lyrics: lyrics.trim(),
                                source: 'Genius.com',
                                url: song.url
                            };
                        }
                    }
                }
            }
        }
        throw new Error('No lyrics found on Genius');
    } catch (error) {
        throw new Error(`Genius scrape failed: ${error.message}`);
    }
}

// Method 3: Scrape AZLyrics
async function scrapeAZLyrics(query) {
    try {
        const parsed = parseSongQuery(query);
        
        const artistSlug = parsed.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleSlug = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        const azUrl = `https://www.azlyrics.com/lyrics/${artistSlug}/${titleSlug}.html`;
        
        const response = await axios.get(azUrl, { 
            timeout: 20000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        let lyrics = '';
        $('div.main-page div.row div.text-center div').each((i, elem) => {
            if (i === 0) return;
            const text = $(elem).text().trim();
            if (text && !text.includes('if (') && !text.includes('function(')) {
                lyrics += text + '\n\n';
            }
        });
        
        if (lyrics.trim().length > 100) {
            return {
                title: parsed.title,
                artist: parsed.artist,
                lyrics: lyrics.trim(),
                source: 'AZLyrics.com',
                url: azUrl
            };
        }
        
        throw new Error('No lyrics found on AZLyrics');
    } catch (error) {
        throw new Error(`AZLyrics scrape failed: ${error.message}`);
    }
}

// Method 4: Google search fallback
async function searchGoogleLyrics(query) {
    try {
        const parsed = parseSongQuery(query);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`"${parsed.title}" "${parsed.artist}" lyrics`)}`;
        
        return {
            title: parsed.title,
            artist: parsed.artist,
            lyrics: `🔍 *Lyrics search required*\n\nSong: ${parsed.title}\nArtist: ${parsed.artist}\n\n🌐 *Search on:*\n${searchUrl}\n\n💡 Click the link above to find lyrics on Google`,
            source: 'Google Search',
            url: searchUrl
        };
    } catch (error) {
        throw new Error('Google search failed');
    }
}

// Parse song query intelligently
function parseSongQuery(query) {
    const patterns = [
        /^"(.+)"\s+by\s+(.+)$/i,
        /^"(.+)"\s+-\s+(.+)$/i,  
        /^(.+)\s+by\s+(.+)$/i,
        /^(.+)\s+-\s+(.+)$/i,
        /^(.+)\s+\(\s*(.+)\s*\)$/i,
        /^(.+)\s+ft\.?\s+(.+)$/i,
        /^(.+)\s+feat\.?\s+(.+)$/i
    ];

    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match) {
            return {
                title: match[1].trim(),
                artist: match[2].trim()
            };
        }
    }

    const words = query.split(' ');
    if (words.length >= 3) {
        return {
            title: words.slice(0, -1).join(' '),
            artist: words[words.length - 1]
        };
    }

    return {
        title: query,
        artist: 'Unknown Artist'
    };
}

// Generate AZLyrics path
function generateAZLyricsPath(query) {
    const parsed = parseSongQuery(query);
    const artist = parsed.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
    const title = parsed.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${artist}/${title}.html`;
}

// Format lyrics for WhatsApp
function formatLyrics(lyricsData) {
    const { title, artist, lyrics, source, url } = lyricsData;
    
    let message = `🎵 *${title}*`;
    if (artist && artist !== 'Unknown Artist') {
        message += `\n👤 *Artist:* ${artist}`;
    }
    message += `\n📝 *Source:* ${source}\n\n`;
    
    const cleanLyrics = lyrics
        .replace(/\[.*?\]/g, '\n$&\n')
        .replace(/\n\s*\n/g, '\n\n')
        .replace(/^\s+|\s+$/g, '')
        .substring(0, 3500);
    
    message += cleanLyrics;
    
    if (url && message.length < 3800) {
        message += `\n\n🔗 ${url}`;
    }
    
    if (lyrics.length > 3500) {
        message += `\n\n📜 *Lyrics truncated* - Visit link for complete lyrics`;
    }
    
    return message;
}

module.exports = { lyricsCommand };