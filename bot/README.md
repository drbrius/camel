# FTMO Trading Bot

Ein 24/7-Trading-Bot in TypeScript mit einer Risk-Engine, die FTMO-Regeln
strukturell erzwingt statt sie nur zu überwachen.

---

## Zuerst das Wichtigste: was dieses System kann und was nicht

**Was es kann.** Es macht einen Regelbruch nach FTMO-Maßstab strukturell
unwahrscheinlich. Bevor eine Position eröffnet wird, rechnet die Engine aus,
wo das Konto stünde, wenn *alle* offenen Positionen gleichzeitig ausgestoppt
würden. Liegt dieser Worst Case unter dem internen Tagesboden, wird der Trade
abgelehnt — nicht verkleinert, nicht "beobachtet", sondern abgelehnt. Der
interne Tagesstopp liegt bei 2,5 %, die FTMO-Grenze bei 5 %. Es gibt also
100 % Puffer, bevor die Challenge überhaupt in Gefahr gerät.

**Was es nicht kann.** Es kann keine 10.000–100.000 CHF im Monat garantieren,
und niemand kann das. Die beiden mitgelieferten Strategien sind
Standard-Ansätze (Donchian-Breakout, Bollinger/RSI-Mean-Reversion) mit
konventionellen Parametern. Sie sind **nicht** auf echten Daten optimiert oder
validiert — sie sind ein funktionierender Ausgangspunkt, keine bewiesene Edge.
Ob sie auf deinen Instrumenten Geld verdienen, musst du selbst mit echten
historischen Daten und anschließend auf einem Demokonto feststellen. Ein
Backtest auf den synthetischen Daten in diesem Repo sagt darüber **nichts** aus.

**Realistische Erwartung.** Prop-Firm-Trading ist gehebelt: 10 % Monatsrendite
auf einem 200k-Konto sind 20k, davon bleiben nach dem Profit-Split ~16–18k.
Das ist erreichbar — mit einer echten Edge, über viele Monate, mit
Rückschlägen. Die Rechnung "mehrere 100k pro Monat" setzt entweder mehrere
Millionen an Funded Capital oder ein Risiko voraus, das die Konten reihenweise
sprengt. Dieser Bot ist bewusst für das Erste gebaut, nicht für das Zweite.

---

## Schnellstart

```bash
npm install

npm run bot:test                  # 96 Tests: Risk-Engine, Sizing, Broker, E2E
npm run bot:backtest              # Backtest auf synthetischen Daten
npm run bot                       # Paper-Trading, 24/7-Loop, kein echtes Geld
```

Der Standard ist bewusst harmlos: `npm run bot` ohne Konfiguration kann keine
echte Order auslösen.

---

## Architektur

```
bot/
├── run.ts                  24/7-Runner (Paper / Live)
├── config.ts               FTMO-Regelsätze, Risiko-Presets, Validierung
├── types.ts                Domänentypen
├── core/
│   ├── risk.ts             ► Die Risk-Engine. Das Herzstück.
│   ├── sizing.ts           Positionsgröße aus Risiko, nie umgekehrt
│   ├── engine.ts           Entscheidungsschleife
│   ├── instruments.ts      Kontraktspezifikationen, Währungsumrechnung
│   ├── indicators.ts       EMA, ATR, RSI, ADX, Donchian, Bollinger
│   ├── time.ts             Broker-Tageswechsel, Sessions, Wochenende
│   ├── state.ts            Persistenz (überlebt Neustarts)
│   └── logger.ts           Strukturiertes Logging
├── brokers/
│   ├── paper.ts            Vollsimulation (Spread, Kommission, Swap, Slippage)
│   └── metaapi.ts          Echtes FTMO-MT5-Konto über MetaApi
├── strategies/
│   ├── trendBreakout.ts    Donchian-Breakout mit H4-Regimefilter
│   └── meanReversion.ts    Bollinger/RSI-Fade im Seitwärtsmarkt
├── data/                   Synthetischer Generator + CSV-Loader
├── backtest/               Backtester, Walk-Forward, Kennzahlen
└── tests.ts                Testsuite
```

Die Trennung ist bewusst scharf: **eine Strategie kann das Konto nicht
gefährden.** Sie liefert nur Richtung und Stop-Preis. Größe, Freigabe und
Abbruch entscheidet ausschließlich die Risk-Engine.

---

## Die Risk-Engine

### Zwei Ebenen

| Regel | FTMO | Intern (conservative) |
|---|---|---|
| Tagesverlust | 5 % | **1,5 % Soft-Stop / 2,5 % Hard-Stop** |
| Gesamtverlust | 10 % | **5 % Soft-Stop / 6 % Hard-Stop** |
| Risiko pro Trade | — | 0,25 % |
| Offenes Gesamtrisiko | — | 1,0 % |
| Trades pro Tag | — | 6 |

`validateConfig()` weigert sich zu starten, wenn die internen Grenzen nicht
strikt unter den FTMO-Grenzen liegen. Eine Fehlkonfiguration, die einen
Regelbruch ermöglichen würde, ist damit kein Betriebszustand.

### Die strukturelle Garantie

Die wichtigste Regel heißt `worst-case-floor`:

```
Worst-Case-Equity = Equity − Summe(offenes Risiko) − Risiko(neuer Trade)
```

Liegt dieser Wert (minus Sicherheitspuffer) unter dem Tagesboden, wird
abgelehnt. Damit ist ein Tagesverlust-Bruch nicht "unwahrscheinlich", sondern
rechnerisch ausgeschlossen — solange die Stops halten. Was sie nicht immer tun:
siehe *Grenzen* unten.

### Alle Ablehnungsgründe

`kill-switch`, `cooldown`, `profit-target-lock`, `market-closed`,
`rollover-window`, `weekend-flat`, `news-window`, `outside-trading-hours`,
`spread-too-wide`, `invalid-stop`, `stop-too-tight`, `stop-too-wide`,
`max-trades-per-day`, `max-positions`, `max-positions-per-symbol`,
`opposite-exposure`, `symbol-risk-cap`, `correlation-risk-cap`,
`aggregate-risk-cap`, `worst-case-floor`, `ftmo-daily-floor`,
`ftmo-total-floor`.

Jeder davon wird geloggt, wenn er greift. Kein stilles Nichtstun.

### Kill Switch

Beim Bruch des internen Gesamtverlust-Bodens (6 %) wird alles geschlossen und
der Kill Switch gesetzt. Er überlebt Tageswechsel *und* Neustarts und lässt
sich nur manuell zurücksetzen (`data/bot/state.json`). Das ist Absicht: ein
Konto, das 6 % verloren hat, hat ein Problem, das kein Neustart löst.

Zusätzlich greift der Kill Switch nach 10 aufeinanderfolgenden Engine-Fehlern —
wenn nicht mehr garantiert ist, dass Stops verwaltet werden, wird gestoppt.

### Warum Persistenz kritisch ist

Ein 24/7-Bot wird neu gestartet — Deployments, Container-Recycling, Crashes.
Würde der Tagesverlust-Zähler dabei zurückgesetzt, könnte eine Restart-Schleife
geradewegs durch das FTMO-Tageslimit laufen. Der Risikozustand wird deshalb
nach jeder Iteration atomar auf Platte geschrieben und beim Start geladen.

---

## FTMO-Besonderheiten, die im Code stecken

**Tageswechsel um Mitternacht Europe/Prague, nicht UTC.** Das ist eine der
häufigsten Ursachen für gerissene Challenges: ein Trade um 23:30 UTC gehört
bereits zum Folgetag des Brokers. Die gesamte Tageslogik läuft über
`brokerDayKey()` mit der IANA-Zeitzone.

**Tagesverlust-Basis.** FTMO rechnet gegen den Kontostand bei Tagesbeginn. Die
Engine nimmt bewusst das **Minimum** aus Tagesstart-Balance und
Tagesstart-Equity — wer mit schwebendem Verlust in den Tag geht, hätte sonst
ein zu großes Budget.

**Floating Drawdown zählt.** Die Bewertung im Backtester nutzt den
*niedrigsten* Equity-Punkt des Tages, nicht den Schlusskurs. Ein Tag, der
5,2 % im Minus war und grün schließt, reißt das Konto trotzdem.

**Wochenende und News.** Normale FTMO-Konten dürfen nicht über das Wochenende
halten und nicht in einem 2-Minuten-Fenster um High-Impact-News handeln. Beides
ist implementiert und über `FTMO_SWING_ACCOUNT=true` abschaltbar, wenn du ein
Swing-Konto hast.

⚠️ **Der News-Filter ist leer, bis du ihn fütterst.** `RiskManager.setNewsEvents()`
erwartet einen Wirtschaftskalender. Ohne den greift die Regel nie. Wenn du auf
einem Nicht-Swing-Konto handelst, ist das anzubinden Pflicht, nicht Kür.

---

## Strategien

### Trend-Breakout (`trend-breakout`)

40-Bar-Donchian-Breakout auf M15, gefiltert durch:
- ADX ≥ 22 (Trendregime)
- H4-EMA(20/50)-Struktur muss in dieselbe Richtung zeigen
- nur London / London-NY-Overlap / New York
- Schlusskurs muss den Kanal wirklich verlassen (kein Intrabar-Docht)
- kein Einstieg mehr, wenn der Ausbruch schon > 1,5 ATR gelaufen ist

Management: Stop 1,6 ATR, Break-even ab 1R, Hälfte bei 2R gebankt, Trailing
2,2 ATR ab 1,5R, Exit wenn ADX kollabiert.

Erwartete Charakteristik: Trefferquote 35–45 %, wenige große Gewinner.

### Mean-Reversion (`mean-reversion`)

Bollinger(20, 2σ)-Bruch gegen RSI(14)-Extrem bei ADX < 25, mit
Ablehnungsdocht. Ziel ist die Bandmitte, Stop 1,4 ATR, Zeitstopp nach 32 Bars.

Erwartete Charakteristik: Trefferquote 55–65 %, kleine Gewinner. Gefährlich in
Trends — deshalb der harte ADX-Filter und der Exit bei ADX > 45.

### Warum beide zusammen

Die Strategien sind bewusst gegenläufig: Breakouts verdienen im Trend und
bluten in der Range, Mean-Reversion umgekehrt. Für eine Challenge zählt die
Glätte der Equity-Kurve mehr als die Rendite — ein 5-%-Tageslimit bestraft
Varianz, nicht Mittelmäßigkeit.

Widersprechen sich beide auf demselben Symbol, wird **nicht** gehandelt.

---

## Backtesting

```bash
npm run bot:backtest                          # synthetisch (nur Plumbing-Test)
npm run bot:backtest -- --csv data/history    # echte Daten, <SYMBOL>.csv
npm run bot:backtest -- --walk-forward 6      # Out-of-Sample-Konsistenz
npm run bot:backtest -- --stress              # doppelter Spread, 1,0 Pip Slippage
npm run bot:backtest -- --out results.json    # vollständige Ergebnisse
```

Der Backtester fährt die **echte** Engine gegen den Paper-Broker. Wenn er sagt,
das Tageslimit wurde nie gerissen, ist das eine Aussage über den Code, der auch
live läuft — nicht über ein vereinfachtes Zweitmodell.

Der CSV-Loader erkennt die gängigen Exportformate (MT5, Dukascopy, HistData)
über den Header, inkl. getrennter Datums-/Zeitspalten.

### Wie du die Ergebnisse liest

| Kennzahl | Schwelle |
|---|---|
| Walk-Forward: profitable Fenster | ≥ 60 %, sonst curve-fitted |
| Fenster mit Limitbruch | **0.** Alles andere ist ein K.-o. |
| Profit Factor | < 1,3 ist Rauschen, nicht Edge |
| Trades | < 100 ist statistisch bedeutungslos |
| Stress-Modus | muss ebenfalls überleben |

Ein Backtest, der nur knapp besteht, ist ein gescheiterter Backtest. Die
Simulation ist optimistisch (siehe *Grenzen*), also braucht ein Ergebnis
Luft nach unten.

---

## Live-Betrieb mit FTMO

FTMO handelt auf MetaTrader 5, das keine native REST-API hat.
[MetaApi](https://metaapi.cloud) hostet ein MT5-Terminal und stellt es über
HTTPS bereit — das ist der Standardweg aus Node heraus.

```bash
# .env
BOT_BROKER=metaapi
METAAPI_TOKEN=dein-token
METAAPI_ACCOUNT_ID=deine-account-id
METAAPI_REGION=new-york

FTMO_PHASE=challenge          # challenge | verification | funded
FTMO_ACCOUNT_SIZE=100000
FTMO_CURRENCY=USD
FTMO_SWING_ACCOUNT=false

RISK_PROFILE=conservative     # conservative | balanced | aggressive
RISK_PER_TRADE_PCT=0.25
BOT_SYMBOLS=EURUSD,GBPUSD,XAUUSD
```

### Checkliste vor dem ersten echten Trade

1. `npm run bot:test` — alle 96 Tests grün.
2. Backtest auf **echten** Daten, mindestens 12 Monate, mit `--walk-forward 6`.
3. Derselbe Backtest mit `--stress`.
4. `BOT_DRY_RUN=true` gegen Live-Daten — Entscheidungen werden geloggt, keine
   Order geht raus. Mindestens eine Woche.
5. FTMO-**Demo**konto, mindestens zwei Wochen. Positionen im MT5-Terminal mit
   `getPositions()` abgleichen.
6. Instrumentspezifikationen in `core/instruments.ts` gegen den echten
   MT5-Server prüfen: Kontraktgröße, Pip-Größe, Kommission, Symbolnamen (FTMO
   hängt auf manchen Kontotypen Suffixe an, z. B. `EURUSD.raw`).
7. Wirtschaftskalender an `setNewsEvents()` anbinden.
8. Erst dann eine Challenge kaufen.

Schritte zu überspringen kostet die Challenge-Gebühr. Das ist der einzige
Grund, warum die Liste so lang ist.

---

## Grenzen — ehrlich

**Der Stop kann übersprungen werden.** Bei Gaps über das Wochenende oder in
News-Spikes füllt der Broker unter dem Stop. Die Worst-Case-Rechnung nimmt an,
dass Stops halten. Deshalb der 2,5-%-Puffer zur 5-%-Grenze: er ist genau dafür
da. Sicher ist er trotzdem nicht.

**Der Backtester ist optimistisch.** Bar-Daten statt Ticks; konstanter Spread
pro Instrument (real weitet er sich genau dann, wenn Breakouts triggern); kein
Gap-Modell; pauschaler Swap. Wenn Stop und Ziel in derselben Bar liegen, wird
der Stop angenommen — das ist die einzige Stelle, an der bewusst pessimistisch
gerechnet wird.

**Die synthetischen Daten beweisen nichts.** Der Generator erzeugt sauberere
Regime als jeder echte Markt. Er ist zum Testen der Mechanik da.

**Der MetaApi-Adapter ist ungetestet gegen die Live-API.** Endpunkte und
Feldnamen sind nach bestem Wissen implementiert, aber gegen die aktuelle
MetaApi-Dokumentation zu prüfen. Ein stilles 404 bedeutet Orders, die nie
platziert werden.

**Die Strategieparameter sind Konvention, nicht Optimierung.** Sie sind so
gewählt, dass die Filter unabhängige Prüfungen bleiben statt sich zu einem
Superfilter zu multiplizieren, der nie auslöst. Getestet auf echten Daten sind
sie nicht.

**Kein Margin-Modell.** Der Paper-Broker rechnet vereinfacht mit 1:30. Bei den
kleinen Positionsgrößen dieses Risikoprofils ist Margin nie das bindende
Limit — verlassen solltest du dich darauf trotzdem nicht.

---

## Betrieb

```bash
tail -f data/bot/bot.log                     # Live-Log
cat data/bot/state.json                      # Risikozustand
wc -l data/bot/trades.jsonl                  # Trade-Journal
```

Der Heartbeat loggt alle 15 Minuten Equity, Tages-PnL, verbleibendes
Tagesbudget und den Abstand zu beiden FTMO-Böden.

**Kill Switch zurücksetzen:** `killSwitch` in `data/bot/state.json` auf `false`
setzen — nachdem du im Journal verstanden hast, was passiert ist.

**Deployment:** Der Prozess reagiert auf SIGINT/SIGTERM mit sauberem
Herunterfahren und persistiert vorher den Zustand. Für 24/7 gehört er hinter
einen Supervisor (systemd, Docker-Restart-Policy, pm2). Wichtig: `data/`
muss ein persistentes Volume sein — sonst geht bei jedem Neustart der
Tagesverlust-Zähler verloren.
