import { createClient } from '@supabase/supabase-js';

let supabase = null;
let supabaseEnabled = false;

// Initialize Supabase client
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && 
    process.env.SUPABASE_URL !== 'your_supabase_url_here') {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    supabaseEnabled = true;
    console.log('[supabase] Connected successfully');
  } catch (err) {
    console.error('[supabase] Failed to initialize:', err.message);
  }
} else {
  console.log('[supabase] Not configured - high scores disabled. See SUPABASE_SETUP.md');
}

/**
 * Upsert a player's high score if their current score beats the stored one.
 * Table: scores (username text unique, high_score int, updated_at timestamp)
 * @param {string} username
 * @param {number} score
 */
export async function saveHighScore(username, score) {
  if (!supabaseEnabled) return;

  const highScore = Math.round(score);

  try {
    // First, check if user exists and their current high score
    const { data: existing } = await supabase
      .from('scores')
      .select('high_score')
      .eq('username', username)
      .single();

    // Only update if new score is higher or user doesn't exist
    if (!existing || highScore > existing.high_score) {
      const { error } = await supabase
        .from('scores')
        .upsert(
          { username, high_score: highScore, updated_at: new Date().toISOString() },
          { onConflict: 'username' }
        );

      if (error) {
        if (error.message.includes('permission')) {
          console.error('[supabase] PERMISSION ERROR - Please run the SQL setup from SUPABASE_SETUP.md');
          console.error('[supabase] You need to enable RLS policies for the scores table');
        } else {
          console.error('[supabase] saveHighScore error:', error.message);
        }
      } else {
        console.log(`[supabase] Saved high score for ${username}: ${highScore}`);
      }
    }
  } catch (err) {
    console.error('[supabase] saveHighScore exception:', err.message);
  }
}

/**
 * Fetch the all-time top 10 by high_score.
 * @returns {Promise<Array<{username: string, high_score: number}>>}
 */
export async function getAllTimeTop10() {
  if (!supabaseEnabled) return [];

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('username, high_score')
      .order('high_score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[supabase] getAllTimeTop10 error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[supabase] getAllTimeTop10 exception:', err.message);
    return [];
  }
}
