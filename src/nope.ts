import * as TE from 'fp-ts/lib/TaskEither';
import * as O from 'fp-ts/lib/Option';
import { Newtype, iso } from 'newtype-ts';
import { pipe } from 'fp-ts/lib/function';
import { last } from 'fp-ts/lib/Array';
import fetch from 'node-fetch';

export interface Ticker extends Newtype<{ readonly Ticker: unique symbol }, string> {}
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

export function validateTicker(ticker: string): O.Option<Ticker> {
  return TICKERS.includes(ticker) ? O.some(isoTicker.wrap(ticker)) : O.none;
}

type Tick = {
  nope: number;
  price: number;
};

export function requestNOPE(ticker: Ticker): TE.TaskEither<NOPEError, Tick> {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${month}-${day}-${now.getFullYear()}`;
  const url = `https://nopechart.com/cache/${ticker}_${date}.json?=${now.getTime()}`;
  console.log(url);

  return pipe(
    get<Array<Tick>>(url),
    TE.chain((nope) => {
      return TE.fromOption(() => new EmptyDataError() as NOPEError)(last(nope));
    }),
  );
}

export class JSONParseError {
  type = 'JSONParseError' as const;
}

export class EmptyDataError {
  type = 'EmptyDataError' as const;
}

export class HTTPError {
  type = 'HTTPError' as const;
  details: string;

  constructor(details: string) {
    this.details = details;
  }
}

export type NOPEError = JSONParseError | HTTPError | EmptyDataError;

function get<T>(url: string): TE.TaskEither<NOPEError, T> {
  return pipe(
    TE.tryCatch(
      () => fetch(url),
      (error) => new HTTPError(String(error)) as NOPEError,
    ),
    TE.chain((response) =>
      TE.tryCatch(
        () => response.json(),
        () => new JSONParseError() as NOPEError,
      ),
    ),
  );
}
