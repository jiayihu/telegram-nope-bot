import { Context, Telegraf } from 'telegraf';
import fetch from 'node-fetch';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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

type TrackRecord = {
  ticker: string;
  token: NodeJS.Timeout;
};

let trackingRecords: Array<TrackRecord> = [];

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

bot.command('hi', (ctx) => ctx.reply('Hey there'));

bot.command('now', (ctx) => {
  const ticker = ctx.message.text.replace('/now ', '');

  if (ticker === '/now') {
    return ctx.reply(`Wrong command format. Correct format is '/now GME'`);
  }

  if (!TICKERS.includes(ticker)) {
    return ctx.reply(`Ticker ${ticker} not in the list`);
  }

  requestNOPE(ticker)
    .then(([nope, price]) => {
      const msg = buildMsg(ticker, nope, price);

      ctx.reply(msg);
    })
    .catch((e) => handleNOPEError(ctx, e));
});

bot.command('track', (ctx) => {
  const message = ctx.message.text.replace('/track ', '');

  if (message === '/track') {
    return ctx.reply(`Wrong command format. Correct format is '/track GME'`);
  }

  const [ticker, thresholdAbs] = message.trim().split(' ');
  const threshold = Math.abs(Number(thresholdAbs));

  if (!TICKERS.includes(ticker)) {
    return ctx.reply(`Ticker ${ticker} not in the list`);
  }

  if (trackingRecords.find((r) => r.ticker === ticker)) {
    return ctx.reply(`Ticker already being tracked`);
  }

  const update = () =>
    requestNOPE(ticker)
      .then(([nope, price]) => {
        if (Math.abs(nope) >= threshold) {
          const msg = buildMsg(ticker, nope, price);

          ctx.reply(msg);
        }
      })
      .catch((e) => handleNOPEError(ctx, e));

  let token = setInterval(() => update(), 30 * 1000); // 30s
  trackingRecords = [...trackingRecords, { ticker, token }];

  ctx.reply(`Tracking ticker ${ticker} with threshold ${threshold}`);
  update();
});

bot.command('untrack', (ctx) => {
  const ticker = ctx.message.text.replace('/untrack ', '');

  if (ticker === '/untrack') {
    return ctx.reply(`Wrong command format. Correct format is '/untrack GME'`);
  }

  if (!TICKERS.includes(ticker)) {
    return ctx.reply(`Ticker ${ticker} not in the list`);
  }

  let record = trackingRecords.find((r) => r.ticker === ticker);

  if (!record) {
    return ctx.reply(`Ticker not tracked`);
  }

  trackingRecords = trackingRecords.filter((r) => r.ticker !== ticker);
  clearInterval(record.token);

  ctx.reply(`${ticker} untracked`);
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function requestNOPE(ticker: string) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${month}-${day}-${now.getFullYear()}`;
  const url = `https://nopechart.com/cache/${ticker}_${date}.json?=${now.getTime()}`;
  console.log(url);

  return fetch(url)
    .then((response) => response.json())
    .then((ticks) => {
      const last = ticks[ticks.length - 1];
      const { nope, price } = last;

      return [nope, price];
    });
}

function handleNOPEError(ctx: Context, error: any) {
  ctx.reply(`Error requesting NOPE: ${error}`);
}

function buildMsg(ticker: string, nope: number, price: number) {
  const nopePretty = nope.toFixed(2);
  const pricePretty = price.toFixed(2);

  return `${ticker} NOPE: ${nopePretty}, price: ${pricePretty}`;
}
