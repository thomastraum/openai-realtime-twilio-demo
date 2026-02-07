import { FunctionHandler } from "./types";
import { exec } from "child_process";
import { promisify } from "util";
import YahooFinance from "yahoo-finance2";

const execAsync = promisify(exec);
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const BRAVE_API_KEY = "BSAFD6RDnW2X_MfRtzwEKUYjzvY9URt";
const OPENCLAW_TOKEN = "014f8943579c8d8e5dc5d26a501e2b213845b957bc16058f";
const OPENCLAW_PORT = 18789;

async function runCommand(cmd: string, timeoutMs = 15000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: timeoutMs });
    return stdout.trim() || stderr.trim() || "(no output)";
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

const functions: FunctionHandler[] = [];

// ─── Web Search ───
functions.push({
  schema: {
    name: "web_search",
    type: "function",
    description:
      "Search the web for current information. Use this for news, facts, prices, or anything you don't know.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args: { query: string }) => {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}&count=5`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": BRAVE_API_KEY,
        },
      });
      const data = await response.json();
      const results = (data.web?.results || [])
        .slice(0, 5)
        .map(
          (r: any) =>
            `${r.title}: ${r.description || ""}${r.url ? ` (${r.url})` : ""}`
        );
      return JSON.stringify({ results });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Calendar (today + upcoming) ───
functions.push({
  schema: {
    name: "check_calendar",
    type: "function",
    description:
      "Check Thomas's Google Calendar for today's events or upcoming events in the next few days.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description:
            "Number of days ahead to check (default 1 for today, max 7)",
        },
      },
      required: [],
    },
  },
  handler: async (args: { days?: number }) => {
    const days = Math.min(args.days || 1, 7);
    const output = await runCommand(
      `gog calendar events --days ${days} --plain 2>/dev/null`
    );
    return JSON.stringify({ events: output || "No events found" });
  },
});

// ─── Email Check ───
functions.push({
  schema: {
    name: "check_email",
    type: "function",
    description:
      "Check Thomas's email inbox for recent unread messages. Returns subject, sender, and date.",
    parameters: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of recent emails to fetch (default 5, max 10)",
        },
      },
      required: [],
    },
  },
  handler: async (args: { count?: number }) => {
    const count = Math.min(args.count || 5, 10);
    const output = await runCommand(
      `himalaya list -s 0 -S ${count} --plain 2>/dev/null`
    );
    return JSON.stringify({ emails: output || "No emails found" });
  },
});

// ─── Weather ───
functions.push({
  schema: {
    name: "get_weather",
    type: "function",
    description:
      "Get the current weather for a location. Defaults to London if no location specified.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "City name (default: London)",
        },
      },
      required: [],
    },
  },
  handler: async (args: { location?: string }) => {
    const location = args.location || "London";
    try {
      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`
      );
      const data = await response.json();
      const current = data.current_condition?.[0];
      if (current) {
        return JSON.stringify({
          location,
          temp_c: current.temp_C,
          feels_like_c: current.FeelsLikeC,
          description: current.weatherDesc?.[0]?.value,
          humidity: current.humidity,
          wind_mph: current.windspeedMiles,
        });
      }
      return JSON.stringify({ error: "Could not get weather data" });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Send Message to Chat-Tre ───
functions.push({
  schema: {
    name: "send_to_tre_chat",
    type: "function",
    description:
      "Send a message or task to Tre's main chat session. Use this for things that need more complex processing, file access, or actions that voice-Tre can't do directly. Tre in chat will handle it and Thomas will see the result in Telegram.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message or task to send to chat-Tre",
        },
      },
      required: ["message"],
    },
  },
  handler: async (args: { message: string }) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${OPENCLAW_PORT}/api/sessions/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENCLAW_TOKEN}`,
          },
          body: JSON.stringify({
            sessionKey: "agent:main:main",
            message: `[Voice request from Thomas]: ${args.message}`,
          }),
        }
      );
      if (response.ok) {
        return JSON.stringify({
          status: "Message sent to chat-Tre. Thomas will see the result in Telegram.",
        });
      }
      return JSON.stringify({ error: `Failed: ${response.status}` });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Stock Quote (yahoo-finance2) ───
functions.push({
  schema: {
    name: "stock_quote",
    type: "function",
    description:
      "Get real-time stock price, change, market cap, and key stats for any ticker. Use this when asked about a specific stock's current price or performance.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description:
            "Stock ticker symbol (e.g. AAPL, TSLA, GLEN.L for London-listed)",
        },
      },
      required: ["ticker"],
    },
  },
  handler: async (args: { ticker: string }) => {
    try {
      const quote = await yf.quote(args.ticker);
      if (!quote) return JSON.stringify({ error: "No data found" });
      return JSON.stringify({
        symbol: quote.symbol,
        name: quote.shortName || quote.longName,
        price: quote.regularMarketPrice,
        currency: quote.currency,
        change: quote.regularMarketChange,
        changePercent: quote.regularMarketChangePercent,
        dayHigh: quote.regularMarketDayHigh,
        dayLow: quote.regularMarketDayLow,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        marketCap: quote.marketCap,
        marketState: quote.marketState,
        fiftyDayAvg: quote.fiftyDayAverage,
        twoHundredDayAvg: quote.twoHundredDayAverage,
      });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Stock News (yahoo-finance2 search) ───
functions.push({
  schema: {
    name: "stock_news",
    type: "function",
    description:
      "Get the latest news for a stock or financial topic. Returns recent headlines from Yahoo Finance.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Stock ticker or topic to search (e.g. AAPL, 'UK interest rates', 'oil prices')",
        },
      },
      required: ["query"],
    },
  },
  handler: async (args: { query: string }) => {
    try {
      const results = await yf.search(args.query, { newsCount: 8, quotesCount: 0 });
      const news = (results.news || []).slice(0, 8).map((n: any) => ({
        title: n.title,
        publisher: n.publisher,
        date: n.providerPublishTime,
        link: n.link,
      }));
      return JSON.stringify({ news });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Stock Insights (analyst recommendations + significant developments) ───
functions.push({
  schema: {
    name: "stock_insights",
    type: "function",
    description:
      "Get analyst recommendations, target prices, significant developments, and research reports for a stock. Great for investment research.",
    parameters: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Stock ticker symbol (e.g. AAPL, TSLA)",
        },
      },
      required: ["ticker"],
    },
  },
  handler: async (args: { ticker: string }) => {
    try {
      const data = await yf.insights(args.ticker, { reportsCount: 3 });
      const result: any = { symbol: data.symbol };

      if (data.recommendation) {
        result.recommendation = data.recommendation;
      }
      if (data.instrumentInfo?.technicalEvents) {
        const te = data.instrumentInfo.technicalEvents;
        result.technicalOutlook = {
          shortTerm: te.shortTermOutlook?.direction,
          mediumTerm: te.intermediateTermOutlook?.direction,
          longTerm: te.longTermOutlook?.direction,
        };
      }
      if (data.instrumentInfo?.valuation) {
        result.valuation = data.instrumentInfo.valuation.description;
      }
      if (data.sigDevs?.length) {
        result.significantDevelopments = data.sigDevs.slice(0, 5).map((d: any) => ({
          headline: d.headline,
          date: d.date,
        }));
      }
      if (data.reports?.length) {
        result.reports = data.reports.slice(0, 3).map((r: any) => ({
          title: r.reportTitle,
          provider: r.provider,
          date: r.reportDate,
          rating: r.investmentRating,
          targetPrice: r.targetPrice,
        }));
      }
      return JSON.stringify(result);
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Market Overview (major indices) ───
functions.push({
  schema: {
    name: "market_overview",
    type: "function",
    description:
      "Get an overview of major market indices (S&P 500, FTSE 100, Nasdaq, etc.). Use when asked about 'the market' or 'how markets are doing'.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async () => {
    try {
      const indices = ["^GSPC", "^IXIC", "^FTSE", "^GDAXI", "^N225"];
      const names: Record<string, string> = {
        "^GSPC": "S&P 500",
        "^IXIC": "Nasdaq",
        "^FTSE": "FTSE 100",
        "^GDAXI": "DAX",
        "^N225": "Nikkei 225",
      };
      const results = await Promise.all(
        indices.map(async (idx) => {
          try {
            const q = await yf.quote(idx);
            return {
              name: names[idx],
              price: q?.regularMarketPrice,
              change: q?.regularMarketChange,
              changePercent: q?.regularMarketChangePercent,
              state: q?.marketState,
            };
          } catch {
            return { name: names[idx], error: "unavailable" };
          }
        })
      );
      return JSON.stringify({ indices: results });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Trending Tickers ───
functions.push({
  schema: {
    name: "trending_stocks",
    type: "function",
    description:
      "Get currently trending stock tickers on Yahoo Finance. Shows what's popular and being watched.",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Region code (US, GB, DE). Default: US",
        },
      },
      required: [],
    },
  },
  handler: async (args: { region?: string }) => {
    try {
      const data = await yf.trendingSymbols(args.region || "US", { count: 10 });
      const symbols = (data.quotes || []).map((q: any) => q.symbol);
      // Fetch quotes for trending symbols
      const quotes = await Promise.all(
        symbols.slice(0, 8).map(async (s: string) => {
          try {
            const q = await yf.quote(s);
            return {
              symbol: s,
              name: q?.shortName,
              price: q?.regularMarketPrice,
              changePercent: q?.regularMarketChangePercent,
            };
          } catch {
            return { symbol: s };
          }
        })
      );
      return JSON.stringify({ trending: quotes });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Set Reminder ───
functions.push({
  schema: {
    name: "set_reminder",
    type: "function",
    description:
      "Set a reminder for Thomas. This sends the reminder to chat-Tre who will create a cron job for it.",
    parameters: {
      type: "object",
      properties: {
        reminder: {
          type: "string",
          description: "What to remind Thomas about",
        },
        when: {
          type: "string",
          description:
            "When to remind (e.g. 'in 30 minutes', 'tomorrow at 9am', 'Monday morning')",
        },
      },
      required: ["reminder", "when"],
    },
  },
  handler: async (args: { reminder: string; when: string }) => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${OPENCLAW_PORT}/api/sessions/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENCLAW_TOKEN}`,
          },
          body: JSON.stringify({
            sessionKey: "agent:main:main",
            message: `[Voice request from Thomas]: Set a reminder: "${args.reminder}" — timing: ${args.when}`,
          }),
        }
      );
      if (response.ok) {
        return JSON.stringify({
          status: `Reminder set: "${args.reminder}" for ${args.when}`,
        });
      }
      return JSON.stringify({ error: `Failed: ${response.status}` });
    } catch (err: any) {
      return JSON.stringify({ error: err.message });
    }
  },
});

// ─── Time & Date ───
functions.push({
  schema: {
    name: "get_time",
    type: "function",
    description: "Get the current date and time in London.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  handler: async () => {
    const now = new Date().toLocaleString("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return JSON.stringify({ datetime: now });
  },
});

export default functions;
