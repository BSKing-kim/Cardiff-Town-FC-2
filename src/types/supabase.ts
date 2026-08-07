export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string | null
          player_id: string | null
          full_name: string | null
          username: string | null
          role: string | null
          position: string | null
          preferred_foot: string | null
          nationality: string | null
          squad_number: string | number | null
          status: string | null
          is_onboarded: boolean | null
          onboarding_completed: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          player_id?: string | null
          full_name?: string | null
          username?: string | null
          role?: string | null
          position?: string | null
          preferred_foot?: string | null
          nationality?: string | null
          squad_number?: string | number | null
          status?: string | null
          is_onboarded?: boolean | null
          onboarding_completed?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          player_id?: string | null
          full_name?: string | null
          username?: string | null
          role?: string | null
          position?: string | null
          preferred_foot?: string | null
          nationality?: string | null
          squad_number?: string | number | null
          status?: string | null
          is_onboarded?: boolean | null
          onboarding_completed?: boolean | null
          created_at?: string | null
        }
      }
      teams: {
        Row: {
          id: string
          team_name: string
          division: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          team_name: string
          division?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          team_name?: string
          division?: string | null
          created_at?: string | null
        }
      }
      fixtures: {
        Row: {
          id: string
          match_date?: string | null
          home_team?: string | null
          away_team?: string | null
          division?: string | null
          venue?: string | null
          match_type?: string | null
          home_score?: number | null
          away_score?: number | null
          status?: string | null
          created_at?: string | null
          competition?: string | null
          opponent?: string | null
          ourScore?: number | null
          oppScore?: number | null
          date?: string | null
          [key: string]: any
        }
        Insert: {
          id?: string
          match_date?: string | null
          home_team?: string | null
          away_team?: string | null
          division?: string | null
          venue?: string | null
          match_type?: string | null
          home_score?: number | null
          away_score?: number | null
          status?: string | null
          created_at?: string | null
          competition?: string | null
          opponent?: string | null
          ourScore?: number | null
          oppScore?: number | null
          date?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          match_date?: string | null
          home_team?: string | null
          away_team?: string | null
          division?: string | null
          venue?: string | null
          match_type?: string | null
          home_score?: number | null
          away_score?: number | null
          status?: string | null
          created_at?: string | null
          competition?: string | null
          opponent?: string | null
          ourScore?: number | null
          oppScore?: number | null
          date?: string | null
          [key: string]: any
        }
      }
      match_logs: {
        Row: {
          id: string
          match_id: string | null
          team_id: string
          player_id: string
          player_name: string
          goals: number | null
          shots: number | null
          shot_on_target: number | null
          passes: number | null
          completed_passes: number | null
          duels: number | null
          duels_won: number | null
          tackles: number | null
          tackles_won: number | null
          interceptions: number | null
          clearances: number | null
          recoveries: number | null
          fouls: number | null
          was_fouled: number | null
          yellow_card: number | null
          red_card: number | null
          assists: number | null
          key_passes: number | null
          crosses: number | null
          completed_crosses: number | null
          dribbles: number | null
          successful_dribbles: number | null
          created_at: string | null
          [key: string]: any
        }
        Insert: {
          id?: string
          match_id?: string | null
          team_id?: string
          player_id?: string
          player_name?: string
          goals?: number | null
          shots?: number | null
          shot_on_target?: number | null
          passes?: number | null
          completed_passes?: number | null
          duels?: number | null
          duels_won?: number | null
          tackles?: number | null
          tackles_won?: number | null
          interceptions?: number | null
          clearances?: number | null
          recoveries?: number | null
          fouls?: number | null
          was_fouled?: number | null
          yellow_card?: number | null
          red_card?: number | null
          assists?: number | null
          key_passes?: number | null
          crosses?: number | null
          completed_crosses?: number | null
          dribbles?: number | null
          successful_dribbles?: number | null
          created_at?: string | null
          [key: string]: any
        }
        Update: {
          id?: string
          match_id?: string | null
          team_id?: string
          player_id?: string
          player_name?: string
          goals?: number | null
          shots?: number | null
          shot_on_target?: number | null
          passes?: number | null
          completed_passes?: number | null
          duels?: number | null
          duels_won?: number | null
          tackles?: number | null
          tackles_won?: number | null
          interceptions?: number | null
          clearances?: number | null
          recoveries?: number | null
          fouls?: number | null
          was_fouled?: number | null
          yellow_card?: number | null
          red_card?: number | null
          assists?: number | null
          key_passes?: number | null
          crosses?: number | null
          completed_crosses?: number | null
          dribbles?: number | null
          successful_dribbles?: number | null
          created_at?: string | null
          [key: string]: any
        }
      }
      matches: {
        Row: { id: string; [key: string]: any }
        Insert: { id?: string; [key: string]: any }
        Update: { id?: string; [key: string]: any }
      }
      players: {
        Row: { id: string; [key: string]: any }
        Insert: { id?: string; [key: string]: any }
        Update: { id?: string; [key: string]: any }
      }
      player_match_records: {
        Row: { id: string; matchId?: string; [key: string]: any }
        Insert: { id?: string; matchId?: string; [key: string]: any }
        Update: { id?: string; matchId?: string; [key: string]: any }
      }
      heatmaps: {
        Row: { id: string; matchId?: string; playerId?: string; [key: string]: any }
        Insert: { id?: string; matchId?: string; playerId?: string; [key: string]: any }
        Update: { id?: string; matchId?: string; playerId?: string; [key: string]: any }
      }
      custom_teams: {
        Row: { id: string; [key: string]: any }
        Insert: { id?: string; [key: string]: any }
        Update: { id?: string; [key: string]: any }
      }
      users: {
        Row: { id: string; [key: string]: any }
        Insert: { id?: string; [key: string]: any }
        Update: { id?: string; [key: string]: any }
      }
      applications: {
        Row: { id: string; [key: string]: any }
        Insert: { id?: string; [key: string]: any }
        Update: { id?: string; [key: string]: any }
      }
      settings: {
        Row: { id: string; piPreset?: string; kpiPreset?: string; [key: string]: any }
        Insert: { id?: string; piPreset?: string; kpiPreset?: string; [key: string]: any }
        Update: { id?: string; piPreset?: string; kpiPreset?: string; [key: string]: any }
      }
      profile_update_requests: {
        Row: {
          id: string
          user_id: string
          player_name: string | null
          requested_changes: Json
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          player_name?: string | null
          requested_changes: Json
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          player_name?: string | null
          requested_changes?: Json
          status?: string
          created_at?: string | null
        }
      }
    }
  }
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type TeamRow = Database['public']['Tables']['teams']['Row']
export type FixtureRow = Database['public']['Tables']['fixtures']['Row']
export type MatchLogRow = Database['public']['Tables']['match_logs']['Row']
