import React, { useState, useEffect, useRef } from "react";
import { DataService } from "../lib/dataService";
import { ExcelUtils } from "../lib/excelUtils";
import { HeatmapPoint, Player } from "../types";
import { Map, RefreshCw, Upload, Download, ArrowRight, Layers, Eye, Compass, Move } from "lucide-react";

interface MatchHeatmapProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
}

export const MatchHeatmap: React.FC<MatchHeatmapProps> = ({ matchId, homeTeam, awayTeam }) => {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [filteredPoints, setFilteredPoints] = useState<HeatmapPoint[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("All");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [layout, setLayout] = useState<"Horizontal" | "Vertical">("Vertical");
  const [dimensions, setDimensions] = useState({ width: 350, height: 546 });
  
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [playersList, setPlayersList] = useState<Player[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pitchContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadHeatmapData = async () => {
    try {
      const [allPoints, allPlayers] = await Promise.all([
        DataService.getHeatmapPoints(matchId),
        DataService.getPlayers()
      ]);
      setPoints(allPoints);
      setPlayersList(allPlayers);
    } catch (e) {
      console.error("Error loading heatmap data:", e);
    }
  };

  useEffect(() => {
    loadHeatmapData();
  }, [matchId]);

  useEffect(() => {
    let filtered = points;
    if (selectedTeam !== "All") {
      filtered = filtered.filter(p => p.teamId.toLowerCase() === selectedTeam.toLowerCase());
    }
    if (selectedPlayer !== "All") {
      filtered = filtered.filter(p => p.playerId === selectedPlayer);
    }
    if (selectedType !== "All") {
      filtered = filtered.filter(p => p.type?.toLowerCase() === selectedType.toLowerCase());
    }
    setFilteredPoints(filtered);
  }, [points, selectedTeam, selectedPlayer, selectedType]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);
    try {
      const res = await ExcelUtils.parseHeatmapExcel(file);
      if (res.validRecords && res.validRecords.length > 0) {
        // Associate coordinates with active match ID
        const finalRecords = res.validRecords.map(r => ({
          ...r,
          matchId: matchId
        }));
        await DataService.saveHeatmapPoints(finalRecords);
        await loadHeatmapData();
        setUploadStatus({
          success: true,
          message: `Successfully uploaded ${finalRecords.length} coordinates for this match!`
        });
      } else {
        setUploadStatus({
          success: false,
          message: "No valid coordinate records found in file. Ensure columns [Match ID], [Team ID], and [Player ID] are present."
        });
      }
    } catch (err: any) {
      setUploadStatus({
        success: false,
        message: err?.message || "Parsing coordinates file failed."
      });
    } finally {
      setUploading(false);
    }
  };

  // Convert raw bottom-right coordinates [0, 60] to vertical percentage coordinates [0, 100]
  const getVertCoords = (x: number, y: number) => {
    return {
      x: ((60 - x) / 60) * 100,
      y: ((60 - y) / 60) * 100
    };
  };

  // Convert raw bottom-right coordinates [0, 60] to horizontal percentage coordinates [0, 100] (90deg clockwise rotation)
  const getHorizCoords = (x: number, y: number) => {
    return {
      x: (y / 60) * 100,
      y: ((60 - x) / 60) * 100
    };
  };

  // Setup ResizeObserver for responsive canvas scaling
  useEffect(() => {
    if (!pitchContainerRef.current) return;
    
    const handleResize = () => {
      if (pitchContainerRef.current) {
        setDimensions({
          width: pitchContainerRef.current.clientWidth,
          height: pitchContainerRef.current.clientHeight
        });
      }
    };
    
    handleResize();
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(pitchContainerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [layout]);

  // Canvas Heatmap Drawing algorithm (Pixel-level alpha intensity mapping)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const activityPoints = filteredPoints.filter(p => !p.type || p.type.toLowerCase() === "activity");
    if (activityPoints.length === 0) return;

    const isHorizontal = layout === "Horizontal";

    // Create offscreen canvas for intensity drawing
    const offscreen = document.createElement("canvas");
    offscreen.width = dimensions.width;
    offscreen.height = dimensions.height;
    const oCtx = offscreen.getContext("2d");
    if (!oCtx) return;

    // Radius of blur adaptively sized
    const radius = Math.max(16, Math.min(48, dimensions.width * 0.12));

    activityPoints.forEach(p => {
      const coords = isHorizontal 
        ? getHorizCoords(p.startX, p.startY)
        : getVertCoords(p.startX, p.startY);
      
      const px = (coords.x / 100) * dimensions.width;
      const py = (coords.y / 100) * dimensions.height;

      const gradient = oCtx.createRadialGradient(px, py, 0, px, py, radius);
      gradient.addColorStop(0, "rgba(0, 0, 0, 1.0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      oCtx.fillStyle = gradient;
      oCtx.beginPath();
      oCtx.arc(px, py, radius, 0, Math.PI * 2);
      oCtx.fill();
    });

    const imgData = oCtx.getImageData(0, 0, dimensions.width, dimensions.height);
    const data = imgData.data;

    // Beautiful continuous soccer heatmap gradient (Green -> Yellow -> Orange -> Red)
    const getColor = (intensity: number) => {
      if (intensity < 10) return { r: 0, g: 0, b: 0, a: 0 };
      
      let r = 0, g = 0, b = 0, a = 0;
      
      if (intensity < 50) {
        // Low density: Soft greenish-yellow
        const ratio = (intensity - 10) / 40;
        r = Math.floor(60 + 60 * ratio);
        g = Math.floor(160 + 40 * ratio);
        b = Math.floor(40 * (1 - ratio));
        a = Math.floor(0.2 * ratio * 255);
      } else if (intensity < 110) {
        // Mid density: Bright yellow
        const ratio = (intensity - 50) / 60;
        r = Math.floor(120 + 135 * ratio);
        g = Math.floor(200 + 30 * ratio);
        b = 0;
        a = Math.floor((0.2 + 0.35 * ratio) * 255);
      } else if (intensity < 180) {
        // High density: Warm orange
        const ratio = (intensity - 110) / 70;
        r = 255;
        g = Math.floor(230 - 110 * ratio);
        b = 0;
        a = Math.floor((0.55 + 0.25 * ratio) * 255);
      } else {
        // Max density: Solid intense red
        const ratio = (intensity - 180) / 75;
        r = 255;
        g = Math.floor(120 * (1 - ratio));
        b = 0;
        a = Math.floor((0.8 + 0.15 * ratio) * 255);
      }

      return { r, g, b, a };
    };

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        const color = getColor(alpha);
        data[i] = color.r;
        data[i + 1] = color.g;
        data[i + 2] = color.b;
        data[i + 3] = color.a;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }, [filteredPoints, dimensions, layout]);

  const isHorizontal = layout === "Horizontal";

  // Football Pitch Visualizer Dimensions
  const renderPitch = () => {
    const baseColor = "bg-[#1E3A20]"; // Rich deep green turf grass

    if (isHorizontal) {
      return (
        <div ref={pitchContainerRef} className={`relative w-full aspect-[100/64] ${baseColor} border-4 border-white rounded-lg overflow-hidden shadow-inner`}>
          {/* Halfway line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/75 -translate-x-1/2" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 w-[18%] aspect-square rounded-full border-2 border-white/75 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />

          {/* Left Penalty Area */}
          <div className="absolute top-[18%] bottom-[18%] left-0 w-[16.5%] border-r-2 border-y-2 border-white/75" />
          <div className="absolute top-[35%] bottom-[35%] left-0 w-[5.5%] border-r-2 border-y-2 border-white/75" />
          {/* Left Penalty Spot & Arc */}
          <div className="absolute top-1/2 left-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-y-1/2" />
          <div className="absolute top-[37%] bottom-[37%] left-[16.5%] w-[8%] border-r-2 border-y-2 rounded-r-full border-white/30 border-l-0 clip-arc-left" />

          {/* Right Penalty Area */}
          <div className="absolute top-[18%] bottom-[18%] right-0 w-[16.5%] border-l-2 border-y-2 border-white/75" />
          <div className="absolute top-[35%] bottom-[35%] right-0 w-[5.5%] border-l-2 border-y-2 border-white/75" />
          {/* Right Penalty Spot & Arc */}
          <div className="absolute top-1/2 right-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-y-1/2" />

          {/* Canvas for Activity Heatmap overlay */}
          <canvas 
            ref={canvasRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          />

          {/* Render Vector Elements */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            {/* Markers */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#D4AF37" />
              </marker>
              <marker id="arrow-pass" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B82F6" />
              </marker>
              <marker id="arrow-shot" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
              </marker>
              <marker id="arrow-cross" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
              </marker>
            </defs>

            {/* Vectors (Arrows for Pass, Shot, Goal, Cross, Clearance) */}
            {filteredPoints.map((p, idx) => {
              const pType = p.type?.toLowerCase() || "";
              if (pType === "activity") return null;

              let strokeColor = "#3B82F6"; // Pass: Blue
              let markerId = "arrow-pass";
              if (pType === "shot") {
                strokeColor = "#F59E0B"; // Shot: Orange
                markerId = "arrow-shot";
              } else if (pType === "goal") {
                strokeColor = "#EF4444"; // Goal: Red
                markerId = "arrow-shot";
              } else if (pType === "cross") {
                strokeColor = "#10B981"; // Cross: Emerald
                markerId = "arrow-cross";
              } else if (pType === "clearance") {
                strokeColor = "#A855F7"; // Clearance: Purple
                markerId = "arrow";
              }

              const startCoords = getHorizCoords(p.startX, p.startY);
              const endCoords = getHorizCoords(p.endX ?? p.startX, p.endY ?? p.startY);
              const sx = startCoords.x;
              const sy = startCoords.y;
              const ex = endCoords.x;
              const ey = endCoords.y;

              return (
                <g key={`vector-${idx}`}>
                  {/* Action Vector Line */}
                  <line 
                    x1={sx} 
                    y1={sy} 
                    x2={ex} 
                    y2={ey} 
                    stroke={strokeColor} 
                    strokeWidth="1.2" 
                    strokeDasharray={pType === "pass" ? "1,1" : "none"}
                    markerEnd={`url(#${markerId})`} 
                  />
                  {/* Origin Circle */}
                  <circle cx={sx} cy={sy} r="1.5" fill={strokeColor} />
                </g>
              );
            })}
          </svg>
        </div>
      );
    } else {
      // Vertical Pitch Layout
      return (
        <div ref={pitchContainerRef} className={`relative w-full max-w-sm mx-auto aspect-[64/100] ${baseColor} border-4 border-white rounded-lg overflow-hidden shadow-inner`}>
          {/* Halfway line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/75 -translate-y-1/2" />
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 w-[28%] aspect-square rounded-full border-2 border-white/75 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-white -translate-x-1/2 -translate-y-1/2" />

          {/* Top Penalty Area */}
          <div className="absolute left-[18%] right-[18%] top-0 h-[16.5%] border-b-2 border-x-2 border-white/75" />
          <div className="absolute left-[35%] right-[35%] top-0 h-[5.5%] border-b-2 border-x-2 border-white/75" />
          {/* Top Penalty Spot */}
          <div className="absolute left-1/2 top-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-x-1/2" />

          {/* Bottom Penalty Area */}
          <div className="absolute left-[18%] right-[18%] bottom-0 h-[16.5%] border-t-2 border-x-2 border-white/75" />
          <div className="absolute left-[35%] right-[35%] bottom-0 h-[5.5%] border-t-2 border-x-2 border-white/75" />
          {/* Bottom Penalty Spot */}
          <div className="absolute left-1/2 bottom-[11%] w-1.5 h-1.5 rounded-full bg-white -translate-x-1/2" />

          {/* Canvas for Activity Heatmap overlay */}
          <canvas 
            ref={canvasRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            className="absolute inset-0 w-full h-full pointer-events-none z-10" 
          />

          {/* Render Vector Elements */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <marker id="arrow-v" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#D4AF37" />
              </marker>
              <marker id="arrow-pass-v" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B82F6" />
              </marker>
              <marker id="arrow-shot-v" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
              </marker>
              <marker id="arrow-cross-v" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
              </marker>
            </defs>

            {/* Vectors */}
            {filteredPoints.map((p, idx) => {
              const pType = p.type?.toLowerCase() || "";
              if (pType === "activity") return null;

              let strokeColor = "#3B82F6";
              let markerId = "arrow-pass-v";
              if (pType === "shot") {
                strokeColor = "#F59E0B";
                markerId = "arrow-shot-v";
              } else if (pType === "goal") {
                strokeColor = "#EF4444";
                markerId = "arrow-shot-v";
              } else if (pType === "cross") {
                strokeColor = "#10B981";
                markerId = "arrow-cross-v";
              } else if (pType === "clearance") {
                strokeColor = "#A855F7";
                markerId = "arrow-v";
              }

              const startCoords = getVertCoords(p.startX, p.startY);
              const endCoords = getVertCoords(p.endX ?? p.startX, p.endY ?? p.startY);
              const sx = startCoords.x;
              const sy = startCoords.y;
              const ex = endCoords.x;
              const ey = endCoords.y;

              return (
                <g key={`vector-v-${idx}`}>
                  <line 
                    x1={sx} 
                    y1={sy} 
                    x2={ex} 
                    y2={ey} 
                    stroke={strokeColor} 
                    strokeWidth="1.2" 
                    strokeDasharray={pType === "pass" ? "1,1" : "none"}
                    markerEnd={`url(#${markerId})`} 
                  />
                  <circle cx={sx} cy={sy} r="1.5" fill={strokeColor} />
                </g>
              );
            })}
          </svg>
        </div>
      );
    }
  };

  return (
    <div className="space-y-4 font-sans" ref={containerRef}>
      {/* Upload & Template Utility Row */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-3xs">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-[#0A2342] flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-[#1D4ED8]" />
            Heatmap Coordinate Matrix
          </h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Upload XY tracking coordinate files for player actions. Values are normalized dynamically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download XY Template */}
          <button
            onClick={() => ExcelUtils.downloadHeatmapTemplate()}
            className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold py-1.5 px-3 transition-colors cursor-pointer border border-slate-700"
            title="Download Heatmap Tracking CSV/Excel Template"
          >
            <Download className="h-3 w-3" />
            <span>XY Template</span>
          </button>

          {/* Upload Button */}
          <label className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold py-1.5 px-3 rounded shadow-md transition-colors cursor-pointer border border-cyan-500">
            {uploading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            <span>{uploading ? "Uploading..." : "Upload Heatmap"}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Pitch Matrix Settings Info Badge */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-slate-300">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-cyan-400" />
          <div>
            <span className="font-bold text-white">System Coordinate Configuration:</span>
            <span className="ml-1 text-slate-400">Starting Point (Bottom Right), X: 0-60, Y: 0-60 | Field: Football, Orientation: Portrait | Map Size: 30x30 Grid (Columns/Rows)</span>
          </div>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[9px] font-bold uppercase font-mono">Verified Active</span>
      </div>

      {uploadStatus && (
        <div className={`text-[11px] font-mono border rounded-lg p-2.5 flex items-center justify-between gap-1 animate-slideDown ${
          uploadStatus.success ? "bg-emerald-950 text-emerald-200 border-emerald-800" : "bg-rose-950 text-rose-200 border-rose-800"
        }`}>
          <span>{uploadStatus.message}</span>
          <button onClick={() => setUploadStatus(null)} className="text-[9px] uppercase font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Interactive Controls Toolbar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        {/* Team Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => {
              setSelectedTeam(e.target.value);
              setSelectedPlayer("All");
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
          >
            <option value="All">All Teams</option>
            <option value="ctfc">Cardiff Town FC</option>
            <option value="Opponent">Opponent</option>
          </select>
        </div>

        {/* Player Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Player</label>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
          >
            <option value="All">All Players</option>
            {playersList
              .filter(p => selectedTeam === "All" || selectedTeam === "ctfc")
              .map(p => (
                <option key={p.id} value={p.id}>#{p.backNumber} - {p.name}</option>
              ))
            }
          </select>
        </div>

        {/* Action Type Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Event Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
          >
            <option value="All">All Types</option>
            <option value="Pass">Pass</option>
            <option value="Shot">Shot</option>
            <option value="Goal">Goal</option>
            <option value="Cross">Cross</option>
            <option value="Clearance">Clearance</option>
            <option value="Activity">Activity Heatmap</option>
          </select>
        </div>

        {/* Orientation Toggle */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Layout</label>
          <div className="flex rounded border border-slate-800 overflow-hidden text-xs">
            <button
              onClick={() => setLayout("Horizontal")}
              className={`flex-1 py-1 text-center font-bold ${layout === "Horizontal" ? "bg-cyan-600 text-white" : "bg-slate-950 text-slate-400 hover:bg-slate-800"}`}
            >
              Horiz
            </button>
            <button
              onClick={() => setLayout("Vertical")}
              className={`flex-1 py-1 text-center font-bold ${layout === "Vertical" ? "bg-cyan-600 text-white" : "bg-slate-950 text-slate-400 hover:bg-slate-800"}`}
            >
              Vert
            </button>
          </div>
        </div>

        {/* Reset Filters */}
        <div className="col-span-2 md:col-span-1 flex items-end">
          <button
            onClick={() => {
              setSelectedTeam("All");
              setSelectedPlayer("All");
              setSelectedType("All");
              setLayout("Horizontal");
            }}
            className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold rounded py-1 px-3 text-xs flex items-center justify-center gap-1 shadow-sm cursor-pointer h-[28px]"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Summary Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-900 text-white rounded-lg px-4 py-2 text-[10px] font-mono font-bold shadow-sm">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Pass (Vector)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Shot (Vector)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Goal (Vector)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Cross (Vector)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          Clearance (Vector)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" />
          Activity Density
        </span>
      </div>

      {/* Pitch Canvas Container */}
      <div className="p-3 bg-slate-800 rounded-2xl flex flex-col justify-center items-center shadow-lg relative min-h-[220px]">
        {filteredPoints.length === 0 ? (
          <div className="text-center p-8 space-y-2">
            <Layers className="h-8 w-8 text-slate-400 mx-auto opacity-75" />
            <p className="text-xs text-slate-300 font-bold">No coordinate logs found for active filters.</p>
            <p className="text-[10px] text-slate-400">Download the XY template above, map your tracking coordinates, and upload them to begin visualising.</p>
          </div>
        ) : (
          <div className="w-full relative">
            {renderPitch()}
            <div className="absolute bottom-2 right-2 text-[9px] font-mono font-bold text-white/50 bg-black/40 px-1.5 py-0.5 rounded">
              {filteredPoints.length} tracking points loaded
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
