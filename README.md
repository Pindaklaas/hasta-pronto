# Hasta Pronto

A small shared app for two people in a long-distance relationship (Netherlands ⇄ Mexico):
countdown with both local times and weather, a daily question you both answer, "thinking of you"
hearts, sealed letters that open when the countdown ends, a jar of notes picked by feeling,
a bucket list, treat delivery details and games to play together.

- Static site served by GitHub Pages (`index.html`, no build step).
- Data and login: Supabase (`config.js`, `supabase/schema.sql`).
- Weather: Open-Meteo (free, no key).

Add it to your phone's home screen from Safari (Share → Add to Home Screen) or Chrome (⋮ → Add to Home screen).

## Phone notifications

When someone sends a heart, the app calls the Supabase Edge Function `notify`
(`supabase/functions/notify/index.ts`), which pushes a notification to the other
person's phone. Each phone turns it on with the 🔔 link under the heart; on iPhone
this only works from the home-screen app. The function makes its own push key pair
on first use and keeps it in `public.push_keys` (see the end of `supabase/schema.sql`).
