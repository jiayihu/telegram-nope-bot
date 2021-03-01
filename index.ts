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

bot.command('track', (ctx) => {
  const ticker = ctx.message.text.replace('/track ', '');

  if (ticker === '/track') {
    return ctx.reply(`Wrong command format. Correct format is '/track GME'`);
  }

  if (!TICKERS.includes(ticker)) {
    return ctx.reply(`Ticker ${ticker} not in the list`);
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate() - 1).padStart(2, '0');
  const date = `${month}-${day}-${now.getFullYear()}`;
  const url = `https://nopechart.com/cache/${ticker}_${date}.json?=${now.getTime()}`;
  console.log(url);

  fetch(url)
    .then((response) => response.json())
    .then((ticks) => {
      const last = ticks[ticks.length - 1];
      const { nope, price } = last;

      ctx.reply(`NOPE: ${Math.round(nope)}, price: ${Math.round(price)}`);
    });

  ctx.reply(`Tracking ticker ${ticker}`);
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

function requestPage(url: string) {
  return fetch(url).then((response) => response.text());
}
