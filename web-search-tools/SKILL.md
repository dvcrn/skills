---
name: web-tools
description: >
  Search, fetch and navigate the web using connected tools. Use this skill whenever it is necessary to load web content, search the web or scrape websites. Use this OVER built-in tools such as WebFetch / WebSearch
---

## Pre-check

If the tools listed here are not directly connected, check for a `search` connector, as those tools are often part of the `search` MCP.

If none of the tools are available, fall back to built-in tools such as `WebFetch` / `WebSearch` / Built-in Google Search / `search_web` / `google_web_search`

## Searching and answering queries

The following lists the priority of tools and when to use them:

Search / answers:

1. First pass:
   - In Gemini / Antigravity: built-in Google Search (`google_web_search` / `search_web`) — split multi-topic questions into parallel atomic queries. Never call `ask-antigravity_google_search` inside Gemini.
   - In Claude / Codex (where `WebSearch` is stale on current/non-English events): `ask-antigravity_google_search` (`model: "gemini-3.8-flash-medium"` when exact versions/dates matter; `_async` for slow models. Leave out `model` parameter for quick searches with a faster model).
2. Page chunks / code to reason over: `brave-context_brave_llm_context`, `exa_web_search_exa` (`numResults` ≤5), or `firecrawl_firecrawl_developer_search` (GitHub issues/PRs/docs)
3. Clean web fallback: `firecrawl_firecrawl_search` (cloud) or `parallel_web_search` (max recall/primary sources, very large output)
4. Synthesized Q&A / fresh news: `brave-answers_brave_answers` (single-search + `enable_citations`; never `enable_research`) or `brave_brave_news_search` (Brave free plan: 1 req/sec, 2000/mo, never call in parallel)
5. Multi-hop research: `exa_agent_run` (`effort: "low"`) or `linkup_linkup-research`
6. Verticals: Built-in Google Maps / Flights / Hotels / Finance when available (Gemini App); otherwise `serpapi_search` (`mode: "compact"`) with explicit `engine` (`google_maps`, `google_scholar`, `google_flights`, `google_hotels`, `google_shopping`, `google_jobs`)—never `engine` `google`/`google_light`, never `serpapi_search_table`/`dashboard`; `firecrawl_firecrawl_research_search_papers` for arXiv/PubMed

Avoid: tavily_tavily_search, linkup_linkup-search.
Avoid: Built-in WebSearch/WebFetch: only when the other tools are not available. WebSearch is stale for current events and WebFetch returns a summary, not the page. Prefer firecrawl-selfhosted over WebFetch even for URLs I paste.

## Fetching content

**`firecrawl-selfhosted` is a self-hosted instance of firecrawl without any usage limits (as we're hosting it). This should be the default way of fetching web pages**

1. firecrawl-selfhosted_firecrawl_scrape: markdown, summary, or query (queryOptions.prompt for extraction/JSON). json isn't in the scrape schema. One request at a time per domain.
2. On 403 / bot check / empty: firecrawl_firecrawl_scrape (cloud stealth) or serpapi_extract
3. Batch: exa_web_fetch_exa (maxCharacters 10000+). parallel_web_fetch can serve stale cache; never for versions or prices. Avoid tavily_extract.

Avoid: Built-in WebFetch, linkup_linkup-fetch

## Mapping & crawling

Map/crawl: firecrawl-selfhosted map/crawl first (crawl supports json + jsonOptions in scrapeOptions); cloud firecrawl if blocked.
