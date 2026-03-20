# Supabase Setup Guide

This guide will help you set up Supabase for high score tracking in Car Arena.

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Create a new project
3. Wait for the project to be provisioned (~2 minutes)

## Step 2: Create the Scores Table

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Paste the following SQL and click **Run**:

```sql
-- Create scores table
CREATE TABLE scores (
  username TEXT PRIMARY KEY,
  high_score INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_scores_high_score ON scores(high_score DESC);

-- Enable Row Level Security
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read scores
CREATE POLICY "Allow public read access"
  ON scores
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow anyone to insert/update scores
CREATE POLICY "Allow public insert/update access"
  ON scores
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
```

## Step 3: Get Your Credentials

1. Go to **Project Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (the long string under "Project API keys")

## Step 4: Update Environment Variables

### For Local Development (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### For Railway Deployment
1. Go to your Railway project
2. Click on **Variables** tab
3. Add these variables:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon key

## Step 5: Test

1. Restart your server
2. Play the game and get killed
3. Check Supabase dashboard → **Table Editor** → **scores**
4. You should see your username and score saved!

## Troubleshooting

### "permission denied for table scores"
- Make sure you ran the RLS policies in Step 2
- Check that RLS is enabled: `ALTER TABLE scores ENABLE ROW LEVEL SECURITY;`
- Verify policies exist in **Authentication** → **Policies**

### Scores not saving
- Check Railway logs for Supabase errors
- Verify environment variables are set correctly
- Make sure SUPABASE_URL starts with `https://`

### Old scores not updating
- The upsert logic only updates if the new score is higher
- Check the `updated_at` timestamp to see when it was last updated
