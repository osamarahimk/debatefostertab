import React, { useState } from 'react';
import { Tournament, TournamentFormat } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { TournamentHomeView } from './views/TournamentHomeView';
import { TournamentDashboard } from './views/TournamentDashboard';
import { v4 as uuidv4 } from 'uuid';


const App: React.FC = () => {
    const [tournaments, setTournaments] = useLocalStorage<Tournament[]>('tournaments', []);
    const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);

    const handleCreateTournament = (name: string, format: TournamentFormat) => {
        const newTournament: Tournament = {
            id: uuidv4(),
            name,
            format,
            teams: [],
            judges: [],
            rounds: [],
            breakAfterRound: 4,
            breakCategories: [],
            speakerCategories: [],
        };
        const updatedTournaments = [...tournaments, newTournament];
        setTournaments(updatedTournaments);
        setActiveTournamentId(newTournament.id);
    };
    
    const handleImportTournament = (tournament: Tournament) => {
        const existingIds = new Set(tournaments.map(t => t.id));
        if (!tournament.id || existingIds.has(tournament.id)) {
            tournament.id = uuidv4(); // Assign new ID if missing or conflicting
        }
        
        // Migration steps for older formats
        if (tournament.breakAfterRound === undefined) tournament.breakAfterRound = 4;
        if (tournament.breakCategories === undefined) tournament.breakCategories = [];
        if (tournament.speakerCategories === undefined) tournament.speakerCategories = [];

        tournament.teams.forEach(team => {
            if (team.positionsSpoken === undefined) team.positionsSpoken = [];
            if (team.wins === undefined) team.wins = 0;
            if (team.breakCategoryIds === undefined) team.breakCategoryIds = [];
            // Migrate speakers from string[] to Speaker[]
            if (team.speakers.length > 0 && typeof team.speakers[0] === 'string') {
                team.speakers = (team.speakers as unknown as string[]).map(s => ({ id: uuidv4(), name: s, categoryIds: [] }));
            }
        });

        const updatedTournaments = [...tournaments, tournament];
        setTournaments(updatedTournaments);
        alert(`Tournament "${tournament.name}" imported successfully!`);
    };

    const handleSelectTournament = (id: string) => {
        setActiveTournamentId(id);
    };

    const handleUpdateTournament = (updatedTournament: Tournament) => {
        const updatedTournaments = tournaments.map(t =>
            t.id === updatedTournament.id ? updatedTournament : t
        );
        setTournaments(updatedTournaments);
    };
    
    const handleDeleteTournament = (id: string) => {
        setTournaments(tournaments.filter(t => t.id !== id));
    };

    const activeTournament = tournaments.find(t => t.id === activeTournamentId);

    if (!activeTournament) {
        return (
            <TournamentHomeView
                tournaments={tournaments}
                onCreate={handleCreateTournament}
                onImport={handleImportTournament}
                onSelect={handleSelectTournament}
                onDelete={handleDeleteTournament}
            />
        );
    }

    return (
        <TournamentDashboard
            key={activeTournament.id} // Add key to force re-mount on tournament change
            tournament={activeTournament}
            onUpdateTournament={handleUpdateTournament}
            onExit={() => setActiveTournamentId(null)}
        />
    );
};

export default App;