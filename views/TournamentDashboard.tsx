import React, { useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { Tournament, View, Team, Judge, Pairing, Round, Ballot, TeamPositionBp, TournamentFormat, PairingWsdcAp, BallotWsdcAp, PairingBp, BallotBp, Speaker, BreakCategory, SpeakerCategory, PairingAlgorithm } from '../types';
import { Button, Card, Input, Modal, ConfirmModal } from '../components/common';
import { CogIcon, UsersIcon, GavelIcon, ListIcon, BarChartIcon, PlusIcon, TrashIcon, WandIcon, DownloadIcon, EnterFullscreenIcon, ExitFullscreenIcon, PencilIcon, MenuIcon } from '../components/icons';
import { generateMotion } from '../services/geminiService';
import { handleJudgeDrop, handleTeamDrop, DragData } from '../services/dnd';
import { v4 as uuidv4 } from 'uuid';
import { exportTournamentToJSON } from '../services/fileService';
import { getStandings, getSpeakerStandings } from '../services/statsService';
import { generateDraw } from '../services/pairingService';

function useFullscreen() {
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return { isFullscreen, toggleFullscreen };
}


const Sidebar: React.FC<{ currentView: View; setView: (view: View) => void, onExit: () => void, tournamentName: string, isFullscreen: boolean, toggleFullscreen: () => void, isOpen: boolean, setIsOpen: (isOpen: boolean) => void }> = ({ currentView, setView, onExit, tournamentName, isFullscreen, toggleFullscreen, isOpen, setIsOpen }) => {
    const navItems = [
        { view: View.SETUP, label: 'Setup', icon: CogIcon },
        { view: View.TEAMS, label: 'Teams', icon: UsersIcon },
        { view: View.JUDGES, label: 'Judges', icon: GavelIcon },
        { view: View.ROUNDS, label: 'Rounds', icon: ListIcon },
        { view: View.STANDINGS, label: 'Standings', icon: BarChartIcon },
    ];

    return (
        <aside className={`fixed top-0 left-0 z-40 w-64 h-screen transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 sidebar-bg p-4 flex flex-col`}>
            <div>
              <h1 className="text-2xl font-bold text-white mb-1 tracking-tighter">Debate Tab</h1>
              <p className="text-sm text-[var(--color-text-secondary)] truncate mb-8" title={tournamentName}>{tournamentName}</p>
            </div>
            <nav className="flex flex-col gap-2 flex-grow">
                {navItems.map(item => (
                    <button
                        key={item.view}
                        onClick={() => { setView(item.view); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            currentView === item.view
                                ? 'sidebar-button-active'
                                : 'sidebar-button-inactive'
                        }`}
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={onExit} className="flex-grow">Back to Tournaments</Button>
                <Button
                    variant="secondary"
                    onClick={toggleFullscreen}
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    className="px-2"
                >
                    {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
                </Button>
            </div>
        </aside>
    );
};

const Header: React.FC<{ title: string; onMenuClick: () => void; children?: ReactNode }> = ({ title, onMenuClick, children }) => (
    <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
            <button onClick={onMenuClick} className="md:hidden text-[var(--color-text-secondary)]">
                <MenuIcon />
            </button>
            <h2 className="text-3xl font-bold text-white">{title}</h2>
        </div>
        <div className="flex items-center gap-2">{children}</div>
    </header>
);

const CategoryManager: React.FC<{ title: string, categories: {id: string, name: string}[], onAdd: (name: string) => void, onDelete: (id: string) => void }> = ({ title, categories, onAdd, onDelete }) => {
    const [newName, setNewName] = useState('');

    const handleAdd = () => {
        if (newName.trim()) {
            onAdd(newName.trim());
            setNewName('');
        }
    };

    return (
        <Card>
            <h3 className="text-lg font-semibold mb-3">{title}</h3>
            <div className="flex gap-2 mb-4">
                <Input 
                    placeholder={`New category name...`}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <Button onClick={handleAdd}>Add</Button>
            </div>
            <div className="space-y-2">
                {categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-2 bg-[rgba(255,255,255,0.05)] rounded">
                        <span>{cat.name}</span>
                        <Button variant="ghost" className="p-1 h-auto" onClick={() => onDelete(cat.id)}><TrashIcon/></Button>
                    </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-center text-[var(--color-text-tertiary)] py-2">No categories defined.</p>}
            </div>
        </Card>
    );
}

const SetupView: React.FC<{ tournament: Tournament, setTournament: (tournament: Tournament) => void }> = ({ tournament, setTournament }) => {
    
    const handleAddBreakCategory = (name: string) => {
        const newCategory: BreakCategory = { id: uuidv4(), name };
        setTournament({ ...tournament, breakCategories: [...(tournament.breakCategories || []), newCategory] });
    }
    const handleDeleteBreakCategory = (id: string) => {
        setTournament({ ...tournament, breakCategories: (tournament.breakCategories || []).filter(c => c.id !== id) });
    }
    const handleAddSpeakerCategory = (name: string) => {
        const newCategory: SpeakerCategory = { id: uuidv4(), name };
        setTournament({ ...tournament, speakerCategories: [...(tournament.speakerCategories || []), newCategory] });
    }
    const handleDeleteSpeakerCategory = (id: string) => {
        setTournament({ ...tournament, speakerCategories: (tournament.speakerCategories || []).filter(c => c.id !== id) });
    }

    return (
        <div className="space-y-6">
            <Card>
                <div className="space-y-6">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Tournament Name</label>
                        <Input 
                            type="text"
                            value={tournament.name}
                            onChange={(e) => setTournament({ ...tournament, name: e.target.value })}
                            placeholder="Enter tournament name"
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-[var(--color-text-secondary)]">Number of Preliminary Rounds Before Break</label>
                        <Input 
                            type="number"
                            min="1"
                            value={tournament.breakAfterRound || 4}
                            onChange={(e) => setTournament({ ...tournament, breakAfterRound: parseInt(e.target.value) || 4 })}
                        />
                    </div>
                     <div className="pt-4">
                        <Button variant="secondary" onClick={() => exportTournamentToJSON(tournament)}>
                            <DownloadIcon className="w-5 h-5"/> Export as JSON
                        </Button>
                    </div>
                </div>
            </Card>

            <CategoryManager 
                title="Break Categories"
                categories={tournament.breakCategories || []}
                onAdd={handleAddBreakCategory}
                onDelete={handleDeleteBreakCategory}
            />

            <CategoryManager 
                title="Speaker Categories"
                categories={tournament.speakerCategories || []}
                onAdd={handleAddSpeakerCategory}
                onDelete={handleDeleteSpeakerCategory}
            />
        </div>
    );
};

const TeamsView: React.FC<{ teams: Team[], onAddTeam: () => void, onEditTeam: (team: Team) => void, onDeleteTeam: (team: Team) => void, onMenuClick: () => void }> = ({ teams, onAddTeam, onEditTeam, onDeleteTeam, onMenuClick }) => (
    <div>
        <Header title={`Teams (${teams.length})`} onMenuClick={onMenuClick} children={
            <Button onClick={onAddTeam}><PlusIcon className="w-5 h-5"/> Add Team</Button>
        } />
        <Card className="p-0">
            {teams.length > 0 ? (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b">
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)]">Team Name</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)]">Speakers</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map((team, index) => (
                            <tr key={team.id} className={`${index === teams.length - 1 ? '' : 'border-b'}`}>
                                <td className="p-4 font-medium">{team.name}</td>
                                <td className="p-4 text-[var(--color-text-secondary)]">{team.speakers.map(s => s.name).join(', ')}</td>
                                <td className="p-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <Button variant="ghost" onClick={() => onEditTeam(team)}><PencilIcon/></Button>
                                        <Button variant="ghost" onClick={() => onDeleteTeam(team)}><TrashIcon/></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-center text-[var(--color-text-secondary)] p-8">No teams have been added yet.</p>}
        </Card>
    </div>
);

const JudgesView: React.FC<{ judges: Judge[], onAddJudge: () => void, onDeleteJudge: (judge: Judge) => void, onMenuClick: () => void }> = ({ judges, onAddJudge, onDeleteJudge, onMenuClick }) => (
     <div>
        <Header title={`Judges (${judges.length})`} onMenuClick={onMenuClick} children={
            <Button onClick={onAddJudge}><PlusIcon className="w-5 h-5"/> Add Judge</Button>
        } />
        <Card className="p-0">
             {judges.length > 0 ? (
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b">
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)]">Judge Name</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)]">Affiliation</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {judges.map((judge, index) => (
                            <tr key={judge.id} className={`${index === judges.length - 1 ? '' : 'border-b'}`}>
                                <td className="p-4 font-medium">{judge.name}</td>
                                <td className="p-4 text-[var(--color-text-secondary)]">{judge.affiliation}</td>
                                <td className="p-4 text-center"><Button variant="ghost" onClick={() => onDeleteJudge(judge)}><TrashIcon/></Button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : <p className="text-center text-[var(--color-text-secondary)] p-8">No judges have been added yet.</p>}
        </Card>
    </div>
);

// --- START ROUNDS VIEW COMPONENTS ---

const DraggableItem: React.FC<{ onDragStart: (e: React.DragEvent) => void, children: ReactNode, className?: string }> = 
({ onDragStart, children, className }) => (
    <div draggable onDragStart={onDragStart} className={`cursor-grab active:cursor-grabbing ${className}`}>
        {children}
    </div>
);

const DropZone: React.FC<{ onDrop: (e: React.DragEvent) => void, children: ReactNode, className?: string }> = 
({ onDrop, children, className }) => {
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    return (
        <div onDrop={onDrop} onDragOver={handleDragOver} className={className}>
            {children}
        </div>
    );
};

const DrawPairingCardBp: React.FC<{ 
    pairing: PairingBp, 
    onJudgeDrop: (pairingId: string, dragData: DragData) => void,
    onTeamDrop: (pairingId: string, position: TeamPositionBp, dragData: DragData) => void 
}> = ({ pairing, onJudgeDrop, onTeamDrop }) => {
    
    const TeamSlot: React.FC<{ position: TeamPositionBp, team: Team }> = ({ position, team }) => {
        const handleDragStart = (e: React.DragEvent) => {
            const dragData: DragData = { type: 'team', id: team.id, source: { type: 'pairing', roundId: pairing.roundId, pairingId: pairing.id, position } };
            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        };
        const handleDrop = (e: React.DragEvent) => {
            e.preventDefault(); e.stopPropagation();
            const dragData: DragData = JSON.parse(e.dataTransfer.getData('application/json'));
            if (dragData.type === 'team') onTeamDrop(pairing.id, position, dragData);
        };
        return (
            <DropZone onDrop={handleDrop}>
                <DraggableItem onDragStart={handleDragStart}>
                    <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.05)]">
                        <span>{position.replace('Team', '').toUpperCase()}:</span>
                        <span className="truncate" title={team.name}>{team.name}</span>
                    </div>
                </DraggableItem>
            </DropZone>
        );
    };

    return (
        <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold">{pairing.room}</h4>
                <DropZone 
                    onDrop={(e) => {
                        e.preventDefault();
                        const dragData: DragData = JSON.parse(e.dataTransfer.getData('application/json'));
                        if (dragData.type === 'judge') onJudgeDrop(pairing.id, dragData);
                    }}
                    className="flex items-center gap-2 border border-dashed border-[rgba(255,255,255,0.3)] rounded p-2 min-h-[34px] min-w-[100px] flex-wrap"
                >
                    {pairing.judges.map(j => (
                         <DraggableItem key={j.id} onDragStart={(e) => {
                             const dragData: DragData = { type: 'judge', id: j.id, source: { type: 'pairing', roundId: pairing.roundId, pairingId: pairing.id } };
                             e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                         }}>
                            <div className="bg-[rgba(255,255,255,0.1)] text-xs px-2 py-1 rounded">{j.name}</div>
                        </DraggableItem>
                    ))}
                    {pairing.judges.length === 0 && <span className="text-xs text-[var(--color-text-tertiary)]">Drop judge</span>}
                </DropZone>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
                <TeamSlot position="ogTeam" team={pairing.ogTeam} />
                <TeamSlot position="ooTeam" team={pairing.ooTeam} />
                <TeamSlot position="cgTeam" team={pairing.cgTeam} />
                <TeamSlot position="coTeam" team={pairing.coTeam} />
            </div>
        </Card>
    );
};

const DrawPairingCardWsdcAp: React.FC<{ 
    pairing: PairingWsdcAp, 
    onJudgeDrop: (pairingId: string, dragData: DragData) => void
}> = ({ pairing, onJudgeDrop }) => (
    <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold">{pairing.room}</h4>
            <DropZone 
                onDrop={(e) => {
                    e.preventDefault();
                    const dragData: DragData = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (dragData.type === 'judge') onJudgeDrop(pairing.id, dragData);
                }}
                className="flex items-center gap-2 border border-dashed border-[rgba(255,255,255,0.3)] rounded p-2 min-h-[34px] min-w-[100px] flex-wrap"
            >
                {pairing.judges.map(j => (
                     <DraggableItem key={j.id} onDragStart={(e) => {
                         const dragData: DragData = { type: 'judge', id: j.id, source: { type: 'pairing', roundId: pairing.roundId, pairingId: pairing.id } };
                         e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                     }}>
                        <div className="bg-[rgba(255,255,255,0.1)] text-xs px-2 py-1 rounded">{j.name}</div>
                    </DraggableItem>
                ))}
                {pairing.judges.length === 0 && <span className="text-xs text-[var(--color-text-tertiary)]">Drop judge</span>}
            </DropZone>
        </div>
        <div className="space-y-2 text-sm">
             <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.05)]">
                <span>Prop:</span>
                <span>{pairing.propTeam.name}</span>
            </div>
             <div className="flex justify-between p-2 rounded bg-[rgba(255,255,255,0.05)]">
                <span>Opp:</span>
                <span>{pairing.oppTeam.name}</span>
            </div>
        </div>
    </Card>
);

const BallotModalBp: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    pairing: PairingBp | null,
    onSave: (pairingId: string, ballot: BallotBp) => void
}> = ({ isOpen, onClose, pairing, onSave }) => {
    const [ranks, setRanks] = useState<Map<string, 1|2|3|4>>(new Map());
    const [scores, setScores] = useState<Map<string, number[]>>(new Map());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (pairing) {
            const initialRanks = new Map();
            const initialScores = new Map();
            const teams = [pairing.ogTeam, pairing.ooTeam, pairing.cgTeam, pairing.coTeam];
            teams.forEach(team => {
                initialScores.set(team.id, team.speakers.map(() => 75));
            });
            setRanks(initialRanks);
            setScores(initialScores);
            setError(null);
        }
    }, [pairing]);

    if (!pairing) return null;

    const handleSave = () => {
        const rankValues = Array.from(ranks.values());
        if (rankValues.length !== 4 || new Set(rankValues).size !== 4) {
            setError('All teams must have a unique rank from 1 to 4.');
            return;
        }
        
        const ballotRanks = [];
        for (const [teamId, rank] of ranks.entries()) {
            const speakerPoints = scores.get(teamId);
            if (!speakerPoints || speakerPoints.some(s => s === undefined || isNaN(s))) {
                setError(`Scores not valid for team.`); return;
            }
            ballotRanks.push({ teamId, rank, speakerPoints });
        }
        
        const newBallot: BallotBp = {
            type: TournamentFormat.BP, ranks: ballotRanks, chairJudgeId: pairing.judges[0]?.id || null,
        };
        onSave(pairing.id, newBallot);
        onClose();
    };

    const teams = [pairing.ogTeam, pairing.ooTeam, pairing.cgTeam, pairing.coTeam];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Enter Ballot for ${pairing.room}`}>
            <div className="space-y-4">
                {error && <p className="text-red-500 text-sm">{error}</p>}
                {teams.map(team => (
                    <div key={team.id} className="p-3 rounded bg-[rgba(255,255,255,0.05)]">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-bold">{team.name}</h4>
                            <select 
                                value={ranks.get(team.id) || ''}
                                onChange={e => setRanks(prev => new Map(prev).set(team.id, parseInt(e.target.value) as 1|2|3|4))}
                                className="Input-base p-1 text-sm w-24"
                            >
                                <option value="">Rank</option>
                                {[1,2,3,4].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {team.speakers.map((speaker, i) => (
                                <div key={speaker.id}>
                                    <label className="text-xs text-[var(--color-text-secondary)]">{speaker.name}</label>
                                    <Input 
                                        type="number" 
                                        value={scores.get(team.id)?.[i] || ''}
                                        onChange={e => {
                                            const newScores = [...(scores.get(team.id) || team.speakers.map(()=>0))];
                                            newScores[i] = parseInt(e.target.value) || 0;
                                            setScores(prev => new Map(prev).set(team.id, newScores));
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Ballot</Button>
                </div>
            </div>
        </Modal>
    );
};

const BallotModalWsdcAp: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    pairing: PairingWsdcAp | null,
    onSave: (pairingId: string, ballot: BallotWsdcAp) => void
}> = ({ isOpen, onClose, pairing, onSave }) => {
    const [winner, setWinner] = useState<'prop' | 'opp' | null>(null);
    const [propScores, setPropScores] = useState<number[]>([]);
    const [oppScores, setOppScores] = useState<number[]>([]);
    const [propReply, setPropReply] = useState<number>(37.5);
    const [oppReply, setOppReply] = useState<number>(37.5);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (pairing) {
            setWinner(null);
            setPropScores(pairing.propTeam.speakers.map(() => 75));
            setOppScores(pairing.oppTeam.speakers.map(() => 75));
            setPropReply(37.5); setOppReply(37.5);
            setError(null);
        }
    }, [pairing]);

    if (!pairing) return null;

    const handleSave = () => {
        if (!winner) { setError("Please select a winner."); return; }
        const allScores = [...propScores, ...oppScores, propReply, oppReply];
        if (allScores.some(s => s === undefined || isNaN(s))) {
            setError("All speaker scores must be filled in."); return;
        }

        const newBallot: BallotWsdcAp = {
            type: pairing.type, winner,
            propScores, oppScores,
            propReplyScore: propReply, oppReplyScore: oppReply,
            chairJudgeId: pairing.judges[0]?.id || null,
        };
        onSave(pairing.id, newBallot);
        onClose();
    };

    const TeamScores: React.FC<{team: Team, scores: number[], setScores: (s: number[]) => void, reply: number, setReply: (r: number)=>void, side: string}> = 
    ({ team, scores, setScores, reply, setReply, side }) => (
        <div className="p-3 rounded bg-[rgba(255,255,255,0.05)]">
            <h4 className="font-bold mb-2">{side}: {team.name}</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {team.speakers.map((speaker, i) => (
                    <div key={speaker.id}>
                        <label className="text-xs text-[var(--color-text-secondary)]">{speaker.name}</label>
                        <Input type="number" value={scores[i] || ''} onChange={e => {
                            const newScores = [...scores];
                            newScores[i] = parseInt(e.target.value) || 0;
                            setScores(newScores);
                        }}/>
                    </div>
                ))}
                 <div>
                    <label className="text-xs text-[var(--color-text-secondary)]">Reply Speech</label>
                    <Input type="number" step="0.5" value={reply} onChange={e => setReply(parseFloat(e.target.value) || 0)}/>
                </div>
            </div>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Enter Ballot for ${pairing.room}`}>
            <div className="space-y-4">
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <TeamScores team={pairing.propTeam} scores={propScores} setScores={setPropScores} reply={propReply} setReply={setPropReply} side="Proposition"/>
                <TeamScores team={pairing.oppTeam} scores={oppScores} setScores={setOppScores} reply={oppReply} setReply={setOppReply} side="Opposition"/>

                <div className="pt-2">
                    <h4 className="font-bold mb-2 text-center">Decision</h4>
                    <div className="flex justify-center gap-4">
                       <Button variant={winner === 'prop' ? 'primary' : 'secondary'} onClick={() => setWinner('prop')}>
                           Win for {pairing.propTeam.name}
                       </Button>
                       <Button variant={winner === 'opp' ? 'primary' : 'secondary'} onClick={() => setWinner('opp')}>
                           Win for {pairing.oppTeam.name}
                       </Button>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Ballot</Button>
                </div>
            </div>
        </Modal>
    );
}

const RoundsView: React.FC<{ tournament: Tournament, setTournament: (tournament: Tournament) => void, onMenuClick: () => void }> = ({ tournament, setTournament, onMenuClick }) => {
    const [isLoadingMotion, setIsLoadingMotion] = useState(false);
    const [editingPairing, setEditingPairing] = useState<Pairing | null>(null);
    const [isCreateRoundModalOpen, setCreateRoundModalOpen] = useState(false);
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<PairingAlgorithm>('power-paired-fold');

    const handleCreateRound = () => {
        setTournament(prev => {
            const newRound = generateDraw(prev, selectedAlgorithm);
            
            if (newRound.pairings.length > 0 && newRound.pairings[0].type === TournamentFormat.BP) {
                const teamUpdates = new Map<string, TeamPositionBp>();
                newRound.pairings.forEach(p => {
                    const bpP = p as PairingBp;
                    teamUpdates.set(bpP.ogTeam.id, 'ogTeam');
                    teamUpdates.set(bpP.ooTeam.id, 'ooTeam');
                    teamUpdates.set(bpP.cgTeam.id, 'cgTeam');
                    teamUpdates.set(bpP.coTeam.id, 'coTeam');
                });

                const updatedTeams = prev.teams.map(team => {
                    if (teamUpdates.has(team.id)) {
                        return { ...team, positionsSpoken: [...team.positionsSpoken, teamUpdates.get(team.id)!] };
                    }
                    return team;
                });
                return { ...prev, rounds: [...prev.rounds, newRound], teams: updatedTeams };
            }
            
            return { ...prev, rounds: [...prev.rounds, newRound] };
        });
        setCreateRoundModalOpen(false);
    };

    const handleGenerateMotion = async (roundId: string) => {
        setIsLoadingMotion(true);
        const newMotion = await generateMotion();
        setTournament(prev => ({
            ...prev,
            rounds: prev.rounds.map(r => r.id === roundId ? { ...r, motion: newMotion } : r)
        }));
        setIsLoadingMotion(false);
    };

    const handleConfirmDraw = (roundId: string) => {
         setTournament(prev => ({
            ...prev,
            rounds: prev.rounds.map(r => r.id === roundId ? { ...r, status: 'results' } : r)
        }));
    };
    
    const handleSaveBallot = (pairingId: string, ballot: Ballot) => {
        setTournament(prev => {
            if (ballot.type === TournamentFormat.WSDC || ballot.type === TournamentFormat.AP) {
                const b = ballot as BallotWsdcAp;
                const round = prev.rounds.find(r => r.pairings.some(p => p.id === pairingId));
                const pairing = round?.pairings.find(p => p.id === pairingId) as PairingWsdcAp;
                
                const winnerId = b.winner === 'prop' ? pairing.propTeam.id : pairing.oppTeam.id;
                
                const updatedTeams = prev.teams.map(t => {
                    if (t.id === winnerId) return { ...t, wins: t.wins + 1 };
                    return t;
                });

                 const newRounds = prev.rounds.map(r => ({
                    ...r, pairings: r.pairings.map(p => p.id === pairingId ? { ...p, ballot } : p)
                }));

                return { ...prev, rounds: newRounds, teams: updatedTeams };
            }

            return { ...prev, rounds: prev.rounds.map(r => ({
                ...r, pairings: r.pairings.map(p => p.id === pairingId ? { ...p, ballot } : p)
            }))};
        });
    };

    const handleGenericDrop = (dragData: DragData, dropTarget: any) => {
        const draft = JSON.parse(JSON.stringify(tournament));
        if (dragData.type === 'judge' && dropTarget.type === 'judge') {
            handleJudgeDrop(draft, dragData, dropTarget);
        } else if (dragData.type === 'team' && dropTarget.type === 'team') {
            handleTeamDrop(draft, dragData, dropTarget);
        }
        setTournament(draft);
    };

    const unassignedJudges = useMemo(() => tournament.judges.filter(j => 
        !tournament.rounds.some(r => r.status === 'draft' && r.pairings.some(p => p.judges.some(pj => pj.id === j.id)))
    ), [tournament]);
    
    return (
        <div>
            <Header title="Rounds" onMenuClick={onMenuClick} children={
                <Button onClick={() => setCreateRoundModalOpen(true)} disabled={tournament.teams.length < (tournament.format === 'BP' ? 4 : 2)}>
                    <PlusIcon className="w-5 h-5"/> Create Round
                </Button>
            } />
            {tournament.rounds.length > 0 ? (
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-grow space-y-8 w-full">
                {tournament.rounds.map(round => (
                    <div key={round.id}>
                        <div className="flex justify-between items-center mb-3">
                           <h3 className="text-xl font-bold">Round {round.roundNumber} {round.status === 'draft' ? '(Draft)' : '(Results)'}</h3>
                           {round.status === 'draft' && <Button onClick={() => handleConfirmDraw(round.id)}>Confirm Draw</Button>}
                        </div>
                        <Card className="mb-4">
                            <div className="flex justify-between items-center">
                                <p className="text-[var(--color-text-secondary)] italic">{round.motion || 'No motion set for this round.'}</p>
                                <Button onClick={() => handleGenerateMotion(round.id)} loading={isLoadingMotion} variant="secondary">
                                    <WandIcon /> Generate Motion
                                </Button>
                            </div>
                        </Card>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {round.pairings.map(pairing => {
                                if (round.status === 'draft') {
                                    if (pairing.type === 'BP') {
                                        return <DrawPairingCardBp 
                                            key={pairing.id} 
                                            pairing={pairing} 
                                            onJudgeDrop={(pairingId, dragData) => handleGenericDrop(dragData, { type: 'judge', roundId: round.id, pairingId })}
                                            onTeamDrop={(pairingId, position, dragData) => handleGenericDrop(dragData, { type: 'team', roundId: round.id, pairingId, position })}
                                        />;
                                    } else {
                                        return <DrawPairingCardWsdcAp
                                            key={pairing.id}
                                            pairing={pairing}
                                            onJudgeDrop={(pairingId, dragData) => handleGenericDrop(dragData, { type: 'judge', roundId: round.id, pairingId })}
                                        />;
                                    }
                                }
                                return (
                                    <Card key={pairing.id} className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div>
                                               <h4 className="font-bold">{pairing.room}</h4>
                                               <p className="text-xs text-[var(--color-text-secondary)]">{pairing.judges.map(j => j.name).join(', ')}</p>
                                            </div>
                                            {pairing.ballot ? (
                                                <span className="text-sm font-semibold text-green-400">Result Submitted</span>
                                            ) : (
                                                <Button variant="secondary" onClick={() => setEditingPairing(pairing)}>Enter Ballot</Button>
                                            )}
                                        </div>
                                         <div className={`grid ${pairing.type === 'BP' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-sm`}>
                                            {pairing.type === 'BP' ? <>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">OG: {pairing.ogTeam.name}</div>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">OO: {pairing.ooTeam.name}</div>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">CG: {pairing.cgTeam.name}</div>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">CO: {pairing.coTeam.name}</div>
                                            </> : <>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">Prop: {pairing.propTeam.name}</div>
                                                <div className="p-2 rounded bg-[rgba(255,255,255,0.05)]">Opp: {pairing.oppTeam.name}</div>
                                            </>}
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                ))}
                </div>
                <div className="w-full md:w-64 flex-shrink-0 md:sticky top-8">
                    <h3 className="text-lg font-bold mb-2">Judge Pool</h3>
                    <Card>
                        <div className="flex flex-col gap-2">
                            {unassignedJudges.map(judge => (
                                <DraggableItem key={judge.id} onDragStart={(e) => {
                                    const dragData: DragData = { type: 'judge', id: judge.id, source: { type: 'pool' } };
                                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                                }}>
                                     <div className="bg-[rgba(255,255,255,0.1)] text-sm px-3 py-2 rounded">{judge.name}</div>
                                </DraggableItem>
                            ))}
                            {unassignedJudges.length === 0 && <p className="text-sm text-[var(--color-text-tertiary)]">No available judges</p>}
                        </div>
                    </Card>
                </div>
            </div>
            ) : <Card><p className="text-center text-[var(--color-text-secondary)] p-8">No rounds have been created yet.</p></Card> }
             
             <Modal isOpen={isCreateRoundModalOpen} onClose={() => setCreateRoundModalOpen(false)} title="Create New Round">
                 <div className="space-y-4">
                     <div>
                        <label htmlFor="pairingAlgorithm" className="block text-sm font-medium text-gray-300 mb-1">Pairing Algorithm</label>
                         <select 
                            id="pairingAlgorithm"
                            value={selectedAlgorithm}
                            onChange={e => setSelectedAlgorithm(e.target.value as PairingAlgorithm)}
                            className="Input-base"
                         >
                             <option value="random">Random</option>
                             <option value="power-paired-fold">Power-Paired (Fold)</option>
                             <option value="power-paired-slide">Power-Paired (Slide)</option>
                         </select>
                         <p className="text-xs text-gray-400 mt-2">
                            Use 'Random' for Round 1. 'Fold' pairs top teams against bottom teams in a bracket. 'Slide' pairs adjacent teams.
                         </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={() => setCreateRoundModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateRound}>Create</Button>
                    </div>
                 </div>
             </Modal>

             {editingPairing?.type === TournamentFormat.BP ? (
                 <BallotModalBp 
                    isOpen={!!editingPairing}
                    onClose={() => setEditingPairing(null)}
                    pairing={editingPairing}
                    onSave={handleSaveBallot}
                />
             ) : (
                <BallotModalWsdcAp
                    isOpen={!!editingPairing}
                    onClose={() => setEditingPairing(null)}
                    pairing={editingPairing as PairingWsdcAp}
                    onSave={handleSaveBallot}
                />
             )}
        </div>
    );
};

const StandingsView: React.FC<{ tournament: Tournament, onMenuClick: () => void }> = ({ tournament, onMenuClick }) => {
    const [activeTab, setActiveTab] = useState<'team' | 'speaker'>('team');
    const teamStandings = useMemo(() => getStandings(tournament), [tournament]);
    const speakerStandings = useMemo(() => getSpeakerStandings(tournament), [tournament]);

    const renderTeamStandings = () => (
        <table className="w-full">
            <thead>
                <tr className="border-b">
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">#</th>
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-left">Team</th>
                    {tournament.format === TournamentFormat.BP ? (
                        <>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Pts</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Speaks</th>
                        </>
                    ) : (
                        <>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Wins</th>
                            <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Speaks</th>
                        </>
                    )}
                </tr>
            </thead>
            <tbody>
                {teamStandings.map((standing, index) => (
                    <tr key={standing.id} className={`${index === teamStandings.length - 1 ? '' : 'border-b'}`}>
                        <td className="p-4 font-medium text-center">{index + 1}</td>
                        <td className="p-4 font-medium text-left">{standing.name}</td>
                         {tournament.format === TournamentFormat.BP ? (
                            <>
                                <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.teamPoints}</td>
                                <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.totalSpeakerPoints.toFixed(2)}</td>
                            </>
                        ) : (
                            <>
                                <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.wins}</td>
                                <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.totalSpeakerPoints.toFixed(2)}</td>
                            </>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );

     const renderSpeakerStandings = () => (
        <table className="w-full">
            <thead>
                <tr className="border-b">
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">#</th>
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-left">Speaker</th>
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-left">Team</th>
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Total</th>
                    <th className="p-4 text-sm font-semibold text-[var(--color-text-secondary)] text-center">Average</th>
                </tr>
            </thead>
            <tbody>
                {speakerStandings.map((standing, index) => (
                    <tr key={`${standing.teamId}-${standing.name}`} className={`${index === speakerStandings.length - 1 ? '' : 'border-b'}`}>
                        <td className="p-4 font-medium text-center">{index + 1}</td>
                        <td className="p-4 font-medium text-left">{standing.name}</td>
                        <td className="p-4 text-[var(--color-text-secondary)] text-left">{standing.teamName}</td>
                        <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.total.toFixed(2)}</td>
                        <td className="p-4 text-[var(--color-text-secondary)] text-center">{standing.average.toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div>
            <Header title="Standings" onMenuClick={onMenuClick} />
            <div className="mb-4 flex gap-2 border-b border-[rgba(255,255,255,0.2)]">
                <button onClick={() => setActiveTab('team')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'team' ? 'text-white border-b-2 border-indigo-500' : 'text-[var(--color-text-secondary)]'}`}>Team Standings</button>
                <button onClick={() => setActiveTab('speaker')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'speaker' ? 'text-white border-b-2 border-indigo-500' : 'text-[var(--color-text-secondary)]'}`}>Speaker Standings</button>
            </div>
            <Card className="p-0">
                {(activeTab === 'team' && teamStandings.length > 0) ? renderTeamStandings() :
                 (activeTab === 'speaker' && speakerStandings.length > 0) ? renderSpeakerStandings() :
                 <p className="text-center text-[var(--color-text-secondary)] p-8">No results to display.</p>}
            </Card>
        </div>
    );
};

export const TournamentDashboard: React.FC<{ tournament: Tournament, onUpdateTournament: (t: Tournament) => void, onExit: () => void }> = ({ tournament, onUpdateTournament, onExit }) => {
    const [currentView, setCurrentView] = useState<View>(View.SETUP);
    const [currentTournament, setCurrentTournament] = useState(tournament);
    const { isFullscreen, toggleFullscreen } = useFullscreen();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Modals
    const [isAddEditTeamModalOpen, setAddEditTeamModalOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [isAddJudgeModalOpen, setAddJudgeModalOpen] = useState(false);
    const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
    const [judgeToDelete, setJudgeToDelete] = useState<Judge | null>(null);

    // Judge Form
    const [newJudgeName, setNewJudgeName] = useState('');
    const [newJudgeAffiliation, setNewJudgeAffiliation] = useState('');

    const debouncedUpdate = useCallback((t: Tournament) => onUpdateTournament(t), [onUpdateTournament]);

    useEffect(() => {
        const handler = setTimeout(() => debouncedUpdate(currentTournament), 500);
        return () => clearTimeout(handler);
    }, [currentTournament, debouncedUpdate]);
    
    useEffect(() => setCurrentTournament(tournament), [tournament]);

    const openAddTeamModal = () => { setEditingTeam(null); setAddEditTeamModalOpen(true); };
    const openEditTeamModal = (team: Team) => { setEditingTeam(team); setAddEditTeamModalOpen(true); };
    const handleDeleteTeam = () => {
        if (!teamToDelete) return;
        setCurrentTournament(prev => ({ ...prev, teams: prev.teams.filter(t => t.id !== teamToDelete.id) }));
        setTeamToDelete(null);
    };

    const handleSaveTeam = (team: Team) => {
        if (editingTeam) { // Editing
            setCurrentTournament(prev => ({ ...prev, teams: prev.teams.map(t => t.id === team.id ? team : t)}));
        } else { // Adding
            setCurrentTournament(prev => ({ ...prev, teams: [...prev.teams, team]}));
        }
        setAddEditTeamModalOpen(false);
        setEditingTeam(null);
    };

    const handleAddJudge = () => {
        if (!newJudgeName.trim()) return;
        const newJudge: Judge = {
            id: uuidv4(), name: newJudgeName.trim(), affiliation: newJudgeAffiliation.trim(), roundsJudged: 0
        };
        setCurrentTournament(prev => ({ ...prev, judges: [...prev.judges, newJudge] }));
        setAddJudgeModalOpen(false);
        setNewJudgeName('');
        setNewJudgeAffiliation('');
    };

    const handleDeleteJudge = () => {
        if (!judgeToDelete) return;
        setCurrentTournament(prev => ({ ...prev, judges: prev.judges.filter(j => j.id !== judgeToDelete.id) }));
        setJudgeToDelete(null);
    };

    const renderView = () => {
        const headerProps = { onMenuClick: () => setIsSidebarOpen(true) };
        switch (currentView) {
            case View.SETUP: return <><Header title="Setup" {...headerProps} /><SetupView tournament={currentTournament} setTournament={setCurrentTournament} /></>;
            case View.TEAMS: return <TeamsView teams={currentTournament.teams} onAddTeam={openAddTeamModal} onEditTeam={openEditTeamModal} onDeleteTeam={setTeamToDelete} onMenuClick={headerProps.onMenuClick} />;
            case View.JUDGES: return <JudgesView judges={currentTournament.judges} onAddJudge={() => setAddJudgeModalOpen(true)} onDeleteJudge={setJudgeToDelete} onMenuClick={headerProps.onMenuClick} />;
            case View.ROUNDS: return <RoundsView tournament={currentTournament} setTournament={setCurrentTournament} onMenuClick={headerProps.onMenuClick} />;
            case View.STANDINGS: return <StandingsView tournament={currentTournament} onMenuClick={headerProps.onMenuClick} />;
            default: return <><Header title="Setup" {...headerProps} /><SetupView tournament={currentTournament} setTournament={setCurrentTournament} /></>;
        }
    };

    return (
        <div className="flex h-screen bg-transparent overflow-hidden">
            <Sidebar currentView={currentView} setView={setCurrentView} onExit={onExit} tournamentName={currentTournament.name} isFullscreen={isFullscreen} toggleFullscreen={toggleFullscreen} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
            
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 z-30 bg-black/30 backdrop-blur-lg md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}

            <main className="flex-1 p-4 md:p-8 overflow-y-auto md:ml-64">
                {renderView()}
            </main>
            
            <TeamModal isOpen={isAddEditTeamModalOpen} onClose={() => setAddEditTeamModalOpen(false)} onSave={handleSaveTeam} team={editingTeam} tournament={currentTournament} />
            <ConfirmModal isOpen={!!teamToDelete} onClose={() => setTeamToDelete(null)} onConfirm={handleDeleteTeam} title="Delete Team" message={`Are you sure you want to delete "${teamToDelete?.name}"?`} />
            
            <Modal isOpen={isAddJudgeModalOpen} onClose={() => setAddJudgeModalOpen(false)} title="Add New Judge">
                <div className="space-y-4">
                    <Input autoFocus placeholder="Judge Name" value={newJudgeName} onChange={e => setNewJudgeName(e.target.value)} />
                    <Input placeholder="Affiliation" value={newJudgeAffiliation} onChange={e => setNewJudgeAffiliation(e.target.value)} />
                    <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAddJudgeModalOpen(false)}>Cancel</Button><Button onClick={handleAddJudge}>Create Judge</Button></div>
                </div>
            </Modal>
            <ConfirmModal isOpen={!!judgeToDelete} onClose={() => setJudgeToDelete(null)} onConfirm={handleDeleteJudge} title="Delete Judge" message={`Are you sure you want to delete "${judgeToDelete?.name}"?`} />
        </div>
    );
};

const TeamModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (team: Team) => void, team: Team | null, tournament: Tournament }> = ({ isOpen, onClose, onSave, team, tournament }) => {
    const [name, setName] = useState('');
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [breakCategoryIds, setBreakCategoryIds] = useState<string[]>([]);
    
    const speakerCount = tournament.format === TournamentFormat.BP ? 2 : 3;

    useEffect(() => {
        if (isOpen) {
            setName(team?.name || '');
            setSpeakers(team?.speakers || Array.from({ length: speakerCount }, () => ({ id: uuidv4(), name: '', categoryIds: [] })));
            setBreakCategoryIds(team?.breakCategoryIds || []);
        }
    }, [isOpen, team, speakerCount]);
    
    const handleSpeakerNameChange = (index: number, newName: string) => {
        const newSpeakers = [...speakers];
        newSpeakers[index].name = newName;
        setSpeakers(newSpeakers);
    };

    const handleSave = () => {
        if (!name.trim() || speakers.some(s => !s.name.trim())) {
            alert("Team name and all speaker names are required."); return;
        }
        const newTeam: Team = {
            id: team?.id || uuidv4(), name: name.trim(), speakers, breakCategoryIds,
            teamPoints: team?.teamPoints || 0, wins: team?.wins || 0, totalSpeakerPoints: team?.totalSpeakerPoints || 0,
            opponents: team?.opponents || [], positionsSpoken: team?.positionsSpoken || [],
        };
        onSave(newTeam);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={team ? "Edit Team" : "Add New Team"}>
            <div className="space-y-4">
                <Input autoFocus placeholder="Team Name" value={name} onChange={e => setName(e.target.value)} />
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-300">Speakers</h4>
                    {speakers.map((s, i) => <Input key={i} placeholder={`Speaker ${i + 1}`} value={s.name} onChange={e => handleSpeakerNameChange(i, e.target.value)} />)}
                </div>
                {(tournament.breakCategories?.length || 0) > 0 && <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Break Categories</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {tournament.breakCategories?.map(cat => <label key={cat.id} className="flex items-center gap-2">
                            <input type="checkbox" checked={breakCategoryIds.includes(cat.id)} onChange={e => {
                                setBreakCategoryIds(e.target.checked ? [...breakCategoryIds, cat.id] : breakCategoryIds.filter(id => id !== cat.id));
                            }} className="accent-indigo-500" />
                            <span>{cat.name}</span>
                        </label>)}
                    </div>
                </div>}
                <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={handleSave}>Save Team</Button></div>
            </div>
        </Modal>
    );
};