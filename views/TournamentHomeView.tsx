import React, { useState, useRef } from 'react';
import { Tournament, TournamentFormat } from '../types';
import { Button, Card, Input, Modal, ConfirmModal } from '../components/common';
import { PlusIcon, UploadIcon, DownloadIcon, TrashIcon } from '../components/icons';
import { exportTournamentToJSON, importTournamentFromJSON } from '../services/fileService';

interface TournamentHomeViewProps {
    tournaments: Tournament[];
    onCreate: (name: string, format: TournamentFormat) => void;
    onImport: (tournament: Tournament) => void;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
}

export const TournamentHomeView: React.FC<TournamentHomeViewProps> = ({
    tournaments,
    onCreate,
    onImport,
    onSelect,
    onDelete
}) => {
    const [isCreateModalOpen, setCreateModalOpen] = useState(false);
    const [newTournamentName, setNewTournamentName] = useState('');
    const [newTournamentFormat, setNewTournamentFormat] = useState<TournamentFormat>(TournamentFormat.BP);
    const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreate = () => {
        if (newTournamentName.trim()) {
            onCreate(newTournamentName.trim(), newTournamentFormat);
            setNewTournamentName('');
            setNewTournamentFormat(TournamentFormat.BP);
            setCreateModalOpen(false);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const tournament = await importTournamentFromJSON(file);
                onImport(tournament);
            } catch (error: any) {
                alert(`Error importing file: ${error.message}`);
            }
        }
        // Reset file input to allow importing the same file again
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text)] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-3xl">
                <header className="text-center mb-10">
                    <h1 className="text-5xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
                        Debate Tabulator
                    </h1>
                    <p className="text-[var(--color-text-secondary)] mt-2">
                        Manage your tournaments with ease.
                    </p>
                </header>

                <main>
                    <Card>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Your Tournaments</h2>
                            <div className="flex gap-2">
                                <Button onClick={handleImportClick} variant="secondary">
                                    <UploadIcon className="w-5 h-5"/> Import
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept="application/json"
                                />
                                <Button onClick={() => setCreateModalOpen(true)}>
                                    <PlusIcon className="w-5 h-5"/> New Tournament
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {tournaments.length > 0 ? (
                                tournaments.map(t => (
                                    <div key={t.id} className="glass-card p-4 flex justify-between items-center bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-glow)] transition-all duration-200 border border-transparent">
                                        <div>
                                            <span className="font-semibold">{t.name}</span>
                                            <span className="text-xs ml-2 px-2 py-0.5 rounded-full bg-white/10 text-white/70">{t.format}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" onClick={() => exportTournamentToJSON(t)}>
                                                <DownloadIcon className="w-5 h-5"/>
                                            </Button>
                                             <Button variant="ghost" onClick={() => setTournamentToDelete(t)}>
                                                <TrashIcon/>
                                            </Button>
                                            <Button onClick={() => onSelect(t.id)}>
                                                Manage
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-[var(--color-text-secondary)] py-8">
                                    No tournaments found. Create one to get started!
                                </p>
                            )}
                        </div>
                    </Card>
                </main>
            </div>

            <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)} title="Create New Tournament">
                <div className="space-y-4">
                     <div>
                        <label htmlFor="tournamentName" className="block text-sm font-medium text-gray-300 mb-1">Tournament Name</label>
                        <Input
                            id="tournamentName"
                            type="text"
                            placeholder="e.g., Spring Invitational 2024"
                            value={newTournamentName}
                            onChange={(e) => setNewTournamentName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            autoFocus
                        />
                    </div>
                     <div>
                        <label htmlFor="tournamentFormat" className="block text-sm font-medium text-gray-300 mb-1">Debate Format</label>
                         <select 
                            id="tournamentFormat"
                            value={newTournamentFormat}
                            onChange={e => setNewTournamentFormat(e.target.value as TournamentFormat)}
                            className="Input-base"
                         >
                             <option value={TournamentFormat.BP}>British Parliamentary (BP)</option>
                             <option value={TournamentFormat.WSDC}>World Schools (WSDC)</option>
                             <option value="AP">Asian Parliamentary (AP)</option>
                         </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create</Button>
                    </div>
                </div>
            </Modal>
            
            <ConfirmModal
                isOpen={!!tournamentToDelete}
                onClose={() => setTournamentToDelete(null)}
                onConfirm={() => {
                    if (tournamentToDelete) {
                        onDelete(tournamentToDelete.id);
                    }
                }}
                title="Delete Tournament"
                message={`Are you sure you want to permanently delete "${tournamentToDelete?.name}"? This action cannot be undone.`}
            />
        </div>
    );
};