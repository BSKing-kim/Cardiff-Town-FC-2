import React, { useState, useEffect } from "react";
import { MatchFixture, UserProfile, UserRole, CustomTeam, MatchData } from "../types";
import { DataService } from "../lib/dataService";
import { ExcelUtils } from "../lib/excelUtils";
import { MatchHeatmap } from "./MatchHeatmap";
import { 
  Calendar, MapPin, Trophy, ShieldAlert, Plus, Trash2, Clock, CheckCircle, ExternalLink, Filter, Upload, Printer, X, TrendingUp, Download, Minus, Table, LayoutGrid, Edit3
} from "lucide-react";
import TeamLogo from "./TeamLogo";
import { LEAGUES } from "./TeamDashboard";
import MatchFixturesBulkImport from "./MatchFixturesBulkImport";

interface MatchFixturesProps {
  currentUser: UserProfile;
  onSelectOpponent?: (opponent: string) => void;
  defaultFilter?: "All" | "League" | "Cup" | "Friendly";
  onFixturesUpdated?: () => void;
}

export default function MatchFixtures({ currentUser, onSelectOpponent, defaultFilter, onFixturesUpdated }: MatchFixturesProps) {
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [displayMode, setDisplayMode] = useState<"table" | "grid">("table");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Match-by-match excel upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFixtureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fixtureId: string) => {
    if (!isAuthorized) {
      alert("Uploading match statistics is reserved for Coaching Staff and Admins.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(fixtureId);
    setUploadStatus("Reading spreadsheet file...");

    try {
      // 1. Parse Excel file
      const result = await ExcelUtils.parsePlayerMatchExcel(file);
      if (result.errorRows > 0 && result.validRecords.length === 0) {
        throw new Error(`Failed to parse file: ${result.errorDetails.join("; ")}`);
      }

      setUploadStatus("Processing match statistics & updating roster...");

      // 2. Call DataService to process the match upload
      const response = await DataService.processFixtureMatchUpload(fixtureId, result.validRecords);

      setUploadStatus(`Success! Result: ${response.ourScore}:${response.oppScore}. ${response.playersUpdated} roster players updated${response.deleted ? `, ${response.deleted} stale records purged` : ""}.`);
      
      // Reload fixtures
      await loadFixtures();

      if (onFixturesUpdated) {
        onFixturesUpdated();
      }

      // Clear after 4 seconds
      setTimeout(() => {
        setUploadingId(null);
        setUploadStatus("");
      }, 4000);

    } catch (err: any) {
      console.error(err);
      setUploadStatus(`Error: ${err.message || "Failed to process excel upload"}`);
      setTimeout(() => {
        setUploadingId(null);
        setUploadStatus("");
      }, 6000);
    } finally {
      // Reset input element value
      e.target.value = "";
    }
  };
  
  // Form State for Adding Fixture
  const [showAddForm, setShowAddForm] = useState(false);
  const [formDivision, setFormDivision] = useState("");
  const [formHomeTeam, setFormHomeTeam] = useState("");
  const [formAwayTeam, setFormAwayTeam] = useState("");
  const [formComp, setFormComp] = useState<"League" | "Cup" | "Friendly">("League");
  const [formDate, setFormDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedAnalysisFixture, setSelectedAnalysisFixture] = useState<MatchFixture | null>(null);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<"stats" | "heatmap">("stats");
  const [allMatchData, setAllMatchData] = useState<MatchData[]>([]);

  const loadAllMatchData = async () => {
    try {
      const data = await DataService.getMatches();
      setAllMatchData(data);
    } catch (e) {
      console.error("Error loading match data:", e);
    }
  };

  const [activeFilter, setActiveFilter] = useState<"All" | "League" | "Cup" | "Friendly">("All");
  const [activeDivisionFilter, setActiveDivisionFilter] = useState<string>("All");

  useEffect(() => {
    if (defaultFilter) {
      setActiveFilter(defaultFilter);
    }
  }, [defaultFilter]);

  const [customTeams, setCustomTeams] = useState<CustomTeam[]>([]);

  const loadCustomTeams = async () => {
    try {
      const list = await DataService.getCustomTeams();
      setCustomTeams(list);
    } catch (e) {
      console.error("Error loading custom teams:", e);
    }
  };

  // Compute available divisions dynamically from LEAGUES, customTeams, and fixtures
  const availableDivisions = React.useMemo(() => {
    const set = new Set<string>();
    LEAGUES.forEach(l => set.add(l));
    customTeams.forEach(t => {
      if (t.league) set.add(t.league);
    });
    fixtures.forEach(f => {
      if (f.division) set.add(f.division);
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [customTeams, fixtures]);

  // Compute filtered teams belonging to the currently selected formDivision (for League matches)
  const filteredTeamsForDivision = React.useMemo(() => {
    if (!formDivision) return [];
    const selectedNorm = formDivision.toLowerCase().trim();
    const matching = customTeams.filter(t => {
      if (!t.league) return false;
      return t.league.toLowerCase().trim() === selectedNorm;
    });

    const teamNamesSet = new Set<string>();
    teamNamesSet.add("Cardiff Town FC");
    matching.forEach(t => {
      if (t.name) teamNamesSet.add(t.name);
    });

    return Array.from(teamNamesSet).sort((a, b) => a.localeCompare(b));
  }, [formDivision, customTeams]);

  // Compute all available teams across all divisions for Cup/Friendly matches
  const allTeamsList = React.useMemo(() => {
    const teamNamesSet = new Set<string>();
    teamNamesSet.add("Cardiff Town FC");
    customTeams.forEach(t => {
      if (t.name) teamNamesSet.add(t.name);
    });
    return Array.from(teamNamesSet).sort((a, b) => a.localeCompare(b));
  }, [customTeams]);

  const loadFixtures = async () => {
    setIsLoading(true);
    try {
      const list = await DataService.getFixtures();
      setFixtures(list);
    } catch (e) {
      console.error("Error loading fixtures:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllInitialData = async () => {
    setIsLoading(true);
    try {
      const [fixturesList, teamsList, matchDataList] = await Promise.all([
        DataService.getFixtures(),
        DataService.getCustomTeams(),
        DataService.getMatches()
      ]);
      setFixtures(fixturesList);
      setCustomTeams(teamsList);
      setAllMatchData(matchDataList);
    } catch (e) {
      console.error("Error loading match fixtures data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllInitialData();
  }, []);

  const handleAddFixture = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isAuthorized) {
      setErrorMsg("Fixture creation is reserved for Coaching Staff and Admins.");
      alert("Fixture creation is reserved for Coaching Staff and Admins.");
      setShowAddForm(false);
      return;
    }

    if (formComp === "League" && !formDivision) {
      setErrorMsg("Please select a Division first for League matches.");
      return;
    }

    if (!formHomeTeam || !formAwayTeam) {
      setErrorMsg("Please select both Home Team and Away Team.");
      return;
    }

    if (formHomeTeam === formAwayTeam) {
      setErrorMsg("Home Team and Away Team cannot be the same.");
      return;
    }

    if (!formDate) {
      setErrorMsg("Please specify a Match Date.");
      return;
    }

    let opponent = formAwayTeam;
    let venue: "Home" | "Away" = "Home";
    if (formHomeTeam === "Cardiff Town FC") {
      opponent = formAwayTeam;
      venue = "Home";
    } else if (formAwayTeam === "Cardiff Town FC") {
      opponent = formHomeTeam;
      venue = "Away";
    } else {
      opponent = formAwayTeam;
      venue = "Away";
    }

    const newFixture: MatchFixture = {
      // Do NOT include 'id' here; let Supabase generate it!
      date: formDate,
      opponent: opponent,
      competition: formComp,
      division: formComp === "League" ? formDivision : (formDivision || formComp),
      venue: venue,
      status: "Upcoming",
      homeTeam: formHomeTeam,
      awayTeam: formAwayTeam,
    };

    try {
      await DataService.addFixture(newFixture);
      await loadFixtures();
      setShowAddForm(false);
      setFormDivision("");
      setFormHomeTeam("");
      setFormAwayTeam("");
      setFormDate("");
      if (onFixturesUpdated) {
        onFixturesUpdated();
      }
    } catch (err: any) {
      console.error("Error creating fixture in database:", err);
      const msg = err.message || "Failed to save match fixture to database.";
      setErrorMsg(msg);
      alert(`Fixture Registration Error: ${msg}`);
    }
  };

  const handleDeleteFixture = async (fixtureId: string) => {
    if (!isAuthorized) {
      alert("Fixture deletion is reserved for Coaching Staff and Admins.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this scheduled match fixture?")) return;
    try {
      await DataService.deleteFixture(fixtureId);
      await loadFixtures();
      if (onFixturesUpdated) {
        onFixturesUpdated();
      }
    } catch (err: any) {
      console.error("Error deleting fixture from database:", err);
      alert(`Fixture Deletion Error: ${err.message || "Failed to delete fixture."}`);
    }
  };

  const handleRevertMatchStats = async (fixtureId: string, opponent: string) => {
    if (!isAuthorized) {
      alert("Reverting match statistics is reserved for Coaching Staff and Admins.");
      return;
    }
    if (!window.confirm(`Are you sure you want to clear the uploaded match stats for match vs "${opponent}"? This will revert the fixture status to 'Upcoming' and clear all uploaded data for this match.`)) {
      return;
    }
    try {
      await DataService.revertFixtureUpload(fixtureId);
      await loadFixtures();
      if (onFixturesUpdated) {
        onFixturesUpdated();
      }
    } catch (err: any) {
      alert("Failed to clear match stats: " + (err.message || "Unknown error"));
    }
  };

  // Filter fixtures by Competition & Division
  const filteredFixtures = fixtures.filter(f => {
    // Competition check
    if (activeFilter !== "All" && f.competition !== activeFilter) {
      return false;
    }

    // Division check
    if (activeDivisionFilter !== "All") {
      const targetDiv = activeDivisionFilter.toLowerCase().trim();
      if (f.division) {
        if (f.division.toLowerCase().trim() !== targetDiv) {
          return false;
        }
      } else {
        const homeCustom = customTeams.find(t => t.name.toLowerCase().trim() === (f.homeTeam || "").toLowerCase().trim());
        const awayCustom = customTeams.find(t => t.name.toLowerCase().trim() === (f.awayTeam || f.opponent || "").toLowerCase().trim());

        const homeLeague = homeCustom?.league?.toLowerCase().trim();
        const awayLeague = awayCustom?.league?.toLowerCase().trim();

        if (homeLeague !== targetDiv && awayLeague !== targetDiv) {
          return false;
        }
      }
    }

    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  // Determine if user can edit (Admins, Coaches, Managers, Analysts)
  const isAuthorized = currentUser.isAdmin || 
    currentUser.role === UserRole.HeadCoach || 
    currentUser.role === UserRole.Manager || 
    currentUser.role === UserRole.Analyst ||
    (currentUser.role as string) === "Head Coach" ||
    (currentUser.role as string) === "Manager" ||
    (currentUser.role as string) === "Analysts" ||
    (currentUser.role as string) === "Coach" ||
    (currentUser.role as string) === "Analyst" ||
    (currentUser.role as string) === "Admin";

  const getMatchAnalysisData = () => {
    if (!selectedAnalysisFixture) return null;
    
    const hTeam = selectedAnalysisFixture.homeTeam || "Cardiff Town FC";
    const aTeam = selectedAnalysisFixture.awayTeam || selectedAnalysisFixture.opponent;

    // Filter match data of this date
    const dateMatches = allMatchData.filter(m => m.date === selectedAnalysisFixture.date);

    let homeData = dateMatches.find(m => m.teamName?.toLowerCase() === hTeam.toLowerCase());
    let awayData = dateMatches.find(m => m.teamName?.toLowerCase() === aTeam.toLowerCase());

    if (!homeData || !awayData) {
      // Fallback to legacy structure
      if (hTeam === "Cardiff Town FC") {
        homeData = dateMatches.find(m => !m.isOpponentTeam);
        awayData = dateMatches.find(m => m.isOpponentTeam);
      } else if (aTeam === "Cardiff Town FC") {
        homeData = dateMatches.find(m => m.isOpponentTeam);
        awayData = dateMatches.find(m => !m.isOpponentTeam);
      } else {
        // Just take the first two matches on that date
        homeData = dateMatches[0];
        awayData = dateMatches[1];
      }
    }

    return { homeData, awayData, hTeam, aTeam };
  };

  const getFouls = (m?: MatchData) => m?.fouls ?? m?.foul ?? 0;
  const getYellowCards = (m?: MatchData) => m?.yellowCards ?? 0;

  const analysisData = getMatchAnalysisData();
  const homeName = analysisData?.hTeam || "Home Team";
  const awayName = analysisData?.aTeam || "Away Team";

  const categories = [
    {
      title: "General",
      metrics: [
        { label: "Goals", homeVal: analysisData?.homeData?.goals ?? 0, awayVal: analysisData?.awayData?.goals ?? 0 },
        { label: "Possession %", homeVal: analysisData?.homeData?.possessionRate ?? 50, awayVal: analysisData?.awayData?.possessionRate ?? 50 },
        { label: "Corners", homeVal: analysisData?.homeData?.corners ?? 0, awayVal: analysisData?.awayData?.corners ?? 0 },
      ]
    },
    {
      title: "Attack",
      metrics: [
        { label: "Shots", homeVal: analysisData?.homeData?.shots ?? 0, awayVal: analysisData?.awayData?.shots ?? 0 },
        { label: "Shots on Target", homeVal: analysisData?.homeData?.shotsOnTarget ?? 0, awayVal: analysisData?.awayData?.shotsOnTarget ?? 0 },
        { label: "Inside Box Shots", homeVal: analysisData?.homeData?.insideBoxShots ?? 0, awayVal: analysisData?.awayData?.insideBoxShots ?? 0 },
        { label: "Box Entries", homeVal: analysisData?.homeData?.boxEntries ?? 0, awayVal: analysisData?.awayData?.boxEntries ?? 0 },
      ]
    },
    {
      title: "Distribution",
      metrics: [
        { label: "Total Passes", homeVal: analysisData?.homeData?.totalPasses ?? 0, awayVal: analysisData?.awayData?.totalPasses ?? 0 },
        { label: "Successful Passes", homeVal: analysisData?.homeData?.successfulPasses ?? 0, awayVal: analysisData?.awayData?.successfulPasses ?? 0 },
        { label: "Progressive Passes", homeVal: analysisData?.homeData?.progressivePasses ?? 0, awayVal: analysisData?.awayData?.progressivePasses ?? 0 },
        { label: "Final Third Passes", homeVal: analysisData?.homeData?.finalThirdPasses ?? 0, awayVal: analysisData?.awayData?.finalThirdPasses ?? 0 },
      ]
    },
    {
      title: "Defence",
      metrics: [
        { label: "Tackles Attempted", homeVal: analysisData?.homeData?.tacklesAttempted ?? 0, awayVal: analysisData?.awayData?.tacklesAttempted ?? 0 },
        { label: "Tackles Won", homeVal: analysisData?.homeData?.tacklesWon ?? 0, awayVal: analysisData?.awayData?.tacklesWon ?? 0 },
        { label: "Interceptions", homeVal: analysisData?.homeData?.interceptions ?? 0, awayVal: analysisData?.awayData?.interceptions ?? 0 },
        { label: "Clearances", homeVal: analysisData?.homeData?.clearances ?? 0, awayVal: analysisData?.awayData?.clearances ?? 0 },
      ]
    },
    {
      title: "Discipline",
      metrics: [
        { label: "Fouls Committed", homeVal: getFouls(analysisData?.homeData), awayVal: getFouls(analysisData?.awayData) },
        { label: "Yellow Cards", homeVal: getYellowCards(analysisData?.homeData), awayVal: getYellowCards(analysisData?.awayData) },
      ]
    }
  ];

  return (
    <div className="space-y-6" id="match-fixtures-viewport">
      
      {/* Header and Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#334155] pb-4 bg-[#1e293b] p-5 rounded-2xl border">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-black tracking-wider text-white flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#eab308]" />
            Match Performance Log Directory & Fixtures
          </h2>
          <p className="text-xs text-[#94a3b8] font-sans mt-1">
            Schedule upcoming matches, upload Excel statistics, and maintain official Cardiff Town FC fixture logs.
          </p>
          {currentUser.role === UserRole.Player && (
            <p className="text-xs text-[#eab308] font-bold mt-1.5 font-sans">
              * Player View Mode: Read-only access to fixtures and match reports.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0" id="fixture-action-row-buttons">
          {/* View Toggle */}
          <div className="flex items-center bg-[#0b0f19] border border-[#334155] rounded-xl p-1">
            <button
              onClick={() => setDisplayMode("table")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                displayMode === "table" ? "bg-[#eab308] text-[#0b0f19]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Table Directory View"
            >
              <Table className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisplayMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                displayMode === "grid" ? "bg-[#eab308] text-[#0b0f19]" : "text-[#94a3b8] hover:text-white"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {isAuthorized && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 rounded-xl bg-[#eab308] hover:bg-[#f59e0b] px-3.5 py-2 text-xs font-black text-[#0b0f19] shadow-md transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isMobile ? "New" : (showAddForm ? "Close Form" : "Schedule New Match")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Import Section: Match Fixture Bulk Import (uses Match_Fixtures_Template.xlsx) */}
      <MatchFixturesBulkImport currentUser={currentUser} />

      {/* Admin Panel to Add Fixture */}
      {showAddForm && isAuthorized && (
        <form 
          onSubmit={handleAddFixture}
          className="rounded-2xl border border-[#334155] bg-[#1e293b] p-5 space-y-4 shadow-xl animate-slideDown"
          id="add-fixture-form"
        >
          <h3 className="font-display font-extrabold text-sm text-[#eab308] flex items-center gap-2 uppercase tracking-wider">
            <Calendar className="h-4 w-4 text-[#eab308]" />
            Register Match Fixture
          </h3>

          <div className="space-y-4">
            {/* Step 1: Match Type Selection (Required) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#94a3b8] block">
                Match Type <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                {(["League", "Cup", "Friendly"] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setFormComp(type);
                      if (type !== "League") {
                        setFormDivision("");
                      }
                      setFormHomeTeam("");
                      setFormAwayTeam("");
                      setErrorMsg("");
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      formComp === type
                        ? "bg-[#eab308] text-[#0b0f19] border-[#eab308] shadow-md font-extrabold"
                        : "bg-[#0b0f19] text-[#94a3b8] border-[#334155] hover:text-white hover:border-[#475569]"
                    }`}
                  >
                    {type === "League" ? "League Match" : type === "Cup" ? "Cup Tie" : "Friendly Tie"}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Division Selection & Team/Date Fields */}
            {/* Division Dropdown */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#94a3b8] block">
                {formComp === "League" ? (
                  <>Division (Required) <span className="text-rose-400">*</span></>
                ) : (
                  <>Division (Optional for {formComp})</>
                )}
              </label>
              <select
                required={formComp === "League"}
                value={formDivision}
                onChange={(e) => {
                  setFormDivision(e.target.value);
                  if (formComp === "League") {
                    setFormHomeTeam("");
                    setFormAwayTeam("");
                  }
                  setErrorMsg("");
                }}
                className="w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#eab308]"
              >
                <option value="">
                  {formComp === "League" ? "Select a Division first" : "Optional / No Division"}
                </option>
                {availableDivisions.map(divName => (
                  <option key={divName} value={divName}>{divName}</option>
                ))}
              </select>
            </div>

            {/* Home, Away, and Date */}
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Home Team */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#94a3b8] block">Home Team <span className="text-rose-400">*</span></label>
                <select
                  required
                  disabled={formComp === "League" && !formDivision}
                  value={formHomeTeam}
                  onChange={(e) => setFormHomeTeam(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formComp === "League" && !formDivision ? (
                    <option value="">Select a Division first</option>
                  ) : formComp === "League" && filteredTeamsForDivision.length === 0 ? (
                    <option value="" disabled>No teams found in this division</option>
                  ) : (
                    <>
                      <option value="">-- Choose Home Team --</option>
                      {(formComp === "League" ? filteredTeamsForDivision : allTeamsList)
                        .filter(tName => tName !== formAwayTeam)
                        .map(tName => (
                          <option key={tName} value={tName}>{tName}</option>
                        ))}
                    </>
                  )}
                </select>
              </div>

              {/* Away Team */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#94a3b8] block">Away Team <span className="text-rose-400">*</span></label>
                <select
                  required
                  disabled={formComp === "League" && !formDivision}
                  value={formAwayTeam}
                  onChange={(e) => setFormAwayTeam(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {formComp === "League" && !formDivision ? (
                    <option value="">Select a Division first</option>
                  ) : formComp === "League" && filteredTeamsForDivision.length === 0 ? (
                    <option value="" disabled>No teams found in this division</option>
                  ) : (
                    <>
                      <option value="">-- Choose Away Team --</option>
                      {(formComp === "League" ? filteredTeamsForDivision : allTeamsList)
                        .filter(tName => tName !== formHomeTeam)
                        .map(tName => (
                          <option key={tName} value={tName}>{tName}</option>
                        ))}
                    </>
                  )}
                </select>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#94a3b8] block">Match Date <span className="text-rose-400">*</span></label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-[#334155] bg-[#0b0f19] px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#eab308]"
                />
              </div>
            </div>

            {formComp === "League" && formDivision && filteredTeamsForDivision.length === 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
                ⚠️ No teams found in this division. Please register custom teams under this division in the Team Dashboard first.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={formComp === "League" ? (!formDivision || filteredTeamsForDivision.length === 0 || !formHomeTeam || !formAwayTeam) : (!formHomeTeam || !formAwayTeam)}
              className="rounded-xl bg-[#eab308] hover:bg-[#f59e0b] px-5 py-2.5 text-xs font-black text-[#0b0f19] shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add to Calendar
            </button>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-semibold">{errorMsg}</p>
          )}
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 border-b border-[#334155] pb-3" id="fixture-filter-tabs">
        {/* Match Type Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase text-[#94a3b8] mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3 text-[#eab308]" /> Filter:
            </span>
            {[
              { id: "All", label: "All Matches" },
              { id: "League", label: "League Matches" },
              { id: "Cup", label: "Cup Matches" },
              { id: "Friendly", label: "Friendly Matches" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id as any);
                  if (tab.id !== "League" && tab.id !== "All") {
                    setActiveDivisionFilter("All");
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeFilter === tab.id 
                    ? "bg-[#eab308] text-[#0b0f19] font-black shadow-md" 
                    : "bg-[#1e293b] text-[#94a3b8] hover:text-white border border-[#334155]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Division Sub-Filter (Shown when All Matches or League Matches is selected) */}
        {(activeFilter === "All" || activeFilter === "League") && availableDivisions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#334155]/50 animate-fadeIn">
            <span className="text-[11px] font-extrabold uppercase text-[#94a3b8] mr-1">
              Division:
            </span>
            <button
              onClick={() => setActiveDivisionFilter("All")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeDivisionFilter === "All" 
                  ? "bg-[#38bdf8] text-[#0b0f19] font-black" 
                  : "bg-[#0f172a] text-[#94a3b8] hover:text-white border border-[#334155]"
              }`}
            >
              All Divisions
            </button>
            {availableDivisions.map(divName => (
              <button
                key={divName}
                onClick={() => setActiveDivisionFilter(divName)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeDivisionFilter === divName 
                    ? "bg-[#38bdf8] text-[#0b0f19] font-black" 
                    : "bg-[#0f172a] text-[#94a3b8] hover:text-white border border-[#334155]"
                }`}
              >
                {divName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Display */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#eab308] border-t-transparent" />
        </div>
      ) : filteredFixtures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#334155] bg-[#1e293b] p-8 text-center text-[#94a3b8] text-xs">
          No scheduled match fixtures match the active criteria.
        </div>
      ) : displayMode === "table" ? (
        /* Table Layout: Match Performance Log Directory */
        <div className="rounded-2xl border border-[#334155] bg-[#1e293b] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-[#0f172a] text-[#94a3b8] uppercase font-mono text-[10px] tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4">Date & Comp</th>
                  <th className="py-3 px-4">Matchup (Away vs Home)</th>
                  <th className="py-3 px-4">Venue</th>
                  <th className="py-3 px-4 text-center">Result / Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {filteredFixtures.map((f) => {
                  const isPlayed = f.status === "Played";
                  const awayTeam = f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent);
                  const homeTeam = f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent);
                  const awayScore = f.awayScore !== undefined ? f.awayScore : (f.venue === "Away" ? (f.ourScore ?? 0) : (f.oppScore ?? 0));
                  const homeScore = f.homeScore !== undefined ? f.homeScore : (f.venue === "Home" ? (f.ourScore ?? 0) : (f.oppScore ?? 0));

                  return (
                    <tr key={f.id} className="hover:bg-[#0b0f19]/50 transition-colors">
                      {/* Date & Competition */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-white">{f.date}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[#eab308] uppercase font-bold">{f.competition}</span>
                          {f.division && (
                            <span className="text-[9px] text-[#94a3b8] bg-[#0b0f19] px-1.5 py-0.5 rounded border border-[#334155] font-sans">
                              {f.division}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Matchup */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span className="truncate max-w-[100px] sm:max-w-[140px]">{awayTeam}</span>
                          <span className="text-[10px] text-[#94a3b8] font-mono">vs</span>
                          <span className="truncate max-w-[100px] sm:max-w-[140px]">{homeTeam}</span>
                        </div>
                      </td>

                      {/* Venue */}
                      <td className="py-3 px-4 text-[#94a3b8]">
                        {f.venue === "Home" ? "Cardiff Town Arena (Home)" : `${f.opponent}'s Stadium (Away)`}
                      </td>

                      {/* Result / Status */}
                      <td className="py-3 px-4 text-center">
                        {isPlayed ? (
                          <span className="inline-flex items-center gap-1.5 bg-[#0b0f19] border border-[#eab308]/40 px-2.5 py-1 rounded-lg font-mono font-bold text-white">
                            <span className={awayScore > homeScore ? "text-emerald-400 font-extrabold" : "text-white"}>{awayScore}</span>
                            <span className="text-[#94a3b8]">:</span>
                            <span className={homeScore > awayScore ? "text-emerald-400 font-extrabold" : "text-white"}>{homeScore}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase">
                            <Clock className="h-3 w-3 shrink-0" />
                            Upcoming
                          </span>
                        )}
                      </td>

                      {/* Actions Column (Rightmost) */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* ⬆️ Upload Data Icon/Button */}
                          {isAuthorized && !isPlayed && (
                            <>
                              <input
                                type="file"
                                id={`table-upload-${f.id}`}
                                className="hidden"
                                accept=".xlsx,.xls"
                                onChange={(e) => handleFixtureFileUpload(e, f.id)}
                              />
                              <button
                                onClick={() => document.getElementById(`table-upload-${f.id}`)?.click()}
                                className="p-1.5 rounded-lg bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] font-bold transition-all cursor-pointer shadow-xs"
                                title="Upload match Excel statistics ⬆️"
                              >
                                <Upload className="h-4 w-4 shrink-0" />
                              </button>
                              <button
                                onClick={async () => {
                                  const input = window.prompt(`Enter result for ${awayTeam} vs ${homeTeam}\nFormat: AwayScore-HomeScore (e.g. 2-1):`);
                                  if (!input) return;
                                  const parts = input.split("-").map(p => p.trim());
                                  if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                                    const aScore = Number(parts[0]);
                                    const hScore = Number(parts[1]);
                                    try {
                                      await DataService.updateFixtureManualScore(f.id, hScore, aScore);
                                      await loadFixtures();
                                      if (onFixturesUpdated) onFixturesUpdated();
                                    } catch (err: any) {
                                      alert("Failed to update score: " + err.message);
                                    }
                                  } else {
                                    alert("Invalid score format. Please use format AwayScore-HomeScore e.g. 2-1");
                                  }
                                }}
                                className="px-2 py-1.5 rounded-lg bg-[#0b0f19] hover:bg-[#334155] text-white border border-[#334155] text-[11px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                title="Enter match score manually ⚽"
                              >
                                <Edit3 className="h-3.5 w-3.5 text-[#eab308]" />
                                <span>Score</span>
                              </button>
                            </>
                          )}

                          {/* Analysis Button for Concluded Matches */}
                          {isPlayed && (
                            <button
                              onClick={() => {
                                loadAllMatchData();
                                setSelectedAnalysisFixture(f);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#0b0f19] border border-[#334155] text-[#eab308] hover:bg-[#334155] font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                              title="Analyze match statistics"
                            >
                              <span>Analysis</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </button>
                          )}

                          {/* 🗑️ Trash Bin Icon: Clear Uploaded Match Stats */}
                          {isAuthorized && isPlayed && (
                            <button
                              onClick={() => handleRevertMatchStats(f.id, f.opponent)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                              title="Clear Uploaded Match Data 🗑️"
                            >
                              <Trash2 className="h-4 w-4 shrink-0" />
                            </button>
                          )}

                          {/* ➖ Minus Icon: Remove Scheduled Fixture */}
                          {isAuthorized && (
                            <button
                              onClick={() => handleDeleteFixture(f.id)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                              title="Remove Scheduled Fixture ➖"
                            >
                              <Minus className="h-4 w-4 shrink-0" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid Layout */
        <div className="grid gap-4 sm:grid-cols-2" id="fixtures-grid">
          {filteredFixtures.map((f) => {
            const isPlayed = f.status === "Played";
            const awayTeam = f.awayTeam || (f.venue === "Away" ? "Cardiff Town FC" : f.opponent);
            const homeTeam = f.homeTeam || (f.venue === "Home" ? "Cardiff Town FC" : f.opponent);
            const awayScore = f.awayScore !== undefined ? f.awayScore : (f.venue === "Away" ? (f.ourScore ?? 0) : (f.oppScore ?? 0));
            const homeScore = f.homeScore !== undefined ? f.homeScore : (f.venue === "Home" ? (f.ourScore ?? 0) : (f.oppScore ?? 0));

            return (
              <div 
                key={f.id} 
                className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between bg-[#1e293b] transition-all hover:border-[#eab308]/50 relative ${
                  isPlayed ? "border-[#334155]" : "border-[#334155]"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-1.5 mb-3">
                  <div className="flex items-center gap-1.5 text-[#94a3b8] font-mono text-xs">
                    <Calendar className="h-3.5 w-3.5 text-[#eab308] shrink-0" />
                    <span>{f.date}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold border border-[#eab308]/40 bg-[#0b0f19] text-[#eab308] rounded-full uppercase font-mono">
                      {f.competition}
                    </span>
                    {f.division && (
                      <span className="px-2 py-0.5 text-[10px] font-bold border border-[#334155] bg-[#0b0f19] text-[#94a3b8] rounded-full font-mono">
                        {f.division}
                      </span>
                    )}
                  </div>
                </div>

                {/* Teams & Score */}
                <div className="space-y-3.5 mb-3">
                  <div className="grid grid-cols-7 items-center gap-1">
                    <div className="col-span-3 flex items-center justify-end gap-2 text-right">
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[90px] sm:max-w-none" title={awayTeam}>
                        {awayTeam}
                      </span>
                      <TeamLogo teamName={awayTeam} size={24} className="rounded-md shrink-0 bg-[#0b0f19] p-0.5" />
                    </div>

                    <div className="col-span-1 flex items-center justify-center text-center">
                      {isPlayed ? (
                        <div className="flex items-center gap-1 bg-[#0b0f19] text-white px-2 py-0.5 rounded-lg border border-[#eab308]/30 font-mono font-bold text-xs">
                          <span>{awayScore}</span>
                          <span className="text-[#94a3b8]">:</span>
                          <span>{homeScore}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-[#94a3b8] font-black bg-[#0b0f19] border border-[#334155] px-2 py-0.5 rounded-md uppercase font-mono">
                          VS
                        </span>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center justify-start gap-2 text-left">
                      <TeamLogo teamName={homeTeam} size={24} className="rounded-md shrink-0 bg-[#0b0f19] p-0.5" />
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[90px] sm:max-w-none" title={homeTeam}>
                        {homeTeam}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-[#94a3b8] justify-center bg-[#0b0f19] rounded-lg p-1.5 border border-[#334155]">
                    <MapPin className="h-3 w-3 shrink-0 text-[#eab308]" />
                    <span className="truncate">
                      {f.venue === "Home" ? "Cardiff Town Arena (Home)" : `${f.opponent}'s Stadium (Away)`}
                    </span>
                  </div>
                </div>

                {uploadingId === f.id && (
                  <div className="text-[10px] bg-[#0b0f19] border border-[#eab308] rounded-xl p-2.5 mb-3 font-mono font-semibold text-[#eab308] animate-pulse">
                    {uploadStatus}
                  </div>
                )}

                {/* Footer and Interactive details */}
                <div className="flex items-center justify-between border-t border-[#334155] pt-3 mt-auto">
                  <div className="flex items-center gap-1 text-[10px] font-bold">
                    {isPlayed ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                        Match Concluded
                      </span>
                    ) : (
                      <span className="text-blue-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        Upcoming fixture
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {isAuthorized && !isPlayed && (
                      <>
                        <input
                          type="file"
                          id={`upload-${f.id}`}
                          className="hidden"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFixtureFileUpload(e, f.id)}
                        />
                        <button
                          onClick={() => document.getElementById(`upload-${f.id}`)?.click()}
                          className="p-1.5 rounded-lg bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] font-bold transition-all cursor-pointer"
                          title="Upload match Excel statistics ⬆️"
                        >
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                        </button>
                        <button
                          onClick={async () => {
                            const input = window.prompt(`Enter result for ${awayTeam} vs ${homeTeam}\nFormat: AwayScore-HomeScore (e.g. 2-1):`);
                            if (!input) return;
                            const parts = input.split("-").map(p => p.trim());
                            if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                              const aScore = Number(parts[0]);
                              const hScore = Number(parts[1]);
                              try {
                                await DataService.updateFixtureManualScore(f.id, hScore, aScore);
                                await loadFixtures();
                                if (onFixturesUpdated) onFixturesUpdated();
                              } catch (err: any) {
                                alert("Failed to update score: " + err.message);
                              }
                            } else {
                              alert("Invalid score format. Please use format AwayScore-HomeScore e.g. 2-1");
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-[#0b0f19] hover:bg-[#334155] text-white border border-[#334155] text-[10px] font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                          title="Enter match score manually ⚽"
                        >
                          <Edit3 className="h-3 w-3 text-[#eab308]" />
                          <span>Score</span>
                        </button>
                      </>
                    )}

                    {isPlayed && (
                      <button
                        onClick={() => {
                          loadAllMatchData();
                          setSelectedAnalysisFixture(f);
                        }}
                        className="text-[10px] font-bold text-[#eab308] hover:underline flex items-center gap-1 cursor-pointer bg-[#0b0f19] border border-[#334155] px-2.5 py-1 rounded-lg"
                      >
                        <span>Analysis</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </button>
                    )}

                    {isAuthorized && isPlayed && (
                      <button
                        onClick={() => handleRevertMatchStats(f.id, f.opponent)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all cursor-pointer"
                        title="Clear Uploaded Match Data 🗑️"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    )}

                    {isAuthorized && (
                      <button
                        onClick={() => handleDeleteFixture(f.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                        title="Remove Scheduled Fixture ➖"
                      >
                        <Minus className="h-3.5 w-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAnalysisFixture && (() => {
        const hTeam = selectedAnalysisFixture.homeTeam || "Cardiff Town FC";
        const aTeam = selectedAnalysisFixture.awayTeam || selectedAnalysisFixture.opponent;
        
        return (
          <div id="match-analysis-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className={`bg-white rounded-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 ${activeAnalysisTab === "heatmap" ? "max-w-4xl" : "max-w-2xl"}`}>
              
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-1">Match Statistics Analysis</span>
                  <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <TrendingUp className="h-4.5 w-4.5 text-[#1D4ED8]" />
                    {selectedAnalysisFixture.competition} Match Comparison
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isMobile || !isAuthorized) return;
                      window.print();
                    }}
                    disabled={isMobile || !isAuthorized}
                    className="no-print inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-[#0A2342] hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                    title={
                      isMobile
                        ? "PDF export is only available on desktop."
                        : !isAuthorized
                        ? "Only Head Coach, Manager, and Analyst can export PDF reports."
                        : "Export match statistics as a PDF report"
                    }
                  >
                    <Printer className="h-3.5 w-3.5 text-[#D4AF37]" />
                    <span>PDF</span>
                  </button>
                  <button 
                    onClick={() => setSelectedAnalysisFixture(null)}
                    className="rounded-full hover:bg-slate-200 p-1.5 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer no-print"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Match Summary Display (Teams and Logo) */}
              <div className="p-5 bg-[#0A2342] text-white flex flex-col items-center justify-center gap-2 text-center shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-radial from-transparent to-black/30 opacity-60" />
                
                <span className="text-[10px] font-bold tracking-widest text-[#D4AF37] uppercase font-mono relative z-10">
                  {selectedAnalysisFixture.date}
                </span>

                <div className="flex items-center justify-center gap-6 w-full relative z-10 my-1">
                  <div className="flex flex-col items-center gap-1.5 w-1/3">
                    <TeamLogo teamName={hTeam} size={42} className="bg-white/10 rounded-lg p-1 border border-white/20" />
                    <span className="text-xs sm:text-sm font-extrabold truncate w-full" title={hTeam}>{hTeam}</span>
                    <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase">HOME</span>
                  </div>

                  <div className="flex flex-col items-center justify-center gap-1">
                    <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight bg-white/10 px-4 py-1.5 rounded-xl border border-white/10">
                      {selectedAnalysisFixture.homeScore ?? 0} : {selectedAnalysisFixture.awayScore ?? 0}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1.5 w-1/3">
                    <TeamLogo teamName={aTeam} size={42} className="bg-white/10 rounded-lg p-1 border border-white/20" />
                    <span className="text-xs sm:text-sm font-extrabold truncate w-full" title={aTeam}>{aTeam}</span>
                    <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase">AWAY</span>
                  </div>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50 no-print">
                <button
                  onClick={() => setActiveAnalysisTab("stats")}
                  className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer text-center ${
                    activeAnalysisTab === "stats"
                      ? "border-[#1D4ED8] text-[#1D4ED8] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  Statistics Comparison
                </button>
                <button
                  onClick={() => setActiveAnalysisTab("heatmap")}
                  className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer text-center ${
                    activeAnalysisTab === "heatmap"
                      ? "border-[#1D4ED8] text-[#1D4ED8] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  Tactical Tracking Heatmap
                </button>
              </div>

              {/* Modal Body / Categories */}
              <div className="p-6 overflow-y-auto space-y-6">
                {activeAnalysisTab === "heatmap" ? (
                  <MatchHeatmap matchId={selectedAnalysisFixture.id} homeTeam={hTeam} awayTeam={aTeam} />
                ) : (
                  !analysisData?.homeData || !analysisData?.awayData ? (
                    <div className="text-center py-10 text-slate-500 font-medium text-xs">
                      No detailed metric records were found for this match.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {categories.map((cat) => (
                        <div key={cat.title} className="bg-slate-50 border border-slate-100 p-4 rounded-xl space-y-3 shadow-3xs">
                          <h4 className="text-xs font-bold text-[#0A2342] uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                            <span>{cat.title} Comparison</span>
                          </h4>
                          <div className="space-y-4">
                            {cat.metrics.map((m) => {
                              const total = m.homeVal + m.awayVal;
                              const homePct = total > 0 ? (m.homeVal / total) * 100 : 50;
                              const awayPct = total > 0 ? (m.awayVal / total) * 100 : 50;

                              const isHomeHigher = m.homeVal > m.awayVal;
                              const isAwayHigher = m.awayVal > m.homeVal;

                              const homeColor = isHomeHigher ? "bg-[#1D4ED8]" : "bg-slate-300";
                              const awayColor = isAwayHigher ? "bg-[#1D4ED8]" : "bg-slate-300";

                              const homeTextColor = isHomeHigher ? "text-[#1D4ED8] font-black" : "text-slate-600 font-semibold";
                              const awayTextColor = isAwayHigher ? "text-[#1D4ED8] font-black" : "text-slate-600 font-semibold";

                              return (
                                <div key={m.label} className="space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-sans">
                                    <span className={homeTextColor}>{m.homeVal}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</span>
                                    <span className={awayTextColor}>{m.awayVal}</span>
                                  </div>
                                  <div className="flex h-1.5 w-full items-center gap-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className="w-1/2 flex justify-end">
                                      <div 
                                        className={`h-full rounded-l-full ${homeColor} transition-all duration-500`}
                                        style={{ width: `${homePct}%` }}
                                      />
                                    </div>
                                    <div className="w-1/2 flex justify-start">
                                      <div 
                                        className={`h-full rounded-r-full ${awayColor} transition-all duration-500`}
                                        style={{ width: `${awayPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-2xl">
                <button
                  onClick={() => setSelectedAnalysisFixture(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white rounded-lg cursor-pointer transition-colors"
                >
                  Close Analysis
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
