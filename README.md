# SwapSkills

Teach what you know, learn what you need — peer skill exchange with matching, rooms, doubts, battles, invites, Skill DNA, and an aptitude coach across Engineering / Arts & Science / Languages.

## How to publish this to your GitHub Pages link

1. Open your repo `sanjay9500935281-sketch/skill-right` on github.com.
2. Delete the old files (or just drag these new ones in — they'll overwrite anything with the same name).
3. Drag **all the files and folders from this zip** into the repo (keep the folder structure: `index.html`, `css/`, `js/`, `assets/`).
4. Commit. Your link `https://sanjay9500935281-sketch.github.io/skill-right/` updates automatically in a minute or two.

## What works right now

Everything in the app works **live between two browser tabs on the same device** — open the site in two tabs (or two windows), sign in as two different Gmail addresses, and:

- Add skills (Engineering / Arts & Science / Languages, mark Teach or Learn)
- See real match % between the two accounts, recalculated from actual overlapping skills
- Create a room → get a code → join from the other tab → the room owner gets an Accept/Decline prompt
- Once accepted, both sides pick what they're teaching, then land in a live **Teach & Learn** screen — "you teach X" / "you learn Y" for both sides, a doubts chat, and an "Ask AI" helper
- Battle each other — same 5 questions, live score, an AI-style recommendation on your weakest topic
- Invite link (`?ref=your@gmail.com`) — anyone who signs in through it shows up in your Invite tab's friend list
- Skill DNA score with a Recalculate button, based on real activity (skills added, sessions taught, battles played/won, connections made)
- Aptitude coach with 50 questions each in Engineering, Arts & Science, and Languages, split into topics, with no immediate repeats

## The one limitation: two different devices

Right now this runs on `localStorage`, which only exists inside one browser on one device. So your phone and your friend's laptop **won't** see each other yet — GitHub Pages can't store shared data by itself, it only serves files.

To make it work across real devices, follow these steps once, then send me the config:

1. Go to **console.firebase.google.com**, sign in, click **Add project**, name it anything (e.g. `skill-right`), skip Google Analytics, create it.
2. In the left menu: **Build → Firestore Database → Create database → Start in test mode**.
3. **Project settings** (gear icon) → **Your apps** → click the **`</>`** web icon → register an app (no need to check Hosting).
4. Copy the `firebaseConfig = { ... }` block it shows you.
5. Send me that config. I'll swap the internals of `js/db.js` to read/write Firestore instead of `localStorage` — nothing else in the app changes, because every function in `db.js` already returns a Promise.

Test mode leaves the database open for 30 days; once you send the config I'll also give you a short security-rules snippet so strangers can't spam it.

## File map

```
index.html          — page shell, loads everything
css/style.css        — all styling
js/db.js             — data layer (localStorage today, swap for Firebase later)
js/app.js            — all app logic and screens
assets/questions.js  — the 150-question aptitude bank (50 × 3 categories)
```
