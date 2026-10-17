/** Starter blog posts created on install (Admin → Blog). Markdown. */
export const DEFAULT_POSTS = [
  {
    slug: "what-is-uptime-monitoring",
    title: "What is uptime monitoring and why every website needs it",
    excerpt: "Your customers notice downtime before you do — unless something is watching for you. Here is how uptime monitoring works.",
    metaDescription: "Learn how uptime monitoring works, which checks you need for websites, APIs and servers, and how to avoid false alarms.",
    content: `## The problem

Websites go down for many reasons: an expired certificate, a full disk, a broken deploy, a DNS change. Without monitoring, you usually hear about it from an angry customer.

## How uptime monitoring works

A monitoring service requests your website or API from the outside at a fixed interval — for example every minute — and checks the answer:

- **Status code**: did the server answer with 200 OK?
- **Content**: does the page still contain the text you expect?
- **Speed**: did it answer fast enough?

When a check fails, it is repeated to confirm the problem. Only then are you alerted, so a single network blip doesn't wake you up.

## Which checks you need

1. **HTTP checks** for your website and API endpoints.
2. **Keyword checks** for pages that can return "200 OK" while showing an error.
3. **SSL and domain expiry** so nothing expires by surprise.
4. **Heartbeat checks** for cron jobs and backups that run in the background.

## Tell your customers

A public status page shows what's working and what isn't. It reduces support tickets during an incident and builds trust the rest of the time.`,
  },
  {
    slug: "monitor-cron-jobs-with-heartbeats",
    title: "How to monitor cron jobs and backups with heartbeats",
    excerpt: "A failed backup is silent until you need it. Heartbeat monitoring tells you the moment a scheduled job stops running.",
    metaDescription: "Use heartbeat (dead man's switch) monitoring to get alerted when cron jobs, backups and scheduled tasks stop running.",
    content: `## Silent failures

Cron jobs, backups and queue workers don't have a URL you can check. When they stop, nothing happens — until you discover a week of missing backups.

## The heartbeat pattern

Give each job a unique ping URL. At the end of every successful run, the job calls that URL:

\`\`\`bash
0 3 * * * /usr/local/bin/backup.sh && curl -fsS https://status.example.com/api/ping/YOUR_TOKEN
\`\`\`

If the ping doesn't arrive within the expected interval plus a grace period, you get an alert.

## Report failures and duration

- Call \`/start\` when the job begins and the normal URL when it ends to measure how long it takes.
- Call \`/fail\` from your error handler to be alerted immediately.

## Good practices

- Set the grace period a little longer than the job's normal run time.
- Use one heartbeat per job, so the alert tells you exactly what broke.
- Add heartbeats to your status page only for jobs customers care about.`,
  },
  {
    slug: "incident-communication-status-page",
    title: "Incident communication: what to post on your status page",
    excerpt: "Clear, timely updates turn an outage into a moment of trust. A simple template for every stage of an incident.",
    metaDescription: "A practical guide to writing status page updates during an incident: investigating, identified, monitoring and resolved.",
    content: `## Post early

The first update matters most. As soon as you know something is wrong, post that you are **investigating**. Customers don't need the cause yet — they need to know you are on it.

## A simple template

1. **Investigating** – "We're seeing errors on checkout and are looking into it."
2. **Identified** – "The cause is a failed database update. We're rolling it back."
3. **Monitoring** – "A fix is in place. We're watching to make sure it holds."
4. **Resolved** – "Everything is working normally. We're sorry for the trouble."

## Keep a rhythm

Update every 30 minutes during a major outage, even if nothing changed. Silence feels worse than "still working on it".

## Plan maintenance

Announce planned maintenance a few days ahead, with the start and end time in your customers' time zone, and let subscribers get an email.`,
  },
];
