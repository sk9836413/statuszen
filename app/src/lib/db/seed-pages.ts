/**
 * Default content pages created on install. Buyers edit them from
 * Admin → Pages. `{site_name}` and `{site_email}` are replaced when rendered.
 */
export const DEFAULT_PAGES = [
  {
    slug: "about",
    title: "About Us",
    metaDescription: "Learn more about {site_name} and how we help websites turn visitors into customers.",
    content: `## Who we are

{site_name} helps businesses show real social proof on their websites: recent purchases and signups, live visitor counts, reviews and testimonials, coupons, countdowns and lead capture.

## Why social proof works

People trust what other people do. Showing genuine activity and honest reviews helps new visitors decide with confidence, and it helps you convert more of the traffic you already have.

## Real data only

Our widgets are built to display real events from your store, forms and apps. We encourage every customer to use social proof honestly.

## Contact

Questions or ideas? [Get in touch](/contact) — we read every message.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaDescription: "Read how {site_name} collects, uses and protects your information.",
    content: `## Overview

This Privacy Policy explains how {site_name} ("we", "us") handles information when you use our website, our dashboard and the widgets our customers place on their websites.

## Information about our customers

When you create an account we store your name, email address and a securely hashed password. If you buy a plan, payments are processed by the payment provider; we do not store card numbers.

## Information processed through widgets

Our customers decide which widgets run on their websites. Depending on their settings, widgets may process:

- a random visitor identifier stored in the visitor's browser, used to count views and live visitors (no names, no cross-site tracking);
- the first name, city and product of purchases or signups sent by the customer's store, forms or apps, shown in notifications according to the customer's privacy setting;
- email addresses entered into an email collector, and testimonials submitted through a collection page.

Our customers are responsible for informing their own visitors and obtaining any required consent. We process this information on their behalf and only to provide the service.

## Cookies and local storage

We use a session cookie to keep you signed in and a cookie for your language choice. Widgets use the visitor's browser storage to remember closed widgets and the anonymous visitor identifier.

## Data retention

Account data is kept while your account is active. Customers can delete events, testimonials, leads and whole websites from their dashboard at any time.

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

Keep your login details safe. You are responsible for activity on your account and for the websites you add to it.

## Acceptable use

You may only display truthful information. Do not use {site_name} to show fake purchases, fake reviews or misleading counts, to collect data unlawfully, or to send spam. We may suspend accounts that break these rules or applicable consumer-protection laws.

## Plans and payments

Paid plans renew or expire according to the billing period you chose. Plan limits (websites, widgets and monthly widget views) are shown on the pricing page. When you reach your monthly view limit, widgets pause until the next month or until you upgrade.

## Availability

We work hard to keep the service fast and available, but it is provided "as is" without warranties of any kind.

## Changes

We may update these terms. Continued use after changes means you accept the new terms.

## Contact

Questions about these terms? Write to {site_email}.`,
  },
];
