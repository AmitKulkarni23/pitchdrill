import type { Briefs } from "./briefs";

// Used when OpenRouter is down or not configured, so a round never starts without briefs.
export const FALLBACK_BRIEFS: Omit<Briefs, "source">[] = [
  {
    product: { name: "QuietDesk Pods", price: "$129", tagline: "Noise-cancelling earbuds built for open offices" },
    seller: "QuietDesk Pods are earbuds tuned for open-plan offices. Benefits: adaptive noise cancelling that blocks chatter but lets your name through, 10-hour battery for a full workday, and a mic that filters keyboard noise on calls. Price: $129 with a 2-year warranty. Proof: a 40-person design agency cut 'focus time interrupted' complaints by half in a month.",
    buyer: "You are a team lead at a 60-person startup in an open office. Budget: up to $100 per person, and finance hates new line items. You currently let people bring their own headphones. Objections: 'People already own AirPods', 'Is this really a company expense?', 'What if people lose them?'. You could be convinced by a team discount, a pilot for a few people, or proof it improves focus.",
  },
  {
    product: { name: "ShiftPilot", price: "$4/employee/month", tagline: "Staff scheduling that fills open shifts by text" },
    seller: "ShiftPilot schedules hourly staff and fills open shifts automatically by texting qualified people. Benefits: builds a week's schedule in minutes, swaps happen without the manager, and overtime alerts before it happens. Price: $4 per employee per month, no setup fee. Proof: a 12-location café chain saved 6 manager hours a week per store.",
    buyer: "You own three restaurants with 45 hourly staff. Budget: about $150 a month total. You schedule with a shared spreadsheet and a group chat. Objections: 'My staff won't learn another app', 'Group chat is free', 'I tried a scheduling tool before and it was clunky'. You'd change your mind for a free trial, no app required for staff, or a clear overtime saving.",
  },
  {
    product: { name: "BrewCycle", price: "$24/month", tagline: "Fresh cold brew concentrate delivered every two weeks" },
    seller: "BrewCycle delivers cold brew concentrate brewed within 48 hours, every two weeks. Benefits: café-quality coffee at home for about $1.50 a cup, recyclable glass bottles picked up on delivery, pause or skip anytime. Price: $24 a month. Proof: 4.8 stars from 3,000 subscribers; most say they stopped their daily café run.",
    buyer: "You are a remote worker who spends about $5 a day at a café, mostly for the walk. Budget: you'd like to spend less, but not on another subscription. You own a cheap drip machine. Objections: 'I already have too many subscriptions', 'Cold brew in winter?', 'What if I'm travelling?'. You'd consider it if skipping is truly easy and the per-cup maths is clearly better.",
  },
  {
    product: { name: "VaultNest Family", price: "$60/year", tagline: "A password manager your whole family will actually use" },
    seller: "VaultNest Family is a password manager for up to six people. Benefits: shared vaults for streaming and utility logins, one-tap autofill on every device, and emergency access if something happens to you. Price: $60 a year for the whole family. Proof: independently audited every year; families report saving an hour a month on 'what's the Wi-Fi password' moments.",
    buyer: "You are a parent of two teenagers who reuse the same three passwords everywhere. Budget: $5 a month at most. You currently use the browser's saved passwords and a notebook. Objections: 'If it gets hacked, everything is gone', 'My kids won't use it', 'The browser already does this'. You'd be swayed by a clear security story and something genuinely easy for teenagers.",
  },
  {
    product: { name: "LiftLite Desk Converter", price: "$219", tagline: "Turn any desk into a standing desk in 10 seconds" },
    seller: "LiftLite sits on your existing desk and raises your monitor and keyboard to standing height with a gas spring. Benefits: no assembly, no power cable, fits two monitors, and moves in 10 seconds. Price: $219 with free returns for 60 days. Proof: used by 200+ companies' remote-work stipends; 91% still use it daily after three months.",
    buyer: "You are an accountant working from home with back pain from sitting. Budget: your company gives a $250 home-office stipend once a year. You currently stack books under your laptop. Objections: 'I'll stop using it after a week', 'Will my monitor wobble?', 'A full standing desk might be better'. You'd change your mind with a long free return window and proof it's stable.",
  },
  {
    product: { name: "InvoiceHound", price: "$19/month", tagline: "Polite, automatic reminders that get freelancers paid" },
    seller: "InvoiceHound connects to your invoicing tool and sends polite, escalating payment reminders for you. Benefits: gets paid on average 11 days faster, keeps the client relationship friendly, and shows who always pays late. Price: $19 a month, cancel anytime. Proof: users recovered an average of $2,300 in overdue invoices in their first 90 days.",
    buyer: "You are a freelance designer with eight regular clients; two always pay late. Budget: tight; you watch every subscription. You chase payments yourself by email. Objections: 'Automated reminders feel pushy', 'I only have two late payers', 'My invoicing tool has reminders'. You'd buy if it clearly pays for itself and you can control the tone.",
  },
  {
    product: { name: "GreenTile Solar Roof Audit", price: "$0 audit, $8k–$14k install", tagline: "Find out in a week what solar would save you" },
    seller: "GreenTile does a free drone audit of your roof and gives a fixed quote for solar in a week. Benefits: savings estimate from your real bills, financing from $0 down, and a 25-year production guarantee. Price: the audit is free; installs run $8k–$14k before incentives. Proof: average customer's payback is 7 years, with 1,800 installs in the state.",
    buyer: "You own a house with a $180 monthly electricity bill and plan to stay five more years. Budget: you won't take on new debt right now. You've had two pushy solar calls this year. Objections: 'I might move before it pays back', 'Financing is a trap', 'Your quote will change later'. You'd listen to a fixed, no-obligation quote and resale-value evidence.",
  },
  {
    product: { name: "PawTrack Mini", price: "$39 + $3/month", tagline: "A GPS tag for cats and small dogs that lasts a week" },
    seller: "PawTrack Mini is a 12-gram GPS tag for cats and small dogs. Benefits: live location on your phone, a week of battery, and an alert when your pet leaves a safe zone you draw. Price: $39 for the tag plus $3 a month for the cellular plan. Proof: helped owners find 4,000+ lost pets last year, most within an hour.",
    buyer: "You have an indoor-outdoor cat who disappears for a day at a time. Budget: happy to spend once, dislike monthly fees. You currently use a collar with your phone number. Objections: 'A monthly fee for a cat?', 'It'll fall off', 'Bluetooth tags are cheaper'. You'd be convinced by a breakaway-collar safety story and a clear difference from Bluetooth tags.",
  },
  {
    product: { name: "MeetingMinder AI", price: "$12/user/month", tagline: "Notes, decisions and action items from every call" },
    seller: "MeetingMinder joins your video calls and sends notes, decisions and action items within a minute of hanging up. Benefits: nobody takes notes, action items land in your task tool, and a search across every past meeting. Price: $12 per user per month. Proof: teams report 30 minutes a week saved per person and fewer 'what did we decide?' threads.",
    buyer: "You run operations for a 25-person agency. Budget: you just cut two tools to save money. Notes are taken by whoever remembers. Objections: 'Clients won't want a bot recording', 'Our video tool has AI notes now', 'Security review will take months'. You'd be swayed by a client-friendly consent flow and a per-seat price for only the people who need it.",
  },
  {
    product: { name: "KettleBell Club Box", price: "$45/month", tagline: "A home gym kit that grows with you, plus live classes" },
    seller: "KettleBell Club sends an adjustable kettlebell and adds new equipment every quarter, with live 20-minute classes daily. Benefits: no commute to the gym, coaching that adapts to your level, and equipment you keep. Price: $45 a month, 12-month minimum. Proof: members work out 3.2 times a week on average, versus 1.5 for gym members.",
    buyer: "You are a new parent who hasn't been to the gym in a year. Budget: you're paying $35 a month for a gym membership you don't use. Objections: 'A 12-month contract is scary', 'I won't have space', 'I'll stop like I stopped the gym'. You'd consider it with a shorter commitment or if the classes fit nap time.",
  },
];
