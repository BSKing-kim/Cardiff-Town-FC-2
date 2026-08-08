import React, { useState, useEffect, useRef } from "react";
import { MatchFixture, UserProfile, UserRole, CustomTeam, MatchData } from "../types";
import { DataService } from "../lib/dataService";
import { ExcelUtils } from "../lib/excelUtils";
import { MatchHeatmap } from "./MatchHeatmap";
import { 
  Calendar, MapPin, Trophy, ShieldAlert, Plus, Trash2, Clock, CheckCircle, ExternalLink, Filter, Upload, Printer, X, TrendingUp, Download, Minus, Table, LayoutGrid, Edit3, PieChart
} from "lucide-react";
import TeamLogo from "./TeamLogo";
import { LEAGUES } from "./TeamDashboard";
import { supabase } from "../lib/supabase";
import { parseMatchFixturesExcel } from "../lib/excelUtils";

interface MatchFixturesProps {
  currentUser: UserProfile;
  onSelectOpponent?: (opponent: string) => void;
  defaultFilter?: "All" | "League" | "Cup" | "Friendly";
  onFixturesUpdated?: () => void;
}

export default function MatchFixtures({ currentUser, onSelectOpponent, defaultFilter = "All", onFixturesUpdated }: MatchFixturesProps) {
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
  
  const isUploadingRef = useRef(false);

  // Match-by-match excel upload state
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleFixtureFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fixture: MatchFixture) => {
    if (!isAuthorized) {
      alert("Uploading match statistics is reserved for Coaching Staff and Admins.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file || isUploadingRef.current) return;

    const targetMatchId = String(fixture.id).trim();

    try {
      isUploadingRef.current = true;
      console.log("Starting single match upload for file:", file.name, "targetMatchId:", targetMatchId);
      setUploadingId(targetMatchId);
      setUploadStatus(`Reading spreadsheet for match against ${fixture.opponent}...`);

      // 1. Parse Excel file using parseMatchFixturesExcel
      const parsed = await parseMatchFixturesExcel(file);
      const rawMatch = (parsed.data && parsed.data.length > 0 ? parsed.data[0] : {}) as any;

      const singleMatchPayload = {
        ...rawMatch,
        id: targetMatchId, // Strictly fixed ID
        date: rawMatch.date || fixture.date,
        opponent: rawMatch.opponent || fixture.opponent,
        home_away: rawMatch.home_away || fixture.venue || 'Home',
        our_score: rawMatch.our_score ?? rawMatch.goals ?? 0,
        opponent_score: rawMatch.opponent_score ?? rawMatch.opp_goals ?? 0,
        status: 'completed'
      };

      console.log("Upserting strictly 1 record:", singleMatchPayload);

      const { data, error } = await (supabase.from('matches') as any)
        .upsert([singleMatchPayload], { onConflict: 'id' });

      if (error) {
        console.error("Upload error:", error);
      } else {
        console.log("Upload successful with single row!", data);
      }

      // Mirror to DataService
      await DataService.saveMatches([DataService.migrateMatch(singleMatchPayload)]);

      const successText = `Match data updated for match against ${fixture.opponent}`;
      setUploadStatus(successText);
      alert(successText);

      // Re-fetch matches from DB immediately to update UI instantly
      await loadFixtures();
      if (onFixturesUpdated) {
        onFixturesUpdated();
      }

      setTimeout(() => {
        setUploadingId(null);
        setUploadStatus("");
      }, 4000);

    } catch (err: any) {
      console.error("Upload error:", err);
      const errText = `Error: ${err.message || "Failed to process match data upload"}`;
      setUploadStatus(errText);
      alert(errText);
      setTimeout(() => {
        setUploadingId(null);
        setUploadStatus("");
      }, 4000);
    } finally {
      isUploadingRef.current = false;
      if (e.target) {
        e.target.value = "";
      }
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
    return Array.from(set)
      .filter(Boolean)
      .filter(div => !div.toLowerCase().includes("friendly"))
      .sort((a, b) => a.localeCompare(b));
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
      const [list, matchDataList] = await Promise.all([
        DataService.getFixtures(),
        DataService.getMatches(true)
      ]);

      const mergedList = list.map(f => {
        const m = matchDataList.find(dbM => String(dbM.id).trim() === String(f.id).trim() || (dbM as any).match_id === String(f.id).trim());
        if (m) {
          const ourScore = (m as any).our_score ?? m.ourScore ?? f.ourScore;
          const oppScore = (m as any).opponent_score ?? m.oppScore ?? f.oppScore;
          const isCompleted = (m as any).status === 'completed' || (m as any).status === 'Finished' || (ourScore !== undefined && ourScore !== null);
          return {
            ...f,
            ourScore,
            oppScore,
            status: isCompleted ? 'Completed' : f.status
          };
        }
        return f;
      });

      setFixtures(mergedList);
      setAllMatchData(matchDataList);
    } catch (e) {
      console.error("Error loading fixtures:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllInitialData = async () => {
    await loadFixtures();
    try {
      const teamsList = await DataService.getCustomTeams();
      setCustomTeams(teamsList);
    } catch (e) {
      console.error("Error loading custom teams:", e);
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
    
    const isCardiffHome = selectedAnalysisFixture.venue === "Home" || 
                          (selectedAnalysisFixture as any).home_away === "Home" ||
                          selectedAnalysisFixture.homeTeam === "Cardiff Town FC";

    const hTeam = isCardiffHome ? "Cardiff Town FC" : selectedAnalysisFixture.opponent;
    const aTeam = isCardiffHome ? selectedAnalysisFixture.opponent : "Cardiff Town FC";

    // Match by ID first
    const targetMatch = allMatchData.find(m => 
      String(m.id).trim() === String(selectedAnalysisFixture.id).trim() ||
      String(m.fixtureId).trim() === String(selectedAnalysisFixture.id).trim()
    );

    const dateMatches = allMatchData.filter(m => m.date === selectedAnalysisFixture.date);

    let homeData: any = null;
    let awayData: any = null;

    if (targetMatch) {
      const ourGoals = (targetMatch as any).our_score ?? targetMatch.goals ?? 0;
      const oppGoals = (targetMatch as any).opponent_score ?? (targetMatch as any).opp_goals ?? 0;
      const ourPoss = (targetMatch as any).possession ?? targetMatch.possessionRate ?? 50;
      const oppPoss = (targetMatch as any).opp_possession ?? (100 - Number(ourPoss));

      const ourPackage = {
        ...targetMatch,
        goals: ourGoals,
        possessionRate: Number(ourPoss),
        shots: targetMatch.shots ?? (targetMatch as any).shots ?? 0,
        shotsOnTarget: targetMatch.shotsOnTarget ?? (targetMatch as any).shots_on_target ?? 0,
        totalPasses: targetMatch.totalPasses ?? (targetMatch as any).passes ?? 0,
        successfulPasses: targetMatch.successfulPasses ?? (targetMatch as any).successful_passes ?? 0,
        backwardsPasses: (targetMatch as any).backwards_passes ?? 0,
        forwardsPasses: (targetMatch as any).forwards_passes ?? 0,
        longPasses: (targetMatch as any).long_passes ?? 0,
        successfulLongPasses: (targetMatch as any).successful_long_passes ?? 0,
        keyPasses: (targetMatch as any).key_passes ?? 0,
        successfulKeyPasses: (targetMatch as any).successful_key_passes ?? 0,
        throughBalls: (targetMatch as any).through_balls ?? 0,
        successfulThroughBalls: (targetMatch as any).successful_through_balls ?? 0,
        crosses: (targetMatch as any).crosses ?? 0,
        successfulCrosses: (targetMatch as any).successful_crosses ?? 0,
        dribbles: (targetMatch as any).dribbles ?? 0,
        successfulDribbles: (targetMatch as any).successful_dribbles ?? 0,
        duels: (targetMatch as any).duels ?? 0,
        duelsWon: (targetMatch as any).duels_won ?? 0,
        aerialDuels: (targetMatch as any).aerial_duels ?? 0,
        aerialDuelsWon: (targetMatch as any).aerial_duels_won ?? 0,
        groundDuels: (targetMatch as any).ground_duels ?? 0,
        groundDuelsWon: (targetMatch as any).ground_duels_won ?? 0,
        ballRecoveries: (targetMatch as any).ball_recoveries ?? 0,
        tacklesAttempted: targetMatch.tacklesAttempted ?? (targetMatch as any).tackles ?? 0,
        tacklesWon: targetMatch.tacklesWon ?? (targetMatch as any).tackles_won ?? 0,
        interceptions: targetMatch.interceptions ?? (targetMatch as any).interceptions ?? 0,
        clearances: targetMatch.clearances ?? (targetMatch as any).clearances ?? 0,
        blocks: (targetMatch as any).blocks ?? 0,
        ownGoals: (targetMatch as any).own_goals ?? 0,
        turnovers: (targetMatch as any).turnovers ?? 0,
        miscontrols: (targetMatch as any).miscontrols ?? 0,
        unsuccessfulDribbles: (targetMatch as any).unsuccessful_dribbles ?? 0,
        possessionLost: (targetMatch as any).possession_lost ?? 0,
        offsides: (targetMatch as any).offsides ?? 0,
        fouls: (targetMatch as any).fouls ?? 0,
        yellowCards: (targetMatch as any).yellow_cards ?? 0,
        redCards: (targetMatch as any).red_cards ?? 0,
      };

      const oppPackage = {
        ...targetMatch,
        id: `${targetMatch.id}_opp`,
        opponent: "Cardiff Town FC",
        isOpponentTeam: true,
        goals: oppGoals,
        possessionRate: Number(oppPoss),
        shots: (targetMatch as any).opp_shots ?? 0,
        shotsOnTarget: (targetMatch as any).opp_shots_on_target ?? 0,
        totalPasses: (targetMatch as any).opp_passes ?? 0,
        successfulPasses: (targetMatch as any).opp_successful_passes ?? 0,
        backwardsPasses: (targetMatch as any).opp_backwards_passes ?? 0,
        forwardsPasses: (targetMatch as any).opp_forwards_passes ?? 0,
        longPasses: (targetMatch as any).opp_long_passes ?? 0,
        successfulLongPasses: (targetMatch as any).opp_successful_long_passes ?? 0,
        keyPasses: (targetMatch as any).opp_key_passes ?? 0,
        successfulKeyPasses: (targetMatch as any).opp_successful_key_passes ?? 0,
        throughBalls: (targetMatch as any).opp_through_balls ?? 0,
        successfulThroughBalls: (targetMatch as any).opp_successful_through_balls ?? 0,
        crosses: (targetMatch as any).opp_crosses ?? 0,
        successfulCrosses: (targetMatch as any).opp_successful_crosses ?? 0,
        dribbles: (targetMatch as any).opp_dribbles ?? 0,
        successfulDribbles: (targetMatch as any).opp_successful_dribbles ?? 0,
        duels: (targetMatch as any).opp_duels ?? 0,
        duelsWon: (targetMatch as any).opp_duels_won ?? 0,
        aerialDuels: (targetMatch as any).opp_aerial_duels ?? 0,
        aerialDuelsWon: (targetMatch as any).opp_aerial_duels_won ?? 0,
        groundDuels: (targetMatch as any).opp_ground_duels ?? 0,
        groundDuelsWon: (targetMatch as any).opp_ground_duels_won ?? 0,
        ballRecoveries: (targetMatch as any).opp_ball_recoveries ?? 0,
        tacklesAttempted: (targetMatch as any).opp_tackles ?? 0,
        tacklesWon: (targetMatch as any).opp_tackles_won ?? 0,
        interceptions: (targetMatch as any).opp_interceptions ?? 0,
        clearances: (targetMatch as any).opp_clearances ?? 0,
        blocks: (targetMatch as any).opp_blocks ?? 0,
        ownGoals: (targetMatch as any).opp_own_goals ?? 0,
        turnovers: (targetMatch as any).opp_turnovers ?? 0,
        miscontrols: (targetMatch as any).opp_miscontrols ?? 0,
        unsuccessfulDribbles: (targetMatch as any).opp_unsuccessful_dribbles ?? 0,
        possessionLost: (targetMatch as any).opp_possession_lost ?? 0,
        offsides: (targetMatch as any).opp_offsides ?? 0,
        fouls: (targetMatch as any).opp_fouls ?? 0,
        yellowCards: (targetMatch as any).opp_yellow_cards ?? 0,
        redCards: (targetMatch as any).opp_red_cards ?? 0,
      };

      if (isCardiffHome) {
        homeData = ourPackage;
        awayData = oppPackage;
      } else {
        homeData = oppPackage;
        awayData = ourPackage;
      }
    } else {
      homeData = dateMatches.find(m => m.teamName?.toLowerCase() === hTeam.toLowerCase());
      awayData = dateMatches.find(m => m.teamName?.toLowerCase() === aTeam.toLowerCase() && m.id !== homeData?.id);
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
            <>
              <button
                type="button"
                onClick={() => ExcelUtils.downloadMatchFixturesTemplate()}
                className="flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-bold text-emerald-300 shadow-md transition-all cursor-pointer shrink-0"
                title="Download Match Fixtures Excel Template"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{isMobile ? "Template" : "Download Template"}</span>
              </button>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 rounded-xl bg-[#eab308] hover:bg-[#f59e0b] px-3.5 py-2 text-xs font-black text-[#0b0f19] shadow-md transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>{isMobile ? "New" : (showAddForm ? "Close Form" : "Schedule New Match")}</span>
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* Filter Dropdowns Container */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-[#1e293b] border border-[#334155] p-4 rounded-2xl shadow-md font-sans" id="fixture-filter-tabs">
        {/* Match Type Filter Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-[#94a3b8] uppercase flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-[#eab308]" />
            <span>Filter:</span>
          </label>
          <select 
            value={activeFilter} 
            onChange={(e) => {
              const val = e.target.value as any;
              setActiveFilter(val);
              if (val !== "League" && val !== "All") {
                setActiveDivisionFilter("All");
              }
            }}
            className="bg-[#0b0f19] text-white border border-[#334155] rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#eab308] cursor-pointer w-full sm:w-auto min-w-[160px]"
          >
            <option value="All">All Matches</option>
            <option value="League">League Matches</option>
            <option value="Cup">Cup Matches</option>
            <option value="Friendly">Friendly Matches</option>
          </select>
        </div>

        {/* Division Filter Dropdown */}
        {(activeFilter === "All" || activeFilter === "League") && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-bold text-[#94a3b8] uppercase shrink-0">
              Division:
            </label>
            <select 
              value={activeDivisionFilter} 
              onChange={(e) => setActiveDivisionFilter(e.target.value)}
              className="bg-[#0b0f19] text-white border border-[#334155] rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:border-[#38bdf8] cursor-pointer w-full sm:w-auto min-w-[180px]"
            >
              <option value="All">All Divisions</option>
              {availableDivisions.map(divName => (
                <option key={divName} value={divName}>
                  {divName}
                </option>
              ))}
            </select>
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
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-[#0f172a] text-[#94a3b8] uppercase font-mono text-[10px] tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4">Date & Comp</th>
                  <th className="py-3 px-4">Matchup (Home vs Away)</th>
                  <th className="py-3 px-4">Venue</th>
                  <th className="py-3 px-4 text-center">Result / Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {filteredFixtures.map((f) => {
                  const isCardiffHome = f.venue === "Home" || (f as any).home_away === "Home" || f.homeTeam === "Cardiff Town FC";
                  const homeTeam = isCardiffHome ? "Cardiff Town FC" : f.opponent;
                  const awayTeam = isCardiffHome ? f.opponent : "Cardiff Town FC";
                  
                  // Single-row DB lookup: find ONE record matching this fixture ID
                  const matchRecord = allMatchData.find(m => 
                    String(m.id).trim() === String(f.id).trim() ||
                    String((m as any).match_id).trim() === String(f.id).trim()
                  );

                  // Score extraction: support both snake_case (raw DB) and camelCase (migrateMatch output)
                  const rawOurScore = matchRecord != null
                    ? ((matchRecord as any).our_score ?? (matchRecord as any).ourScore ?? (matchRecord as any).goals)
                    : undefined;
                  const rawOppScore = matchRecord != null
                    ? ((matchRecord as any).opponent_score ?? (matchRecord as any).oppScore ?? (matchRecord as any).opp_goals)
                    : undefined;
                  const displayOurScore = rawOurScore ?? (f as any).our_score ?? (f as any).goals ?? f.ourScore;
                  const displayOppScore = rawOppScore ?? (f as any).opponent_score ?? (f as any).opp_goals ?? f.oppScore;

                  // A score is valid even when it is 0 — only treat undefined/null/'-' as absent
                  const isValidScore = (v: any) => v !== undefined && v !== null && v !== '' && v !== '-';
                  const hasScore = isValidScore(displayOurScore) && isValidScore(displayOppScore);

                  // Uploaded = any single valid match record exists in the DB for this fixture
                  const isMatchUploaded = Boolean(
                    matchRecord || hasScore ||
                    f.status === 'Played' || f.status === 'Completed' || f.status === 'completed'
                  );

                  const isPlayed = isMatchUploaded || hasScore;
                  const isAnalysisAvailable = isMatchUploaded;

                  const homeScore = isCardiffHome ? (isValidScore(displayOurScore) ? displayOurScore : '-') : (isValidScore(displayOppScore) ? displayOppScore : '-');
                  const awayScore = isCardiffHome ? (isValidScore(displayOppScore) ? displayOppScore : '-') : (isValidScore(displayOurScore) ? displayOurScore : '-');

                  return (
                    <tr 
                      key={f.id} 
                      className="hover:bg-[#0b0f19]/50 transition-colors cursor-pointer"
                      onClick={(e) => {
                        // Ignore click if clicking interactive buttons or inputs
                        if ((e.target as HTMLElement).closest("button, input, a")) return;
                        if (isAnalysisAvailable) {
                          loadAllMatchData();
                          setSelectedAnalysisFixture(f);
                        }
                      }}
                    >
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

                      {/* Matchup (Home vs Away) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span className="truncate max-w-[100px] sm:max-w-[140px] text-white" title={homeTeam}>{homeTeam}</span>
                          <span className="text-[10px] text-[#94a3b8] font-mono">vs</span>
                          <span className="truncate max-w-[100px] sm:max-w-[140px] text-slate-300" title={awayTeam}>{awayTeam}</span>
                        </div>
                      </td>

                      {/* Venue */}
                      <td className="py-3 px-4 text-[#94a3b8]">
                        {f.venue === "Home" ? "Cardiff Town Arena (Home)" : `${f.opponent}'s Stadium (Away)`}
                      </td>

                      {/* Result / Status */}
                      <td className="py-3 px-4 text-center">
                        {isPlayed || hasScore ? (
                          <div className="flex flex-col items-center gap-1">
                            <div className="border border-amber-500/50 bg-slate-900/80 px-3 py-1 rounded text-center font-bold text-amber-400 font-mono text-sm shadow-xs inline-flex items-center gap-1.5">
                              {hasScore ? `${homeScore} : ${awayScore}` : '- : -'}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                              <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                              Completed
                            </span>
                          </div>
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
                          {/* Upload Data Button */}
                          {isAuthorized && (
                            <>
                              <input
                                type="file"
                                id={`table-upload-${f.id}`}
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={(e) => handleFixtureFileUpload(e, f)}
                              />
                              <button
                                onClick={() => document.getElementById(`table-upload-${f.id}`)?.click()}
                                className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] text-xs font-black transition-all cursor-pointer shadow-xs shrink-0"
                                title={`Upload Excel match data for match against ${awayTeam}`}
                              >
                                <Upload className="h-3.5 w-3.5 shrink-0" />
                                <span>Upload Data</span>
                              </button>
                            </>
                          )}
                          {!isPlayed && (
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
                          )}

                          {/* Analysis Button for Concluded Matches */}
                          {isAnalysisAvailable && (
                            <button
                              onClick={() => {
                                loadAllMatchData();
                                setSelectedAnalysisFixture(f);
                              }}
                              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                              title="View Match Analysis Dashboard"
                            >
                              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                              <span>View Analysis</span>
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

          {/* Mobile Stacked Card View */}
          <div className="md:hidden divide-y divide-[#334155]">
            {filteredFixtures.map((f) => {
              const isCardiffHome = f.venue === "Home" || (f as any).home_away === "Home" || f.homeTeam === "Cardiff Town FC";
              const homeTeam = isCardiffHome ? "Cardiff Town FC" : f.opponent;
              const awayTeam = isCardiffHome ? f.opponent : "Cardiff Town FC";
              
              const matchRecord = allMatchData.find(m => 
                String(m.id).trim() === String(f.id).trim() ||
                String((m as any).match_id).trim() === String(f.id).trim()
              );

              const rawOurScore = matchRecord != null
                ? ((matchRecord as any).our_score ?? (matchRecord as any).ourScore ?? (matchRecord as any).goals)
                : undefined;
              const rawOppScore = matchRecord != null
                ? ((matchRecord as any).opponent_score ?? (matchRecord as any).oppScore ?? (matchRecord as any).opp_goals)
                : undefined;
              const displayOurScore = rawOurScore ?? (f as any).our_score ?? (f as any).goals ?? f.ourScore;
              const displayOppScore = rawOppScore ?? (f as any).opponent_score ?? (f as any).opp_goals ?? f.oppScore;

              const isValidScore = (v: any) => v !== undefined && v !== null && v !== '' && v !== '-';
              const hasScore = isValidScore(displayOurScore) && isValidScore(displayOppScore);

              const isMatchUploaded = Boolean(
                matchRecord || hasScore ||
                f.status === 'Played' || f.status === 'Completed' || f.status === 'completed'
              );

              const isPlayed = isMatchUploaded || hasScore;
              const isAnalysisAvailable = isMatchUploaded;

              const homeScore = isCardiffHome ? (isValidScore(displayOurScore) ? displayOurScore : '-') : (isValidScore(displayOppScore) ? displayOppScore : '-');
              const awayScore = isCardiffHome ? (isValidScore(displayOppScore) ? displayOppScore : '-') : (isValidScore(displayOurScore) ? displayOurScore : '-');

              return (
                <div 
                  key={f.id} 
                  className="flex flex-col justify-between p-4 gap-3 hover:bg-[#0b0f19]/50 transition-colors cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, input, a")) return;
                    if (isAnalysisAvailable) {
                      loadAllMatchData();
                      setSelectedAnalysisFixture(f);
                    }
                  }}
                >
                  <div className="flex flex-col text-left gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white font-mono text-xs">{f.date}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-[#eab308] uppercase font-bold bg-[#0b0f19] px-2 py-0.5 rounded border border-[#eab308]/30 font-mono">
                          {f.competition}
                        </span>
                        {f.division && (
                          <span className="text-[9px] text-[#94a3b8] bg-[#0b0f19] px-1.5 py-0.5 rounded border border-[#334155]">
                            {f.division}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between font-bold text-white text-sm my-1">
                      <div className="flex items-center gap-1.5">
                        <TeamLogo teamName={homeTeam} size={20} className="rounded shrink-0" />
                        <span className="text-white truncate max-w-[120px]">{homeTeam}</span>
                      </div>
                      <span className="text-[10px] text-[#94a3b8] font-mono px-2">vs</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-300 truncate max-w-[120px]">{awayTeam}</span>
                        <TeamLogo teamName={awayTeam} size={20} className="rounded shrink-0" />
                      </div>
                    </div>
                    <div className="text-[11px] text-[#94a3b8] flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 text-[#eab308]" />
                      <span className="truncate">
                        {f.venue === "Home" ? "Cardiff Town Arena (Home)" : `${f.opponent}'s Stadium (Away)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#334155]/80">
                    {isPlayed || hasScore ? (
                      <div className="flex items-center gap-1.5">
                        <div className="border border-amber-500/50 bg-slate-900/80 px-2.5 py-0.5 rounded font-bold text-amber-400 font-mono text-xs">
                          {hasScore ? `${homeScore} : ${awayScore}` : '- : -'}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase">
                          <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                          Completed
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold uppercase">
                        <Clock className="h-3 w-3 shrink-0" />
                        Upcoming
                      </span>
                    )}

                    <div className="flex items-center gap-1.5">
                      {isAuthorized && (
                        <>
                          <input
                            type="file"
                            id={`mob-table-upload-${f.id}`}
                            className="hidden"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => handleFixtureFileUpload(e, f)}
                          />
                          <button
                            onClick={() => document.getElementById(`mob-table-upload-${f.id}`)?.click()}
                            className="flex items-center gap-1 py-1 px-2 rounded-lg bg-[#eab308] text-[#0b0f19] text-xs font-black shrink-0"
                            title="Upload Data"
                          >
                            <Upload className="h-3.5 w-3.5 shrink-0" />
                            <span>Upload</span>
                          </button>
                        </>
                      )}
                      {isAnalysisAvailable && (
                        <button
                          onClick={() => {
                            loadAllMatchData();
                            setSelectedAnalysisFixture(f);
                          }}
                          className="flex items-center gap-1 py-1 px-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shrink-0"
                          title="View Analysis"
                        >
                          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                          <span>Analysis</span>
                        </button>
                      )}
                      {isAuthorized && isPlayed && (
                        <button
                          onClick={() => handleRevertMatchStats(f.id, f.opponent)}
                          className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0"
                          title="Clear Uploaded Match Data"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Card Grid Layout */
        <div className="grid gap-4 sm:grid-cols-2" id="fixtures-grid">
          {filteredFixtures.map((f) => {
            const isCardiffHome = f.venue === "Home" || (f as any).home_away === "Home" || f.homeTeam === "Cardiff Town FC";
            const homeTeam = isCardiffHome ? "Cardiff Town FC" : f.opponent;
            const awayTeam = isCardiffHome ? f.opponent : "Cardiff Town FC";

            // Single-row DB lookup: find ONE record matching this fixture ID
            const matchRecord = allMatchData.find(m => 
              String(m.id).trim() === String(f.id).trim() ||
              String((m as any).match_id).trim() === String(f.id).trim()
            );

            // Score extraction: support both snake_case (raw DB) and camelCase (migrateMatch output)
            const rawOurScore = matchRecord != null
              ? ((matchRecord as any).our_score ?? (matchRecord as any).ourScore ?? (matchRecord as any).goals)
              : undefined;
            const rawOppScore = matchRecord != null
              ? ((matchRecord as any).opponent_score ?? (matchRecord as any).oppScore ?? (matchRecord as any).opp_goals)
              : undefined;
            const displayOurScore = rawOurScore ?? (f as any).our_score ?? (f as any).goals ?? f.ourScore;
            const displayOppScore = rawOppScore ?? (f as any).opponent_score ?? (f as any).opp_goals ?? f.oppScore;

            // A score is valid even when it is 0 — only treat undefined/null/'-' as absent
            const isValidScore = (v: any) => v !== undefined && v !== null && v !== '' && v !== '-';
            const hasScore = isValidScore(displayOurScore) && isValidScore(displayOppScore);

            // Uploaded = any single valid match record exists in the DB for this fixture
            const isMatchUploaded = Boolean(
              matchRecord || hasScore ||
              f.status === 'Played' || f.status === 'Completed' || f.status === 'completed'
            );

            const isPlayed = isMatchUploaded || hasScore;
            const isAnalysisAvailable = isMatchUploaded;

            const homeScore = isCardiffHome ? (isValidScore(displayOurScore) ? displayOurScore : '-') : (isValidScore(displayOppScore) ? displayOppScore : '-');
            const awayScore = isCardiffHome ? (isValidScore(displayOppScore) ? displayOppScore : '-') : (isValidScore(displayOurScore) ? displayOurScore : '-');

            return (
              <div 
                key={f.id} 
                className={`rounded-2xl border p-5 shadow-lg flex flex-col justify-between bg-[#1e293b] transition-all hover:border-[#eab308]/50 relative cursor-pointer ${
                  isAnalysisAvailable ? "border-emerald-500/30" : "border-[#334155]"
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("button, input, a")) return;
                  if (isAnalysisAvailable) {
                    loadAllMatchData();
                    setSelectedAnalysisFixture(f);
                  }
                }}
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
                      <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[90px] sm:max-w-none" title={homeTeam}>
                        {homeTeam}
                      </span>
                      <TeamLogo teamName={homeTeam} size={24} className="rounded-md shrink-0 bg-[#0b0f19] p-0.5" />
                    </div>

                    <div className="col-span-1 flex items-center justify-center text-center">
                      {isPlayed || hasScore ? (
                        <div className="border border-amber-500/50 bg-slate-900/80 px-2 py-1 rounded text-center font-bold text-amber-400 font-mono text-xs shadow-xs inline-flex items-center gap-1">
                          {hasScore ? `${homeScore} : ${awayScore}` : '- : -'}
                        </div>
                      ) : (
                        <span className="text-[9px] text-[#94a3b8] font-black bg-[#0b0f19] border border-[#334155] px-2 py-0.5 rounded-md uppercase font-mono">
                          VS
                        </span>
                      )}
                    </div>

                    <div className="col-span-3 flex items-center justify-start gap-2 text-left">
                      <TeamLogo teamName={awayTeam} size={24} className="rounded-md shrink-0 bg-[#0b0f19] p-0.5" />
                      <span className="text-xs sm:text-sm font-bold text-slate-300 truncate max-w-[90px] sm:max-w-none" title={awayTeam}>
                        {awayTeam}
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
                        Completed
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
                    {/* Upload Data Button */}
                    {isAuthorized && (
                      <>
                        <input
                          type="file"
                          id={`upload-${f.id}`}
                          className="hidden"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => handleFixtureFileUpload(e, f)}
                        />
                        <button
                          onClick={() => document.getElementById(`upload-${f.id}`)?.click()}
                          className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-[#eab308] hover:bg-[#f59e0b] text-[#0b0f19] text-xs font-black transition-all cursor-pointer shadow-xs shrink-0"
                          title={`Upload Excel match data for match against ${awayTeam}`}
                        >
                          <Upload className="h-3.5 w-3.5 shrink-0" />
                          <span>Upload Data</span>
                        </button>
                      </>
                    )}

                    {!isPlayed && isAuthorized && (
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
                    )}

                    {isAnalysisAvailable && (
                      <button
                        onClick={() => {
                          loadAllMatchData();
                          setSelectedAnalysisFixture(f);
                        }}
                        className="flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                        title="View Match Analysis Dashboard"
                      >
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        <span>View Analysis</span>
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
        const hTeam = selectedAnalysisFixture.homeTeam || (selectedAnalysisFixture.venue === "Away" ? selectedAnalysisFixture.opponent : "Cardiff Town FC");
        const aTeam = selectedAnalysisFixture.awayTeam || (selectedAnalysisFixture.venue === "Home" ? selectedAnalysisFixture.opponent : "Cardiff Town FC");
        
        // Determine scores dynamically from the match data payload
        const rawHomeGoals = analysisData?.homeData?.goals ?? (selectedAnalysisFixture as any).goals;
        const rawAwayGoals = analysisData?.awayData?.goals ?? (selectedAnalysisFixture as any).opp_goals;

        const homeScoreVal = selectedAnalysisFixture.venue === "Home" || (selectedAnalysisFixture as any).home_away === "Home"
          ? (analysisData?.homeData?.goals ?? selectedAnalysisFixture.ourScore ?? rawHomeGoals ?? 0)
          : (analysisData?.awayData?.goals ?? selectedAnalysisFixture.oppScore ?? rawAwayGoals ?? 0);

        const awayScoreVal = selectedAnalysisFixture.venue === "Away" || (selectedAnalysisFixture as any).home_away === "Away"
          ? (analysisData?.homeData?.goals ?? selectedAnalysisFixture.ourScore ?? rawHomeGoals ?? 0)
          : (analysisData?.awayData?.goals ?? selectedAnalysisFixture.oppScore ?? rawAwayGoals ?? 0);

        const leftHeaderScore = analysisData?.homeData?.goals ?? (selectedAnalysisFixture as any).opp_goals ?? (selectedAnalysisFixture as any).opponent_score ?? homeScoreVal;
        const rightHeaderScore = analysisData?.awayData?.goals ?? (selectedAnalysisFixture as any).goals ?? (selectedAnalysisFixture as any).our_score ?? awayScoreVal;

        return (
          <div id="match-analysis-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className={`bg-white rounded-2xl w-full max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 ${activeAnalysisTab === "heatmap" ? "md:max-w-4xl" : "md:max-w-7xl"}`}>
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-0.5">Match Statistics Analysis</span>
                  <h3 className="font-display font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
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
              <div className="p-4 sm:p-5 bg-[#0A2342] text-white flex flex-col items-center justify-center gap-2 text-center shadow-inner relative overflow-hidden">
                <div className="absolute inset-0 bg-radial from-transparent to-black/30 opacity-60" />
                
                <span className="text-[10px] font-bold tracking-widest text-[#D4AF37] uppercase font-mono relative z-10">
                  {selectedAnalysisFixture.date}
                </span>

                <div className="flex flex-row items-center justify-between w-full px-1 sm:px-2 py-2 sm:py-4 relative z-10 my-1">
                  <div className="flex flex-col items-center w-1/3 min-w-0">
                    <TeamLogo teamName={hTeam} size={38} className="bg-white/10 rounded-lg p-1 border border-white/20 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-center mt-1 break-words w-full line-clamp-2" title={hTeam}>{hTeam}</span>
                    <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase mt-0.5">HOME</span>
                  </div>

                  <div className="flex flex-col items-center justify-center w-1/3 px-1 sm:px-2 shrink-0">
                    <div className="text-lg sm:text-3xl font-black font-mono tracking-tight bg-white/10 px-2 sm:px-4 py-1 sm:py-1.5 rounded-xl border border-white/10 whitespace-nowrap">
                      {leftHeaderScore} : {rightHeaderScore}
                    </div>
                  </div>

                  <div className="flex flex-col items-center w-1/3 min-w-0">
                    <TeamLogo teamName={aTeam} size={38} className="bg-white/10 rounded-lg p-1 border border-white/20 shrink-0" />
                    <span className="text-xs sm:text-sm font-extrabold text-center mt-1 break-words w-full line-clamp-2" title={aTeam}>{aTeam}</span>
                    <span className="text-[9px] text-slate-300 font-bold tracking-wider uppercase mt-0.5">AWAY</span>
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

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                {activeAnalysisTab === "heatmap" ? (
                  <MatchHeatmap matchId={selectedAnalysisFixture.id} homeTeam={hTeam} awayTeam={aTeam} />
                ) : (
                  !analysisData?.homeData || !analysisData?.awayData ? (
                    <div className="text-center py-10 text-slate-500 font-medium text-xs">
                      No detailed metric records were found for this match.
                    </div>
                  ) : (() => {
                    const calcPct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

                    const percentageMetrics = [
                      {
                        title: "Shot Accuracy",
                        homePct: calcPct(analysisData?.homeData?.shotsOnTarget || 0, analysisData?.homeData?.shots || 0),
                        awayPct: calcPct(analysisData?.awayData?.shotsOnTarget || 0, analysisData?.awayData?.shots || 0),
                      },
                      {
                        title: "Goal Conversion %",
                        homePct: calcPct(analysisData?.homeData?.goals || 0, analysisData?.homeData?.shots || 0),
                        awayPct: calcPct(analysisData?.awayData?.goals || 0, analysisData?.awayData?.shots || 0),
                      },
                      {
                        title: "Pass Accuracy",
                        homePct: calcPct(analysisData?.homeData?.successfulPasses || 0, analysisData?.homeData?.totalPasses || 0),
                        awayPct: calcPct(analysisData?.awayData?.successfulPasses || 0, analysisData?.awayData?.totalPasses || 0),
                      },
                      {
                        title: "Duel Won %",
                        homePct: calcPct(analysisData?.homeData?.duelsWon || 0, analysisData?.homeData?.duels || 0),
                        awayPct: calcPct(analysisData?.awayData?.duelsWon || 0, analysisData?.awayData?.duels || 0),
                      },
                      {
                        title: "Tackle Won %",
                        homePct: calcPct(analysisData?.homeData?.tacklesWon || 0, analysisData?.homeData?.tacklesAttempted || 0),
                        awayPct: calcPct(analysisData?.awayData?.tacklesWon || 0, analysisData?.awayData?.tacklesAttempted || 0),
                      },
                      {
                        title: "Long Pass Suc %",
                        homePct: calcPct(analysisData?.homeData?.successfulLongPasses || 0, analysisData?.homeData?.longPasses || 0),
                        awayPct: calcPct(analysisData?.awayData?.successfulLongPasses || 0, analysisData?.awayData?.longPasses || 0),
                      },
                      {
                        title: "Key Pass Suc %",
                        homePct: calcPct(analysisData?.homeData?.successfulKeyPasses || 0, analysisData?.homeData?.keyPasses || 0),
                        awayPct: calcPct(analysisData?.awayData?.successfulKeyPasses || 0, analysisData?.awayData?.keyPasses || 0),
                      },
                      {
                        title: "Through Ball Suc %",
                        homePct: calcPct(analysisData?.homeData?.successfulThroughBalls || 0, analysisData?.homeData?.throughBalls || 0),
                        awayPct: calcPct(analysisData?.awayData?.successfulThroughBalls || 0, analysisData?.awayData?.throughBalls || 0),
                      },
                      {
                        title: "Cross Suc %",
                        homePct: calcPct(analysisData?.homeData?.successfulCrosses || 0, analysisData?.homeData?.crosses || 0),
                        awayPct: calcPct(analysisData?.awayData?.successfulCrosses || 0, analysisData?.awayData?.crosses || 0),
                      }
                    ];

                    const detailedMetricList = [
                      { label: "Possession (%)", homeVal: `${Number(analysisData?.homeData?.possessionRate ?? 50).toFixed(1)}%`, awayVal: `${Number(analysisData?.awayData?.possessionRate ?? 50).toFixed(1)}%` },
                      { label: "Goals", homeVal: analysisData?.homeData?.goals ?? 0, awayVal: analysisData?.awayData?.goals ?? 0 },
                      { label: "Shot", homeVal: analysisData?.homeData?.shots ?? 0, awayVal: analysisData?.awayData?.shots ?? 0 },
                      { label: "SOT", homeVal: analysisData?.homeData?.shotsOnTarget ?? 0, awayVal: analysisData?.awayData?.shotsOnTarget ?? 0 },
                      { label: "Passes", homeVal: analysisData?.homeData?.totalPasses ?? 0, awayVal: analysisData?.awayData?.totalPasses ?? 0 },
                      { label: "Backwards", homeVal: analysisData?.homeData?.backwardsPasses ?? 0, awayVal: analysisData?.awayData?.backwardsPasses ?? 0 },
                      { label: "Forwards", homeVal: analysisData?.homeData?.forwardsPasses ?? 0, awayVal: analysisData?.awayData?.forwardsPasses ?? 0 },
                      { label: "Long Passes", homeVal: analysisData?.homeData?.longPasses ?? 0, awayVal: analysisData?.awayData?.longPasses ?? 0 },
                      { label: "Key Passes", homeVal: analysisData?.homeData?.keyPasses ?? 0, awayVal: analysisData?.awayData?.keyPasses ?? 0 },
                      { label: "Through Balls", homeVal: analysisData?.homeData?.throughBalls ?? 0, awayVal: analysisData?.awayData?.throughBalls ?? 0 },
                      { label: "Crosses", homeVal: analysisData?.homeData?.crosses ?? 0, awayVal: analysisData?.awayData?.crosses ?? 0 },
                      { label: "Dribbles", homeVal: analysisData?.homeData?.dribbles ?? 0, awayVal: analysisData?.awayData?.dribbles ?? 0 },
                      { label: "Duels", homeVal: analysisData?.homeData?.duels ?? 0, awayVal: analysisData?.awayData?.duels ?? 0 },
                      { label: "Duel Wons", homeVal: analysisData?.homeData?.duelsWon ?? 0, awayVal: analysisData?.awayData?.duelsWon ?? 0 },
                      { label: "Aerial Duels", homeVal: analysisData?.homeData?.aerialDuels ?? 0, awayVal: analysisData?.awayData?.aerialDuels ?? 0 },
                      { label: "Aerial Duel Wons", homeVal: analysisData?.homeData?.aerialDuelsWon ?? 0, awayVal: analysisData?.awayData?.aerialDuelsWon ?? 0 },
                      { label: "Ground Duels", homeVal: analysisData?.homeData?.groundDuels ?? 0, awayVal: analysisData?.awayData?.groundDuels ?? 0 },
                      { label: "Ground Duel Wons", homeVal: analysisData?.homeData?.groundDuelsWon ?? 0, awayVal: analysisData?.awayData?.groundDuelsWon ?? 0 },
                      { label: "Ball Recovery", homeVal: analysisData?.homeData?.ballRecoveries ?? 0, awayVal: analysisData?.awayData?.ballRecoveries ?? 0 },
                      { label: "Tackles", homeVal: analysisData?.homeData?.tacklesAttempted ?? 0, awayVal: analysisData?.awayData?.tacklesAttempted ?? 0 },
                      { label: "Tackle Wons", homeVal: analysisData?.homeData?.tacklesWon ?? 0, awayVal: analysisData?.awayData?.tacklesWon ?? 0 },
                      { label: "Interceptions", homeVal: analysisData?.homeData?.interceptions ?? 0, awayVal: analysisData?.awayData?.interceptions ?? 0 },
                      { label: "Clearance", homeVal: analysisData?.homeData?.clearances ?? 0, awayVal: analysisData?.awayData?.clearances ?? 0 },
                      { label: "Blocked", homeVal: analysisData?.homeData?.blocks ?? 0, awayVal: analysisData?.awayData?.blocks ?? 0 },
                      { label: "Own Goals", homeVal: analysisData?.homeData?.ownGoals ?? 0, awayVal: analysisData?.awayData?.ownGoals ?? 0 },
                      { label: "Turnovers", homeVal: analysisData?.homeData?.turnovers ?? 0, awayVal: analysisData?.awayData?.turnovers ?? 0 },
                      { label: "Miscontrol", homeVal: analysisData?.homeData?.miscontrols ?? 0, awayVal: analysisData?.awayData?.miscontrols ?? 0 },
                      { label: "Uns Dribble", homeVal: analysisData?.homeData?.unsuccessfulDribbles ?? 0, awayVal: analysisData?.awayData?.unsuccessfulDribbles ?? 0 },
                      { label: "Possession Lost", homeVal: analysisData?.homeData?.possessionLost ?? 0, awayVal: analysisData?.awayData?.possessionLost ?? 0 },
                      { label: "Offside", homeVal: analysisData?.homeData?.offsides ?? 0, awayVal: analysisData?.awayData?.offsides ?? 0 },
                      { label: "Fouls", homeVal: analysisData?.homeData?.fouls ?? 0, awayVal: analysisData?.awayData?.fouls ?? 0 },
                      { label: "Yellow Card", homeVal: analysisData?.homeData?.yellowCards ?? 0, awayVal: analysisData?.awayData?.yellowCards ?? 0 },
                      { label: "Red Card", homeVal: analysisData?.homeData?.redCards ?? 0, awayVal: analysisData?.awayData?.redCards ?? 0 },
                    ];

                    return (
                      <div className="space-y-6">
                        {/* Middle Section: Dual Donut Charts (Home vs Away) for 9 Percentage (%) Metrics */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-[#0A2342] uppercase tracking-wider font-display flex items-center gap-2">
                            <PieChart className="h-4 w-4 text-[#1D4ED8]" />
                            <span>Efficiency & Success Donut Charts (Home vs Away)</span>
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {percentageMetrics.map((pm) => {
                              const radius = 23;
                              const stroke = 5;
                              const circumference = 2 * Math.PI * radius;
                              const homeDashOffset = circumference - (pm.homePct / 100) * circumference;
                              const awayDashOffset = circumference - (pm.awayPct / 100) * circumference;

                              return (
                                <div key={pm.title} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col items-center justify-between text-center shadow-2xs">
                                  {/* Card Title */}
                                  <span className="text-xs font-extrabold text-[#0A2342] uppercase tracking-wider mb-2 font-display">
                                    {pm.title}
                                  </span>

                                  {/* Dual Donut Charts Side-by-Side */}
                                  <div className="grid grid-cols-3 items-center w-full my-1">
                                    {/* Left: Home Team Donut Chart */}
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="relative flex items-center justify-center">
                                        <svg height={56} width={56} className="transform -rotate-90">
                                          <circle stroke="#e2e8f0" fill="transparent" strokeWidth={stroke} r={radius} cx={28} cy={28} />
                                          <circle
                                            stroke="#1D4ED8"
                                            fill="transparent"
                                            strokeWidth={stroke}
                                            strokeDasharray={`${circumference} ${circumference}`}
                                            style={{ strokeDashoffset: homeDashOffset }}
                                            strokeLinecap="round"
                                            r={radius}
                                            cx={28}
                                            cy={28}
                                            className="transition-all duration-500"
                                          />
                                        </svg>
                                        <span className="absolute text-[10px] font-black text-[#1D4ED8] font-mono">{pm.homePct.toFixed(0)}%</span>
                                      </div>
                                      <span className="text-[9px] font-bold text-[#1D4ED8] uppercase truncate max-w-[75px]" title={hTeam}>
                                        Home ({pm.homePct.toFixed(1)}%)
                                      </span>
                                    </div>

                                    {/* Center: VS Indicator */}
                                    <div className="flex flex-col items-center justify-center">
                                      <span className="text-[10px] font-mono font-bold text-slate-400">VS</span>
                                    </div>

                                    {/* Right: Away Team Donut Chart */}
                                    <div className="flex flex-col items-center gap-1">
                                      <div className="relative flex items-center justify-center">
                                        <svg height={56} width={56} className="transform -rotate-90">
                                          <circle stroke="#e2e8f0" fill="transparent" strokeWidth={stroke} r={radius} cx={28} cy={28} />
                                          <circle
                                            stroke="#10b981"
                                            fill="transparent"
                                            strokeWidth={stroke}
                                            strokeDasharray={`${circumference} ${circumference}`}
                                            style={{ strokeDashoffset: awayDashOffset }}
                                            strokeLinecap="round"
                                            r={radius}
                                            cx={28}
                                            cy={28}
                                            className="transition-all duration-500"
                                          />
                                        </svg>
                                        <span className="absolute text-[10px] font-black text-emerald-600 font-mono">{pm.awayPct.toFixed(0)}%</span>
                                      </div>
                                      <span className="text-[9px] font-bold text-emerald-600 uppercase truncate max-w-[75px]" title={aTeam}>
                                        Away ({pm.awayPct.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bottom Section: Center-Labeled Detailed Metric List */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2 shadow-sm">
                          <div className="text-xs font-extrabold text-[#0A2342] uppercase tracking-wider border-b border-slate-200 pb-2 mb-3 font-display flex items-center justify-between">
                            <span className="text-[#1D4ED8] font-bold">{hTeam} (Home)</span>
                            <span className="text-slate-400 font-mono text-[10px]">DETAILED NUMERIC LIST</span>
                            <span className="text-emerald-600 font-bold">{aTeam} (Away)</span>
                          </div>
                          <div className="divide-y divide-slate-200/60">
                            {detailedMetricList.map((m) => (
                              <div key={m.label} className="grid grid-cols-3 items-center py-2 text-xs font-sans hover:bg-slate-100/60 px-2 rounded-lg transition-colors">
                                {/* Left Column: Home Team Data */}
                                <div className="text-left font-bold text-[#1D4ED8]">
                                  {m.homeVal}
                                </div>
                                {/* Center Column: Metric Label */}
                                <div className="text-center font-extrabold text-slate-600 text-[11px] uppercase tracking-wider font-mono">
                                  {m.label}
                                </div>
                                {/* Right Column: Away Team Data */}
                                <div className="text-right font-bold text-emerald-600">
                                  {m.awayVal}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()
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
