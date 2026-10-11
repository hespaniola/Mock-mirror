# Mirror (working name)

A voice friend that talks with you for two minutes every morning and evening and reminds you who you are, in your own words.

This is a clickable prototype. It has no backend, no accounts and no API keys, and keeps everything in `localStorage`.

## Run

```bash
npm install
npm run dev        # serves on your LAN too, so you can open it on your phone
```

On a phone, speech recognition usually needs HTTPS. Use a Vercel preview, or a tunnel such as `npx localtunnel --port 5173`.

## Deploy (Vercel)

1. Push the repo and import it in Vercel. It auto-detects Vite (build `npm run build`, output `dist`).
2. Open the URL on your phone and choose **Add to Home Screen**. It installs as a full-screen PWA.

Or from the CLI: `npx vercel`.

## Demo tips

- **Settings → Time of day** switches between the morning and evening flows at any hour.
- **Settings → Add demo history** fills the streak view.
- **Settings → Voice → Silent** shows captions only, which is useful in meetings.
- Tap the orb or the captions while the friend is talking to skip ahead.

## Where things live

| File | What |
| --- | --- |
| `src/lib/friend.ts` | `getFriendReply(context)`: every line the friend says. Swap this for a real AI. |
| `src/lib/voice.ts` | Speech in/out, caption timing, the signal the orb reacts to |
| `src/lib/store.ts` | localStorage data, days, streaks, demo data |
| `src/components/Session.tsx` | The conversation runner shared by onboarding, morning, evening and fog |
| `src/components/Orb.tsx` | WebGL orb (shader) that flies between screens |
| `src/components/screens.tsx` | Rest, History, Settings |
