import type { Briefs } from "./briefs";

type Entry = Omit<Briefs, "source">;

const FALLBACKS: Entry[] = [
  {
    product: { name: "HushDesk", price: "$149", tagline: "A foldable desk divider that kills open-office noise." },
    seller:
      "HushDesk is a foldable acoustic divider that clamps to any desk in ten seconds. Three layers of recycled felt cut chatter by about 60%. Folds flat to fit a laptop bag, ships in 3 days, 30-day return. Works for open offices, shared homes and coworking spaces. Teams of 10 or more get 15% off.",
    buyer:
      "You are Dana, ops manager at a 40-person startup in an open-plan office. Budget: $1,000 total this quarter for 'comfort items'. You already gave out noise-cancelling headphones and people barely use them. Objections: the price per desk adds up, you doubt felt panels look professional, and you fear it blocks collaboration. You would buy if the seller offers a team discount and a trial for one pilot team.",
  },
  {
    product: { name: "PantryPilot", price: "$12/month", tagline: "An app that plans dinners from what is already in your fridge." },
    seller:
      "PantryPilot scans your receipts and fridge photos, then suggests three dinners a night using what you already own. Families waste about $1,500 of food a year; users report cutting that in half. Works with any grocery store, syncs across the household, free for 14 days.",
    buyer:
      "You are Marcus, a dad of three who cooks most nights. Budget: you already pay for two subscriptions and want to cut, not add. You currently use a notes app and habit. Objections: another monthly fee, taking photos feels like a chore, you doubt the recipes suit picky kids. You would buy if it clearly saves more than it costs in the first month.",
  },
  {
    product: { name: "SteadyCam Mini", price: "$89", tagline: "A pocket gimbal for smooth phone video." },
    seller:
      "SteadyCam Mini is a 180 g, three-axis phone gimbal that folds into a jacket pocket. Eight hours of battery, one-tap follow mode, and a magnetic mount that attaches in a second. Great for travel vlogs and small business videos. Two-year warranty and free shipping.",
    buyer:
      "You are Priya, who runs a small bakery's Instagram. Budget: $60, maybe $80 if convinced. You film with a phone on a stack of flour bags and the footage is shaky. Objections: gadgets end up in a drawer, you worry about a learning curve, cheaper options exist online. You would buy if you can see it working in under a minute and returns are easy.",
  },
  {
    product: { name: "LedgerLeaf", price: "$29/month", tagline: "Bookkeeping that categorizes itself for freelancers." },
    seller:
      "LedgerLeaf connects to your bank, auto-categorizes expenses with 95% accuracy and builds quarterly tax estimates. Invoices, receipts and mileage live in one place. Freelancers save about five hours a month. Cancel anytime, export everything to CSV, 30-day money back.",
    buyer:
      "You are Tomás, a freelance designer who handles books in a spreadsheet. Budget: $20 a month at most. Objections: you do not trust apps with bank access, switching costs time you do not have, your accountant already uses another tool. You would buy if the security story is solid and your accountant can access it for free.",
  },
  {
    product: { name: "BrightBox Lunch", price: "$24", tagline: "A self-heating lunch box that keeps food hot for four hours." },
    seller:
      "BrightBox Lunch heats meals to 65 °C using a USB-C rechargeable battery and keeps them warm for four hours. Leak-proof, dishwasher-safe stainless steel tray, fits a standard backpack. Replaces the office microwave queue. Two colors, free returns.",
    buyer:
      "You are Helen, a nurse who rarely gets a full lunch break. Budget: $30. You currently eat cold sandwiches. Objections: you worry about battery safety near patients, you need it cleanable in seconds, past 'smart' lunch boxes broke within months. You would buy if the warranty is generous and the safety certification is real.",
  },
  {
    product: { name: "TrailTag", price: "$39", tagline: "A tiny GPS tag for kids' backpacks and dog collars." },
    seller:
      "TrailTag is a 20 g GPS tracker with a one-year battery and no monthly fee within the country. Shows location on a phone map, alerts when it leaves a set area, waterproof to one meter. Pairs in two minutes. Sold in packs of two.",
    buyer:
      "You are Greg, who hikes weekly with a very escape-prone dog. Budget: $50. Objections: 'no monthly fee' sounds too good, you have lost trackers before, coverage in the mountains is doubtful. You would buy if the seller is honest about limits and offers a refund if it fails on your next hike.",
  },
  {
    product: { name: "QuietCompass", price: "$600/year", tagline: "Meeting notes and action items for small teams, automatically." },
    seller:
      "QuietCompass joins your calls, writes the notes, extracts action items and posts them to your task tracker. Setup takes five minutes. Teams of up to 15 pay a flat $600 a year. Data stays encrypted and is deleted after 30 days if you choose. Free pilot for one team.",
    buyer:
      "You are Aisha, head of product at a 25-person company. Budget: $1,000 for tools this year, already committed to $400. Objections: privacy of customer calls, inaccurate notes causing confusion, people may stop paying attention in meetings. You would buy if legal sign-off is easy and a pilot proves accuracy.",
  },
  {
    product: { name: "ThreadBare Socks", price: "$18 per 3 pairs", tagline: "Merino socks that last five years or get replaced free." },
    seller:
      "ThreadBare socks are 70% merino with reinforced heels and toes. They stay odor-free for days and dry fast. If any pair wears out in five years, we replace it free. Subscription optional, skip any month. Made in small batches by a family mill.",
    buyer:
      "You are Ken, a practical person who buys cheap socks in bulk. Budget: you spend about $3 a pair. Objections: $6 a pair feels silly, you lose socks to the dryer anyway, a lifetime guarantee needs paperwork. You would buy if replacement is truly one click and you can start with one pack.",
  },
  {
    product: { name: "SolarSill", price: "$79", tagline: "A window-ledge solar charger for phones and earbuds." },
    seller:
      "SolarSill sits on a sunny windowsill and charges a phone in about four hours of daylight. It has a 10,000 mAh battery for cloudy days, USB-C in and out, and a slim profile that suction-cups to glass. Cuts standby charging and keeps a backup ready during outages.",
    buyer:
      "You are Olivia, a renter in a north-facing apartment with limited sun. Budget: $50. You already own a regular power bank. Objections: little direct sunlight, the savings are tiny, suction cups fall off. You would buy if it works well indoors and is clearly better than your power bank.",
  },
  {
    product: { name: "CoachLoop", price: "$199/seat", tagline: "AI role-play practice for customer support teams." },
    seller:
      "CoachLoop lets support agents practice angry-customer calls with a realistic AI, then scores empathy, clarity and resolution. Managers see team progress weekly. Agents get ten minutes of practice a day. Pilots show 18% higher satisfaction scores in a month. Minimum five seats.",
    buyer:
      "You are Raj, support director for a 60-agent team. Budget: $5,000 this half, mostly spoken for. You run live role-play sessions that agents dislike. Objections: AI may feel fake, agents will not use it voluntarily, hard to prove ROI to finance. You would buy if a five-seat pilot has clear success metrics and no long contract.",
  },
  {
    product: { name: "PetPulse Bowl", price: "$99", tagline: "A smart bowl that tracks how much your pet eats and drinks." },
    seller:
      "PetPulse Bowl weighs every meal and sip, spots changes early and alerts your vet-friendly app when appetite drops. Stainless steel, dishwasher-safe, battery lasts three months. Works for cats and small dogs. Includes a free monthly health summary.",
    buyer:
      "You are Sofia, owner of an elderly cat with kidney issues. Budget: $100 if it helps medically. Objections: your cat is picky and may refuse a new bowl, you worry about false alarms, you want your vet to accept the data. You would buy if the seller can show vet endorsement and offers a trial.",
  },
];

/** Hand-written briefs used when OpenRouter fails, so a round never starts without briefs. */
export function fallbackBriefs(): Briefs {
  return { ...FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]!, source: "fallback" };
}

export const FALLBACK_COUNT = FALLBACKS.length;
