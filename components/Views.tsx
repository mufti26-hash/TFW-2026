import React, { useState, useMemo, useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Link as LinkIcon, 
  CheckCircle2, 
  RefreshCw,
  Wrench,
  Clock,
  AlertTriangle,
  Users,
  Check,
  UserCheck,
  Camera,
  HeartHandshake,
  Search,
  MessageSquare,
  Send,
  Sparkles,
  Plus,
  X,
  Filter,
  ShieldAlert,
  MessageCircle,
  Layers,
  ChevronRight,
  ThumbsUp,
  Tag
} from 'lucide-react';
import { 
  Ride, 
  Operator, 
  Counter, 
  CounterWithSales, 
  AttendanceRecord, 
  MaintenanceTicket, 
  PackageItem, 
  PackageSalesRecord, 
  PackageSalesData 
} from '../types';

// --- Shared Components ---
export const ModalWrapper = ({ title, onClose, children }: { title: string; onClose: () => void; children?: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in-up">
    <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50 rounded-t-xl">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

export const ConfigErrorScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white flex-col p-8 text-center">
    <div className="bg-red-900/20 p-6 rounded-full mb-6">
      <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h1 className="text-3xl font-bold text-red-500 mb-4">Database Connection Notice</h1>
    <p className="text-gray-400 max-w-md mx-auto">Re-connecting to the persistent database server...</p>
  </div>
);

export const KioskModeWrapper = () => (
  <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white text-center text-xs py-1 px-4 font-bold uppercase tracking-widest sticky top-0 z-50 shadow-md">
    Staff Station Mode Active
  </div>
);

export const Reports = ({ dailyCounts, rides }: { dailyCounts: Record<string, Record<string, number>>; rides: Ride[] }) => {
  const reportData = useMemo(() => {
    const dates = Object.keys(dailyCounts).sort().reverse();
    return dates.map(date => {
      const counts = dailyCounts[date] || {};
      const total = Object.values(counts).reduce((sum, c) => sum + (c as number), 0);
      return { date, counts, total };
    });
  }, [dailyCounts]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h2 className="text-2xl font-bold text-white mb-6">Guest Count Reports</h2>
      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-200 uppercase bg-gray-700">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Total Guests</th>
                {rides.map(ride => (
                  <th key={ride.id} className="px-6 py-4 whitespace-nowrap">{ride.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, idx) => (
                <tr key={row.date} className={`border-b border-gray-700 ${idx % 2 === 0 ? 'bg-gray-800' : 'bg-gray-800/50'} hover:bg-gray-700/50 transition-colors`}>
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{row.date}</td>
                  <td className="px-6 py-4 text-right font-bold text-blue-400">{row.total.toLocaleString()}</td>
                  {rides.map(ride => (
                    <td key={ride.id} className="px-6 py-4 text-gray-300">
                      {(row.counts[ride.id] || 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={rides.length + 2} className="px-6 py-8 text-center text-gray-500 italic">No data recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const GenericAssignmentView = ({ 
  items, 
  personnel, 
  assignments, 
  onSave, 
  selectedDate, 
  title,
  itemNameKey = 'name'
}: any) => {
  const [localAssignments, setLocalAssignments] = useState<Record<string, number[]>>({});

  React.useEffect(() => {
    setLocalAssignments(assignments[selectedDate] || {});
  }, [selectedDate, assignments]);

  const handleAssign = (itemId: string, personnelId: string) => {
    setLocalAssignments(prev => {
      const currentAssignees = prev[itemId] || [];
      const pId = Number(personnelId);
      if (currentAssignees.includes(pId)) return prev;
      return { ...prev, [itemId]: [...currentAssignees, pId] };
    });
  };

  const handleRemove = (itemId: string, personnelId: number) => {
    setLocalAssignments(prev => {
      const currentAssignees = prev[itemId] || [];
      return { ...prev, [itemId]: currentAssignees.filter(id => id !== personnelId) };
    });
  };

  const handleSave = () => {
    onSave(selectedDate, localAssignments);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <div className="flex gap-4">
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-lg shadow-blue-900/20"
          >
            Save Assignments
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item: any) => (
          <div key={item.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700 shadow-md hover:border-gray-600 transition-colors">
            <h3 className="font-bold text-lg text-white mb-3">{item[itemNameKey]}</h3>
            
            <div className="mb-4 space-y-2">
              {(localAssignments[item.id] || []).map((pId: number) => {
                const person = personnel.find((p: any) => p.id === pId);
                return (
                  <div key={pId} className="flex justify-between items-center bg-gray-700/50 px-3 py-2 rounded-lg border border-gray-600 group">
                    <span className="text-gray-200">{person?.name || 'Unknown'}</span>
                    <button onClick={() => handleRemove(item.id.toString(), pId)} className="text-red-400 hover:text-red-300 opacity-60 group-hover:opacity-100 transition-opacity">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {(localAssignments[item.id] || []).length === 0 && (
                <p className="text-gray-500 text-sm italic">No personnel assigned.</p>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-gray-700">
              <select 
                className="w-full bg-gray-900 text-gray-300 border border-gray-600 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => {
                  if(e.target.value) {
                    handleAssign(item.id.toString(), e.target.value);
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ Assign Person</option>
                {personnel.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AssignmentView = (props: any) => <GenericAssignmentView {...props} items={props.rides} personnel={props.operators} assignments={props.dailyAssignments} title={`Games & Ride Associate Assignments: ${props.selectedDate}`} />;
export const TicketSalesAssignmentView = (props: any) => <GenericAssignmentView {...props} items={props.counters} personnel={props.ticketSalesPersonnel} assignments={props.dailyAssignments} title={`Sales Assignments: ${props.selectedDate}`} />;

export const ExpertiseReport = ({ operators, dailyAssignments, rides }: any) => {
  const stats = useMemo(() => {
    const data: Record<number, Record<number, number>> = {};
    Object.values(dailyAssignments).forEach((dayAssignments: any) => {
      Object.entries(dayAssignments).forEach(([rideId, opIds]: [string, any]) => {
        opIds.forEach((opId: number) => {
          if (!data[opId]) data[opId] = {};
          data[opId][Number(rideId)] = (data[opId][Number(rideId)] || 0) + 1;
        });
      });
    });
    return data;
  }, [dailyAssignments]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h2 className="text-2xl font-bold text-white mb-6">Expertise & Assignment History</h2>
      <div className="grid gap-6">
        {operators.map((op: Operator) => (
          <div key={op.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-blue-400 mb-4">{op.name}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {rides.map((ride: Ride) => {
                const count = stats[op.id]?.[ride.id] || 0;
                return (
                  <div key={ride.id} className={`p-3 rounded-lg border ${count > 0 ? 'bg-blue-900/20 border-blue-800' : 'bg-gray-900/50 border-gray-800'} flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs text-gray-400 mb-1 h-8 flex items-center justify-center line-clamp-2">{ride.name}</span>
                    <span className={`text-xl font-bold ${count > 5 ? 'text-green-400' : count > 0 ? 'text-blue-300' : 'text-gray-600'}`}>
                      {count}
                    </span>
                    <span className="text-[10px] uppercase text-gray-500 mt-1">Assignments</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TicketSalesExpertiseReport = ({ ticketSalesPersonnel, dailyAssignments, counters }: any) => {
  return <ExpertiseReport operators={ticketSalesPersonnel} dailyAssignments={dailyAssignments} rides={counters} />;
};

// Individual Assigned Ride Card in My Roster with direct Count Editing and Save Option
const RosterRideCard: React.FC<{
  ride: Ride & { count?: number };
  onCountChange?: (id: number, count: number) => void;
  onIncrementCount?: (id: number, delta: number) => void;
  onNavigate: (view: string) => void;
  selectedRideId: number | null;
  setSelectedRideId: (id: number | null) => void;
  problemDesc: string;
  setProblemDesc: (desc: string) => void;
  onReportProblem: (rideId: number, desc: string) => void;
  activeTicket?: MaintenanceTicket;
}> = ({
  ride,
  onCountChange,
  onIncrementCount,
  onNavigate,
  selectedRideId,
  setSelectedRideId,
  problemDesc,
  setProblemDesc,
  onReportProblem,
  activeTicket,
}) => {
  const currentCount = ride.count || 0;
  const [localInput, setLocalInput] = useState<string>(String(currentCount));
  const [justSaved, setJustSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Keep local input in sync with external real-time count when not actively editing
  React.useEffect(() => {
    if (!isEditing) {
      setLocalInput(String(currentCount));
    }
  }, [currentCount, isEditing]);

  const handleSave = () => {
    const parsed = Math.max(0, parseInt(localInput, 10) || 0);
    setLocalInput(String(parsed));
    setIsEditing(false);
    if (onCountChange) {
      onCountChange(ride.id, parsed);
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const handleQuickAdd = (delta: number) => {
    if (onIncrementCount) {
      onIncrementCount(ride.id, delta);
    } else if (onCountChange) {
      onCountChange(ride.id, Math.max(0, currentCount + delta));
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const isDirty = parseInt(localInput, 10) !== currentCount && !isNaN(parseInt(localInput, 10));

  // Tech roster names
  const assignedTechNames: string[] = [];
  if (activeTicket?.assignedToName) assignedTechNames.push(activeTicket.assignedToName);
  if (activeTicket?.helperNames && Array.isArray(activeTicket.helperNames)) {
    activeTicket.helperNames.forEach(n => {
      if (!assignedTechNames.includes(n)) assignedTechNames.push(n);
    });
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl flex flex-col gap-5 transition-all hover:border-gray-600">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
            🎢
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xl font-bold text-white tracking-wide">{ride.name}</h4>
              {justSaved && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
            </div>
            <span className="text-xs text-blue-400 font-medium tracking-wide uppercase">{ride.floor || 'Floor'}</span>
          </div>
        </div>

        <button 
          onClick={() => onNavigate('counter')}
          className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:bg-gray-700/60 transition-colors flex items-center gap-1.5"
        >
          <span>All Rides Grid</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Active Maintenance Status Banner */}
      {activeTicket && (
        <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 text-xs ${
          activeTicket.status === 'reported'
            ? 'bg-red-950/40 border-red-800/60 text-red-200'
            : activeTicket.status === 'in-progress'
            ? 'bg-yellow-950/40 border-yellow-800/60 text-yellow-200'
            : 'bg-green-950/40 border-green-800/60 text-green-200'
        }`}>
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              {activeTicket.status === 'reported' && <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />}
              {activeTicket.status === 'in-progress' && <Clock className="w-4 h-4 text-yellow-400" />}
              {activeTicket.status === 'solved' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              <span>
                {activeTicket.status === 'reported' && 'Maintenance Reported (Awaiting Technician)'}
                {activeTicket.status === 'in-progress' && 'Under Repair by Maintenance Team'}
                {activeTicket.status === 'solved' && 'Maintenance Issue Resolved ✓'}
              </span>
            </span>
            <span className="text-[10px] opacity-75 font-mono">
              {new Date(activeTicket.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <p className="text-xs opacity-90">{activeTicket.problem}</p>

          {activeTicket.status === 'in-progress' && assignedTechNames.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-yellow-800/40 font-medium">
              <Users className="w-3 h-3 text-yellow-400" />
              <span>Assigned: <strong>{assignedTechNames.join(', ')}</strong></span>
            </div>
          )}

          {activeTicket.status === 'solved' && activeTicket.resolutionNotes && (
            <div className="mt-1 pt-1 border-t border-green-800/40 font-medium text-green-300">
              <span>Resolution: {activeTicket.resolutionNotes}</span>
            </div>
          )}

          {(activeTicket.solutionImageUrl || activeTicket.photoUrl) && (
            <div className="mt-1.5 pt-1.5 border-t border-gray-700/60 flex items-center gap-2">
              <img 
                src={activeTicket.solutionImageUrl || activeTicket.photoUrl} 
                alt="Fix Verification" 
                className="w-11 h-11 rounded-lg object-cover border border-gray-600 flex-shrink-0"
              />
              <div className="text-[11px] text-gray-300">
                <span className="font-semibold text-green-400 flex items-center gap-1">
                  <Camera className="w-3 h-3" /> Proof of Fix Photo Attached
                </span>
                <span className="text-gray-400 text-[10px]">Captured by maintenance technician</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Count Editor Box */}
      <div className="bg-gray-900/90 rounded-xl p-4 border border-gray-750 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Count display & input */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Guest Count
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={localInput}
                onChange={(e) => {
                  setLocalInput(e.target.value);
                  setIsEditing(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
                className="w-28 bg-gray-800 text-2xl font-mono font-bold text-blue-400 text-center py-1.5 px-2 rounded-xl border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 outline-none transition-all shadow-inner"
              />
              {/* Stepper buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(-1)}
                  className="h-10 w-10 rounded-xl bg-gray-800 hover:bg-red-900/40 text-red-400 hover:text-red-300 active:scale-95 flex items-center justify-center text-xl font-bold transition-all border border-gray-700 select-none shadow-sm"
                  title="Decrease 1"
                  aria-label="Decrease 1"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(1)}
                  className="h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white active:scale-95 flex items-center justify-center text-xl font-bold transition-all select-none shadow-md shadow-blue-900/30"
                  title="Increase 1"
                  aria-label="Increase 1"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Quick Increment Chips */}
          <div className="hidden sm:flex flex-col justify-center gap-1 border-l border-gray-800 pl-3">
            <span className="text-[10px] text-gray-500 uppercase font-semibold">Quick Add</span>
            <div className="flex gap-1.5">
              {[5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAdd(amt)}
                  className="text-xs font-semibold px-2 py-1 bg-gray-800 hover:bg-blue-900/50 hover:text-blue-300 text-gray-300 rounded-lg border border-gray-700 transition-all active:scale-90 select-none"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save Count Button */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleSave}
            className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
              isDirty
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white ring-2 ring-emerald-400/50 shadow-emerald-900/40 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>{isDirty ? 'Save Count *' : 'Save Count'}</span>
          </button>
        </div>
      </div>

      {/* Problem Reporting Section */}
      <div className="pt-1 border-t border-gray-750">
        {selectedRideId === ride.id ? (
          <div className="flex flex-col sm:flex-row gap-2 animate-fade-in-up mt-1">
            <input 
              type="text" 
              placeholder="Describe problem (e.g. seat belt issue, sound not working)..." 
              className="bg-gray-700 text-white rounded-xl px-3 py-2 text-sm border border-gray-600 flex-grow outline-none focus:border-red-500"
              value={problemDesc}
              onChange={(e) => setProblemDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (problemDesc.trim()) {
                    onReportProblem(ride.id, problemDesc);
                    setProblemDesc('');
                    setSelectedRideId(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-grow sm:flex-grow-0"
              >
                Send Report
              </button>
              <button 
                onClick={() => setSelectedRideId(null)} 
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Need technical assistance?</span>
            <button 
              onClick={() => setSelectedRideId(ride.id)}
              className="text-red-400 hover:text-red-300 font-medium hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Report Maintenance Issue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const DailyRoster = ({ 
  rides, operators, dailyAssignments, selectedDate, onDateChange, 
  role, currentUser, attendance, onNavigate, onCountChange, onIncrementCount, hasCheckedInToday, onClockIn, isCheckinAllowed, maintenanceTickets, onReportProblem 
}: any) => {
  
  if (role === 'admin' || role === 'operation-officer') {
    const assignments = dailyAssignments[selectedDate] || {};

    // Compute distinct assigned operator IDs across all rides on selectedDate
    const assignedIdsSet = new Set<number>();
    let totalAssignmentSlots = 0;
    rides.forEach((ride: Ride) => {
      const assignedIds = assignments[ride.id] || [];
      if (Array.isArray(assignedIds)) {
        totalAssignmentSlots += assignedIds.length;
        assignedIds.forEach((id: number) => assignedIdsSet.add(id));
      }
    });

    const assignedOperatorsList = Array.from(assignedIdsSet);
    
    // Count Present and Absent among assigned operators
    let assignedPresentCount = 0;
    let assignedAbsentCount = 0;

    assignedOperatorsList.forEach((id: number) => {
      const isPresent = attendance.some((a: AttendanceRecord) => a.operatorId === id && a.date === selectedDate);
      if (isPresent) {
        assignedPresentCount++;
      } else {
        assignedAbsentCount++;
      }
    });

    // Total personnel pool count
    const totalPoolCount = operators.length;
    const totalPoolPresent = operators.filter((op: Operator) =>
      attendance.some((a: AttendanceRecord) => a.operatorId === op.id && a.date === selectedDate)
    ).length;
    const totalPoolAbsent = totalPoolCount - totalPoolPresent;

    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* Header & Date Selector */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-800 p-4 sm:p-5 rounded-2xl border border-gray-700 shadow-md gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Daily Roster</h2>
            <p className="text-xs text-gray-400 mt-0.5">Shift assignments and live attendance status</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-700 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-gray-400 font-medium">Date:</span>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => onDateChange(e.target.value)} 
              className="bg-transparent text-white text-sm outline-none cursor-pointer focus:text-blue-400" 
            />
          </div>
        </div>

        {/* Daily Roster Attendance Summary Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Assigned */}
          <div className="bg-gray-800/90 rounded-xl p-3.5 sm:p-4 border border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total Assigned</p>
              <h3 className="text-2xl font-bold text-white mt-1">{assignedOperatorsList.length}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">{totalAssignmentSlots} assigned slot{totalAssignmentSlots !== 1 ? 's' : ''}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-900/30 border border-blue-800/60 flex items-center justify-center text-blue-400 font-bold text-lg">
              👥
            </div>
          </div>

          {/* Total Present (Assigned) */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-gray-800 rounded-xl p-3.5 sm:p-4 border border-emerald-800/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Total Present
              </p>
              <h3 className="text-2xl font-bold text-emerald-300 mt-1">{assignedPresentCount}</h3>
              <p className="text-[11px] text-emerald-500/80 mt-0.5">
                {assignedOperatorsList.length > 0 ? `${Math.round((assignedPresentCount / assignedOperatorsList.length) * 100)}% attendance` : 'No assignments'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/60 flex items-center justify-center text-emerald-300 font-bold text-lg">
              ✓
            </div>
          </div>

          {/* Total Absent (Assigned) */}
          <div className="bg-gradient-to-br from-red-950/40 to-gray-800 rounded-xl p-3.5 sm:p-4 border border-red-800/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                Total Absent
              </p>
              <h3 className="text-2xl font-bold text-red-300 mt-1">{assignedAbsentCount}</h3>
              <p className="text-[11px] text-red-400/80 mt-0.5">
                {assignedAbsentCount > 0 ? `${assignedAbsentCount} missing` : 'All present'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-900/40 border border-red-700/60 flex items-center justify-center text-red-300 font-bold text-lg">
              ✗
            </div>
          </div>

          {/* All Personnel Attendance Pool */}
          <div className="bg-gray-800/90 rounded-xl p-3.5 sm:p-4 border border-gray-700 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Staff Pool ({totalPoolCount})</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-lg font-bold text-emerald-400">{totalPoolPresent} <span className="text-xs font-normal text-gray-400">P</span></span>
                <span className="text-gray-600">/</span>
                <span className="text-lg font-bold text-red-400">{totalPoolAbsent} <span className="text-xs font-normal text-gray-400">A</span></span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">Total registered pool</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gray-700/60 border border-gray-600 flex items-center justify-center text-gray-300 font-bold text-sm">
              📊
            </div>
          </div>
        </div>

        {/* Ride Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rides.map((ride: Ride) => {
            const assignedIds = assignments[ride.id] || [];
            
            // Calculate card specific present and absent
            const ridePresentCount = assignedIds.filter((id: number) =>
              attendance.some((a: AttendanceRecord) => a.operatorId === id && a.date === selectedDate)
            ).length;
            const rideAbsentCount = assignedIds.length - ridePresentCount;

            return (
              <div key={ride.id} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-md hover:border-gray-600 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-3 gap-2 pb-2 border-b border-gray-700/60">
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight">{ride.name}</h3>
                    <span className="text-xs text-gray-400">{assignedIds.length} Associate{assignedIds.length !== 1 ? 's' : ''} Assigned</span>
                  </div>
                  {assignedIds.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs px-2 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 rounded-lg font-semibold">
                        {ridePresentCount} P
                      </span>
                      {rideAbsentCount > 0 && (
                        <span className="text-xs px-2 py-0.5 bg-red-950/60 text-red-300 border border-red-800/60 rounded-lg font-semibold">
                          {rideAbsentCount} A
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {assignedIds.length > 0 ? (
                  <div className="space-y-2 flex-grow">
                    {assignedIds.map((id: number) => {
                      const op = operators.find((o: Operator) => o.id === id);
                      const att = attendance.find((a: AttendanceRecord) => a.operatorId === id && a.date === selectedDate);
                      return (
                        <div key={id} className="flex justify-between items-center text-sm bg-gray-750/70 p-2.5 rounded-xl border border-gray-700/60">
                          <span className="text-gray-200 font-medium">{op?.name || `Associate #${id}`}</span>
                          {att ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs px-2.5 py-0.5 bg-emerald-900/30 rounded-full border border-emerald-800 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-400 text-xs px-2.5 py-0.5 bg-red-900/30 rounded-full border border-red-800 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                              Absent
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-gray-500 italic text-sm">No associates assigned.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Operator View
  const myAssignments = useMemo(() => {
    const todays = dailyAssignments[selectedDate] || {};
    const myRides: (Ride & { count?: number })[] = [];
    Object.entries(todays).forEach(([rideId, opIds]: [string, any]) => {
      if (opIds.includes(currentUser?.id)) {
        const r = rides.find((ride: Ride) => ride.id === Number(rideId));
        if (r) myRides.push(r);
      }
    });
    return myRides;
  }, [dailyAssignments, selectedDate, currentUser, rides]);

  // Flattened tickets for active updates
  const allTicketsList = useMemo<MaintenanceTicket[]>(() => {
    if (!maintenanceTickets) return [];
    const list: MaintenanceTicket[] = [];
    Object.entries(maintenanceTickets).forEach(([k, val]: [string, any]) => {
      if (!val) return;
      if (typeof val === 'object' && val.id && val.rideId) {
        list.push(val as MaintenanceTicket);
      } else if (typeof val === 'object') {
        Object.values(val).forEach((innerVal: any) => {
          if (innerVal && typeof innerVal === 'object' && innerVal.id) {
            list.push(innerVal as MaintenanceTicket);
          }
        });
      }
    });
    return list.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [maintenanceTickets]);

  // Tickets relevant to this operator (reported by them or for their assigned rides)
  const myRelevantTickets = useMemo(() => {
    if (!currentUser) return [];
    const myRideIds = new Set(myAssignments.map(r => r.id));
    return allTicketsList.filter(t => 
      t.reportedById === currentUser.id || 
      myRideIds.has(t.rideId) ||
      t.date === selectedDate
    ).slice(0, 10);
  }, [allTicketsList, currentUser, myAssignments, selectedDate]);

  const [problemDesc, setProblemDesc] = useState('');
  const [selectedRideId, setSelectedRideId] = useState<number | null>(null);
  const [saveAllFeedback, setSaveAllFeedback] = useState(false);

  const handleSaveAll = () => {
    if (myAssignments.length > 0 && onCountChange) {
      myAssignments.forEach(ride => {
        onCountChange(ride.id, (ride as any).count || 0);
      });
      setSaveAllFeedback(true);
      setTimeout(() => setSaveAllFeedback(false), 2500);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white">Hello, {currentUser?.name}</h2>
        <p className="text-gray-400">{new Date(selectedDate).toDateString()}</p>
      </div>

      {!hasCheckedInToday ? (
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto text-blue-400">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">Shift Check-In</h3>
            <p className="text-gray-400">Please confirm you are present and ready for your shift.</p>
          </div>
          {isCheckinAllowed ? (
            <button 
              onClick={() => onClockIn(true, new Date().toLocaleTimeString())}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg transform transition-all hover:scale-[1.02]"
            >
              CLOCK IN NOW
            </button>
          ) : (
            <div className="bg-red-900/20 text-red-400 p-4 rounded-xl border border-red-900/50">
              Check-in is currently closed for the day.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-green-900/20 border border-green-900 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-green-300 font-medium">You are checked in for today.</span>
            </div>
            {saveAllFeedback && (
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/40">
                All counts synced ✓
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Your Assigned Rides</h3>
              <p className="text-xs text-gray-400 mt-0.5">Manage and save real-time guest entry counts</p>
            </div>
            {myAssignments.length > 1 && (
              <button
                onClick={handleSaveAll}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl border border-gray-700 flex items-center gap-1.5 transition-all shadow-sm"
              >
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save All Counts</span>
              </button>
            )}
          </div>

          {myAssignments.length > 0 ? (
            <div className="grid gap-5">
              {myAssignments.map(ride => {
                const activeTicket = allTicketsList.find(t => 
                  t.rideId === ride.id && (t.status === 'reported' || t.status === 'in-progress' || (t.date === selectedDate && t.status === 'solved'))
                );
                return (
                  <RosterRideCard
                    key={ride.id}
                    ride={ride}
                    onCountChange={onCountChange}
                    onIncrementCount={onIncrementCount}
                    onNavigate={onNavigate}
                    selectedRideId={selectedRideId}
                    setSelectedRideId={setSelectedRideId}
                    problemDesc={problemDesc}
                    setProblemDesc={setProblemDesc}
                    onReportProblem={onReportProblem}
                    activeTicket={activeTicket}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700 border-dashed">
              <p className="text-gray-400">You have not been assigned to any rides yet.</p>
              <p className="text-sm text-gray-500 mt-2">Please contact the Operation Officer.</p>
            </div>
          )}

          {/* Real-Time Maintenance Status Feed for the Operator */}
          {myRelevantTickets.length > 0 && (
            <div className="bg-gray-800/90 rounded-2xl p-5 border border-gray-700 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Maintenance & Breakdown Status ({myRelevantTickets.length})
                  </h4>
                </div>
                <span className="text-[10px] text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full font-mono">
                  Live Multi-Device Feed
                </span>
              </div>

              <div className="divide-y divide-gray-750">
                {myRelevantTickets.map(ticket => {
                  const techNames = [ticket.assignedToName, ...(ticket.helperNames || [])].filter(Boolean);
                  return (
                    <div key={ticket.id} className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{ticket.rideName}</span>
                          <span className="text-[10px] text-gray-500">({ticket.date})</span>
                        </div>
                        <p className="text-gray-300">{ticket.problem}</p>
                        {ticket.status === 'in-progress' && techNames.length > 0 && (
                          <p className="text-[11px] text-yellow-300 flex items-center gap-1 font-medium">
                            <Users className="w-3 h-3" /> Assigned to: {techNames.join(', ')}
                          </p>
                        )}
                        {ticket.status === 'solved' && ticket.resolutionNotes && (
                          <p className="text-[11px] text-green-300 font-medium">
                            ✓ {ticket.resolutionNotes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1 whitespace-nowrap ${
                          ticket.status === 'reported'
                            ? 'bg-red-900/30 text-red-300 border-red-800'
                            : ticket.status === 'in-progress'
                            ? 'bg-yellow-900/30 text-yellow-300 border-yellow-800 animate-pulse'
                            : 'bg-green-900/30 text-green-300 border-green-800'
                        }`}>
                          {ticket.status === 'reported' && <AlertTriangle className="w-3 h-3" />}
                          {ticket.status === 'in-progress' && <Clock className="w-3 h-3" />}
                          {ticket.status === 'solved' && <Check className="w-3 h-3" />}
                          {ticket.status === 'reported' ? 'Reported' : ticket.status === 'in-progress' ? 'In Progress' : 'Solved'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const TicketSalesRoster = ({ dailyAssignments, ...props }: any) => {
  return <DailyRoster {...props} dailyAssignments={dailyAssignments} rides={props.counters} operators={props.ticketSalesPersonnel} />;
};

export const TicketSalesView = ({ 
  countersWithSales, 
  onSalesChange,
  onIncrementSales
}: { 
  countersWithSales: CounterWithSales[]; 
  onSalesChange: (id: number, count: number) => void;
  onIncrementSales?: (id: number, delta: number) => void;
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
      {countersWithSales.map(counter => (
        <div key={counter.id} className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 flex flex-col transition-all">
          <div className="p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 to-gray-750">
            <h3 className="text-xl font-bold text-white">{counter.name}</h3>
            <span className="text-xs text-teal-400 uppercase tracking-wider font-semibold">{counter.type || 'General'}</span>
          </div>
          <div className="p-8 flex flex-col items-center justify-center flex-grow gap-6">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-1">Tickets Sold Today</p>
              <div className="text-5xl font-mono font-bold text-teal-400 select-none">{counter.sales.toLocaleString()}</div>
            </div>
            
            <div className="flex items-center gap-6 w-full max-w-[240px]">
              <button 
                onClick={() => onIncrementSales ? onIncrementSales(counter.id, -1) : onSalesChange(counter.id, Math.max(0, counter.sales - 1))}
                className="h-14 w-14 rounded-full bg-gray-700 hover:bg-red-900/50 active:scale-90 text-red-400 hover:text-red-200 flex items-center justify-center text-3xl font-bold transition-all select-none"
                aria-label="Decrease sales"
              >
                -
              </button>
              <div className="flex-grow"></div>
              <button 
                onClick={() => onIncrementSales ? onIncrementSales(counter.id, 1) : onSalesChange(counter.id, counter.sales + 1)}
                className="h-14 w-14 rounded-full bg-teal-600 hover:bg-teal-500 active:scale-90 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-teal-900/50 transition-all select-none"
                aria-label="Increase sales"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const DailySalesEntry = ({ 
  currentUser, 
  selectedDate, 
  onDateChange, 
  packageSales, 
  onSave, 
  otherSalesCategories = [], 
  availablePackages = [],
  currency = 'BDT'
}: any) => {
  const existingData = packageSales[selectedDate]?.[currentUser.id] || {};

  const packagesList: PackageItem[] = availablePackages.length > 0 ? availablePackages : [
    { id: 'pkg-1', name: 'Single Entry', price: 500 },
    { id: 'pkg-2', name: 'Family Pack', price: 1800 },
    { id: 'pkg-3', name: 'VIP Pass', price: 1000 },
    { id: 'pkg-4', name: 'Student Deal', price: 300 },
    { id: 'pkg-5', name: 'Corporate', price: 450 }
  ];

  const [packages, setPackages] = useState<Record<string, number>>(existingData.packages || {});
  const [otherSales, setOtherSales] = useState<Array<{category: string; amount: number; description?: string}>>(existingData.otherSales || []);

  const handlePackageChange = (type: string, val: string) => {
    setPackages(prev => ({ ...prev, [type]: Number(val) }));
  };

  const handleOtherSalesAdd = () => {
    setOtherSales(prev => [...prev, { category: otherSalesCategories[0] || 'General', amount: 0, description: '' }]);
  };

  const handleOtherSalesUpdate = (idx: number, field: string, val: any) => {
    const updated = [...otherSales];
    updated[idx] = { ...updated[idx], [field]: field === 'amount' ? Number(val) : val };
    setOtherSales(updated);
  };

  const handleOtherSalesRemove = (idx: number) => {
    setOtherSales(prev => prev.filter((_, i) => i !== idx));
  };

  const calculateTotal = () => {
    let total = 0;
    packagesList.forEach(pkg => {
      const count = Number(packages[pkg.name] || 0);
      total += count * (pkg.price || 0);
    });
    otherSales.forEach(s => total += Number(s.amount || 0));
    return total;
  };

  const handleSave = () => {
    onSave({ packages, otherSales, total: calculateTotal() });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Daily Sales Entry</h2>
          <p className="text-gray-400 text-sm">Log ticket sales for {new Date(selectedDate).toDateString()}</p>
        </div>
        <div className="flex gap-4 items-center">
          <input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="bg-gray-700 text-white p-2 rounded border border-gray-600 outline-none focus:border-blue-500" />
          <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg">
            Save Sales Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4 border-b border-gray-700 pb-2">Packages & Passes</h3>
          <div className="space-y-4">
            {packagesList.map(pkg => (
              <div key={pkg.id || pkg.name} className="flex justify-between items-center">
                <div>
                  <label className="text-gray-200 font-medium block">{pkg.name}</label>
                  <span className="text-xs text-green-400">{currency} {pkg.price.toLocaleString()}</span>
                </div>
                <input 
                  type="number" 
                  min="0"
                  className="bg-gray-700 text-white w-24 p-2 rounded border border-gray-600 text-right outline-none focus:border-blue-500"
                  value={packages[pkg.name] || ''}
                  onChange={(e) => handlePackageChange(pkg.name, e.target.value)}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
            <h3 className="text-lg font-bold text-white">Other Sales</h3>
            <button onClick={handleOtherSalesAdd} className="text-xs bg-blue-600 px-2.5 py-1 rounded text-white hover:bg-blue-700">+ Add Item</button>
          </div>
          <div className="space-y-3 flex-grow">
            {otherSales.map((item, idx) => (
              <div key={idx} className="bg-gray-700/50 p-3 rounded-lg border border-gray-600 space-y-2 animate-fade-in-up">
                <div className="flex gap-2">
                  <input 
                    list="categories"
                    className="bg-gray-900 text-white w-full p-2 rounded text-sm border border-gray-600 outline-none focus:border-blue-500" 
                    placeholder="Category"
                    value={item.category}
                    onChange={(e) => handleOtherSalesUpdate(idx, 'category', e.target.value)}
                  />
                  <datalist id="categories">
                    {otherSalesCategories.map((c: string) => <option key={c} value={c} />)}
                  </datalist>
                  <input 
                    type="number" 
                    className="bg-gray-900 text-white w-24 p-2 rounded text-sm border border-gray-600 text-right outline-none focus:border-blue-500" 
                    placeholder="Amount"
                    value={item.amount || ''}
                    onChange={(e) => handleOtherSalesUpdate(idx, 'amount', e.target.value)}
                  />
                  <button onClick={() => handleOtherSalesRemove(idx)} className="text-red-400 hover:text-red-300 px-2">
                    &times;
                  </button>
                </div>
                <input 
                  type="text" 
                  className="bg-gray-900 text-white w-full p-2 rounded text-sm border border-gray-600 outline-none focus:border-blue-500" 
                  placeholder="Description (Optional)"
                  value={item.description || ''}
                  onChange={(e) => handleOtherSalesUpdate(idx, 'description', e.target.value)}
                />
              </div>
            ))}
            {otherSales.length === 0 && <p className="text-gray-500 text-center italic text-sm py-4">No other sales recorded.</p>}
          </div>
        </div>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center shadow-lg">
        <span className="text-gray-400 text-lg">Total Daily Revenue</span>
        <p className="text-4xl font-bold text-green-400 mt-2">{currency} {calculateTotal().toLocaleString()}</p>
      </div>
    </div>
  );
};

export const SalesOfficerDashboard = ({ 
  ticketSalesPersonnel, 
  packageSales, 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange, 
  currency = 'BDT'
}: any) => {
  const aggregatedData = useMemo(() => {
    const totals: Record<number, number> = {};
    const records: any[] = [];
    Object.keys(packageSales).forEach(date => {
      if (date >= startDate && date <= endDate) {
        Object.entries(packageSales[date]).forEach(([pId, data]: [string, any]) => {
          const id = Number(pId);
          totals[id] = (totals[id] || 0) + (data.total || 0);
          records.push({ date, personnelId: id, ...data });
        });
      }
    });
    return { totals, records };
  }, [packageSales, startDate, endDate]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-white">Sales Dashboard</h2>
        <div className="flex gap-2 items-center text-sm">
          <span className="text-gray-400">From</span>
          <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="bg-gray-700 text-white p-2 rounded border border-gray-600 outline-none focus:border-blue-500" />
          <span className="text-gray-400">To</span>
          <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="bg-gray-700 text-white p-2 rounded border border-gray-600 outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {ticketSalesPersonnel.map((p: any) => (
          <div key={p.id} className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow text-center">
            <div className="w-16 h-16 bg-teal-900/50 text-teal-400 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 border border-teal-800">
              {p.name.charAt(0)}
            </div>
            <h3 className="font-bold text-white text-lg">{p.name}</h3>
            <p className="text-gray-400 text-sm mb-2">Total Sales (Range)</p>
            <p className="text-3xl font-bold text-green-400">{currency} {(aggregatedData.totals[p.id] || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-700 text-gray-200 uppercase">
            <tr>
              <th className="p-4">Date</th>
              <th className="p-4">Personnel</th>
              <th className="p-4 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {aggregatedData.records.map((r, idx) => {
              const p = ticketSalesPersonnel.find((tp: any) => tp.id === r.personnelId);
              return (
                <tr key={idx} className="hover:bg-gray-700/50 transition-colors">
                  <td className="p-4">{r.date}</td>
                  <td className="p-4 font-medium text-white">{p?.name || 'Unknown'}</td>
                  <td className="p-4 text-right font-bold text-green-400">{currency} {r.total?.toLocaleString()}</td>
                </tr>
              );
            })}
            {aggregatedData.records.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center italic">No records found for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const BackupManager = ({ 
  onClose, 
  onExport, 
  onImport, 
  onResetDay, 
  appLogo, 
  onLogoChange, 
  maintenancePersonnel, 
  onAddMaintenancePersonnel, 
  onDeleteMaintenancePersonnel, 
  onClearMaintenanceTickets 
}: any) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(appLogo || '');
  const [dateToReset, setDateToReset] = useState(new Date().toISOString().split('T')[0]);
  const [techName, setTechName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => onImport(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  return (
    <ModalWrapper title="System Configuration & Backup" onClose={onClose}>
      <div className="space-y-6">
        <section>
          <h3 className="text-base font-bold text-white mb-2">App Logo</h3>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-grow bg-gray-700 text-white rounded p-2 text-sm border border-gray-600 outline-none focus:border-blue-500"
              placeholder="Logo URL (https://...)"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
            <button onClick={() => onLogoChange(logoUrl)} className="bg-blue-600 text-white px-4 rounded text-sm hover:bg-blue-700 transition-colors">Save</button>
          </div>
        </section>

        <hr className="border-gray-700" />

        <section className="grid grid-cols-2 gap-4">
          <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 text-center">
            <h4 className="font-bold text-white mb-2 text-sm">Export Data</h4>
            <button onClick={onExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm w-full font-semibold transition-colors">Download JSON</button>
          </div>
          <div className="bg-gray-700/30 p-4 rounded-lg border border-gray-600 text-center">
            <h4 className="font-bold text-white mb-2 text-sm">Import Data</h4>
            <button onClick={() => fileInputRef.current?.click()} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-sm w-full font-semibold transition-colors">Upload JSON</button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
          </div>
        </section>
        
        <section className="bg-red-900/15 p-4 rounded-xl border border-red-900/40 space-y-2">
          <h3 className="text-base font-bold text-red-400">Daily Reset</h3>
          <p className="text-gray-400 text-xs">Permanently clear operational counts for a specific date.</p>
          <div className="flex gap-2">
            <input type="date" value={dateToReset} onChange={(e) => setDateToReset(e.target.value)} className="bg-gray-700 text-white p-2 rounded text-sm border border-gray-600 outline-none focus:border-red-500" />
            <button onClick={() => onResetDay(dateToReset)} className="bg-red-600 hover:bg-red-700 text-white px-4 rounded font-bold text-sm transition-colors">Reset</button>
          </div>
        </section>
      </div>
    </ModalWrapper>
  );
};

export const OperatorManager = ({ operators, onClose, onAddOperator, onDeleteOperators }: any) => {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <ModalWrapper title="Manage Games & Ride Associates" onClose={onClose}>
      <div className="space-y-6">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Associate Name" 
            className="flex-grow bg-gray-700 text-white p-2 rounded border border-gray-600 outline-none focus:border-green-500"
          />
          <button 
            onClick={() => { if(name) { onAddOperator(name); setName(''); } }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 rounded font-bold transition-colors"
          >
            Add
          </button>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-2 max-h-60 overflow-y-auto border border-gray-700 custom-scrollbar">
          {operators.map((op: Operator) => (
            <div key={op.id} className="flex items-center p-3 hover:bg-gray-700/50 rounded cursor-pointer border-b border-gray-800 last:border-0 transition-colors" onClick={() => toggleSelect(op.id)}>
              <input type="checkbox" checked={selectedIds.includes(op.id)} readOnly className="mr-3 w-4 h-4 rounded text-blue-600 bg-gray-700 border-gray-600" />
              <span className="text-gray-200">{op.name}</span>
            </div>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <button 
            onClick={() => { onDeleteOperators(selectedIds); setSelectedIds([]); }}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold transition-colors"
          >
            Delete Selected ({selectedIds.length})
          </button>
        )}
      </div>
    </ModalWrapper>
  );
};

export const EditImageModal = ({ ride, onClose, onSave }: any) => {
  const [imagePreview, setImagePreview] = useState<string>(ride.imageUrl || '');
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState<string>(ride.imageUrl?.startsWith('http') ? ride.imageUrl : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          setImagePreview(compressed);
        } else {
          setImagePreview(dataUrl);
        }
        setIsProcessing(false);
      };
      img.onerror = () => {
        setImagePreview(dataUrl);
        setIsProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSave = () => {
    const finalImage = inputMode === 'url' ? urlInput.trim() : imagePreview.trim();
    onSave(ride.id, finalImage);
  };

  const handleRemoveImage = () => {
    setImagePreview('');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <ModalWrapper title={`Edit Image: ${ride.name}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Toggle Mode */}
        <div className="flex items-center justify-between bg-gray-900/60 p-1 rounded-xl border border-gray-700">
          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              inputMode === 'upload' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload from Device
          </button>
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              inputMode === 'url' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" /> Web Link / URL
          </button>
        </div>

        {inputMode === 'upload' ? (
          <div>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/gif, image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[130px] ${
                isDragging 
                  ? 'border-blue-500 bg-blue-950/30' 
                  : 'border-gray-600 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-900/80'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-white">Click to browse or drag picture here</p>
              <p className="text-xs text-gray-400 mt-0.5">Supports PNG, JPG, JPEG, WEBP</p>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-gray-400 block mb-1">Image Web Address (URL)</label>
            <input 
              type="text" 
              value={urlInput} 
              onChange={(e) => {
                setUrlInput(e.target.value);
                setImagePreview(e.target.value);
              }} 
              placeholder="https://images.unsplash.com/..." 
              className="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-600 outline-none focus:border-blue-500 text-sm"
            />
          </div>
        )}

        {/* Live Preview Display */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-400">Current / Selected Image</span>
            {imagePreview && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Photo
              </button>
            )}
          </div>
          <div className="aspect-video bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden border border-gray-700 relative group shadow-inner">
            {imagePreview ? (
              <img 
                src={imagePreview} 
                alt="Ride Preview" 
                className="w-full h-full object-cover"
                onError={() => {}}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 p-4">
                <ImageIcon className="w-10 h-10 mb-1 opacity-40" />
                <span className="text-xs">No picture selected (will display default placeholder)</span>
              </div>
            )}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xs font-semibold gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Processing image...
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button 
            type="button"
            onClick={onClose} 
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl font-medium transition-colors cursor-pointer text-sm"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            disabled={isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold transition-all shadow-md shadow-blue-950/40 cursor-pointer text-sm flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Save Ride Image
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export const HistoryLog = ({ history, onClearHistory }: any) => (
  <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl animate-fade-in-up">
    <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-gray-800 to-gray-750">
      <h2 className="text-2xl font-bold text-white">System History Log</h2>
      <button onClick={onClearHistory} className="bg-red-900/30 text-red-300 hover:bg-red-900/50 px-4 py-2 rounded border border-red-800/50 transition-colors text-sm">Clear Logs</button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-400">
        <thead className="bg-gray-700 text-gray-200 uppercase text-xs">
          <tr>
            <th className="px-6 py-4">Time</th>
            <th className="px-6 py-4">User</th>
            <th className="px-6 py-4">Action</th>
            <th className="px-6 py-4">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {history.map((h: any) => (
            <tr key={h.id} className="hover:bg-gray-750 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</td>
              <td className="px-6 py-4 font-semibold text-blue-400">{h.user}</td>
              <td className="px-6 py-4">
                <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs border border-gray-600 whitespace-nowrap">{h.action}</span>
              </td>
              <td className="px-6 py-4 text-gray-300">{h.details}</td>
            </tr>
          ))}
          {history.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center italic">No history available.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Customer Experience (CX) Portal & Feedback View ---
const CX_FEEDBACK_CATEGORIES = [
  'Guest Comfort & Seating',
  'Ride Smoothness & Noise',
  'Safety Harness & Restraints',
  'Audio, Video & Light FX',
  'Air Conditioning & Ventilation',
  'Cleanliness & Sanitation',
  'Queue Line & Signage',
  'Mechanical / Operational Issue',
  'General Guest Feedback'
];

interface CXFeedbackViewProps {
  rides: Ride[];
  currentUser: Operator | null;
  role: string;
  selectedDate: string;
  onDateChange?: (date: string) => void;
  maintenanceTickets: Record<string, Record<string, MaintenanceTicket>> | Record<string, any>;
  onReportProblem: (
    rideId: number, 
    problem: string, 
    feedbackCategory?: string, 
    priority?: 'normal' | 'high' | 'urgent', 
    guestDetails?: string, 
    source?: string
  ) => void;
  floors?: string[];
  onNavigate?: (view: string) => void;
}

export const CustomerExperienceView: React.FC<CXFeedbackViewProps> = ({
  rides,
  currentUser,
  role,
  selectedDate,
  maintenanceTickets,
  onReportProblem,
  floors = ['All Floors', 'L1', 'L2', 'L3', 'Outdoor'],
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('All Floors');
  const [statusFilter, setStatusFilter] = useState<'all' | 'issues-only' | 'operational'>('all');
  
  // Feedback modal state
  const [feedbackRideId, setFeedbackRideId] = useState<number | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState(CX_FEEDBACK_CATEGORIES[0]);
  const [feedbackPriority, setFeedbackPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [problemDescription, setProblemDescription] = useState('');
  const [guestDetails, setGuestDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccessRide, setSubmittedSuccessRide] = useState<number | null>(null);

  // Flatten tickets for today
  const todaysTickets: MaintenanceTicket[] = useMemo(() => {
    if (!maintenanceTickets || !maintenanceTickets[selectedDate]) return [];
    return (Object.values(maintenanceTickets[selectedDate]) as MaintenanceTicket[])
      .sort((a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime());
  }, [maintenanceTickets, selectedDate]);

  // All tickets flattened across all dates for history tracking
  const allTicketsFlat: MaintenanceTicket[] = useMemo(() => {
    if (!maintenanceTickets) return [];
    const flat: MaintenanceTicket[] = [];
    Object.entries(maintenanceTickets).forEach(([dateStr, byId]) => {
      if (byId && typeof byId === 'object') {
        Object.values(byId).forEach((ticket: any) => {
          if (ticket && typeof ticket === 'object') {
            flat.push({ ...ticket, date: ticket.date || dateStr });
          }
        });
      }
    });
    return flat.sort((a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime());
  }, [maintenanceTickets]);

  // CX specific tickets
  const cxTickets = useMemo(() => {
    return allTicketsFlat.filter(t => 
      t.source === 'cx' || 
      t.reportedByRole?.toLowerCase().includes('cx') || 
      t.reportedByRole?.toLowerCase().includes('customer experience')
    );
  }, [allTicketsFlat]);

  // Map active tickets by rideId for rapid lookup
  const activeTicketsByRideId = useMemo(() => {
    const map: Record<number, MaintenanceTicket[]> = {};
    todaysTickets.forEach(ticket => {
      if (ticket.status === 'reported' || ticket.status === 'in-progress') {
        if (!map[ticket.rideId]) map[ticket.rideId] = [];
        map[ticket.rideId].push(ticket);
      }
    });
    return map;
  }, [todaysTickets]);

  const solvedTicketsByRideId = useMemo(() => {
    const map: Record<number, MaintenanceTicket[]> = {};
    todaysTickets.forEach(ticket => {
      if (ticket.status === 'solved') {
        if (!map[ticket.rideId]) map[ticket.rideId] = [];
        map[ticket.rideId].push(ticket);
      }
    });
    return map;
  }, [todaysTickets]);

  // Filtered rides
  const filteredRides = useMemo(() => {
    return rides.filter(ride => {
      const matchesSearch = !searchQuery || 
        ride.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ride.floor?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFloor = selectedFloor === 'All Floors' || ride.floor === selectedFloor;

      const hasActiveIssue = (activeTicketsByRideId[ride.id] || []).length > 0;
      let matchesStatus = true;
      if (statusFilter === 'issues-only') matchesStatus = hasActiveIssue;
      if (statusFilter === 'operational') matchesStatus = !hasActiveIssue;

      return matchesSearch && matchesFloor && matchesStatus;
    });
  }, [rides, searchQuery, selectedFloor, statusFilter, activeTicketsByRideId]);

  // Stats calculation
  const totalRidesCount = rides.length;
  const ridesWithIssuesCount = Object.keys(activeTicketsByRideId).length;
  const cxTicketsTodayCount = todaysTickets.filter(t => t.source === 'cx' || t.reportedByRole?.includes('CX')).length;
  const solvedTodayCount = todaysTickets.filter(t => t.status === 'solved').length;

  const handleOpenFeedbackModal = (rideId?: number) => {
    setFeedbackRideId(rideId || (rides.length > 0 ? rides[0].id : null));
    setFeedbackCategory(CX_FEEDBACK_CATEGORIES[0]);
    setFeedbackPriority('normal');
    setProblemDescription('');
    setGuestDetails('');
  };

  const handleCloseFeedbackModal = () => {
    setFeedbackRideId(null);
    setProblemDescription('');
    setGuestDetails('');
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackRideId || !problemDescription.trim()) return;

    setIsSubmitting(true);
    try {
      onReportProblem(
        feedbackRideId,
        problemDescription.trim(),
        feedbackCategory,
        feedbackPriority,
        guestDetails.trim(),
        'cx'
      );
      setSubmittedSuccessRide(feedbackRideId);
      setTimeout(() => setSubmittedSuccessRide(null), 3000);
      handleCloseFeedbackModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedRideObj = rides.find(r => r.id === feedbackRideId);

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-rose-950/80 via-purple-950/70 to-gray-900 border border-rose-900/50 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-500/50 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/50 flex-shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Customer Experience (CX)
                </h1>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-900/60 text-rose-300 border border-rose-700/60">
                  Guest Feedback & Dispatch
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl">
                Logged in as <strong className="text-white">{currentUser?.name || 'CX Team Member'}</strong>. Send maintenance-related customer feedback for any attraction directly to technicians in real-time.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => handleOpenFeedbackModal()}
              className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-rose-900/40 flex items-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Customer Feedback</span>
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('maintenance-dashboard')}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs sm:text-sm font-medium px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="View Technical Repair Status"
              >
                <Wrench className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Repairs Dashboard</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-rose-900/40">
          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">All Park Rides</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5 flex items-center gap-1.5">
              <span>{totalRidesCount}</span>
              <span className="text-[11px] font-normal text-gray-500">(No assignment needed)</span>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Active Issues</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {ridesWithIssuesCount} <span className="text-xs font-normal text-gray-400">attractions</span>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">CX Feedbacks Today</span>
            <div className="text-xl sm:text-2xl font-black text-rose-400 mt-0.5">
              {cxTicketsTodayCount} <span className="text-xs font-normal text-gray-400">dispatched</span>
            </div>
          </div>

          <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800">
            <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">Repairs Resolved</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">
              {solvedTodayCount} <span className="text-xs font-normal text-gray-400">fixed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-md">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all rides & attractions by name or floor..."
            className="w-full bg-gray-900 text-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm border border-gray-700 outline-none focus:border-rose-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Floor Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          {['All Floors', ...new Set(rides.map(r => r.floor).filter(Boolean))].map((fl) => (
            <button
              key={fl}
              type="button"
              onClick={() => setSelectedFloor(fl)}
              className={`text-xs px-3 py-2 rounded-xl font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedFloor === fl
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40 font-bold'
                  : 'bg-gray-900/80 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              {fl}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl border border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all' ? 'bg-gray-750 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All ({rides.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('issues-only')}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              statusFilter === 'issues-only' ? 'bg-amber-900/80 text-amber-300 font-bold border border-amber-700/60' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Issues ({ridesWithIssuesCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('operational')}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
              statusFilter === 'operational' ? 'bg-emerald-900/80 text-emerald-300 font-bold border border-emerald-700/60' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Operational ({rides.length - ridesWithIssuesCount})</span>
          </button>
        </div>
      </div>

      {/* Rides Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
        {filteredRides.map(ride => {
          const activeIssues = activeTicketsByRideId[ride.id] || [];
          const solvedIssues = solvedTicketsByRideId[ride.id] || [];
          const hasActiveIssue = activeIssues.length > 0;
          const isJustSubmitted = submittedSuccessRide === ride.id;

          return (
            <div 
              key={ride.id} 
              className={`bg-gray-800 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-xl ${
                hasActiveIssue 
                  ? 'border-amber-500/60 bg-gradient-to-b from-gray-800 to-amber-950/20' 
                  : isJustSubmitted
                  ? 'border-rose-500 shadow-rose-950/50 ring-2 ring-rose-500/50'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              {/* Card Header & Image */}
              <div>
                <div className="relative aspect-video w-full bg-gray-900 overflow-hidden group">
                  {ride.imageUrl ? (
                    <img 
                      src={ride.imageUrl} 
                      alt={ride.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900">
                      <Sparkles className="w-8 h-8 opacity-30 text-rose-400 mb-1" />
                      <span className="text-[11px] font-medium text-gray-500">{ride.name}</span>
                    </div>
                  )}

                  {/* Floor Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="bg-black/75 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/10 shadow">
                      {ride.floor}
                    </span>
                  </div>

                  {/* Status Overlay Badge */}
                  <div className="absolute top-2.5 right-2.5">
                    {hasActiveIssue ? (
                      <span className="bg-amber-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-md animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        {activeIssues[0].status === 'in-progress' ? 'In Repair' : 'Issue Logged'}
                      </span>
                    ) : (
                      <span className="bg-emerald-600/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 shadow">
                        <Check className="w-3 h-3" /> Operational
                      </span>
                    )}
                  </div>
                </div>

                {/* Ride Info Details */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-bold text-base text-white truncate" title={ride.name}>
                      {ride.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                      {ride.capacity && <span>Capacity: {ride.capacity}</span>}
                      {ride.capacity && ride.minHeight && <span>•</span>}
                      {ride.minHeight && <span>Min Height: {ride.minHeight}</span>}
                    </div>
                  </div>

                  {/* Active Issue Alert Box on Card */}
                  {hasActiveIssue && (
                    <div className="bg-amber-950/40 border border-amber-700/60 rounded-xl p-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-amber-300 font-bold text-[11px]">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-amber-400" />
                          {activeIssues[0].status === 'in-progress' ? 'Repair In Progress' : 'Reported to Maintenance'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          {new Date(activeIssues[0].reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-200 text-xs line-clamp-2 leading-tight">
                        {activeIssues[0].problem}
                      </p>
                      {activeIssues[0].assignedToName && (
                        <div className="text-[10px] text-amber-400/90 flex items-center gap-1 pt-0.5">
                          <UserCheck className="w-3 h-3" />
                          <span>Tech: <strong>{activeIssues[0].assignedToName}</strong> {activeIssues[0].helperNames?.length ? `+${activeIssues[0].helperNames.length}` : ''}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Solved Status banner if resolved today */}
                  {!hasActiveIssue && solvedIssues.length > 0 && (
                    <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-2 text-[11px] text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Repaired Today
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(solvedIssues[0].solvedAt || solvedIssues[0].reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Action */}
              <div className="p-4 pt-0">
                <button
                  type="button"
                  onClick={() => handleOpenFeedbackModal(ride.id)}
                  className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold py-2.5 px-3 rounded-xl shadow-md shadow-rose-950/40 flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
                >
                  <HeartHandshake className="w-3.5 h-3.5" />
                  <span>Send Customer Feedback</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRides.length === 0 && (
        <div className="bg-gray-800/60 rounded-2xl border border-gray-700/80 p-12 text-center text-gray-400 space-y-3">
          <HeartHandshake className="w-12 h-12 text-gray-600 mx-auto" />
          <p className="text-base font-semibold text-gray-300">No rides match your filter criteria</p>
          <p className="text-xs text-gray-500">Try clearing your search query or switching floor tabs.</p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedFloor('All Floors');
              setStatusFilter('all');
            }}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer mt-2"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Customer Experience (CX) Feedbacks Feed / Status Section */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden mt-8">
        <div className="p-5 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-800 via-gray-800 to-gray-750">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Live Customer Experience (CX) Feedbacks & Resolution Tracker
              </h2>
              <p className="text-xs text-gray-400">
                Track status of guest feedback tickets dispatched to Maintenance
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-400 bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-700 self-start sm:self-auto font-mono">
            {cxTickets.length} Total CX Tickets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-gray-300">
            <thead className="bg-gray-900/90 text-gray-400 uppercase text-[11px] tracking-wider border-b border-gray-700">
              <tr>
                <th className="px-5 py-3.5">Attraction & Date</th>
                <th className="px-5 py-3.5">Category & Feedback Details</th>
                <th className="px-5 py-3.5">Priority</th>
                <th className="px-5 py-3.5">Reported By</th>
                <th className="px-5 py-3.5">Resolution Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60">
              {cxTickets.slice(0, 20).map((ticket) => {
                return (
                  <tr key={ticket.id} className="hover:bg-gray-750/50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-bold text-white text-sm">{ticket.rideName}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-600" />
                        <span>{ticket.date} • {new Date(ticket.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {ticket.feedbackCategory && (
                        <span className="inline-block bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[10px] font-bold px-2 py-0.5 rounded-md mb-1">
                          {ticket.feedbackCategory}
                        </span>
                      )}
                      <p className="text-gray-200 text-xs sm:text-sm leading-relaxed max-w-md font-medium">
                        {ticket.problem}
                      </p>
                      {ticket.guestDetails && (
                        <p className="text-[11px] text-gray-400 italic mt-1 bg-gray-900/60 p-1.5 rounded border border-gray-750">
                          Guest note: "{ticket.guestDetails}"
                        </p>
                      )}
                      {ticket.resolutionNotes && (
                        <div className="mt-2 text-xs bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 p-2 rounded-lg">
                          <strong className="block text-[10px] text-emerald-400 uppercase tracking-wider">Fix Note:</strong>
                          {ticket.resolutionNotes}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {ticket.priority === 'urgent' ? (
                        <span className="bg-red-950 text-red-300 border border-red-700 text-[11px] font-bold px-2.5 py-1 rounded-lg animate-pulse">
                          Urgent
                        </span>
                      ) : ticket.priority === 'high' ? (
                        <span className="bg-amber-950 text-amber-300 border border-amber-700 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                          High
                        </span>
                      ) : (
                        <span className="bg-gray-700 text-gray-300 text-[11px] px-2.5 py-1 rounded-lg">
                          Normal
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap text-xs">
                      <div className="font-semibold text-rose-300">{ticket.reportedByName}</div>
                      <div className="text-[11px] text-gray-500">Customer Experience (CX)</div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {ticket.status === 'solved' ? (
                        <div className="flex flex-col gap-1">
                          <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Resolved & Fixed
                          </span>
                          {ticket.solvedAt && (
                            <span className="text-[10px] text-gray-500">
                              at {new Date(ticket.solvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      ) : ticket.status === 'in-progress' ? (
                        <div className="flex flex-col gap-1">
                          <span className="bg-amber-950/80 text-amber-300 border border-amber-700 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-fit animate-pulse">
                            <Wrench className="w-3.5 h-3.5 text-amber-400" />
                            In Repair
                          </span>
                          {ticket.assignedToName && (
                            <span className="text-[10px] text-amber-400/90 font-medium">
                              Assigned to: {ticket.assignedToName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="bg-red-950/80 text-red-300 border border-red-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 w-fit">
                          <Clock className="w-3.5 h-3.5 text-red-400" />
                          Awaiting Tech
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {cxTickets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-30 text-rose-400" />
                    No Customer Experience (CX) feedbacks recorded yet. Use the "Log Customer Feedback" button above to submit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- POPUP MODAL: SUBMIT CUSTOMER FEEDBACK --- */}
      {feedbackRideId !== null && (
        <ModalWrapper 
          title={`Log Customer Feedback for ${selectedRideObj?.name || 'Attraction'}`} 
          onClose={handleCloseFeedbackModal}
        >
          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            {/* Selected Ride Dropdown (Allows changing ride in modal) */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                Amusement Attraction / Ride
              </label>
              <select
                value={feedbackRideId}
                onChange={(e) => setFeedbackRideId(Number(e.target.value))}
                className="w-full bg-gray-900 text-white rounded-xl p-3 text-sm border border-gray-700 outline-none focus:border-rose-500"
              >
                {rides.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.floor})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Selector */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                Feedback Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CX_FEEDBACK_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFeedbackCategory(cat)}
                    className={`text-xs p-2 rounded-xl border text-left transition-all ${
                      feedbackCategory === cat
                        ? 'bg-rose-600 text-white border-rose-400 font-bold shadow-md shadow-rose-950/40'
                        : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-750'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority Selector */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                Urgency / Priority Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'normal', label: 'Normal', color: 'bg-gray-700 text-gray-200 border-gray-600' },
                  { id: 'high', label: 'High Priority', color: 'bg-amber-600 text-white border-amber-400' },
                  { id: 'urgent', label: 'Urgent / Immediate', color: 'bg-red-600 text-white border-red-400' },
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFeedbackPriority(p.id as any)}
                    className={`text-xs py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                      feedbackPriority === p.id 
                        ? p.color + ' shadow-md' 
                        : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-750'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feedback / Issue Description */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                Customer Feedback / Issue Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={problemDescription}
                onChange={(e) => setProblemDescription(e.target.value)}
                placeholder="Describe the issue reported by the guest or observed (e.g., Guest reported jerky deceleration on stop 2, or sound speaker crackling)..."
                className="w-full bg-gray-900 text-white rounded-xl p-3 text-sm border border-gray-700 outline-none focus:border-rose-500"
              />
            </div>

            {/* Optional Guest Notes */}
            <div>
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider block mb-1.5">
                Guest Information / Specific Location (Optional)
              </label>
              <input
                type="text"
                value={guestDetails}
                onChange={(e) => setGuestDetails(e.target.value)}
                placeholder="e.g., Seat #5, Guest family with 2 children, or Queue entrance area"
                className="w-full bg-gray-900 text-white rounded-xl p-3 text-sm border border-gray-700 outline-none focus:border-rose-500"
              />
            </div>

            {/* Submitter Info */}
            <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700 text-xs text-gray-400 flex items-center justify-between">
              <span>Dispatched By: <strong className="text-rose-300">{currentUser?.name || 'Customer Experience (CX)'}</strong></span>
              <span className="text-[11px] text-gray-500">Auto-routes to Maintenance</span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseFeedbackModal}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !problemDescription.trim()}
                className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-rose-950/40 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Sending...' : 'Dispatch to Maintenance'}</span>
              </button>
            </div>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
};

