const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { renderBlogPost } = require('./blogTemplate');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'financelab.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS visit_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    affiliation TEXT,
    visit_type TEXT,
    preferred_date TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    teaser TEXT NOT NULL,
    body_md TEXT NOT NULL,
    cta_text TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    date_label TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    image_path TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_images (
    key TEXT PRIMARY KEY,
    image_path TEXT,
    image_pos_x INTEGER NOT NULL DEFAULT 50,
    image_pos_y INTEGER NOT NULL DEFAULT 50,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const eventColumns = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
if (!eventColumns.includes('image_pos_x')) {
  db.exec('ALTER TABLE events ADD COLUMN image_pos_x INTEGER NOT NULL DEFAULT 50');
}
if (!eventColumns.includes('image_pos_y')) {
  db.exec('ALTER TABLE events ADD COLUMN image_pos_y INTEGER NOT NULL DEFAULT 50');
}

const BLOG_CONTENT_DIR = process.env.BLOG_CONTENT_DIR || path.join(__dirname, '..', 'blog-content');

const SEED_POSTS = [
  {
    slug: 'bloomberg-terminal-access',
    title: 'Bloomberg Terminal Access',
    teaser: 'Hands-on time on a professional-grade terminal — the same tool used across trading floors and research desks.',
    cta_text: 'Want to get hands-on time on the terminal?',
    body_md: `The Bloomberg Terminal is the centerpiece of the IBA Finance Lab. It's the same system that analysts, portfolio managers, and traders rely on at banks and asset managers around the world — and it's the single biggest gap between classroom finance and the way markets are actually followed in practice.

## What students actually do on the terminal
Rather than treating the terminal as a novelty, the lab builds structured exercises around it so students leave with skills they can point to, not just exposure.

- Pulling real-time and historical pricing for equities, fixed income, and FX to support coursework in Investments and Portfolio Management
- Building company comparables and pulling analyst estimates for valuation assignments
- Tracking news flow and macro data alongside price action to connect events to market moves
- Practicing the terminal's function-based workflow, which is a distinct skill from spreadsheet-based analysis

## Why it matters for recruiting
Familiarity with Bloomberg is often assumed, not taught, in entry-level finance roles. Students who have logged real hours on the terminal — not just read about it — come into interviews and internships with a concrete answer to "have you used Bloomberg before?"

## Who can access it
Terminal access is available to SBS students enrolled in Investments, Portfolio Management, and Financial Valuation courses, with faculty able to reserve time for class sessions or research. Corporate partners and prospective students can request a guided walkthrough as well.`,
  },
  {
    slug: 'real-time-market-data',
    title: 'Real-Time Market Data',
    teaser: 'Live pricing across equities, fixed income, and FX feeds classroom exercises and independent research.',
    cta_text: 'Curious what live market data looks like in a classroom setting?',
    body_md: `A textbook can explain how a yield curve or an equity risk premium behaves. It can't show you one moving. The lab's real-time data feeds put live, continuously updating prices from equities, fixed income, and FX markets directly in front of students — closing the gap between the theory taught in lectures and the way those same concepts actually behave in the market on any given day.

## Where this shows up in coursework

- Investments courses use live equity pricing to test CAPM and factor-model assumptions against what's actually happening in the market that week
- Portfolio Management exercises track intraday and historical price series to build and rebalance sample portfolios
- Financial Valuation assignments pull current fixed income yields and FX rates to keep discount rate and currency assumptions grounded in live data rather than stale textbook figures

## Why real-time, not delayed, data matters
Delayed or historical-only data teaches students to analyze the past. Real-time feeds teach them to reason under the same uncertainty a market participant faces — prices that move while you're still forming a view. That distinction is one of the more difficult things to build intuition for, and it's very hard to teach without live data in the room.

## Getting access
Market data access runs through the lab's terminal workstations and is available to students enrolled in relevant SBS courses, with faculty able to build data-driven exercises into class sessions.`,
  },
  {
    slug: 'virtual-trading-accounts',
    title: 'Virtual Trading Accounts',
    teaser: 'Demo brokerage accounts let students execute and track trades without risking real capital.',
    cta_text: 'Want a demo account set up for your class or research project?',
    body_md: `Reading about a stop-loss order and placing one are two different skills. The lab's demo brokerage accounts, accessible through the SimTrader platform, let students execute real order types against live-like markets — buying, shorting, hedging, rebalancing — without a single rupee of real capital on the line.

## What the demo accounts are used for

- Building and actively managing a sample portfolio over a semester for Portfolio Management coursework
- Practicing order types — market, limit, stop-loss — and seeing firsthand how execution differs from the theory
- Testing valuation calls from Financial Valuation assignments by actually taking a position and tracking the outcome
- Running trading competitions and simulations tied to lab events

## Why the stakes matter — even simulated ones
A virtual account still carries a tracked P&L, a running position, and a decision that plays out over time. That's enough to make the exercise feel consequential, which is what separates "I understand diversification" from actually having rebalanced a portfolio after a position moved against you.

## Getting access
Demo trading accounts are available to SBS students enrolled in relevant courses. Access is arranged through the lab, and the SimTrader platform itself is reachable directly for enrolled students.`,
  },
];

const postCount = db.prepare('SELECT COUNT(*) AS n FROM blog_posts').get().n;
if (postCount === 0) {
  fs.mkdirSync(BLOG_CONTENT_DIR, { recursive: true });
  const insert = db.prepare(`
    INSERT INTO blog_posts (slug, title, teaser, body_md, cta_text)
    VALUES (@slug, @title, @teaser, @body_md, @cta_text)
  `);
  for (const post of SEED_POSTS) {
    insert.run(post);
    fs.writeFileSync(path.join(BLOG_CONTENT_DIR, `${post.slug}.html`), renderBlogPost(post));
  }
}

const SEED_EVENTS = [
  { category: 'Inauguration', date_label: 'Spring 2024', title: 'Bloomberg Terminal Unveiled at Finance Lab Inauguration', excerpt: 'SBS marked the launch of the Finance Lab with the installation of a Bloomberg Terminal, joined by senior guests from Habib Bank and the State Bank of Pakistan.' },
  { category: 'Partnership', date_label: 'Fall 2023', title: 'SBS Signs MOU with HBL', excerpt: 'The agreement establishes the Finance Lab as a joint initiative, giving students access to real-time market data and demo trading infrastructure.' },
  { category: 'Workshop', date_label: 'Feb 2025', title: 'Live Terminal Walkthrough: Reading the Market in Real Time', excerpt: 'A hands-on session on pulling company financials, comparables, and news flow directly from the Bloomberg Terminal.' },
  { category: 'Guest Session', date_label: 'Nov 2025', title: 'Corporate Connect: Careers in Equity Research', excerpt: 'Practitioners from local brokerage houses discussed how terminal-based research translates into buy-side and sell-side roles.' },
  { category: 'Workshop', date_label: 'Jan 2026', title: 'Faculty Seminar: Price-Sensitivity in Frontier Markets', excerpt: 'Faculty presented ongoing research on how local news events move security prices, using data drawn from the lab.' },
  { category: 'Partnership', date_label: 'Aug 2025', title: 'Demo Trading Accounts Open for New Cohort', excerpt: 'Newly enrolled Investments students received demo brokerage credentials for simulated trading exercises.' },
];

const eventCount = db.prepare('SELECT COUNT(*) AS n FROM events').get().n;
if (eventCount === 0) {
  const insertEvent = db.prepare(`
    INSERT INTO events (category, date_label, title, excerpt)
    VALUES (@category, @date_label, @title, @excerpt)
  `);
  for (const event of SEED_EVENTS) {
    insertEvent.run(event);
  }
}

const SITE_IMAGE_KEYS = [
  'hero-1', 'hero-2', 'hero-3',
  'partner', 'terminal',
  'facility-1', 'facility-2', 'facility-3', 'facility-4',
];

const SEED_SITE_IMAGE_PATHS = {
  'hero-1': 'assets/images/car-1.jpg',
  'hero-2': 'assets/images/car-2.jpg',
  'hero-3': 'assets/images/car-3.jpg',
};

const siteImageCount = db.prepare('SELECT COUNT(*) AS n FROM site_images').get().n;
if (siteImageCount === 0) {
  const insertSiteImage = db.prepare(`
    INSERT INTO site_images (key, image_path) VALUES (@key, @image_path)
  `);
  for (const key of SITE_IMAGE_KEYS) {
    insertSiteImage.run({ key, image_path: SEED_SITE_IMAGE_PATHS[key] || null });
  }
}

db.SITE_IMAGE_KEYS = SITE_IMAGE_KEYS;
module.exports = db;
