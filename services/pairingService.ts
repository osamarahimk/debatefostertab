import { Tournament, Team, Round, Pairing, TeamPositionBp, TournamentFormat, PairingWsdcAp, PairingBp, PairingAlgorithm } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { getStandings } from './statsService';

// Basic Fisher-Yates shuffle utility
const shuffle = <T>(array: T[]): T[] => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

// --- START BP PAIRING LOGIC ---

const getPermutations = <T>(arr: T[]): T[][] => {
    if (arr.length === 0) return [[]];
    const firstEl = arr[0];
    const rest = arr.slice(1);
    const permsWithoutFirst = getPermutations(rest);
    const allPermutations: T[][] = [];
    permsWithoutFirst.forEach(perm => {
        for (let i = 0; i <= perm.length; i++) {
            const permWithFirst = [...perm.slice(0, i), firstEl, ...perm.slice(i)];
            allPermutations.push(permWithFirst);
        }
    });
    return allPermutations;
};

const assignPositionsForRoomBp = (roomTeams: Team[]): { [key in TeamPositionBp]: Team } => {
    if (roomTeams.length !== 4) throw new Error("BP Room must have 4 teams.");

    const teamPermutations = getPermutations(roomTeams);
    let bestPermutation: Team[] = roomTeams;
    let bestPermutationScore = Infinity;

    for (const p of teamPermutations) {
        let currentScore = 0;
        currentScore += p[0].positionsSpoken.lastIndexOf('ogTeam') + 1;
        currentScore += p[1].positionsSpoken.lastIndexOf('ooTeam') + 1;
        currentScore += p[2].positionsSpoken.lastIndexOf('cgTeam') + 1;
        currentScore += p[3].positionsSpoken.lastIndexOf('coTeam') + 1;

        if (currentScore < bestPermutationScore) {
            bestPermutationScore = currentScore;
            bestPermutation = p;
        }
    }
    
    return {
        ogTeam: bestPermutation[0],
        ooTeam: bestPermutation[1],
        cgTeam: bestPermutation[2],
        coTeam: bestPermutation[3],
    };
};

const createPairingsFromTeamsBp = (teams: Team[], roundId: string, isPowerPaired: boolean): PairingBp[] => {
    const pairings: PairingBp[] = [];
    const numRooms = Math.floor(teams.length / 4);

    for (let i = 0; i < numRooms; i++) {
        const roomTeams = teams.slice(i * 4, (i * 4) + 4);
        if (roomTeams.length === 4) {
             const assignedTeams = isPowerPaired ? assignPositionsForRoomBp(roomTeams) : {
                ogTeam: roomTeams[0], ooTeam: roomTeams[1], cgTeam: roomTeams[2], coTeam: roomTeams[3],
             };
            pairings.push({
                id: uuidv4(), type: TournamentFormat.BP, roundId, ...assignedTeams,
                judges: [], ballot: null, room: `Room ${i + 1}`,
            });
        }
    }
    return pairings;
};

const generateBpDraw = (tournament: Tournament, algorithm: PairingAlgorithm): Round => {
    const roundId = uuidv4();
    const newRoundNumber = tournament.rounds.length + 1;
    let pairings: PairingBp[];
    let sortedTeams: Team[];

    if (newRoundNumber === 1 || algorithm === 'random') {
        sortedTeams = shuffle([...tournament.teams]);
    } else {
        const standings = getStandings(tournament);
        const teamMap = new Map(tournament.teams.map(t => [t.id, t]));
        sortedTeams = standings.map(s => teamMap.get(s.id)).filter((t): t is Team => !!t);
    }
    
    const numRooms = Math.floor(sortedTeams.length / 4);
    const bracketedTeams: Team[][] = [];
    for (let i = 0; i < numRooms; i++) {
        bracketedTeams.push(sortedTeams.slice(i * 4, (i*4) + 4));
    }

    if (algorithm === 'power-paired-slide') {
        // Not a standard BP pairing, but implemented for consistency. 1v2, 3v4 within bracket.
        // This is a simplification; true slide would be across the whole pool.
        // For simplicity, we just pair adjacently within the 4-team bracket.
        pairings = createPairingsFromTeamsBp(sortedTeams, roundId, true);
    } else { // Fold or Random
        pairings = createPairingsFromTeamsBp(sortedTeams, roundId, algorithm !== 'random');
    }
    
    return {
        id: roundId, roundNumber: newRoundNumber, motion: '', pairings, isSilent: false, status: 'draft', pairingAlgorithm: algorithm
    };
};


const createPairingsFromTeamsWsdcAp = (teams: Team[], roundId: string, format: TournamentFormat.WSDC | TournamentFormat.AP): PairingWsdcAp[] => {
    const pairings: PairingWsdcAp[] = [];
    const numRooms = Math.floor(teams.length / 2);

    for (let i = 0; i < numRooms; i++) {
        const roomTeams = teams.slice(i * 2, (i * 2) + 2);
        if (roomTeams.length === 2) {
            pairings.push({
                id: uuidv4(), type: format, roundId,
                propTeam: roomTeams[0], oppTeam: roomTeams[1],
                judges: [], ballot: null, room: `Room ${i + 1}`,
            });
        }
    }
    return pairings;
}

const generateWsdcOrApDraw = (tournament: Tournament, algorithm: PairingAlgorithm): Round => {
    const roundId = uuidv4();
    const newRoundNumber = tournament.rounds.length + 1;
    let pairings: PairingWsdcAp[];
    let teamsToPair: Team[];
    
    if (newRoundNumber === 1 || algorithm === 'random') {
        teamsToPair = shuffle([...tournament.teams]);
    } else {
        const standings = getStandings(tournament);
        const teamMap = new Map(tournament.teams.map(t => [t.id, t]));
        const sortedTeams = standings.map(s => teamMap.get(s.id)).filter((t): t is Team => !!t);

        if (algorithm === 'power-paired-slide') {
             teamsToPair = sortedTeams;
        } else { // Fold
            const half = Math.ceil(sortedTeams.length / 2);
            const topHalf = sortedTeams.slice(0, half);
            const bottomHalf = sortedTeams.slice(half).reverse();
            teamsToPair = [];
            for (let i = 0; i < topHalf.length; i++) {
                teamsToPair.push(topHalf[i]);
                if (bottomHalf[i]) {
                    teamsToPair.push(bottomHalf[i]);
                }
            }
        }
    }
    
    pairings = createPairingsFromTeamsWsdcAp(teamsToPair, roundId, tournament.format as TournamentFormat.WSDC | TournamentFormat.AP);

    return {
        id: roundId, roundNumber: newRoundNumber, motion: '', pairings, isSilent: false, status: 'draft', pairingAlgorithm: algorithm
    };
};

export const generateDraw = (tournament: Tournament, algorithm: PairingAlgorithm): Round => {
    if (tournament.format === TournamentFormat.BP) {
        return generateBpDraw(tournament, algorithm);
    } else {
        return generateWsdcOrApDraw(tournament, algorithm);
    }
};