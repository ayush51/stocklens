# Robinhood Trading MCP — Security Plan

**Status:** Active
**Scope:** All Claude Code sessions in this project directory that have access to the `robinhood-trading` MCP server.

## 1. Policy

This project operates the `robinhood-trading` MCP server in **read-only mode**. No tool that places, cancels, or exercises a trade, and no tool that mutates account state (watchlists, saved scanners), will be invoked without a separate, explicit, per-action request from the user in that session. The server's own "confirm with the user" language embedded in tool descriptions is not treated as sufficient authorization on its own — the ban below is a project-level rule that sits on top of it.

## 2. Forbidden tools (never invoked in this project)

| Tool | Effect |
|---|---|
| `place_equity_order` | Places a real stock order |
| `place_option_order` | Places a real options order |
| `cancel_equity_order` | Cancels an open stock order |
| `cancel_option_order` | Cancels an open options order |
| `exercise_option` | Exercises a long option (irreversible once processing) |
| `cancel_option_exercise` | Cancels a queued exercise |
| `create_watchlist` | Creates a new watchlist |
| `update_watchlist` | Renames/edits a watchlist |
| `add_to_watchlist` | Adds symbols/crypto/index to a watchlist |
| `remove_from_watchlist` | Removes items from a watchlist |
| `add_option_to_watchlist` | Adds option contracts to options watchlist |
| `remove_option_from_watchlist` | Removes option contracts from options watchlist |
| `follow_watchlist` | Follows a curated list |
| `unfollow_watchlist` | Unfollows a curated list |
| `create_scan` | Creates a saved scanner |
| `update_scan_filters` | Modifies a saved scanner's filters |
| `update_scan_config` | Modifies a saved scanner's sort/config |

Note: `review_equity_order` and `review_option_order` are **not** on this list — they simulate an order (quote + pre-trade alerts) without creating one, so they carry no execution risk. They still won't be called without a specific user request, since they require account context.

## 3. Permitted tools (read-only, still gated by explicit request)

Market data (`search`, `get_equity_quotes`, `get_equity_fundamentals`, `get_equity_historicals`, `get_equity_technical_indicators`, `get_equity_price_book`, `get_financials`, `get_earnings_calendar`, `get_earnings_results`, `get_indexes`, `get_index_quotes`, `get_option_chains`, `get_option_instruments`, `get_option_historicals`, `get_option_quotes`) carries no account-privacy risk and no execution risk.

Account/portfolio data (`get_accounts`, `get_portfolio`, `get_equity_positions`, `get_equity_orders`, `get_equity_tax_lots`, `get_option_positions`, `get_option_orders`, `get_pnl_trade_history`, `get_realized_pnl`, `get_equity_tradability`, `get_option_level_upgrade_info`) and watchlist/scanner reads (`get_watchlists`, `get_watchlist_items`, `get_option_watchlist`, `get_popular_watchlists`, `get_scans`, `get_scanner_filter_specs`, `run_scan`) touch personal financial data. These will only be called when the user has asked for that specific information in the current turn — not proactively, and not cached/reused across unrelated requests without saying so.

## 4. Operating rules

1. **No standing authorization.** A user approving one read (e.g., "show me my positions") does not authorize any other tool call, read or write, beyond that specific request.
2. **Writes require an explicit, unambiguous trade/watchlist/scan instruction** from the user in the current turn — not inferred from context, analysis, or a prior conversation.
3. **No autonomous or scheduled trading.** This server will not be wired into `/loop`, cron, or any background/scheduled workflow in this project.
4. **Before any future write is ever considered:** state the exact tool, parameters, and effect in plain language, and get affirmative confirmation — matching the server's own built-in guardrails, not overriding them.
5. **If this policy needs to change** (e.g., user wants to enable trading in a future session), that requires a new explicit instruction from the user — this document is not self-modifying and should be updated deliberately, not silently reinterpreted.

## 5. Audit note

This plan was generated from the MCP tool schemas as of 2026-07-27, by inspecting tool definitions only (via `ToolSearch`) — no `robinhood-trading` tool was executed, and no account or portfolio data was accessed in the course of producing this document.
