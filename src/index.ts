import { Context, Telegraf } from 'telegraf';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/lib/Option';
import * as TE from 'fp-ts/lib/TaskEither';
import { pipe } from 'fp-ts/lib/function';
import { Ticker, validateTicker, requestNOPE, NOPEError } from './nope';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

type TrackRecord = {
  ticker: Ticker;
  token: NodeJS.Timeout;
};

let trackingRecords: Array<TrackRecord> = [];

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

bot.hears(['hi', 'Hi'], (ctx) => ctx.reply('Hey there. This is NOPE-bot v0.1'));

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
        requestNOPE(ticker)()
          .then((nope) => {
            pipe(
              nope,
              E.fold(
                (error) => {
                  switch (error.type) {
                    case 'JSONParseError':
                    case 'EmptyDataError':
                      ctx.reply(`Error requesting the NOPE now. Retry.`);
                      break;
                    case 'HTTPError':
                      ctx.reply(`Error requesting the NOPE: ${error.details}`);
                  }
                },
                ({ nope, price }) => {
                  const msg = buildMsg(ticker, nope, price);

                  ctx.reply(msg);
                },
              ),
            );
          })
          .catch((e) => ctx.reply(`Unexpected error: ${e}. Contact Jiayi :P`));
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
        const update = () => {
          requestNOPE(ticker)()
            .then((nope) => {
              pipe(
                nope,
                E.fold(
                  (error) => {
                    switch (error.type) {
                      case 'JSONParseError':
                      case 'EmptyDataError':
                        // Ignore
                        break;
                      case 'HTTPError':
                        ctx.reply(`Error requesting the NOPE: ${error.details}`);
                        untrack(ticker);
                    }
                  },
                  ({ nope, price }) => {
                    if (Math.abs(nope) >= threshold) {
                      const msg = buildMsg(ticker, nope, price);

                      ctx.reply(msg);
                    }
                  },
                ),
              );
            })
            .catch((e) => ctx.reply(`Unexpected error: ${e}. Contact Jiayi :P`));
        };

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
