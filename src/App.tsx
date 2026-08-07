import React, { useState, useEffect } from "react";
import { DataService } from "./lib/dataService";
import { MatchData, Player, UserProfile, CustomTeam, UserRole } from "./types";

// Views
import AuthScreen from "./components/AuthScreen";
import TeamDashboard from "./components/TeamDashboard";
import OpponentAnalysis from "./components/OpponentAnalysis";
import PlayerStats from "./components/PlayerStats";
import AdminPanel from "./components/AdminPanel";
import MatchFixtures from "./components/MatchFixtures";
import MetricsConfig from "./components/MetricsConfig";
import ExcelTemplates from "./components/ExcelTemplates";
import LeagueStandings from "./components/LeagueStandings";
import TeamStats from "./components/TeamStats";

// Icons
import { 
  TrendingUp, ArrowRightLeft, Users, UserCheck, LogOut, Smartphone,
  Calendar, Sliders, Shield, FileSpreadsheet, Activity, LayoutDashboard,
  Menu, X, Trophy, BarChart3
} from "lucide-react";

import TeamLogo from "./components/TeamLogo";

export type ActiveViewTab = 
  | "my-performance"
  | "match-hub"
  | "team-stats"
  | "team-standings"
  | "fixtures-results"
  | "roster-players"
  | "admin-center"
  | "league-table" 
  | "team" 
  | "matches-all" 
  | "matches-league" 
  | "matches-cup" 
  | "matches-friendly" 
  | "players" 
  | "opponent" 
  | "setting-profile" 
  | "setting-management" 
  | "excel-templates";

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveViewTab>("match-hub");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<string>("league_average");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Data State
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [allUsers, setAllUsers] = useState<(UserProfile & { passwordHash?: string })[]>([]);
  const [customTeams, setCustomTeams] = useState<CustomTeam[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSelectOpponent = (opponentName: string) => {
    setSelectedOpponent(opponentName);
    setActiveTab("opponent");
  };

  // Load active user, match counts, players list
  const loadStatsData = async (forceRefresh = false) => {
    setIsDataLoading(true);
    try {
      // Fetch dataset from Supabase or Cache
      const [matchEntries, playerEntries, teamEntries, userList] = await Promise.all([
        DataService.getMatches(forceRefresh),
        DataService.getPlayers(forceRefresh),
        DataService.getCustomTeams(forceRefresh),
        DataService.getUsers(forceRefresh)
      ]);
      setMatches(matchEntries);
      setPlayers(playerEntries);
      setCustomTeams(teamEntries);
      setAllUsers(userList);
    } catch (e) {
      console.error("Error loading app data:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check current logged user
    const user = DataService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === UserRole.Player) {
        setActiveTab("my-performance");
      } else {
        setActiveTab("match-hub");
      }
    }

    // 2. Load dataset directly from Supabase cloud database
    DataService.syncAllLocalToSupabase()
      .catch((e) => console.warn("Startup auto-sync warning:", e))
      .finally(() => {
        loadStatsData(true);
        DataService.syncWebsiteTeamsAndProfiles().catch(() => {});
      });
  }, []);

  // Synchronize routing with browser URL Hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (!hash) return;

      const [tab, query] = hash.split("?");
      if (tab) {
        setActiveTab(tab as ActiveViewTab);
      }

      if (query) {
        const params = new URLSearchParams(query);
        const opp = params.get("opponent");
        if (opp) setSelectedOpponent(opp);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    if (currentUser) {
      handleHashChange();
    }
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [currentUser]);

  const isStaffUser = currentUser?.role !== UserRole.Player || !!currentUser?.isAdmin;

  // Route Guard: Redirect Staff users away from 'my-performance' tab to 'roster-players'
  useEffect(() => {
    if (!currentUser) return;
    if (isStaffUser && activeTab === "my-performance") {
      setActiveTab("roster-players");
    }
  }, [activeTab, currentUser, isStaffUser]);

  useEffect(() => {
    if (!currentUser) return;
    let targetHash = activeTab as string;
    if (targetHash === "opponent" && selectedOpponent && selectedOpponent !== "league_average") {
      targetHash += `?opponent=${encodeURIComponent(selectedOpponent)}`;
    }
    if (window.location.hash.replace("#", "") !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [activeTab, selectedOpponent, currentUser]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === UserRole.Player) {
      setActiveTab("my-performance");
    } else {
      setActiveTab("match-hub");
    }
    loadStatsData();
  };

  const handleLogout = () => {
    DataService.logout();
    setCurrentUser(null);
    setActiveTab("match-hub");
    if (window.location.hash) {
      window.location.hash = "";
    }
  };

  // If user is not authenticated, show AuthScreen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isPlayerRole = currentUser.role === UserRole.Player && !currentUser.isAdmin;

  const getUserInitials = (user: UserProfile) => {
    if (user.firstName && user.lastName) return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    if (user.firstName) return user.firstName[0].toUpperCase();
    if (user.username) return user.username[0].toUpperCase();
    return "C";
  };

  const getRoleDisplayName = (user: UserProfile) => {
    if (user.isAdmin) return "Admin";
    if (user.role === UserRole.Analyst) return "Analyst";
    if (user.role === UserRole.HeadCoach || user.role === UserRole.Manager) return "Coach";
    return "Player";
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f8fafc] flex flex-col font-sans relative overflow-x-hidden" id="applet-viewport-root">
      
      {/* Header with Hamburger Menu Button */}
      <header className="fixed top-0 left-0 right-0 w-full z-30 bg-[#0f172a] text-white shadow-xl border-b border-[#334155]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            
            {/* Top Left: Hamburger Button (☰) & Brand */}
            <div className="flex items-center gap-3">
              {/* Prominent Hamburger Icon Button (☰) */}
              <button 
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="flex items-center gap-2 text-white hover:text-[#eab308] px-3 py-2 focus:outline-none transition-all cursor-pointer rounded-xl bg-[#1e293b] hover:bg-[#334155] border border-[#334155] shadow-sm group"
                title="Toggle Navigation Menu (☰)"
                id="hamburger-menu-toggle"
              >
                <Menu className="h-5 w-5 text-[#eab308] group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs tracking-wider uppercase hidden sm:inline text-white font-sans">Menu</span>
              </button>

              {/* Brand Logo & Title */}
              <div 
                onClick={() => setActiveTab(isPlayerRole ? "my-performance" : "match-hub")}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 select-none transition-all"
                title="Cardiff Town FC Performance Hub"
              >
                <TeamLogo teamName="Cardiff Town FC" size={34} className="border border-[#eab308]/50 rounded-xl bg-[#0b0f19] p-0.5 shadow-md shrink-0" />
                <div>
                  <h1 className="font-display font-black text-sm sm:text-base tracking-wider leading-none text-white flex items-center gap-2">
                    CARDIFF TOWN FC
                    <span className="text-[9px] bg-[#eab308] text-[#0b0f19] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                      CCFL
                    </span>
                  </h1>
                  <p className="text-[9.5px] text-[#94a3b8] font-mono tracking-widest uppercase mt-0.5 hidden xs:block">
                    Tactical Performance Hub
                  </p>
                </div>
              </div>
            </div>

            {/* Top Right: User Avatar, Role Badge & Logout */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-[#1e293b] border border-[#334155] rounded-xl px-3 py-1.5">
                <div className="h-7 w-7 rounded-full bg-[#eab308] text-[#0b0f19] font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {getUserInitials(currentUser)}
                </div>

                <div className="hidden sm:flex flex-col text-right text-xs leading-none">
                  <span className="font-bold text-white block truncate max-w-[120px]">
                    {currentUser.firstName && currentUser.lastName 
                      ? `${currentUser.firstName} ${currentUser.lastName}` 
                      : currentUser.username}
                  </span>
                  <span className="text-[10px] text-[#eab308] font-mono font-bold uppercase mt-0.5">
                    {getRoleDisplayName(currentUser)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="rounded-xl p-2 text-[#94a3b8] hover:text-white hover:bg-[#1e293b] border border-transparent hover:border-[#334155] transition-all cursor-pointer"
                title="Log Out"
              >
                <LogOut className="h-4 w-4 shrink-0" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Slide-out Overlay Navigation Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f172a] border-r border-[#334155] text-white p-6 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between overflow-y-auto ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="navigation-drawer-viewport"
      >
        <div className="space-y-6">
          
          {/* Drawer Top Header with Logo and Clear Close Button (✕) */}
          <div className="flex items-center justify-between border-b border-[#334155] pb-4">
            <div className="flex items-center gap-3">
              <TeamLogo teamName="Cardiff Town FC" size={32} className="border border-[#eab308]/40 rounded-lg p-0.5 bg-[#0b0f19]" />
              <div>
                <span className="font-display font-black text-sm tracking-wider text-[#eab308] uppercase block">
                  CARDIFF TOWN FC
                </span>
                <span className="text-[10px] text-[#94a3b8] font-mono">Tactical Performance Portal</span>
              </div>
            </div>

            {/* Clear Close Button (✕) */}
            <button 
              onClick={() => setDrawerOpen(false)}
              className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white transition-all cursor-pointer border border-[#334155]"
              title="Close Navigation Drawer (✕)"
              id="close-drawer-button"
            >
              <X className="h-5 w-5 shrink-0" />
            </button>
          </div>

          {/* User Profile Info in Drawer */}
          <div className="bg-[#1e293b] border border-[#334155] p-3.5 rounded-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#eab308] text-[#0b0f19] font-black text-sm flex items-center justify-center shrink-0 shadow-md">
              {getUserInitials(currentUser)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm text-white block truncate">
                {currentUser.firstName && currentUser.lastName 
                  ? `${currentUser.firstName} ${currentUser.lastName}` 
                  : currentUser.username}
              </span>
              <span className="text-[10px] bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/30 px-2 py-0.5 rounded-md font-bold uppercase font-mono tracking-wider inline-block mt-1">
                {getRoleDisplayName(currentUser)}
              </span>
            </div>
          </div>

          {/* Drawer Navigation Menu Links */}
          <nav className="space-y-2">
            <span className="text-[10px] text-[#94a3b8] font-mono font-bold uppercase tracking-wider block px-1">
              Main Navigation
            </span>
            
            {isPlayerRole ? (
              <>
                <DrawerButton 
                  active={activeTab === "my-performance"}
                  onClick={() => { setActiveTab("my-performance"); setDrawerOpen(false); }}
                  icon={UserCheck}
                  label="My Performance"
                />
                <DrawerButton 
                  active={activeTab === "match-hub"}
                  onClick={() => { setActiveTab("match-hub"); setDrawerOpen(false); }}
                  icon={TrendingUp}
                  label="Match Hub"
                />
                <DrawerButton 
                  active={activeTab === "team-stats"}
                  onClick={() => { setActiveTab("team-stats"); setDrawerOpen(false); }}
                  icon={BarChart3}
                  label="Team Stats"
                />
                <DrawerButton 
                  active={activeTab === "team-standings" || activeTab === "league-table"}
                  onClick={() => { setActiveTab("team-standings"); setDrawerOpen(false); }}
                  icon={Trophy}
                  label="League Standings"
                />
                <DrawerButton 
                  active={activeTab === "fixtures-results" || activeTab.startsWith("matches-")}
                  onClick={() => { setActiveTab("fixtures-results"); setDrawerOpen(false); }}
                  icon={Calendar}
                  label="Fixtures & Results"
                />
                <DrawerButton 
                  active={activeTab === "roster-players" || activeTab === "players"}
                  onClick={() => { setActiveTab("roster-players"); setDrawerOpen(false); }}
                  icon={Users}
                  label="Roster / Players"
                />
                <DrawerButton 
                  active={activeTab === "opponent"}
                  onClick={() => { setSelectedOpponent("league_average"); setActiveTab("opponent"); setDrawerOpen(false); }}
                  icon={ArrowRightLeft}
                  label="Opponent Analysis"
                />
              </>
            ) : (
              <>
                <DrawerButton 
                  active={activeTab === "match-hub" || activeTab === "team"}
                  onClick={() => { setActiveTab("match-hub"); setDrawerOpen(false); }}
                  icon={TrendingUp}
                  label="Match Hub"
                />
                <DrawerButton 
                  active={activeTab === "team-stats"}
                  onClick={() => { setActiveTab("team-stats"); setDrawerOpen(false); }}
                  icon={BarChart3}
                  label="Team Stats"
                />
                <DrawerButton 
                  active={activeTab === "team-standings" || activeTab === "league-table"}
                  onClick={() => { setActiveTab("team-standings"); setDrawerOpen(false); }}
                  icon={Trophy}
                  label="League Standings"
                />
                <DrawerButton 
                  active={activeTab === "fixtures-results" || activeTab.startsWith("matches-")}
                  onClick={() => { setActiveTab("fixtures-results"); setDrawerOpen(false); }}
                  icon={Calendar}
                  label="Fixtures & Results"
                />
                <DrawerButton 
                  active={activeTab === "roster-players" || activeTab === "players"}
                  onClick={() => { setActiveTab("roster-players"); setDrawerOpen(false); }}
                  icon={Users}
                  label="Roster / Players"
                />
                <DrawerButton 
                  active={activeTab === "admin-center" || activeTab.startsWith("setting-")}
                  onClick={() => { setActiveTab("admin-center"); setDrawerOpen(false); }}
                  icon={Sliders}
                  label="Admin Center"
                />
                <DrawerButton 
                  active={activeTab === "opponent"}
                  onClick={() => { setSelectedOpponent("league_average"); setActiveTab("opponent"); setDrawerOpen(false); }}
                  icon={ArrowRightLeft}
                  label="Opponent Analysis"
                />
                <DrawerButton 
                  active={activeTab === "excel-templates"}
                  onClick={() => { setActiveTab("excel-templates"); setDrawerOpen(false); }}
                  icon={FileSpreadsheet}
                  label="Excel Templates"
                />
              </>
            )}
          </nav>
        </div>

        {/* Bottom Drawer Action */}
        <div className="border-t border-[#334155] pt-4 mt-6">
          <button
            onClick={() => {
              setDrawerOpen(false);
              handleLogout();
            }}
            className="w-full rounded-xl bg-rose-500/15 border border-rose-500/30 hover:bg-rose-500/25 text-rose-300 font-bold text-xs py-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out Account</span>
          </button>
        </div>
      </div>

      {/* Backdrop for Navigation Drawer */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 mt-16" id="primary-viewport-pane">
        
        {/* Mobile View Maintenance Screen Notice */}
        {isMobile && (
          <div className="md:hidden mb-5 p-4 rounded-xl bg-[#1e293b] border border-[#eab308]/60 text-white shadow-lg flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30 shrink-0 mt-0.5">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs uppercase text-[#eab308] tracking-wider mb-1 flex items-center gap-1.5">
                <span>Mobile View under Maintenance</span>
              </h4>
              <p className="text-xs text-[#94a3b8] leading-relaxed font-sans">
                Please switch to Desktop/Laptop or turn your tablet horizontally for optimal analysis experience.
              </p>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isDataLoading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#eab308] border-t-transparent" />
              <p className="text-xs text-[#94a3b8] font-mono tracking-wider">Loading Cardiff Town FC analytics...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* View routing */}
            {activeTab === "my-performance" && !isStaffUser && (
              <PlayerStats players={players} matches={matches} onPlayersUpdated={() => loadStatsData(true)} currentUser={currentUser} isMyPerformanceView={true} />
            )}

            {(activeTab === "match-hub" || activeTab === "team") && (
              <TeamDashboard matches={matches} customTeams={customTeams} currentUser={currentUser} onSelectOpponent={handleSelectOpponent} onTeamsUpdated={() => loadStatsData(true)} />
            )}

            {activeTab === "team-stats" && (
              <TeamStats matches={matches} currentUser={currentUser} />
            )}

            {(activeTab === "team-standings" || activeTab === "league-table") && (
              <LeagueStandings customTeams={customTeams} currentUser={currentUser} onSelectOpponent={handleSelectOpponent} onTeamsUpdated={() => loadStatsData(true)} />
            )}

            {(activeTab === "fixtures-results" || activeTab.startsWith("matches-")) && (
              <MatchFixtures currentUser={currentUser} onSelectOpponent={handleSelectOpponent} defaultFilter="All" onFixturesUpdated={() => loadStatsData(true)} />
            )}

            {(activeTab === "roster-players" || activeTab === "players") && (
              <PlayerStats players={players} matches={matches} onPlayersUpdated={() => loadStatsData(true)} currentUser={currentUser} />
            )}

            {(activeTab === "admin-center" || activeTab.startsWith("setting-")) && (
              <div className="space-y-6">
                <AdminPanel 
                  currentUser={currentUser} 
                  users={allUsers} 
                  onRefreshUsers={() => loadStatsData(true)} 
                  onLogout={handleLogout}
                />
                <MetricsConfig currentUser={currentUser} customTeams={customTeams} onTeamsUpdated={() => loadStatsData(true)} defaultSubTab="teams" />
              </div>
            )}

            {activeTab === "opponent" && (
              <OpponentAnalysis matches={matches} defaultOpponent={selectedOpponent} customTeams={customTeams} currentUser={currentUser} />
            )}

            {activeTab === "excel-templates" && (
              <ExcelTemplates currentUser={currentUser} />
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#334155] bg-[#0f172a] py-5 text-center text-xs text-[#94a3b8] font-sans mt-auto">
        <p className="font-medium text-[#94a3b8]">
          Cardiff Town FC Team Performance Analytics System © 2026. Powered by CCFL Data Architecture.
        </p>
      </footer>

    </div>
  );
}

// Subcomponents
interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function NavButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
        active 
          ? "bg-[#eab308] text-[#0b0f19] shadow-md font-extrabold" 
          : "text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function DrawerButton({ active, onClick, icon: Icon, label }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all text-left ${
        active 
          ? "bg-[#eab308] text-[#0b0f19] shadow-md font-extrabold" 
          : "text-slate-300 hover:text-white hover:bg-[#1e293b]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

