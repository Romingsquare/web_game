import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Upsert a player's high score if their current radius beats the stored one.
 * Table: scores (username text unique, high_score int, updated_at timestamp)
 * @param {string} username
 * @param {number} radius
 */
export async function saveHighScore(username, radius) {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'your_supabase_url_here') return;

  const score = Math.round(radius);

  const { error } = await supabase
    .from('scores')
    .upsert(
      { username, high_score: score, updated_at: new Date().toISOString() },
      {
        onConflict:        'username',
        ignoreDuplicates:  false,
      }
    )
    .lt('high_score', score); // only upsert if new score is higher

  if (error) console.error('[supabase] saveHighScore error:', error.message);
}

/**
 * Fetch the all-time top 10 by high_score.
 * @returns {Promise<Array<{username: string, high_score: number}>>}
 */
export async function getAllTimeTop10() {
  if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL === 'your_supabase_url_here') return [];

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
}
