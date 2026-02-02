const axios = require("axios");

// Football Data API configuration
const apiKey = '7b6507c792f74a2b9db41cfc8fd8cf05';
const apiUrl = 'https://api.football-data.org/v4/competitions';

function createFakeContact(message) {
    const participantId = message?.key?.participant?.split('@')[0] || 
                          message?.key?.remoteJid?.split('@')[0] || '0';

    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
                displayName: "DAVE-X",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:DAVE-X\nitem1.TEL;waid=${participantId}:${participantId}\nitem1.X-ABLabel:Phone\nEND:VCARD`
            }
        },
        participant: "0@s.whatsapp.net"
    };
}

// Helper function to fetch data from football-data.org
const fetchFootballData = async (endpoint) => {
    try {
        const response = await axios.get(`${apiUrl}/${endpoint}`, {
            headers: {
                'X-Auth-Token': apiKey,
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error('Football API error:', error);
        return null;
    }
};

// Format date helper
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// 1. EPL Standings
async function eplStandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('PL/standings');
        if (!data || !data.standings) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching EPL standings.' 
            }, { quoted: fake });
            return;
        }

        const standings = data.standings[0].table;
        let standingsMessage = "📊 *Premier League Table*\n\n";
        
        standings.forEach((team, index) => {
            const position = index + 1;
            const emoji = position <= 4 ? '🏆' : position <= 6 ? '⚽' : position >= 18 ? '⬇️' : '🔵';
            standingsMessage += `${emoji} ${position}. ${team.team.name}\n`;
            standingsMessage += `   📊 P: ${team.playedGames} | W: ${team.won} | D: ${team.draw} | L: ${team.lost}\n`;
            standingsMessage += `   ⚽ GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDifference}\n`;
            standingsMessage += `   📈 Points: ${team.points}\n\n`;
        });

        await sock.sendMessage(chatId, { text: standingsMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('EPL standings error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching EPL standings.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 2. EPL Matchday (Fixtures)
async function eplFixturesCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('PL/matches?status=SCHEDULED');
        if (!data || !data.matches) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching EPL fixtures.' 
            }, { quoted: fake });
            return;
        }

        const matches = data.matches.slice(0, 10); // Next 10 matches
        let fixturesMessage = "🗓️ *Upcoming EPL Matches*\n\n";
        
        if (matches.length === 0) {
            fixturesMessage += "No upcoming matches scheduled.\n";
        } else {
            matches.forEach((match, index) => {
                const matchDate = formatDate(match.utcDate);
                fixturesMessage += `${index + 1}. ${match.homeTeam.name} 🆚 ${match.awayTeam.name}\n`;
                fixturesMessage += `   📅 ${matchDate}\n`;
                fixturesMessage += `   🏟️ ${match.venue || 'TBA'}\n\n`;
            });
        }

        await sock.sendMessage(chatId, { text: fixturesMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('EPL fixtures error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching EPL fixtures.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 3. EPL Top Scorers
async function eplTopScorersCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('PL/scorers');
        if (!data || !data.scorers) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching EPL top scorers.' 
            }, { quoted: fake });
            return;
        }

        const topScorers = data.scorers.slice(0, 10); // Top 10 scorers
        let scorersMessage = "🏆 *Dave Tech EPL Top Scorers*\n\n";
        
        topScorers.forEach((scorer, index) => {
            const position = index + 1;
            const emoji = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '⚽';
            scorersMessage += `${emoji} ${position}. ${scorer.player.name}\n`;
            scorersMessage += `   👟 Goals: ${scorer.goals || scorer.numberOfGoals || 0}\n`;
            scorersMessage += `   👕 Team: ${scorer.team?.name || 'N/A'}\n`;
            if (scorer.assists) scorersMessage += `   🎯 Assists: ${scorer.assists}\n`;
            scorersMessage += '\n';
        });

        await sock.sendMessage(chatId, { text: scorersMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('EPL top scorers error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching EPL top scorers.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 4. Bundesliga Standings
async function bundesligaStandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('BL1/standings');
        if (!data || !data.standings) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching Bundesliga standings.' 
            }, { quoted: fake });
            return;
        }

        const standings = data.standings[0].table;
        let standingsMessage = "🇩🇪 *Dave Tech Bundesliga Table*\n\n";
        
        standings.forEach((team, index) => {
            const position = index + 1;
            const emoji = position <= 4 ? '🏆' : position >= 16 ? '⬇️' : '🔵';
            standingsMessage += `${emoji} ${position}. ${team.team.name}\n`;
            standingsMessage += `   📊 P: ${team.playedGames} | W: ${team.won} | D: ${team.draw} | L: ${team.lost}\n`;
            standingsMessage += `   ⚽ GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDifference}\n`;
            standingsMessage += `   📈 Points: ${team.points}\n\n`;
        });

        await sock.sendMessage(chatId, { text: standingsMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Bundesliga standings error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching Bundesliga standings.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 5. LaLiga Standings
async function laligaStandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('PD/standings');
        if (!data || !data.standings) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching LaLiga standings.' 
            }, { quoted: fake });
            return;
        }

        const standings = data.standings[0].table;
        let standingsMessage = "🇪🇸 *Dave Tech LaLiga Table*\n\n";
        
        standings.forEach((team, index) => {
            const position = index + 1;
            const emoji = position <= 4 ? '🏆' : position >= 18 ? '⬇️' : '🔵';
            standingsMessage += `${emoji} ${position}. ${team.team.name}\n`;
            standingsMessage += `   📊 P: ${team.playedGames} | W: ${team.won} | D: ${team.draw} | L: ${team.lost}\n`;
            standingsMessage += `   ⚽ GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDifference}\n`;
            standingsMessage += `   📈 Points: ${team.points}\n\n`;
        });

        await sock.sendMessage(chatId, { text: standingsMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('LaLiga standings error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching LaLiga standings.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 6. Serie A Standings
async function serieAStandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('SA/standings');
        if (!data || !data.standings) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching Serie A standings.' 
            }, { quoted: fake });
            return;
        }

        const standings = data.standings[0].table;
        let standingsMessage = "🇮🇹 *Dave Tech Serie A Table*\n\n";
        
        standings.forEach((team, index) => {
            const position = index + 1;
            const emoji = position <= 4 ? '🏆' : position >= 18 ? '⬇️' : '🔵';
            standingsMessage += `${emoji} ${position}. ${team.team.name}\n`;
            standingsMessage += `   📊 P: ${team.playedGames} | W: ${team.won} | D: ${team.draw} | L: ${team.lost}\n`;
            standingsMessage += `   ⚽ GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDifference}\n`;
            standingsMessage += `   📈 Points: ${team.points}\n\n`;
        });

        await sock.sendMessage(chatId, { text: standingsMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Serie A standings error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching Serie A standings.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 7. Ligue 1 Standings
async function ligue1StandingsCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await fetchFootballData('FL1/standings');
        if (!data || !data.standings) {
            await sock.sendMessage(chatId, { 
                text: '❌ Error fetching Ligue 1 standings.' 
            }, { quoted: fake });
            return;
        }

        const standings = data.standings[0].table;
        let standingsMessage = "🇫🇷 *Dave Tech Ligue 1 Table*\n\n";
        
        standings.forEach((team, index) => {
            const position = index + 1;
            const emoji = position <= 3 ? '🏆' : position >= 18 ? '⬇️' : '🔵';
            standingsMessage += `${emoji} ${position}. ${team.team.name}\n`;
            standingsMessage += `   📊 P: ${team.playedGames} | W: ${team.won} | D: ${team.draw} | L: ${team.lost}\n`;
            standingsMessage += `   ⚽ GF: ${team.goalsFor} | GA: ${team.goalsAgainst} | GD: ${team.goalDifference}\n`;
            standingsMessage += `   📈 Points: ${team.points}\n\n`;
        });

        await sock.sendMessage(chatId, { text: standingsMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Ligue 1 standings error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching Ligue 1 standings.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

// 8. All Leagues Today's Matches
async function matchesCommand(sock, chatId, message) {
    try {
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Fetch today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch matches for all major leagues
        const [eplData, laligaData, bundesligaData, serieAData, ligue1Data] = await Promise.all([
            fetchFootballData(`PL/matches?dateFrom=${today}&dateTo=${today}`),
            fetchFootballData(`PD/matches?dateFrom=${today}&dateTo=${today}`),
            fetchFootballData(`BL1/matches?dateFrom=${today}&dateTo=${today}`),
            fetchFootballData(`SA/matches?dateFrom=${today}&dateTo=${today}`),
            fetchFootballData(`FL1/matches?dateFrom=${today}&dateTo=${today}`)
        ]);

        let matchesMessage = `⚽ *Dave Tech Today's Football Matches* ⚽\n\n`;
        
        // Helper function to add league matches
        const addLeagueMatches = (data, leagueName, flag) => {
            if (data && data.matches && data.matches.length > 0) {
                matchesMessage += `${flag} *${leagueName}:*\n`;
                data.matches.forEach(match => {
                    const matchTime = formatDate(match.utcDate);
                    matchesMessage += `• ${match.homeTeam.name} 🆚 ${match.awayTeam.name}\n`;
                    matchesMessage += `  🕐 ${matchTime}\n`;
                    matchesMessage += `  🏟️ ${match.venue || 'TBA'}\n`;
                    if (match.status === 'IN_PLAY') matchesMessage += `  ⚽ LIVE\n`;
                    matchesMessage += '\n';
                });
            } else {
                matchesMessage += `${flag} ${leagueName}: No matches today\n\n`;
            }
        };

        addLeagueMatches(eplData, 'Premier League', '🇬🇧');
        addLeagueMatches(laligaData, 'LaLiga', '🇪🇸');
        addLeagueMatches(bundesligaData, 'Bundesliga', '🇩🇪');
        addLeagueMatches(serieAData, 'Serie A', '🇮🇹');
        addLeagueMatches(ligue1Data, 'Ligue 1', '🇫🇷');

        await sock.sendMessage(chatId, { text: matchesMessage }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Matches command error:', error);
        const fake = createFakeContact(message);
        await sock.sendMessage(chatId, { 
            text: '❌ Error fetching today\'s matches.' 
        }, { quoted: fake });
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = {
    eplStandingsCommand,
    eplFixturesCommand,
    eplTopScorersCommand,
    bundesligaStandingsCommand,
    laligaStandingsCommand,
    serieAStandingsCommand,
    ligue1StandingsCommand,
    matchesCommand
};