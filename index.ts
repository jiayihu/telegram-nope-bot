import { Context, Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/function';
import { Newtype, iso } from 'newtype-ts';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

interface Ticker extends Newtype<{ readonly Ticker: unique symbol }, string> {}
const isoTicker = iso<Ticker>();

const TICKERS = [
  'AAPL',
  'AMZN',
  'ARKK',
  'BALY',
  'BB',
  'BLI',
  'CLOV',
  'CRSA',
  'EEM',
  'GME',
  'GRWG',
  'IWM',
  'MGNI',
  'NOK',
  'PLTR',
  'QQQ',
  'SPY',
  'SSPK',
  'TLRY',
  'TSLA',
];

function validateTicker(ticker: string): O.Option<Ticker> {
  return TICKERS.includes(ticker) ? O.some(isoTicker.wrap(ticker)) : O.none;
}

type TrackRecord = {
  ticker: Ticker;
  token: NodeJS.Timeout;
};

let trackingRecords: Array<TrackRecord> = [];

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

bot.hears(['hi', 'Hi'], (ctx) => ctx.reply('Hey there'));

bot.command('now', (ctx) => {
  const ticker = ctx.message.text.replace('/now ', '');

  if (ticker === '/now') {
    return ctx.reply(`Wrong command format. Correct format is '/now GME'`);
  }

  pipe(
    validateTicker(ticker),
    O.fold(
      () => {
        ctx.reply(`Ticker ${ticker} not in the list`);
      },
      (ticker) => {
        requestNOPE(ticker)
          .then(([nope, price]) => {
            const msg = buildMsg(ticker, nope, price);

            ctx.reply(msg);
          })
          .catch((e) => replyError(ctx, e));
      },
    ),
  );
});

bot.command('track', (ctx) => {
  const message = ctx.message.text.replace('/track ', '');

  if (message === '/track') {
    return ctx.reply(`Wrong command format. Correct format is '/track GME 30'`);
  }

  const [ticker, thresholdAbs] = message.trim().split(' ');
  const threshold = Math.abs(Number(thresholdAbs));

  pipe(
    validateTicker(ticker),
    E.fromOption(() => `Ticker ${ticker} not in the list`),
    E.chain((ticker) => {
      const record = trackingRecords.find((r) => r.ticker === ticker);

      return record ? E.left(`Ticker already being tracked`) : E.right(ticker);
    }),
    E.chain((ticker) => {
      return Number.isNaN(threshold)
        ? E.left(`Invalid threshold ${threshold}. Correct format is '/track GME 30'`)
        : E.right(ticker);
    }),
    E.fold(
      (error) => {
        ctx.reply(error);
      },
      (ticker) => {
        const update = () =>
          requestNOPE(ticker)
            .then(([nope, price]) => {
              if (Math.abs(nope) >= threshold) {
                const msg = buildMsg(ticker, nope, price);

                ctx.reply(msg);
              }
            })
            .catch((e) => {
              replyError(ctx, e);
              untrack(ticker);
            });

        let token = setInterval(() => update(), 30 * 1000); // 30s
        trackingRecords = [...trackingRecords, { ticker, token }];

        ctx.reply(`Tracking ticker ${ticker} with threshold ${threshold}`);
        update();
      },
    ),
  );
});

bot.command('untrack', (ctx) => {
  const ticker = ctx.message.text.replace('/untrack ', '');

  if (ticker === '/untrack') {
    return ctx.reply(`Wrong command format. Correct format is '/untrack GME'`);
  }

  pipe(
    validateTicker(ticker),
    E.fromOption(() => `Ticker ${ticker} not in the list`),
    E.chain((ticker) => E.fromOption(() => `Ticker not tracked`)(untrack(ticker))),
    E.fold(
      (error) => {
        ctx.reply(error);
      },
      () => {
        ctx.reply(`${ticker} untracked`);
      },
    ),
  );
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function requestNOPE(ticker: Ticker) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${month}-${day}-${now.getFullYear()}`;
  const url = `https://nopechart.com/cache/${ticker}_${date}.json?=${now.getTime()}`;
  console.log(url);

  return fetch(url)
    .then((response) => response.json())
    .then((ticks) => {
      if (!ticks.length) {
        throw new Error('No data available');
      }

      const last = ticks[ticks.length - 1];
      const { nope, price } = last;

      return [nope, price];
    });
}

function replyError(ctx: Context, error: any) {
  ctx.reply(`Error requesting NOPE: ${error}`);
}

function untrack(ticker: Ticker): O.Option<TrackRecord> {
  let record = trackingRecords.find((r) => r.ticker === ticker);

  if (!record) return O.none;

  trackingRecords = trackingRecords.filter((r) => r.ticker !== ticker);
  clearInterval(record.token);

  return O.some(record);
}

function buildMsg(ticker: Ticker, nope: number, price: number) {
  const nopePretty = nope.toFixed(2);
  const pricePretty = price.toFixed(2);

  return `${ticker} NOPE: ${nopePretty}, price: ${pricePretty}`;
}
