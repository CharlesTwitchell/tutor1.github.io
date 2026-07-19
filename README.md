# Steady Focus Tutoring — website

A 7-page starter site for an ADHD tutoring business: Home, About, Contact, Blog (Substack-synced), Forum, Tutor Bot, and a Course Portal.

## Files
```
index.html      Home
about.html      About you
contact.html    Contact form
blog.html       Blog synced from Substack
forum.html      Community forum (demo)
chatbot.html    Tutor Bot (demo)
portal.html     Course portal (demo)
css/style.css   Shared design system
js/*.js         Page logic (nav, contact form, blog sync, forum, chatbot, portal)
```

## First things to customize
1. **Name & brand** — search every file for "Steady Focus Tutoring" and "[Your Name]" and replace with your real business/tutor name.
2. **about.html** — replace the placeholder photo box, story, and credentials.
3. **contact.html** — replace the placeholder email/phone.
4. **Colors/fonts** — all defined at the top of `css/style.css` under `:root` if you want to adjust the palette.

## What works out of the box
- All 7 pages, navigation, and responsive layout.
- The blog page will show real Substack posts as soon as you set your feed URL (see below) — no manual copy-pasting needed after that.

## What's a working demo and needs one more step for production

**Contact form** (`contact.html` / `js/contact.js`)
Currently shows a confirmation message but doesn't send anywhere. Sign up for a free plan at Formspree, Basin, or Getform, and point the fetch call in `js/contact.js` at your endpoint.

**Blog / Substack sync** (`blog.html` / `js/blog.js`)
Set `SUBSTACK_URL` in `js/blog.js` to your real Substack address. The page fetches your public RSS feed through the free rss2json.com proxy and renders your latest posts automatically. If you'd rather avoid a third-party proxy, a small server-side fetch (a few lines in any backend) does the same job without it.

**Forum** (`forum.html` / `js/forum.js`)
A working demo forum — posting a new thread updates the page live, but nothing is saved, since there's no database yet. Two realistic paths:
- **Fastest:** embed a hosted community tool (Discourse, Flarum, Circle, Mighty Networks) and link to it from your nav instead.
- **Custom:** add a lightweight backend (Supabase or Firebase are both good free-tier options) so posts and accounts persist.
Either way, plan for basic moderation before opening it to the public.

**Tutor Bot** (`chatbot.html` / `js/chatbot.js`)
A scripted demo so you can see the interaction, not a live AI model. To make it real:
1. Write your tutoring style as a system prompt (the textarea on the page is a good starting draft).
2. Stand up a small backend endpoint (a serverless function is enough) that takes the student's message, sends your style instructions + their message to the Claude API, and returns the reply.
3. Point the front-end fetch call at that endpoint.
**Important:** never put your Anthropic API key directly in front-end code like these HTML/JS files — anyone viewing the page source could read it. It has to live on a server you control. See docs.claude.com for the exact request format.

**Course portal** (`portal.html` / `js/portal.js`)
A working catalog demo — added courses show up live but aren't saved, and the file picker doesn't actually upload video. Two realistic paths:
- **Fastest:** host videos on Vimeo (with domain-restricted privacy) or YouTube (unlisted), and use this page as a catalog that embeds each player.
- **Full control:** use a course platform (Teachable, Thinkific, Kajabi) for hosting, drip content, and student logins, and link to it from here.
If you want logins and progress-tracking on your own site specifically, that needs real user accounts — a developer can add this with Supabase/Firebase Auth.

## Hosting
This is a static site — any of these work well and have free tiers: Netlify, Vercel, GitHub Pages, Cloudflare Pages. Upload the whole folder (keeping the `css/` and `js/` subfolders) and point your domain at it.
