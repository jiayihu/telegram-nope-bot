import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';

require('dotenv').config();

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

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);
bot.hears('Hi', (ctx) => ctx.reply('Hey there'));

bot.command('now', (ctx) => {
  const ticker = ctx.message.text.replace('/now ', '');

  if (ticker === '/now') {
    return ctx.reply(`Wrong command format. Correct format is '/now GME'`);
  }

  if (!TICKERS.includes(ticker)) {
    return ctx.reply(`Ticker ${ticker} not in the list`);
  }

  requestNOPE(ticker).then(([nope, price]) => {
    const msg = buildMsg(ticker, nope, price);

    ctx.reply(msg);
  });
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

  const update = () =>
    requestNOPE(ticker).then(([nope, price]) => {
      if (Math.abs(nope) >= threshold) {
        const msg = buildMsg(ticker, nope, price);

        ctx.reply(msg);
      }
    });

  setInterval(() => update(), 30 * 1000); // 30s

  ctx.reply(`Tracking ticker ${ticker} with threshold ${threshold}`);

  update();
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

  return fetch(url)
    .then((response) => response.json())
    .then((ticks) => {
      const last = ticks[ticks.length - 1];
      const { nope, price } = last;

      return [nope, price];
    });
}

function buildMsg(ticker: string, nope: number, price: number) {
  const nopePretty = nope.toFixed(2);
  const pricePretty = price.toFixed(2);

  return `${ticker} NOPE: ${nopePretty}, price: ${pricePretty}`;
}

function requestPage(url: string) {
  return fetch(url).then((response) => response.text());
}
