const fs = require("fs");

const README = "README.md";

const markers = {
  spotify: "SPOTIFY-WIDGET",
  wakatime: "WAKATIME-STATS",
  discord: "DISCORD-PRESENCE",
  leetcode: "LEETCODE-STATS",
  blog: "BLOG-POST-LIST",
};

const placeholders = {
  spotify: `<p align="center">
  <img src="./assets/placeholders/spotify.svg" alt="Spotify widget placeholder" width="520" />
</p>`,
  wakatime: `<p align="center">
  <img src="./assets/placeholders/wakatime.svg" alt="WakaTime stats placeholder" width="620" />
</p>`,
  discord: `<p align="center">
  <img src="./assets/placeholders/discord.svg" alt="Discord presence placeholder" width="520" />
</p>`,
  leetcode: `<p align="center">
  <img src="./assets/placeholders/leetcode.svg" alt="LeetCode stats placeholder" width="520" />
</p>`,
  blog: `<p align="center">
  <img src="./assets/placeholders/blog.svg" alt="Blog feed placeholder" width="620" />
</p>`,
};

function env(name) {
  return (process.env[name] || "").trim();
}

function replaceBlock(readme, marker, content) {
  const start = `<!-- ${marker}:START -->`;
  const end = `<!-- ${marker}:END -->`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);

  if (!pattern.test(readme)) {
    throw new Error(`Missing README marker: ${marker}`);
  }

  return readme.replace(pattern, `${start}\n${content}\n${end}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMarkdown(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .trim();
}

async function imageUrlIsRenderable(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "github-profile-readme-widget-updater",
      },
      signal: AbortSignal.timeout(15000),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().startsWith("image/")) {
      console.warn(
        `Using Spotify placeholder: ${url} returned ${response.status} ${contentType || "unknown content type"}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Using Spotify placeholder: ${error.message}`);
    return false;
  }
}

async function spotifyWidget() {
  const uid = env("SPOTIFY_UID");
  if (!uid) return placeholders.spotify;

  const url = new URL("https://spotify-github-profile.kittinanx.com/api/view");
  url.searchParams.set("uid", uid);
  url.searchParams.set("cover_image", "true");
  url.searchParams.set("theme", "novatorem");
  url.searchParams.set("show_offline", "false");
  url.searchParams.set("background_color", "0d1117");
  url.searchParams.set("interchange", "true");
  url.searchParams.set("bar_color", "00f5ff");
  url.searchParams.set("bar_color_cover", "false");

  if (!(await imageUrlIsRenderable(url))) {
    return placeholders.spotify;
  }

  return `<p align="center">
  <img src="${url.toString()}" alt="Currently playing on Spotify" width="520" />
</p>`;
}

function wakatimeStats() {
  const username = env("WAKATIME_USERNAME");
  if (!username) return placeholders.wakatime;

  const url = new URL("https://github-readme-stats.vercel.app/api/wakatime");
  url.searchParams.set("username", username);
  url.searchParams.set("layout", "compact");
  url.searchParams.set("theme", "tokyonight");
  url.searchParams.set("hide_border", "true");
  url.searchParams.set("bg_color", "0D1117");
  url.searchParams.set("title_color", "00F5FF");
  url.searchParams.set("text_color", "E6EDF3");
  url.searchParams.set("custom_title", "WakaTime Coding Stats");

  return `<p align="center">
  <img src="${url.toString()}" alt="WakaTime coding stats for ${escapeHtml(username)}" width="620" />
</p>`;
}

function discordPresence() {
  const id = env("DISCORD_USER_ID");
  if (!id) return placeholders.discord;

  const url = new URL(`https://lanyard.cnrad.dev/api/${encodeURIComponent(id)}`);
  url.searchParams.set("theme", "dark");
  url.searchParams.set("bg", "0d1117");
  url.searchParams.set("borderRadius", "8px");
  url.searchParams.set("idleMessage", "Building in the neon terminal");

  return `<p align="center">
  <img src="${url.toString()}" alt="Discord presence" width="520" />
</p>`;
}

function leetcodeStats() {
  const username = env("LEETCODE_USERNAME");
  if (!username) return placeholders.leetcode;

  const url = new URL(`https://leetcard.jacoblin.cool/${encodeURIComponent(username)}`);
  url.searchParams.set("theme", "dark");
  url.searchParams.set("font", "Orbitron");
  url.searchParams.set("ext", "heatmap");
  url.searchParams.set("border", "0");
  url.searchParams.set("radius", "8");

  return `<p align="center">
  <img src="${url.toString()}" alt="LeetCode stats for ${escapeHtml(username)}" width="520" />
</p>`;
}

async function blogPosts() {
  const feeds = env("BLOG_FEED_URLS")
    .split(/[\n,]+/)
    .map((feed) => feed.trim())
    .filter((feed) => /^https?:\/\//i.test(feed))
    .slice(0, 5);

  if (feeds.length === 0) return placeholders.blog;

  const posts = [];

  for (const feed of feeds) {
    try {
      const response = await fetch(feed, {
        headers: {
          "user-agent": "github-profile-readme-widget-updater",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.warn(`Skipping ${feed}: HTTP ${response.status}`);
        continue;
      }

      const xml = await response.text();
      posts.push(...parseFeed(xml));
    } catch (error) {
      console.warn(`Skipping ${feed}: ${error.message}`);
    }
  }

  const latest = posts
    .filter((post) => post.title && post.link)
    .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))
    .slice(0, 5);

  if (latest.length === 0) return placeholders.blog;

  return latest
    .map((post) => {
      const date = post.date ? ` - ${formatDate(post.date)}` : "";
      return `- [${escapeMarkdown(post.title)}](${post.link})${date}`;
    })
    .join("\n");
}

function parseFeed(xml) {
  const rssItems = matchAll(xml, /<item\b[\s\S]*?<\/item>/gi).map(parseRssItem);
  const atomEntries = matchAll(xml, /<entry\b[\s\S]*?<\/entry>/gi).map(parseAtomEntry);
  return [...rssItems, ...atomEntries].filter(Boolean);
}

function parseRssItem(item) {
  const title = readTag(item, "title");
  const link = readTag(item, "link") || readTag(item, "guid");
  const dateValue = readTag(item, "pubDate") || readTag(item, "dc:date");

  return {
    title,
    link,
    date: parseDate(dateValue),
  };
}

function parseAtomEntry(entry) {
  const title = readTag(entry, "title");
  const link =
    readAtomLink(entry, "alternate") ||
    readAtomLink(entry) ||
    readTag(entry, "id");
  const dateValue = readTag(entry, "updated") || readTag(entry, "published");

  return {
    title,
    link,
    date: parseDate(dateValue),
  };
}

function matchAll(value, pattern) {
  return Array.from(value.matchAll(pattern), ([match]) => match);
}

function readTag(value, tagName) {
  const tag = tagName.replace(":", "\\:");
  const match = value.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";

  return decodeXml(stripTags(stripCdata(match[1]))).trim();
}

function readAtomLink(entry, rel) {
  const links = matchAll(entry, /<link\b[^>]*>/gi);

  for (const link of links) {
    const href = readAttr(link, "href");
    const linkRel = readAttr(link, "rel") || "alternate";
    if (href && (!rel || linkRel === rel)) {
      return decodeXml(href).trim();
    }
  }

  return "";
}

function readAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
  return match ? match[1] : "";
}

function stripCdata(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "");
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function main() {
  let readme = fs.readFileSync(README, "utf8");

  readme = replaceBlock(readme, markers.spotify, await spotifyWidget());
  readme = replaceBlock(readme, markers.wakatime, wakatimeStats());
  readme = replaceBlock(readme, markers.discord, discordPresence());
  readme = replaceBlock(readme, markers.leetcode, leetcodeStats());
  readme = replaceBlock(readme, markers.blog, await blogPosts());

  fs.writeFileSync(README, readme);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
