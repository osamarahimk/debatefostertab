import { Tournament, TeamPositionBp, Round, Pairing } from '../types';

export type DragData = 
  | { type: 'judge'; id: string; source: { type: 'pairing'; roundId: string; pairingId: string; } | { type: 'pool'; } }
  | { type: 'team'; id: string; source: { type: 'pairing'; roundId: string; pairingId: string; position: TeamPositionBp; } }
  | { type: 'round'; id: string; }
  | { type: 'pairing'; id: string; source: { roundId: string; } };


// Helper to find the location of a team in the tournament structure
const findTeamLocation = (draft: Tournament, teamId: string) => {
    for (const round of draft.rounds) {
        for (const pairing of round.pairings) {
            if (pairing.type === 'BP') {
                const positions: TeamPositionBp[] = ['ogTeam', 'ooTeam', 'cgTeam', 'coTeam'];
                for (const position of positions) {
                    if (pairing[position].id === teamId) {
                        return { round, pairing, position };
                    }
                }
            }
        }
    }
    return null;
};

export const handleTeamDrop = (draft: Tournament, dragData: DragData, dropTarget: {type: 'team', roundId: string, pairingId: string, position: TeamPositionBp}) => {
    if (dragData.type !== 'team' || dropTarget.type !== 'team' || !dropTarget.position) return;

    const sourceLocation = findTeamLocation(draft, dragData.id);
    if (!sourceLocation || sourceLocation.pairing.type !== 'BP') return;

    const targetRound = draft.rounds.find(r => r.id === dropTarget.roundId);
    if (!targetRound) return;

    const targetPairing = targetRound.pairings.find(p => p.id === dropTarget.pairingId);
    if (!targetPairing || targetPairing.type !== 'BP') return;

    const sourceTeam = sourceLocation.pairing[sourceLocation.position];
    const targetTeam = targetPairing[dropTarget.position];

    // Swap the teams
    targetPairing[dropTarget.position] = sourceTeam;
    sourceLocation.pairing[sourceLocation.position] = targetTeam;
};


export const handleJudgeDrop = (draft: Tournament, dragData: DragData, dropTarget: { type: 'judge', roundId: string, pairingId: string }) => {
    if (dragData.type !== 'judge' || dropTarget.type !== 'judge') return;

    const targetRound = draft.rounds.find(r => r.id === dropTarget.roundId);
    if (!targetRound) return;

    const targetPairing = targetRound.pairings.find(p => p.id === dropTarget.pairingId);
    if (!targetPairing) return;
    
    const draggedJudge = draft.judges.find(j => j.id === dragData.id);
    if (!draggedJudge) return;

    // Fix: Assign dragData.source to a constant to help TypeScript with type narrowing.
    // 1. Remove judge from their original position (if they had one)
    const source = dragData.source;
    if (source.type === 'pairing') {
        const sourceRound = draft.rounds.find(r => r.id === source.roundId);
        const sourcePairing = sourceRound?.pairings.find(p => p.id === source.pairingId);
        if (sourcePairing) {
            sourcePairing.judges = sourcePairing.judges.filter(j => j.id !== draggedJudge.id);
        }
    }
    
    // 2. Add judge to the new position if not already there
    if (!targetPairing.judges.some(j => j.id === draggedJudge.id)) {
        targetPairing.judges.push(draggedJudge);
    }
};

export const handleRoundDrop = (draft: Tournament, draggedRoundId: string, targetIndex: number) => {
    const roundToMove = draft.rounds.find(r => r.id === draggedRoundId);
    if (!roundToMove) return;

    const sourceIndex = draft.rounds.findIndex(r => r.id === draggedRoundId);
    
    draft.rounds.splice(sourceIndex, 1);
    
    const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    draft.rounds.splice(newTargetIndex, 0, roundToMove);
};

export const handlePairingDrop = (draft: Tournament, draggedPairingId: string, sourceRoundId: string, targetRoundId: string, targetIndex: number) => {
    const sourceRound = draft.rounds.find(r => r.id === sourceRoundId);
    if (!sourceRound) return;

    const pairingToMove = sourceRound.pairings.find(p => p.id === draggedPairingId);
    if (!pairingToMove) return;
    
    const sourcePairingIndex = sourceRound.pairings.findIndex(p => p.id === draggedPairingId);
    sourceRound.pairings.splice(sourcePairingIndex, 1);
    
    const targetRound = draft.rounds.find(r => r.id === targetRoundId);
    if (!targetRound) return;

    if (sourceRoundId === targetRoundId && sourcePairingIndex < targetIndex) {
        targetIndex--;
    }

    targetRound.pairings.splice(targetIndex, 0, pairingToMove);
};