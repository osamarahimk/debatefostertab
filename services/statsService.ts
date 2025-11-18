import { Tournament, Team, Round, TournamentFormat, BallotWsdcAp, BallotBp, PairingBp, PairingWsdcAp } from '../types';

const BP_POINTS = { 1: 3, 2: 2, 3: 1, 4: 0 };

export interface TeamStanding extends Team {
    teamPoints: number; // BP
    wins: number; // WSDC/AP
    totalSpeakerPoints: number;
    stdDev: number; // BP
}

export interface SpeakerStanding {
    name: string;
    teamName: string;
    teamId: string;
    scores: number[];
    total: number;
    average: number;
}

const calculateMean = (numbers: number[]): number => {
    if (numbers.length === 0) return 0;
    return numbers.reduce((acc, val) => acc + val, 0) / numbers.length;
};

const calculateStdDev = (numbers: number[]): number => {
    if (numbers.length < 2) return 0;
    const mean = calculateMean(numbers);
    const squareDiffs = numbers.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(calculateMean(squareDiffs));
};

const getStandingsBp = (tournament: Tournament): TeamStanding[] => {
    const standingsMap = new Map<string, { teamPoints: number, allSpeakerScores: number[] }>();
    tournament.teams.forEach(team => standingsMap.set(team.id, { teamPoints: 0, allSpeakerScores: [] }));

    for (const round of tournament.rounds) {
        for (const pairing of round.pairings as PairingBp[]) {
            if (!pairing.ballot) continue;
            for (const teamResult of pairing.ballot.ranks) {
                const teamStats = standingsMap.get(teamResult.teamId);
                if (teamStats) {
                    teamStats.teamPoints += BP_POINTS[teamResult.rank];
                    teamStats.allSpeakerScores.push(...teamResult.speakerPoints);
                }
            }
        }
    }

    const standings = tournament.teams.map(team => {
        const stats = standingsMap.get(team.id)!;
        return {
            ...team,
            teamPoints: stats.teamPoints,
            totalSpeakerPoints: stats.allSpeakerScores.reduce((s, acc) => s + acc, 0),
            stdDev: calculateStdDev(stats.allSpeakerScores),
            wins: 0, // Not used in BP
        };
    });

    standings.sort((a, b) => b.teamPoints - a.teamPoints || b.totalSpeakerPoints - a.totalSpeakerPoints || a.stdDev - b.stdDev);
    return standings;
};

const getStandingsWsdcAp = (tournament: Tournament): TeamStanding[] => {
    const standingsMap = new Map<string, { wins: number, allSpeakerScores: number[] }>();
    tournament.teams.forEach(team => standingsMap.set(team.id, { wins: 0, allSpeakerScores: [] }));

    for (const round of tournament.rounds) {
        for (const pairing of round.pairings as PairingWsdcAp[]) {
            if (!pairing.ballot) continue;

            const winnerId = pairing.ballot.winner === 'prop' ? pairing.propTeam.id : pairing.oppTeam.id;
            const winnerStats = standingsMap.get(winnerId);
            if (winnerStats) winnerStats.wins += 1;
            
            const propTeamStats = standingsMap.get(pairing.propTeam.id);
            if(propTeamStats) propTeamStats.allSpeakerScores.push(...pairing.ballot.propScores, pairing.ballot.propReplyScore);

            const oppTeamStats = standingsMap.get(pairing.oppTeam.id);
            if(oppTeamStats) oppTeamStats.allSpeakerScores.push(...pairing.ballot.oppScores, pairing.ballot.oppReplyScore);
        }
    }

    const standings = tournament.teams.map(team => {
        const stats = standingsMap.get(team.id)!;
        return {
            ...team,
            wins: stats.wins,
            totalSpeakerPoints: stats.allSpeakerScores.reduce((s, acc) => s + acc, 0),
            teamPoints: 0, // Not used
            stdDev: 0, // Not used
        };
    });
    
    standings.sort((a, b) => b.wins - a.wins || b.totalSpeakerPoints - a.totalSpeakerPoints);
    return standings;
};

export const getStandings = (tournament: Tournament): TeamStanding[] => {
    if (tournament.format === TournamentFormat.BP) {
        return getStandingsBp(tournament);
    } else {
        return getStandingsWsdcAp(tournament);
    }
};


export const getSpeakerStandings = (tournament: Tournament): SpeakerStanding[] => {
    const speakerData = new Map<string, { name: string; teamName: string; teamId: string; scores: number[] }>();

    const addScore = (team: Team, speakerName: string, score: number) => {
        const speakerId = `${team.id}-${speakerName}`;
        if (!speakerData.has(speakerId)) {
            speakerData.set(speakerId, { name: speakerName, teamName: team.name, teamId: team.id, scores: [] });
        }
        speakerData.get(speakerId)!.scores.push(score);
    };

    for (const round of tournament.rounds) {
        for (const pairing of round.pairings) {
            if (!pairing.ballot) continue;

            if (pairing.type === TournamentFormat.BP) {
                const ballot = pairing.ballot as BallotBp;
                ballot.ranks.forEach(result => {
                    const team = tournament.teams.find(t => t.id === result.teamId);
                    if (team) {
                        team.speakers.forEach((speaker, i) => addScore(team, speaker.name, result.speakerPoints[i]));
                    }
                });
            } else { // WSDC or AP
                const ballot = pairing.ballot as BallotWsdcAp;
                const propTeam = pairing.propTeam;
                const oppTeam = pairing.oppTeam;
                
                propTeam.speakers.forEach((s, i) => addScore(propTeam, s.name, ballot.propScores[i]));
                addScore(propTeam, `${propTeam.speakers[0].name} (Reply)`, ballot.propReplyScore);

                oppTeam.speakers.forEach((s, i) => addScore(oppTeam, s.name, ballot.oppScores[i]));
                addScore(oppTeam, `${oppTeam.speakers[0].name} (Reply)`, ballot.oppReplyScore);
            }
        }
    }

    const standings = Array.from(speakerData.values()).map(data => {
        const total = data.scores.reduce((a, b) => a + b, 0);
        const average = data.scores.length > 0 ? total / data.scores.length : 0;
        return { ...data, total, average };
    });

    standings.sort((a, b) => b.total - a.total || b.average - a.average);
    return standings;
};