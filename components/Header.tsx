import React from 'react';
import { Role } from '../hooks/useAuth';
import { Operator, AppConfig } from '../types';
import { Sliders, Database, LogOut, Search, Activity, User, Shield, Sparkles, Code, Radio, RefreshCw } from 'lucide-react';

interface Props {
  onSearch: (term: string) => void;
  onSelectFloor: (floor: string) => void;
  selectedFloor: string;
  role: Role;
  currentUser: Operator | null;
  onLogout: () => void;
  onNavigate: (view: any) => void;
  onShowModal: (modal: any) => void;
  currentView: string;
  connectionStatus: string;
  appLogo: string | null;
  appConfig?: AppConfig;
  appName?: string;
  floors?: string[];
  onBroadcastSync?: () => void;
  isBroadcastingSync?: boolean;
}

const Header: React.FC<Props> = ({ 
  onSearch, 
  onSelectFloor, 
  selectedFloor, 
  role, 
  currentUser, 
  onLogout, 
  onNavigate, 
  onShowModal, 
  currentView, 
  connectionStatus, 
  appLogo,
  appConfig,
  onBroadcastSync,
  isBroadcastingSync
}) => {
  const displayAppName = appConfig?.appName || 'TFW OPS Manager';
  const announcementText = appConfig?.announcementText;
  const appSubtitle = appConfig?.appSubtitle;

  return (
    <>
      {announcementText && (
        <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 shadow-md relative z-50 animate-fade-in-up">
          <Sparkles className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-200" />
          <span className="truncate">{announcementText}</span>
        </div>
      )}
      <header className="bg-gray-850 border-b border-gray-700/80 p-3 sm:p-4 sticky top-0 z-40 shadow-xl backdrop-blur-md">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
          
          {/* Brand & Connection Status */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('dashboard')}>
              {appLogo ? (
                <img src={appLogo} alt="Logo" className="h-10 w-10 object-contain rounded-xl bg-gray-900 p-1 border border-gray-700 shadow-md"/>
              ) : (
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-extrabold text-white text-sm shadow-md border border-blue-400/30">
                  TFW
                </div>
              )}
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight tracking-tight flex items-center gap-2">
                  {displayAppName}
                </h1>
                {appSubtitle && (
                  <p className="text-[11px] text-gray-400 hidden sm:block leading-none mt-0.5 font-normal">
                    {appSubtitle}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                    role === 'admin' 
                      ? 'bg-red-950 text-red-300 border-red-800' 
                      : role === 'operation-officer'
                      ? 'bg-purple-950 text-purple-300 border-purple-800'
                      : 'bg-blue-950 text-blue-300 border-blue-800'
                  }`}>
                    {role === 'operator' ? 'Games & Ride Associate' : role?.replace('-', ' ')}
                  </span>
                  <span 
                    title={connectionStatus === 'connected' ? 'Multi-device cloud synchronization active via Firebase Firestore & Live Server' : 'Offline: Changes saved locally in queue and will auto-sync when internet reconnects'}
                    className={`text-xs flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-md border ${
                      connectionStatus === 'connected' 
                        ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' 
                        : 'text-amber-300 bg-amber-950/40 border-amber-800/40'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-ping'}`}></span>
                    {connectionStatus === 'connected' ? 'Multi-Device Live Synced' : 'Offline (Auto-Sync)'}
                  </span>
                </div>
              </div>
            </div>

          {/* Quick Actions on Mobile */}
          <div className="flex md:hidden items-center gap-2">
            {role === 'admin' && (
              <button 
                onClick={() => onShowModal('admin-manager')} 
                className="bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 p-2 rounded-xl border border-purple-500/30 text-xs flex items-center gap-1"
                title="Admin Portal"
              >
                <Shield className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Center Search (Rides view) */}
        {currentView === 'counter' && (
          <div className="flex items-center gap-2 bg-gray-900/90 rounded-xl px-3 py-1.5 border border-gray-700 w-full md:w-64">
            <Search className="w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search rides by name/floor..." 
              className="bg-transparent border-none text-white text-sm focus:outline-none w-full placeholder-gray-500"
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}

        {/* Action Controls & User */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
          {/* Universal Sync View Everywhere button */}
          {onBroadcastSync && (
            <button
              onClick={onBroadcastSync}
              disabled={isBroadcastingSync}
              className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-500/30 transition-all shadow-sm cursor-pointer disabled:opacity-50 active:scale-95"
              title="Broadcast current view, counts, and active date to all connected devices"
            >
              <Radio className={`w-3.5 h-3.5 text-emerald-400 ${isBroadcastingSync ? 'animate-ping' : ''}`} />
              <span className="hidden sm:inline">{isBroadcastingSync ? 'Broadcasting...' : 'Broadcast View'}</span>
            </button>
          )}

          {/* Admin Portal (Admin Only) */}
          {role === 'admin' && (
            <button 
              onClick={() => onShowModal('admin-manager')} 
              className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 px-3.5 py-2 rounded-xl text-xs font-bold border border-purple-500/30 transition-all shadow-sm cursor-pointer"
              title="Admin Portal & Configuration"
            >
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>Admin Portal</span>
            </button>
          )}

          {/* Backup (Admin Only) */}
          {role === 'admin' && (
            <button 
              onClick={() => onShowModal('backup')} 
              className="text-gray-400 hover:text-gray-200 hover:bg-gray-800 p-2 rounded-xl text-xs transition-colors cursor-pointer border border-gray-750"
              title="Database Backup & Reset"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          {/* User & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-gray-700">
            <div className="flex items-center gap-1.5 text-gray-300 text-xs font-medium bg-gray-800/80 px-2.5 py-1.5 rounded-lg border border-gray-700">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span className="max-w-[100px] truncate">{currentUser?.name || 'Staff'}</span>
            </div>
            <button 
              onClick={onLogout} 
              className="bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-300 p-2 rounded-xl text-xs transition-colors border border-gray-700 cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs based on Role */}
      <div className="container mx-auto mt-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {role === 'admin' && (
          <>
            <NavButton label="Dashboard" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
            <NavButton label="Rides" active={currentView === 'counter'} onClick={() => onNavigate('counter')} />
            <NavButton label="Roster" active={currentView === 'roster'} onClick={() => onNavigate('roster')} />
            <NavButton label="Assignments" active={currentView === 'assignments'} onClick={() => onNavigate('assignments')} />
            <NavButton label="Reports" active={currentView === 'reports'} onClick={() => onNavigate('reports')} />
            <NavButton label="Ticket Sales" active={currentView === 'ticket-sales-dashboard'} onClick={() => onNavigate('ticket-sales-dashboard')} />
            <NavButton label="Maintenance" active={currentView === 'maintenance-dashboard'} onClick={() => onNavigate('maintenance-dashboard')} />
            <NavButton label="Customer Experience (CX)" active={currentView === 'cx-feedback'} onClick={() => onNavigate('cx-feedback')} />
            <NavButton label="History" active={currentView === 'history'} onClick={() => onNavigate('history')} />
          </>
        )}
        {role === 'operation-officer' && (
          <>
            <NavButton label="Dashboard" active={currentView === 'dashboard'} onClick={() => onNavigate('dashboard')} />
            <NavButton label="Rides" active={currentView === 'counter'} onClick={() => onNavigate('counter')} />
            <NavButton label="Roster" active={currentView === 'roster'} onClick={() => onNavigate('roster')} />
            <NavButton label="Assignments" active={currentView === 'assignments'} onClick={() => onNavigate('assignments')} />
            <NavButton label="Reports" active={currentView === 'reports'} onClick={() => onNavigate('reports')} />
            <NavButton label="History" active={currentView === 'history'} onClick={() => onNavigate('history')} />
          </>
        )}
        {role === 'operator' && (
          <>
            <NavButton label="My Roster" active={currentView === 'roster'} onClick={() => onNavigate('roster')} />
            <NavButton label="Rides" active={currentView === 'counter'} onClick={() => onNavigate('counter')} />
          </>
        )}
        {role === 'maintenance' && (
          <>
            <NavButton label="Tickets & Repairs" active={currentView === 'maintenance-dashboard'} onClick={() => onNavigate('maintenance-dashboard')} />
            <NavButton label="Customer Experience (CX)" active={currentView === 'cx-feedback'} onClick={() => onNavigate('cx-feedback')} />
          </>
        )}
        {role === 'cx' && (
          <>
            <NavButton label="Customer Experience (CX)" active={currentView === 'cx-feedback'} onClick={() => onNavigate('cx-feedback')} />
            <NavButton label="Maintenance Status" active={currentView === 'maintenance-dashboard'} onClick={() => onNavigate('maintenance-dashboard')} />
          </>
        )}
        {role === 'sales-officer' && (
          <>
            <NavButton label="Sales Dashboard" active={currentView === 'sales-officer-dashboard'} onClick={() => onNavigate('sales-officer-dashboard')} />
            <NavButton label="Counters" active={currentView === 'ticket-sales-dashboard'} onClick={() => onNavigate('ticket-sales-dashboard')} />
            <NavButton label="TS Assignments" active={currentView === 'ts-assignments'} onClick={() => onNavigate('ts-assignments')} />
            <NavButton label="TS Reports" active={currentView === 'ts-expertise'} onClick={() => onNavigate('ts-expertise')} />
            <NavButton label="History" active={currentView === 'history'} onClick={() => onNavigate('history')} />
          </>
        )}
        {role === 'ticket-sales' && (
          <>
            <NavButton label="My Roster" active={currentView === 'ts-roster'} onClick={() => onNavigate('ts-roster')} />
            <NavButton label="Daily Package Sales" active={currentView === 'my-sales'} onClick={() => onNavigate('my-sales')} />
            <NavButton label="Counter Sales" active={currentView === 'ticket-sales-dashboard'} onClick={() => onNavigate('ticket-sales-dashboard')} />
          </>
        )}
      </div>
    </header>
    </>
  );
};

const NavButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick} 
    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
      active 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' 
        : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-750 border border-gray-700/60'
    }`}
  >
    {label}
  </button>
);

export default Header;
