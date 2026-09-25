# Small Start

A calm, installable Pomodoro-style focus timer designed to make starting easier. No account, analytics, streak pressure, or build step.

## Features

- Adjustable focus, short-break, and long-break intervals (25/5/15 minutes by default); a two-minute start option.
- Wall-clock-based timer that survives refreshes and background tabs. Focus keeps counting as `+MM:SS` bonus time after zero, with pause, reset, and a manual **Take break** action; breaks still stop at zero. A long break follows four completed focus rounds.
- One small next-action field, a parking lot for distracting thoughts, and a 60-second pause before an impulsive scroll.
- Optional completion sound and notifications while the page is running; offline shell, installable manifest, local fonts and icons, and responsive layout.
- State is stored in this browser's `localStorage`, on this device only. Clearing site data erases it.
- Light and dark themes follow the device setting automatically; no theme preference is stored.

## Run locally

```bash
npm start
```

Open <http://127.0.0.1:4173>. Run `npm test` for timer unit tests. The PWA requires localhost or HTTPS for service workers; opening `index.html` directly as a file is not the intended mode.

## Install

On a supported browser, open the site over HTTPS, then choose **Install app** / **Add to Home Screen** from the browser menu. iPhone users can use Safari’s Share → Add to Home Screen. Notifications are opt-in. The app uses service-worker notifications while its timer JavaScript is running, but iOS can suspend it in the background and no notification will arrive when the app is closed. Reliable background completion alerts require a server to send Web Push to an installed Home Screen app; GitHub Pages alone cannot do that. This app cannot block distracting websites or other apps; use your device’s app limits and notification settings for stronger boundaries.

## Why these strategies?

CHADD recommends writing specific actions and breaking large tasks into smaller steps.[1] NICE describes reducing environmental distractions and using shorter focus periods with movement breaks as possible ADHD adjustments.[2] NIMH lists established ADHD treatment options including medication and psychosocial interventions; this timer is a self-management aid, not treatment.[3] The Pomodoro durations, two-minute launch, and 60-second pause are flexible product choices, **not** evidence-backed ADHD-specific dosages. “Dopamine detox” is not claimed here.

## Sources

[1] https://chadd.org/for-adults/time-management-and-adhd — CHADD — Time Management and ADHD: To-Do Lists
[2] https://www.nice.org.uk/guidance/ng87/chapter/recommendations — NICE ADHD guideline NG87
[3] https://www.nimh.nih.gov/health/topics/attention-deficit-hyperactivity-disorder-adhd — NIMH — ADHD overview
