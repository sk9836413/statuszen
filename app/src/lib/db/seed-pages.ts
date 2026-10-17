/**
 * Default content pages created on install. Buyers edit them from
 * Admin → Pages. `{site_name}` and `{site_email}` are replaced when rendered.
 */
export const DEFAULT_PAGES = [
  {
    slug: "about",
    title: "About Us",
    metaDescription: "Learn more about {site_name} and how we help teams stay online.",
    content: `## Who we are

{site_name} watches your websites, APIs, servers, SSL certificates, domains and scheduled jobs, and tells you the moment something breaks.

## Why monitoring matters

Every minute of downtime costs sales and trust. With checks every minute, confirmed alerts and a public status page, you find problems before your customers do and keep them informed while you fix them.

## Contact

Questions or ideas? [Get in touch](/contact) — we read every message.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaDescription: "Read how {site_name} collects, uses and protects your information.",
    content: `## Overview

This Privacy Policy explains how {site_name} ("we", "us") handles information when you use our website, our dashboard and the public status pages our customers publish.

## Information about our customers

When you create an account we store your name, email address and a securely hashed password. If you buy a plan, payments are processed by the payment provider; we do not store card numbers.

## Monitoring data

To monitor your services we store the addresses you enter and the results of each check (response time, status code and error message). Individual check results are deleted after a retention period; daily uptime summaries are kept so we can show your history.

## Status page subscribers

Visitors can subscribe to incident updates on a status page. We send a confirmation email first; sign-ups that are not confirmed are deleted after 7 days. Every update email contains an unsubscribe link.

## Cookies

We use a session cookie to keep you signed in and a cookie for your language choice. Public status pages do not use tracking cookies.

## Contact

For privacy questions contact us at {site_email}.`,
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    metaDescription: "The terms that apply when you use {site_name}.",
    content: `## Acceptance

By creating an account or using {site_name} you agree to these terms.

## Your account

Keep your login details safe. You are responsible for activity on your account.

## Acceptable use

Only monitor services you own or are allowed to monitor. Do not use {site_name} to overload, scan or attack other systems. We may suspend accounts that break these rules.

## Plans and payments

Paid plans renew or expire according to the billing period you chose. Plan limits (monitors, check interval and status pages) are shown on the pricing page.

## No guarantee

Monitoring reduces the time it takes to notice problems but cannot guarantee that every outage is detected. The service is provided "as is" without warranties of any kind.

## Changes

We may update these terms. Continued use after changes means you accept the new terms.

## Contact

Questions about these terms? Write to {site_email}.`,
  },
];
