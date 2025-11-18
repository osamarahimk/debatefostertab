import { Tournament } from '../types';

export const exportTournamentToJSON = (tournament: Tournament) => {
    try {
        const jsonString = JSON.stringify(tournament, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeName}_tab_export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to export tournament:", error);
        alert("An error occurred while trying to export the tournament.");
    }
};

export const importTournamentFromJSON = (file: File): Promise<Tournament> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                if (event.target && typeof event.target.result === 'string') {
                    const tournament = JSON.parse(event.target.result) as Tournament;
                    // Basic validation
                    if (tournament.name && Array.isArray(tournament.teams) && Array.isArray(tournament.judges) && Array.isArray(tournament.rounds)) {
                        resolve(tournament);
                    } else {
                        reject(new Error('Invalid tournament file format.'));
                    }
                } else {
                    reject(new Error('Failed to read file.'));
                }
            } catch (error) {
                console.error("Failed to parse tournament file:", error);
                reject(new Error('The selected file is not a valid JSON tournament file.'));
            }
        };
        reader.onerror = () => {
            reject(new Error('Error reading the file.'));
        };
        reader.readAsText(file);
    });
};
