import { createClient } from "@supabase/supabase-js";
import { Database } from "../types/supabase";

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || "https://mmxxaltyolhhnunvurtn.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1teHhhbHR5b2xoaG51bnZ1cnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2NzEwNzcsImV4cCI6MjEwMTI0NzA3N30.IXmwG_IYSJoEgRmAw02QtHmSIM1a31yOE94hoIjBxHo";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
